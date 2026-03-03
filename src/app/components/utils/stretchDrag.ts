/**
 * Stretch-drag animation: the word/sentence text itself becomes a "string"
 * that flows along a catenary curve from its anchor point in the document
 * to the user's cursor.
 *
 * Uses an SVG `<textPath>` on a quadratic bezier with stiff spring physics
 * (slight droop, micro-sway, high damping) so it feels like pulling a
 * thread of text out of the page under tension.
 *
 * Pure DOM — no animation library required.
 */

export interface StretchDragOptions {
  /** The DOM element being pulled (word span or sentence block) */
  element: HTMLElement;
  /** Mouse coordinates at the start of the drag */
  mouseX: number;
  mouseY: number;
  /** Called when the drag completes (mouse released after threshold) */
  onComplete: (endPosition: { x: number; y: number }) => void;
  /** Called when the drag is cancelled (no movement / Escape) */
  onCancel: () => void;
  /**
   * If true, text is extracted as a flat sentence string
   * (used for sentence blocks so they don't drag as a paragraph)
   */
  flattenToInline?: boolean;
  /** Accent color for the text string (default: #3b82f6) */
  accentColor?: string;
}

const DRAG_THRESHOLD = 4;

// ─── Tether physics constants (stiffer than canvas StringEdge) ───
const STIFFNESS = 350;
const DAMPING = 24;
const X_STIFFNESS = 400;
const X_DAMPING = 28;

export function setupStretchDrag(opts: StretchDragOptions): void {
  const {
    element,
    mouseX,
    mouseY,
    onComplete,
    onCancel,
    flattenToInline = false,
    accentColor = '#3b82f6',
  } = opts;

  const rect = element.getBoundingClientRect();
  const originalHeight = rect.height;

  // Extract the text that will become the "string"
  let pullText: string;
  if (flattenToInline) {
    const wordEls = element.querySelectorAll<HTMLElement>('.word');
    const words: string[] = [];
    wordEls.forEach((w) => {
      const t = w.dataset.word || w.textContent || '';
      if (t) words.push(t);
    });
    pullText = words.join(' ');
  } else {
    pullText = element.dataset.word || element.textContent || '';
  }

  // Compute font style from the element
  const cs = window.getComputedStyle(element);
  const fontSize = parseFloat(cs.fontSize) || 16;
  const fontFamily = cs.fontFamily;
  const fontWeight = cs.fontWeight;

  // Anchor side: the end FARTHER from the mouse stays tethered
  const distToLeft = Math.abs(mouseX - rect.left);
  const distToRight = Math.abs(mouseX - rect.right);
  const anchorSide: 'left' | 'right' = distToLeft >= distToRight ? 'left' : 'right';

  // Anchor point in viewport coords
  const anchorX = anchorSide === 'left' ? rect.left : rect.right;
  const anchorY = rect.top + originalHeight / 2;

  let moved = false;

  // ── SVG state ────────────────────────────────────────────────
  let svgOverlay: SVGSVGElement | null = null;
  let curvePath: SVGPathElement | null = null;
  let textPathEl: SVGTextPathElement | null = null;
  let textEl: SVGTextElement | null = null;
  // Thin stroke underneath the text so the "string" is visible even
  // when the text is very spread out
  let strokePath: SVGPathElement | null = null;

  // Physics state
  let controlY: number | null = null;
  let controlXOffset = 0;
  let velY = 0;
  let velX = 0;
  let rafId: number | null = null;
  let lastTime = 0;
  let curMouseX = mouseX;
  let curMouseY = mouseY;

  // ── Create the SVG overlay ─────────────────────────────────────
  const createOverlay = () => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    svgOverlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgOverlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      z-index: 9999; pointer-events: none; overflow: visible;
    `;
    svgOverlay.setAttribute('viewBox', `0 0 ${vw} ${vh}`);

    // Defs: the bezier path that text flows along
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    curvePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    curvePath.setAttribute('id', 'stretch-drag-curve');
    curvePath.setAttribute('d', `M ${anchorX} ${anchorY} L ${anchorX} ${anchorY}`);
    defs.appendChild(curvePath);
    svgOverlay.appendChild(defs);

    // Thin string stroke (visible when text is spread thin)
    strokePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    strokePath.setAttribute('fill', 'none');
    strokePath.setAttribute('stroke', accentColor);
    strokePath.setAttribute('stroke-width', '1');
    strokePath.setAttribute('stroke-linecap', 'round');
    strokePath.setAttribute('opacity', '0');
    svgOverlay.appendChild(strokePath);

    // Text along the path
    textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    textEl.setAttribute('font-size', String(fontSize));
    textEl.setAttribute('font-family', fontFamily);
    textEl.setAttribute('font-weight', fontWeight);
    textEl.setAttribute('fill', '#374151');
    textEl.style.userSelect = 'none';

    textPathEl = document.createElementNS('http://www.w3.org/2000/svg', 'textPath');
    textPathEl.setAttribute('href', '#stretch-drag-curve');
    // Text starts from anchor side
    textPathEl.setAttribute('startOffset', anchorSide === 'left' ? '0%' : '100%');
    textPathEl.setAttribute('text-anchor', anchorSide === 'left' ? 'start' : 'end');
    textPathEl.textContent = pullText;

    textEl.appendChild(textPathEl);
    svgOverlay.appendChild(textEl);

    document.body.appendChild(svgOverlay);

    // Dim the original
    element.style.opacity = '0.15';

    // Init physics
    lastTime = performance.now();
    controlY = null;
    controlXOffset = 0;
    velY = 0;
    velX = 0;

    startPhysicsLoop();
  };

  // ── Physics loop ───────────────────────────────────────────────
  const startPhysicsLoop = () => {
    const simulate = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.04);
      lastTime = time;

      if (!curvePath || !strokePath || !textEl) return;

      const dx = curMouseX - anchorX;
      const dy = curMouseY - anchorY;
      const distance = Math.hypot(dx, dy);

      // Droop: taut string — much less sag than canvas StringEdge
      const droop = Math.min(distance * 0.06, 25);
      const midX = (anchorX + curMouseX) / 2;
      const restY = Math.max(anchorY, curMouseY) + droop;

      if (controlY === null) controlY = restY;

      // Y spring
      const dispY = controlY - restY;
      velY += (-STIFFNESS * dispY - DAMPING * velY) * dt;
      controlY += velY * dt;

      // X spring (lateral micro-sway)
      velX += (-X_STIFFNESS * controlXOffset - X_DAMPING * velX) * dt;
      controlXOffset += velX * dt;

      const ctrlX = midX + controlXOffset;
      const ctrlY = controlY;

      // Update the bezier path
      const d = `M ${anchorX} ${anchorY} Q ${ctrlX} ${ctrlY} ${curMouseX} ${curMouseY}`;
      curvePath.setAttribute('d', d);
      strokePath.setAttribute('d', d);

      // Measure the path length to compute text spacing
      const pathLen = curvePath.getTotalLength();

      // Approximate the text's natural width (rough: chars * fontSize * 0.55)
      const naturalTextWidth = pullText.length * fontSize * 0.55;

      // Stretch ratio: how much longer the path is than the text's natural width
      const stretchRatio = pathLen / Math.max(naturalTextWidth, 1);

      // Text opacity fades as stretch increases
      const textOpacity = Math.max(0.15, Math.min(1, 1.8 / stretchRatio));
      textEl.setAttribute('opacity', String(textOpacity));

      // Stroke stays invisible during drag — only appears in squish animation
      // (just keep its `d` updated above so it has the right shape)

      // Vertical squish: font shrinks as the word stretches along the curve,
      // like taffy being pulled thin. Kicks in immediately (stretchRatio > 1)
      // and gets aggressive fast — short words thin out quickly.
      const squish = 1 / Math.max(1, Math.pow(stretchRatio, 0.8));
      textEl.setAttribute('font-size', String(fontSize * Math.max(0.15, squish)));

      // Minimal letter-spacing: only for long text (sentences) to avoid
      // excessive bunching. Short words (< 15 chars) get zero spacing so
      // they stay cohesive. Longer text gets a small amount to breathe.
      if (pullText.length >= 15 && stretchRatio > 1.5) {
        const extraPerChar = (pathLen - naturalTextWidth) / Math.max(pullText.length - 1, 1);
        // Cap at a small fraction of font-size so letters never fully separate
        textEl.setAttribute('letter-spacing', String(Math.min(extraPerChar, fontSize * 0.4)));
      } else {
        textEl.setAttribute('letter-spacing', '0');
      }

      rafId = requestAnimationFrame(simulate);
    };

    rafId = requestAnimationFrame(simulate);
  };

  // Apply impulse on mouse movement
  const applyImpulse = (mx: number, my: number) => {
    const dmy = my - curMouseY;
    const dmx = mx - curMouseX;

    if (Math.abs(dmy) > 0.5) velY += dmy * 0.15;
    if (Math.abs(dmx) > 0.5) velX += dmx * 0.08;

    curMouseX = mx;
    curMouseY = my;
  };

  // ── Cleanup ────────────────────────────────────────────────────
  const removeOverlay = () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (svgOverlay?.parentNode) {
      svgOverlay.parentNode.removeChild(svgOverlay);
    }
    svgOverlay = null;
    curvePath = null;
    textPathEl = null;
    textEl = null;
    strokePath = null;
  };

  const restoreOriginal = () => {
    element.style.opacity = '';
  };

  const detach = () => {
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    window.removeEventListener('keydown', onKeyDown);
  };

  // ── Squish-to-string animation on release ──────────────────────
  // The text compresses along the curve: letter-spacing → 0, font shrinks,
  // text fades out while the thin stroke line strengthens — the text
  // visually becomes a plain string, then onComplete spawns the node
  // whose StringEdge draw-on animation picks up from there.
  const squishToString = (duration: number, cb: () => void) => {
    if (!svgOverlay || !textEl || !strokePath || !curvePath) {
      cb();
      return;
    }

    // Stop physics
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }

    // Capture current state
    const startFontSize = parseFloat(textEl.getAttribute('font-size') || String(fontSize));
    const startLetterSpacing = parseFloat(textEl.getAttribute('letter-spacing') || '0');
    const startTextOpacity = parseFloat(textEl.getAttribute('opacity') || '1');
    const startStrokeOpacity = parseFloat(strokePath.getAttribute('opacity') || '0');
    const startStrokeWidth = parseFloat(strokePath.getAttribute('stroke-width') || '1');
    const startTime = performance.now();

    const animate = (time: number) => {
      const elapsed = time - startTime;
      const t = Math.min(elapsed / duration, 1);
      // Ease in-out cubic for smooth squish
      const ease = t < 0.5
        ? 4 * t * t * t
        : 1 - Math.pow(-2 * t + 2, 3) / 2;

      if (!textEl || !strokePath) return;

      // Collapse letter-spacing to 0
      const ls = startLetterSpacing * (1 - ease);
      textEl.setAttribute('letter-spacing', String(ls));

      // Shrink font toward a thin line
      const fs = startFontSize * Math.max(0.08, 1 - ease * 0.92);
      textEl.setAttribute('font-size', String(fs));

      // Fade text out
      const textOp = startTextOpacity * Math.max(0, 1 - ease * 1.5);
      textEl.setAttribute('opacity', String(textOp));

      // Strengthen the stroke line — the "string" emerges
      const strokeOp = startStrokeOpacity + (0.6 - startStrokeOpacity) * ease;
      strokePath.setAttribute('opacity', String(strokeOp));

      // Thicken stroke slightly as text vanishes
      const sw = startStrokeWidth + (1.5 - startStrokeWidth) * ease;
      strokePath.setAttribute('stroke-width', String(sw));

      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        // Quick fade of the remaining stroke line
        const fadeStart = performance.now();
        const fadeDuration = 120;
        const finalStrokeOp = strokeOp;

        const fadeStroke = (ft: number) => {
          const ft2 = Math.min((ft - fadeStart) / fadeDuration, 1);
          strokePath?.setAttribute('opacity', String(finalStrokeOp * (1 - ft2)));
          if (ft2 < 1) {
            requestAnimationFrame(fadeStroke);
          } else {
            removeOverlay();
            cb();
          }
        };
        requestAnimationFrame(fadeStroke);
      }
    };
    requestAnimationFrame(animate);
  };

  // ── Snap-back animation on cancel ──────────────────────────────
  const snapBack = (duration: number, cb: () => void) => {
    if (!curvePath || !svgOverlay) {
      removeOverlay();
      cb();
      return;
    }

    // Stop physics
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }

    const startMouseX = curMouseX;
    const startMouseY = curMouseY;
    const startCtrlY = controlY ?? anchorY;
    const startCtrlXOff = controlXOffset;
    const startTime = performance.now();

    const animate = (time: number) => {
      const t = Math.min((time - startTime) / duration, 1);
      // Ease out cubic
      const ease = 1 - Math.pow(1 - t, 3);

      // Lerp mouse position back to anchor
      const mx = startMouseX + (anchorX - startMouseX) * ease;
      const my = startMouseY + (anchorY - startMouseY) * ease;
      const cy = startCtrlY + (anchorY - startCtrlY) * ease;
      const cx = (anchorX + mx) / 2 + startCtrlXOff * (1 - ease);

      const d = `M ${anchorX} ${anchorY} Q ${cx} ${cy} ${mx} ${my}`;
      curvePath!.setAttribute('d', d);
      strokePath?.setAttribute('d', d);

      // Fade in the original, fade out the SVG
      element.style.opacity = String(ease);
      svgOverlay!.style.opacity = String(1 - ease * 0.5);

      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        removeOverlay();
        restoreOriginal();
        cb();
      }
    };
    requestAnimationFrame(animate);
  };

  // ── Listeners ──────────────────────────────────────────────────
  const onMouseMove = (e: MouseEvent) => {
    if (!moved) {
      const d = Math.hypot(e.clientX - mouseX, e.clientY - mouseY);
      if (d < DRAG_THRESHOLD) return;
      moved = true;
      createOverlay();
    }
    applyImpulse(e.clientX, e.clientY);
  };

  const onMouseUp = (e: MouseEvent) => {
    detach();
    if (moved) {
      const endPos = { x: e.clientX, y: e.clientY };
      squishToString(200, () => {
        restoreOriginal();
        onComplete(endPos);
      });
    } else {
      removeOverlay();
      restoreOriginal();
      onCancel();
    }
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      detach();
      if (moved) {
        snapBack(280, () => {
          onCancel();
        });
      } else {
        removeOverlay();
        restoreOriginal();
        onCancel();
      }
    }
  };

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('keydown', onKeyDown);
}