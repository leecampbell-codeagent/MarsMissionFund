# feat-001: Monorepo Scaffold — Research

## What Already Exists

The workspace root is largely a shell. The following is confirmed present:

**Root-level files:**
- `/workspace/package.json` — defines the root package (`mars-mission-fund`, private). Has scripts for `lint`, `lint:fix`, `format`, `format:fix`, `typecheck` (echoes placeholder), and `test` (echoes placeholder). Dev dependencies: `@biomejs/biome ^2.4.5`, `@playwright/cli ^0.1.1`, `markdownlint-cli2 ^0.21.0`. **No `workspaces` field. No `concurrently` or workspace scripts.**
- `/workspace/tsconfig.base.json` — fully configured base tsconfig with `strict: true`, `ES2022` target, `ESNext` module, `moduleResolution: bundler`, all strict extras (`noUnusedLocals`, `noUnusedParameters`, `noUncheckedIndexedAccess`, etc.).
- `/workspace/biome.json` — fully configured root Biome 2.4.5 config. Covers all TypeScript/JS files, uses VCS ignore, enforces `noConsole: error` in linter, uses single quotes, trailing commas, semicolons always, line width 100. Has test file override relaxing `noConsole`. **No per-package Biome config needed.**
- `/workspace/Makefile` — only has `dev-stack` target, which calls `autonomous/scripts/start-dev-stack.sh`. That script already conditionally starts the backend and frontend from their package directories if `package.json` exists.
- `/workspace/.env.example` — documents: `DATABASE_URL`, `POSTGRES_USER/PASSWORD/DB`, `PORT=3001`, `NODE_ENV`, `LOG_LEVEL`, `VITE_API_URL`, `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SIGNING_SECRET`, `VITE_CLERK_PUBLISHABLE_KEY`, `MOCK_PAYMENTS/KYC/EMAIL/AUTH`, and commented PostHog keys.
- `/workspace/.github/workflows/ci.yml` — CI runs `npm ci`, `npm run lint`, `npm run format`, `npm run typecheck`, `npm test`. All four root scripts must be real and work.
- `/workspace/db/migrations/20260305120000_add_updated_at_trigger.sql` — defines `update_updated_at_column()` PL/pgSQL trigger function. Already applied by dbmate.
- `/workspace/autonomous/scripts/start-dev-stack.sh` — starts backend via `npm run dev` from `packages/backend` and frontend from `packages/frontend`. Uses `tsx.*server` process pattern for kills.

**Not present:**
- `packages/` directory or any workspace packages
- `docker-compose.yml` at root
- `concurrently` or any workspace tooling at root
- Any application source code

---

## Tech Stack Decisions

From `specs/tech/tech-stack.md` (L3-008):

### Backend packages to install
| Package | Version | Notes |
|---------|---------|-------|
| `express` | `^5.x` | HTTP framework |
| `@types/express` | latest | Types for Express 5 |
| `typescript` | latest stable | Language |
| `pino` | latest stable | Structured JSON logging |
| `pino-http` | latest stable | HTTP request logging middleware |
| `pino-pretty` | latest stable | **devDependency only** |
| `pg` | latest stable | PostgreSQL driver |
| `@types/pg` | latest | PG types |
| `zod` | latest stable | Validation |
| `tsx` | latest stable | **devDependency** — dev server runner (`tsx watch`) |
| `vitest` | latest stable | **devDependency** — test runner |
| `supertest` | latest stable | **devDependency** — HTTP assertions |
| `@types/supertest` | latest | **devDependency** |

### Frontend packages to install
| Package | Version | Notes |
|---------|---------|-------|
| `react` | `^19.x` | UI framework |
| `react-dom` | `^19.x` | DOM renderer |
| `@types/react` | latest | Types |
| `@types/react-dom` | latest | Types |
| `typescript` | latest stable | Language |
| `vite` | latest stable | Build tool and dev server |
| `@vitejs/plugin-react` | latest | React plugin for Vite |
| `tailwindcss` | `^4.x` | Styling |
| `@tailwindcss/vite` | latest | Tailwind v4 Vite plugin |
| `@tanstack/react-query` | `^5.x` | Server state management |
| `react-router` | `^7.x` | Client-side routing (note: React Router v7 uses `react-router`, not `react-router-dom` as a separate package) |
| `zod` | latest stable | Validation |
| `vitest` | latest stable | **devDependency** |
| `@testing-library/react` | latest stable | **devDependency** |
| `@testing-library/jest-dom` | latest stable | **devDependency** — matchers |
| `jsdom` | latest stable | **devDependency** — test environment |
| `msw` | latest stable | **devDependency** — API mocking |

### Root additions needed
- `concurrently` — to run backend + frontend `npm run dev` simultaneously from root
- `npm workspaces` field in root `package.json`

---

## Directory Structure

The exact tree to create:

```
packages/
  backend/
    src/
      shared/
        domain/
        ports/
        adapters/
        application/
      account/
        domain/
        ports/
        adapters/
        application/
        api/
      campaign/
        domain/
        ports/
        adapters/
        application/
        api/
      donor/
        domain/
        ports/
        adapters/
        application/
        api/
      payments/
        domain/
        ports/
        adapters/
        application/
        api/
      kyc/
        domain/
        ports/
        adapters/
        application/
        api/
      index.ts           ← Express app entry point
    package.json
    tsconfig.json
    vitest.config.ts
  frontend/
    src/
      main.tsx           ← Vite entry point
      App.tsx            ← Root component with router
      routes/
        HomePage.tsx     ← Placeholder page (default export)
    index.html           ← Vite HTML template
    package.json
    tsconfig.json
    tsconfig.app.json    ← App-specific tsconfig
    tsconfig.node.json   ← Node config for vite.config.ts
    vite.config.ts
    vitest.config.ts
docker-compose.yml       ← Root, for human developers
```

**Note on bounded contexts from PRD:** The PRD specifies `src/{domain}/domain/` etc. The named contexts from `specs/tech/architecture.md` are: `account`, `campaign`, `donor`, `payments`, `kyc`, plus `shared` for cross-cutting platform code.

**Note on `shared`:** No `api/` layer in `shared/` — shared contains domain types, port interfaces, and cross-cutting adapters (e.g., database pool, error base classes).

---

## Package Configurations

### Root `package.json` changes needed
```json
{
  "workspaces": ["packages/backend", "packages/frontend"],
  "scripts": {
    "dev": "concurrently \"npm run dev --workspace=packages/backend\" \"npm run dev --workspace=packages/frontend\"",
    "build": "npm run build --workspace=packages/backend && npm run build --workspace=packages/frontend",
    "typecheck": "npm run typecheck --workspace=packages/backend && npm run typecheck --workspace=packages/frontend",
    "test": "npm test --workspace=packages/backend && npm test --workspace=packages/frontend"
  },
  "devDependencies": {
    "concurrently": "^9.x"
  }
}
```

### `packages/backend/package.json`
```json
{
  "name": "@mmf/backend",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc --project tsconfig.json",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```
**Note:** The start-dev-stack.sh script kills processes matching `tsx.*server` — but since it starts via `tsx watch src/index.ts` (not a file named `server`), this pattern might not match. The Implementer should verify the kill pattern or note this as a potential issue.

### `packages/frontend/package.json`
```json
{
  "name": "@mmf/frontend",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "typecheck": "tsc --noEmit",
    "preview": "vite preview",
    "test": "vitest run"
  }
}
```

---

## TypeScript Configuration

### `packages/backend/tsconfig.json`
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

**Important**: `tsconfig.base.json` uses `"moduleResolution": "bundler"` which works well for both backend (with tsx) and frontend (with Vite). For production `tsc` build of the backend, this may need `"moduleResolution": "node16"` or `"nodenext"` instead. The Implementer should test whether `bundler` + `tsc` works for the backend build, or switch the backend tsconfig override to `"moduleResolution": "node16"` and `"module": "Node16"`.

### `packages/frontend/tsconfig.json` (references pattern — Vite standard)
```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

### `packages/frontend/tsconfig.app.json`
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "outDir": "./dist",
    "noEmit": true
  },
  "include": ["src"]
}
```

### `packages/frontend/tsconfig.node.json`
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "noEmit": true
  },
  "include": ["vite.config.ts"]
}
```

---

## Health Check

From `specs/standards/engineering.md` (L2-002), Section 6.3, and the PRD acceptance criteria:

- The `/health` endpoint is the **sole exception** to the "every endpoint requires authentication" rule (L2-002 §5.4).
- It must report liveness ("this process is running and can accept requests") and readiness ("this service and its critical dependencies are functioning correctly").
- The PRD specifies it returns `{ status: "ok" }`.
- Per L2-002 §6.3, a full implementation should also include readiness (DB connectivity). However, for this scaffold feature, the PRD explicitly says "any application-level routes beyond `/health`" are out of scope and the acceptance criterion is simply `{ status: "ok" }`.

**Exact response:**
```json
{ "status": "ok" }
```
HTTP 200, no auth required. Content-Type: `application/json`.

For the scaffold, a simple liveness check suffices. A follow-up feature can add readiness/DB check. Do not add DB ping to the health endpoint in this feature — the PRD's out-of-scope boundary is routes and complexity beyond minimal.

**Route:** `GET /health` (no `/v1/` prefix — health checks are typically unversioned).

---

## Hex Architecture Layout

From `specs/tech/architecture.md` (L3-001) §5.4 and the PRD, the backend is a single deployment unit with modular internal hex architecture. The bounded contexts are: `account`, `campaign`, `donor`, `payments`, `kyc`, `shared`.

```
packages/backend/src/
  shared/
    domain/
      errors/
        DomainError.ts        ← Base class: abstract, with code: string
    ports/
    adapters/
      db/
        pool.ts               ← pg Pool singleton, reads DATABASE_URL
  account/
    domain/
    ports/
    adapters/
    application/
    api/
  campaign/
    domain/
    ports/
    adapters/
    application/
    api/
  donor/
    domain/
    ports/
    adapters/
    application/
    api/
  payments/
    domain/
    ports/
    adapters/
    application/
    api/
  kyc/
    domain/
    ports/
    adapters/
    application/
    api/
  index.ts
```

The PRD acceptance criterion says: "follows the hexagonal architecture folder structure: `src/{domain}/domain/`, `src/{domain}/ports/`, `src/{domain}/adapters/`, `src/{domain}/application/`, `src/{domain}/api/`."

For the scaffold, directories can exist as empty folders (with `.gitkeep` files) for all contexts except `shared`, where the `DomainError` base class and the `pg` pool adapter should be minimal working code.

---

## Vite Configuration

### `packages/frontend/vite.config.ts`
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
```

---

## Vitest Configuration

### `packages/backend/vitest.config.ts`
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', '**/*.test.ts'],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
      },
    },
  },
});
```

### `packages/frontend/vitest.config.ts`
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.tsx', 'src/**/*.test.ts'],
  },
});
```

---

## Build Output

- Backend: `packages/backend/dist/` — compiled JS from `tsc`
- Frontend: `packages/frontend/dist/` — bundled assets from `vite build`
- Both `dist/` directories should be in `.gitignore`

---

## Docker Compose (for human developers)

The PRD acceptance criterion requires a root `docker-compose.yml` for human developers. Per `specs/tech/architecture.md` §12.2, it should provide:
- PostgreSQL (user: `mmf`, password: `mmf`, database: `mmf`)
- dbmate for running migrations
- Backend dev server
- Frontend dev server

The agent runtime (autonomous Docker container) must NOT use this file — it has PostgreSQL pre-provisioned and cannot run Docker from inside the container.

---

## Smoke Tests

Each package needs at least one passing smoke test:

**Backend** (`src/shared/domain/errors/DomainError.test.ts` or similar):
- Tests that a concrete `DomainError` subclass has the correct `code` property.

**Frontend** (`src/App.test.tsx` or similar):
- Tests that the root `App` component renders without crashing (using Testing Library).

---

## Open Questions for Spec Writer

1. **Backend module system for production build**: `tsconfig.base.json` uses `"moduleResolution": "bundler"` which is designed for bundlers, not `tsc` Node.js output. The backend uses `tsx` for dev (which handles this fine), but `tsc` for the production build may need `"module": "Node16"` and `"moduleResolution": "Node16"` in the backend tsconfig override to generate correct `import` statements with `.js` extensions. Alternatively, use CommonJS (`"module": "CommonJS"`) for the backend. The Spec Writer should decide: **ESM with Node16 module resolution, or CommonJS?**

2. **Kill pattern in start-dev-stack.sh**: The script kills `tsx.*server` processes, but the backend entry is `src/index.ts` (not `server.ts`). The kill will not match. Either the backend entry point should be `src/server.ts` (with `index.ts` just calling it), or the script should be updated to kill `tsx.*index`. Since the script is an existing file at `/workspace/autonomous/scripts/start-dev-stack.sh`, the Spec Writer should decide: **rename backend entry to `src/server.ts` or accept that the existing kill pattern won't match?** Recommendation: update the kill pattern, or name the entry `src/server.ts` and re-export from `src/index.ts`.

3. **Biome per-package config**: The root `biome.json` covers all files globally. No per-package Biome config is needed. Confirm this is correct — the Spec Writer should verify the root config's `includes` doesn't need updating to add `packages/**`.

4. **`MOCK_AUTH=true` handling in scaffold**: The `.env.example` has `MOCK_AUTH=true`. The PRD says auth is feat-002. The scaffold's backend `index.ts` should read this env var but not wire any middleware yet. The Spec Writer should confirm whether the scaffold needs to handle `MOCK_AUTH` at all, or just document it in `.env.example` for feat-002.

5. **`docker-compose.yml` scope**: The PRD acceptance criterion requires this file, but CLAUDE.md says "Do not create features or specs for... Docker Compose configuration." This is a tension. The architecture spec (L3-001 §12.2) explicitly says "The agent should create this file as part of infrastructure setup." Architecture spec wins per the conflict resolution hierarchy. The Spec Writer should include `docker-compose.yml` creation as in scope.

6. **Frontend placeholder page content**: The PRD says "a root route rendering a placeholder page." The Spec Writer should decide what minimum content is acceptable — a simple `<h1>Mars Mission Fund</h1>` is likely sufficient for the scaffold.

7. **Tailwind CSS v4 setup**: Tailwind CSS v4 uses `@tailwindcss/vite` instead of a PostCSS plugin and uses `@import "tailwindcss"` in the CSS entry point rather than `@tailwind` directives. The Spec Writer should confirm this approach is correct for the v4 API.
