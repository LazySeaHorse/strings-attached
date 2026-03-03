import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Node, Edge } from '@xyflow/react';

/** Per-document canvas data */
export interface CanvasData {
  nodes: Node[];
  edges: Edge[];
}

interface CanvasState {
  /** Map of document ID → { nodes, edges } */
  canvasMap: Record<string, CanvasData>;

  /** Get canvas data for a document (returns empty defaults if none) */
  getCanvas: (docId: string) => CanvasData;

  /** Set nodes for a specific document */
  setNodes: (docId: string, nodesOrFn: Node[] | ((prev: Node[]) => Node[])) => void;

  /** Set edges for a specific document */
  setEdges: (docId: string, edgesOrFn: Edge[] | ((prev: Edge[]) => Edge[])) => void;

  /** Remove all explanation nodes/edges for a document, keep doc nodes */
  clearExplanations: (docId: string) => void;

  /** Delete all canvas data for a document */
  deleteCanvas: (docId: string) => void;

  /** Load an entire canvas map (used for .strings file import) */
  loadCanvasMap: (map: Record<string, CanvasData>) => void;

  /** Clear everything */
  clearAll: () => void;
}

const EMPTY_CANVAS: CanvasData = { nodes: [], edges: [] };

/** Check if a node ID represents a document/page node (not an explanation) */
export function isDocNode(nodeId: string, docId: string): boolean {
  return nodeId === docId || nodeId.startsWith(`${docId}-page-`);
}

export const useCanvasStore = create<CanvasState>()(
  persist(
    (set, get) => ({
      canvasMap: {},

      getCanvas: (docId) => get().canvasMap[docId] ?? EMPTY_CANVAS,

      setNodes: (docId, nodesOrFn) =>
        set((state) => {
          const prev = state.canvasMap[docId] ?? EMPTY_CANVAS;
          const newNodes = typeof nodesOrFn === 'function' ? nodesOrFn(prev.nodes) : nodesOrFn;
          return {
            canvasMap: {
              ...state.canvasMap,
              [docId]: { ...prev, nodes: newNodes },
            },
          };
        }),

      setEdges: (docId, edgesOrFn) =>
        set((state) => {
          const prev = state.canvasMap[docId] ?? EMPTY_CANVAS;
          const newEdges = typeof edgesOrFn === 'function' ? edgesOrFn(prev.edges) : edgesOrFn;
          return {
            canvasMap: {
              ...state.canvasMap,
              [docId]: { ...prev, edges: newEdges },
            },
          };
        }),

      clearExplanations: (docId) =>
        set((state) => {
          const prev = state.canvasMap[docId];
          if (!prev) return state;
          const docNodes = prev.nodes.filter((n) => isDocNode(n.id, docId));
          return {
            canvasMap: {
              ...state.canvasMap,
              [docId]: { nodes: docNodes, edges: [] },
            },
          };
        }),

      deleteCanvas: (docId) =>
        set((state) => {
          const { [docId]: _, ...rest } = state.canvasMap;
          return { canvasMap: rest };
        }),

      loadCanvasMap: (map) => set({ canvasMap: map }),

      clearAll: () => set({ canvasMap: {} }),
    }),
    {
      name: 'strings-attached-canvas',
      partialize: (state) => ({
        canvasMap: Object.fromEntries(
          Object.entries(state.canvasMap).map(([docId, canvas]) => [
            docId,
            {
              nodes: canvas.nodes.map((n) => {
                if (n.data?.pdfDataUrl) {
                  return { ...n, data: { ...n.data, pdfDataUrl: undefined } };
                }
                return n;
              }),
              edges: canvas.edges,
            },
          ]),
        ),
      }),
    }
  )
);