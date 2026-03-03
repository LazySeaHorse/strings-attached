import React, { useEffect, useCallback, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Header } from './components/layout/Header';
import { TabBar } from './components/layout/TabBar';
import { FloatingToolbar } from './components/toolbar/FloatingToolbar';
import { SettingsModal } from './components/SettingsModal';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { EmptyState } from './components/EmptyState';
import { ClassicView } from './components/viewer/ClassicView';
import { InfiniteCanvas } from './components/InfiniteCanvas';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { useAppStore, useDocumentStore, useCanvasStore } from './components/stores';
import { downloadStringsFile } from './components/utils/fileFormat';
import { buildDocumentFromFile } from './components/utils/fileUtils';
import { Toaster, toast } from 'sonner';
import { Upload } from 'lucide-react';

const queryClient = new QueryClient();

function AppContent() {
  // Granular selectors to avoid re-rendering on unrelated store changes
  const mode = useAppStore((s) => s.mode);
  const setMode = useAppStore((s) => s.setMode);
  const setSettingsOpen = useAppStore((s) => s.setSettingsOpen);
  const setSearchOpen = useAppStore((s) => s.setSearchOpen);
  const tabs = useDocumentStore((s) => s.tabs);
  const activeTabId = useDocumentStore((s) => s.activeTabId);
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const document = activeTab?.document ?? null;

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const cmd = e.metaKey || e.ctrlKey;
      const tag = (e.target as HTMLElement)?.tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA';

      if (cmd && e.key === '1') { e.preventDefault(); setMode('classic'); }
      if (cmd && e.key === '2') { e.preventDefault(); setMode('canvas'); }
      if (cmd && e.key === ',') { e.preventDefault(); setSettingsOpen(true); }
      if (cmd && e.key === 'f') { e.preventDefault(); setSearchOpen(true); }
      if (cmd && e.key === 's') {
        e.preventDefault();
        const { tabs, activeTabId } = useDocumentStore.getState();
        const { canvasMap } = useCanvasStore.getState();
        if (tabs.length > 0) {
          downloadStringsFile(tabs, activeTabId, canvasMap, 'workspace');
          toast.success('Workspace saved');
        }
      }

      // Cmd+W → close active tab
      if (cmd && e.key === 'w') {
        e.preventDefault();
        const { activeTabId } = useDocumentStore.getState();
        if (activeTabId) useDocumentStore.getState().closeTab(activeTabId);
      }

      // Cmd+0 ��� fit view (canvas mode)
      if (cmd && e.key === '0') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('fitView'));
      }

      // Cmd+Shift+[ / ] → switch tabs
      if (cmd && e.shiftKey && (e.key === '[' || e.key === ']')) {
        e.preventDefault();
        const { tabs, activeTabId } = useDocumentStore.getState();
        if (tabs.length < 2) return;
        const idx = tabs.findIndex((t) => t.id === activeTabId);
        if (idx === -1) return;
        const next = e.key === ']'
          ? tabs[(idx + 1) % tabs.length]
          : tabs[(idx - 1 + tabs.length) % tabs.length];
        useDocumentStore.getState().setActiveTab(next.id);
      }

      // Shift+? → keyboard shortcuts
      if (!isInput && e.key === '?' && e.shiftKey) {
        e.preventDefault();
        useAppStore.getState().setShortcutsOpen(true);
      }

      // Tool shortcuts (only when not focused on input)
      if (!isInput && !cmd) {
        if (e.key === 'v' || e.key === 'V') useAppStore.getState().setActiveTool('select');
        if (e.key === 'h' || e.key === 'H') useAppStore.getState().setActiveTool('highlight');
        if (e.key === 'a' || e.key === 'A') useAppStore.getState().setActiveTool('annotate');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setMode, setSettingsOpen, setSearchOpen]);

  const hasDocument = tabs.length > 0 && document;

  // Global drag-and-drop file handling (works even when a doc is already open)
  const [globalDragOver, setGlobalDragOver] = useState(false);

  const handleGlobalDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setGlobalDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    try {
      const doc = await buildDocumentFromFile(file);
      useDocumentStore.getState().addDocument(doc);
      toast.success(`Opened "${doc.title || 'Document'}"`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load file');
    }
  }, []);

  return (
    <div
      className="size-full flex flex-col"
      style={{
        background: '#fafafa',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
      onDragOver={(e) => { e.preventDefault(); setGlobalDragOver(true); }}
      onDragLeave={(e) => {
        // Only clear if leaving the root container
        if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) {
          setGlobalDragOver(false);
        }
      }}
      onDrop={handleGlobalDrop}
    >
      <Header />
      <TabBar />
      <SettingsModal />
      <KeyboardShortcutsModal />
      <GlobalSearchModal />

      {/* Global drop overlay */}
      {globalDragOver && hasDocument && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(59, 130, 246, 0.04)',
            border: '3px dashed rgba(59, 130, 246, 0.25)',
            borderRadius: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 60,
            pointerEvents: 'none',
          }}
        >
          <div className="flex flex-col items-center gap-2">
            <Upload size={28} color="#3b82f6" strokeWidth={1.5} />
            <p style={{ fontSize: '0.875rem', fontWeight: 500, color: '#3b82f6' }}>
              Drop to open as new tab
            </p>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {!hasDocument ? (
          <EmptyState />
        ) : mode === 'classic' ? (
          <ClassicView />
        ) : (
          <div className="flex-1 min-h-0">
            <InfiniteCanvas document={document} />
          </div>
        )}
      </div>

      {/* Floating toolbar (only when a document is open) */}
      {hasDocument && <FloatingToolbar />}
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
      <Toaster
        position="bottom-center"
        toastOptions={{
          style: {
            fontSize: '0.8125rem',
            borderRadius: 10,
            padding: '10px 16px',
          },
        }}
      />
    </QueryClientProvider>
  );
}