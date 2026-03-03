import React, { useRef, useCallback } from 'react';

export interface RectangleSelectionResult {
  text: string;
  wordIndices: number[];
  /** Mouseup screen position */
  position: { x: number; y: number };
}

interface UseRectangleSelectionOptions {
  /** CSS selector for word elements, e.g. '.word' or '.pdf-word' */
  wordSelector: string;
  /** Called on mouseup when words were selected */
  onPull?: (result: RectangleSelectionResult) => void;
  /** Accent color for lasso rectangle and word highlights (default: blue #3b82f6) */
  accentColor?: string;
}

/**
 * Hook that enables rectangle-drag text selection.
 *
 * Draws a blue rectangle as the user drags; all words intersecting the
 * rectangle are highlighted. On mouseup, if any words were selected,
 * the `onPull` callback fires with the collected text and word indices.
 *
 * This hook does NOT call startDrag / setMode — it defers node creation
 * to the caller, avoiding mid-drag mode switches that break the DOM.
 */
export function useRectangleSelection({
  wordSelector,
  onPull,
  accentColor = '#3b82f6',
}: UseRectangleSelectionOptions) {
  const isSelectingRef = useRef(false);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const selectedWordsRef = useRef<Set<HTMLElement>>(new Set());
  const rectElRef = useRef<HTMLDivElement | null>(null);
  const badgeElRef = useRef<HTMLDivElement | null>(null);

  /** Gather selected words in reading order and concatenate */
  const collectText = useCallback((words: Set<HTMLElement>): string => {
    if (words.size === 0) return '';

    const sorted = [...words].sort((a, b) => {
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      const dy = ra.top - rb.top;
      if (Math.abs(dy) > 4) return dy;
      return ra.left - rb.left;
    });

    let text = '';
    let prevBottom = -Infinity;
    for (const el of sorted) {
      const r = el.getBoundingClientRect();
      const word = el.dataset.word || el.textContent || '';
      if (text.length === 0) {
        text = word;
      } else if (r.top - prevBottom > 8) {
        text += '\n' + word;
      } else {
        text += ' ' + word;
      }
      prevBottom = r.bottom;
    }
    return text.trim();
  }, []);

  /** Remove the rectangle overlay and clear word highlights */
  const cleanupVisuals = useCallback(() => {
    if (rectElRef.current) {
      rectElRef.current.remove();
      rectElRef.current = null;
    }
    if (badgeElRef.current) {
      badgeElRef.current.remove();
      badgeElRef.current = null;
    }
    selectedWordsRef.current.forEach((w) => {
      w.style.background = w.dataset.hlColor || '';
      w.style.outline = '';
    });
    selectedWordsRef.current = new Set();
  }, []);

  const handleWhitespaceMouseDown = useCallback(
    (e: React.MouseEvent | MouseEvent, container: HTMLElement) => {
      e.stopPropagation();

      startPosRef.current = { x: e.clientX, y: e.clientY };
      isSelectingRef.current = true;
      selectedWordsRef.current = new Set();

      // Parse accent color to RGB for rgba usage
      const hexToRgb = (hex: string) => {
        const h = hex.replace('#', '');
        return `${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)}`;
      };
      const rgb = hexToRgb(accentColor);

      const rect = document.createElement('div');
      rect.style.cssText = `
        position: fixed;
        background: rgba(${rgb}, 0.06);
        border: 1.5px solid rgba(${rgb}, 0.3);
        border-radius: 4px;
        pointer-events: none;
        z-index: 9999;
        display: none;
        transition: none;
      `;
      document.body.appendChild(rect);
      rectElRef.current = rect;

      // Word count badge
      const badge = document.createElement('div');
      badge.style.cssText = `
        position: fixed;
        background: rgba(${rgb}, 0.9);
        color: #fff;
        font-size: 0.6875rem;
        font-weight: 600;
        padding: 2px 8px;
        border-radius: 10px;
        pointer-events: none;
        z-index: 10000;
        display: none;
        white-space: nowrap;
        font-family: system-ui, -apple-system, sans-serif;
      `;
      document.body.appendChild(badge);
      badgeElRef.current = badge;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!startPosRef.current) return;

        const current = { x: moveEvent.clientX, y: moveEvent.clientY };
        const dx = current.x - startPosRef.current.x;
        const dy = current.y - startPosRef.current.y;
        if (Math.hypot(dx, dy) < 3) return;

        const left = Math.min(startPosRef.current.x, current.x);
        const top = Math.min(startPosRef.current.y, current.y);
        const width = Math.abs(dx);
        const height = Math.abs(dy);

        if (rectElRef.current) {
          rectElRef.current.style.left = `${left}px`;
          rectElRef.current.style.top = `${top}px`;
          rectElRef.current.style.width = `${width}px`;
          rectElRef.current.style.height = `${height}px`;
          rectElRef.current.style.display = 'block';
        }

        const words = container.querySelectorAll(wordSelector);
        const newSelected = new Set<HTMLElement>();

        words.forEach((w) => {
          const wr = w.getBoundingClientRect();
          if (
            wr.right > left &&
            wr.left < left + width &&
            wr.bottom > top &&
            wr.top < top + height
          ) {
            newSelected.add(w as HTMLElement);
          }
        });

        // Diff highlight
        selectedWordsRef.current.forEach((w) => {
          if (!newSelected.has(w)) {
            w.style.background = w.dataset.hlColor || '';
            w.style.outline = '';
          }
        });
        newSelected.forEach((w) => {
          w.style.background = `rgba(${rgb}, 0.15)`;
          w.style.outline = `1px solid rgba(${rgb}, 0.3)`;
        });
        selectedWordsRef.current = newSelected;

        // Update badge
        if (badgeElRef.current) {
          if (newSelected.size > 0) {
            badgeElRef.current.textContent = `${newSelected.size} word${newSelected.size > 1 ? 's' : ''}`;
            badgeElRef.current.style.left = `${moveEvent.clientX + 12}px`;
            badgeElRef.current.style.top = `${moveEvent.clientY - 24}px`;
            badgeElRef.current.style.display = 'block';
          } else {
            badgeElRef.current.style.display = 'none';
          }
        }
      };

      const handleMouseUp = (upEvent: MouseEvent) => {
        // Collect result BEFORE cleaning up visuals
        if (selectedWordsRef.current.size > 0 && onPull) {
          const text = collectText(selectedWordsRef.current);
          const wordIndices = [...selectedWordsRef.current]
            .map((w) => parseInt(w.getAttribute('data-word-index') || '-1', 10))
            .filter((i) => i >= 0);

          if (text && wordIndices.length > 0) {
            onPull({
              text,
              wordIndices,
              position: { x: upEvent.clientX, y: upEvent.clientY },
            });
          }
        }

        cleanupVisuals();
        isSelectingRef.current = false;
        startPosRef.current = null;

        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        window.removeEventListener('keydown', handleKeyDown);
      };

      const handleKeyDown = (keyEvent: KeyboardEvent) => {
        if (keyEvent.key === 'Escape') {
          keyEvent.preventDefault();
          cleanupVisuals();
          isSelectingRef.current = false;
          startPosRef.current = null;

          window.removeEventListener('mousemove', handleMouseMove);
          window.removeEventListener('mouseup', handleMouseUp);
          window.removeEventListener('keydown', handleKeyDown);
        }
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('keydown', handleKeyDown);
    },
    [wordSelector, collectText, cleanupVisuals, onPull, accentColor],
  );

  return {
    handleWhitespaceMouseDown,
    isSelectingRef,
  };
}