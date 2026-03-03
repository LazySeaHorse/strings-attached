import React, { useState, useRef, useEffect, useCallback } from 'react';
import { FileText, Calculator } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';

export interface NotesEditorProps {
  initialText: string;
  initialLatex: string;
  initialMode: 'markdown' | 'math';
  onSave: (text: string, latex: string, mode: 'markdown' | 'math') => void;
  /** Accent color for focus borders (default emerald #10b981) */
  accentColor?: string;
  /** Auto-focus the textarea on mount */
  autoFocus?: boolean;
  placeholder?: string;
  /** Additional CSS class for scrollable containers (e.g. 'nowheel node-scroll') */
  scrollClass?: string;
  /** Debounce delay in ms (default 400) */
  debounceMs?: number;
}

export function NotesEditor({
  initialText,
  initialLatex,
  initialMode,
  onSave,
  accentColor = '#10b981',
  autoFocus = false,
  placeholder = 'Write your notes in markdown...',
  scrollClass = '',
  debounceMs = 400,
}: NotesEditorProps) {
  const [mode, setMode] = useState<'markdown' | 'math'>(initialMode);
  const [mdText, setMdText] = useState(initialText);
  const [latex, setLatex] = useState(initialLatex);
  const [showPreview, setShowPreview] = useState(false);
  const mathFieldRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimeout = useRef<ReturnType<typeof setTimeout>>();

  // Refs to track latest values for unmount flush
  const latestRef = useRef({ mdText: initialText, latex: initialLatex, mode: initialMode as 'markdown' | 'math' });

  // Debounced save
  const save = useCallback(
    (md: string, ltx: string, m: 'markdown' | 'math') => {
      latestRef.current = { mdText: md, latex: ltx, mode: m };
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(() => {
        onSave(md, ltx, m);
        saveTimeout.current = undefined;
      }, debounceMs);
    },
    [onSave, debounceMs],
  );

  // Flush pending save on unmount (instead of just clearing the timeout)
  useEffect(() => {
    return () => {
      if (saveTimeout.current) {
        clearTimeout(saveTimeout.current);
        const { mdText: md, latex: ltx, mode: m } = latestRef.current;
        onSave(md, ltx, m);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMdChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      setMdText(val);
      save(val, latex, mode);
    },
    [latex, mode, save],
  );

  // Auto-focus
  useEffect(() => {
    if (autoFocus && mode === 'markdown' && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus, mode]);

  // Initialize MathLive field
  useEffect(() => {
    if (mode !== 'math' || !mathFieldRef.current) return;
    let mf = mathFieldRef.current.querySelector('math-field') as any;
    if (!mf) {
      import('mathlive').then(() => {
        mf = document.createElement('math-field') as any;
        mf.value = latex;
        mf.style.width = '100%';
        mf.style.minHeight = '60px';
        mf.style.fontSize = '1rem';
        mf.addEventListener('input', (ev: any) => {
          const val = ev.target?.value ?? '';
          setLatex(val);
          save(mdText, val, 'math');
        });
        // Shift+Enter inserts a LaTeX newline
        mf.addEventListener('keydown', (ev: KeyboardEvent) => {
          if (ev.key === 'Enter' && ev.shiftKey) {
            ev.preventDefault();
            ev.stopPropagation();
            if (mf.executeCommand) {
              mf.executeCommand(['insert', '\\\\']);
            }
          }
        });
        mathFieldRef.current?.appendChild(mf);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%' }}>
      {/* Mode toggle */}
      <div className="flex items-center gap-1" style={{ flexShrink: 0 }}>
        <button
          onClick={() => {
            setMode('markdown');
            save(mdText, latex, 'markdown');
          }}
          className="cursor-pointer flex items-center gap-1"
          style={{
            padding: '4px 8px',
            borderRadius: 5,
            border: 'none',
            fontSize: '0.75rem',
            fontWeight: 500,
            background: mode === 'markdown' ? `${accentColor}12` : 'transparent',
            color: mode === 'markdown' ? accentColor : '#a3a3a3',
            transition: 'all 100ms ease',
          }}
        >
          <FileText size={12} />
          Markdown
        </button>
        <button
          onClick={() => {
            setMode('math');
            save(mdText, latex, 'math');
          }}
          className="cursor-pointer flex items-center gap-1"
          style={{
            padding: '4px 8px',
            borderRadius: 5,
            border: 'none',
            fontSize: '0.75rem',
            fontWeight: 500,
            background: mode === 'math' ? `${accentColor}12` : 'transparent',
            color: mode === 'math' ? accentColor : '#a3a3a3',
            transition: 'all 100ms ease',
          }}
        >
          <Calculator size={12} />
          Math
        </button>
        {mode === 'markdown' && (
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="cursor-pointer"
            style={{
              marginLeft: 'auto',
              padding: '4px 8px',
              borderRadius: 5,
              border: 'none',
              fontSize: '0.7rem',
              fontWeight: 500,
              background: showPreview ? '#f5f5f5' : 'transparent',
              color: '#a3a3a3',
              transition: 'all 100ms ease',
            }}
          >
            {showPreview ? 'Edit' : 'Preview'}
          </button>
        )}
      </div>

      {/* Content area */}
      {mode === 'markdown' ? (
        showPreview ? (
          <div
            className={scrollClass}
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              fontSize: '0.875rem',
              lineHeight: 1.6,
              color: '#374151',
            }}
          >
            {mdText.trim() ? (
              <ReactMarkdown
                remarkPlugins={[remarkMath, remarkGfm]}
                rehypePlugins={[rehypeKatex]}
              >
                {mdText}
              </ReactMarkdown>
            ) : (
              <p style={{ color: '#a3a3a3', fontStyle: 'italic' }}>Nothing to preview</p>
            )}
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            value={mdText}
            onChange={handleMdChange}
            placeholder={placeholder}
            className={scrollClass}
            style={{
              flex: 1,
              minHeight: 60,
              padding: 10,
              borderRadius: 8,
              border: '1px solid #e5e5e5',
              background: '#fafafa',
              color: '#262626',
              fontSize: '0.8125rem',
              lineHeight: 1.6,
              resize: 'none',
              outline: 'none',
              fontFamily: "'SF Mono', 'Fira Code', Consolas, monospace",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = accentColor;
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = '#e5e5e5';
            }}
          />
        )
      ) : (
        <div
          ref={mathFieldRef}
          className={scrollClass}
          style={{ flex: 1, minHeight: 60 }}
        />
      )}
    </div>
  );
}