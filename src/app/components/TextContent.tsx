import React, { useCallback, useRef, useMemo, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import { useAppStore, useDocumentStore, useCanvasStore, type Highlight, type ExplanationNodeData, NODE_TAB_COLORS, type NodeTabKey } from './stores';
import { useRectangleSelection, type RectangleSelectionResult } from './useRectangleSelection';
import { setupStretchDrag } from './utils/stretchDrag';

// Stable empty arrays
const EMPTY_HIGHLIGHTS: Highlight[] = [];
const EMPTY_PULLED: number[] = [];

interface TextContentProps {
  content: string;
  nodeId: string;
  onDragStart?: () => void;
  searchQuery?: string;
  searchMatchIdx?: number;
  disablePulledGlow?: boolean;
  /** Called in annotate mode when the user clicks a word, sentence, or rectangle-selects text */
  onAnnotate?: (data: { text: string; wordIndices: number[]; sourceType: 'word' | 'sentence' }) => void;
}

// ─── Word Wrapping ───────────────────────────────────────────────
function wrapWordsInChildren(
  children: React.ReactNode,
  counter: { current: number },
  hlMap: Map<number, Highlight>,
  keyPrefix = '',
): React.ReactNode {
  return React.Children.map(children, (child, ci) => {
    if (typeof child === 'string') {
      const tokens = child.split(/(\s+)/);
      return tokens.map((token, ti) => {
        if (/^\s+$/.test(token)) return <span key={`${keyPrefix}s${ci}-${ti}`}>{token}</span>;
        if (token === '') return null;
        const idx = counter.current++;
        const hl = hlMap.get(idx);
        return (
          <span
            key={`${keyPrefix}w${ci}-${ti}`}
            className="word"
            data-word={token}
            data-word-index={idx}
            data-hl-color={hl ? hl.color : undefined}
            style={{
              cursor: 'grab',
              padding: '1px 2px',
              borderRadius: 4,
              transition: 'background 120ms ease, opacity 120ms ease',
              background: hl ? hl.color : undefined,
            }}
          >
            {token}
          </span>
        );
      });
    }

    if (React.isValidElement(child)) {
      const props = child.props as Record<string, any>;
      const className: string = props.className || '';

      if (
        className.includes('katex') ||
        className.includes('math') ||
        child.type === 'code' ||
        child.type === 'svg' ||
        child.type === 'img'
      ) {
        // Wrap math/katex elements in a .word span so rectangle selection can find them.
        // textContent of the rendered KaTeX serves as the readable text fallback.
        if (className.includes('katex') || className.includes('math')) {
          const idx = counter.current++;
          const hl = hlMap.get(idx);
          return (
            <span
              key={`${keyPrefix}math${ci}`}
              className="word"
              data-word-index={idx}
              data-hl-color={hl ? hl.color : undefined}
              style={{
                cursor: 'grab',
                padding: '1px 2px',
                borderRadius: 4,
                transition: 'background 120ms ease, opacity 120ms ease',
                background: hl ? hl.color : undefined,
                display: 'inline',
              }}
            >
              {child}
            </span>
          );
        }
        return child;
      }

      if (props.children != null) {
        return React.cloneElement(
          child as React.ReactElement<any>,
          { key: `${keyPrefix}e${ci}` },
          wrapWordsInChildren(props.children, counter, hlMap, `${keyPrefix}${ci}-`),
        );
      }
    }

    return child;
  });
}

// ─── Build highlight lookup map ──────────────────────────────────
function buildHighlightMap(highlights: Highlight[]): Map<number, Highlight> {
  const map = new Map<number, Highlight>();
  for (const h of highlights) {
    if (h.indices) {
      for (const idx of h.indices) {
        map.set(idx, h);
      }
    } else {
      const legacy = h as any;
      if (typeof legacy.startIdx === 'number' && typeof legacy.endIdx === 'number') {
        for (let i = legacy.startIdx; i <= legacy.endIdx; i++) {
          map.set(i, h);
        }
      }
    }
  }
  return map;
}

// ─── Sentence helpers ────────────────────────────────────────────

/** Walk up from `el` to find the nearest `.sentence` ancestor within `root` */
function findSentenceAncestor(el: HTMLElement, root: HTMLElement): HTMLElement | null {
  let cur: HTMLElement | null = el;
  while (cur && cur !== root) {
    if (cur.classList.contains('sentence')) return cur;
    cur = cur.parentElement;
  }
  return null;
}

/** Walk up from `el` to find the nearest `.word` ancestor within `root` (for KaTeX clicks) */
function findWordAncestor(el: HTMLElement, root: HTMLElement): HTMLElement | null {
  let cur: HTMLElement | null = el;
  while (cur && cur !== root) {
    if (cur.classList.contains('word')) return cur;
    cur = cur.parentElement;
  }
  return null;
}

/** Collect all .word elements inside a sentence block, returning text and indices */
function collectSentenceWords(sentenceEl: HTMLElement): { text: string; wordIndices: number[] } {
  const wordEls = sentenceEl.querySelectorAll<HTMLElement>('.word');
  const words: { text: string; idx: number }[] = [];
  wordEls.forEach((w) => {
    const idx = parseInt(w.getAttribute('data-word-index') || '-1', 10);
    const text = w.dataset.word || w.textContent || '';
    if (idx >= 0 && text) words.push({ text, idx });
  });
  words.sort((a, b) => a.idx - b.idx);
  return {
    text: words.map((w) => w.text).join(' '),
    wordIndices: words.map((w) => w.idx),
  };
}

// ─── Markdown Components ─────────────────────────────────────────
function createMarkdownComponents(counter: { current: number }, hlMap: Map<number, Highlight>) {
  const wrapBlock = (Tag: string, extraStyle?: React.CSSProperties) => {
    const Component = ({ children, ...rest }: any) => {
      const { node, ...domProps } = rest;
      return React.createElement(
        Tag,
        {
          ...domProps,
          className: `sentence ${domProps.className || ''}`.trim(),
          style: {
            ...extraStyle,
            cursor: 'grab',
            borderRadius: 4,
            transition: 'background 150ms ease',
          },
        },
        wrapWordsInChildren(children, counter, hlMap),
      );
    };
    Component.displayName = `Md${Tag}`;
    return Component;
  };

  const wrapInline = (Tag: string, extraStyle?: React.CSSProperties) => {
    const Component = ({ children, ...rest }: any) => {
      const { node, ...domProps } = rest;
      return React.createElement(
        Tag,
        { ...domProps, style: extraStyle },
        wrapWordsInChildren(children, counter, hlMap),
      );
    };
    Component.displayName = `Md${Tag}`;
    return Component;
  };

  return {
    p: wrapBlock('p', { marginBottom: 14 }),
    h1: wrapBlock('h1', { fontSize: '1.5rem', fontWeight: 700, marginBottom: 16, marginTop: 28, color: '#171717' }),
    h2: wrapBlock('h2', { fontSize: '1.25rem', fontWeight: 600, marginBottom: 12, marginTop: 24, color: '#171717' }),
    h3: wrapBlock('h3', { fontSize: '1.1rem', fontWeight: 600, marginBottom: 8, marginTop: 20, color: '#171717' }),
    h4: wrapBlock('h4', { fontSize: '1rem', fontWeight: 600, marginBottom: 8, marginTop: 16, color: '#171717' }),
    h5: wrapBlock('h5', { fontSize: '0.875rem', fontWeight: 600, marginBottom: 6, marginTop: 12, color: '#171717' }),
    h6: wrapBlock('h6', { fontSize: '0.8125rem', fontWeight: 600, marginBottom: 4, marginTop: 10, color: '#737373' }),
    li: wrapBlock('li', { marginBottom: 6 }),
    td: wrapInline('td', {
      padding: '8px 14px',
      borderBottom: '1px solid #f0f0f0',
    }),
    th: wrapInline('th', {
      padding: '8px 14px',
      borderBottom: '2px solid #e5e5e5',
      fontWeight: 600,
      textAlign: 'left' as const,
    }),
    strong: wrapInline('strong', { fontWeight: 600 }),
    em: wrapInline('em', { fontStyle: 'italic' }),
    blockquote: ({ children, node, ...rest }: any) => (
      <blockquote
        {...rest}
        style={{
          borderLeft: '3px solid #e5e5e5',
          paddingLeft: 18,
          margin: '16px 0',
          color: '#525252',
        }}
      >
        {children}
      </blockquote>
    ),
    ul: ({ children, node, ...rest }: any) => (
      <ul {...rest} style={{ paddingLeft: 24, marginBottom: 14, listStyleType: 'disc' }}>
        {children}
      </ul>
    ),
    ol: ({ children, node, ...rest }: any) => (
      <ol {...rest} style={{ paddingLeft: 24, marginBottom: 14, listStyleType: 'decimal' }}>
        {children}
      </ol>
    ),
    code: ({ children, className, node, ...rest }: any) => {
      const isInline = !className;
      if (isInline) {
        return (
          <code
            {...rest}
            style={{
              background: '#f5f5f5',
              padding: '2px 6px',
              borderRadius: 5,
              fontSize: '0.85em',
              fontFamily: "'SF Mono', 'Fira Code', Consolas, monospace",
              color: '#c7254e',
            }}
          >
            {children}
          </code>
        );
      }
      return (
        <code
          {...rest}
          className={className}
          style={{ fontFamily: "'SF Mono', 'Fira Code', Consolas, monospace" }}
        >
          {children}
        </code>
      );
    },
    pre: ({ children, node, ...rest }: any) => (
      <pre
        {...rest}
        style={{
          background: '#1a1a1a',
          color: '#d4d4d4',
          padding: 18,
          borderRadius: 10,
          overflow: 'auto',
          fontSize: '0.85rem',
          marginBottom: 14,
          fontFamily: "'SF Mono', 'Fira Code', Consolas, monospace",
        }}
      >
        {children}
      </pre>
    ),
    table: ({ children, node, ...rest }: any) => (
      <div style={{ overflowX: 'auto', marginBottom: 14 }}>
        <table {...rest} style={{ width: '100%', borderCollapse: 'collapse' }}>
          {children}
        </table>
      </div>
    ),
    a: ({ children, href, node, ...rest }: any) => (
      <a
        {...rest}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: '#3b82f6', textDecoration: 'none' }}
        onMouseEnter={(e: React.MouseEvent) => {
          (e.target as HTMLElement).style.textDecoration = 'underline';
        }}
        onMouseLeave={(e: React.MouseEvent) => {
          (e.target as HTMLElement).style.textDecoration = 'none';
        }}
      >
        {wrapWordsInChildren(children, counter, hlMap)}
      </a>
    ),
    hr: ({ node, ...rest }: any) => (
      <hr {...rest} style={{ border: 'none', borderTop: '1px solid #f0f0f0', margin: '28px 0' }} />
    ),
    img: ({ node, ...rest }: any) => (
      <img {...rest} style={{ maxWidth: '100%', borderRadius: 10, marginBottom: 14 }} />
    ),
  };
}

// ─── TextContent Component ───────────────────────────────────────
export function TextContent({ content, nodeId, onDragStart, searchQuery, searchMatchIdx, disablePulledGlow, onAnnotate }: TextContentProps) {
  // Granular app-store selectors — subscribe only to the fields we actually read,
  // so unrelated store changes (zoom, searchOpen, pendingPull, etc.) don't re-render.
  const setMode = useAppStore((s) => s.setMode);
  const mode = useAppStore((s) => s.mode);
  const activeTool = useAppStore((s) => s.activeTool);
  const highlightColor = useAppStore((s) => s.highlightColor);
  const setPendingPull = useAppStore((s) => s.setPendingPull);
  const activeTabId = useDocumentStore((s) => s.activeTabId);

  // Granular selectors: subscribe only to the specific arrays we need,
  // not the whole tab object (which changes on every scrollY update).
  const highlights = useDocumentStore((s) => {
    const tab = s.tabs.find((t) => t.id === s.activeTabId);
    return tab?.highlights ?? EMPTY_HIGHLIGHTS;
  });
  const pulledIndices = useDocumentStore((s) => {
    const tab = s.tabs.find((t) => t.id === s.activeTabId);
    return tab?.pulledIndices ?? EMPTY_PULLED;
  });

  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Highlight mode refs
  const isHighlighting = useRef(false);
  const highlightedWords = useRef<Set<HTMLElement>>(new Set());

  // Track which sentence block is currently hover-highlighted
  const hoveredSentenceRef = useRef<HTMLElement | null>(null);

  // ─── Rectangle selection pull callback ─────────────────────────
  const handleRectanglePull = useCallback(
    (result: RectangleSelectionResult) => {
      if (activeTool !== 'select') return;
      const sourceType: 'word' | 'sentence' = result.wordIndices.length > 1 ? 'sentence' : 'word';

      // Defer node creation: set pendingPull, then switch to canvas.
      // InfiniteCanvas picks up pendingPull when it mounts.
      setPendingPull({
        sourceNodeId: nodeId,
        sourceText: result.text,
        sourceType,
        sourceWordIndices: result.wordIndices,
        screenPosition: result.position,
        fromMode: mode,
      });
      if (mode === 'classic') setMode('canvas');
    },
    [activeTool, nodeId, setPendingPull, setMode, mode],
  );

  const { handleWhitespaceMouseDown, isSelectingRef } = useRectangleSelection({
    wordSelector: '.word',
    onPull: handleRectanglePull,
  });

  // ─── Annotate-mode rectangle selection callback ────────────────
  const handleAnnotateRectPull = useCallback(
    (result: RectangleSelectionResult) => {
      const sourceType: 'word' | 'sentence' = result.wordIndices.length > 1 ? 'sentence' : 'word';
      onAnnotate?.({ text: result.text, wordIndices: result.wordIndices, sourceType });
    },
    [onAnnotate],
  );

  const { handleWhitespaceMouseDown: handleAnnotateRectMouseDown } = useRectangleSelection({
    wordSelector: '.word',
    onPull: handleAnnotateRectPull,
    accentColor: '#10b981',
  });

  // Build O(1) lookup map
  const highlightMap = useMemo(() => buildHighlightMap(highlights), [highlights]);

  // Pulled word indices (words dragged out to create strings)
  const pulledSet = useMemo(() => new Set(pulledIndices), [pulledIndices]);

  // Subscribe to canvas node tab changes (only the active tabs of explanation nodes)
  // so sentence highlight colors update reactively when the user switches tabs.
  const nodeTabsKey = useCanvasStore((s) => {
    if (!activeTabId) return '';
    const canvas = s.canvasMap[activeTabId];
    if (!canvas) return '';
    return canvas.nodes
      .filter((n) => n.type === 'explanation')
      .map((n) => `${n.id}:${(n.data as any)?.activeNodeTab ?? ''}`)
      .join(',');
  });

  // Build a map from word index → accent color (based on the explanation node's active tab)
  // We read canvas nodes to determine which color each pulled word should use.
  const pulledColorMap = useMemo(() => {
    const map = new Map<number, string>();
    if (pulledSet.size === 0 || !activeTabId) return map;
    const canvasData = useCanvasStore.getState().canvasMap[activeTabId];
    if (!canvasData) return map;
    for (const node of canvasData.nodes) {
      if (node.type !== 'explanation') continue;
      const nd = node.data as ExplanationNodeData;
      const color = NODE_TAB_COLORS[(nd.activeNodeTab as NodeTabKey) ?? 'explain'] ?? '#3b82f6';
      if (nd.sourceWordIndices) {
        for (const idx of nd.sourceWordIndices) {
          map.set(idx as number, color);
        }
      }
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pulledSet, activeTabId, nodeTabsKey]);

  // Build markdown components
  const wordCounter = useRef({ current: 0 });

  const markdownComponents = useMemo(
    () => createMarkdownComponents(wordCounter.current, highlightMap),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [highlightMap],
  );
  // wordCounter reset is now inside renderedMarkdown useMemo

  // ─── Search highlighting (DOM-based after render) ───────────
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const words = container.querySelectorAll<HTMLElement>('.word');

    if (!searchQuery || searchQuery.length < 2) {
      words.forEach((w) => {
        w.classList.remove('search-match', 'search-current');
        w.style.outline = '';
      });
      return;
    }

    const lowerQuery = searchQuery.toLowerCase();
    let matchCount = 0;

    words.forEach((w) => {
      const text = (w.dataset.word || w.textContent || '').toLowerCase();
      if (text.includes(lowerQuery)) {
        w.classList.add('search-match');
        w.style.outline = '2px solid rgba(251, 191, 36, 0.6)';
        if (matchCount === (searchMatchIdx ?? 0)) {
          w.classList.add('search-current');
          w.style.outline = '2px solid #f59e0b';
          w.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
        matchCount++;
      } else {
        w.classList.remove('search-match', 'search-current');
        w.style.outline = '';
      }
    });

    return () => {
      words.forEach((w) => {
        w.classList.remove('search-match', 'search-current');
        w.style.outline = '';
      });
    };
  }, [searchQuery, searchMatchIdx, content, highlightMap]);

  // ─── Pulled-word glow highlighting (DOM-based after render) ──
  // All pulled words get text-shadow glow regardless of source type (word or sentence).
  useEffect(() => {
    if (!containerRef.current || pulledSet.size === 0 || disablePulledGlow) return;
    const container = containerRef.current;
    const words = container.querySelectorAll<HTMLElement>('.word');
    const affectedWords: HTMLElement[] = [];

    words.forEach((w) => {
      const idx = parseInt(w.getAttribute('data-word-index') || '-1', 10);
      if (idx < 0 || !pulledSet.has(idx)) return;
      const color = pulledColorMap.get(idx) ?? '#3b82f6';

      w.classList.add('pulled-word');
      w.style.setProperty('--pulled-color', color);
      affectedWords.push(w);
    });

    return () => {
      affectedWords.forEach((w) => {
        w.classList.remove('pulled-word');
        w.style.removeProperty('--pulled-color');
      });
    };
  }, [pulledSet, pulledColorMap, content, highlightMap, disablePulledGlow]);

  // ─── Clear sentence hover highlight ──────────────────────────
  // Only styles the sentence block element itself — no per-word changes.
  const clearSentenceHover = useCallback(() => {
    if (hoveredSentenceRef.current) {
      hoveredSentenceRef.current.style.background = '';
      hoveredSentenceRef.current = null;
    }
  }, []);

  // ─── Right-click to remove a highlight ───────────────────────
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      // Resolve .word (may be inside KaTeX)
      const wordEl = target.classList.contains('word')
        ? target
        : containerRef.current ? findWordAncestor(target, containerRef.current) : null;
      if (!wordEl) return;
      const idx = parseInt(wordEl.getAttribute('data-word-index') || '-1', 10);
      if (idx < 0 || !activeTabId) return;

      const hl = highlights.find((h) =>
        h.indices ? h.indices.includes(idx) : (h as any).startIdx <= idx && idx <= (h as any).endIdx,
      );
      if (!hl) return;

      e.preventDefault();
      useDocumentStore.getState().removeHighlight(activeTabId, hl.id);
    },
    [activeTabId, highlights],
  );

  // ─── Mouse down handler ──────────────────────────────────────
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;

      // ─── Highlight mode ─────────────────────────────────
      if (activeTool === 'highlight') {
        // Resolve the actual .word element (may be the target itself, or an ancestor for KaTeX)
        const wordEl = target.classList.contains('word')
          ? target
          : containerRef.current ? findWordAncestor(target, containerRef.current) : null;
        if (wordEl) {
          e.stopPropagation();
          e.preventDefault();
          isHighlighting.current = true;
          highlightedWords.current = new Set();

          wordEl.style.background = highlightColor;
          highlightedWords.current.add(wordEl);

          const handleMouseMove = (moveEvent: MouseEvent) => {
            let el = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY) as HTMLElement | null;
            // Walk up for KaTeX inner spans
            if (el && !el.classList.contains('word') && containerRef.current) {
              el = findWordAncestor(el, containerRef.current);
            }
            if (el?.classList.contains('word') && !highlightedWords.current.has(el)) {
              el.style.background = highlightColor;
              highlightedWords.current.add(el);
            }
          };

          const handleMouseUp = () => {
            isHighlighting.current = false;
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);

            if (highlightedWords.current.size > 0 && activeTabId) {
              const words = [...highlightedWords.current];
              const indices = words
                .map((w) => parseInt(w.getAttribute('data-word-index') || '-1', 10))
                .filter((i) => i >= 0)
                .sort((a, b) => a - b);

              if (indices.length > 0) {
                const text = words
                  .sort((a, b) => {
                    const ai = parseInt(a.getAttribute('data-word-index') || '0', 10);
                    const bi = parseInt(b.getAttribute('data-word-index') || '0', 10);
                    return ai - bi;
                  })
                  .map((w) => w.dataset.word || w.textContent || '')
                  .join(' ');

                useDocumentStore.getState().addHighlight(activeTabId, {
                  id: `hl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                  indices,
                  color: highlightColor,
                  text,
                });
              }
            }
            highlightedWords.current = new Set();
          };

          window.addEventListener('mousemove', handleMouseMove);
          window.addEventListener('mouseup', handleMouseUp);
          return;
        }
        return;
      }

      // ─── Annotate mode ──────────────────────────────────
      if (activeTool === 'annotate') {
        // Zone 1: Word click → annotate single word
        const wordEl = target.classList.contains('word')
          ? target
          : containerRef.current ? findWordAncestor(target, containerRef.current) : null;

        if (wordEl) {
          clearSentenceHover();
          const text = wordEl.dataset.word || wordEl.textContent || '';
          const wordIndices = [parseInt(wordEl.getAttribute('data-word-index') || '-1', 10)].filter((i) => i >= 0);
          if (text && wordIndices.length > 0) {
            // Brief flash to confirm the click
            wordEl.style.background = 'rgba(16, 185, 129, 0.15)';
            setTimeout(() => {
              const idx = parseInt(wordEl.getAttribute('data-word-index') || '-1', 10);
              const hl = highlightMap.get(idx);
              wordEl.style.background = hl ? hl.color : '';
            }, 300);
            onAnnotate?.({ text, wordIndices, sourceType: 'word' });
          }
          return;
        }

        // Zone 2: Click sentence whitespace → annotate whole sentence
        if (containerRef.current) {
          const sentenceEl = findSentenceAncestor(target, containerRef.current);
          if (sentenceEl) {
            clearSentenceHover();
            const { text: sentenceText, wordIndices } = collectSentenceWords(sentenceEl);
            if (sentenceText && wordIndices.length > 0) {
              // Brief flash
              sentenceEl.style.background = 'rgba(16, 185, 129, 0.1)';
              setTimeout(() => { sentenceEl.style.background = ''; }, 300);
              onAnnotate?.({ text: sentenceText, wordIndices, sourceType: 'sentence' });
            }
            return;
          }

          // Zone 3: Empty whitespace → rectangle selection for annotate
          clearSentenceHover();
          handleAnnotateRectMouseDown(e, containerRef.current);
        }
        return;
      }

      // ─── Select mode (default: drag to create strings) ──

      // Zone 1: Word click → single word drag
      if (target.classList.contains('word')) {
        clearSentenceHover();

        const text = target.dataset.word || target.textContent || '';
        const wordIndices = [parseInt(target.getAttribute('data-word-index') || '-1', 10)].filter((i) => i >= 0);

        isDragging.current = true;
        onDragStart?.();

        setupStretchDrag({
          element: target,
          mouseX: e.clientX,
          mouseY: e.clientY,
          onComplete: (endPos) => {
            isDragging.current = false;
            setPendingPull({
              sourceNodeId: nodeId,
              sourceText: text,
              sourceType: 'word',
              sourceWordIndices: wordIndices,
              screenPosition: endPos,
              fromMode: mode,
            });
            if (mode === 'classic') setMode('canvas');
          },
          onCancel: () => {
            isDragging.current = false;
          },
        });
        return;
      }

      // Zone 1b: Click inside a KaTeX element — walk up to the .word wrapper
      if (containerRef.current) {
        const wordAncestor = findWordAncestor(target, containerRef.current);
        if (wordAncestor) {
          clearSentenceHover();

          const text = wordAncestor.dataset.word || wordAncestor.textContent || '';
          const wordIndices = [parseInt(wordAncestor.getAttribute('data-word-index') || '-1', 10)].filter((i) => i >= 0);

          isDragging.current = true;
          onDragStart?.();

          setupStretchDrag({
            element: wordAncestor,
            mouseX: e.clientX,
            mouseY: e.clientY,
            onComplete: (endPos) => {
              isDragging.current = false;
              setPendingPull({
                sourceNodeId: nodeId,
                sourceText: text,
                sourceType: 'word',
                sourceWordIndices: wordIndices,
                screenPosition: endPos,
                fromMode: mode,
              });
              if (mode === 'classic') setMode('canvas');
            },
            onCancel: () => {
              isDragging.current = false;
            },
          });
          return;
        }
      }

      // Zone 2: Click on space BETWEEN words (inside a .sentence block) → sentence drag
      if (activeTool === 'select' && containerRef.current) {
        const sentenceEl = findSentenceAncestor(target, containerRef.current);
        if (sentenceEl) {
          clearSentenceHover();
          const { text: sentenceText, wordIndices } = collectSentenceWords(sentenceEl);
          if (sentenceText && wordIndices.length > 0) {

            isDragging.current = true;
            onDragStart?.();

            setupStretchDrag({
              element: sentenceEl,
              mouseX: e.clientX,
              mouseY: e.clientY,
              flattenToInline: true,
              onComplete: (endPos) => {
                isDragging.current = false;
                sentenceEl.style.background = '';
                setPendingPull({
                  sourceNodeId: nodeId,
                  sourceText: sentenceText,
                  sourceType: 'sentence',
                  sourceWordIndices: wordIndices,
                  screenPosition: endPos,
                  fromMode: mode,
                });
                if (mode === 'classic') setMode('canvas');
              },
              onCancel: () => {
                isDragging.current = false;
                sentenceEl.style.background = '';
              },
            });
            return;
          }
        }

        // Zone 3: Click on empty whitespace OUTSIDE any sentence → rectangle selection
        clearSentenceHover();
        handleWhitespaceMouseDown(e, containerRef.current);
      }
    },
    [
      nodeId,
      setPendingPull,
      setMode,
      mode,
      onDragStart,
      handleWhitespaceMouseDown,
      handleAnnotateRectMouseDown,
      clearSentenceHover,
      activeTool,
      highlightColor,
      activeTabId,
      onAnnotate,
      highlightMap,
    ],
  );

  // ─── Mouse over handler ──────────────────────────────────────
  const handleMouseOver = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging.current || isSelectingRef.current || isHighlighting.current) return;
      const target = e.target as HTMLElement;

      // Hovering a word: clear any sentence hover, apply word hover
      if (target.classList.contains('word')) {
        clearSentenceHover();
        if (activeTool === 'highlight') {
          target.style.background = highlightColor + '80';
        } else if (activeTool === 'select') {
          target.style.background = 'rgba(59, 130, 246, 0.06)';
        } else if (activeTool === 'annotate') {
          target.style.background = 'rgba(16, 185, 129, 0.08)';
        }
        return;
      }

      // Hovering whitespace: detect parent sentence block and highlight it
      if ((activeTool === 'select' || activeTool === 'annotate') && containerRef.current) {
        const sentence = findSentenceAncestor(target, containerRef.current);
        const hoverColor = activeTool === 'annotate' ? 'rgba(16, 185, 129, 0.03)' : 'rgba(59, 130, 246, 0.03)';
        if (sentence && sentence !== hoveredSentenceRef.current) {
          clearSentenceHover();
          hoveredSentenceRef.current = sentence;
          sentence.style.background = hoverColor;
        } else if (!sentence) {
          clearSentenceHover();
        }
      }
    },
    [isSelectingRef, activeTool, highlightColor, clearSentenceHover],
  );

  // ─── Mouse out handler ───────────────────────────────────────
  const handleMouseOut = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging.current || isSelectingRef.current || isHighlighting.current) return;
      const target = e.target as HTMLElement;

      // Leaving a word: restore its base background
      if (target.classList.contains('word')) {
        const idx = parseInt(target.getAttribute('data-word-index') || '-1', 10);
        const hl = highlightMap.get(idx);
        if (hl) {
          target.style.background = hl.color;
        } else {
          target.style.background = '';
        }
        return;
      }

      // Leaving a sentence: clear hover if the mouse left the sentence entirely
      if (hoveredSentenceRef.current) {
        const relTarget = e.relatedTarget as HTMLElement | null;
        // Clear if we left the document entirely, or moved to something outside this sentence
        if (!relTarget || !hoveredSentenceRef.current.contains(relTarget)) {
          clearSentenceHover();
        }
      }
    },
    [isSelectingRef, highlightMap, clearSentenceHover],
  );

  const cursorStyle =
    activeTool === 'highlight'
      ? 'text'
      : activeTool === 'annotate'
        ? 'crosshair'
        : undefined;

  // ─── Double-click handler: instant word pull (no drag animation) ──
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (activeTool !== 'select') return;
      const target = e.target as HTMLElement;

      // Find the .word element
      const wordEl = target.classList.contains('word')
        ? target
        : containerRef.current ? findWordAncestor(target, containerRef.current) : null;

      if (!wordEl) return;

      e.preventDefault();
      e.stopPropagation();

      const text = wordEl.dataset.word || wordEl.textContent || '';
      const wordIndices = [parseInt(wordEl.getAttribute('data-word-index') || '-1', 10)].filter((i) => i >= 0);

      if (text && wordIndices.length > 0) {
        setPendingPull({
          sourceNodeId: nodeId,
          sourceText: text,
          sourceType: 'word',
          sourceWordIndices: wordIndices,
          screenPosition: { x: e.clientX, y: e.clientY },
          fromMode: mode,
        });
        if (mode === 'classic') setMode('canvas');
      }
    },
    [activeTool, nodeId, setPendingPull, setMode, mode],
  );

  // Memoize the expensive ReactMarkdown render so it only re-runs when
  // content or highlights change — NOT when mode/tool/color change (those only affect handlers).
  const remarkPlugins = useMemo(() => [remarkMath, remarkGfm], []);
  const rehypePlugins = useMemo(() => [rehypeKatex], []);

  const renderedMarkdown = useMemo(() => {
    wordCounter.current.current = 0;
    return (
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={markdownComponents}
      >
        {content}
      </ReactMarkdown>
    );
  }, [content, markdownComponents, remarkPlugins, rehypePlugins]);

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseOver={handleMouseOver}
      onMouseOut={handleMouseOut}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      style={{
        fontSize: '1rem',
        lineHeight: 1.7,
        color: '#374151',
        userSelect: 'none',
        cursor: cursorStyle,
      }}
    >
      {renderedMarkdown}
    </div>
  );
}