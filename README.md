# Strings Attached

A document viewer where you can **pull words out of text** to spawn explanation nodes on an infinite canvas, creating a visible map of your understanding.

Built in **under 48 hours** with [Figma Make](https://www.figma.com/make) for the [Contra x Figma Make-a-thon](https://contra.com).

---

## What it does

Press and drag on any word or sentence. An elastic "string" stretches from the text like taffy. Release to spawn an explanation node. Pull from that node to go deeper. Your comprehension becomes a spatial artifact.

### Two views, one document

- **Classic Reader** — A clean, scrollable document viewer with an annotation sidebar. Highlight words, sentences, or lasso-select regions. Every annotation silently spawns a linked node on the canvas.
- **Infinite Canvas** — All your pulled words live here as draggable, resizable nodes connected by animated string edges. Rearrange, annotate, and explore recursively.

### Core interactions

| Zone | Action |
|------|--------|
| Click a **word** | Taffy-drag it out to spawn a single-word explanation node |
| Click inside a **sentence** | Drag the full sentence as an inline string |
| Drag on **whitespace** | Rectangle-lasso selection with floating word count |
| **Annotate mode** | Same 3 zones, but creates sidebar annotations + canvas nodes simultaneously |

### Features

- Markdown and LaTeX rendering (ReactMarkdown + KaTeX + MathLive)
- PDF upload support
- Per-node tabbed UI (Explain / Define / Ask / Notes) with dynamic color theming
- String edges with draw-on animation and closest-point-on-perimeter source anchoring
- Pulled-word glow highlights (3-layer pulsing text-shadow, color-synced to node tab)
- Apple-quality node spawn animation (blur-in, scale overshoot, shadow emergence)
- Taffy stretch-drag with spring physics (droop, micro-sway, scaleX/scaleY deformation)
- Global search (Cmd+K) across documents, nodes, and annotations
- Save/load workspace as `.strings` files (v2 format with v1 migration)
- Undo toast on annotation creation (removes node + edges + highlights)
- Keyboard shortcuts throughout

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript |
| Styling | Tailwind CSS v4 |
| Canvas | @xyflow/react v12 |
| State | Zustand (with persist middleware) |
| Data fetching | @tanstack/react-query |
| Math | KaTeX + MathLive v0.108 |
| Markdown | react-markdown + remark-math + rehype-katex |
| Icons | lucide-react |
| Build | Vite |

---

## Architecture

```
src/app/
  App.tsx                        # Root with mode switching (classic/canvas)
  components/
    stores/                      # Zustand stores
      appStore.ts                #   App-level state (mode, active tool, pending pulls)
      canvasStore.ts             #   Per-document canvas state (canvasMap keyed by docId)
      documentStore.ts           #   Documents, tabs, annotations
    layout/                      # Shell, header, tab bar
    toolbar/                     # Floating toolbar (select/annotate mode toggle)
    viewer/                      # ClassicView with annotation sidebar
    InfiniteCanvas.tsx           # @xyflow/react canvas with per-doc read/write
    ExplanationNode.tsx          # Tabbed explanation node (Explain/Define/Ask/Notes)
    DocumentNode.tsx             # Source document rendered on canvas
    StringEdge.tsx               # Animated string edges with perimeter anchoring
    TextContent.tsx              # 3-zone text interaction (word/sentence/lasso)
    NotesEditor.tsx              # Shared markdown/math editor (used in nodes + sidebar)
    GlobalSearchModal.tsx        # Cmd+K spotlight search
    utils/
      stretchDrag.ts             # Taffy stretch-drag animation (spring physics)
      canvasUtils.ts             # Shared node spawning logic
      fileFormat.ts              # .strings file serialization (v2 + v1 migration)
    hooks/
      useGlobalSearch.ts         # Cross-document/node/annotation search
    useRectangleSelection.ts     # Lasso selection with word count badge
```

---

## License

MIT
