# feat-001: Validation Report

**Verdict:** PASS

## Summary

The feat-001 technical and design specs are well-structured, internally consistent, and compliant with the authoritative specs (L2-001, L2-002, L3-001, L3-005, L3-008). The open questions from research have been resolved with clear rationale, and all acceptance criteria are testable. A small number of warnings are noted for implementation awareness, but none block implementation.

---

## Checks Passed

### Technical Spec Validation

- All backend dependencies explicitly listed in `packages/backend/package.json` with version ranges, including direct and dev deps. Matches research and L3-008.
- All frontend dependencies explicitly listed in `packages/frontend/package.json` with version ranges. Matches research and L3-008.
- TypeScript strict mode: backend inherits `strict: true` from `tsconfig.base.json` (confirmed in research). Frontend configs also extend base with strict mode.
- Backend module system decision is clearly documented: CommonJS (`"module": "CommonJS"`, `"moduleResolution": "node10"`). Rationale is sound and consistent throughout Section 4.
- Health check endpoint contract: `GET /health`, no auth, returns `{ "status": "ok", "timestamp": "<ISO string>" }` — HTTP 200, `application/json`. Matches L2-002 §5.4 exception and L2-002 §6.3 liveness requirement.
- Express server uses `pinoHttp({ logger })` middleware, registered before routes in `server.ts`. Correct.
- No domain logic in scaffold: `server.ts` contains only HTTP setup, logging config, pool import, health route, and graceful shutdown. `DomainError` is an abstract base class only. `pool.ts` has zero business logic. All bounded-context directories are empty stubs.
- Acceptance criteria in Section 16 are all testable and specific (build success, test pass, HTTP response body, port numbers, lint clean, no hardcoded DB URL, graceful shutdown, folder structure existence).
- Build scripts are complete: `npm run dev`, `build`, `test`, `typecheck`, `lint`, `format` all described in Section 14 with exact behaviour. `make dev-stack` documented.
- No secrets hardcoded: `DATABASE_URL` exclusively from `process.env` with a fast-fail guard. `PORT` and `LOG_LEVEL` from env with safe defaults. Pool connection string from env.
- Directory structure matches hexagonal architecture spec: all six bounded contexts (`account`, `campaign`, `donor`, `payments`, `kyc`, `shared`) with `domain/`, `ports/`, `adapters/`, `application/`, `api/` (except `shared` which correctly omits `api/`).
- Backend entry point named `server.ts` — correctly resolves the `pkill -f "tsx.*server"` kill pattern documented in research Q2.
- `pino-pretty` is a devDependency only; used via transport config gated on `NODE_ENV !== 'production'`, never a direct `import`.
- `@clerk/express` and `posthog-node` installed but not wired — correct for scaffold; auth is feat-002.
- `pg` pool closed gracefully on `SIGTERM` via `pool.end()` callback chain. Matches PRD acceptance criterion.
- `dist/` excluded from build tsconfig; implementer note to add to `.gitignore` is in acceptance criteria.
- Docker Compose conflict resolution is explicit and justified: L3-001 §12.2 overrides CLAUDE.md prohibition. Simplified compose (postgres + migrate only) is recommended and rationale is sound.

### Design Spec Validation

- All Tier 2 semantic tokens are defined in `tokens.css`: actions, status, surfaces, text, borders, progress/data, gradients, motion, radius. Matches L2-001 Section 2 exhaustively.
- CSS tokens reference only Tier 1 identity values via `var()` — no raw hex in Tier 2 token declarations. Opacity-derived values are resolved to `rgba()` with an explicit implementation note explaining why (CSS `var()` cannot do opacity modification without `color-mix()`). This is acceptable and consistent with the L2-001 §2 opacity convention intent.
- Font families correct: `--font-display: 'Bebas Neue', sans-serif`, `--font-body: 'DM Sans', sans-serif`, `--font-data: 'Space Mono', monospace`. Match L2-001 §1.3.
- Placeholder `HomePage.tsx` uses only Tier 2 semantic tokens in inline styles (`var(--color-bg-page)`, `var(--font-display)`, `var(--color-text-primary)`, `var(--color-text-secondary)`, `var(--color-status-active-bg)`, `var(--color-status-active-border)`, `var(--radius-badge)`, `var(--font-body)`, `var(--color-action-primary-hover)`, `var(--color-status-active)`). No Tier 1 direct references.
- Dark-first background: `body { background-color: var(--color-bg-page) }` which maps to `--void` (`#060A14`). `HomePage` `<main>` also applies `backgroundColor: 'var(--color-bg-page)'`. Correct.
- No light mode in core app: design spec Section 7 explicitly defers light-theme exception contexts.
- `prefers-reduced-motion` media query included in `tokens.css` with duration overrides and universal animation safety net. Satisfies WCAG 2.1 SC 2.3.3 and L2-001 §5.2.
- Accessibility contrast ratios specified in Section 6.1 of design spec, matching L2-001 §5.1 values exactly. Constraint on `--color-text-accent` (large text only) is documented.

### Consistency Check

- Spec and design agree on file names: `App.tsx`, `routes/HomePage.tsx`, `src/main.tsx`, `src/styles/tokens.css`, `src/styles/global.css`. Design spec introduces `styles/tokens.css` and `styles/global.css` (not present in technical spec's tree) — this is an addendum, not a contradiction. Design spec explicitly notes that `index.css` (from technical spec) should be merged into `global.css`.
- Tech stack choices match L3-008: Express 5.x, React 19.x, Vite, TanStack Query v5, React Router v7, Tailwind CSS v4, Pino, pino-http, pg, TypeScript, Vitest, Zod, Clerk, PostHog.
- No contradictions between spec and design docs: App.tsx content confirmed identical in both; `HomePage.tsx` in design supersedes the minimal stub in technical spec (design spec makes this explicit in Section 4).
- No feat-002+ features included: auth middleware explicitly out of scope; `MOCK_AUTH` deferred; Clerk not wired; PostHog not initialised; Stripe/Veriff/SES adapters not implemented.

### Cross-Spec Compliance

- L2-002 (Engineering Standard): Parameterised SQL only (no queries in scaffold but pool established correctly); no hardcoded secrets; structured logging via Pino; TypeScript strict mode; `DATABASE_URL` from env; no `console.log`; acceptance criteria include lint/format/typecheck gates.
- L3-001 (Architecture): Hexagonal folder structure implemented; `GET /health` unversioned (correct — health checks are not application API endpoints); API versioning note that future routes will use `/v1/`; Docker Compose for human developers created; CommonJS backend rationale documented as ADR-worthy.
- L3-005 (Frontend Standards): React 19, Vite, TypeScript strict; TanStack Query, React Router v7; Tailwind v4; named exports (only page-level defaults are default exports); all props typed; Tier 2 tokens only; dark-first; `prefers-reduced-motion`; Testing Library with accessible queries (`getByRole`).
- L3-008 (Tech Stack): All listed frontend and backend packages are included in respective `package.json` files. `react-router` (not `react-router-dom`) used correctly for v7.

---

## Failures (Must Fix)

None.

---

## Warnings (Nice to Fix)

- [WARN] **`tsconfig.node.json` includes `vitest.config.ts`** (`packages/frontend/tsconfig.node.json` has `"include": ["vite.config.ts", "vitest.config.ts"]`), but the research spec's version only included `vite.config.ts`. The technical spec version is correct — `vitest.config.ts` should be included so it is type-checked. This is the right call but the implementer should be aware it differs from the Vite scaffold default.

- [WARN] **`tsconfig.app.json` has both `"outDir"` and `"noEmit": true`** (Section 4.4). The `outDir` is redundant when `noEmit` is true. It causes no errors but is misleading. Implementer may omit `outDir` from `tsconfig.app.json` since `tsc -b --noEmit` is what the typecheck script runs and `vite build` handles the actual output.

- [WARN] **Vite proxy path mismatch**: The Vite dev server proxy is configured at `/api` (Section 10), but the spec notes that application API routes will use `/v1/` prefix. A request to `/v1/campaigns` from the frontend would NOT be proxied unless the path starts with `/api`. The proxy should be `/api` only if the frontend always calls `/api/v1/...`, or changed to `/v1` if the frontend calls `/v1/...` directly. This is a latent issue for feat-002+ and should be decided before the first non-health route is added. The implementer should note this in `gotchas.md`.

- [WARN] **Docker Compose `version: '3.9'` is deprecated**: The `version` field in Docker Compose files has been deprecated since Compose V2 (Docker 20.10+). Using the simplified compose (postgres + migrate only) as recommended by the spec is fine, but the implementer should omit the `version` field entirely in the actual file to avoid deprecation warnings.

- [WARN] **`global.css` import chain**: Design spec instructs that `main.tsx` should import `global.css` (not `index.css`), but the technical spec's `main.tsx` imports `./index.css`. The implementer must reconcile these: either rename `index.css` to `global.css` (per design spec) or keep `index.css` as a thin forwarder. The design spec takes precedence as the more specific guidance. The implementer should use `global.css` as the entry stylesheet.

- [WARN] **Coverage thresholds will fail if no domain code is covered**: The backend `vitest.config.ts` sets 90% coverage thresholds on `src/**/*.ts` excluding `src/server.ts` and test files. With only `DomainError.ts` and `pool.ts` as non-test source files, coverage will be 100% on `DomainError.ts` (fully tested) but `pool.ts` has no test. This may cause the coverage threshold to fail on `pool.ts` (0% branch coverage if the `DATABASE_URL` guard is not tested). The implementer should either add a `pool.ts` to the coverage exclude list or add a test for the `DATABASE_URL` missing case. Given the scaffold context, excluding `pool.ts` from coverage is reasonable.

- [WARN] **`@vitest/coverage-v8` version is `latest`**: Unlike other dependencies which use semver ranges, `@vitest/coverage-v8` uses `"latest"`. This should be a semver range (`^3.0.0`) matching the `vitest` version range to avoid version mismatches.

---

## Notes for Implementation

1. **File reconciliation**: The design spec adds `src/styles/tokens.css` and `src/styles/global.css` to the file tree. The implementer must create these files (from design spec Section 2 and 3) and update `main.tsx` to import `./styles/global.css` instead of `./index.css`. The `index.css` file from the technical spec tree becomes `src/styles/global.css` (with its content expanded per design spec).

2. **`pool.ts` coverage exclusion**: Add `src/shared/adapters/db/pool.ts` to the vitest coverage `exclude` list, or add a smoke test that mocks the environment to exercise the `DATABASE_URL` guard. The former is simpler for a scaffold.

3. **Proxy path decision**: Document in `gotchas.md` that the Vite `/api` proxy and the backend `/v1/` route prefix may need alignment when feat-002 adds real routes. The health check at `/health` (unversioned) is not affected.

4. **Context maintenance**: After implementation, update `/workspace/.claude/context/patterns.md` and `/workspace/.claude/context/gotchas.md` per Section 19 of the technical spec.

5. **`docker-compose.yml`**: Use the simplified version (postgres + migrate services only). Omit the `version:` field. Do not reference non-existent Dockerfiles.

6. **Smoke test for `App.test.tsx`**: The test uses `render(<App />)` which includes `BrowserRouter`. Ensure `jsdom` environment is set in the vitest config (it is — `environment: 'jsdom'`). The `MemoryRouter` is not needed since `BrowserRouter` works in jsdom.

7. **Biome `noConsole: error`**: The `server.ts` template uses only `pino` logger — no `console.log`. The `pool.ts` uses only a thrown `Error`. Both are compliant. Ensure no `console.*` calls are introduced during implementation.
