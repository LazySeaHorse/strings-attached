import { create } from 'zustand';
import type { ToolType, HighlightColor } from './types';

/** Data for a deferred pull (rectangle / sentence selection that needs canvas to mount first) */
export interface PendingPull {
  sourceNodeId: string;
  sourceText: string;
  sourceType: 'word' | 'sentence';
  sourceWordIndices: number[];
  /** Screen-space position where the pull ended (mouseup location) */
  screenPosition: { x: number; y: number };
  /** Which mode the user was in when the pull originated */
  fromMode: 'classic' | 'canvas';
}

interface AppState {
  // View mode
  mode: 'classic' | 'canvas';
  setMode: (mode: 'classic' | 'canvas') => void;

  // Active tool
  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;

  // Highlight color
  highlightColor: HighlightColor;
  setHighlightColor: (color: HighlightColor) => void;

  // Zoom (for classic view, 1 = 100%)
  zoom: number;
  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;

  // Search
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;

  // Pending pull (deferred node creation — set by rectangle/sentence selection,
  // consumed by InfiniteCanvas after it mounts)
  pendingPull: PendingPull | null;
  setPendingPull: (pull: PendingPull | null) => void;

  // Modals
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  shortcutsOpen: boolean;
  setShortcutsOpen: (open: boolean) => void;

  // Jump to source (consumed by ClassicView to scroll to a word index)
  jumpToWordIndex: number | null;
  setJumpToWordIndex: (index: number | null) => void;
}

const ZOOM_STEP = 0.1;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.0;

export const useAppStore = create<AppState>((set) => ({
  mode: 'classic',
  setMode: (mode) => set({ mode }),

  activeTool: 'select',
  setActiveTool: (tool) => set({ activeTool: tool }),

  highlightColor: '#fef08a',
  setHighlightColor: (color) => set({ highlightColor: color }),

  zoom: 1,
  setZoom: (zoom) => set({ zoom: Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom)) }),
  zoomIn: () => set((s) => ({ zoom: Math.min(ZOOM_MAX, s.zoom + ZOOM_STEP) })),
  zoomOut: () => set((s) => ({ zoom: Math.max(ZOOM_MIN, s.zoom - ZOOM_STEP) })),
  resetZoom: () => set({ zoom: 1 }),

  searchOpen: false,
  setSearchOpen: (open) => set({ searchOpen: open }),

  pendingPull: null,
  setPendingPull: (pull) => set({ pendingPull: pull }),

  settingsOpen: false,
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  shortcutsOpen: false,
  setShortcutsOpen: (open) => set({ shortcutsOpen: open }),

  jumpToWordIndex: null,
  setJumpToWordIndex: (index) => set({ jumpToWordIndex: index }),
}));