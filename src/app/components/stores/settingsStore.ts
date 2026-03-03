import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const DEFAULT_SYSTEM_PROMPT =
  'You explain words and phrases simply and clearly. Keep explanations concise (2-3 sentences).';

export const GROQ_MODELS = [
  { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant' },
  { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B Versatile' },
  { id: 'llama-3.1-70b-versatile', label: 'Llama 3.1 70B Versatile' },
  { id: 'gemma2-9b-it', label: 'Gemma 2 9B' },
  { id: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B' },
] as const;

export const OPENROUTER_MODELS = [
  { id: 'meta-llama/llama-3.1-8b-instruct:free', label: 'Llama 3.1 8B (Free)' },
  { id: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B' },
  { id: 'google/gemini-2.0-flash-001', label: 'Gemini 2.0 Flash' },
  { id: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet' },
  { id: 'openai/gpt-4o-mini', label: 'GPT-4o Mini' },
  { id: 'openai/gpt-4o', label: 'GPT-4o' },
  { id: 'mistralai/mistral-small-latest', label: 'Mistral Small' },
] as const;

interface SettingsState {
  groqApiKey: string | null;
  openRouterApiKey: string | null;
  preferredProvider: 'groq' | 'openrouter';
  groqModel: string;
  openRouterModel: string;
  systemPrompt: string;
  contextAmount: number;

  setGroqApiKey: (key: string) => void;
  setOpenRouterApiKey: (key: string) => void;
  clearApiKeys: () => void;
  setPreferredProvider: (provider: 'groq' | 'openrouter') => void;
  setGroqModel: (model: string) => void;
  setOpenRouterModel: (model: string) => void;
  setSystemPrompt: (prompt: string) => void;
  setContextAmount: (amount: number) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      groqApiKey: null,
      openRouterApiKey: null,
      preferredProvider: 'groq',
      groqModel: 'llama-3.1-8b-instant',
      openRouterModel: 'meta-llama/llama-3.1-8b-instruct:free',
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      contextAmount: 25,

      setGroqApiKey: (key) => set({ groqApiKey: key }),
      setOpenRouterApiKey: (key) => set({ openRouterApiKey: key }),
      clearApiKeys: () => set({ groqApiKey: null, openRouterApiKey: null }),
      setPreferredProvider: (provider) => set({ preferredProvider: provider }),
      setGroqModel: (model) => set({ groqModel: model }),
      setOpenRouterModel: (model) => set({ openRouterModel: model }),
      setSystemPrompt: (prompt) => set({ systemPrompt: prompt }),
      setContextAmount: (amount) => set({ contextAmount: amount }),
    }),
    { name: 'strings-attached-settings' }
  )
);