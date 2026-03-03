// Barrel export for all stores and types
export { useDocumentStore } from './documentStore';
export { useAppStore } from './appStore';
export type { PendingPull } from './appStore';
export { useCanvasStore } from './canvasStore';
export type { CanvasData } from './canvasStore';
export { isDocNode } from './canvasStore';
export {
  useSettingsStore,
  DEFAULT_SYSTEM_PROMPT,
  GROQ_MODELS,
  OPENROUTER_MODELS,
} from './settingsStore';

export type {
  DocumentData,
  DocumentTab,
  Highlight,
  Annotation,
  ExplanationNodeData,
  ToolType,
  HighlightColor,
  NodeTabKey,
} from './types';

export { HIGHLIGHT_COLORS, NODE_TAB_COLORS } from './types';

// ─── Sample Content ──────────────────────────────────────────────
export const INITIAL_CONTENT = `# The Arc of Interface Design: From Pixel Grids to Spatial Computing (2000–2026)

The story of user interface design across the first quarter of the twenty-first century is, at its core, a story about **trust** — the slow, sometimes painful process by which designers learned to trust users, users learned to trust software, and both learned to trust the devices that mediate between them. What began as a world of beveled buttons and drop-shadow toolbars has become something almost unrecognizable: fluid, adaptive, and increasingly *invisible*.

---

## 1. The Skeuomorphic Era (2000–2012)

### Textures, Shadows, and the Comfort of the Familiar

When Apple shipped **Mac OS X** in 2001, it introduced a visual language called *Aqua* — translucent buttons that looked like drops of water sitting on glass. Microsoft followed with **Windows XP's** Luna theme: candy-colored title bars, rounded start buttons, and a desktop wallpaper of rolling green hills that became one of the most-viewed photographs in history.

These interfaces were **skeuomorphic** in the deepest sense:

- The \`Recycle Bin\` looked like a physical trash can.
- Calendar apps displayed torn paper edges and stitched leather.
- Audio software rendered brushed-aluminum knobs you could *rotate* with your mouse.

> "We made things look real because people didn't yet believe the screen was a place where real work happened."
> — A former Apple HIG team member, speaking at WWDC 2014

The philosophy was **reassurance through metaphor**. If a note-taking app looked like a yellow legal pad, you already knew how to use it.

#### Key Characteristics

| Trait | Example | Purpose |
|---|---|---|
| Texture mapping | Leather, linen, wood grain | Emotional warmth |
| Highlight/shadow pairs | Embossed buttons | Affordance signaling |
| Physical metaphor | Bookshelf for iBooks | Conceptual grounding |
| Glossy reflections | Aqua buttons, dock icons | Premium perception |

### The Web's Parallel Path

On the web, the early 2000s were defined by **Flash intros**, animated GIF dividers, and nested \`<table>\` layouts. The phrase *"Best viewed in Internet Explorer 6 at 1024×768"* was printed, without irony, at the bottom of corporate homepages.

Then came **Web 2.0** — a term coined around 2004 — and with it a new aesthetic:

1. **Rounded corners** (via CSS hacks or, more often, sliced PNGs)
2. **Gradient backgrounds** — the "wet floor" reflection effect
3. **Large, friendly typography** — Lucida Grande, Verdana
4. **"Beta" badges** — the permanent beta as identity

Frameworks like **jQuery UI** (2007) gave developers drag-and-drop widgets, accordion panels, and date pickers — all skinned with a chunky, tactile visual style that echoed desktop conventions.

---

## 2. The Flat Revolution (2012–2016)

### Killing the Metaphor

In June 2013, Apple unveiled **iOS 7**, and the design world split in two. Jony Ive's team stripped away every leather stitch and felt texture, replacing them with thin sans-serif type, translucent panels, and a palette of neon gradients. It was controversial — even *polarizing*.

Microsoft had actually arrived first. **Windows 8** (2012) and its *Metro* design language were radically flat: solid-colored tiles, sharp corners, Segoe UI in light weights, and a complete rejection of depth cues. Metro was:

- **Typographically driven** — large headers, generous whitespace
- **Content-first** — chrome was minimized to near-invisibility
- **Grid-based** — the "live tile" concept organized information into a spatial dashboard

Google joined with **Material Design** (2014), which tried to split the difference. It was "flat" in that it eliminated skeuomorphic textures, but it preserved a *paper metaphor*: surfaces had elevation, cast shadows, and responded to touch with radial ink ripples. The key innovation was treating UI as a system of **layered sheets** at specific z-index altitudes:

\`\`\`
z = 0dp   →   Background canvas
z = 2dp   →   Cards, raised buttons
z = 8dp   →   Menus, dropdowns
z = 16dp  →   Navigation drawers
z = 24dp  →   Dialogs, modals
\`\`\`

### The Accessibility Reckoning

Flat design looked beautiful in Dribbble mockups. In practice, it created serious usability problems:

- **Ghost buttons** (text-only, borderless) were indistinguishable from labels
- **Low-contrast text** (light gray on white) failed WCAG guidelines
- **Removed affordances** meant users couldn't tell what was tappable

Research from the **Nielsen Norman Group** in 2015 showed that flat interfaces increased average task-completion time by **22%** for first-time users compared to their skeuomorphic predecessors. The industry was forced to reckon with a hard truth: *aesthetics and usability are not the same axis*.

---

## 3. The Mature Middle Ground (2016–2020)

### Flat 2.0: Depth Without Decoration

The backlash against pure flat design produced a synthesis. Designers began reintroducing depth cues — subtle shadows, layered cards, micro-interactions — without reverting to skeuomorphism. This informal movement was sometimes called **"Flat 2.0"** or **"Almost Flat"**.

Apple's own evolution illustrates the arc:

- **iOS 7** (2013): Ultra-flat, thin type, vibrant colors
- **iOS 10** (2016): Cards with rounded corners and soft shadows
- **iOS 13** (2019): Dark mode, volumetric icons, system-wide depth hierarchy

The **design system era** truly began here. Companies realized that scaling design across dozens of products required shared, codified vocabularies:

- **IBM Carbon** (2017) — grid-obsessed, accessibility-first
- **Shopify Polaris** (2017) — opinionated about merchant experience
- **Atlassian Design System** (2018) — token-based, themeable
- **GitHub Primer** (2019) — utility-class driven, tightly coupled to code

Design tokens — named values for colors, spacing, typography — replaced one-off hex codes. A button's background was no longer \`#0066cc\`; it was \`--color-action-primary\`, resolvable differently in light mode, dark mode, and high-contrast mode.

### The Rise of Component Thinking

React (2013) and the component model it popularized changed how designers *thought*, not just how engineers built. A button was no longer a rectangle drawn in Photoshop; it was a **stateful entity** with:

- Variants (primary, secondary, ghost, danger)
- States (default, hover, focus, active, disabled, loading)
- Slots (leading icon, label, trailing icon, badge)
- Responsive behavior (full-width on mobile, inline on desktop)

Tools like **Figma** (which hit critical mass around 2018) made this thinking native to the design process: auto-layout, component properties, interactive prototyping, and — crucially — *multiplayer collaboration* in real time.

> The gap between "designing" and "building" began to close. Not because designers learned to code, but because the *abstractions converged*.

---

## 4. Dark Mode, Accessibility, and Inclusive Design (2018–2022)

### When the Lights Went Out

Apple introduced **system-wide dark mode** in macOS Mojave (2018) and iOS 13 (2019). Google followed with Android 10. Suddenly, every app needed *two* visual identities — and the ones that handled it gracefully earned trust, while the ones that shipped a jarring, half-baked inversion lost it.

Dark mode wasn't just an aesthetic preference. Research suggested it could:

1. Reduce eye strain in low-light environments
2. Save battery life on OLED displays (where black pixels are truly *off*)
3. Improve readability for users with certain visual impairments

But it also exposed how fragile many designs were. Hard-coded colors broke. Shadows became invisible against dark backgrounds. Designers learned, painfully, that **color is relational**, not absolute.

### Accessibility as a Design Principle

The period from 2018 to 2022 saw accessibility shift from a compliance checkbox to a **design philosophy**. Several forces drove this:

- **Legal pressure**: Lawsuits under the ADA (Americans with Disabilities Act) against inaccessible websites surged, reaching over 4,000 in the US by 2021
- **Platform enforcement**: Apple and Google began rejecting apps that failed basic accessibility audits
- **Moral clarity**: The pandemic made digital interfaces the *only* interface for millions of people — banking, healthcare, education, social connection

Key accessibility patterns that became standard:

- **Focus indicators**: Visible, high-contrast outlines for keyboard navigation
- **Reduced motion**: \`prefers-reduced-motion\` media query support
- **Semantic HTML**: Proper heading hierarchy, ARIA landmarks, labeled form controls
- **Color independence**: Never conveying meaning *only* through color

---

## 5. The Spatial Turn (2022–2026)

### Beyond the Rectangle

The announcement of **Apple Vision Pro** in June 2023 marked the most significant shift in UI paradigm since the iPhone. While mixed-reality headsets had existed for years, Apple's contribution was a *design language* for spatial computing: windows that floated in physical space, eye-tracking as a primary input, and hand gestures that replaced the tap.

This forced the industry to reconsider fundamental assumptions:

- **What is a "screen"?** In spatial computing, there is no screen — only surfaces anchored to the user's environment.
- **What is a "click"?** A pinch gesture, a gaze-and-dwell, a voice command.
- **What is "responsive"?** Layouts must adapt not just to viewport width, but to *distance from the user's eyes*, ambient lighting, and the physical geometry of the room.

### The AI Interface Layer

Simultaneously, the explosion of **large language models** (GPT-4, Claude, Gemini) between 2023 and 2025 introduced a new UI primitive: the **conversational interface** that actually worked. Previous chatbot UIs had been gimmicks; now they were genuinely useful — capable of understanding context, maintaining state across long conversations, and generating structured outputs.

This created a design tension:

> Should AI be a *tool* (something the user directs) or a *collaborator* (something that proposes actions)?

The answer, as of 2026, appears to be **both** — depending on the task:

| Task Type | Interaction Model | Example |
|---|---|---|
| Precise, repeatable | Direct manipulation | Dragging a layer in a design tool |
| Exploratory, open-ended | Conversational | "Help me find papers about X" |
| Routine, automatable | Agent-driven | Auto-formatting a spreadsheet |
| Creative, iterative | Co-creative | Generating then refining an image |

### The Design System Matures

By 2026, design systems have evolved from *component libraries* into **full-stack contracts** between design and engineering:

\`\`\`
Design Token  →  Figma Variable  →  CSS Custom Property  →  Runtime Value
   (source)        (design tool)       (build artifact)      (user pref)
\`\`\`

Theming is no longer "light vs. dark." It's a **multi-dimensional space**:

1. **Color scheme**: Light, dark, high-contrast, user-custom
2. **Density**: Compact, comfortable, spacious
3. **Motion**: Full, reduced, none
4. **Typography**: System default, dyslexia-friendly, large print
5. **Locale**: LTR, RTL, CJK vertical

Tools like **Figma's Code Connect** (2024) and **Tokens Studio** bridge the gap between design intent and production code — not by generating code from designs, but by ensuring both reference the same token definitions.

---

## 6. Principles That Endured

Across all these shifts — skeuomorphism to flat, flat to spatial, mouse to touch to gaze — certain principles have remained constant:

1. **Feedback is non-negotiable.** Users must always know what just happened, what is happening now, and what they can do next.
2. **Consistency reduces cognitive load.** Whether through a design system or a platform convention, predictability is a feature.
3. **Progressive disclosure wins.** Show the simple thing first; reveal complexity on demand.
4. **Performance is a design decision.** A beautiful interface that takes three seconds to respond is a *bad* interface.
5. **Accessibility is not a feature; it is a quality.** Like structural integrity in architecture, it's not optional.

> "The best interface is the one you've already forgotten you're using."

---

## Looking Ahead

As of early 2026, the frontier of UI design is defined by three converging forces:

- **Spatial computing** — interfaces that exist in physical space, not just on screens
- **AI-native interaction** — systems that understand intent, not just input
- **Adaptive personalization** — UIs that reshape themselves to individual users' needs, abilities, and contexts

The rectangle isn't dead — most of us still work on flat screens most of the time. But the *assumption* that UI equals a rectangular viewport is fading. The next chapter of interface design will be written not in pixels, but in *relationships*: between the user and the system, between attention and information, between the hand and the machine.

---

*Try dragging any word out to explore its meaning, or double-click a word for an instant explanation.*`;