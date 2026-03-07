# feat-001: Monorepo Scaffold — Design Spec

**Spec ID:** feat-001-design
**Feature:** Monorepo Scaffold — Frontend Design System Bootstrap
**Status:** Ready for Implementation
**Depends on:** feat-001-spec.md, specs/standards/brand.md (L2-001)
**Required by:** feat-003 (Component Library), feat-004 (App Shell)

---

## 1. Overview

feat-001 is a **technical foundation feature**. The primary outputs are the monorepo scaffold, backend Express server, and frontend Vite/React setup. The frontend UI deliverable for this feature is deliberately minimal: a placeholder `App.tsx` that proves the stack works end-to-end and establishes the design token foundation.

The design system tokens are declared in this feature so that every subsequent feature inherits the correct semantic layer from day one. No component library is built here — that is feat-003. No navigation shell is built here — that is feat-004.

**Frontend files in scope for this design spec:**

| File | Purpose |
| ---- | ------- |
| `packages/frontend/src/styles/tokens.css` | CSS custom properties for all Tier 1 and Tier 2 brand tokens |
| `packages/frontend/src/styles/global.css` | Global resets, font imports, body defaults |
| `packages/frontend/src/App.tsx` | Root component wiring router |
| `packages/frontend/src/routes/HomePage.tsx` | Placeholder page rendered at `/` |

**Not in scope for this design spec:**

- Navigation components (feat-004)
- Any component library primitives (feat-003)
- Route-specific page designs beyond the placeholder
- Light theme overrides (exception contexts — email, PDF, embedded widgets)

---

## 2. CSS Custom Properties Setup

### File: `packages/frontend/src/styles/tokens.css`

This file is the single source of truth for all design tokens in the frontend. It declares Tier 1 identity tokens as raw values, then declares Tier 2 semantic tokens that reference the Tier 1 values via `var()`.

Component code must only consume Tier 2 tokens. Direct use of Tier 1 tokens in component stylesheets is a spec violation (L2-001 Section 8).

The CSS custom property approach is used because Tailwind CSS v4 consumes CSS variables natively, and it allows the semantic layer to be updated by changing one mapping without touching component code.

```css
/* ==========================================================================
   TIER 1 — Identity Tokens (Brand Reference)
   Raw values from the brand guidelines. DO NOT reference these in component
   code. Use only Tier 2 semantic tokens below.
   ========================================================================== */

:root {
  /* Deep Space — Foundation */
  --void: #060A14;
  --deep-space: #0B1628;
  --nebula: #0E2040;
  --orbit: #1A3A6E;

  /* Launch Fire — Energy */
  --launchfire: #FF5C1A;
  --ignition: #FF8C42;
  --afterburn: #FFB347;
  --red-planet: #C1440E;

  /* Metallic Silver — Trust & Finish */
  --chrome: #E8EDF5;
  --silver: #C8D0DC;
  --stardust: #8A96A8;
  --white: #F5F8FF;

  /* Mission Outcomes */
  --success: #2FE8A2;
  --success-deep: #1AB878;
  --signal-blue: #5B8FD8;

  /* Typography */
  --font-display: 'Bebas Neue', sans-serif;
  --font-body: 'DM Sans', sans-serif;
  --font-data: 'Space Mono', monospace;

  /* Motion */
  --duration-fast: 150ms;
  --duration-base: 300ms;
  --duration-medium: 500ms;
  --duration-slow: 800ms;
  --easing-out: cubic-bezier(0.25, 1, 0.5, 1);
  --easing-spring: cubic-bezier(0.34, 1.56, 0.64, 1);

  /* Radius */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 20px;
  --radius-2xl: 24px;
  --radius-full: 100px;
}

/* ==========================================================================
   TIER 2 — Semantic Tokens (Component Consumption Layer)
   Components consume ONLY these tokens. Never reference Tier 1 directly.
   ========================================================================== */

:root {
  /* --- Actions --- */
  --color-action-primary: var(--launchfire);
  --color-action-primary-hover: var(--ignition);
  --color-action-primary-text: var(--white);
  --color-action-primary-shadow: rgba(255, 92, 26, 0.35);
  --color-action-secondary-bg: rgba(245, 248, 255, 0.06);
  --color-action-secondary-text: var(--silver);
  --color-action-secondary-border: rgba(245, 248, 255, 0.12);
  --color-action-ghost-text: var(--ignition);
  --color-action-ghost-border: rgba(255, 92, 26, 0.30);
  --color-action-disabled: rgba(138, 150, 168, 0.50);

  /* --- Status --- */
  --color-status-success: var(--success);
  --color-status-success-bg: rgba(47, 232, 162, 0.12);
  --color-status-success-border: rgba(47, 232, 162, 0.20);
  --color-status-error: var(--red-planet);
  --color-status-warning: var(--afterburn);
  --color-status-info: var(--orbit);
  --color-status-active: var(--launchfire);
  --color-status-active-bg: rgba(255, 92, 26, 0.12);
  --color-status-active-border: rgba(255, 92, 26, 0.20);
  --color-status-new: var(--signal-blue);
  --color-status-new-bg: rgba(26, 58, 110, 0.40);
  --color-status-new-border: rgba(26, 58, 110, 0.60);

  /* --- Surfaces --- */
  --color-bg-page: var(--void);
  --color-bg-surface: var(--deep-space);
  --color-bg-elevated: var(--nebula);
  --color-bg-overlay: rgba(6, 10, 20, 0.90);
  --color-bg-input: rgba(245, 248, 255, 0.04);
  --color-bg-accent: var(--orbit);

  /* --- Text --- */
  --color-text-primary: var(--chrome);
  --color-text-secondary: var(--silver);
  --color-text-tertiary: var(--stardust);
  --color-text-accent: var(--launchfire);
  --color-text-on-action: var(--white);
  --color-text-success: var(--success);
  --color-text-error: var(--red-planet);
  --color-text-warning: var(--afterburn);

  /* --- Borders & Dividers --- */
  --color-border-subtle: rgba(245, 248, 255, 0.06);
  --color-border-emphasis: var(--orbit);
  --color-border-input: rgba(245, 248, 255, 0.10);
  --color-border-accent: var(--launchfire);

  /* --- Progress & Data Visualisation --- */
  --color-progress-fill: linear-gradient(90deg, var(--launchfire), var(--afterburn));
  --color-progress-complete: linear-gradient(90deg, var(--success), var(--success-deep));
  --color-progress-track: rgba(245, 248, 255, 0.06);
  --color-progress-indicator: var(--afterburn);
  --color-data-positive: var(--success);
  --color-data-neutral: var(--stardust);

  /* --- Gradients --- */
  --gradient-action-primary: linear-gradient(135deg, #FF5C1A, #FF8C42, #FFB347);
  --gradient-surface-card: linear-gradient(135deg, #060A14, #0E2040, #1A3A6E);
  --gradient-surface-stat: linear-gradient(135deg, var(--nebula), var(--deep-space));
  --gradient-hero: linear-gradient(135deg, #060A14 0%, #0B1628 50%, rgba(255, 92, 26, 0.15) 100%);
  --gradient-campaign-hero: linear-gradient(135deg, #C1440E, #FF5C1A, #FF8C42);
  --gradient-celebration: linear-gradient(135deg, #0B1628, rgba(47, 232, 162, 0.2), #0B1628);
  --gradient-achievement: linear-gradient(135deg, #E8EDF5, #C8D0DC, #8A96A8);

  /* --- Motion (Semantic) --- */
  --motion-enter: var(--duration-base) var(--easing-out);
  --motion-enter-emphasis: var(--duration-medium) var(--easing-spring);
  --motion-hover: var(--duration-fast) var(--easing-out);
  --motion-panel: var(--duration-medium) var(--easing-out);
  --motion-page: var(--duration-slow) var(--easing-out);

  /* --- Layout (Semantic Radius) --- */
  --radius-button: var(--radius-full);
  --radius-badge: var(--radius-sm);
  --radius-input: var(--radius-md);
  --radius-card: var(--radius-xl);
  --radius-card-large: var(--radius-2xl);
  --radius-stat: var(--radius-lg);
  --radius-progress: var(--radius-full);

  /* --- Breakpoints --- */
  --breakpoint-sm: 640px;
  --breakpoint-md: 768px;
  --breakpoint-lg: 1024px;
  --breakpoint-xl: 1280px;
}

/* ==========================================================================
   REDUCED MOTION OVERRIDES
   When prefers-reduced-motion is active, resolve all motion tokens to
   instant/minimal alternatives per L2-001 Section 5.2.
   ========================================================================== */

@media (prefers-reduced-motion: reduce) {
  :root {
    --duration-fast: 0ms;
    --duration-base: 0ms;
    --duration-medium: 50ms;
    --duration-slow: 50ms;
    --easing-spring: linear;
  }

  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

**Implementation notes:**

- Opacity-derived colours are resolved to their computed `rgba()` values. CSS `var()` cannot perform opacity modification at runtime without `color-mix()` (which has limited browser support for this use case). The computed values are stable — they are derived directly from the brand guidelines and will only change when the brand guidelines change.
- Gradient tokens that reference Tier 1 identity tokens inline (e.g., `--gradient-action-primary`) use resolved hex values for the same reason. The values match exactly the identity token values defined above.
- The `--motion-ambient` and `--motion-urgency` tokens are not declared as single CSS custom properties because they require `animation` shorthand with `infinite` keyword — they are defined per-component where ambient or urgency animations are applied.

---

## 3. Global Styles

### File: `packages/frontend/src/styles/global.css`

This file handles global resets, font loading, and body defaults. It imports `tokens.css` so the token declarations are always loaded first.

```css
/* Font imports from Google Fonts */
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Space+Mono:ital,wght@0,400;0,700;1,400&display=swap');

/* Token declarations */
@import './tokens.css';

/* ==========================================================================
   GLOBAL RESETS & DEFAULTS
   ========================================================================== */

*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  font-size: 16px;
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
}

body {
  background-color: var(--color-bg-page);
  color: var(--color-text-primary);
  font-family: var(--font-body);
  font-size: 16px;
  line-height: 1.7;
  min-height: 100dvh;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Display font — always uppercase per L2-001 Section 2.8 */
h1,
h2,
h3,
[data-font="display"] {
  font-family: var(--font-display);
  text-transform: uppercase;
  line-height: 1.1;
}

/* Data font */
code,
pre,
[data-font="data"] {
  font-family: var(--font-data);
}

/* Focus visible — global baseline (components override as needed) */
:focus-visible {
  outline: 2px solid var(--color-action-primary-hover);
  outline-offset: 2px;
}

/* Remove focus outline for mouse users */
:focus:not(:focus-visible) {
  outline: none;
}

/* noscript fallback — branded, consistent with dark theme */
noscript {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100dvh;
  background-color: var(--color-bg-page);
  color: var(--color-text-secondary);
  font-family: var(--font-body);
  text-align: center;
  padding: 2rem;
}
```

**Font loading notes:**

- Google Fonts is used here for scaffold simplicity. The frontend spec (L3-005 Section 9.1) specifies self-hosted fonts for production — self-hosting with WOFF2 files and `@font-face` declarations should be addressed when moving beyond local demo.
- `font-display: swap` is the Google Fonts default for body fonts, `font-display: optional` for display-only fonts. Since the query string above does not granularly control `display` per font, the implementer may wish to split into two separate `@import` statements or switch to self-hosted `@font-face` declarations that give explicit `font-display` control per font.
- The Google Fonts URL above requests the full optical size range for DM Sans (`opsz,9..40`) and the weights used across the spec: 300, 400, 500, 600, 700. Adjust if the subset needs to be smaller for performance.

### Import chain in `main.tsx`

`main.tsx` imports `global.css` (which imports `tokens.css`). There is no separate `index.css` import of `tokens.css` — the chain is linear:

```
main.tsx
  └── global.css
        ├── Google Fonts (external)
        └── tokens.css
```

The existing `index.css` from feat-001-spec (containing only `@import "tailwindcss"`) should be merged into `global.css` — place the Tailwind import at the top of `global.css`, before the Google Fonts import.

**Final `global.css` top section order:**

```css
@import "tailwindcss";
@import url('https://fonts.googleapis.com/css2?...');
@import './tokens.css';
/* ...resets and defaults... */
```

---

## 4. Placeholder App.tsx and HomePage

### `packages/frontend/src/App.tsx`

The `App.tsx` structure specified in feat-001-spec.md is correct and requires no changes. It wires `BrowserRouter` and a single route to `HomePage`.

```tsx
import { BrowserRouter, Routes, Route } from 'react-router';
import HomePage from './routes/HomePage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
      </Routes>
    </BrowserRouter>
  );
}
```

### `packages/frontend/src/routes/HomePage.tsx`

The placeholder home page replaces the minimal stub from feat-001-spec with a version that exercises the design token system visually, making it easy to confirm tokens are loading correctly. It remains minimal and will be fully replaced by feat-004 (App Shell).

**Visual specification:**

- Full-viewport dark background using `--color-bg-page`
- Centred content column, vertically centred
- "MARS MISSION FUND" as `<h1>` using `--font-display` (Bebas Neue, uppercase) at `--type-hero` scale (96px)
- Subtitle "Platform launching soon" in `--font-body` (DM Sans) using `--color-text-secondary`
- A small status badge confirming the build is working

**Badge specification:**

The badge uses the "Active" badge variant from L2-001 Section 3.5:
- Background: `--color-status-active-bg`
- Text: `--color-action-primary-hover`
- Border: `1px solid --color-status-active-border`
- Border radius: `--radius-badge`
- A 6px dot indicator in `--color-status-active`
- Text: "Build OK" in `--type-button` style (DM Sans, 12px, weight 600)
- Padding: 6px 12px

**Rendered HTML structure:**

```tsx
export default function HomePage() {
  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1.5rem',
        padding: '2rem',
        backgroundColor: 'var(--color-bg-page)',
      }}
    >
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '96px',
          fontWeight: 400,
          letterSpacing: '0.03em',
          textTransform: 'uppercase',
          color: 'var(--color-text-primary)',
          textAlign: 'center',
          lineHeight: 1.1,
        }}
      >
        Mars Mission Fund
      </h1>

      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '16px',
          color: 'var(--color-text-secondary)',
          textAlign: 'center',
        }}
      >
        Platform launching soon
      </p>

      <div
        role="status"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 12px',
          backgroundColor: 'var(--color-status-active-bg)',
          border: '1px solid var(--color-status-active-border)',
          borderRadius: 'var(--radius-badge)',
          fontFamily: 'var(--font-body)',
          fontSize: '12px',
          fontWeight: 600,
          color: 'var(--color-action-primary-hover)',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: 'var(--color-status-active)',
            flexShrink: 0,
          }}
        />
        Build OK
      </div>
    </main>
  );
}
```

**Notes on inline styles:**

Inline styles are used here intentionally — this placeholder has no reusable component or Tailwind class requirements. The inline values reference only Tier 2 semantic tokens. When feat-004 replaces this component, the token reference pattern transfers to whatever component system is in use at that point.

**Smoke test compatibility:**

The existing smoke test in `App.test.tsx` queries `getByRole('heading', { name: /mars mission fund/i })`. The `<h1>` content "Mars Mission Fund" satisfies this query. The `role="status"` on the badge is accessible and announces "Build OK" to screen readers.

---

## 5. Token Mapping Reference

Complete reference of all Tier 2 semantic tokens and their resolved values. This table is the authoritative mapping for the frontend engineer and all subsequent agents implementing UI.

### 5.1 Action Colours

| Token | Resolved Value | Usage |
| ----- | -------------- | ----- |
| `--color-action-primary` | `#FF5C1A` | Primary CTA backgrounds, interactive links |
| `--color-action-primary-hover` | `#FF8C42` | Hover/focus state on primary actions |
| `--color-action-primary-text` | `#F5F8FF` | Text on primary action backgrounds |
| `--color-action-primary-shadow` | `rgba(255, 92, 26, 0.35)` | Drop shadow on primary CTAs |
| `--color-action-secondary-bg` | `rgba(245, 248, 255, 0.06)` | Secondary button background |
| `--color-action-secondary-text` | `#C8D0DC` | Secondary button text |
| `--color-action-secondary-border` | `rgba(245, 248, 255, 0.12)` | Secondary button border |
| `--color-action-ghost-text` | `#FF8C42` | Ghost button text |
| `--color-action-ghost-border` | `rgba(255, 92, 26, 0.30)` | Ghost button border |
| `--color-action-disabled` | `rgba(138, 150, 168, 0.50)` | Inactive buttons, disabled inputs |

### 5.2 Status Colours

| Token | Resolved Value | Usage |
| ----- | -------------- | ----- |
| `--color-status-success` | `#2FE8A2` | Funded, milestone complete, transaction confirmed |
| `--color-status-success-bg` | `rgba(47, 232, 162, 0.12)` | Success badge/card background |
| `--color-status-success-border` | `rgba(47, 232, 162, 0.20)` | Success badge/card border |
| `--color-status-error` | `#C1440E` | Validation errors, failed transactions |
| `--color-status-warning` | `#FFB347` | Deadline approaching, campaign ending soon |
| `--color-status-info` | `#1A3A6E` | Neutral informational badges |
| `--color-status-active` | `#FF5C1A` | Live campaign indicator dot |
| `--color-status-active-bg` | `rgba(255, 92, 26, 0.12)` | Active badge background |
| `--color-status-active-border` | `rgba(255, 92, 26, 0.20)` | Active badge border |
| `--color-status-new` | `#5B8FD8` | New mission indicator dot |
| `--color-status-new-bg` | `rgba(26, 58, 110, 0.40)` | New mission badge background |
| `--color-status-new-border` | `rgba(26, 58, 110, 0.60)` | New mission badge border |

### 5.3 Surface Colours

| Token | Resolved Value | Usage |
| ----- | -------------- | ----- |
| `--color-bg-page` | `#060A14` | Primary page background |
| `--color-bg-surface` | `#0B1628` | Cards, modals, secondary panels |
| `--color-bg-elevated` | `#0E2040` | Hover states on cards, dropdowns |
| `--color-bg-overlay` | `rgba(6, 10, 20, 0.90)` | Modal overlays, navigation backdrop |
| `--color-bg-input` | `rgba(245, 248, 255, 0.04)` | Form input backgrounds |
| `--color-bg-accent` | `#1A3A6E` | Table headers, emphasis blocks |

### 5.4 Text Colours

| Token | Resolved Value | Usage |
| ----- | -------------- | ----- |
| `--color-text-primary` | `#E8EDF5` | Headlines, primary content on dark |
| `--color-text-secondary` | `#C8D0DC` | Body text, descriptions |
| `--color-text-tertiary` | `#8A96A8` | Metadata, timestamps, placeholders |
| `--color-text-accent` | `#FF5C1A` | Section labels, highlighted links (large text only) |
| `--color-text-on-action` | `#F5F8FF` | Text on primary action backgrounds |
| `--color-text-success` | `#2FE8A2` | Positive financial indicators |
| `--color-text-error` | `#C1440E` | Error messages |
| `--color-text-warning` | `#FFB347` | Urgency indicators |

### 5.5 Border Colours

| Token | Resolved Value | Usage |
| ----- | -------------- | ----- |
| `--color-border-subtle` | `rgba(245, 248, 255, 0.06)` | Card borders, section dividers |
| `--color-border-emphasis` | `#1A3A6E` | Table borders, form input focus |
| `--color-border-input` | `rgba(245, 248, 255, 0.10)` | Default form input borders |
| `--color-border-accent` | `#FF5C1A` | Top accent bars on cards, active nav |

### 5.6 Progress & Data Colours

| Token | Resolved Value | Usage |
| ----- | -------------- | ----- |
| `--color-progress-fill` | `linear-gradient(90deg, #FF5C1A, #FFB347)` | In-progress campaign bar fill |
| `--color-progress-complete` | `linear-gradient(90deg, #2FE8A2, #1AB878)` | Completed campaign bar fill |
| `--color-progress-track` | `rgba(245, 248, 255, 0.06)` | Progress bar background track |
| `--color-progress-indicator` | `#FFB347` | Endpoint dot on progress bars |
| `--color-data-positive` | `#2FE8A2` | Upward trend, gain indicators |
| `--color-data-neutral` | `#8A96A8` | Stable/neutral data points |

### 5.7 Semantic Gradients

| Token | Resolved Value | Usage |
| ----- | -------------- | ----- |
| `--gradient-action-primary` | `linear-gradient(135deg, #FF5C1A, #FF8C42, #FFB347)` | Primary CTA button backgrounds |
| `--gradient-surface-card` | `linear-gradient(135deg, #060A14, #0E2040, #1A3A6E)` | Card gradient backgrounds |
| `--gradient-surface-stat` | `linear-gradient(135deg, #0E2040, #0B1628)` | Stat card backgrounds |
| `--gradient-hero` | `linear-gradient(135deg, #060A14 0%, #0B1628 50%, rgba(255,92,26,0.15) 100%)` | Landing page hero sections |
| `--gradient-campaign-hero` | `linear-gradient(135deg, #C1440E, #FF5C1A, #FF8C42)` | Campaign hero backgrounds |
| `--gradient-celebration` | `linear-gradient(135deg, #0B1628, rgba(47,232,162,0.2), #0B1628)` | Funded campaign celebration state |
| `--gradient-achievement` | `linear-gradient(135deg, #E8EDF5, #C8D0DC, #8A96A8)` | Achievement badges, coin renders |

### 5.8 Typography Scale

| Token | Font | Size | Weight | Additional |
| ----- | ---- | ---- | ------ | ---------- |
| `--type-hero` | `--font-display` | 96px | 400 | letter-spacing: 0.03em. Landing page hero only. |
| `--type-page-title` | `--font-display` | 56px | 400 | letter-spacing: 0.04em |
| `--type-section-heading` | `--font-display` | 40px | 400 | letter-spacing: 0.04em |
| `--type-card-title` | `--font-body` | 24px | 700 | — |
| `--type-body` | `--font-body` | 16px | 400 | line-height: 1.7 |
| `--type-body-small` | `--font-body` | 13px | 400 | line-height: 1.7 |
| `--type-button` | `--font-body` | 14px | 600 | letter-spacing: 0.01em |
| `--type-label` | `--font-data` | 11px | 400 | letter-spacing: 0.2em, uppercase |
| `--type-section-label` | `--font-data` | 11px | 400 | letter-spacing: 0.3em, uppercase |
| `--type-data` | `--font-data` | 14px | 400 | Mission codes, financial figures, timestamps |
| `--type-stat-value` | `--font-display` | 40px | 400 | letter-spacing: 0.03em |
| `--type-stat-value-compact` | `--font-display` | 28px | 400 | letter-spacing: 0.05em |
| `--type-input-label` | `--font-data` | 12px | 600 | letter-spacing: 0.05em, uppercase |

Typography tokens are not declared as CSS custom properties because they are multi-property shorthand (font-family, font-size, font-weight, letter-spacing). Components apply each property individually using the relevant Tier 1 font identity token and sizing values from this table.

### 5.9 Motion Tokens

| Token | Duration | Easing | Usage |
| ----- | -------- | ------ | ----- |
| `--motion-enter` | `300ms` | `cubic-bezier(0.25, 1, 0.5, 1)` | Default element entry, card reveals |
| `--motion-enter-emphasis` | `500ms` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | CTA appearing, modal entry, success |
| `--motion-hover` | `150ms` | `cubic-bezier(0.25, 1, 0.5, 1)` | Hover states, icon transitions |
| `--motion-panel` | `500ms` | `cubic-bezier(0.25, 1, 0.5, 1)` | Modals, drawers, panels |
| `--motion-page` | `800ms` | `cubic-bezier(0.25, 1, 0.5, 1)` | Page transitions |
| `--motion-ambient` | 2–4s | ease-in-out, infinite | Decorative float, hero backgrounds |
| `--motion-urgency` | 1.5s | ease-in-out, infinite | Live countdowns, deadline pulse |

### 5.10 Layout / Radius Tokens

| Token | Resolved Value | Usage |
| ----- | -------------- | ----- |
| `--radius-button` | `100px` | All button variants |
| `--radius-badge` | `8px` | Status badges, tags |
| `--radius-input` | `12px` | Form inputs |
| `--radius-card` | `20px` | Standard UI cards |
| `--radius-card-large` | `24px` | Feature cards, logo cards |
| `--radius-stat` | `16px` | Stat blocks, swatches |
| `--radius-progress` | `100px` | Progress bar tracks and fills |

---

## 6. Accessibility Notes

### 6.1 Contrast Ratios

The dark-first palette naturally achieves high contrast ratios. The following pairings from L2-001 Section 5.1 must be maintained:

| Text / Background | Minimum | Actual |
| ----------------- | ------- | ------ |
| `--color-text-primary` on `--color-bg-page` | 7:1 (AAA) | 14.8:1 |
| `--color-text-primary` on `--color-bg-surface` | 7:1 (AAA) | 12.6:1 |
| `--color-text-secondary` on `--color-bg-page` | 4.5:1 (AA) | 10.7:1 |
| `--color-text-tertiary` on `--color-bg-page` | 4.5:1 (AA) | 5.4:1 |
| `--color-text-accent` on `--color-bg-page` | 4.5:1 (AA large) | 4.8:1 |
| `--color-text-success` on `--color-bg-page` | 4.5:1 (AA) | 10.1:1 |

`--color-text-accent` (`#FF5C1A` on `#060A14`) achieves 4.8:1 — this meets AA for large text only (18px+ regular or 14px+ bold). It must not be used for body text or small labels. Use `--color-action-primary-hover` (`#FF8C42`) for small accent text where higher contrast is required.

`--color-text-tertiary` passes AA but fails AAA. It is approved for metadata, timestamps, and placeholders only — never for body text or interactive labels.

### 6.2 Motion: prefers-reduced-motion

The `tokens.css` file includes a `@media (prefers-reduced-motion: reduce)` block that:

1. Sets all duration tokens to `0ms` (fast/base) or `50ms` (medium/slow) — effectively instant.
2. Overrides `--easing-spring` to `linear` to prevent any overshoot bounce even in the 50ms fallback.
3. Applies the universal `animation-duration: 0.01ms` override to all elements as a safety net for any animations not using semantic tokens.

This satisfies WCAG 2.1 SC 2.3.3 (Animation from Interactions) and the L2-001 Section 5.2 and L3-005 Section 6.3 requirements.

### 6.3 Focus States

The global `global.css` provides a baseline focus-visible style using `--color-action-primary-hover`. Component-level overrides for buttons, inputs, links, and interactive cards are specified in L2-001 Section 5.3 and must be applied when those components are built in feat-003.

`outline: none` must never be applied without an equivalent visible alternative.

### 6.4 Placeholder Page Accessibility

The placeholder `HomePage.tsx`:

- Uses a semantic `<main>` landmark
- Uses a semantic `<h1>` for the page title — screen readers can identify the page
- The status badge uses `role="status"` so its content is announced as a live region
- The decorative dot indicator uses `aria-hidden="true"` — status is conveyed by "Build OK" text, not the dot
- No interactive elements, so no keyboard navigation or focus requirements for this placeholder

---

## 7. Not In Scope

The following are explicitly excluded from this design spec:

- **Navigation components** — global header, sidebar, mobile navigation. These are feat-004 (App Shell).
- **Component library primitives** — Button, Card, Badge, ProgressBar, Input, StatCard. These are feat-003 (Design System Components). The badge in `HomePage.tsx` is a one-off inline implementation, not a reusable component.
- **Route-specific designs** — campaign pages, donor dashboard, account flows. These are L4 domain spec features.
- **Light theme overrides** — email templates, PDF exports, embedded widgets. Exception contexts deferred to implementation need.
- **Self-hosted font setup** — L3-005 Section 9.1 specifies self-hosting for production. Google Fonts import is used for scaffold simplicity; the migration to self-hosted WOFF2 files is deferred.
- **Tailwind utility class usage** — feat-001 installs Tailwind v4 and imports it. Utility class patterns for the token system are not specified here; they emerge as components are built in feat-003.
