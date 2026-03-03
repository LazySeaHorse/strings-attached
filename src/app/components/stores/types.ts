import type { Node, Edge } from '@xyflow/react';

// ─── Document Types ──────────────────────────────────────────────
export interface DocumentData {
  id: string;
  type: 'markdown' | 'pdf';
  content: string;
  title?: string;
  pdfDataUrl?: string;
  pdfNumPages?: number;
}

export interface Highlight {
  id: string;
  /** Exact word indices that were painted — no gap-filling */
  indices: number[];
  color: string;
  text: string;
}

export interface Annotation {
  id: string;
  scrollY: number;
  text: string;
  createdAt: number;
  /** Which sub-mode the note is in */
  notesMode?: 'markdown' | 'math';
  /** MathLive LaTeX content */
  latex?: string;
  /** Optional color tag for visual grouping */
  color?: string;
}

export interface DocumentTab {
  id: string;
  document: DocumentData;
  scrollY: number;
  highlights: Highlight[];
  annotations: Annotation[];
  /** Word indices that have been pulled out to create explanation nodes */
  pulledIndices?: number[];
}

// ─── Canvas Types ────────────────────────────────────────────────
export type NodeTabKey = 'definition' | 'explain' | 'ask' | 'notes';

export interface ExplanationNodeData {
  sourceText: string;
  sourceType: 'word' | 'sentence';
  sourceNodeId: string;
  createdAt: number;
  /** The document ID this node belongs to (for reliable store lookups) */
  docId: string;
  /** Word indices this node was created from (for glow cleanup on deletion) */
  sourceWordIndices?: number[];
  /** Which tab is currently active in this node (drives highlight & edge color) */
  activeNodeTab?: NodeTabKey;
  /** User notes (markdown text) */
  notes?: string;
  /** Which sub-mode the notes tab is in */
  notesMode?: 'markdown' | 'math';
  /** MathLive LaTeX content */
  notesLatex?: string;
}

/** Map NodeTabKey → accent color */
export const NODE_TAB_COLORS: Record<NodeTabKey, string> = {
  definition: '#3b82f6', // blue
  explain: '#3b82f6',    // blue
  ask: '#3b82f6',        // blue
  notes: '#10b981',      // emerald
};

// ─── Tool Types ──────────────────────────────────────────────────
export type ToolType = 'select' | 'pan' | 'highlight' | 'annotate';
export type HighlightColor = '#fef08a' | '#bbf7d0' | '#bfdbfe' | '#fecaca' | '#e9d5ff';

export const HIGHLIGHT_COLORS: HighlightColor[] = [
  '#fef08a', // yellow
  '#bbf7d0', // green
  '#bfdbfe', // blue
  '#fecaca', // red
  '#e9d5ff', // purple
];