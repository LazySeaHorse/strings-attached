import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DocumentData, DocumentTab, Highlight, Annotation } from './types';

interface DocumentState {
  tabs: DocumentTab[];
  activeTabId: string | null;

  // Tab management
  addDocument: (doc: DocumentData) => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string | null) => void;

  // Convenience getter
  getActiveTab: () => DocumentTab | null;
  getActiveDocument: () => DocumentData | null;

  // Per-tab state
  updateScrollY: (tabId: string, scrollY: number) => void;

  // Highlights
  addHighlight: (tabId: string, highlight: Highlight) => void;
  removeHighlight: (tabId: string, highlightId: string) => void;
  clearHighlights: (tabId: string) => void;

  // Annotations
  addAnnotation: (tabId: string, annotation: Annotation) => void;
  removeAnnotation: (tabId: string, annotationId: string) => void;
  updateAnnotation: (tabId: string, annotationId: string, patch: Partial<Pick<Annotation, 'text' | 'latex' | 'notesMode' | 'color'>>) => void;
  reorderAnnotations: (tabId: string, fromIndex: number, toIndex: number) => void;

  // Pulled words (words dragged out to create explanation nodes)
  addPulledWords: (tabId: string, indices: number[]) => void;
  removePulledWords: (tabId: string, indices: number[]) => void;
  clearPulledWords: (tabId: string) => void;

  // Bulk operations
  loadWorkspace: (tabs: DocumentTab[], activeTabId: string | null) => void;
  clearAll: () => void;

  // PDF recovery
  restorePdfData: (tabId: string, pdfDataUrl: string, pdfNumPages: number) => void;
}

export const useDocumentStore = create<DocumentState>()(
  persist(
    (set, get) => ({
      tabs: [],
      activeTabId: null,

      addDocument: (doc) => {
        const existing = get().tabs.find((t) => t.id === doc.id);
        if (existing) {
          set({ activeTabId: doc.id });
          return;
        }
        const tab: DocumentTab = {
          id: doc.id,
          document: doc,
          scrollY: 0,
          highlights: [],
          annotations: [],
        };
        set((s) => ({
          tabs: [...s.tabs, tab],
          activeTabId: doc.id,
        }));
      },

      closeTab: (id) => {
        const { tabs, activeTabId } = get();
        const idx = tabs.findIndex((t) => t.id === id);
        if (idx === -1) return;

        const newTabs = tabs.filter((t) => t.id !== id);
        let newActiveId = activeTabId;

        if (activeTabId === id) {
          if (newTabs.length === 0) {
            newActiveId = null;
          } else if (idx >= newTabs.length) {
            newActiveId = newTabs[newTabs.length - 1].id;
          } else {
            newActiveId = newTabs[idx].id;
          }
        }

        set({ tabs: newTabs, activeTabId: newActiveId });
      },

      setActiveTab: (id) => set({ activeTabId: id }),

      getActiveTab: () => {
        const { tabs, activeTabId } = get();
        return tabs.find((t) => t.id === activeTabId) ?? null;
      },

      getActiveDocument: () => {
        const tab = get().getActiveTab();
        return tab?.document ?? null;
      },

      updateScrollY: (tabId, scrollY) =>
        set((s) => ({
          tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, scrollY } : t)),
        })),

      addHighlight: (tabId, highlight) =>
        set((s) => ({
          tabs: s.tabs.map((t) =>
            t.id === tabId ? { ...t, highlights: [...t.highlights, highlight] } : t
          ),
        })),

      removeHighlight: (tabId, highlightId) =>
        set((s) => ({
          tabs: s.tabs.map((t) =>
            t.id === tabId
              ? { ...t, highlights: t.highlights.filter((h) => h.id !== highlightId) }
              : t
          ),
        })),

      clearHighlights: (tabId) =>
        set((s) => ({
          tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, highlights: [] } : t)),
        })),

      addAnnotation: (tabId, annotation) =>
        set((s) => ({
          tabs: s.tabs.map((t) =>
            t.id === tabId ? { ...t, annotations: [...t.annotations, annotation] } : t
          ),
        })),

      removeAnnotation: (tabId, annotationId) =>
        set((s) => ({
          tabs: s.tabs.map((t) =>
            t.id === tabId
              ? { ...t, annotations: t.annotations.filter((a) => a.id !== annotationId) }
              : t
          ),
        })),

      updateAnnotation: (tabId, annotationId, patch) =>
        set((s) => ({
          tabs: s.tabs.map((t) =>
            t.id === tabId
              ? {
                  ...t,
                  annotations: t.annotations.map((a) =>
                    a.id === annotationId ? { ...a, ...patch } : a
                  ),
                }
              : t
          ),
        })),

      reorderAnnotations: (tabId, fromIndex, toIndex) =>
        set((s) => ({
          tabs: s.tabs.map((t) =>
            t.id === tabId
              ? {
                  ...t,
                  annotations: arrayMove(t.annotations, fromIndex, toIndex),
                }
              : t
          ),
        })),

      addPulledWords: (tabId, indices) =>
        set((s) => ({
          tabs: s.tabs.map((t) =>
            t.id === tabId
              ? {
                  ...t,
                  pulledIndices: [...new Set([...(t.pulledIndices ?? []), ...indices])],
                }
              : t
          ),
        })),

      removePulledWords: (tabId, indices) =>
        set((s) => ({
          tabs: s.tabs.map((t) =>
            t.id === tabId
              ? {
                  ...t,
                  pulledIndices: t.pulledIndices?.filter((i) => !indices.includes(i)),
                }
              : t
          ),
        })),

      clearPulledWords: (tabId) =>
        set((s) => ({
          tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, pulledIndices: [] } : t)),
        })),

      loadWorkspace: (tabs, activeTabId) => set({ tabs, activeTabId }),

      clearAll: () => set({ tabs: [], activeTabId: null }),

      restorePdfData: (tabId, pdfDataUrl, pdfNumPages) =>
        set((s) => ({
          tabs: s.tabs.map((t) =>
            t.id === tabId
              ? {
                  ...t,
                  document: {
                    ...t.document,
                    pdfDataUrl,
                    pdfNumPages,
                  },
                }
              : t
          ),
        })),
    }),
    {
      name: 'strings-attached-documents',
      partialize: (state) => ({
        tabs: state.tabs.map((t) => ({
          ...t,
          document: {
            ...t.document,
            // Don't persist large PDF data URLs in localStorage
            pdfDataUrl: undefined,
          },
        })),
        activeTabId: state.activeTabId,
      }),
    }
  )
);

function arrayMove<T>(arr: T[], fromIndex: number, toIndex: number) {
  const newArray = [...arr];
  const [element] = newArray.splice(fromIndex, 1);
  newArray.splice(toIndex, 0, element);
  return newArray;
}