import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Handle, Position, NodeResizeControl, type NodeProps } from '@xyflow/react';
import { MoreHorizontal, AlertCircle, Send, Copy, Trash2, ChevronDown, ChevronRight, ArrowLeftToLine } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useDocumentStore, useCanvasStore, useAppStore, useSettingsStore, type ExplanationNodeData, type NodeTabKey, NODE_TAB_COLORS } from './stores';
import { TextContent } from './TextContent';
import { ResizeGrip } from './ResizeGrip';
import { toast } from 'sonner';
import { NotesEditor } from './NotesEditor';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

function useDictionary(word: string, enabled: boolean) {
  return useQuery({
    queryKey: ['dictionary', word.toLowerCase()],
    queryFn: async () => {
      const response = await fetch(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`
      );
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error('Dictionary lookup failed');
      }
      const data = await response.json();
      return data[0];
    },
    staleTime: Infinity,
    retry: 1,
    enabled,
  });
}

// Build surrounding context based on contextAmount (0-100)
function buildContext(sourceText: string, documentContent: string | undefined, contextAmount: number): string {
  if (!documentContent || contextAmount === 0) return '';

  const idx = documentContent.indexOf(sourceText);
  if (idx === -1) return contextAmount >= 90 ? documentContent : '';

  const totalLen = documentContent.length;

  if (contextAmount >= 90) {
    return documentContent;
  }

  const charBudget = Math.round(
    contextAmount <= 25
      ? 200
      : contextAmount <= 50
        ? 200 + ((contextAmount - 25) / 25) * 600
        : contextAmount <= 75
          ? 800 + ((contextAmount - 50) / 25) * 1200
          : 2000 + ((contextAmount - 75) / 15) * 3000
  );

  const halfBudget = Math.floor(charBudget / 2);
  const start = Math.max(0, idx - halfBudget);
  const end = Math.min(totalLen, idx + sourceText.length + halfBudget);

  let context = documentContent.slice(start, end);

  if (start > 0) context = '...' + context;
  if (end < totalLen) context = context + '...';

  return context;
}

function useAiExplain(sourceText: string, enabled: boolean) {
  const { groqApiKey, openRouterApiKey, preferredProvider, groqModel, openRouterModel, systemPrompt, contextAmount } = useSettingsStore();
  const activeTab = useDocumentStore((s) => s.getActiveTab());
  const documentContent = activeTab?.document.content;

  const apiKey = preferredProvider === 'groq' ? groqApiKey : openRouterApiKey;
  const model = preferredProvider === 'groq' ? groqModel : openRouterModel;
  const endpoint =
    preferredProvider === 'groq'
      ? 'https://api.groq.com/openai/v1/chat/completions'
      : 'https://openrouter.ai/api/v1/chat/completions';

  const context = buildContext(sourceText, documentContent, contextAmount);

  return useQuery({
    queryKey: ['explain', sourceText, preferredProvider, model, systemPrompt, contextAmount],
    queryFn: async () => {
      if (!apiKey) throw new Error('API key not configured');

      let userMessage = `Explain the word or phrase "${sourceText}" simply.`;
      if (context) {
        userMessage = `Explain the word or phrase "${sourceText}" simply.\n\nHere is the surrounding context from the document:\n\n${context}`;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          max_tokens: 300,
          temperature: 0.3,
        }),
      });
      if (!response.ok) throw new Error('AI explanation failed');
      const data = await response.json();
      return data.choices[0].message.content;
    },
    enabled: enabled && !!apiKey,
    staleTime: Infinity,
    retry: 1,
  });
}

function SkeletonLines() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="animate-pulse"
          style={{
            background: '#f5f5f5',
            borderRadius: 4,
            height: 16,
            width: i === 3 ? '60%' : '100%',
          }}
        />
      ))}
    </div>
  );
}

function AskTab({ sourceText }: { sourceText: string }) {
  const { groqApiKey, openRouterApiKey, preferredProvider, groqModel, openRouterModel, systemPrompt, contextAmount } = useSettingsStore();
  const activeTab = useDocumentStore((s) => s.getActiveTab());
  const documentContent = activeTab?.document.content;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const apiKey = preferredProvider === 'groq' ? groqApiKey : openRouterApiKey;
  const model = preferredProvider === 'groq' ? groqModel : openRouterModel;
  const endpoint =
    preferredProvider === 'groq'
      ? 'https://api.groq.com/openai/v1/chat/completions'
      : 'https://openrouter.ai/api/v1/chat/completions';

  const context = buildContext(sourceText, documentContent, contextAmount);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || !apiKey || isLoading) return;

    const userMsg: ChatMessage = { role: 'user', content: trimmed };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setIsLoading(true);

    try {
      // Build the full message history for the API
      const apiMessages: { role: string; content: string }[] = [
        {
          role: 'system',
          content: `${systemPrompt}\n\nThe user is asking about the word/phrase "${sourceText}".${context ? `\n\nDocument context:\n${context}` : ''}`,
        },
        ...updatedMessages.map((m) => ({ role: m.role, content: m.content })),
      ];

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: apiMessages,
          max_tokens: 400,
          temperature: 0.4,
        }),
      });

      if (!response.ok) throw new Error('AI request failed');
      const data = await response.json();
      const assistantContent = data.choices[0].message.content;

      setMessages((prev) => [...prev, { role: 'assistant', content: assistantContent }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, something went wrong. Check your API key and try again.' },
      ]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }, [input, apiKey, isLoading, messages, endpoint, model, systemPrompt, sourceText, context]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        sendMessage();
      }
    },
    [sendMessage]
  );

  if (!groqApiKey && !openRouterApiKey) {
    return (
      <p style={{ fontSize: '0.875rem', color: '#737373' }}>
        Configure an API key in Settings to chat with AI.
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', margin: -16 }}>
      {/* Messages */}
      <div
        ref={scrollRef}
        className="nowheel node-scroll"
        style={{
          flex: 1,
          overflowY: 'auto',
          minHeight: 0,
        }}
      >
        {messages.length === 0 && (
          <div style={{ padding: 16, textAlign: 'center' }}>
            <p style={{ fontSize: '0.8125rem', color: '#a3a3a3' }}>
              Ask anything about "{sourceText.length > 30 ? sourceText.slice(0, 30) + '...' : sourceText}"
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              padding: '10px 16px',
              fontSize: '0.8125rem',
              lineHeight: 1.5,
              color: '#262626',
              background: msg.role === 'user' ? '#ffffff' : '#fafafa',
              borderBottom: '1px solid #f5f5f5',
            }}
          >
            {msg.content}
          </div>
        ))}
        {isLoading && (
          <div style={{ padding: '10px 16px', background: '#fafafa' }}>
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="animate-pulse"
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: '#a3a3a3',
                    animationDelay: `${i * 150}ms`,
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div
        style={{
          borderTop: '1px solid #f0f0f0',
          padding: '8px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask..."
          disabled={isLoading}
          style={{
            flex: 1,
            fontSize: '0.8125rem',
            padding: '6px 10px',
            borderRadius: 6,
            border: '1px solid #e5e5e5',
            outline: 'none',
            background: '#ffffff',
            color: '#171717',
            transition: 'border-color 150ms',
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = '#3b82f6'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = '#e5e5e5'; }}
        />
        <button
          onClick={sendMessage}
          disabled={isLoading || !input.trim()}
          className="cursor-pointer flex items-center justify-center"
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            border: 'none',
            background: input.trim() && !isLoading ? '#171717' : '#e5e5e5',
            color: input.trim() && !isLoading ? '#ffffff' : '#a3a3a3',
            transition: 'all 150ms ease',
            flexShrink: 0,
          }}
        >
          <Send size={13} />
        </button>
      </div>
    </div>
  );
}

type TabKey = 'definition' | 'explain' | 'ask' | 'notes';

/** Helper to update a node's data in the canvas store */
function updateNodeData(nodeId: string, docId: string | undefined, patch: Partial<ExplanationNodeData>) {
  const resolvedDocId = docId || useDocumentStore.getState().activeTabId;
  if (!resolvedDocId) return;
  useCanvasStore.getState().setNodes(resolvedDocId, (nds) =>
    nds.map((n) =>
      n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n,
    ),
  );
}

export function ExplanationNode({ data, id, selected }: NodeProps) {
  const nodeData = data as ExplanationNodeData;
  const { sourceText, sourceType } = nodeData;
  const isWord = sourceType === 'word';
  const defaultTab: TabKey = (nodeData.activeNodeTab as TabKey) ?? (isWord ? 'definition' : 'explain');
  const [activeTab, setActiveTab] = useState<TabKey>(defaultTab);

  // Sync local tab state with external changes (file import, undo, persistence reload)
  useEffect(() => {
    const stored = nodeData.activeNodeTab as TabKey | undefined;
    if (stored && stored !== activeTab) {
      setActiveTab(stored);
    }
    // Only react to external data changes, not local state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeData.activeNodeTab]);

  const displayText = sourceText.length > 50 ? sourceText.slice(0, 50) + '...' : sourceText;
  const { groqApiKey, openRouterApiKey } = useSettingsStore();
  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Accent color based on active tab
  const accentColor = NODE_TAB_COLORS[activeTab] ?? '#3b82f6';

  const isSingleWord = !sourceText.includes(' ');
  const dictQuery = useDictionary(
    isSingleWord ? sourceText : sourceText.split(' ')[0],
    isWord && activeTab === 'definition' && !collapsed
  );
  const aiQuery = useAiExplain(sourceText, activeTab === 'explain' && !collapsed);

  // Persist active tab to node data (for edge/highlight color sync)
  const handleTabChange = useCallback((tab: TabKey) => {
    setActiveTab(tab);
    updateNodeData(id, nodeData.docId, { activeNodeTab: tab });
  }, [id, nodeData.docId]);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const handleCopySource = () => {
    navigator.clipboard.writeText(sourceText);
    toast.success('Source text copied');
    setMenuOpen(false);
  };

  const handleCopyExplanation = () => {
    const text = aiQuery.data || '';
    if (text) {
      navigator.clipboard.writeText(text);
      toast.success('Explanation copied');
    }
    setMenuOpen(false);
  };

  const handleDelete = () => {
    const docId = nodeData.docId || useDocumentStore.getState().activeTabId;
    if (!docId) return;
    if (nodeData.sourceWordIndices && nodeData.sourceWordIndices.length > 0) {
      useDocumentStore.getState().removePulledWords(docId, nodeData.sourceWordIndices as number[]);
    }
    useCanvasStore.getState().setNodes(docId, (nds) => nds.filter((n) => n.id !== id));
    useCanvasStore.getState().setEdges(docId, (eds) =>
      eds.filter((e) => e.source !== id && e.target !== id)
    );
    setMenuOpen(false);
  };

  const handleJumpToSource = () => {
    const nd = data as ExplanationNodeData;
    const firstIdx = nd.sourceWordIndices?.[0];
    useAppStore.getState().setMode('classic');
    if (typeof firstIdx === 'number' && firstIdx >= 0) {
      useAppStore.getState().setJumpToWordIndex(firstIdx);
    }
    setMenuOpen(false);
  };

  const tabs: { key: TabKey; label: string }[] = isWord
    ? [
        { key: 'definition', label: 'Definition' },
        { key: 'explain', label: 'Explain' },
        { key: 'ask', label: 'Ask' },
        { key: 'notes', label: 'Notes' },
      ]
    : [
        { key: 'explain', label: 'Explain' },
        { key: 'ask', label: 'Ask' },
        { key: 'notes', label: 'Notes' },
      ];

  return (
    <div
      className="node-spawn"
      style={{
        width: '100%',
        height: collapsed ? 'auto' : '100%',
        background: '#ffffff',
        border: `1px solid ${accentColor}20`,
        borderRadius: 12,
        boxShadow: `0 2px 8px rgba(0,0,0,0.04), 0 0 0 1px ${accentColor}10`,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {!collapsed && (
        <NodeResizeControl
          minWidth={240}
          minHeight={100}
          position="bottom-right"
          style={{ background: 'transparent', border: 'none' }}
        >
          <ResizeGrip />
        </NodeResizeControl>
      )}

      {/* Header */}
      <div
        className="node-drag-handle flex items-center justify-between"
        style={{
          padding: '12px 16px',
          borderBottom: collapsed ? 'none' : '1px solid #f0f0f0',
          cursor: 'grab',
          flexShrink: 0,
        }}
      >
        <div className="flex items-center gap-2" style={{ minWidth: 0, flex: 1 }}>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="cursor-pointer flex items-center justify-center"
            style={{
              width: 18,
              height: 18,
              borderRadius: 4,
              border: 'none',
              background: 'transparent',
              color: '#a3a3a3',
              flexShrink: 0,
              padding: 0,
            }}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </button>
          <span style={{
            fontSize: '0.875rem',
            fontWeight: 600,
            color: '#171717',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {displayText}
          </span>
        </div>

        {/* Context menu */}
        <div style={{ position: 'relative' }} ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="cursor-pointer flex items-center justify-center"
            style={{
              width: 22,
              height: 22,
              borderRadius: 5,
              border: 'none',
              background: menuOpen ? '#f5f5f5' : 'transparent',
              color: '#a3a3a3',
              flexShrink: 0,
              padding: 0,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#f5f5f5'; }}
            onMouseLeave={(e) => { if (!menuOpen) e.currentTarget.style.background = 'transparent'; }}
          >
            <MoreHorizontal size={16} />
          </button>

          {menuOpen && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: 4,
                background: '#ffffff',
                borderRadius: 8,
                boxShadow: '0 4px 16px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)',
                padding: 4,
                zIndex: 50,
                minWidth: 160,
              }}
            >
              <MenuItem icon={<Copy size={13} />} label="Copy source text" onClick={handleCopySource} />
              {aiQuery.data && (
                <MenuItem icon={<Copy size={13} />} label="Copy explanation" onClick={handleCopyExplanation} />
              )}
              <MenuItem icon={<ArrowLeftToLine size={13} />} label="Jump to reader" onClick={handleJumpToSource} />
              <div style={{ height: 1, background: '#f0f0f0', margin: '4px 0' }} />
              <MenuItem icon={<Trash2 size={13} />} label="Delete node" onClick={handleDelete} danger />
            </div>
          )}
        </div>
      </div>

      {/* Body (hidden when collapsed) */}
      {!collapsed && (
        <>
          {/* Tabs */}
          <div className="flex" style={{ borderBottom: '1px solid #f0f0f0', flexShrink: 0 }}>
            {tabs.map((tab) => {
              const isNotes = tab.key === 'notes';
              const isActive = activeTab === tab.key;
              const tabAccent = isNotes ? '#10b981' : '#171717';
              return (
                <button
                  key={tab.key}
                  onClick={() => handleTabChange(tab.key)}
                  className="cursor-pointer transition-colors duration-150"
                  style={{
                    padding: '8px 12px',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    color: isActive ? tabAccent : '#737373',
                    background: 'transparent',
                    border: 'none',
                    borderBottomWidth: 2,
                    borderBottomStyle: 'solid',
                    borderBottomColor: isActive ? tabAccent : 'transparent',
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Content */}
          <div
            className="nowheel node-scroll"
            style={{
              padding: activeTab === 'ask' ? 0 : 16,
              overflowY: activeTab === 'ask' ? 'hidden' : 'auto',
              flex: 1,
              minHeight: 0,
            }}
          >
            {activeTab === 'definition' && isWord && (
              <div>
                {dictQuery.isLoading && <SkeletonLines />}
                {dictQuery.isError && (
                  <div className="flex flex-col items-center gap-2 py-4">
                    <AlertCircle size={24} color="#a3a3a3" />
                    <p style={{ fontSize: '0.875rem', color: '#737373' }}>
                      Couldn't load definition.
                    </p>
                    <button
                      onClick={() => dictQuery.refetch()}
                      className="cursor-pointer"
                      style={{
                        fontSize: '0.75rem',
                        color: '#525252',
                        textDecoration: 'underline',
                        background: 'none',
                        border: 'none',
                      }}
                    >
                      Retry
                    </button>
                  </div>
                )}
                {dictQuery.isSuccess && dictQuery.data === null && (
                  <p style={{ fontSize: '0.875rem', color: '#737373' }}>
                    No definition found for "{sourceText}".
                  </p>
                )}
                {dictQuery.isSuccess && dictQuery.data && (
                  <div className="space-y-3">
                    {dictQuery.data.phonetic && (
                      <p style={{ fontSize: '0.875rem', color: '#737373' }}>
                        {dictQuery.data.phonetic}
                      </p>
                    )}
                    {dictQuery.data.meanings?.map((meaning: any, i: number) => (
                      <div key={i}>
                        <p
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 500,
                            color: '#3b82f6',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            marginBottom: 4,
                          }}
                        >
                          {meaning.partOfSpeech}
                        </p>
                        {meaning.definitions?.slice(0, 2).map((def: any, j: number) => (
                          <div key={j} style={{ marginBottom: 8 }}>
                            <TextContent
                              content={def.definition}
                              nodeId={id}
                              disablePulledGlow
                            />
                            {def.example && (
                              <p
                                style={{
                                  fontSize: '0.75rem',
                                  color: '#737373',
                                  fontStyle: 'italic',
                                  marginTop: 4,
                                }}
                              >
                                "{def.example}"
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'explain' && (
              <div>
                {!groqApiKey && !openRouterApiKey ? (
                  <p style={{ fontSize: '0.875rem', color: '#737373' }}>
                    Configure an API key in Settings to use AI explanations.
                  </p>
                ) : aiQuery.isLoading ? (
                  <SkeletonLines />
                ) : aiQuery.isError ? (
                  <div className="flex flex-col items-center gap-2 py-4">
                    <AlertCircle size={24} color="#a3a3a3" />
                    <p style={{ fontSize: '0.875rem', color: '#737373' }}>
                      Couldn't generate explanation. Check your API key.
                    </p>
                    <button
                      onClick={() => aiQuery.refetch()}
                      className="cursor-pointer"
                      style={{
                        fontSize: '0.75rem',
                        color: '#525252',
                        textDecoration: 'underline',
                        background: 'none',
                        border: 'none',
                      }}
                    >
                      Retry
                    </button>
                  </div>
                ) : aiQuery.isSuccess ? (
                  <TextContent content={aiQuery.data} nodeId={id} disablePulledGlow />
                ) : null}
              </div>
            )}

            {activeTab === 'ask' && (
              <div style={{ padding: 16, height: '100%' }}>
                <AskTab sourceText={sourceText} />
              </div>
            )}

            {activeTab === 'notes' && (
              <NotesEditor
                initialText={nodeData.notes ?? ''}
                initialLatex={nodeData.notesLatex ?? ''}
                initialMode={nodeData.notesMode ?? 'markdown'}
                onSave={(text, latex, mode) => updateNodeData(id, nodeData.docId, { notes: text, notesLatex: latex, notesMode: mode })}
                scrollClass="nowheel node-scroll"
              />
            )}
          </div>
        </>
      )}

      <Handle type="source" position={Position.Right} style={{ visibility: 'hidden' }} />
      <Handle type="target" position={Position.Left} style={{ visibility: 'hidden' }} />
    </div>
  );
}

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}

function MenuItem({ icon, label, onClick, danger }: MenuItemProps) {
  return (
    <button
      onClick={onClick}
      className="cursor-pointer flex items-center gap-2"
      style={{
        width: '100%',
        padding: '6px 10px',
        fontSize: '0.8125rem',
        color: danger ? '#ff5555' : '#404040',
        background: 'none',
        border: 'none',
        borderRadius: 5,
        transition: 'background 100ms ease',
        textAlign: 'left',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = '#f5f5f5'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      {icon}
      {label}
    </button>
  );
}