import type { Node, Edge } from '@xyflow/react';
import { useCanvasStore } from '../stores/canvasStore';
import { useDocumentStore } from '../stores/documentStore';
import type { NodeTabKey } from '../stores/types';

/**
 * Creates an explanation node + string edge and records pulled words.
 * Returns the new node's ID.
 *
 * This is a plain function (not a hook) — safe to call from event handlers anywhere.
 */
export function spawnExplanationNode(
  docId: string,
  sourceNodeId: string,
  sourceText: string,
  sourceType: 'word' | 'sentence',
  sourceWordIndices: number[],
  position: { x: number; y: number },
  sourceAnchor?: { x: number; y: number },
  defaultTab?: NodeTabKey,
): string {
  const newNodeId = `exp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const newNode: Node = {
    id: newNodeId,
    type: 'explanation',
    position,
    data: {
      sourceText,
      sourceType,
      sourceNodeId,
      createdAt: Date.now(),
      sourceWordIndices,
      docId,
      ...(defaultTab ? { activeNodeTab: defaultTab } : {}),
    },
    dragHandle: '.node-drag-handle',
    style: { width: 320 },
  };

  const newEdge: Edge = {
    id: `edge-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    source: sourceNodeId,
    target: newNodeId,
    type: 'string',
    data: {
      label: sourceText.length > 40 ? sourceText.slice(0, 40) + '\u2026' : sourceText,
      ...(sourceAnchor ? { sourceAnchor } : {}),
    },
  };

  useCanvasStore.getState().setNodes(docId, (nds) => [...nds, newNode]);
  useCanvasStore.getState().setEdges(docId, (eds) => [...eds, newEdge]);

  if (sourceWordIndices.length > 0) {
    useDocumentStore.getState().addPulledWords(docId, sourceWordIndices);
  }

  return newNodeId;
}

/**
 * Compute a sensible position for a new explanation node,
 * placed to the right of the source document node and cascading downward.
 */
export function computeSpawnPosition(docId: string, sourceNodeId: string): { x: number; y: number } {
  const canvas = useCanvasStore.getState().canvasMap[docId];
  const nodes = canvas?.nodes ?? [];
  const sourceNode = nodes.find((n) => n.id === sourceNodeId);
  const explanationCount = nodes.filter((n) => n.type === 'explanation').length;

  if (sourceNode) {
    const sourceWidth = (sourceNode.style?.width as number) || 480;
    return {
      x: sourceNode.position.x + sourceWidth + 80,
      y: sourceNode.position.y + 50 + explanationCount * 40,
    };
  }
  return {
    x: 660,
    y: 150 + explanationCount * 40,
  };
}