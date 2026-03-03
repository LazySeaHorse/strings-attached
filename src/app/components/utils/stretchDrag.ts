/**
 * Stretch-drag animation: the word/sentence text itself becomes a "string"
 * that flows along a catenary curve from its anchor point in the document
 * to the user's cursor.
 *
 * Letters are rendered as individual HTML elements positioned along the
 * bezier curve — like beads threaded on a string. Each letter stays upright
 * (no rotation), avoiding the broken tilted-glyph rendering of <textPath>.
 * A thin SVG stroke path renders the "string" line underneath.
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

// ─── Bezier helpers ──────────────────────────────────────────────
/** Get point on a quadratic bezier at parameter t */
function quadBezierPoint(
  ax: number, ay: number,
  cx: number, cy: number,
  bx: number, by: number,
  t: number,
): { x: number; y: number } {
  const u = 1 - t;
  return {
    x: u * u * ax + 2 * u * t * cx + t * t * bx,
    y: u * u * ay + 2 * u * t * cy + t * t * by,
  };
}

/** Approximate arc length of a quadratic bezier using line segments */
function quadBezierLength(
  ax: number, ay: number,
  cx: number, cy: number,
  bx: number, by: number,
  segments = 32,
): number {
  let len = 0;
  let prev = { x: ax, y: ay };
  for (let i = 1; i <= segments; i++) {
    const pt = quadBezierPoint(ax, ay, cx, cy, bx, by, i / segments);
    len += Math.hypot(pt.x - prev.x, pt.y - prev.y);
    prev = pt;
  }
  return len;
}

/** Find t parameter for a target arc-length distance along the bezier */
function tAtArcLength(
  ax: number, ay: number,
  cx: number, cy: number,
  bx: number, by: number,
  targetLen: number,
  segments = 64,
): number {
  let accumulated = 0;
  let prev = { x: ax, y: ay };
  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    const pt = quadBezierPoint(ax, ay, cx, cy, bx, by, t);
    const segLen = Math.hypot(pt.x - prev.x, pt.y - prev.y);
    accumulated += segLen;
    if (accumulated >= targetLen) {
      // Interpolate back for precision
      const overshoot = accumulated - targetLen;
      const frac = segLen > 0 ? overshoot / segLen : 0;
      return (i - frac) / segments;
    }
    prev = pt;
  }
  return 1;
}

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

  // Split into individual characters
  const chars = Array.from(pullText);

  // Compute font style from the element
  const cs = window.getComputedStyle(element);
  const fontSize = parseFloat(cs.fontSize) || 16;
  const fontFamily = cs.fontFamily;
  const fontWeight = cs.fontWeight;

  // Measure individual character widths using a hidden canvas
  const measureCanvas = document.createElement('canvas');
  const mCtx = measureCanvas.getContext('2d')!;
  mCtx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  const charWidths = chars.map((ch) => mCtx.measureText(ch).width);
  const naturalTextWidth = charWidths.reduce((a, b) => a + b, 0);

  // Anchor side: the end FARTHER from the mouse stays tethered
  const distToLeft = Math.abs(mouseX - rect.left);
  const distToRight = Math.abs(mouseX - rect.right);
  const anchorSide: 'left' | 'right' = distToLeft >= distToRight ? 'left' : 'right';

  // Anchor point in viewport coords
  const anchorX = anchorSide === 'left' ? rect.left : rect.right;
  const anchorY = rect.top + originalHeight / 2;

  let moved = false;

  // ── Overlay state ──────────────────────────────────────────────
  let container: HTMLDivElement | null = null;
  let svgOverlay: SVGSVGElement | null = null;
  let strokePath: SVGPathElement | null = null;
  let letterEls: HTMLSpanElement[] = [];

  // Physics state
  let controlY: number | null = null;
  let controlXOffset = 0;
  let velY = 0;
  let velX = 0;
  let rafId: number | null = null;
  let lastTime = 0;
  let curMouseX = mouseX;
  let curMouseY = mouseY;

  // Current bezier control point (for squish/snapback animations)
  let curCtrlX = anchorX;
  let curCtrlY = anchorY;

  // ── Create the overlay ─────────────────────────────────────────
  const createOverlay = () => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Container div for everything
    container = document.createElement('div');
    container.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      z-index: 9999; pointer-events: none; overflow: visible;
    `;

    // SVG for the thin string stroke
    svgOverlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgOverlay.style.cssText = `
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      overflow: visible;
    `;
    svgOverlay.setAttribute('viewBox', `0 0 ${vw} ${vh}`);

    strokePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    strokePath.setAttribute('fill', 'none');
    strokePath.setAttribute('stroke', accentColor);
    strokePath.setAttribute('stroke-width', '1.5');
    strokePath.setAttribute('stroke-linecap', 'round');
    strokePath.setAttribute('opacity', '0.5');
    svgOverlay.appendChild(strokePath);

    container.appendChild(svgOverlay);

    // Create individual letter spans
    letterEls = chars.map((ch) => {
      const span = document.createElement('span');
      span.textContent = ch;
      span.style.cssText = `
        position: absolute;
        font-size: ${fontSize}px;
        font-family: ${fontFamily};
        font-weight: ${fontWeight};
        color: #374151;
        pointer-events: none;
        user-select: none;
        will-change: transform;
        white-space: pre;
        transform-origin: center center;
      `;
      container!.appendChild(span);
      return span;
    });

    document.body.appendChild(container);

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

  // ── Position letters along the bezier ──────────────────────────
  const layoutLetters = (
    ax: number, ay: number,
    cx: number, cy: number,
    bx: number, by: number,
    pathLen: number,
    opacity?: number,
    scale?: number,
  ) => {
    if (letterEls.length === 0) return;

    const n = chars.length;
    // Compute spacing: distribute letters evenly along the curve
    // with extra spacing proportional to stretch
    const stretchRatio = pathLen / Math.max(naturalTextWidth, 1);

    // Each character gets its natural width + proportional extra space
    const totalExtra = Math.max(0, pathLen - naturalTextWidth);
    const gaps = Math.max(n - 1, 1);
    const extraPerGap = totalExtra / gaps;

    // Compute cumulative positions (center of each char) along the path
    let accumulated = 0;
    const charPositions: number[] = [];

    // If anchor is on the right, we reverse the order
    const isReversed = anchorSide === 'right';

    for (let i = 0; i < n; i++) {
      const idx = isReversed ? n - 1 - i : i;
      const w = charWidths[idx];
      charPositions[idx] = accumulated + w / 2;
      accumulated += w + (i < n - 1 ? extraPerGap : 0);
    }

    // Scale positions to fit within pathLen
    const totalSpan = accumulated;
    const posScale = totalSpan > 0 ? pathLen / totalSpan : 1;

    // Vertical squish: letters flatten as string stretches
    const squishY = 1 / Math.max(1, Math.pow(stretchRatio, 0.5));
    // Horizontal squish: letters compress slightly as they spread
    const squishX = 1 / Math.max(1, Math.pow(stretchRatio, 0.25));

    const effectiveScale = scale ?? 1;
    const effectiveOpacity = opacity ?? Math.max(0.2, Math.min(1, 2 / stretchRatio));

    for (let i = 0; i < n; i++) {
      const el = letterEls[i];
      const pos = charPositions[i] * posScale;
      const t = tAtArcLength(ax, ay, cx, cy, bx, by, pos);
      const pt = quadBezierPoint(ax, ay, cx, cy, bx, by, t);

      const sx = squishX * effectiveScale;
      const sy = squishY * effectiveScale;

      el.style.transform = `translate(${pt.x - charWidths[i] / 2}px, ${pt.y - fontSize / 2}px) scale(${sx}, ${sy})`;
      el.style.opacity = String(effectiveOpacity);
    }
  };

  // ── Physics loop ───────────────────────────────────────────────
  const startPhysicsLoop = () => {
    const simulate = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.04);
      lastTime = time;

      if (!strokePath) return;

      const dx = curMouseX - anchorX;
      const dy = curMouseY - anchorY;
      const distance = Math.hypot(dx, dy);

      // Droop: taut string — less sag than canvas StringEdge
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

      curCtrlX = midX + controlXOffset;
      curCtrlY = controlY;

      // Update the bezier stroke path
      const d = `M ${anchorX} ${anchorY} Q ${curCtrlX} ${curCtrlY} ${curMouseX} ${curMouseY}`;
      strokePath.setAttribute('d', d);

      // Compute path length
      const pathLen = quadBezierLength(anchorX, anchorY, curCtrlX, curCtrlY, curMouseX, curMouseY);

      // Layout letters along the curve
      layoutLetters(anchorX, anchorY, curCtrlX, curCtrlY, curMouseX, curMouseY, pathLen);

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
    if (container?.parentNode) {
      container.parentNode.removeChild(container);
    }
    container = null;
    svgOverlay = null;
    strokePath = null;
    letterEls = [];
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
  // Letters shrink and fade while the string stroke strengthens,
  // then onComplete spawns the node whose StringEdge picks up.
  const squishToString = (duration: number, cb: () => void) => {
    if (!container || !strokePath) {
      cb();
      return;
    }

    // Stop physics
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }

    const startStrokeOpacity = parseFloat(strokePath.getAttribute('opacity') || '0.5');
    const startTime = performance.now();
    const pathLen = quadBezierLength(anchorX, anchorY, curCtrlX, curCtrlY, curMouseX, curMouseY);

    const animate = (time: number) => {
      const elapsed = time - startTime;
      const t = Math.min(elapsed / duration, 1);
      // Ease in-out cubic
      const ease = t < 0.5
        ? 4 * t * t * t
        : 1 - Math.pow(-2 * t + 2, 3) / 2;

      if (!strokePath) return;

      // Letters shrink and fade
      const scale = Math.max(0.05, 1 - ease * 0.95);
      const opacity = Math.max(0, 1 - ease * 1.5);
      layoutLetters(
        anchorX, anchorY, curCtrlX, curCtrlY, curMouseX, curMouseY,
        pathLen, opacity, scale,
      );

      // Strengthen the stroke line
      const strokeOp = startStrokeOpacity + (0.7 - startStrokeOpacity) * ease;
      strokePath.setAttribute('opacity', String(strokeOp));
      strokePath.setAttribute('stroke-width', String(1.5 + ease));

      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        // Quick fade of the remaining stroke
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
    if (!container || !strokePath) {
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
      strokePath!.setAttribute('d', d);

      const pathLen = quadBezierLength(anchorX, anchorY, cx, cy, mx, my);
      layoutLetters(anchorX, anchorY, cx, cy, mx, my, pathLen);

      // Fade in the original, fade out the overlay
      element.style.opacity = String(ease);
      container!.style.opacity = String(1 - ease * 0.5);

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
