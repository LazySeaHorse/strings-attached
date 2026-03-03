import React, { useRef, useMemo, useCallback, useEffect } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  Background,
  BackgroundVariant,
  MiniMap,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
  applyNodeChanges,
  applyEdgeChanges,
} from '@xyflow/react';
import { DocumentNode } from './DocumentNode';
import { PdfPageNode } from './PdfPageNode';
import { ExplanationNode } from './ExplanationNode';
import { StringEdge } from './StringEdge';
import { useAppStore, useCanvasStore, useDocumentStore, isDocNode, type DocumentData } from './stores';
import { getPageDimensions, dataUrlToArrayBuffer } from './pdfUtils';
import { spawnExplanationNode } from './utils/canvasUtils';

interface CanvasInnerProps {
  document: DocumentData;
}

const EMPTY_NODES: Node[] = [];
const EMPTY_EDGES: Edge[] = [];

function CanvasInner({ document }: CanvasInnerProps) {
  const pendingPull = useAppStore((s) => s.pendingPull);
  const setPendingPull = useAppStore((s) => s.setPendingPull);
  const { screenToFlowPosition, fitView } = useReactFlow();

  const docId = document.id;
  const nodes = useCanvasStore((s) => s.canvasMap[docId]?.nodes ?? EMPTY_NODES);
  const edges = useCanvasStore((s) => s.canvasMap[docId]?.edges ?? EMPTY_EDGES);
  const setNodes = useCanvasStore((s) => s.setNodes);
  const setEdges = useCanvasStore((s) => s.setEdges);

  /** Tracks whether the ReactFlow viewport has been initialized (first fitView done) */
  const viewportReadyRef = useRef(false);

  const nodeTypes = useMemo(() => ({
    document: DocumentNode,
    explanation: ExplanationNode,
    pdfPage: PdfPageNode,
  }), []);

  const edgeTypes = useMemo(() => ({
    string: StringEdge,
  }), []);

  // Initialize canvas with nodes based on document type
  useEffect(() => {
    let cancelled = false;

    if (document.type === 'pdf' && document.pdfDataUrl && document.pdfNumPages) {
      // PDF mode: one node per page
      const firstPageId = `${docId}-page-1`;
      const currentNodes = useCanvasStore.getState().canvasMap[docId]?.nodes ?? [];
      const existingPageNode = currentNodes.find((n) => n.id === firstPageId);

      if (!existingPageNode) {
        // Load page dimensions, then create correctly-sized nodes
        const arrayBuffer = dataUrlToArrayBuffer(document.pdfDataUrl);
        getPageDimensions(arrayBuffer).then((dims) => {
          if (cancelled) return;

          const pageNodes: Node[] = [];
          const nodeWidth = 480;
          const gap = 40;
          let yOffset = 100;

          for (let i = 0; i < document.pdfNumPages!; i++) {
            const pageDim = dims[i] || { width: 612, height: 792 };
            const aspect = pageDim.height / pageDim.width;
            const contentHeight = Math.round(nodeWidth * aspect);
            const headerHeight = 42;

            pageNodes.push({
              id: `${docId}-page-${i + 1}`,
              type: 'pdfPage',
              position: { x: 100, y: yOffset },
              data: {
                title: document.title || 'PDF',
                pdfDataUrl: document.pdfDataUrl,
                pageNum: i + 1,
                totalPages: document.pdfNumPages,
              },
              dragHandle: '.node-drag-handle',
              style: { width: nodeWidth, height: contentHeight + headerHeight },
            });

            yOffset += contentHeight + headerHeight + gap;
          }

          // Keep any existing explanation nodes for this document
          const current = useCanvasStore.getState().canvasMap[docId];
          const explanationNodes = (current?.nodes ?? []).filter((n) => n.type === 'explanation');
          const explanationEdges = (current?.edges ?? []).filter((e) =>
            explanationNodes.some((n) => n.id === e.target)
          );

          setNodes(docId, [...pageNodes, ...explanationNodes]);
          setEdges(docId, explanationEdges);
        });
      } else {
        // Pages already exist — update pdfDataUrl in case it was lost from persistence
        setNodes(docId, (nds) =>
          nds.map((n) => {
            if (n.id.startsWith(`${docId}-page-`)) {
              return {
                ...n,
                data: {
                  ...n.data,
                  pdfDataUrl: document.pdfDataUrl,
                  title: document.title || 'PDF',
                },
              };
            }
            return n;
          })
        );
      }
    } else {
      // Markdown mode: single document node
      const currentNodes = useCanvasStore.getState().canvasMap[docId]?.nodes ?? [];
      const docNode = currentNodes.find((n) => n.id === docId);

      if (!docNode) {
        const explanationNodes = currentNodes.filter((n) => n.type === 'explanation');
        setNodes(docId, [
          {
            id: docId,
            type: 'document',
            position: { x: 100, y: 100 },
            data: {
              title: document.title || 'Document',
              content: document.content,
              docType: document.type,
            },
            dragHandle: '.node-drag-handle',
            style: { width: 480 },
          },
          ...explanationNodes,
        ]);
      } else {
        setNodes(docId, (nds) =>
          nds.map((n) =>
            n.id === docId
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    title: document.title || 'Document',
                    content: document.content,
                    docType: document.type,
                  },
                }
              : n
          )
        );
      }
    }

    return () => { cancelled = true; };
  }, [docId, document.content, document.pdfDataUrl, document.title, document.type, document.pdfNumPages, setNodes, setEdges]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // Intercept remove changes to clean up pulled-word glow
      const removeChanges = changes.filter((c) => c.type === 'remove');
      if (removeChanges.length > 0) {
        const currentNodes = useCanvasStore.getState().canvasMap[docId]?.nodes ?? [];
        const indicesToRemove: number[] = [];
        for (const change of removeChanges) {
          if (change.type === 'remove') {
            const node = currentNodes.find((n) => n.id === change.id);
            if (node?.type === 'explanation' && node.data?.sourceWordIndices) {
              indicesToRemove.push(...(node.data.sourceWordIndices as number[]));
            }
          }
        }
        if (indicesToRemove.length > 0) {
          useDocumentStore.getState().removePulledWords(docId, indicesToRemove);
        }
      }
      setNodes(docId, (nds) => applyNodeChanges(changes, nds));
    },
    [docId, setNodes]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges(docId, (eds) => applyEdgeChanges(changes, eds));
    },
    [docId, setEdges]
  );

  // ─── Process pendingPull (deferred node creation from all pull types) ──
  useEffect(() => {
    if (!pendingPull) return;

    const processPull = () => {
      const currentNodes = useCanvasStore.getState().canvasMap[docId]?.nodes ?? [];
      const sourceNode = currentNodes.find((n) => n.id === pendingPull.sourceNodeId);
      const explanationCount = currentNodes.filter((n) => n.type === 'explanation').length;

      let position: { x: number; y: number };

      if (pendingPull.fromMode === 'canvas' && viewportReadyRef.current) {
        // User was already on the canvas — screenToFlowPosition is reliable.
        // Place the node at the cursor's release point.
        position = screenToFlowPosition(pendingPull.screenPosition);
      } else if (sourceNode) {
        // Classic → canvas transition (or viewport not yet ready):
        // Place to the right of the source node, cascading vertically.
        const sourceWidth = (sourceNode.style?.width as number) || 480;
        position = {
          x: sourceNode.position.x + sourceWidth + 80,
          y: sourceNode.position.y + 50 + explanationCount * 40,
        };
      } else {
        // Source node hasn't been created yet (race on first mount).
        // Sensible default that lands beside the document node once it appears at (100, 100).
        position = {
          x: 660,
          y: 150 + explanationCount * 40,
        };
      }

      const newNodeId = spawnExplanationNode(
        docId,
        pendingPull.sourceNodeId,
        pendingPull.sourceText,
        pendingPull.sourceType,
        pendingPull.sourceWordIndices,
        position,
      );

      // Clear the pending pull before viewport animation to prevent re-processing
      setPendingPull(null);

      // Smoothly pan the viewport to center on the newly spawned node.
      // Use a short delay to let React render the new node before fitView measures it.
      requestAnimationFrame(() => {
        fitView({
          nodes: [{ id: newNodeId }],
          padding: 0.5,
          duration: 500,
          minZoom: 1,
          maxZoom: 1.2,
        });
      });
    };

    if (pendingPull.fromMode === 'classic' && !viewportReadyRef.current) {
      // The canvas just mounted — ReactFlow's initial fitView hasn't settled yet.
      // Wait a frame for the viewport to initialize, then process.
      const timer = requestAnimationFrame(() => {
        processPull();
      });
      return () => cancelAnimationFrame(timer);
    } else {
      processPull();
    }
  }, [pendingPull, docId, setPendingPull, screenToFlowPosition, fitView]);

  // Unified keyboard handler: ESC cancels drag, Delete/Backspace removes selected nodes
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Delete / Backspace → remove selected explanation nodes
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'MATH-FIELD') return;
        // Also bail if target is contenteditable (e.g. rich text fields)
        if ((e.target as HTMLElement)?.isContentEditable) return;

        const canvas = useCanvasStore.getState().canvasMap[docId];
        if (!canvas) return;

        const selectedNodes = canvas.nodes.filter((n) => n.selected);
        if (selectedNodes.length === 0) return;

        const selectedIds = new Set(selectedNodes.map((n) => n.id));

        // Don't delete document nodes
        for (const id of selectedIds) {
          if (isDocNode(id, docId)) return;
        }

        // Collect sourceWordIndices from deleted explanation nodes for glow cleanup
        const indicesToRemove: number[] = [];
        for (const node of selectedNodes) {
          if (node.type === 'explanation' && node.data?.sourceWordIndices) {
            indicesToRemove.push(...(node.data.sourceWordIndices as number[]));
          }
        }

        setNodes(docId, (nds) => nds.filter((n) => !selectedIds.has(n.id)));
        setEdges(docId, (eds) =>
          eds.filter(
            (e) => !selectedIds.has(e.source) && !selectedIds.has(e.target)
          )
        );

        if (indicesToRemove.length > 0) {
          useDocumentStore.getState().removePulledWords(docId, indicesToRemove);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [docId, setNodes, setEdges]);

  // Listen for fitView event from toolbar
  useEffect(() => {
    const handleFitView = () => fitView({ padding: 0.3, duration: 300 });
    window.addEventListener('fitView', handleFitView);
    return () => window.removeEventListener('fitView', handleFitView);
  }, [fitView]);

  // Listen for globalSearchNavigate → zoom to a specific node
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.type === 'node' && detail.nodeId) {
        fitView({
          nodes: [{ id: detail.nodeId }],
          padding: 0.5,
          duration: 500,
          minZoom: 1,
          maxZoom: 1.2,
        });
        // Select the node so it's visually highlighted
        setNodes(docId, (nds) =>
          nds.map((n) => ({ ...n, selected: n.id === detail.nodeId }))
        );
      }
    };
    window.addEventListener('globalSearchNavigate', handler);
    return () => window.removeEventListener('globalSearchNavigate', handler);
  }, [fitView, docId, setNodes]);

  // Mark viewport as ready after ReactFlow's onInit fires
  const handleInit = useCallback(() => {
    viewportReadyRef.current = true;
  }, []);

  const explanationCount = nodes.filter((n) => n.type === 'explanation').length;

  // ─── Focus mode: double-click explanation node → zoom to source + node ──
  const onNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (node.type !== 'explanation') return;
      const sourceNodeId = (node.data as any)?.sourceNodeId;
      const nodeIds = sourceNodeId
        ? [{ id: sourceNodeId }, { id: node.id }]
        : [{ id: node.id }];
      fitView({
        nodes: nodeIds,
        padding: 0.35,
        duration: 500,
        maxZoom: 1,
      });
    },
    [fitView],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onInit={handleInit}
      onNodeDoubleClick={onNodeDoubleClick}
      fitView
      fitViewOptions={{ padding: 0.3 }}
      minZoom={0.1}
      maxZoom={2}
      deleteKeyCode={null}
      proOptions={{ hideAttribution: true }}
      style={{ background: '#fafafa' }}
    >
      <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#e0e0e0" />
      <MiniMap
        nodeStrokeWidth={3}
        style={{
          background: '#fafafa',
          border: '1px solid #f0f0f0',
          borderRadius: 8,
          width: 140,
          height: 100,
        }}
        maskColor="rgba(0, 0, 0, 0.06)"
        nodeColor={(n) => n.type === 'explanation' ? '#3b82f6' : '#e5e5e5'}
      />

      {/* Empty canvas hint */}
      {explanationCount === 0 && (
        <div
          style={{
            position: 'absolute',
            bottom: 64,
            left: '50%',
            transform: 'translateX(-50%)',
            pointerEvents: 'none',
            zIndex: 5,
            textAlign: 'center',
          }}
        >
          <p style={{
            fontSize: '0.8125rem',
            color: '#a3a3a3',
            background: 'rgba(250,250,250,0.9)',
            padding: '6px 14px',
            borderRadius: 8,
            border: '1px solid #f0f0f0',
          }}>
            Drag a word from the document to create a string
          </p>
        </div>
      )}
    </ReactFlow>
  );
}

interface InfiniteCanvasProps {
  document: DocumentData;
}

export function InfiniteCanvas({ document }: InfiniteCanvasProps) {
  return (
    <ReactFlowProvider>
      <div style={{ width: '100%', height: '100%' }}>
        <CanvasInner document={document} />
      </div>
    </ReactFlowProvider>
  );
}