## feat-001: Monorepo Scaffold — Backend and Frontend Packages

**Bounded Context(s):** Platform / Cross-cutting
**Priority:** P0
**Dependencies:** None
**Estimated Complexity:** M

### Summary

Establish the npm workspace monorepo structure with `packages/backend` and `packages/frontend` packages, including all tooling configuration (TypeScript, Biome, Vitest, Vite), entry points, and shared dev scripts. This is the foundation every other feature builds upon. CLAUDE.md explicitly states the infrastructure exists — this feature wires it into a working skeleton with `npm run dev`, `npm test`, and `npm run build` all passing.

### Acceptance Criteria

- [ ] Root `package.json` defines an npm workspaces monorepo with `packages/backend` and `packages/frontend`.
- [ ] `packages/backend` contains a working Express 5.x server with a `/health` endpoint returning `{ status: "ok" }` (no auth required).
- [ ] `packages/frontend` contains a working Vite + React 19 SPA with a root route rendering a placeholder page.
- [ ] TypeScript strict mode is enabled in both packages (`strict: true` in `tsconfig.json`).
- [ ] Biome is configured at the root and enforces linting and formatting across both packages.
- [ ] `npm run dev` starts both backend (port 3001) and frontend (port 5173) concurrently from the root.
- [ ] `npm run build` compiles both packages with zero TypeScript errors.
- [ ] `npm test` runs Vitest for backend and frontend with at least one passing smoke test each.
- [ ] Backend uses Pino for structured logging — no `console.log` in committed code.
- [ ] `packages/backend` follows the hexagonal architecture folder structure: `src/{domain}/domain/`, `src/{domain}/ports/`, `src/{domain}/adapters/`, `src/{domain}/application/`, `src/{domain}/api/`.
- [ ] `.env.example` documents all required environment variables with placeholder values.
- [ ] `DATABASE_URL` is read from `process.env` — never hardcoded.
- [ ] Backend connects to PostgreSQL via `pg` with a connection pool; the pool is closed gracefully on `SIGTERM`.
- [ ] Root `docker-compose.yml` exists for human developers (PostgreSQL + dbmate + backend + frontend).

### User Story

As a developer, I want a working monorepo scaffold so that I can build application features in a consistent, well-structured codebase.

### Key Decisions / Open Questions

- Folder structure within `packages/backend/src/` uses bounded-context subdirectories (e.g., `account/`, `campaign/`, `donor/`, `payments/`, `kyc/`, `shared/`).
- Backend entry point is `packages/backend/src/index.ts`.
- Frontend entry point is `packages/frontend/src/main.tsx`.
- `pino-pretty` is a dev dependency only; production uses JSON output.

### Out of Scope

- Any application-level routes beyond `/health`.
- Authentication middleware (feat-002).
- Design system tokens (feat-003).
- Database migrations beyond the already-existing `updated_at` trigger migration.
