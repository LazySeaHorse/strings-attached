import React from 'react';
import { Handle, Position, NodeResizeControl, type NodeProps } from '@xyflow/react';
import { MoreHorizontal } from 'lucide-react';
import { TextContent } from './TextContent';
import { ResizeGrip } from './ResizeGrip';

export function DocumentNode({ data, id, selected }: NodeProps) {
  const { title, content } = data as { title: string; content: string };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: '#ffffff',
        border: '1px solid #f0f0f0',
        borderRadius: 12,
        boxShadow: '0 2px 8px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.02)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <NodeResizeControl
        minWidth={280}
        minHeight={120}
        position="bottom-right"
        style={{ background: 'transparent', border: 'none' }}
      >
        <ResizeGrip />
      </NodeResizeControl>

      {/* Header */}
      <div
        className="node-drag-handle flex items-center justify-between"
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid #f0f0f0',
          cursor: 'grab',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#171717' }}>
          {title || 'Document'}
        </span>
        <MoreHorizontal size={16} color="#a3a3a3" />
      </div>

      {/* Content */}
      <div
        className="nowheel node-scroll"
        style={{
          padding: 16,
          overflowY: 'auto',
          flex: 1,
          minHeight: 0,
        }}
      >
        <TextContent content={content} nodeId={id} />
      </div>

      <Handle type="source" position={Position.Right} style={{ visibility: 'hidden' }} />
      <Handle type="target" position={Position.Left} style={{ visibility: 'hidden' }} />
    </div>
  );
}
