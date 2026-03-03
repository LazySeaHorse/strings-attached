import React from 'react';

/**
 * A subtle bottom-right resize grip indicator.
 * Rendered as the child of NodeResizeControl so it appears
 * at the corner and the control handles the actual drag logic.
 */
export function ResizeGrip() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      style={{
        position: 'absolute',
        right: 2,
        bottom: 2,
        cursor: 'nwse-resize',
        opacity: 0.35,
        transition: 'opacity 150ms ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.opacity = '0.7';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.opacity = '0.35';
      }}
    >
      {/* Three diagonal lines forming a grip pattern */}
      <line x1="11" y1="3" x2="3" y2="11" stroke="#737373" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="11" y1="7" x2="7" y2="11" stroke="#737373" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="11" y1="11" x2="11" y2="11" stroke="#737373" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
