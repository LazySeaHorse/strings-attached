import type { DocumentTab } from '../stores/types';
import type { Node, Edge } from '@xyflow/react';
import type { CanvasData } from '../stores/canvasStore';

const FILE_VERSION = 2;
const FILE_EXTENSION = '.strings';
const FILE_MIME = 'application/json';

export interface StringsFile {
  version: number;
  app: string;
  savedAt: string;
  documents: DocumentTab[];
  activeTabId: string | null;
  /** v2: per-document canvas state */
  canvasMap: Record<string, CanvasData>;
  /** v1 legacy: single flat canvas (read-only for migration) */
  canvas?: {
    nodes: Node[];
    edges: Edge[];
  };
}

/** Serialize workspace state into a downloadable .strings file */
function serializeWorkspace(
  tabs: DocumentTab[],
  activeTabId: string | null,
  canvasMap: Record<string, CanvasData>,
): string {
  const file: StringsFile = {
    version: FILE_VERSION,
    app: 'Strings Attached',
    savedAt: new Date().toISOString(),
    documents: tabs,
    activeTabId,
    canvasMap,
  };
  return JSON.stringify(file, null, 2);
}

/** Download a .strings file to the user's machine */
export function downloadStringsFile(
  tabs: DocumentTab[],
  activeTabId: string | null,
  canvasMap: Record<string, CanvasData>,
  filename?: string,
) {
  const json = serializeWorkspace(tabs, activeTabId, canvasMap);
  const blob = new Blob([json], { type: FILE_MIME });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = (filename || 'workspace') + FILE_EXTENSION;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Parse and validate a .strings file (handles v1 → v2 migration) */
export function parseStringsFile(json: string): StringsFile {
  const parsed = JSON.parse(json);

  if (!parsed.version || parsed.app !== 'Strings Attached') {
    throw new Error('Invalid .strings file format');
  }
  if (parsed.version > FILE_VERSION) {
    throw new Error(`Unsupported file version: ${parsed.version}`);
  }

  // Migrate v1 → v2: convert flat canvas to per-document canvasMap
  if (!parsed.canvasMap && parsed.canvas) {
    const canvasMap: Record<string, CanvasData> = {};
    // Try to associate old flat canvas with the active document
    if (parsed.activeTabId) {
      canvasMap[parsed.activeTabId] = {
        nodes: parsed.canvas.nodes ?? [],
        edges: parsed.canvas.edges ?? [],
      };
    }
    parsed.canvasMap = canvasMap;
  }

  if (!parsed.canvasMap) {
    parsed.canvasMap = {};
  }

  return parsed as StringsFile;
}

/** Check if a filename is a .strings file */
export function isStringsFile(filename: string): boolean {
  return filename.toLowerCase().endsWith(FILE_EXTENSION);
}