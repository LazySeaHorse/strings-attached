import React, { useRef, useState, useEffect, useCallback } from 'react';
import { FileText, Clipboard, Upload, X, Loader2, Sparkles, AlertTriangle } from 'lucide-react';
import { useDocumentStore, INITIAL_CONTENT } from './stores';
import { buildDocumentFromFile } from './utils/fileUtils';
import { toast } from 'sonner';

export function EmptyState() {
  const { addDocument } = useDocumentStore();
  const [showPasteArea, setShowPasteArea] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showUploadPicker, setShowUploadPicker] = useState(false);
  const uploadPickerRef = useRef<HTMLDivElement>(null);

  const loadContent = useCallback(
    (text: string, title?: string) => {
      if (text.trim()) {
        addDocument({
          id: crypto.randomUUID(),
          type: 'markdown',
          content: text.trim(),
          title: title || 'Pasted Document',
        });
        toast.success('Document opened');
      }
    },
    [addDocument]
  );

  // Global paste
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (showPasteArea && document.activeElement === textareaRef.current) return;
      const text = e.clipboardData?.getData('text/plain');
      if (text && text.trim()) {
        e.preventDefault();
        loadContent(text);
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [loadContent, showPasteArea]);

  useEffect(() => {
    if (showPasteArea && textareaRef.current) textareaRef.current.focus();
  }, [showPasteArea]);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setPdfLoading(true);
    try {
      const doc = await buildDocumentFromFile(file);
      addDocument(doc);
      toast.success(`Opened "${doc.title || 'Document'}"`);
    } catch (err: any) {
      const msg = err?.message || 'Failed to load file.';
      setError(msg);
      toast.error(msg);
    } finally {
      setPdfLoading(false);
    }
  }, [addDocument]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) await handleFile(file);
  }, [handleFile]);

  const handleInputChange = (ref: React.RefObject<HTMLInputElement | null>) =>
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) await handleFile(file);
      if (ref.current) ref.current.value = '';
    };

  const handleLoadSample = () => {
    addDocument({
      id: crypto.randomUUID(),
      type: 'markdown',
      content: INITIAL_CONTENT,
      title: 'Sample Document',
    });
    toast.success('Sample document loaded');
  };

  // Close upload picker on outside click
  useEffect(() => {
    if (!showUploadPicker) return;
    const handleClick = (e: MouseEvent) => {
      if (uploadPickerRef.current && !uploadPickerRef.current.contains(e.target as Node)) {
        setShowUploadPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showUploadPicker]);

  return (
    <div
      className="flex-1 flex items-center justify-center"
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={(e) => { e.preventDefault(); setDragOver(false); }}
      onDrop={handleDrop}
      style={{ position: 'relative', background: '#fafafa' }}
    >
      {/* Drop overlay */}
      {dragOver && (
        <div
          style={{
            position: 'absolute',
            inset: 16,
            background: 'rgba(59, 130, 246, 0.03)',
            border: '2px dashed rgba(59, 130, 246, 0.25)',
            borderRadius: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
          }}
        >
          <div className="flex flex-col items-center gap-2">
            <Upload size={28} color="#3b82f6" strokeWidth={1.5} />
            <p style={{ fontSize: '0.875rem', fontWeight: 500, color: '#3b82f6' }}>
              Drop your file here
            </p>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.md,.txt,application/pdf,text/plain,text/markdown"
        onChange={handleInputChange(fileInputRef)}
        style={{ display: 'none' }}
      />

      <input
        ref={pdfInputRef}
        type="file"
        accept=".pdf,application/pdf"
        onChange={handleInputChange(pdfInputRef)}
        style={{ display: 'none' }}
      />

      <div className="flex flex-col items-center gap-8" style={{ maxWidth: 440, width: '100%', padding: '0 24px' }}>
        {pdfLoading ? (
          <div className="flex flex-col items-center gap-4">
            <Loader2 size={28} color="#a3a3a3" className="animate-spin" />
            <p style={{ fontSize: '0.8125rem', color: '#a3a3a3' }}>Loading PDF...</p>
          </div>
        ) : !showPasteArea ? (
          <>
            {/* Icon */}
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 14,
                background: '#f5f5f5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FileText size={24} color="#a3a3a3" strokeWidth={1.5} />
            </div>

            {/* Text */}
            <div className="flex flex-col items-center gap-1.5">
              <p style={{ fontSize: '1rem', fontWeight: 500, color: '#404040' }}>
                Open a document to get started
              </p>
              <p style={{ fontSize: '0.8125rem', color: '#a3a3a3', textAlign: 'center', lineHeight: 1.5 }}>
                Paste text with{' '}
                <kbd style={{
                  padding: '1px 5px',
                  borderRadius: 4,
                  border: '1px solid #e5e5e5',
                  background: '#f5f5f5',
                  fontSize: '0.7rem',
                  fontFamily: 'monospace',
                }}>Cmd+V</kbd>
                , drag & drop a file, or upload one
              </p>
            </div>

            {error && (
              <div
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#b91c1c',
                  fontSize: '0.8125rem',
                }}
              >
                {error}
              </div>
            )}

            {/* Buttons */}
            <div className="flex items-center gap-2.5">
              <ActionButton onClick={() => { setShowPasteArea(true); setError(null); }}>
                <Clipboard size={14} />
                Paste Text
              </ActionButton>
              <div ref={uploadPickerRef} style={{ position: 'relative' }}>
                <ActionButton onClick={() => { setShowUploadPicker(!showUploadPicker); setError(null); }}>
                  <Upload size={14} />
                  Upload File
                </ActionButton>
                {showUploadPicker && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 6px)',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: '#ffffff',
                      borderRadius: 10,
                      boxShadow: '0 4px 20px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)',
                      padding: 6,
                      zIndex: 50,
                      minWidth: 200,
                    }}
                  >
                    <button
                      onClick={() => {
                        fileInputRef.current!.accept = '.md,.txt,text/plain,text/markdown';
                        fileInputRef.current?.click();
                        setShowUploadPicker(false);
                      }}
                      className="cursor-pointer flex items-center gap-2.5 w-full"
                      style={{
                        padding: '8px 12px',
                        borderRadius: 7,
                        border: 'none',
                        background: 'transparent',
                        color: '#404040',
                        fontSize: '0.8125rem',
                        fontWeight: 500,
                        textAlign: 'left',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#f5f5f5'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <FileText size={14} color="#525252" />
                      <span>Markdown</span>
                      <span style={{ marginLeft: 'auto', fontSize: '0.6875rem', color: '#a3a3a3' }}>.md .txt</span>
                    </button>
                    <button
                      onClick={() => {
                        pdfInputRef.current?.click();
                        setShowUploadPicker(false);
                      }}
                      className="cursor-pointer flex items-center gap-2.5 w-full"
                      style={{
                        padding: '8px 12px',
                        borderRadius: 7,
                        border: 'none',
                        background: 'transparent',
                        color: '#404040',
                        fontSize: '0.8125rem',
                        fontWeight: 500,
                        textAlign: 'left',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#f5f5f5'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <FileText size={14} color="#525252" />
                      <span>PDF</span>
                      <span style={{ marginLeft: 'auto', fontSize: '0.6875rem', color: '#a3a3a3' }}>.pdf</span>
                    </button>
                    <div
                      style={{
                        margin: '4px 12px',
                        padding: '6px 0',
                        borderTop: '1px solid #f0f0f0',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                      }}
                    >
                      <AlertTriangle size={11} color="#d97706" />
                      <span style={{ fontSize: '0.6875rem', color: '#a3a3a3' }}>
                        PDF support is experimental
                      </span>
                    </div>
                  </div>
                )}
              </div>
              <ActionButton onClick={handleLoadSample} accent>
                <Sparkles size={14} />
                Try Sample
              </ActionButton>
            </div>
          </>
        ) : (
          /* Paste area */
          <div className="w-full flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p style={{ fontSize: '0.875rem', fontWeight: 500, color: '#404040' }}>
                Paste your text
              </p>
              <button
                onClick={() => { setShowPasteArea(false); setPasteText(''); }}
                className="cursor-pointer flex items-center justify-center"
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 6,
                  border: 'none',
                  background: 'transparent',
                  color: '#a3a3a3',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#f5f5f5'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <X size={14} />
              </button>
            </div>
            <textarea
              ref={textareaRef}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="Cmd+V to paste your text here..."
              style={{
                width: '100%',
                minHeight: 160,
                padding: 14,
                borderRadius: 10,
                border: '1px solid #e5e5e5',
                background: '#ffffff',
                color: '#262626',
                fontSize: '0.875rem',
                lineHeight: 1.6,
                resize: 'vertical',
                outline: 'none',
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#3b82f6'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = '#e5e5e5'; }}
            />
            <div className="flex items-center gap-2.5 justify-end">
              <button
                onClick={() => { setShowPasteArea(false); setPasteText(''); }}
                className="cursor-pointer"
                style={{
                  padding: '7px 14px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'transparent',
                  color: '#a3a3a3',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => { if (pasteText.trim()) loadContent(pasteText); }}
                disabled={!pasteText.trim()}
                className="cursor-pointer"
                style={{
                  padding: '7px 16px',
                  borderRadius: 8,
                  border: 'none',
                  background: pasteText.trim() ? '#171717' : '#e5e5e5',
                  color: pasteText.trim() ? '#ffffff' : '#a3a3a3',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  transition: 'all 100ms ease',
                }}
              >
                Open Document
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  accent,
}: {
  children: React.ReactNode;
  onClick: () => void;
  accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="cursor-pointer flex items-center gap-1.5 transition-all duration-100"
      style={{
        padding: '8px 14px',
        borderRadius: 8,
        border: accent ? '1px solid transparent' : '1px solid #e5e5e5',
        background: accent ? '#171717' : '#ffffff',
        color: accent ? '#ffffff' : '#525252',
        fontSize: '0.8125rem',
        fontWeight: 500,
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
      }}
      onMouseEnter={(e) => {
        if (accent) {
          e.currentTarget.style.background = '#404040';
        } else {
          e.currentTarget.style.background = '#fafafa';
          e.currentTarget.style.borderColor = '#d4d4d4';
        }
      }}
      onMouseLeave={(e) => {
        if (accent) {
          e.currentTarget.style.background = '#171717';
        } else {
          e.currentTarget.style.background = '#ffffff';
          e.currentTarget.style.borderColor = '#e5e5e5';
        }
      }}
    >
      {children}
    </button>
  );
}