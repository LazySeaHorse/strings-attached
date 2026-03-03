import { Settings, Save, FolderOpen, Plus, Trash2, Keyboard } from 'lucide-react';
import React, { useRef } from 'react';
import { useAppStore, useDocumentStore, useCanvasStore } from '../stores';
import { downloadStringsFile, parseStringsFile, isStringsFile } from '../utils/fileFormat';
import { buildDocumentFromFile } from '../utils/fileUtils';
import { toast } from 'sonner';

export function Header() {
  const { mode, setMode, setSettingsOpen } = useAppStore();
  const { tabs, activeTabId } = useDocumentStore();
  const addDocument = useDocumentStore((s) => s.addDocument);
  const loadWorkspace = useDocumentStore((s) => s.loadWorkspace);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = () => {
    const { canvasMap } = useCanvasStore.getState();
    downloadStringsFile(tabs, activeTabId, canvasMap, 'workspace');
    toast.success('Workspace saved');
  };

  const handleOpen = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (isStringsFile(file.name)) {
      try {
        const json = await file.text();
        const workspace = parseStringsFile(json);
        loadWorkspace(workspace.documents, workspace.activeTabId);
        useCanvasStore.getState().loadCanvasMap(workspace.canvasMap);
        toast.success('Workspace loaded');
      } catch (err) {
        console.error('Failed to load .strings file:', err);
        toast.error('Failed to load workspace file');
      }
    } else {
      try {
        const doc = await buildDocumentFromFile(file);
        addDocument(doc);
      } catch (err: any) {
        console.error('Failed to load file:', err);
        toast.error(err?.message || 'Failed to load file');
      }
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const hasTabs = tabs.length > 0;

  const handleReset = () => {
    if (!window.confirm('Reset all saved data? This will clear all documents, highlights, annotations, and canvas state.')) return;
    useDocumentStore.getState().clearAll();
    useCanvasStore.getState().clearAll();
    localStorage.removeItem('strings-attached-documents');
    localStorage.removeItem('strings-attached-canvas');
    localStorage.removeItem('strings-attached-settings');
  };

  return (
    <header
      className="flex items-center justify-between px-4 shrink-0"
      style={{
        height: 48,
        background: '#ffffff',
        borderBottom: '1px solid #f0f0f0',
      }}
    >
      {/* Left: Logo */}
      <div className="flex items-center gap-2.5">
        <div
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: '#3b82f6',
          }}
        />
        <span
          style={{
            fontSize: '0.875rem',
            fontWeight: 600,
            color: '#171717',
            letterSpacing: '-0.01em',
          }}
        >
          Strings Attached
        </span>
      </div>

      {/* Center: Mode toggle */}
      <div
        className="flex items-center"
        style={{
          background: '#f5f5f5',
          borderRadius: 8,
          padding: 3,
        }}
      >
        {(['classic', 'canvas'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={'cursor-pointer transition-all duration-150'}
            style={{
              padding: '4px 14px',
              borderRadius: 6,
              fontSize: '0.75rem',
              fontWeight: 500,
              background: mode === m ? '#ffffff' : 'transparent',
              boxShadow: mode === m ? '0 1px 2px rgba(0,0,0,0.04)' : 'none',
              color: mode === m ? '#171717' : '#a3a3a3',
              border: 'none',
            }}
          >
            {m === 'classic' ? 'Reader' : 'Canvas'}
          </button>
        ))}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.md,.txt,.strings,application/pdf,text/plain,text/markdown"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />

        <HeaderButton icon={<FolderOpen size={16} />} label="Open" onClick={handleOpen} />

        {hasTabs && (
          <HeaderButton icon={<Save size={16} />} label="Save" onClick={handleSave} />
        )}

        <div style={{ width: 1, height: 20, background: '#f0f0f0', margin: '0 4px' }} />

        <HeaderButton
          icon={<Settings size={16} />}
          onClick={() => setSettingsOpen(true)}
        />

        <HeaderButton
          icon={<Keyboard size={16} />}
          label="?"
          onClick={() => useAppStore.getState().setShortcutsOpen(true)}
        />

        <HeaderButton
          icon={<Trash2 size={16} />}
          label="Reset"
          onClick={handleReset}
          danger
        />
      </div>
    </header>
  );
}

function HeaderButton({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label?: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="cursor-pointer flex items-center gap-1.5 transition-colors duration-100"
      style={{
        padding: label ? '5px 10px' : '5px 7px',
        borderRadius: 6,
        color: danger ? '#ff5555' : '#737373',
        background: 'transparent',
        border: 'none',
        fontSize: '0.75rem',
        fontWeight: 500,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = '#f5f5f5';
        e.currentTarget.style.color = '#404040';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.color = danger ? '#ff5555' : '#737373';
      }}
    >
      {icon}
      {label && <span>{label}</span>}
    </button>
  );
}