# Validation Report: feat-001 — Monorepo Scaffold & Dev Environment

> **Validator**: Spec Validator
> **Date**: 2026-03-04
> **Documents Reviewed**:
> - `.claude/prds/feat-001-spec.md` (Implementation Spec)
> - `.claude/prds/feat-001-design.md` (Design Spec)
> - `.claude/prds/feat-001-research.md` (Research Document)
> **Cross-Referenced Against**: CLAUDE.md, L1-001, L2-001, L2-002, L3-001, L3-005, L3-008, `.claude/rules/infra.md`, `.claude/rules/backend.md`, `.claude/rules/frontend.md`, `.claude/backlog.md`, `.claude/prds/feat-001-monorepo-scaffold.md`

---

## Verdict: CONDITIONAL PASS

The spec package is comprehensive and well-aligned with the governing standards.
Two WARNs require attention but are non-blocking for implementation.
No FAIL triggers were hit.

---

## 1. Completeness

| Item | Status | Notes |
| ---- | ------ | ----- |
| User stories with acceptance criteria | PASS | 6 user stories, all with Gherkin scenarios |
| Exact project structure defined | PASS | Full file tree in Sections 2 and 22 |
| Complete configuration files (package.json, tsconfig, ESLint, Prettier) | PASS | Sections 3-6 provide full file contents |
| Docker Compose with all services | PASS | Section 9.1 — postgres, dbmate, backend, frontend |
| Backend Dockerfile (multi-stage) | PASS | Section 9.2 — base, development, builder, production stages |
| CI workflow complete | PASS | Section 15.1 — checkout, setup-node, npm ci, lint, format, typecheck, test |
| `.env.example` with all variables | PASS | Section 8.1 — all required variables documented with comments |
| Health check endpoint defined | PASS | Section 10.3 — GET /health returns 200 with `{ status: "ok" }` |
| Initial passing tests in both packages | PASS | Section 14 — health.test.ts and App.test.tsx |
| Implementation order defined | PASS | Section 20 — clear 9-step order |
| Edge cases with defined behaviours | PASS | Section 17 — all 20 research edge cases addressed |
| Out of scope explicitly listed | PASS | Section 21 — 12 items explicitly excluded |
| CLAUDE.md update defined | PASS | Section 19.1 — development workflow content provided |
| Verification checklist | PASS | Section 18.3 — all commands listed |
| Design spec: CSS tokens file | PASS | Complete `tokens.css` with Tier 1 and Tier 2 tokens |
| Design spec: Global styles | PASS | Complete `global.css` with reset, fonts, base styles |
| Design spec: Component specs | PASS | PageShell, LandingPlaceholder, App root component |
| Design spec: Accessibility checklist | PASS | 13-item checklist covering WCAG requirements |
| Research: Technology versions | PASS | Section 1 covers all stack components |
| Research: Edge cases | PASS | 20 edge cases identified with expected behaviours |
| Research: Recommendations | PASS | Must-haves and watch-outs clearly documented |

---

## 2. Architecture Compliance

| Item | Status | Notes |
| ---- | ------ | ----- |
| Hexagonal architecture structure (ports/adapters) | PASS | N/A for scaffold — no domain logic. Out of Scope section correctly defers this. |
| CLAUDE.md rules followed | PASS | Specs consulted, no violations of project instructions |
| Express app factory pattern (separate app.ts / index.ts) | PASS | Section 10.2 and 10.4 — `createApp()` returns app; `index.ts` calls `listen()` |
| Pino for structured logging (no console.log) | PASS | Section 10.1 — singleton logger; ESLint `no-console: error` enforced |
| pino-http middleware | PASS | Section 10.2 — request logging with header redaction |
| pino-pretty dev-only | PASS | Conditional transport in development; devDependency only |
| TypeScript strict mode | PASS | Section 4.1 — `"strict": true` in tsconfig.base.json; no override permitted |
| ESLint flat config | PASS | Section 5.1 — correct ESLint 9+ flat config format |
| Health endpoint unauthenticated (per L2-002 Section 6.3) | PASS | Section 10.3 — explicitly references the exception |
| Raw SQL via pg, parameterised queries only | PASS | N/A for scaffold — no database queries. pg not yet imported (correct). |
| Named exports (frontend rules) | PASS | Section 11.3 — `export { App }` named export |
| ESM module system | PASS | Both packages use `"type": "module"` and `.js` import extensions |
| Node.js 22.x LTS | PASS | CI uses node-version: 22; Dockerfile uses `node:22-bookworm-slim` |
| npm workspaces | PASS | Root package.json with `"workspaces": ["packages/*"]` |

---

## 3. Financial Data Rules

| Item | Status | Notes |
| ---- | ------ | ----- |
| N/A — no financial logic in feat-001 | PASS | Feature brief and spec correctly exclude all financial logic. Monetary rules will apply starting from feat-002/feat-008. |

---

## 4. Design System Compliance

| Item | Status | Notes |
| ---- | ------ | ----- |
| Components reference ONLY Tier 2 semantic tokens | PASS | Design spec components (PageShell, LandingPlaceholder) use only `--color-*`, `--font-*`, `--radius-*`, `--motion-*` semantic tokens. No Tier 1 references in component code. |
| Tier 1 tokens present only in tokens.css for mapping | PASS | `tokens.css` declares Tier 1 inside `:root` with clear "DO NOT reference" comments |
| Dark-first UI | PASS | `--color-bg-page` (void/#060A14) as primary background; no light mode |
| Correct typography: Bebas Neue for display, DM Sans for body, Space Mono for data | PASS | Font families correctly assigned to identity tokens; component specs use correct fonts for each context |
| Bebas Neue always uppercase | PASS | LandingPlaceholder title has `text-transform: uppercase`; header logo has `text-transform: uppercase` |
| Type scale from closed set only | PASS | Hero title uses 96/80/56/40px — all from the defined type scale |
| Colour contrast verified | PASS | Primary text: 14.8:1 AAA; Secondary text: 10.7:1 AAA |
| prefers-reduced-motion respected | PASS | `@media (prefers-reduced-motion: reduce)` block overrides all motion tokens to 0ms |
| Self-hosted fonts (no third-party CDN) | PASS | WOFF2 files in `public/fonts/`; @font-face declarations in global.css |
| Font preload for DM Sans | PASS | `<link rel="preload">` in index.html for dm-sans regular |
| Skip-to-content link | PASS | First focusable element in PageShell; targets `#main-content` |
| Focus-visible styles | PASS | Global `:focus-visible` outline; never suppressed |
| Single `<h1>` per page | PASS | LandingPlaceholder has the sole `<h1>` |
| Semantic landmarks | PASS | `<header>`, `<main>`, `<footer>` in PageShell |
| Noscript fallback branded | PASS | Design spec provides styled noscript with matching brand colours |
| Gradient tokens defined | PASS | All 7 semantic gradient tokens mapped from identity gradients |
| All Tier 2 tokens from L2-001 present | PASS | Verified: Actions (10), Status (11), Surfaces (6), Text (8), Borders (4), Progress (6), Gradients (7), Motion (5 semantic pairs), Layout radii (7) — all present |

---

## 5. Scope Validation

| Item | Status | Notes |
| ---- | ------ | ----- |
| Stays within feature brief scope | PASS | All 15 acceptance criteria from the brief are addressed |
| No Phase 2 features included | PASS | Section 21 explicitly excludes Terraform, business logic, auth, shared packages, etc. |
| No authentication integration (feat-003) | PASS | Correctly deferred |
| No database schema (feat-002) | PASS | Only empty migrations directory with .gitkeep |
| No Playwright tests (directory only) | PASS | `e2e/.gitkeep` only |
| No PostHog integration | PASS | Commented-out env vars only; no SDK dependencies |
| Design tokens in design spec vs. implementation spec alignment | WARN | The implementation spec (Section 21) says "Frontend design system tokens (applied when first UI feature lands)" but the design spec defines a complete `tokens.css`, `global.css`, PageShell, and LandingPlaceholder. **This is a scope inconsistency**. See Revision Instructions below. |
| No shared packages | PASS | Correctly deferred |

---

## 6. Testability

| Item | Status | Notes |
| ---- | ------ | ----- |
| US-001: Dev environment starts | PASS | Testable: `npm run dev` then `curl localhost:3001/health` and verify `localhost:5173` |
| US-001: Backend hot reload | PASS | Testable: Modify file, verify restart via log output |
| US-001: Frontend HMR | PASS | Testable: Modify file, verify browser update without full reload |
| US-002: Lint runs clean | PASS | Testable: `npm run lint` exits 0 |
| US-002: Format runs clean | PASS | Testable: `npm run format` exits 0 |
| US-002: Typecheck runs clean | PASS | Testable: `npm run typecheck` exits 0 |
| US-003: Tests pass | PASS | Testable: `npm test` exits 0 with at least one test per package |
| US-004: CI pipeline triggers | PASS | Testable: Open PR, verify GitHub Actions workflow runs |
| US-005: dbmate runs clean | PASS | Testable: `docker compose up dbmate` exits 0, schema_migrations table exists |
| US-006: Health endpoint | PASS | Testable: Automated test in `health.test.ts`; also `curl` verification |
| All acceptance criteria automatable | PASS | Every Gherkin scenario can be verified by automated test or script |

---

## 7. Cross-Document Consistency

| Item | Status | Notes |
| ---- | ------ | ----- |
| Tech versions match across all docs | PASS | Node 22, React 19, Express 5, Vite 6, Tailwind v4, Vitest 3, PostgreSQL 16 — consistent across spec, research, and L3-008 |
| Directory structure consistent | PASS | Spec Sections 2 and 22 match research Section 2.2 (with spec adding setup.ts and .gitattributes) |
| Package naming consistent | PASS | `mars-mission-fund` (root), `@mmf/backend`, `@mmf/frontend` — same across spec and research |
| npm scripts consistent | PASS | Root scripts match between spec and research |
| Docker services consistent | PASS | postgres, dbmate, backend, frontend — same across spec and research |
| Edge cases from research all addressed in spec | PASS | All 20 edge cases (5.1-5.20) have defined behaviours in spec Section 17 |
| Research recommendations incorporated | PASS | All 10 must-haves from research Section 6.1 are in the spec |
| Research watch-outs addressed | PASS | Tailwind v4 breaking changes, Express 5 types, Vite proxy in Docker, node_modules volumes, dbmate --wait, Vitest projects deprecation — all addressed |
| Design spec file locations match spec structure | WARN | Design spec defines `packages/frontend/src/styles/tokens.css`, `packages/frontend/src/styles/global.css`, `packages/frontend/src/components/PageShell.tsx`, and `packages/frontend/src/components/LandingPlaceholder.tsx` — but these files are NOT listed in the implementation spec's file tree (Sections 2 and 22). The implementation spec has a simpler App.tsx without PageShell. **See Revision Instructions below.** |
| Design spec App.css matches spec | PASS (conditional) | Design spec says App.css imports tokens, global, then tailwind. Spec says App.css imports only tailwindcss. These differ based on whether design tokens are in scope. |
| Design spec index.html matches spec | PASS (conditional) | Design spec adds font preload and styled noscript; spec has simpler noscript. Same scope question as above. |
| Research out-of-scope matches spec | PASS | Research Section 6.4 and spec Section 21 align |

---

## 8. Complexity Assessment

| Dimension | Assessment |
| --------- | ---------- |
| **Estimated Size** | Medium (M) — matches backlog estimate |
| **File Count** | 28 files to create (excluding package-lock.json) |
| **Configuration Complexity** | Moderate — many config files but all are well-specified with complete contents |
| **Risk Areas** | Docker Compose service orchestration (health checks, dependency ordering); Tailwind v4 breaking changes from v3; Express 5 type compatibility |
| **Estimated Agent Time** | 2-4 hours for a single agent following the spec linearly |
| **Parallelisation** | Root config and backend/frontend packages can be done in parallel after root is created |

---

## Automatic FAIL Trigger Audit

| Trigger | Result | Notes |
| ------- | ------ | ----- |
| Tier 1 identity tokens referenced in component code | NOT TRIGGERED | Design spec components use only Tier 2 tokens |
| Edge case from research with no defined behaviour | NOT TRIGGERED | All 20 edge cases have defined behaviours |
| Acceptance criterion not testable programmatically | NOT TRIGGERED | All criteria are automatable |
| Phase 2 feature included in spec | NOT TRIGGERED | Out of scope list is clear and correct |
| Missing error handling | NOT TRIGGERED | N/A for scaffold; error response middleware explicitly deferred to when auth/domain endpoints exist |

---

## Revision Instructions (WARN Items)

### WARN-1: Design Spec vs. Implementation Spec Scope Alignment

**Issue**: The implementation spec (Section 21) lists "Frontend design system tokens" as out of scope, stating they are "applied when first UI feature lands." However, the design spec defines a complete `tokens.css`, `global.css`, `PageShell.tsx`, `LandingPlaceholder.tsx`, and updated `index.html` with font preloads.

These two documents contradict each other on whether design tokens and the PageShell layout are part of feat-001.

**Resolution options** (pick one before implementation begins):

**Option A (Recommended)**: Include the design tokens and minimal UI components in feat-001. Update the implementation spec to:
1. Add `packages/frontend/src/styles/tokens.css` and `packages/frontend/src/styles/global.css` to the file tree.
2. Add `packages/frontend/src/components/PageShell.tsx` and `packages/frontend/src/components/LandingPlaceholder.tsx` to the file tree.
3. Update `App.tsx` to render `<PageShell><LandingPlaceholder /></PageShell>`.
4. Update `App.css` to import tokens.css, global.css, then tailwindcss.
5. Update `index.html` to include font preload and styled noscript.
6. Add font files to `packages/frontend/public/fonts/`.
7. Remove "Frontend design system tokens" from the Out of Scope list.
8. Update App.test.tsx to match the new component structure.

**Rationale**: The design spec is thorough and well-specified. Including tokens in feat-001 means every subsequent feature has the design system ready. The additional work is modest (CSS files + 2 simple components).

**Option B**: Remove the design spec content from feat-001 scope. Strip `feat-001-design.md` down to just the minimal App.tsx placeholder (no tokens, no PageShell, no fonts). Create a separate feat for design system bootstrap.

**Rationale**: Keeps feat-001 strictly infrastructure-focused. But this creates an awkward gap where feat-001 produces a frontend with no styling.

### WARN-2: Frontend test file for design spec components

**Issue**: If Option A is chosen, the design spec mentions `packages/frontend/src/__tests__/App.test.tsx` should test heading renders, but no test files are specified for `PageShell.tsx` or `LandingPlaceholder.tsx`. Per frontend rules, "Every component has a `.test.tsx` file."

**Resolution**: If Option A is chosen, add test specs for:
- `packages/frontend/src/components/__tests__/PageShell.test.tsx` — tests semantic landmarks render, skip-link present, children rendered
- `packages/frontend/src/components/__tests__/LandingPlaceholder.test.tsx` — tests heading renders, subtitle renders

---

## Summary

| Checklist | Result |
| --------- | ------ |
| 1. Completeness | PASS |
| 2. Architecture Compliance | PASS |
| 3. Financial Data Rules | PASS (N/A) |
| 4. Design System Compliance | PASS |
| 5. Scope Validation | WARN (1 item) |
| 6. Testability | PASS |
| 7. Cross-Document Consistency | WARN (1 item) |
| 8. Complexity Assessment | M (Medium) — as estimated |

**Overall Verdict: CONDITIONAL PASS**

The spec package is ready for implementation once the scope alignment between the implementation spec and design spec is resolved (WARN-1). The recommended path is Option A (include design tokens in feat-001). This is a documentation alignment issue, not a design or architecture problem.
