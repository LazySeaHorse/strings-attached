import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useDocumentStore, useAppStore, useCanvasStore, type Annotation } from '../stores';
import { TextContent } from '../TextContent';
import { PdfContent } from '../PdfContent';
import { useSearch } from '../hooks/useSearch';
import { MessageSquare, Trash2, Upload, FileText, ArrowUp, Copy, PanelRightClose, PanelRightOpen, ChevronsDownUp, ChevronsUpDown, ArrowDownUp, ClipboardCopy } from 'lucide-react';
import { loadPdfDocument } from '../pdfUtils';
import { readFileAsDataUrl } from '../utils/fileUtils';
import { toast } from 'sonner';
import { NotesEditor } from '../NotesEditor';
import { spawnExplanationNode, computeSpawnPosition } from '../utils/canvasUtils';

// Stable empty arrays to prevent unnecessary re-renders
const EMPTY_HIGHLIGHTS: any[] = [];
const EMPTY_ANNOTATIONS: Annotation[] = [];

export function ClassicView() {
  const activeTabId = useDocumentStore((s) => s.activeTabId);
  const activeDocument = useDocumentStore((s) => {
    const tab = s.tabs.find((t) => t.id === s.activeTabId);
    return tab?.document ?? null;
  });
  const highlights = useDocumentStore((s) => {
    const tab = s.tabs.find((t) => t.id === s.activeTabId);
    return tab?.highlights ?? EMPTY_HIGHLIGHTS;
  });
  const annotations = useDocumentStore((s) => {
    const tab = s.tabs.find((t) => t.id === s.activeTabId);
    return tab?.annotations ?? EMPTY_ANNOTATIONS;
  });

  // Granular app-store selectors to avoid re-rendering on unrelated changes
  const zoom = useAppStore((s) => s.zoom);
  const activeTool = useAppStore((s) => s.activeTool);
  const jumpToWordIndex = useAppStore((s) => s.jumpToWordIndex);
  const setJumpToWordIndex = useAppStore((s) => s.setJumpToWordIndex);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollYRef = useRef(0);
  const prevTabIdRef = useRef(activeTabId);

  const search = useSearch(activeDocument?.content || '');

  useEffect(() => {
    const store = useDocumentStore.getState();
    if (prevTabIdRef.current && prevTabIdRef.current !== activeTabId) {
      store.updateScrollY(prevTabIdRef.current, scrollYRef.current);
    }
    prevTabIdRef.current = activeTabId;
    const tab = store.tabs.find((t) => t.id === activeTabId);
    const savedY = tab?.scrollY ?? 0;
    scrollYRef.current = savedY;
    if (scrollRef.current) {
      scrollRef.current.scrollTop = savedY;
    }
  }, [activeTabId]);

  useEffect(() => {
    return () => {
      const tabId = prevTabIdRef.current;
      if (tabId) {
        useDocumentStore.getState().updateScrollY(tabId, scrollYRef.current);
      }
    };
  }, []);

  const [readingProgress, setReadingProgress] = useState(0);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sortMode, setSortMode] = useState<'position' | 'time'>('position');
  const [allCollapsed, setAllCollapsed] = useState(false);

  const handleScroll = useCallback(() => {
    if (scrollRef.current) {
      scrollYRef.current = scrollRef.current.scrollTop;
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      const maxScroll = scrollHeight - clientHeight;
      setReadingProgress(maxScroll > 0 ? Math.min(1, scrollTop / maxScroll) : 0);
      setShowScrollTop(scrollTop > 400);
    }
  }, []);

  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleCopyHighlights = useCallback(() => {
    if (highlights.length === 0) return;
    const text = highlights.map((hl) => hl.text).join('\n');
    navigator.clipboard.writeText(text);
    toast.success(`${highlights.length} highlight${highlights.length > 1 ? 's' : ''} copied`);
  }, [highlights]);

  const handleTitleSave = useCallback(() => {
    setEditingTitle(false);
    if (!activeTabId || !titleDraft.trim()) return;
    const store = useDocumentStore.getState();
    store.loadWorkspace(
      store.tabs.map((t) =>
        t.id === activeTabId
          ? { ...t, document: { ...t.document, title: titleDraft.trim() } }
          : t
      ),
      store.activeTabId,
    );
  }, [activeTabId, titleDraft]);

  useEffect(() => {
    if (editingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [editingTitle]);

  // ─── Jump to source word (triggered by ExplanationNode → "Jump to reader") ──
  useEffect(() => {
    if (jumpToWordIndex === null || !scrollRef.current) return;

    // Clear immediately so we don't re-trigger
    const idx = jumpToWordIndex;
    setJumpToWordIndex(null);

    // Wait a frame for the DOM to be ready after mode switch
    requestAnimationFrame(() => {
      const container = scrollRef.current;
      if (!container) return;
      const wordEl = container.querySelector<HTMLElement>(`.word[data-word-index="${idx}"]`);
      if (!wordEl) return;

      wordEl.scrollIntoView({ block: 'center', behavior: 'smooth' });

      // Brief highlight flash
      const origBg = wordEl.style.background;
      wordEl.style.background = 'rgba(59, 130, 246, 0.25)';
      wordEl.style.transition = 'background 300ms ease';
      setTimeout(() => {
        wordEl.style.background = 'rgba(59, 130, 246, 0.12)';
        setTimeout(() => {
          wordEl.style.background = origBg;
        }, 800);
      }, 600);
    });
  }, [jumpToWordIndex, setJumpToWordIndex]);

  // ─── Global search navigation (document text + annotation results) ──────
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail) return;

      if (detail.type === 'document' && detail.query) {
        // Set the in-document search to highlight the match
        search.setQuery(detail.query);
        // Scroll to the approximate position using the char offset
        // We use a short delay to let the search highlighting render
        setTimeout(() => {
          if (!scrollRef.current) return;
          const marks = scrollRef.current.querySelectorAll<HTMLElement>('.search-match');
          if (marks.length > 0) {
            // Find the mark closest to our charOffset if possible
            marks[0].scrollIntoView({ block: 'center', behavior: 'smooth' });
          }
        }, 100);
      } else if (detail.type === 'annotation' && detail.annotationId) {
        // Open sidebar and scroll to the annotation card
        setSidebarOpen(true);
        setTimeout(() => {
          const card = document.querySelector?.(`[data-annotation-id="${detail.annotationId}"]`);
          if (card) {
            card.scrollIntoView({ block: 'center', behavior: 'smooth' });
            // Flash highlight
            (card as HTMLElement).style.boxShadow = '0 0 0 2px #3b82f6';
            setTimeout(() => {
              (card as HTMLElement).style.boxShadow = '';
            }, 1500);
          }
        }, 100);
      }
    };
    window.addEventListener('globalSearchNavigate', handler);
    return () => window.removeEventListener('globalSearchNavigate', handler);
  }, [search]);

  // ─── Annotate mode: text-based annotation + canvas node ──────────
  const handleAnnotate = useCallback(
    (data: { text: string; wordIndices: number[]; sourceType: 'word' | 'sentence' }) => {
      if (!activeTabId) return;

      const scrollY = scrollYRef.current;
      const annId = `ann-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      // 1) Create annotation in sidebar
      useDocumentStore.getState().addAnnotation(activeTabId, {
        id: annId,
        scrollY,
        text: '',
        createdAt: Date.now(),
      });

      // 2) Auto-open sidebar
      setSidebarOpen(true);

      // 3) Spawn explanation node in canvas (without switching views)
      const position = computeSpawnPosition(activeTabId, activeTabId);
      const spawnedNodeId = spawnExplanationNode(
        activeTabId,
        activeTabId,
        data.text,
        data.sourceType,
        data.wordIndices,
        position,
        undefined,  // sourceAnchor
        'notes',    // default to notes tab (green)
      );

      // 4) Toast with undo action — reverts annotation, canvas node, and pulled words
      const tabId = activeTabId;
      const wordIndices = data.wordIndices;
      toast('Note created', {
        action: {
          label: 'Undo',
          onClick: () => {
            useDocumentStore.getState().removeAnnotation(tabId, annId);
            useCanvasStore.getState().setNodes(tabId, (nds) => nds.filter((n) => n.id !== spawnedNodeId));
            useCanvasStore.getState().setEdges(tabId, (eds) =>
              eds.filter((e) => e.source !== spawnedNodeId && e.target !== spawnedNodeId)
            );
            if (wordIndices.length > 0) {
              useDocumentStore.getState().removePulledWords(tabId, wordIndices);
            }
          },
        },
        duration: 4000,
      });
    },
    [activeTabId],
  );

  // ─── PDF re-upload ──────────────────────────────────────────────
  const handlePdfReupload = useCallback(async () => {
    if (!activeTabId) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const dataUrl = await readFileAsDataUrl(file);
        const pdfDoc = await loadPdfDocument(dataUrl);
        const numPages = pdfDoc.numPages;
        useDocumentStore.getState().restorePdfData(activeTabId, dataUrl, numPages);
        toast.success('PDF restored');
      } catch {
        toast.error('Failed to load PDF');
      }
    };
    input.click();
  }, [activeTabId]);

  // ─── Export annotations as markdown ─────────────────────────────
  const handleExportAnnotations = useCallback(() => {
    if (annotations.length === 0) return;
    const title = activeDocument?.title || 'Document';
    const lines = [`# Annotations: ${title}`, ''];
    annotations.forEach((ann, i) => {
      lines.push(`## Note ${i + 1}`);
      if (ann.text.trim()) {
        lines.push('', ann.text.trim());
      }
      if (ann.latex) {
        lines.push('', `$$${ann.latex}$$`);
      }
      lines.push('');
    });
    const md = lines.join('\n');
    navigator.clipboard.writeText(md);
    toast.success(`${annotations.length} annotation${annotations.length > 1 ? 's' : ''} exported to clipboard`);
  }, [annotations, activeDocument?.title]);

  if (!activeDocument) return null;

  const isPdf = activeDocument.type === 'pdf' && activeDocument.pdfDataUrl;
  const isPdfMissing = activeDocument.type === 'pdf' && !activeDocument.pdfDataUrl;
  const showSidebar = sidebarOpen && (annotations.length > 0 || activeTool === 'annotate');

  // Sorted annotations
  const sortedAnnotations = [...annotations].sort((a, b) =>
    sortMode === 'position' ? a.scrollY - b.scrollY : a.createdAt - b.createdAt
  );

  return (
    <div className="flex-1 overflow-hidden relative" style={{ position: 'relative' }}>
      {/* Reading progress bar */}
      <div
        className="reading-progress-bar"
        style={{ width: `${readingProgress * 100}%` }}
      />

      {/* Highlights summary strip */}
      {highlights.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            zIndex: 15,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 10px',
            background: 'rgba(255,255,255,0.9)',
            borderBottomLeftRadius: 8,
            borderLeft: '1px solid #f0f0f0',
            borderBottom: '1px solid #f0f0f0',
          }}
        >
          {highlights.slice(0, 8).map((hl) => (
            <div
              key={hl.id}
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: hl.color,
                border: '1px solid rgba(0,0,0,0.06)',
              }}
            />
          ))}
          {highlights.length > 8 && (
            <span style={{ fontSize: '0.625rem', color: '#a3a3a3' }}>
              +{highlights.length - 8}
            </span>
          )}
          <button
            onClick={handleCopyHighlights}
            className="cursor-pointer flex items-center justify-center"
            title="Copy all highlights"
            style={{
              width: 20,
              height: 20,
              borderRadius: 4,
              border: 'none',
              background: 'transparent',
              color: '#a3a3a3',
              marginLeft: 2,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#f5f5f5'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <Copy size={11} />
          </button>
        </div>
      )}

      <div className="flex h-full">
        {/* ─── Main reading pane ───────────────────────────────────── */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto"
          style={{
            scrollBehavior: 'smooth',
          }}
        >
          <div
            style={{
              maxWidth: 720,
              margin: '0 auto',
              padding: '48px 32px 120px',
              transform: `scale(${zoom})`,
              transformOrigin: 'top center',
            }}
          >
            {/* Title */}
            <div style={{ marginBottom: 32 }}>
              {editingTitle ? (
                <input
                  ref={titleInputRef}
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onBlur={handleTitleSave}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleTitleSave();
                    if (e.key === 'Escape') setEditingTitle(false);
                  }}
                  style={{
                    width: '100%',
                    fontSize: '1.75rem',
                    fontWeight: 700,
                    color: '#171717',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: '2px solid #3b82f6',
                    outline: 'none',
                    padding: '4px 0',
                  }}
                />
              ) : (
                <h1
                  onClick={() => {
                    setEditingTitle(true);
                    setTitleDraft(activeDocument.title || 'Untitled');
                  }}
                  className="cursor-pointer"
                  title="Click to rename"
                  style={{
                    fontSize: '1.75rem',
                    fontWeight: 700,
                    color: '#171717',
                    lineHeight: 1.3,
                    margin: 0,
                  }}
                >
                  {activeDocument.title || 'Untitled'}
                </h1>
              )}
            </div>

            {/* Content */}
            {isPdf ? (
              <PdfContent pdfDataUrl={activeDocument.pdfDataUrl!} nodeId={activeTabId!} />
            ) : isPdfMissing ? (
              <div className="flex flex-col items-center gap-4 py-16">
                <FileText size={40} color="#d4d4d4" strokeWidth={1.5} />
                <p style={{ fontSize: '0.875rem', color: '#737373', textAlign: 'center' }}>
                  PDF data was lost (too large for local storage).
                </p>
                <button
                  onClick={handlePdfReupload}
                  className="cursor-pointer flex items-center gap-2"
                  style={{
                    padding: '8px 16px',
                    borderRadius: 8,
                    border: '1px solid #e5e5e5',
                    background: '#ffffff',
                    color: '#171717',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                  }}
                >
                  <Upload size={14} />
                  Re-upload PDF
                </button>
              </div>
            ) : (
              <TextContent
                content={activeDocument.content}
                nodeId={activeTabId!}
                searchQuery={search.query.length >= 2 ? search.query : undefined}
                searchMatchIdx={search.currentMatchIdx}
                onAnnotate={handleAnnotate}
              />
            )}
          </div>
        </div>

        {/* ─── Annotation sidebar ──────────────────────────────────── */}
        {showSidebar && (
          <div
            style={{
              width: 320,
              borderLeft: '1px solid #f0f0f0',
              background: '#fafafa',
              display: 'flex',
              flexDirection: 'column',
              flexShrink: 0,
            }}
          >
            {/* Sidebar header */}
            <div
              className="flex items-center justify-between"
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid #f0f0f0',
                flexShrink: 0,
              }}
            >
              <div className="flex items-center gap-2">
                <MessageSquare size={14} color="#737373" />
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#404040' }}>
                  Notes ({annotations.length})
                </span>
              </div>
              <div className="flex items-center gap-1">
                {/* Sort toggle */}
                <button
                  onClick={() => setSortMode((m) => (m === 'position' ? 'time' : 'position'))}
                  className="cursor-pointer flex items-center justify-center"
                  title={sortMode === 'position' ? 'Sorted by position' : 'Sorted by time'}
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 5,
                    border: 'none',
                    background: 'transparent',
                    color: '#a3a3a3',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#f0f0f0'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <ArrowDownUp size={12} />
                </button>
                {/* Collapse/expand all */}
                {annotations.length > 1 && (
                  <button
                    onClick={() => setAllCollapsed((c) => !c)}
                    className="cursor-pointer flex items-center justify-center"
                    title={allCollapsed ? 'Expand all' : 'Collapse all'}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 5,
                      border: 'none',
                      background: 'transparent',
                      color: '#a3a3a3',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#f0f0f0'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    {allCollapsed ? <ChevronsUpDown size={12} /> : <ChevronsDownUp size={12} />}
                  </button>
                )}
                {/* Export */}
                {annotations.length > 0 && (
                  <button
                    onClick={handleExportAnnotations}
                    className="cursor-pointer flex items-center justify-center"
                    title="Export annotations as markdown"
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 5,
                      border: 'none',
                      background: 'transparent',
                      color: '#a3a3a3',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#f0f0f0'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <ClipboardCopy size={12} />
                  </button>
                )}
                {/* Close */}
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="cursor-pointer flex items-center justify-center"
                  title="Close sidebar"
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 5,
                    border: 'none',
                    background: 'transparent',
                    color: '#a3a3a3',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#f0f0f0'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <PanelRightClose size={13} />
                </button>
              </div>
            </div>

            {/* Sidebar body */}
            <div className="flex-1 overflow-y-auto" style={{ padding: '8px 0' }}>
              {annotations.length === 0 && activeTool === 'annotate' && (
                <div style={{ padding: '24px 16px', textAlign: 'center' }}>
                  <p style={{ fontSize: '0.8125rem', color: '#a3a3a3', lineHeight: 1.5 }}>
                    Click a word, sentence, or drag to select text to create annotations.
                  </p>
                </div>
              )}

              {sortedAnnotations.map((ann) => (
                <AnnotationCard
                  key={ann.id}
                  annotation={ann}
                  tabId={activeTabId!}
                  forceCollapsed={allCollapsed}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sidebar toggle (when closed and annotations exist) */}
      {!showSidebar && annotations.length > 0 && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="cursor-pointer flex items-center justify-center"
          title="Open annotations"
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            zIndex: 15,
            width: 36,
            height: 36,
            borderRadius: 10,
            border: '1px solid #f0f0f0',
            background: '#ffffff',
            color: '#737373',
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#f5f5f5'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; }}
        >
          <PanelRightOpen size={15} />
          {annotations.length > 0 && (
            <span
              style={{
                position: 'absolute',
                top: -5,
                right: -5,
                minWidth: 16,
                height: 16,
                borderRadius: 8,
                background: '#10b981',
                color: '#fff',
                fontSize: '0.625rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 4px',
              }}
            >
              {annotations.length}
            </span>
          )}
        </button>
      )}

      {/* Scroll to top button */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="cursor-pointer flex items-center justify-center"
          title="Scroll to top"
          style={{
            position: 'absolute',
            bottom: 80,
            right: showSidebar ? 336 : 16,
            zIndex: 15,
            width: 36,
            height: 36,
            borderRadius: 10,
            border: '1px solid #f0f0f0',
            background: '#ffffff',
            color: '#737373',
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
            transition: 'right 200ms ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#f5f5f5'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; }}
        >
          <ArrowUp size={15} />
        </button>
      )}
    </div>
  );
}

// ─── Annotation Card ──────────────────────────────────────────────
interface AnnotationCardProps {
  annotation: Annotation;
  tabId: string;
  forceCollapsed?: boolean;
}

function AnnotationCard({ annotation, tabId, forceCollapsed }: AnnotationCardProps) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (forceCollapsed !== undefined) {
      setCollapsed(forceCollapsed);
    }
  }, [forceCollapsed]);

  const handleDelete = () => {
    useDocumentStore.getState().removeAnnotation(tabId, annotation.id);
  };

  const isCollapsed = collapsed;

  return (
    <div
      data-annotation-id={annotation.id}
      style={{
        margin: '4px 8px',
        padding: '10px 12px',
        background: '#ffffff',
        borderRadius: 8,
        border: `1px solid ${annotation.color || '#f0f0f0'}`,
        transition: 'border-color 200ms ease, box-shadow 300ms ease',
      }}
    >
      {/* Card header */}
      <div className="flex items-center justify-between" style={{ marginBottom: isCollapsed ? 0 : 8 }}>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="cursor-pointer flex items-center gap-1"
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            fontSize: '0.6875rem',
            color: '#a3a3a3',
            fontWeight: 500,
          }}
        >
          {isCollapsed ? <ChevronsUpDown size={10} /> : <ChevronsDownUp size={10} />}
          <span>
            {new Date(annotation.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </button>
        <button
          onClick={handleDelete}
          className="cursor-pointer flex items-center justify-center"
          title="Delete annotation"
          style={{
            width: 20,
            height: 20,
            borderRadius: 4,
            border: 'none',
            background: 'transparent',
            color: '#d4d4d4',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#fef2f2';
            e.currentTarget.style.color = '#ef4444';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = '#d4d4d4';
          }}
        >
          <Trash2 size={11} />
        </button>
      </div>

      {/* Card body */}
      {!isCollapsed && (
        <NotesEditor
          initialText={annotation.text}
          initialLatex={annotation.latex ?? ''}
          initialMode={annotation.notesMode ?? 'markdown'}
          onSave={(text, latex, mode) => {
            useDocumentStore.getState().updateAnnotation(tabId, annotation.id, {
              text,
              latex,
              notesMode: mode,
            });
          }}
          accentColor={annotation.color || '#10b981'}
          placeholder="Write a note..."
          autoFocus={!annotation.text && !annotation.latex}
          debounceMs={600}
        />
      )}
    </div>
  );
}