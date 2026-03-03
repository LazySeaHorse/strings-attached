import { useMemo, useState, useCallback } from 'react';
import { useDocumentStore, useCanvasStore } from '../stores';
import type { ExplanationNodeData } from '../stores/types';

export type SearchResultType = 'document' | 'node' | 'annotation';

export interface SearchResult {
  id: string;
  type: SearchResultType;
  /** Which document tab this result belongs to */
  docId: string;
  docTitle: string;
  /** The matched text (with context) */
  snippet: string;
  /** For node results: the node ID to zoom to */
  nodeId?: string;
  /** For annotation results: the annotation ID */
  annotationId?: string;
  /** For document results: character offset of match start */
  charOffset?: number;
  /** Label for the result sub-type (e.g. "Source text", "Notes") */
  matchField?: string;
}

const SNIPPET_RADIUS = 40; // chars of context on each side

function extractSnippet(text: string, matchStart: number, queryLen: number): string {
  const start = Math.max(0, matchStart - SNIPPET_RADIUS);
  const end = Math.min(text.length, matchStart + queryLen + SNIPPET_RADIUS);
  let snippet = text.slice(start, end);
  if (start > 0) snippet = '...' + snippet;
  if (end < text.length) snippet = snippet + '...';
  return snippet;
}

export function useGlobalSearch() {
  const [query, setQuery] = useState('');
  const tabs = useDocumentStore((s) => s.tabs);
  const canvasMap = useCanvasStore((s) => s.canvasMap);

  const results = useMemo<SearchResult[]>(() => {
    if (!query || query.length < 2) return [];

    const lowerQuery = query.toLowerCase();
    const out: SearchResult[] = [];
    const MAX_PER_CATEGORY = 20;

    for (const tab of tabs) {
      const docTitle = tab.document.title || 'Untitled';
      const docId = tab.id;
      let docHits = 0;

      // 1) Document text
      if (tab.document.type === 'markdown') {
        const content = tab.document.content;
        const lowerContent = content.toLowerCase();
        let searchFrom = 0;
        while (docHits < MAX_PER_CATEGORY) {
          const idx = lowerContent.indexOf(lowerQuery, searchFrom);
          if (idx === -1) break;
          out.push({
            id: `doc-${docId}-${idx}`,
            type: 'document',
            docId,
            docTitle,
            snippet: extractSnippet(content, idx, query.length),
            charOffset: idx,
          });
          searchFrom = idx + 1;
          docHits++;
        }
      }

      // 2) Canvas nodes (source text + notes)
      const canvas = canvasMap[docId];
      if (canvas) {
        for (const node of canvas.nodes) {
          if (node.type !== 'explanation') continue;
          const data = node.data as ExplanationNodeData;

          // Source text
          const src = (data.sourceText || '').toLowerCase();
          const srcIdx = src.indexOf(lowerQuery);
          if (srcIdx !== -1) {
            out.push({
              id: `node-src-${node.id}`,
              type: 'node',
              docId,
              docTitle,
              snippet: extractSnippet(data.sourceText || '', srcIdx, query.length),
              nodeId: node.id,
              matchField: 'Source text',
            });
          }

          // Notes
          const notes = (data.notes || '').toLowerCase();
          const notesIdx = notes.indexOf(lowerQuery);
          if (notesIdx !== -1) {
            out.push({
              id: `node-notes-${node.id}`,
              type: 'node',
              docId,
              docTitle,
              snippet: extractSnippet(data.notes || '', notesIdx, query.length),
              nodeId: node.id,
              matchField: 'Notes',
            });
          }

          // LaTeX notes
          const latex = (data.notesLatex || '').toLowerCase();
          const latexIdx = latex.indexOf(lowerQuery);
          if (latexIdx !== -1 && notesIdx === -1) {
            out.push({
              id: `node-latex-${node.id}`,
              type: 'node',
              docId,
              docTitle,
              snippet: extractSnippet(data.notesLatex || '', latexIdx, query.length),
              nodeId: node.id,
              matchField: 'LaTeX notes',
            });
          }
        }
      }

      // 3) Annotations
      for (const ann of tab.annotations) {
        const text = (ann.text || '').toLowerCase();
        const textIdx = text.indexOf(lowerQuery);
        if (textIdx !== -1) {
          out.push({
            id: `ann-${ann.id}`,
            type: 'annotation',
            docId,
            docTitle,
            snippet: extractSnippet(ann.text || '', textIdx, query.length),
            annotationId: ann.id,
          });
          continue;
        }
        const latex = (ann.latex || '').toLowerCase();
        const latexIdx = latex.indexOf(lowerQuery);
        if (latexIdx !== -1) {
          out.push({
            id: `ann-latex-${ann.id}`,
            type: 'annotation',
            docId,
            docTitle,
            snippet: extractSnippet(ann.latex || '', latexIdx, query.length),
            annotationId: ann.id,
          });
        }
      }
    }

    return out;
  }, [query, tabs, canvasMap]);

  const clear = useCallback(() => setQuery(''), []);

  // Group results by type
  const grouped = useMemo(() => {
    const doc = results.filter((r) => r.type === 'document');
    const node = results.filter((r) => r.type === 'node');
    const ann = results.filter((r) => r.type === 'annotation');
    return { document: doc, node, annotation: ann };
  }, [results]);

  return {
    query,
    setQuery,
    results,
    grouped,
    totalResults: results.length,
    clear,
  };
}
