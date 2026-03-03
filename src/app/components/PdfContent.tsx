import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { useAppStore } from './stores';
import { useRectangleSelection } from './useRectangleSelection';
import { loadPdfDocument, renderPageToCanvas, dataUrlToArrayBuffer, type TextItem } from './pdfUtils';
import { setupStretchDrag } from './utils/stretchDrag';
import { toast } from 'sonner';

interface WordSpan {
  word: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface LineGroup {
  words: WordSpan[];
  y: number;
  height: number;
  minX: number;
  maxX: number;
  text: string;
}

interface PdfPageContentProps {
  pdfDataUrl: string;
  pageNum: number;
  nodeId: string;
}

/**
 * Renders a single PDF page as a canvas with an interactive text layer overlay.
 * Words are grouped into lines for visual layout.
 * Non-word clicks trigger rectangle selection; word clicks trigger word drag.
 * ESC cancels any active drag.
 */
export function PdfPageContent({ pdfDataUrl, pageNum, nodeId }: PdfPageContentProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const [textItems, setTextItems] = useState<TextItem[]>([]);
  const [rendered, setRendered] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  const { setMode, mode, activeTool } = useAppStore();
  const setPendingPull = useAppStore((s) => s.setPendingPull);
  const isDragging = useRef(false);

  // Rectangle selection for non-word clicks
  const { handleWhitespaceMouseDown, isSelectingRef } = useRectangleSelection({
    wordSelector: '.pdf-word',
  });

  // Observe container width for responsive scaling
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Load & render
  useEffect(() => {
    let cancelled = false;

    async function render() {
      if (!canvasRef.current) return;
      try {
        setLoading(true);
        setError(null);

        const arrayBuffer = dataUrlToArrayBuffer(pdfDataUrl);
        const pdfDoc = await loadPdfDocument(arrayBuffer);
        if (cancelled) return;

        const scale = 2;
        const result = await renderPageToCanvas(pdfDoc, pageNum, canvasRef.current, scale);
        if (cancelled) return;

        setTextItems(result.textItems);
        setDimensions({ width: result.viewport.width, height: result.viewport.height });
        setRendered(true);
      } catch (err) {
        console.error(`Error rendering PDF page ${pageNum}:`, err);
        toast.error(`Failed to render PDF page ${pageNum}`);
        if (!cancelled) setError('Failed to render page');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    render();
    return () => { cancelled = true; };
  }, [pdfDataUrl, pageNum]);

  // Split text items into words, then group into lines
  const lines = React.useMemo(() => {
    const allWords: WordSpan[] = [];
    for (const item of textItems) {
      const words = item.str.split(/(\s+)/);
      let xOffset = 0;
      const charWidth = item.width / Math.max(item.str.length, 1);

      for (const word of words) {
        if (/^\s+$/.test(word) || word === '') {
          xOffset += word.length * charWidth;
          continue;
        }
        allWords.push({
          word,
          x: item.x + xOffset,
          y: item.y,
          width: word.length * charWidth,
          height: item.height,
        });
        xOffset += word.length * charWidth;
      }
    }

    const lineGroups: LineGroup[] = [];
    const yThreshold = 3;

    for (const w of allWords) {
      let foundLine = false;
      for (const line of lineGroups) {
        if (Math.abs(w.y - line.y) < yThreshold && Math.abs(w.height - line.height) < yThreshold) {
          line.words.push(w);
          line.minX = Math.min(line.minX, w.x);
          line.maxX = Math.max(line.maxX, w.x + w.width);
          foundLine = true;
          break;
        }
      }
      if (!foundLine) {
        lineGroups.push({
          words: [w],
          y: w.y,
          height: w.height,
          minX: w.x,
          maxX: w.x + w.width,
          text: '',
        });
      }
    }

    for (const line of lineGroups) {
      line.words.sort((a, b) => a.x - b.x);
      line.text = line.words.map((w) => w.word).join(' ');
    }

    lineGroups.sort((a, b) => a.y - b.y);
    return lineGroups;
  }, [textItems]);

  // Drag handling — word clicks only; everything else → rectangle selection
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;

    // In highlight or annotate mode, don't create strings
    if (activeTool === 'highlight' || activeTool === 'annotate') return;

    if (target.classList.contains('pdf-word')) {
      // Word drag with stretch animation
      const text = target.dataset.word || '';

      isDragging.current = true;

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
            sourceWordIndices: [],
            screenPosition: endPos,
          });
          if (mode === 'classic') setMode('canvas');
        },
        onCancel: () => {
          isDragging.current = false;
        },
      });
      return;
    }

    // Any non-word click → rectangle selection
    if (textLayerRef.current) {
      handleWhitespaceMouseDown(e, textLayerRef.current);
    }
  }, [nodeId, setPendingPull, setMode, mode, handleWhitespaceMouseDown, activeTool]);

  // Hover — word-level only
  const handleMouseOver = useCallback((e: React.MouseEvent) => {
    if (isDragging.current || isSelectingRef.current) return;
    const target = e.target as HTMLElement;
    if (target.classList.contains('pdf-word')) {
      target.style.background = 'rgba(59, 130, 246, 0.1)';
      target.style.outline = '1px solid rgba(59, 130, 246, 0.3)';
    }
  }, [isSelectingRef]);

  const handleMouseOut = useCallback((e: React.MouseEvent) => {
    if (isDragging.current || isSelectingRef.current) return;
    const target = e.target as HTMLElement;
    if (target.classList.contains('pdf-word')) {
      target.style.background = '';
      target.style.outline = '';
    }
  }, [isSelectingRef]);

  const displayScale = dimensions && containerWidth ? containerWidth / dimensions.width : 1;

  if (error) {
    return (
      <div className="flex items-center justify-center py-12" style={{ color: '#737373', fontSize: '0.875rem' }}>
        {error}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: '#fff',
        width: '100%',
      }}
    >
      {loading && (
        <div className="flex items-center justify-center gap-2 py-12" style={{ color: '#737373' }}>
          <Loader2 size={18} className="animate-spin" />
          <span style={{ fontSize: '0.875rem' }}>Rendering page...</span>
        </div>
      )}

      <canvas
        ref={canvasRef}
        style={{
          display: loading ? 'none' : 'block',
          width: '100%',
          height: 'auto',
        }}
      />

      {/* Interactive text layer */}
      {rendered && dimensions && (
        <div
          ref={textLayerRef}
          onMouseDown={handleMouseDown}
          onMouseOver={handleMouseOver}
          onMouseOut={handleMouseOut}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
          }}
        >
          {lines.map((line, li) => {
            const padding = 2;
            return (
              <div
                key={li}
                className="pdf-line"
                style={{
                  position: 'absolute',
                  left: (line.minX - padding) * displayScale,
                  top: (line.y - padding) * displayScale,
                  width: (line.maxX - line.minX + padding * 2) * displayScale,
                  height: (line.height + padding * 2) * displayScale,
                  cursor: 'grab',
                  borderRadius: 3,
                }}
              >
                {line.words.map((span, wi) => (
                  <span
                    key={wi}
                    className="pdf-word"
                    data-word={span.word}
                    style={{
                      position: 'absolute',
                      left: (span.x - line.minX + padding) * displayScale,
                      top: padding * displayScale,
                      width: span.width * displayScale,
                      height: span.height * displayScale,
                      color: 'transparent',
                      cursor: 'grab',
                      borderRadius: 2,
                      transition: 'background 150ms ease',
                      userSelect: 'none',
                      fontSize: span.height * displayScale * 0.85,
                      lineHeight: 1,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    {span.word}
                  </span>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Multi-page PDF renderer for Classic view (scrollable).
 */
export function PdfContent({ pdfDataUrl, nodeId }: { pdfDataUrl: string; nodeId: string }) {
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const arrayBuffer = dataUrlToArrayBuffer(pdfDataUrl);
        const pdfDoc = await loadPdfDocument(arrayBuffer);
        if (!cancelled) {
          setNumPages(pdfDoc.numPages);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [pdfDataUrl]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12" style={{ color: '#737373' }}>
        <Loader2 size={18} className="animate-spin" />
        <span style={{ fontSize: '0.875rem' }}>Loading PDF...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: numPages }, (_, i) => (
        <div key={i + 1}>
          <div style={{ border: '1px solid #e5e5e5', borderRadius: 4, overflow: 'hidden' }}>
            <PdfPageContent pdfDataUrl={pdfDataUrl} pageNum={i + 1} nodeId={nodeId} />
          </div>
          {numPages > 1 && (
            <div style={{ textAlign: 'center', padding: '4px 0', fontSize: '0.75rem', color: '#a3a3a3' }}>
              Page {i + 1} of {numPages}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}