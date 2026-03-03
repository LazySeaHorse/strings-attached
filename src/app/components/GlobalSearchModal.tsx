import React, { useRef, useEffect, useCallback } from 'react';
import { Search, X, FileText, GitBranchPlus, MessageSquare, ArrowRight } from 'lucide-react';
import { useGlobalSearch, type SearchResult } from './hooks/useGlobalSearch';
import { useAppStore, useDocumentStore } from './stores';

export function GlobalSearchModal() {
  const open = useAppStore((s) => s.searchOpen);
  const setSearchOpen = useAppStore((s) => s.setSearchOpen);
  const onClose = React.useCallback(() => setSearchOpen(false), [setSearchOpen]);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const { query, setQuery, grouped, totalResults, clear } = useGlobalSearch();
  const [selectedIdx, setSelectedIdx] = React.useState(0);

  // Flatten results for keyboard nav
  const flatResults = React.useMemo(() => {
    return [...grouped.document, ...grouped.node, ...grouped.annotation];
  }, [grouped]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIdx(0);
  }, [flatResults.length, query]);

  // Focus input on open
  useEffect(() => {
    if (open) {
      // Small delay to ensure the modal is rendered
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      clear();
    }
  }, [open, clear]);

  const handleNavigate = useCallback((result: SearchResult) => {
    const { docId, type, nodeId, annotationId, charOffset } = result;

    // Switch to the correct document tab
    const docStore = useDocumentStore.getState();
    if (docStore.activeTabId !== docId) {
      docStore.setActiveTab(docId);
    }

    if (type === 'document') {
      // Switch to classic mode and trigger in-document search
      useAppStore.getState().setMode('classic');
      // Use jumpToWordIndex won't work for char offset, so we dispatch
      // a custom event that ClassicView can listen for
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('globalSearchNavigate', {
          detail: { type: 'document', charOffset, query },
        }));
      }, 50);
    } else if (type === 'node' && nodeId) {
      // Switch to canvas mode and zoom to node
      useAppStore.getState().setMode('canvas');
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('globalSearchNavigate', {
          detail: { type: 'node', nodeId },
        }));
      }, 100);
    } else if (type === 'annotation' && annotationId) {
      // Switch to classic mode with annotate tool, open sidebar
      useAppStore.getState().setMode('classic');
      useAppStore.getState().setActiveTool('annotate');
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('globalSearchNavigate', {
          detail: { type: 'annotation', annotationId },
        }));
      }, 50);
    }

    onClose();
  }, [onClose, query]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, flatResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && flatResults[selectedIdx]) {
      e.preventDefault();
      handleNavigate(flatResults[selectedIdx]);
    }
  }, [flatResults, selectedIdx, handleNavigate, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector(`[data-idx="${selectedIdx}"]`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [selectedIdx]);

  if (!open) return null;

  const hasQuery = query.length >= 2;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.15)',
          zIndex: 100,
          backdropFilter: 'blur(2px)',
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: 'fixed',
          top: '15%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: 560,
          zIndex: 101,
          background: '#ffffff',
          borderRadius: 14,
          boxShadow: '0 16px 70px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.04)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '60vh',
        }}
      >
        {/* Search input */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '14px 16px',
            borderBottom: hasQuery && totalResults > 0 ? '1px solid #f0f0f0' : 'none',
          }}
        >
          <Search size={16} color="#a3a3a3" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search documents, nodes, annotations..."
            style={{
              flex: 1,
              fontSize: '0.9375rem',
              color: '#171717',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              padding: 0,
            }}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="cursor-pointer flex items-center justify-center"
              style={{
                width: 20,
                height: 20,
                borderRadius: 5,
                border: 'none',
                background: '#f5f5f5',
                color: '#a3a3a3',
                flexShrink: 0,
              }}
            >
              <X size={12} />
            </button>
          )}
          <kbd
            style={{
              fontSize: '0.6875rem',
              color: '#a3a3a3',
              background: '#f5f5f5',
              padding: '2px 6px',
              borderRadius: 4,
              fontFamily: 'inherit',
              flexShrink: 0,
            }}
          >
            ESC
          </kbd>
        </div>

        {/* Results */}
        {hasQuery && (
          <div
            ref={listRef}
            style={{
              overflowY: 'auto',
              padding: '4px 0',
            }}
          >
            {totalResults === 0 && (
              <div style={{ padding: '24px 16px', textAlign: 'center' }}>
                <p style={{ fontSize: '0.8125rem', color: '#a3a3a3' }}>
                  No results for "{query}"
                </p>
              </div>
            )}

            {grouped.document.length > 0 && (
              <ResultGroup
                label="Documents"
                icon={<FileText size={12} />}
                results={grouped.document}
                startIdx={0}
                selectedIdx={selectedIdx}
                onSelect={handleNavigate}
                onHover={setSelectedIdx}
                query={query}
              />
            )}

            {grouped.node.length > 0 && (
              <ResultGroup
                label="Canvas Nodes"
                icon={<GitBranchPlus size={12} />}
                results={grouped.node}
                startIdx={grouped.document.length}
                selectedIdx={selectedIdx}
                onSelect={handleNavigate}
                onHover={setSelectedIdx}
                query={query}
              />
            )}

            {grouped.annotation.length > 0 && (
              <ResultGroup
                label="Annotations"
                icon={<MessageSquare size={12} />}
                results={grouped.annotation}
                startIdx={grouped.document.length + grouped.node.length}
                selectedIdx={selectedIdx}
                onSelect={handleNavigate}
                onHover={setSelectedIdx}
                query={query}
              />
            )}
          </div>
        )}

        {/* Hint footer */}
        {hasQuery && totalResults > 0 && (
          <div
            style={{
              padding: '8px 16px',
              borderTop: '1px solid #f0f0f0',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: '0.6875rem', color: '#c4c4c4' }}>
              <kbd style={{ padding: '1px 4px', background: '#f5f5f5', borderRadius: 3, fontFamily: 'inherit' }}>
                ↑↓
              </kbd>
              {' '}navigate
            </span>
            <span style={{ fontSize: '0.6875rem', color: '#c4c4c4' }}>
              <kbd style={{ padding: '1px 4px', background: '#f5f5f5', borderRadius: 3, fontFamily: 'inherit' }}>
                ↵
              </kbd>
              {' '}open
            </span>
            <span style={{ fontSize: '0.6875rem', color: '#c4c4c4', marginLeft: 'auto' }}>
              {totalResults} result{totalResults !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Result Group ──────────────────────────────────────────────────

interface ResultGroupProps {
  label: string;
  icon: React.ReactNode;
  results: SearchResult[];
  startIdx: number;
  selectedIdx: number;
  onSelect: (r: SearchResult) => void;
  onHover: (idx: number) => void;
  query: string;
}

function ResultGroup({ label, icon, results, startIdx, selectedIdx, onSelect, onHover, query }: ResultGroupProps) {
  return (
    <div>
      {/* Group header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 16px 4px',
          color: '#a3a3a3',
        }}
      >
        {icon}
        <span style={{ fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {label}
        </span>
        <span style={{ fontSize: '0.625rem', color: '#c4c4c4' }}>
          ({results.length})
        </span>
      </div>

      {/* Items */}
      {results.map((result, i) => {
        const globalIdx = startIdx + i;
        const isSelected = globalIdx === selectedIdx;

        return (
          <button
            key={result.id}
            data-idx={globalIdx}
            onClick={() => onSelect(result)}
            onMouseEnter={() => onHover(globalIdx)}
            className="cursor-pointer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              width: '100%',
              padding: '8px 16px',
              background: isSelected ? '#f0f7ff' : 'transparent',
              border: 'none',
              textAlign: 'left',
              transition: 'background 60ms',
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Snippet with highlighted query */}
              <p
                style={{
                  fontSize: '0.8125rem',
                  color: '#404040',
                  lineHeight: 1.4,
                  margin: 0,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                <HighlightedSnippet text={result.snippet} query={query} />
              </p>

              {/* Meta line */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  marginTop: 2,
                }}
              >
                <span style={{ fontSize: '0.6875rem', color: '#c4c4c4' }}>
                  {result.docTitle}
                </span>
                {result.matchField && (
                  <>
                    <span style={{ fontSize: '0.6875rem', color: '#d4d4d4' }}>·</span>
                    <span style={{ fontSize: '0.6875rem', color: '#c4c4c4' }}>
                      {result.matchField}
                    </span>
                  </>
                )}
              </div>
            </div>

            {isSelected && (
              <ArrowRight size={13} color="#3b82f6" style={{ flexShrink: 0 }} />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Highlighted snippet ───────────────────────────────────────────

function HighlightedSnippet({ text, query }: { text: string; query: string }) {
  if (!query || query.length < 2) return <>{text}</>;

  const parts: React.ReactNode[] = [];
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  let lastEnd = 0;

  let searchFrom = 0;
  while (true) {
    const idx = lowerText.indexOf(lowerQuery, searchFrom);
    if (idx === -1) break;

    // Text before match
    if (idx > lastEnd) {
      parts.push(<span key={`t${lastEnd}`}>{text.slice(lastEnd, idx)}</span>);
    }

    // The match
    parts.push(
      <mark
        key={`m${idx}`}
        style={{
          background: 'rgba(59, 130, 246, 0.15)',
          color: '#1d4ed8',
          borderRadius: 2,
          padding: '0 1px',
        }}
      >
        {text.slice(idx, idx + query.length)}
      </mark>
    );

    lastEnd = idx + query.length;
    searchFrom = idx + 1;
  }

  // Remaining text
  if (lastEnd < text.length) {
    parts.push(<span key={`t${lastEnd}`}>{text.slice(lastEnd)}</span>);
  }

  return <>{parts}</>;
}