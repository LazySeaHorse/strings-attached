import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useAppStore } from './stores';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
const CMD = isMac ? '\u2318' : 'Ctrl';

const SHORTCUT_GROUPS = [
  {
    title: 'Navigation',
    shortcuts: [
      { keys: [`${CMD}+1`], label: 'Switch to Reader mode' },
      { keys: [`${CMD}+2`], label: 'Switch to Canvas mode' },
      { keys: [`${CMD}+Shift+[`], label: 'Previous tab' },
      { keys: [`${CMD}+Shift+]`], label: 'Next tab' },
      { keys: [`${CMD}+W`], label: 'Close active tab' },
    ],
  },
  {
    title: 'Tools',
    shortcuts: [
      { keys: ['V'], label: 'Select tool' },
      { keys: ['H'], label: 'Highlight tool' },
      { keys: ['A'], label: 'Annotate tool' },
      { keys: [`${CMD}+F`], label: 'Find in document' },
    ],
  },
  {
    title: 'Canvas',
    shortcuts: [
      { keys: [`${CMD}+0`], label: 'Fit view' },
      { keys: ['Delete'], label: 'Remove selected nodes' },
      { keys: ['Esc'], label: 'Cancel drag' },
    ],
  },
  {
    title: 'File',
    shortcuts: [
      { keys: [`${CMD}+S`], label: 'Save workspace' },
      { keys: [`${CMD}+,`], label: 'Open settings' },
      { keys: ['Shift+?'], label: 'Keyboard shortcuts' },
    ],
  },
];

export function KeyboardShortcutsModal() {
  const { shortcutsOpen, setShortcutsOpen } = useAppStore();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (shortcutsOpen) {
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [shortcutsOpen]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && shortcutsOpen) {
        setVisible(false);
        setTimeout(() => setShortcutsOpen(false), 200);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [shortcutsOpen, setShortcutsOpen]);

  if (!shortcutsOpen) return null;

  const handleClose = () => {
    setVisible(false);
    setTimeout(() => setShortcutsOpen(false), 200);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
      style={{
        background: visible ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0)',
        backdropFilter: visible ? 'blur(4px)' : 'blur(0px)',
        transition: 'all 200ms ease',
      }}
    >
      <div
        style={{
          maxWidth: 480,
          width: '100%',
          maxHeight: '85vh',
          background: '#ffffff',
          borderRadius: 16,
          padding: 24,
          boxShadow: '0 4px 24px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.03)',
          transform: visible ? 'scale(1)' : 'scale(0.95)',
          opacity: visible ? 1 : 0,
          transition: 'all 200ms ease-out',
          overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#171717' }}>
            Keyboard Shortcuts
          </h2>
          <button
            onClick={handleClose}
            className="cursor-pointer flex items-center justify-center transition-colors duration-150"
            style={{ width: 32, height: 32, borderRadius: 8, color: '#525252' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#f5f5f5'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title}>
              <p style={{
                fontSize: '0.6875rem',
                fontWeight: 600,
                color: '#a3a3a3',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: 8,
              }}>
                {group.title}
              </p>
              <div className="space-y-1">
                {group.shortcuts.map((sc) => (
                  <div
                    key={sc.label}
                    className="flex items-center justify-between"
                    style={{ padding: '5px 0' }}
                  >
                    <span style={{ fontSize: '0.8125rem', color: '#525252' }}>
                      {sc.label}
                    </span>
                    <div className="flex items-center gap-1">
                      {sc.keys.map((key) => (
                        <kbd
                          key={key}
                          style={{
                            padding: '2px 7px',
                            borderRadius: 5,
                            border: '1px solid #e5e5e5',
                            background: '#fafafa',
                            fontSize: '0.6875rem',
                            fontFamily: 'monospace',
                            color: '#525252',
                            fontWeight: 500,
                          }}
                        >
                          {key}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
