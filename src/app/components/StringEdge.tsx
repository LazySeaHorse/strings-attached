import React, { useRef, useEffect, useReducer } from 'react';
import { type EdgeProps, useInternalNode } from '@xyflow/react';
import { NODE_TAB_COLORS, type NodeTabKey } from './stores';

const STIFFNESS = 150;
const DAMPING = 10;
const X_STIFFNESS = 200;
const X_DAMPING = 14;

const TITLE_BAR_HEIGHT = 42; // ~12px padding top + 14px text + 12px padding bottom + border

/**
 * Find the closest point on the title bar perimeter of a node to an external point.
 * The title bar is the top TITLE_BAR_HEIGHT pixels of the node.
 */
function closestPointOnTitleBar(
  nodeX: number, nodeY: number, nodeW: number,
  extX: number, extY: number,
): { x: number; y: number } {
  const barBottom = nodeY + TITLE_BAR_HEIGHT;
  const barRight = nodeX + nodeW;

  // Candidate edges of the title bar rectangle (top, bottom, left, right)
  // For each edge, find the closest point to (extX, extY) clamped to edge bounds
  const candidates: { x: number; y: number; dist: number }[] = [];

  // Top edge
  const topX = Math.max(nodeX, Math.min(barRight, extX));
  candidates.push({ x: topX, y: nodeY, dist: Math.hypot(topX - extX, nodeY - extY) });

  // Bottom edge
  const botX = Math.max(nodeX, Math.min(barRight, extX));
  candidates.push({ x: botX, y: barBottom, dist: Math.hypot(botX - extX, barBottom - extY) });

  // Left edge
  const leftY = Math.max(nodeY, Math.min(barBottom, extY));
  candidates.push({ x: nodeX, y: leftY, dist: Math.hypot(nodeX - extX, leftY - extY) });

  // Right edge
  const rightY = Math.max(nodeY, Math.min(barBottom, extY));
  candidates.push({ x: barRight, y: rightY, dist: Math.hypot(barRight - extX, rightY - extY) });

  candidates.sort((a, b) => a.dist - b.dist);
  return { x: candidates[0].x, y: candidates[0].y };
}

export function StringEdge({
  id,
  source,
  target,
  sourceX: defaultSourceX,
  sourceY: defaultSourceY,
  targetX,
  targetY,
  data,
}: EdgeProps) {
  const label = (data as any)?.label || '';
  const [, forceRender] = useReducer((x: number) => x + 1, 0);

  const sourceNode = useInternalNode(source);

  // Track whether this is the initial mount (for draw-on animation)
  const isInitialRef = useRef(true);
  const pathRef = useRef<SVGPathElement>(null);
  const pathLengthRef = useRef(1000);

  // Determine edge color from the target (explanation) node's active tab
  const targetNode = useInternalNode(target);
  const targetActiveTab = (targetNode?.data as any)?.activeNodeTab as NodeTabKey | undefined;
  const edgeColor = targetActiveTab ? (NODE_TAB_COLORS[targetActiveTab] ?? '#e0e0e0') : '#e0e0e0';

  // Is the target node currently being dragged?
  const targetDragging = targetNode?.dragging ?? false;

  // Cached source point — only recompute when target is NOT being dragged
  const cachedSourceRef = useRef<{ x: number; y: number } | null>(null);

  // Compute the source point: closest point on source node border to the target node center
  let sourceX = defaultSourceX;
  let sourceY = defaultSourceY;

  if (sourceNode) {
    const w = sourceNode.measured?.width ?? (sourceNode as any).width ?? 0;
    const h = sourceNode.measured?.height ?? (sourceNode as any).height ?? 0;
    const nodeAbsX = sourceNode.internals.positionAbsolute.x;
    const nodeAbsY = sourceNode.internals.positionAbsolute.y;

    if (w > 0 && h > 0) {
      if (targetDragging && cachedSourceRef.current) {
        // Freeze source point while target is being dragged
        sourceX = cachedSourceRef.current.x;
        sourceY = cachedSourceRef.current.y;
      } else {
        // Compute nearest point on source node border to the target node's center
        const targetW = targetNode?.measured?.width ?? (targetNode as any)?.width ?? 0;
        const targetH = targetNode?.measured?.height ?? (targetNode as any)?.height ?? 0;
        const tCenterX = targetNode
          ? targetNode.internals.positionAbsolute.x + targetW / 2
          : targetX;
        const tCenterY = targetNode
          ? targetNode.internals.positionAbsolute.y + targetH / 2
          : targetY;

        // True closest point on rectangle perimeter to an external point.
        // Clamp the target center to the source node's bounding box.
        // This works much better than ray-from-center for very tall/wide nodes
        // (e.g., the 10,000px document node) because it doesn't pull the
        // attachment point toward the node center.
        const clampedX = Math.max(nodeAbsX, Math.min(tCenterX, nodeAbsX + w));
        const clampedY = Math.max(nodeAbsY, Math.min(tCenterY, nodeAbsY + h));

        // The clamped point is on the perimeter when the target is outside the
        // source node (the normal case). If somehow both centers overlap,
        // fall back to the right edge at the target's Y.
        if (clampedX > nodeAbsX && clampedX < nodeAbsX + w &&
            clampedY > nodeAbsY && clampedY < nodeAbsY + h) {
          // Target center is inside the source node — snap to right edge
          sourceX = nodeAbsX + w;
          sourceY = clampedY;
        } else {
          sourceX = clampedX;
          sourceY = clampedY;
        }

        // Cache for use during next drag
        cachedSourceRef.current = { x: sourceX, y: sourceY };
      }
    }
  }

  // Override target point: attach to the closest point on the child node's title bar
  let finalTargetX = targetX;
  let finalTargetY = targetY;

  if (targetNode) {
    const tw = targetNode.measured?.width ?? (targetNode as any).width ?? 0;
    const tNodeAbsX = targetNode.internals.positionAbsolute.x;
    const tNodeAbsY = targetNode.internals.positionAbsolute.y;

    if (tw > 0) {
      const pt = closestPointOnTitleBar(tNodeAbsX, tNodeAbsY, tw, sourceX, sourceY);
      finalTargetX = pt.x;
      finalTargetY = pt.y;
    }
  }

  // Physics state in refs for rAF performance
  const controlYRef = useRef<number | null>(null);
  const controlXOffsetRef = useRef(0);
  const velYRef = useRef(0);
  const velXRef = useRef(0);
  const rafRef = useRef<number>();
  const prevSourceRef = useRef({ sourceX, sourceY, targetX: finalTargetX, targetY: finalTargetY });

  // Rest positions
  const midX = (sourceX + finalTargetX) / 2;
  const distance = Math.hypot(finalTargetX - sourceX, finalTargetY - sourceY);
  const droop = Math.min(distance * 0.18, 60);
  const restY = Math.max(sourceY, finalTargetY) + droop;

  // Initialize
  if (controlYRef.current === null) {
    controlYRef.current = restY;
  }

  // Detect endpoint changes and apply impulse
  useEffect(() => {
    const prev = prevSourceRef.current;
    const dSrcY = sourceY - prev.sourceY;
    const dTgtY = finalTargetY - prev.targetY;
    const dSrcX = sourceX - prev.sourceX;
    const dTgtX = finalTargetX - prev.targetX;

    // Impulse proportional to how much the endpoints moved
    if (Math.abs(dSrcY) > 0.5 || Math.abs(dTgtY) > 0.5) {
      velYRef.current += (dSrcY + dTgtY) * 0.2;
    }
    if (Math.abs(dSrcX) > 0.5 || Math.abs(dTgtX) > 0.5) {
      velXRef.current += (dSrcX - dTgtX) * 0.1;
    }

    prevSourceRef.current = { sourceX, sourceY, targetX: finalTargetX, targetY: finalTargetY };
  }, [sourceX, sourceY, finalTargetX, finalTargetY]);

  // Single physics loop
  useEffect(() => {
    let lastTime = performance.now();
    let running = true;

    const simulate = (time: number) => {
      if (!running) return;
      const dt = Math.min((time - lastTime) / 1000, 0.04);
      lastTime = time;

      const curDist = Math.hypot(finalTargetX - sourceX, finalTargetY - sourceY);
      const curDroop = Math.min(curDist * 0.18, 60);
      const curRestY = Math.max(sourceY, finalTargetY) + curDroop;

      if (controlYRef.current === null) controlYRef.current = curRestY;

      // Y spring
      const dispY = controlYRef.current - curRestY;
      velYRef.current += (-STIFFNESS * dispY - DAMPING * velYRef.current) * dt;
      controlYRef.current += velYRef.current * dt;

      // X spring (lateral sway)
      velXRef.current += (-X_STIFFNESS * controlXOffsetRef.current - X_DAMPING * velXRef.current) * dt;
      controlXOffsetRef.current += velXRef.current * dt;

      const isMoving =
        Math.abs(velYRef.current) > 0.03 ||
        Math.abs(dispY) > 0.05 ||
        Math.abs(velXRef.current) > 0.03 ||
        Math.abs(controlXOffsetRef.current) > 0.05;

      if (isMoving) {
        forceRender();
        rafRef.current = requestAnimationFrame(simulate);
      } else {
        // Snap to rest
        controlYRef.current = curRestY;
        controlXOffsetRef.current = 0;
        velYRef.current = 0;
        velXRef.current = 0;
        forceRender();
      }
    };

    rafRef.current = requestAnimationFrame(simulate);

    return () => {
      running = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [sourceX, sourceY, finalTargetX, finalTargetY]);

  const currentControlY = controlYRef.current ?? restY;
  const currentMidX = midX + controlXOffsetRef.current;

  const path = `M ${sourceX} ${sourceY} Q ${currentMidX} ${currentControlY} ${finalTargetX} ${finalTargetY}`;

  // Measure path length on first render for the draw-on animation
  useEffect(() => {
    if (pathRef.current && isInitialRef.current) {
      pathLengthRef.current = pathRef.current.getTotalLength();
      // Force a re-render so the CSS variable is set with the real length
      forceRender();
      // Clear the initial flag after the draw-on animation completes
      const timer = setTimeout(() => {
        isInitialRef.current = false;
        forceRender();
      }, 800); // 150ms delay + 600ms animation
      return () => clearTimeout(timer);
    }
  }, []);

  return (
    <g className="string-edge-group">
      <defs>
        <path id={`string-path-${id}`} d={path} />
      </defs>

      {/* Invisible fat hit area for hover detection */}
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={16}
        strokeLinecap="round"
      />

      {/* String line */}
      <path
        ref={pathRef}
        className={isInitialRef.current ? 'string-edge-line' : undefined}
        d={path}
        fill="none"
        stroke={edgeColor}
        strokeWidth={1.5}
        strokeLinecap="round"
        style={isInitialRef.current ? {
          strokeDasharray: pathLengthRef.current,
          ['--edge-length' as any]: pathLengthRef.current,
        } : undefined}
      />

      {/* Label on string — visible on hover only */}
      {label && (
        <text
          className="string-edge-label"
          fontSize={11}
          fill="#a3a3a3"
          fontWeight={500}
          fontFamily="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
          style={{ userSelect: 'none' }}
        >
          <textPath
            href={`#string-path-${id}`}
            startOffset="50%"
            textAnchor="middle"
          >
            {label}
          </textPath>
        </text>
      )}
    </g>
  );
}