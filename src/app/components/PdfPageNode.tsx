import React from 'react';
import { Handle, Position, NodeResizeControl, type NodeProps } from '@xyflow/react';
import { FileText } from 'lucide-react';
import { PdfPageContent } from './PdfContent';
import { ResizeGrip } from './ResizeGrip';

/**
 * A canvas node representing a single PDF page.
 * Each page of the PDF gets its own node.
 */
export function PdfPageNode({ data, id, selected }: NodeProps) {
  const { title, pdfDataUrl, pageNum, totalPages } = data as {
    title: string;
    pdfDataUrl: string;
    pageNum: number;
    totalPages: number;
  };

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
          padding: '10px 16px',
          borderBottom: '1px solid #f0f0f0',
          cursor: 'grab',
          flexShrink: 0,
        }}
      >
        <div className="flex items-center gap-2">
          <FileText size={14} color="#a3a3a3" />
          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#171717' }}>
            {title || 'PDF'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            style={{
              fontSize: '0.6875rem',
              fontWeight: 500,
              color: '#737373',
              background: '#f5f5f5',
              padding: '2px 8px',
              borderRadius: 4,
            }}
          >
            Page {pageNum}{totalPages > 1 ? ` / ${totalPages}` : ''}
          </span>
        </div>
      </div>

      {/* PDF Page Content */}
      <div
        className="nowheel node-scroll"
        style={{
          overflowY: 'auto',
          flex: 1,
          minHeight: 0,
          padding: 8,
        }}
      >
        {pdfDataUrl ? (
          <PdfPageContent pdfDataUrl={pdfDataUrl} pageNum={pageNum} nodeId={id} />
        ) : (
          <div
            className="flex items-center justify-center"
            style={{ height: '100%', color: '#a3a3a3', fontSize: '0.875rem' }}
          >
            PDF data not available. Re-upload the file.
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Right} style={{ visibility: 'hidden' }} />
      <Handle type="target" position={Position.Left} style={{ visibility: 'hidden' }} />
    </div>
  );
}
