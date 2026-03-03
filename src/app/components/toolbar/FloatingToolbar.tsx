import React from 'react';
import { MousePointer2, Highlighter, Search, Hand, ZoomIn, ZoomOut, Maximize2, Trash2, MessageSquarePlus } from 'lucide-react';
import { useAppStore, useDocumentStore, useCanvasStore, HIGHLIGHT_COLORS, type HighlightColor } from '../stores';
import type { Node } from '@xyflow/react';

const EMPTY_NODES: Node[] = [];

interface ToolDef {
  id: string;
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  isActive?: boolean;
  dividerAfter?: boolean;
}

export function FloatingToolbar() {
  const mode = useAppStore((s) => s.mode);
  return mode === 'classic' ? <ClassicToolbar /> : <CanvasToolbar />;
}

function ClassicToolbar() {
  const activeTool = useAppStore((s) => s.activeTool);
  const setActiveTool = useAppStore((s) => s.setActiveTool);
  const highlightColor = useAppStore((s) => s.highlightColor);
  const setHighlightColor = useAppStore((s) => s.setHighlightColor);
  const zoom = useAppStore((s) => s.zoom);
  const zoomIn = useAppStore((s) => s.zoomIn);
  const zoomOut = useAppStore((s) => s.zoomOut);
  const resetZoom = useAppStore((s) => s.resetZoom);
  const searchOpen = useAppStore((s) => s.searchOpen);
  const setSearchOpen = useAppStore((s) => s.setSearchOpen);

  const isHighlightMode = activeTool === 'highlight';

  const tools: ToolDef[] = [
    {
      id: 'select',
      icon: <MousePointer2 size={15} />,
      label: 'Select (V)',
      isActive: activeTool === 'select',
      onClick: () => setActiveTool('select'),
    },
    {
      id: 'highlight',
      icon: (
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Highlighter size={15} />
          {/* Color indicator dot under icon */}
          <div
            style={{
              position: 'absolute',
              bottom: -4,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 8,
              height: 3,
              borderRadius: 2,
              background: highlightColor,
              transition: 'background 100ms',
            }}
          />
        </div>
      ),
      label: 'Highlight (H)',
      isActive: isHighlightMode,
      onClick: () => setActiveTool(isHighlightMode ? 'select' : 'highlight'),
    },
    {
      id: 'annotate',
      icon: <MessageSquarePlus size={15} />,
      label: 'Annotate (A)',
      isActive: activeTool === 'annotate',
      onClick: () => setActiveTool(activeTool === 'annotate' ? 'select' : 'annotate'),
      dividerAfter: !isHighlightMode,
    },
    {
      id: 'search',
      icon: <Search size={15} />,
      label: 'Find (Cmd+F)',
      isActive: searchOpen,
      onClick: () => setSearchOpen(!searchOpen),
      dividerAfter: true,
    },
    {
      id: 'zoom-out',
      icon: <ZoomOut size={15} />,
      label: 'Zoom out',
      onClick: zoomOut,
    },
    {
      id: 'zoom-label',
      icon: null, // handled separately
      label: 'Reset zoom',
      onClick: resetZoom,
    },
    {
      id: 'zoom-in',
      icon: <ZoomIn size={15} />,
      label: 'Zoom in',
      onClick: zoomIn,
    },
  ];

  return (
    <ToolbarShell>
      {tools.map((tool) => (
        <div key={tool.id} style={{ display: 'contents' }}>
          {tool.id === 'zoom-label' ? (
            <span
              onClick={tool.onClick}
              className="cursor-pointer"
              title={tool.label}
              style={{
                fontSize: '0.6875rem',
                fontWeight: 500,
                color: '#737373',
                minWidth: 36,
                textAlign: 'center',
                userSelect: 'none',
                padding: '4px 0',
              }}
            >
              {Math.round(zoom * 100)}%
            </span>
          ) : (
            <ToolbarButton
              icon={tool.icon}
              label={tool.label}
              isActive={tool.isActive}
              onClick={tool.onClick}
            />
          )}

          {/* Inline color picker — appears right after the highlight button */}
          {tool.id === 'highlight' && isHighlightMode && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '0 2px' }}>
                {HIGHLIGHT_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setHighlightColor(color)}
                    className="cursor-pointer"
                    title={`Highlight color`}
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 5,
                      background: color,
                      border: highlightColor === color ? '2px solid #3b82f6' : '2px solid transparent',
                      transition: 'border-color 100ms, transform 100ms',
                      transform: highlightColor === color ? 'scale(1.1)' : 'scale(1)',
                      flexShrink: 0,
                    }}
                  />
                ))}
              </div>
              <ToolbarDivider />
            </>
          )}

          {tool.dividerAfter && <ToolbarDivider />}
        </div>
      ))}
    </ToolbarShell>
  );
}

function CanvasToolbar() {
  const activeTool = useAppStore((s) => s.activeTool);
  const setActiveTool = useAppStore((s) => s.setActiveTool);
  const searchOpen = useAppStore((s) => s.searchOpen);
  const setSearchOpen = useAppStore((s) => s.setSearchOpen);
  const activeTabId = useDocumentStore((s) => s.activeTabId);
  const clearExplanations = useCanvasStore((s) => s.clearExplanations);
  const nodes = useCanvasStore((s) => activeTabId ? (s.canvasMap[activeTabId]?.nodes ?? EMPTY_NODES) : EMPTY_NODES);
  const hasExplanations = nodes.some((n) => n.type === 'explanation');

  const tools: ToolDef[] = [
    {
      id: 'select',
      icon: <MousePointer2 size={15} />,
      label: 'Select (V)',
      isActive: activeTool === 'select',
      onClick: () => setActiveTool('select'),
    },
    {
      id: 'pan',
      icon: <Hand size={15} />,
      label: 'Pan (Space+Drag)',
      isActive: activeTool === 'pan',
      onClick: () => setActiveTool('pan'),
      dividerAfter: true,
    },
    {
      id: 'search',
      icon: <Search size={15} />,
      label: 'Find (Cmd+F)',
      isActive: searchOpen,
      onClick: () => setSearchOpen(!searchOpen),
      dividerAfter: true,
    },
    {
      id: 'fit',
      icon: <Maximize2 size={15} />,
      label: 'Fit view',
      onClick: () => {
        window.dispatchEvent(new CustomEvent('fitView'));
      },
    },
  ];

  if (hasExplanations && activeTabId) {
    tools.push({
      id: 'clear',
      icon: <Trash2 size={15} />,
      label: 'Clear explanations',
      onClick: () => {
        clearExplanations(activeTabId);
        useDocumentStore.getState().clearPulledWords(activeTabId);
      },
    });
  }

  const explanationCount = nodes.filter((n) => n.type === 'explanation').length;

  return (
    <ToolbarShell>
      {tools.map((tool) => (
        <div key={tool.id} style={{ display: 'contents' }}>
          <ToolbarButton
            icon={tool.icon}
            label={tool.label}
            isActive={tool.isActive}
            onClick={tool.onClick}
          />
          {tool.dividerAfter && <ToolbarDivider />}
        </div>
      ))}
      {explanationCount > 0 && (
        <>
          <ToolbarDivider />
          <span
            style={{
              fontSize: '0.6875rem',
              fontWeight: 500,
              color: '#3b82f6',
              background: '#eff6ff',
              padding: '2px 8px',
              borderRadius: 9999,
              whiteSpace: 'nowrap',
              userSelect: 'none',
            }}
          >
            {explanationCount} {explanationCount === 1 ? 'string' : 'strings'}
          </span>
        </>
      )}
    </ToolbarShell>
  );
}

function ToolbarShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 40,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        padding: '4px 6px',
        background: '#ffffff',
        borderRadius: 12,
        boxShadow: '0 2px 12px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)',
      }}
    >
      {children}
    </div>
  );
}

function ToolbarButton({
  icon,
  label,
  isActive,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  isActive?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className="cursor-pointer flex items-center justify-center transition-all duration-100"
      style={{
        width: 32,
        height: 32,
        borderRadius: 8,
        border: 'none',
        background: isActive ? '#f0f7ff' : 'transparent',
        color: isActive ? '#3b82f6' : '#737373',
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = '#f5f5f5';
          e.currentTarget.style.color = '#404040';
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = '#737373';
        }
      }}
    >
      {icon}
    </button>
  );
}

function ToolbarDivider() {
  return (
    <div
      style={{
        width: 1,
        height: 18,
        background: '#f0f0f0',
        margin: '0 3px',
        flexShrink: 0,
      }}
    />
  );
}