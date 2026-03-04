# Patterns

> Established patterns in the MMF codebase. Updated as patterns emerge during implementation.

## Project Structure Patterns

### npm Workspaces

- Root `package.json` with `"private": true` and `"workspaces": ["packages/*"]`.
- Package naming: `@mmf/backend`, `@mmf/frontend`.
- Root scripts delegate to workspaces: `npm run test --workspaces --if-present`.
- Workspace-specific scripts: `npm run dev --workspace=packages/backend`.

### TypeScript Configuration

- Shared `tsconfig.base.json` at repo root with `strict: true`.
- Each package has `tsconfig.json` that extends `../../tsconfig.base.json`.
- `strict: true` is non-negotiable per L2-002.

### Docker Compose Local Dev

- PostgreSQL with `pg_isready` health check, named volume for data persistence.
- Backend with source volume mount and `tsx watch` for hot reload.
- Frontend with Vite dev server bound to `0.0.0.0`.
- dbmate as one-shot migration service with `--wait` flag.
- All services on the same Docker bridge network.
- `depends_on` with `condition: service_healthy` for startup ordering.

## Backend Patterns

### Express App Factory

- Separate `app.ts` (creates and configures Express app) from `index.ts` (calls `app.listen`).
- This allows Supertest to import the app without starting the server.

### Pino Logger

- Create a singleton logger in `logger.ts`.
- Use `pino-http` middleware in the Express app.
- Use `pino-pretty` transport only when `NODE_ENV=development`.
- Never log sensitive data (card numbers, tokens, passwords).

### Health Check Endpoint

- `GET /health` returns `{ status: "ok" }` with HTTP 200.
- Unauthenticated (the only endpoint exempt from auth per L2-002 Section 6.3).
- Does not check database connectivity (liveness, not readiness) for the initial scaffold.

## Frontend Patterns

### Tailwind CSS v4 Setup

- Use `@tailwindcss/vite` plugin in `vite.config.ts`.
- CSS entry: `@import "tailwindcss"` --- no `@tailwind` directives.
- No `tailwind.config.js` --- configuration is CSS-first in v4.

### Vite Configuration

- API proxy configured in `vite.config.ts` under `server.proxy`.
- `server.host: true` for Docker compatibility.

## Database Migration Patterns

### dbmate Migration Structure

- Files in `db/migrations/` at repo root (NOT inside any package).
- Naming: `YYYYMMDDHHMMSS_description.sql` (dbmate default format).
- Each file has `-- migrate:up` and `-- migrate:down` sections.
- Both sections wrapped in `BEGIN; ... COMMIT;` for transactional DDL.
- Append-only — never modify existing migrations.
- One concern per migration file (one table per migration for foundational schema).
- Rollback order: reverse of creation order (drop dependents first).

### Reusable Trigger Pattern

- A single `update_updated_at_column()` function is created in the first migration.
- Applied to all tables that have `updated_at` via `CREATE TRIGGER ... BEFORE UPDATE`.
- NOT applied to append-only tables (`events`, `escrow_ledger`).

### Append-Only Table Pattern

- No `updated_at` column.
- Application layer exposes only `insert`, never `update` or `delete`.
- Defence in depth: BEFORE UPDATE/DELETE trigger that raises an exception.
- Used for: `events` table, `escrow_ledger` table.

### FK Convention

- `ON DELETE RESTRICT`: when the parent entity has a lifecycle that must be respected (accounts with campaigns, campaigns with contributions).
- `ON DELETE CASCADE`: when child entities are owned by and inseparable from the parent (milestones owned by campaigns).
- Every FK column gets an explicit index.

### Status Column Pattern

- `TEXT NOT NULL DEFAULT '<initial_state>'` with a CHECK constraint listing all valid values.
- Not PostgreSQL ENUM types (ENUMs are hard to modify in migrations).
- State machine transition validation is enforced at the domain layer, not the database.

## Testing Patterns

### Backend Tests

- Use Supertest with the Express app instance (not a running server).
- Import from `app.ts`, not `index.ts`.

### Frontend Tests

- Use `@testing-library/react` with accessible queries (`getByRole`, `getByLabelText`).
- Use `vitest` as the test runner (shares Vite config).

### Test File Location

- Co-located `__tests__/` directory adjacent to source files.
- Test files named `*.test.ts` (backend) or `*.test.tsx` (frontend).
