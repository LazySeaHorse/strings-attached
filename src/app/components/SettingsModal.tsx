import React, { useState, useEffect } from 'react';
import { X, RotateCcw } from 'lucide-react';
import { useAppStore, useSettingsStore, DEFAULT_SYSTEM_PROMPT, GROQ_MODELS, OPENROUTER_MODELS } from './stores';

function contextLabel(amount: number): string {
  if (amount === 0) return 'None';
  if (amount <= 25) return 'Nearby sentence';
  if (amount <= 50) return 'Nearby paragraph';
  if (amount <= 75) return 'Several paragraphs';
  return 'Whole page';
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid #e5e5e5',
  fontSize: '0.875rem',
  outline: 'none',
  transition: 'border-color 150ms',
  background: '#ffffff',
  color: '#171717',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.875rem',
  fontWeight: 500,
  color: '#404040',
  marginBottom: 6,
};

const sectionHeadingStyle: React.CSSProperties = {
  fontSize: '0.875rem',
  fontWeight: 500,
  color: '#525252',
  marginBottom: 4,
};

export function SettingsModal() {
  const { settingsOpen, setSettingsOpen } = useAppStore();
  const {
    groqApiKey,
    openRouterApiKey,
    preferredProvider,
    groqModel,
    openRouterModel,
    systemPrompt,
    contextAmount,
    setGroqApiKey,
    setOpenRouterApiKey,
    setPreferredProvider,
    setGroqModel,
    setOpenRouterModel,
    setSystemPrompt,
    setContextAmount,
  } = useSettingsStore();

  const [groqKey, setGroqKey] = useState(groqApiKey || '');
  const [openRouterKey, setOpenRouterKey] = useState(openRouterApiKey || '');
  const [localGroqModel, setLocalGroqModel] = useState(groqModel);
  const [localOpenRouterModel, setLocalOpenRouterModel] = useState(openRouterModel);
  const [localSystemPrompt, setLocalSystemPrompt] = useState(systemPrompt);
  const [localContextAmount, setLocalContextAmount] = useState(contextAmount);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (settingsOpen) {
      setGroqKey(groqApiKey || '');
      setOpenRouterKey(openRouterApiKey || '');
      setLocalGroqModel(groqModel);
      setLocalOpenRouterModel(openRouterModel);
      setLocalSystemPrompt(systemPrompt);
      setLocalContextAmount(contextAmount);
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [settingsOpen, groqApiKey, openRouterApiKey, groqModel, openRouterModel, systemPrompt, contextAmount]);

  const handleClose = () => {
    // Save everything on close
    setGroqApiKey(groqKey);
    setOpenRouterApiKey(openRouterKey);
    setGroqModel(localGroqModel);
    setOpenRouterModel(localOpenRouterModel);
    setSystemPrompt(localSystemPrompt);
    setContextAmount(localContextAmount);
    setVisible(false);
    setTimeout(() => setSettingsOpen(false), 200);
  };

  // Ref to always have latest handleClose for the ESC handler
  const handleCloseRef = React.useRef(handleClose);
  handleCloseRef.current = handleClose;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && settingsOpen) {
        handleCloseRef.current();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [settingsOpen]);

  if (!settingsOpen) return null;

  const models = preferredProvider === 'groq' ? GROQ_MODELS : OPENROUTER_MODELS;
  const currentModel = preferredProvider === 'groq' ? localGroqModel : localOpenRouterModel;
  const setCurrentModel = preferredProvider === 'groq' ? setLocalGroqModel : setLocalOpenRouterModel;
  const isCustomModel = !models.some((m) => m.id === currentModel);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      style={{
        background: visible ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0)',
        backdropFilter: visible ? 'blur(4px)' : 'blur(0px)',
        transition: 'all 200ms ease',
      }}
    >
      <div
        style={{
          maxWidth: 520,
          width: '100%',
          maxHeight: '90vh',
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
        <div className="flex items-center justify-between mb-6">
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#171717' }}>
            Settings
          </h2>
          <button
            onClick={handleClose}
            className="cursor-pointer flex items-center justify-center transition-colors duration-150"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              color: '#525252',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f5f5f5';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5">
          {/* ── API Configuration ── */}
          <p style={sectionHeadingStyle}>API Configuration</p>

          <div>
            <label style={labelStyle}>Groq API Key</label>
            <input
              type="password"
              value={groqKey}
              onChange={(e) => setGroqKey(e.target.value)}
              placeholder="gsk_..."
              style={inputStyle}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#3b82f6'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = '#d4d4d4'; }}
            />
          </div>

          <div>
            <label style={labelStyle}>OpenRouter API Key</label>
            <input
              type="password"
              value={openRouterKey}
              onChange={(e) => setOpenRouterKey(e.target.value)}
              placeholder="sk-or-..."
              style={inputStyle}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#3b82f6'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = '#d4d4d4'; }}
            />
          </div>

          <div>
            <label style={labelStyle}>Preferred Provider</label>
            <div className="flex items-center gap-4">
              {(['groq', 'openrouter'] as const).map((p) => (
                <label key={p} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="provider"
                    checked={preferredProvider === p}
                    onChange={() => setPreferredProvider(p)}
                    style={{ accentColor: '#171717' }}
                  />
                  <span style={{ fontSize: '0.875rem', color: '#404040' }}>
                    {p === 'groq' ? 'Groq' : 'OpenRouter'}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* ── Model Selection ── */}
          <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 16 }}>
            <p style={sectionHeadingStyle}>Model</p>
          </div>

          <div>
            <label style={labelStyle}>
              {preferredProvider === 'groq' ? 'Groq Model' : 'OpenRouter Model'}
            </label>
            <select
              value={isCustomModel ? '__custom__' : currentModel}
              onChange={(e) => {
                if (e.target.value !== '__custom__') {
                  setCurrentModel(e.target.value);
                }
              }}
              style={{
                ...inputStyle,
                appearance: 'auto',
              }}
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
              <option value="__custom__">Custom...</option>
            </select>

            {isCustomModel && (
              <input
                type="text"
                value={currentModel}
                onChange={(e) => setCurrentModel(e.target.value)}
                placeholder="e.g. meta-llama/llama-3.1-8b-instruct"
                style={{ ...inputStyle, marginTop: 8 }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#3b82f6'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#d4d4d4'; }}
              />
            )}
            {/* Show a custom input when "Custom..." is selected */}
            {!isCustomModel && (
              <button
                onClick={() => setCurrentModel('')}
                className="cursor-pointer"
                style={{
                  marginTop: 6,
                  fontSize: '0.75rem',
                  color: '#737373',
                  background: 'none',
                  border: 'none',
                  textDecoration: 'underline',
                  padding: 0,
                }}
              >
                Use custom model ID
              </button>
            )}
          </div>

          {/* ── AI Behavior ── */}
          <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 16 }}>
            <p style={sectionHeadingStyle}>AI Behavior</p>
          </div>

          <div>
            <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>System Prompt</label>
              {localSystemPrompt !== DEFAULT_SYSTEM_PROMPT && (
                <button
                  onClick={() => setLocalSystemPrompt(DEFAULT_SYSTEM_PROMPT)}
                  className="cursor-pointer flex items-center gap-1"
                  style={{
                    fontSize: '0.75rem',
                    color: '#737373',
                    background: 'none',
                    border: 'none',
                    padding: 0,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#404040'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = '#737373'; }}
                >
                  <RotateCcw size={12} />
                  Reset
                </button>
              )}
            </div>
            <textarea
              value={localSystemPrompt}
              onChange={(e) => setLocalSystemPrompt(e.target.value)}
              rows={3}
              style={{
                ...inputStyle,
                resize: 'vertical',
                minHeight: 72,
                fontFamily: "'SF Mono', 'Fira Code', Consolas, monospace",
                fontSize: '0.8125rem',
                lineHeight: 1.5,
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#3b82f6'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = '#d4d4d4'; }}
            />
            <p style={{ fontSize: '0.6875rem', color: '#a3a3a3', marginTop: 4 }}>
              Instructions sent to the AI before each explanation request.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Surrounding Context</label>
              <span
                style={{
                  fontSize: '0.75rem',
                  color: '#3b82f6',
                  fontWeight: 500,
                  background: '#eff6ff',
                  padding: '2px 8px',
                  borderRadius: 9999,
                }}
              >
                {contextLabel(localContextAmount)}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={localContextAmount}
              onChange={(e) => setLocalContextAmount(Number(e.target.value))}
              style={{
                width: '100%',
                accentColor: '#171717',
                cursor: 'pointer',
              }}
            />
            <div className="flex justify-between" style={{ fontSize: '0.6875rem', color: '#a3a3a3', marginTop: 2 }}>
              <span>None</span>
              <span>Whole page</span>
            </div>
            <p style={{ fontSize: '0.6875rem', color: '#a3a3a3', marginTop: 4 }}>
              How much of the surrounding document text to send alongside the word/phrase for better AI explanations.
            </p>
          </div>

          {/* Footer */}
          <div
            style={{
              borderTop: '1px solid #f0f0f0',
              paddingTop: 16,
              marginTop: 16,
            }}
          >
            <p style={{ fontSize: '0.75rem', color: '#737373', lineHeight: 1.5 }}>
              Keys are stored locally in your browser. Never sent to our servers.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}