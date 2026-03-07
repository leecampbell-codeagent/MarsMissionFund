## feat-003: Design System Foundation — Tokens and Primitives

**Bounded Context(s):** Frontend / Platform
**Priority:** P0
**Dependencies:** feat-001
**Estimated Complexity:** M

### Summary

Implement the two-tier semantic token system from L2-001 as CSS custom properties, and build the core design system primitive components (Button, Card, Badge, ProgressBar, StatCard, Input, FormField). These primitives are the shared building blocks consumed by every subsequent frontend feature. The token architecture and component specifications are 100% real per L2-001.

### Acceptance Criteria

- [ ] A global CSS file (e.g., `packages/frontend/src/styles/tokens.css`) defines all Tier 2 semantic tokens from L2-001 as CSS custom properties mapped to the Tier 1 identity token values.
- [ ] All three brand fonts (Bebas Neue, DM Sans, Space Mono) are self-hosted in `packages/frontend/public/fonts/` and loaded with the correct `font-display` strategy per L3-005 Section 9.1.
- [ ] Page background (`--color-bg-page` / `#060A14`) is applied as the default body background — dark-first, no light mode.
- [ ] `prefers-reduced-motion` media query at the root level sets all motion tokens to reduced-motion alternatives.
- [ ] The following primitive components are implemented in `packages/frontend/src/components/`:
  - `Button` — supports `variant` prop: `primary`, `secondary`, `ghost`, `success`; implements L2-001 Section 3.1 token mappings; `--radius-button`; only one `primary` CTA per viewport by convention.
  - `Card` — implements L2-001 Section 3.2 token mappings including top accent bar.
  - `Badge` — supports `variant` prop: `funded`, `live`, `new`; implements L2-001 Section 3.5.
  - `ProgressBar` — implements L2-001 Section 3.3; accepts `value`, `max`, `complete` props; includes ARIA attributes (`aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-label`).
  - `StatCard` — implements L2-001 Section 3.4; accepts `label`, `value`, `subtext`, `positive` props.
  - `Input` — implements L2-001 Section 3.6; accepts `label`, `placeholder`, `error`, `suffix` props.
  - `FormField` — wraps `Input` with label, error message, and `aria-describedby` wiring.
- [ ] All components use **only** Tier 2 semantic token CSS custom properties — no hardcoded hex values, no Tier 1 identity token references.
- [ ] All interactive components have visible focus states meeting WCAG 2.1 AA per L2-001 Section 5.3.
- [ ] Each primitive has a `.test.tsx` file covering: default render, all variants, disabled state, loading state (where applicable), and accessible queries via `getByRole` / `getByLabel`.
- [ ] Each primitive passes axe-core accessibility audit in tests.
- [ ] Named exports only (no default exports for primitives).
- [ ] All props typed with explicit `readonly` TypeScript interfaces — no `any`.
- [ ] `npm test` passes with ≥ 90% coverage on all primitives.

### User Story

As a frontend engineer, I want a consistent set of design system primitives so that every feature I build uses the correct brand tokens and accessibility patterns automatically.

### Key Decisions / Open Questions

- Fonts are self-hosted (not loaded from Google Fonts) per L3-005 Section 9.1.
- Icon system uses inline SVG React components (feat-003 creates the infrastructure; icons are added per feature).
- Tailwind CSS v4 is configured but primarily used for layout utilities — all brand values come from semantic tokens.

### Out of Scope

- Page-level layouts and navigation shell (feat-004).
- Domain-specific composite components (added per feature as needed).
- SectionLabel, Breadcrumb, and other navigation primitives (added in feat-004).
