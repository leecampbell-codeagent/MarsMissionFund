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
