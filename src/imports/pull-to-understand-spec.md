# Pull to Understand — Technical Specification

## Overview

**Product Name:** Pull to Understand (working title)

**One-liner:** A document viewer where you can pull words out of text to spawn explanation nodes on an infinite canvas, creating a visible map of your understanding.

**Core interaction:** Press and drag on any word or sentence. An elastic "string" stretches from the text. Release to spawn an explanation node. Repeat recursively. Your comprehension becomes a spatial artifact.

---

## Tech Stack

```json
{
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "@xyflow/react": "^12.0.0",
    "@use-gesture/react": "^10.3.0",
    "framer-motion": "^11.0.0",
    "zustand": "^4.5.0",
    "react-pdf": "^7.7.0",
    "pdfjs-dist": "^3.11.0",
    "@tanstack/react-query": "^5.0.0",
    "lucide-react": "^0.400.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.3.0"
  },
  "devDependencies": {
    "vite": "^5.0.0",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "typescript": "^5.4.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0"
  }
}
```

---

## Design System

### Color Palette

```css
:root {
  /* Neutrals - Primary UI */
  --gray-50: #fafafa;
  --gray-100: #f5f5f5;
  --gray-200: #e5e5e5;
  --gray-300: #d4d4d4;
  --gray-400: #a3a3a3;
  --gray-500: #737373;
  --gray-600: #525252;
  --gray-700: #404040;
  --gray-800: #262626;
  --gray-900: #171717;
  
  /* Accent - Used sparingly */
  --blue-500: #3b82f6;
  --blue-600: #2563eb;
  
  /* Canvas */
  --canvas-bg: #fafafa;
  --canvas-dot: #e5e5e5;
  
  /* Surfaces */
  --surface-primary: #ffffff;
  --surface-secondary: #fafafa;
  --surface-hover: #f5f5f5;
  
  /* Borders */
  --border-subtle: #e5e5e5;
  --border-default: #d4d4d4;
  
  /* Shadows */
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.07);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.07), 0 4px 6px -4px rgb(0 0 0 / 0.07);
  --shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.08), 0 8px 10px -6px rgb(0 0 0 / 0.08);
}
```

### Typography

```css
:root {
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-mono: 'SF Mono', 'Fira Code', 'Consolas', monospace;
  
  /* Scale */
  --text-xs: 0.75rem;     /* 12px */
  --text-sm: 0.875rem;    /* 14px */
  --text-base: 1rem;      /* 16px */
  --text-lg: 1.125rem;    /* 18px */
  --text-xl: 1.25rem;     /* 20px */
  --text-2xl: 1.5rem;     /* 24px */
  
  /* Line heights */
  --leading-tight: 1.25;
  --leading-normal: 1.5;
  --leading-relaxed: 1.625;
  
  /* Font weights */
  --font-normal: 400;
  --font-medium: 500;
  --font-semibold: 600;
}
```

### Spacing

Use Tailwind's default spacing scale. Key values:
- `4px` (1) — micro spacing
- `8px` (2) — tight spacing
- `12px` (3) — compact spacing  
- `16px` (4) — default spacing
- `24px` (6) — comfortable spacing
- `32px` (8) — section spacing
- `48px` (12) — large spacing

### Border Radius

```css
--radius-sm: 6px;
--radius-md: 8px;
--radius-lg: 12px;
--radius-xl: 16px;
--radius-full: 9999px;
```

### Shadows

Only use the defined shadow variables. Never use arbitrary shadows. Shadows should feel like soft ambient occlusion, not hard drop shadows.

### Icons

Use `lucide-react` exclusively. Icon sizes:
- `16px` — inline with text
- `20px` — buttons, UI elements
- `24px` — prominent actions

Stroke width: `1.5` (default) or `2` for emphasis.

---

## Application Modes

### Mode: Classic

Standard document viewer. Vertical scroll. No canvas visible. Familiar reading experience.

```
┌─────────────────────────────────────────────────────────────┐
│  [Mode Toggle: Classic | Canvas]              [Settings ⚙]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│    Lorem ipsum dolor sit amet, consectetur adipiscing       │
│    elit. Sed do eiusmod tempor incididunt ut labore.       │
│                                                             │
│    ← Standard scrollable document                           │
│    ← Words are hoverable                                    │
│    ← Dragging a word transitions to Canvas mode             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Mode: Canvas

Infinite canvas with the document as a node. Pan, zoom, nodes, edges visible.

```
┌─────────────────────────────────────────────────────────────┐
│  [Mode Toggle: Classic | Canvas]              [Settings ⚙]  │
├───────────────────────────────────────────────────────────┬─┤
│ · · · · · · · · · · · · · · · · · · · · · · · · · · · · · │▲│
│ · · · ┌──────────────────┐ · · · · · · · · · · · · · · · ·│ │
│ · · · │ Lorem ipsum dolor│ · · · · ┌─────────────┐ · · · ·│ │
│ · · · │ sit amet...      │─────────│ consectetur │ · · · ·│ │
│ · · · │                  │         │ ─────────── │ · · · ·│ │
│ · · · │                  │         │ definition  │ · · · ·│ │
│ · · · └──────────────────┘         └─────────────┘ · · · ·│ │
│ · · · · · · · · · · · · · · · · · · · · · · · · · · · · · │▼│
└───────────────────────────────────────────────────────────┴─┘
```

### Mode Transitions

**Classic → Canvas (triggered by drag or mode toggle):**
1. Document view smoothly zooms out (scale 1 → 0.9 over 300ms)
2. Document gains subtle border and shadow (it's now a "node")
3. Canvas background (dot grid) fades in behind (opacity 0 → 1 over 200ms)
4. Canvas controls appear

**Canvas → Classic (triggered by mode toggle only):**
1. All nodes and edges fade out (opacity 1 → 0 over 200ms) — NOT deleted, just hidden
2. Document zooms back in (scale 0.9 → 1 over 300ms)
3. Canvas background fades out
4. Returns to normal scroll behavior

---

## Component Architecture

```
src/
├── components/
│   ├── ui/                      # Primitive UI components
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Tabs.tsx
│   │   ├── Modal.tsx
│   │   ├── Tooltip.tsx
│   │   └── IconButton.tsx
│   │
│   ├── layout/
│   │   ├── AppShell.tsx         # Main app container
│   │   ├── Header.tsx           # Top bar with mode toggle, settings
│   │   └── SettingsModal.tsx    # API key configuration
│   │
│   ├── document/
│   │   ├── DocumentView.tsx     # Classic mode document renderer
│   │   ├── TextContent.tsx      # Renders text with hoverable words
│   │   ├── PdfContent.tsx       # Renders PDF pages
│   │   ├── WordSpan.tsx         # Individual hoverable word
│   │   └── SentenceSpan.tsx     # Sentence container
│   │
│   ├── canvas/
│   │   ├── InfiniteCanvas.tsx   # ReactFlow wrapper
│   │   ├── CanvasBackground.tsx # Dot grid background
│   │   ├── DocumentNode.tsx     # Document as a canvas node
│   │   ├── ExplanationNode.tsx  # Spawned explanation node
│   │   ├── StringEdge.tsx       # Custom edge (the "string")
│   │   └── GhostElements.tsx    # Multiplayer ghost nodes (future)
│   │
│   ├── interaction/
│   │   ├── DragOverlay.tsx      # The elastic string during drag
│   │   ├── HoverHighlight.tsx   # Word/sentence highlight on hover
│   │   └── usePullGesture.ts    # Core drag gesture hook
│   │
│   └── explanation/
│       ├── ExplanationContent.tsx   # Content inside explanation node
│       ├── DictionaryTab.tsx
│       ├── AiExplainTab.tsx
│       └── LoadingState.tsx
│
├── stores/
│   ├── useAppStore.ts           # Global app state
│   ├── useCanvasStore.ts        # Canvas nodes/edges state
│   └── useSettingsStore.ts      # User settings (API keys)
│
├── hooks/
│   ├── useDictionary.ts         # Dictionary API hook
│   ├── useAiExplain.ts          # LLM explanation hook
│   ├── useTextSelection.ts      # Word/sentence detection
│   └── useCanvasTransition.ts   # Mode transition logic
│
├── lib/
│   ├── api.ts                   # API clients
│   ├── textProcessing.ts        # Text parsing utilities
│   ├── springPhysics.ts         # Animation calculations
│   └── cn.ts                    # clsx + tailwind-merge utility
│
├── types/
│   └── index.ts                 # TypeScript types
│
├── App.tsx
├── main.tsx
└── index.css
```

---

## State Management

### App Store (useAppStore)

```typescript
interface AppState {
  // Mode
  mode: 'classic' | 'canvas';
  setMode: (mode: 'classic' | 'canvas') => void;
  
  // Document
  document: DocumentData | null;
  setDocument: (doc: DocumentData) => void;
  
  // Active drag state
  activeDrag: {
    sourceNodeId: string;
    sourceText: string;
    sourceType: 'word' | 'sentence';
    sourceBounds: DOMRect;
    currentPosition: { x: number; y: number };
  } | null;
  startDrag: (drag: Omit<ActiveDrag, 'currentPosition'>) => void;
  updateDragPosition: (position: { x: number; y: number }) => void;
  endDrag: () => void;
}

interface DocumentData {
  id: string;
  type: 'markdown' | 'pdf';
  content: string;           // Raw markdown or base64 PDF
  title?: string;
}
```

### Canvas Store (useCanvasStore)

```typescript
interface CanvasState {
  nodes: Node[];
  edges: Edge[];
  
  // Node operations
  addNode: (node: Node) => void;
  updateNodePosition: (id: string, position: XYPosition) => void;
  removeNode: (id: string) => void;
  
  // Edge operations
  addEdge: (edge: Edge) => void;
  removeEdge: (id: string) => void;
  
  // Viewport
  viewport: { x: number; y: number; zoom: number };
  setViewport: (viewport: Viewport) => void;
}

interface ExplanationNodeData {
  sourceText: string;
  sourceType: 'word' | 'sentence';
  sourceNodeId: string;
  createdAt: number;
  // Future: createdBy for multiplayer
}
```

### Settings Store (useSettingsStore)

```typescript
interface SettingsState {
  // API Keys (stored in localStorage)
  groqApiKey: string | null;
  openRouterApiKey: string | null;
  
  setGroqApiKey: (key: string) => void;
  setOpenRouterApiKey: (key: string) => void;
  clearApiKeys: () => void;
  
  // Preferences
  preferredProvider: 'groq' | 'openrouter';
  setPreferredProvider: (provider: 'groq' | 'openrouter') => void;
}
```

Store persistence for settings:
```typescript
// useSettingsStore.ts
import { persist } from 'zustand/middleware';

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      groqApiKey: null,
      openRouterApiKey: null,
      preferredProvider: 'groq',
      // ... setters
    }),
    {
      name: 'pull-to-understand-settings',
    }
  )
);
```

---

## Core Interaction: Pull Gesture

### Phase 1: Hover Detection

**Word detection:**
- Each word is wrapped in a `<span>` with class `word`
- On hover, word gets highlighted
- Highlight: `background: var(--gray-100)`, `border-radius: 4px`, `padding: 0 2px`
- Transition: `background 150ms ease`

**Sentence detection:**
- If cursor is between words (not directly over a word), highlight the entire sentence
- Sentence boundary: text between punctuation marks (. ! ?)
- Same highlight style, but encompasses multiple words

**Implementation:**
```typescript
// In TextContent.tsx
const handleMouseMove = (e: React.MouseEvent) => {
  const target = e.target as HTMLElement;
  
  if (target.classList.contains('word')) {
    setHoveredElement({ type: 'word', element: target, text: target.textContent });
  } else if (target.closest('.sentence')) {
    const sentence = target.closest('.sentence') as HTMLElement;
    setHoveredElement({ type: 'sentence', element: sentence, text: sentence.textContent });
  } else {
    setHoveredElement(null);
  }
};
```

### Phase 2: Drag Initiation

**Trigger:** Mouse down + drag on highlighted word/sentence (any mouse button)

**On drag start:**
1. Get the bounding rect of the source element
2. Create a visual "placeholder" where the text was:
   - Same dimensions as original text
   - `background: var(--gray-100)`
   - `border-radius: 4px`
   - Text inside becomes `color: var(--blue-500)`
3. Switch to canvas mode if not already
4. Start rendering the elastic string overlay

### Phase 3: Elastic String Animation

The string is the hero. It must feel physical.

**During drag, render:**
1. A curved path from source to cursor
2. The text of the word/sentence displayed along the path
3. Letters compress as the string stretches

**Path calculation:**
```typescript
const calculateStringPath = (
  source: { x: number; y: number },
  target: { x: number; y: number }
) => {
  const distance = Math.hypot(target.x - source.x, target.y - source.y);
  const midX = (source.x + target.x) / 2;
  
  // Droop increases with distance, but caps out
  const droop = Math.min(distance * 0.15, 60);
  const midY = Math.max(source.y, target.y) + droop;
  
  // Quadratic bezier curve
  return `M ${source.x} ${source.y} Q ${midX} ${midY} ${target.x} ${target.y}`;
};
```

**Letter compression:**
```typescript
const calculateLetterSpacing = (distance: number, textLength: number) => {
  const baseSpacing = 1; // em
  const compressionFactor = Math.max(0.1, 1 - (distance / 500));
  return baseSpacing * compressionFactor;
};
```

**SVG implementation:**
```tsx
<svg className="pointer-events-none fixed inset-0 z-50">
  <defs>
    <path id="stringPath" d={pathD} />
  </defs>
  
  {/* String line */}
  <path
    d={pathD}
    fill="none"
    stroke="var(--blue-500)"
    strokeWidth={2}
    strokeLinecap="round"
  />
  
  {/* Text along path */}
  <text
    fill="var(--blue-500)"
    fontSize={14}
    fontWeight={500}
    letterSpacing={letterSpacing}
  >
    <textPath href="#stringPath" startOffset="50%" textAnchor="middle">
      {sourceText}
    </textPath>
  </text>
</svg>
```

### Phase 4: Release — Node Spawn

**On mouse up:**

1. **String settles:** Animate the path to its final "resting" curve with spring physics
   - `framer-motion` spring: `{ stiffness: 300, damping: 25 }`
   - Duration: ~400ms

2. **Node spawns:** At the release position
   - Initial state: `scale: 0.8`, `opacity: 0`
   - Animate to: `scale: 1`, `opacity: 1`
   - Spring: `{ stiffness: 400, damping: 30 }`
   - Duration: ~300ms

3. **Edge created:** Connect source word to new node
   - The edge uses the custom `StringEdge` component
   - String appears to "attach" to both ends

4. **Placeholder resolves:** The source text returns to normal (no longer highlighted blue)
   - Fade transition: 200ms

### Phase 5: Recursive Pulling

Explanation nodes contain text that can also be pulled.

- Words in definition text are hoverable
- Same drag interaction works
- New nodes spawn, connected to the explanation node
- Creates a tree/graph structure

---

## Component Specifications

### Header

```
┌─────────────────────────────────────────────────────────────┐
│  ○ Pull to Understand                [Classic|Canvas]  [⚙] │
└─────────────────────────────────────────────────────────────┘
```

- Height: `56px`
- Background: `var(--surface-primary)` with `var(--border-subtle)` bottom border
- Logo/title: `var(--text-lg)`, `var(--font-semibold)`, `var(--gray-900)`
- Mode toggle: Segmented control (pill-shaped, two options)
- Settings: Icon button with `Settings` icon from lucide

**Mode Toggle (Segmented Control):**
- Container: `background: var(--gray-100)`, `border-radius: var(--radius-full)`, `padding: 4px`
- Option: `padding: 6px 16px`, `border-radius: var(--radius-full)`, `font-size: var(--text-sm)`, `font-weight: var(--font-medium)`
- Active option: `background: var(--surface-primary)`, `box-shadow: var(--shadow-sm)`
- Inactive option: `color: var(--gray-500)`
- Transition: `all 200ms ease`

### Settings Modal

```
┌───────────────────────────────────────┐
│  Settings                          ✕  │
├───────────────────────────────────────┤
│                                       │
│  API Configuration                    │
│                                       │
│  Groq API Key                         │
│  ┌─────────────────────────────────┐  │
│  │ ••••••••••••••••                │  │
│  └─────────────────────────────────┘  │
│                                       │
│  OpenRouter API Key                   │
│  ┌─────────────────────────────────┐  │
│  │                                 │  │
│  └─────────────────────────────────┘  │
│                                       │
│  Preferred Provider                   │
│  ○ Groq   ● OpenRouter                │
│                                       │
│  ─────────────────────────────────    │
│  Keys are stored locally in your      │
│  browser. Never sent to our servers.  │
│                                       │
└───────────────────────────────────────┘
```

- Modal: `max-width: 480px`, `border-radius: var(--radius-xl)`, `padding: 24px`
- Backdrop: `background: rgba(0,0,0,0.4)`, `backdrop-filter: blur(4px)`
- Entrance animation: Backdrop fades in (200ms), modal scales from 0.95 + fades in (200ms)

### Empty State (No Document)

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                                                             │
│                         📄                                  │
│                                                             │
│                   Paste or drop a document                  │
│                                                             │
│        ┌─────────────────┐    ┌─────────────────┐          │
│        │  Paste Markdown │    │   Upload PDF    │          │
│        └─────────────────┘    └─────────────────┘          │
│                                                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

Wait — no emojis. Use a lucide icon instead (`FileText` icon, 48px, `var(--gray-300)`).

- Centered vertically and horizontally
- Heading: `var(--text-lg)`, `var(--font-medium)`, `var(--gray-500)`
- Buttons: Secondary style, side by side, `gap: 12px`

**Button Styles:**

Primary:
- `background: var(--gray-900)`, `color: white`
- `padding: 10px 20px`, `border-radius: var(--radius-md)`
- `font-weight: var(--font-medium)`, `font-size: var(--text-sm)`
- Hover: `background: var(--gray-800)`
- Transition: `all 150ms ease`

Secondary:
- `background: var(--surface-primary)`, `color: var(--gray-700)`
- `border: 1px solid var(--border-default)`
- Same padding/radius/font as primary
- Hover: `background: var(--surface-hover)`, `border-color: var(--gray-400)`

### Document Node (Canvas Mode)

```
┌────────────────────────────────────────┐
│  Document Title                     ⋯  │  ← Header (drag handle)
├────────────────────────────────────────┤
│                                        │
│  Lorem ipsum dolor sit amet,           │
│  consectetur adipiscing elit. Sed      │
│  do eiusmod tempor incididunt ut       │
│  labore et dolore magna aliqua.        │
│                                        │
│  Ut enim ad minim veniam, quis         │
│  nostrud exercitation ullamco laboris  │
│  nisi ut aliquip ex ea commodo.        │
│                                        │
└────────────────────────────────────────┘
```

- `width: 480px` (fixed)
- `max-height: 600px` (scroll if taller)
- `background: var(--surface-primary)`
- `border: 1px solid var(--border-subtle)`
- `border-radius: var(--radius-lg)`
- `box-shadow: var(--shadow-lg)`
- Header: `padding: 12px 16px`, `border-bottom: 1px solid var(--border-subtle)`
- Content: `padding: 16px`, `font-size: var(--text-base)`, `line-height: var(--leading-relaxed)`

For PDF documents:
- Pages stacked vertically with `gap: 16px`
- Each page has subtle border: `border: 1px solid var(--border-subtle)`
- Page number label: small badge below each page

### Explanation Node

```
┌─────────────────────────────────┐
│  consectetur                  ⋯ │  ← Word/phrase header
├─────────────────────────────────┤
│  [Definition] [Explain] [More]  │  ← Tabs
├─────────────────────────────────┤
│                                 │
│  verb                           │
│  /kɒnˌsɛkˈtɛtər/               │
│                                 │
│  To follow; to pursue. In       │
│  modern usage, primarily        │
│  appears in Lorem Ipsum text    │
│  as placeholder.                │
│                                 │
└─────────────────────────────────┘
```

- `width: 320px` (fixed)
- `max-height: 400px` (scroll if taller)
- Same styling as Document Node
- Header shows the pulled word/phrase
- Three tabs: Definition, Explain (AI), More (if needed)

**Tabs:**
- `font-size: var(--text-sm)`
- `padding: 8px 12px`
- Active: `color: var(--gray-900)`, `border-bottom: 2px solid var(--gray-900)`
- Inactive: `color: var(--gray-500)`, no border
- Transition: `color 150ms ease`

**Loading state:**
- Skeleton lines: `background: var(--gray-100)`, `border-radius: 4px`, `height: 16px`
- Animate: pulse (opacity 0.5 → 1, 1s loop)

**Error state:**
- Icon: `AlertCircle` from lucide, `var(--gray-400)`
- Message: `var(--text-sm)`, `var(--gray-500)`
- Retry button: tertiary style (just text, underlined on hover)

### String Edge (Custom ReactFlow Edge)

The edge connecting nodes should look like a loose string with the word on it.

```tsx
const StringEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
}: EdgeProps<{ label: string }>) => {
  // Calculate droopy curve
  const midX = (sourceX + targetX) / 2;
  const distance = Math.hypot(targetX - sourceX, targetY - sourceY);
  const droop = Math.min(distance * 0.12, 40);
  const midY = Math.max(sourceY, targetY) + droop;
  
  const path = `M ${sourceX} ${sourceY} Q ${midX} ${midY} ${targetX} ${targetY}`;
  
  return (
    <g>
      {/* Path definition for text */}
      <defs>
        <path id={`path-${id}`} d={path} />
      </defs>
      
      {/* String line */}
      <path
        d={path}
        fill="none"
        stroke="#d4d4d4"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      
      {/* Label on string */}
      <text
        fontSize={11}
        fill="#737373"
        fontWeight={500}
      >
        <textPath
          href={`#path-${id}`}
          startOffset="50%"
          textAnchor="middle"
        >
          {data?.label}
        </textPath>
      </text>
    </g>
  );
};
```

### Canvas Background

Subtle dot grid pattern.

```tsx
const CanvasBackground = () => (
  <svg className="absolute inset-0 w-full h-full">
    <defs>
      <pattern
        id="dotGrid"
        x="0"
        y="0"
        width="24"
        height="24"
        patternUnits="userSpaceOnUse"
      >
        <circle cx="1" cy="1" r="1" fill="#e5e5e5" />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#dotGrid)" />
  </svg>
);
```

---

## Animation Specifications

### Spring Configurations (Framer Motion)

```typescript
export const springs = {
  // Quick, snappy responses
  snappy: { stiffness: 400, damping: 30 },
  
  // Gentle, smooth movements
  gentle: { stiffness: 200, damping: 25 },
  
  // Bouncy, playful
  bouncy: { stiffness: 300, damping: 15 },
  
  // Slow, deliberate
  slow: { stiffness: 100, damping: 20 },
};
```

### Animation Inventory

| Element | Trigger | Animation | Duration/Spring |
|---------|---------|-----------|-----------------|
| Word highlight | Hover | Background color fade | 150ms ease |
| Mode transition | Toggle/drag | Scale + opacity + background | 300ms ease-out |
| Drag overlay (string) | During drag | Path update | Immediate (every frame) |
| String settle | Release | Path spring to resting curve | `springs.gentle` |
| Node spawn | Release | Scale 0.8→1, opacity 0→1 | `springs.snappy` |
| Node drag | During drag | Position follows cursor | Immediate |
| Node delete | Delete action | Scale 1→0.9, opacity 1→0 | 150ms ease-in |
| Modal open | Click settings | Backdrop fade, modal scale+fade | 200ms ease-out |
| Modal close | Click close/backdrop | Reverse of open | 150ms ease-in |
| Tab switch | Click tab | Content crossfade | 150ms ease |
| Loading skeleton | While loading | Opacity pulse 0.5→1 | 1s infinite |
| Toast notification | On event | Slide up + fade in | 300ms ease-out |

### Drag Overlay Rendering

The elastic string during drag must render at 60fps. Use `requestAnimationFrame` and avoid React re-renders.

```typescript
// usePullGesture.ts
const bind = useDrag(({ xy: [x, y], down, first, last }) => {
  if (first) {
    // Initialize drag state
  }
  
  if (down) {
    // Update position directly (no state update)
    overlayRef.current?.updatePosition(x, y);
  }
  
  if (last) {
    // Spawn node, create edge
  }
}, {
  pointer: { capture: true },
  threshold: 5, // 5px dead zone before drag starts
});
```

---

## API Integrations

### Free Dictionary API

**Endpoint:** `https://api.dictionaryapi.dev/api/v2/entries/en/{word}`

**Response shape:**
```typescript
interface DictionaryResponse {
  word: string;
  phonetic?: string;
  phonetics: Array<{
    text?: string;
    audio?: string;
  }>;
  meanings: Array<{
    partOfSpeech: string;
    definitions: Array<{
      definition: string;
      example?: string;
    }>;
  }>;
}
```

**Implementation:**
```typescript
// hooks/useDictionary.ts
export const useDictionary = (word: string) => {
  return useQuery({
    queryKey: ['dictionary', word.toLowerCase()],
    queryFn: async () => {
      const response = await fetch(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`
      );
      
      if (!response.ok) {
        if (response.status === 404) {
          return null; // Word not found
        }
        throw new Error('Dictionary lookup failed');
      }
      
      const data: DictionaryResponse[] = await response.json();
      return data[0]; // Return first result
    },
    staleTime: Infinity, // Dictionary data doesn't change
    retry: 1,
  });
};
```

### LLM Explanation (Groq / OpenRouter)

**Groq endpoint:** `https://api.groq.com/openai/v1/chat/completions`

**OpenRouter endpoint:** `https://openrouter.ai/api/v1/chat/completions`

Both use OpenAI-compatible format.

**Implementation:**
```typescript
// hooks/useAiExplain.ts
export const useAiExplain = (
  word: string,
  context: string,
  enabled: boolean = true
) => {
  const { groqApiKey, openRouterApiKey, preferredProvider } = useSettingsStore();
  
  const apiKey = preferredProvider === 'groq' ? groqApiKey : openRouterApiKey;
  const endpoint = preferredProvider === 'groq'
    ? 'https://api.groq.com/openai/v1/chat/completions'
    : 'https://openrouter.ai/api/v1/chat/completions';
  
  return useQuery({
    queryKey: ['explain', word, context, preferredProvider],
    queryFn: async () => {
      if (!apiKey) {
        throw new Error('API key not configured');
      }
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: preferredProvider === 'groq' ? 'llama-3.1-8b-instant' : 'meta-llama/llama-3.1-8b-instruct:free',
          messages: [
            {
              role: 'system',
              content: 'You explain words and phrases simply and clearly. Keep explanations concise (2-3 sentences). When context is provided, explain how the word is used in that specific context.',
            },
            {
              role: 'user',
              content: context
                ? `Explain "${word}" as used in this context: "${context}"`
                : `Explain the word "${word}" simply.`,
            },
          ],
          max_tokens: 150,
          temperature: 0.3,
        }),
      });
      
      if (!response.ok) {
        throw new Error('AI explanation failed');
      }
      
      const data = await response.json();
      return data.choices[0].message.content;
    },
    enabled: enabled && !!apiKey,
    staleTime: Infinity,
    retry: 1,
  });
};
```

---

## Initial Content

Hardcode this as the default document:

```typescript
export const INITIAL_CONTENT = `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.

Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.`;
```

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Escape` | Cancel current drag, close modal |
| `Cmd/Ctrl + V` | Paste content (when no document or focused on input) |
| `Cmd/Ctrl + 1` | Switch to Classic mode |
| `Cmd/Ctrl + 2` | Switch to Canvas mode |
| `Cmd/Ctrl + ,` | Open settings |
| `Delete/Backspace` | Delete selected node (when node is selected) |

---

## Responsive Behavior

This is desktop-first. Minimum supported width: `1024px`.

Below 1024px, show a message:
```
"Pull to Understand works best on larger screens. Please use a desktop browser."
```

Center this message, use `var(--text-lg)`, `var(--gray-500)`.

---

## Error Handling

### API Errors

- Dictionary not found: Show "No definition found" in the Definition tab. Still allow AI Explain tab.
- LLM error: Show "Couldn't generate explanation. Check your API key in settings." with a retry button.
- Network error: Show "You appear to be offline." with retry button.

### Edge Cases

- Empty word (shouldn't happen): Ignore drag
- Very long selection (100+ characters): Truncate display to first 50 chars + "..."
- PDF load failure: Show error state in document area with retry option
- Invalid markdown: Render as plain text

---

## Multiplayer Accommodations (Future-Proofing)

Build with these hooks for future multiplayer:

1. **Node ownership:**
   ```typescript
   interface Node {
     // ... existing fields
     createdBy?: string; // User ID
   }
   ```

2. **User presence type:**
   ```typescript
   interface User {
     id: string;
     name: string;
     color: string;
     cursor?: { x: number; y: number };
   }
   ```

3. **Ghost elements hook:**
   ```typescript
   // Future: useMultiplayerStore or similar
   interface GhostDrag {
     userId: string;
     userColor: string;
     sourceText: string;
     sourcePosition: { x: number; y: number };
     currentPosition: { x: number; y: number };
   }
   ```

4. **Color palette for users:**
   ```typescript
   export const USER_COLORS = [
     '#ef4444', // red
     '#f97316', // orange
     '#eab308', // yellow
     '#22c55e', // green
     '#06b6d4', // cyan
     '#3b82f6', // blue
     '#8b5cf6', // violet
     '#ec4899', // pink
   ];
   ```

For now, ghost elements are not rendered. But structure the code so adding a `ghostDrags` array to state and rendering `<GhostDragOverlay>` components is straightforward.

---

## File: src/lib/cn.ts

```typescript
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

---

## Build Order

Implement in this order:

### Phase 1: Foundation
1. Set up project with all dependencies
2. Create design tokens (CSS variables in index.css)
3. Build primitive UI components (Button, IconButton, Modal, Tabs)
4. Build AppShell, Header with mode toggle
5. Build Settings modal with API key inputs
6. Create stores (app, canvas, settings)

### Phase 2: Document Viewer
1. Build empty state with paste/upload buttons
2. Build TextContent with word/sentence wrapping
3. Implement hover detection and highlighting
4. Build DocumentView (classic mode)
5. Add PDF support with react-pdf

### Phase 3: Core Interaction
1. Implement usePullGesture hook
2. Build DragOverlay (elastic string SVG)
3. Implement mode transition animation
4. Set up ReactFlow with custom node types
5. Build DocumentNode (document as a canvas node)
6. Build StringEdge (custom edge)
7. Implement node spawning on drag release

### Phase 4: Explanation Nodes
1. Build ExplanationNode component
2. Build tabs (Definition, Explain)
3. Implement useDictionary hook
4. Implement useAiExplain hook
5. Handle loading/error states
6. Enable recursive pulling from explanation nodes

### Phase 5: Polish
1. Fine-tune all animations (springs, timing)
2. Add keyboard shortcuts
3. Test and fix edge cases
4. Performance optimization (memoization, etc.)
5. Final visual polish pass

---

## Testing the Demo

For the demo/video, use this flow:

1. App loads with empty state
2. Click "Paste Markdown" → paste some dense text (or use the Lorem Ipsum default)
3. Hover over a word → see the highlight
4. Drag the word out → elastic string stretches
5. Release → node spawns with definition
6. Click "Explain" tab → see AI explanation (requires API key)
7. Drag a word from the explanation → recursive node
8. Toggle to Classic mode → nodes fade out, back to reading
9. Toggle to Canvas mode → nodes fade back in, tree is preserved

---

This should be everything. Build it clean, build it smooth.