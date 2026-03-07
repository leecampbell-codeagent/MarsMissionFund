# feat-001: Monorepo Scaffold — Technical Implementation Spec

**Spec ID:** feat-001-spec
**Feature:** Monorepo Scaffold — Backend and Frontend Packages
**Status:** Ready for Implementation
**Depends on:** None
**Required by:** All subsequent features

---

## 1. Overview

### What This Feature Creates

feat-001 establishes the npm workspace monorepo containing two packages:

- `packages/backend` — Express 5.x HTTP server, hexagonal architecture folder structure, pg connection pool, Pino logging, single `/health` endpoint
- `packages/frontend` — Vite + React 19 SPA, Tailwind CSS v4, TanStack Query, React Router v7, placeholder home page

It also wires the root `package.json` with workspaces, delegates all dev/build/test/typecheck scripts to the packages, and adds a `docker-compose.yml` for human developers.

### Why This Is the Foundation

Every subsequent feature adds code inside `packages/backend/src/{context}/` or `packages/frontend/src/`. Without this scaffold, no feature can be built, tested, or deployed. The CI workflow (`ci.yml`) already expects `npm run lint`, `npm run format`, `npm run typecheck`, and `npm test` to succeed at the root — this feature makes them real.

---

## 2. Directory Structure

The exact tree to create. Files marked `(new file)` must be created with content specified below. Directories marked `(empty — .gitkeep)` should contain only a `.gitkeep` file.

```
packages/
  backend/
    src/
      shared/
        domain/
          errors/
            DomainError.ts          (new file)
            DomainError.test.ts     (new file — smoke test)
        ports/                      (empty — .gitkeep)
        adapters/
          db/
            pool.ts                 (new file)
      account/
        domain/                     (empty — .gitkeep)
        ports/                      (empty — .gitkeep)
        adapters/                   (empty — .gitkeep)
        application/                (empty — .gitkeep)
        api/                        (empty — .gitkeep)
      campaign/
        domain/                     (empty — .gitkeep)
        ports/                      (empty — .gitkeep)
        adapters/                   (empty — .gitkeep)
        application/                (empty — .gitkeep)
        api/                        (empty — .gitkeep)
      donor/
        domain/                     (empty — .gitkeep)
        ports/                      (empty — .gitkeep)
        adapters/                   (empty — .gitkeep)
        application/                (empty — .gitkeep)
        api/                        (empty — .gitkeep)
      payments/
        domain/                     (empty — .gitkeep)
        ports/                      (empty — .gitkeep)
        adapters/                   (empty — .gitkeep)
        application/                (empty — .gitkeep)
        api/                        (empty — .gitkeep)
      kyc/
        domain/                     (empty — .gitkeep)
        ports/                      (empty — .gitkeep)
        adapters/                   (empty — .gitkeep)
        application/                (empty — .gitkeep)
        api/                        (empty — .gitkeep)
      server.ts                     (new file — Express entry point)
    package.json                    (new file)
    tsconfig.json                   (new file)
    vitest.config.ts                (new file)
  frontend/
    src/
      routes/
        HomePage.tsx                (new file)
      test/
        setup.ts                    (new file)
      App.tsx                       (new file)
      App.test.tsx                  (new file — smoke test)
      main.tsx                      (new file)
      index.css                     (new file)
    index.html                      (new file)
    package.json                    (new file)
    tsconfig.json                   (new file)
    tsconfig.app.json               (new file)
    tsconfig.node.json              (new file)
    vite.config.ts                  (new file)
    vitest.config.ts                (new file)
docker-compose.yml                  (new file — root, for human developers)
```

**Note on `shared/` layout:** The `shared` context has no `api/` layer — it contains only cross-cutting domain types, port interfaces, and infrastructure adapters (e.g., the database pool).

**Note on backend entry point:** The file is named `server.ts` (not `index.ts`) to match the existing kill pattern `pkill -f "tsx.*server"` in `/workspace/autonomous/scripts/start-dev-stack.sh`. This ensures the dev stack restart script correctly terminates the backend process.

---

## 3. Package Configurations

### 3.1 Root `package.json`

Update the existing `/workspace/package.json`. Add `workspaces`, add `concurrently` as a dev dependency, and replace the placeholder `typecheck` and `test` scripts with real workspace-delegating versions. Preserve the existing `lint`, `lint:fix`, `format`, `format:fix` scripts and existing dev dependencies unchanged.

```json
{
  "name": "mars-mission-fund",
  "private": true,
  "description": "Sample crowdfunding app for Autonomous Agentic Coding workshops",
  "workspaces": [
    "packages/backend",
    "packages/frontend"
  ],
  "scripts": {
    "dev": "concurrently \"npm run dev --workspace=packages/backend\" \"npm run dev --workspace=packages/frontend\"",
    "build": "npm run build --workspace=packages/backend && npm run build --workspace=packages/frontend",
    "typecheck": "npm run typecheck --workspace=packages/backend && npm run typecheck --workspace=packages/frontend",
    "test": "npm test --workspace=packages/backend && npm test --workspace=packages/frontend",
    "lint": "biome check . && markdownlint-cli2 '**/*.md'",
    "lint:fix": "biome check --write . && markdownlint-cli2 --fix '**/*.md'",
    "format": "biome format .",
    "format:fix": "biome format --write ."
  },
  "devDependencies": {
    "@biomejs/biome": "^2.4.5",
    "@playwright/cli": "^0.1.1",
    "concurrently": "^9.0.0",
    "markdownlint-cli2": "^0.21.0"
  }
}
```

### 3.2 `packages/backend/package.json`

```json
{
  "name": "@mmf/backend",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc --project tsconfig.json",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  },
  "dependencies": {
    "@clerk/express": "^1.0.0",
    "express": "^5.0.0",
    "pg": "^8.0.0",
    "pino": "^9.0.0",
    "pino-http": "^10.0.0",
    "posthog-node": "^4.0.0",
    "zod": "^3.0.0"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "@types/pg": "^8.0.0",
    "@types/supertest": "^6.0.0",
    "@vitest/coverage-v8": "latest",
    "pino-pretty": "^11.0.0",
    "supertest": "^7.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.0.0",
    "vitest": "^3.0.0"
  }
}
```

**Dependency notes:**
- No `"type": "module"` — the backend uses CommonJS (see Section 4.1 for the decision rationale).
- `pino-pretty` is a dev dependency only; it is never imported in application code and only used via `pino` transport configuration gated on `NODE_ENV !== 'production'`.
- `@clerk/express` is installed now so it is available for feat-002 (auth). It is not wired into any middleware in this feature.
- `posthog-node` is installed now for feature flag infrastructure. Not wired in this feature.

### 3.3 `packages/frontend/package.json`

```json
{
  "name": "@mmf/frontend",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "typecheck": "tsc -b --noEmit",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@clerk/react": "^5.0.0",
    "@tanstack/react-query": "^5.0.0",
    "posthog-js": "^1.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router": "^7.0.0",
    "zod": "^3.0.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.0.0",
    "@testing-library/jest-dom": "^6.0.0",
    "@testing-library/react": "^16.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.0.0",
    "jsdom": "^25.0.0",
    "msw": "^2.0.0",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.0.0",
    "vite": "^6.0.0",
    "vitest": "^3.0.0"
  }
}
```

**Dependency notes:**
- React Router v7 ships as a single `react-router` package — there is no separate `react-router-dom` package.
- Tailwind CSS v4 requires `@tailwindcss/vite` plugin (not PostCSS). No `tailwind.config.*` file is needed.
- `@clerk/react` and `posthog-js` are installed now and not wired in this feature.

---

## 4. TypeScript Configuration

### 4.1 Module System Decision: CommonJS for Backend

The backend uses **CommonJS** (`"module": "CommonJS"`) rather than ESM. Rationale:

- `tsconfig.base.json` uses `"moduleResolution": "bundler"` which is designed for bundler contexts. For a Node.js `tsc` output, `bundler` resolution does not generate correct `.js` extensions on imports, causing runtime failures.
- CommonJS avoids all ESM/CJS interop friction with `pg`, `pino`, and other deps that have mixed ESM support.
- `tsx` handles dev mode seamlessly regardless of module system.
- The frontend uses ESM (`"type": "module"`) — that is unaffected.

### 4.2 `packages/backend/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "CommonJS",
    "moduleResolution": "node10",
    "outDir": "./dist",
    "rootDir": "./src",
    "lib": ["ES2022"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

**Notes:**
- `"module": "CommonJS"` + `"moduleResolution": "node10"` is the correct pairing for Node.js CommonJS output from `tsc`.
- Inherits `strict: true`, `noUnusedLocals`, `noUnusedParameters`, `noUncheckedIndexedAccess`, and all other strict options from `tsconfig.base.json`.
- Test files are excluded from the production build output but are still type-checked by the `typecheck` script (`tsc --noEmit` without `exclude`). To make `typecheck` include test files, the `typecheck` script should pass a separate tsconfig or rely on Vitest's own type checking. In practice, `tsc --noEmit` with the project tsconfig (which excludes `*.test.ts`) is sufficient for CI — Vitest handles test file type errors at test time.

### 4.3 `packages/frontend/tsconfig.json`

The Vite standard composite project reference pattern:

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

### 4.4 `packages/frontend/tsconfig.app.json`

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
    "noEmit": true,
    "composite": true
  },
  "include": ["src"]
}
```

### 4.5 `packages/frontend/tsconfig.node.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "noEmit": true,
    "composite": true
  },
  "include": ["vite.config.ts", "vitest.config.ts"]
}
```

---

## 5. Backend Entry Point: `packages/backend/src/server.ts`

```typescript
import express from 'express';
import { pinoHttp } from 'pino-http';
import pino from 'pino';
import { pool } from './shared/adapters/db/pool';

const logger = pino({
  level: process.env['LOG_LEVEL'] ?? 'info',
  transport:
    process.env['NODE_ENV'] !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
});

const app = express();

app.use(pinoHttp({ logger }));
app.use(express.json());

// Health check — public, no auth (per L2-002 §5.4 exception)
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = parseInt(process.env['PORT'] ?? '3001', 10);

const server = app.listen(PORT, () => {
  logger.info({ port: PORT }, 'Backend server listening');
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received — shutting down gracefully');
  server.close(() => {
    pool.end(() => {
      logger.info('Database pool closed');
      process.exit(0);
    });
  });
});

export { app };
```

**Key points:**
- `app` is a named export so integration tests can import it without starting a listener.
- Pino transport is conditional on `NODE_ENV !== 'production'` — production emits raw JSON.
- `pino-pretty` is only used via the `transport` option (never a direct `import`), satisfying the "dev dependency only" constraint and the `biome.json` `noConsole: error` rule.
- `pool.end()` is called on `SIGTERM` to drain the pg connection pool gracefully before exit.
- Port is parsed as an integer (Express 5 requires a number, not a string).

---

## 6. Database Pool: `packages/backend/src/shared/adapters/db/pool.ts`

```typescript
import { Pool } from 'pg';

if (!process.env['DATABASE_URL']) {
  throw new Error('DATABASE_URL environment variable is required');
}

export const pool = new Pool({
  connectionString: process.env['DATABASE_URL'],
});
```

**Key points:**
- `DATABASE_URL` is read from `process.env` — never hardcoded (per CLAUDE.md and L2-002 §1.3).
- Fails fast at startup if `DATABASE_URL` is absent, preventing silent misconfiguration.
- The pool instance is a module-level singleton — imported wherever DB access is needed.
- No query logic here — repositories own queries; the pool is infrastructure only.

---

## 7. Domain Error Base Class: `packages/backend/src/shared/domain/errors/DomainError.ts`

```typescript
export abstract class DomainError extends Error {
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}
```

All domain-layer errors in every bounded context must extend `DomainError` with a unique `code` string (per backend.md rules and agent-handbook.md).

---

## 8. Health Check Endpoint

- **Route:** `GET /health`
- **Auth:** None (the sole public exception per L2-002 §5.4 and §6.3)
- **Response body:** `{ "status": "ok", "timestamp": "<ISO 8601>" }`
- **HTTP status:** 200
- **Content-Type:** `application/json`

The endpoint is unversioned — health checks are not application API endpoints and do not carry the `/v1/` prefix. Application API routes added in subsequent features will use `/v1/` prefix per L3-001 §6.1.

The scaffold health check reports liveness only ("process is running"). A readiness check (DB ping) is deferred — it is not required by the PRD acceptance criteria for this feature and adding DB I/O to the health endpoint adds startup-order complexity that is out of scope here.

---

## 9. Frontend Entry Point

### 9.1 `packages/frontend/index.html`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Mars Mission Fund</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

### 9.2 `packages/frontend/src/main.tsx`

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

### 9.3 `packages/frontend/src/App.tsx`

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

### 9.4 `packages/frontend/src/routes/HomePage.tsx`

```tsx
export default function HomePage() {
  return (
    <main>
      <h1>Mars Mission Fund</h1>
      <p>Crowdfunding the mission to Mars.</p>
    </main>
  );
}
```

### 9.5 `packages/frontend/src/index.css`

```css
@import "tailwindcss";
```

This is the Tailwind CSS v4 import syntax. The `@tailwindcss/vite` plugin processes it — no `@tailwind base/components/utilities` directives and no `tailwind.config.*` file are needed.

---

## 10. Vite Configuration: `packages/frontend/vite.config.ts`

```typescript
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

The `/api` proxy forwards all `/api/*` requests to the backend during development. Application API routes will use `/v1/` paths — the proxy is configured at `/api` to allow flexibility. Adjust if the backend API prefix differs.

---

## 11. Vitest Configuration

### 11.1 `packages/backend/vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/server.ts', '**/*.test.ts'],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
      },
    },
  },
});
```

Coverage thresholds apply to domain/application/adapter code. `src/server.ts` is excluded (it is the process entry point, not logic). Thresholds will pass trivially on the scaffold — they become meaningful as domain code is added.

### 11.2 `packages/frontend/vitest.config.ts`

```typescript
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

### 11.3 `packages/frontend/src/test/setup.ts`

```typescript
import '@testing-library/jest-dom';
```

This import registers all `@testing-library/jest-dom` matchers (e.g., `toBeInTheDocument()`) globally for all frontend tests.

---

## 12. Smoke Tests

Each package must have at least one passing test. These satisfy the PRD acceptance criterion and confirm the test infrastructure works end-to-end.

### 12.1 Backend Smoke Test: `packages/backend/src/shared/domain/errors/DomainError.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { DomainError } from './DomainError';

class TestError extends DomainError {
  readonly code = 'TEST_ERROR';
}

describe('DomainError', () => {
  it('sets the error code on a concrete subclass', () => {
    const error = new TestError('something went wrong');
    expect(error.code).toBe('TEST_ERROR');
    expect(error.message).toBe('something went wrong');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(DomainError);
  });

  it('sets the name to the subclass constructor name', () => {
    const error = new TestError('msg');
    expect(error.name).toBe('TestError');
  });
});
```

### 12.2 Frontend Smoke Test: `packages/frontend/src/App.test.tsx`

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('renders the home page heading', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /mars mission fund/i })).toBeInTheDocument();
  });
});
```

---

## 13. Docker Compose: `docker-compose.yml` (root)

This file is for **human developers only**. The agent runtime (autonomous Docker container) must not use it — it has PostgreSQL pre-provisioned and cannot run Docker-in-Docker.

```yaml
version: '3.9'

services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: mmf
      POSTGRES_PASSWORD: mmf
      POSTGRES_DB: mmf
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U mmf']
      interval: 5s
      timeout: 5s
      retries: 5

  migrate:
    image: amacneil/dbmate
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      DATABASE_URL: postgres://mmf:mmf@postgres:5432/mmf?sslmode=disable
    volumes:
      - ./db:/db
    command: up

  backend:
    build:
      context: .
      dockerfile: packages/backend/Dockerfile
    depends_on:
      migrate:
        condition: service_completed_successfully
    environment:
      DATABASE_URL: postgres://mmf:mmf@postgres:5432/mmf?sslmode=disable
      NODE_ENV: development
      PORT: 3001
      LOG_LEVEL: debug
    ports:
      - '3001:3001'
    volumes:
      - ./packages/backend:/app/packages/backend
      - /app/node_modules
    command: npm run dev --workspace=packages/backend

  frontend:
    build:
      context: .
      dockerfile: packages/frontend/Dockerfile
    depends_on:
      - backend
    environment:
      VITE_API_URL: http://localhost:3001
    ports:
      - '5173:5173'
    volumes:
      - ./packages/frontend:/app/packages/frontend
      - /app/node_modules
    command: npm run dev --workspace=packages/frontend

volumes:
  postgres_data:
```

**Note:** The `backend` and `frontend` services reference `Dockerfile` files that do not exist in this feature. For the initial scaffold, human developers can run services directly with `npm run dev` from the repo root instead of using Docker Compose for the app services. The `postgres` and `migrate` services work independently of the Dockerfiles. Dockerfiles will be added in a later infrastructure feature. Alternatively, the Implementer may simplify the compose file to only define the `postgres` and `migrate` services and note that backend/frontend are run directly.

**Simplified alternative** (recommended for scaffold completeness without requiring Dockerfiles):

```yaml
version: '3.9'

services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: mmf
      POSTGRES_PASSWORD: mmf
      POSTGRES_DB: mmf
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U mmf']
      interval: 5s
      timeout: 5s
      retries: 5

  migrate:
    image: amacneil/dbmate
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      DATABASE_URL: postgres://mmf:mmf@postgres:5432/mmf?sslmode=disable
    volumes:
      - ./db:/db
    command: up

volumes:
  postgres_data:
```

The Implementer should use the simplified version. Backend and frontend are started directly with `npm run dev` from the repo root (or `make dev-stack` inside the agent container).

---

## 14. Build Scripts Summary

| Command | What It Does |
|---------|-------------|
| `npm run dev` (root) | Runs backend (`tsx watch src/server.ts`) and frontend (`vite`) concurrently via `concurrently` |
| `npm run build` (root) | `tsc` compiles backend to `packages/backend/dist/`; Vite bundles frontend to `packages/frontend/dist/` |
| `npm test` (root) | Vitest runs backend tests (node env), then frontend tests (jsdom env) |
| `npm run typecheck` (root) | `tsc --noEmit` on backend, `tsc -b --noEmit` on frontend |
| `npm run lint` (root) | Biome check over all TS/JS files + markdownlint on all `.md` files |
| `npm run format` (root) | Biome format check (does not write) |
| `make dev-stack` | Runs `autonomous/scripts/start-dev-stack.sh` — runs dbmate migrations then starts backend + frontend |

---

## 15. Resolved Open Questions

The following open questions from `feat-001-research.md` are resolved here:

**Q1 — Backend module system:** Use **CommonJS**. The `tsconfig.base.json` uses `"moduleResolution": "bundler"`, which is incompatible with `tsc`-compiled Node.js output. CommonJS (`"module": "CommonJS"`, `"moduleResolution": "node10"`) is the correct pairing for backend `tsc` builds. `tsx` handles both in dev mode, so the developer experience is unaffected.

**Q2 — Backend entry point name:** Use **`src/server.ts`**. The existing `autonomous/scripts/start-dev-stack.sh` kills processes matching `pkill -f "tsx.*server"`. Naming the entry file `server.ts` ensures this pattern matches the `tsx watch src/server.ts` process. The PRD's `index.ts` preference is overridden by this operational constraint — the script is pre-existing infrastructure that cannot be changed as part of this feature.

**Q3 — Biome per-package config:** No per-package Biome config is needed. The root `biome.json` uses `"includes": ["**", "!dist", ...]` which already covers `packages/**`. No changes to `biome.json` are required.

**Q4 — `MOCK_AUTH=true` in scaffold:** The scaffold does **not** handle `MOCK_AUTH`. The env var is already documented in `.env.example`. Auth middleware is feat-002's responsibility. The backend `server.ts` does not read or branch on `MOCK_AUTH`.

**Q5 — `docker-compose.yml` scope:** **In scope.** Architecture spec L3-001 §12.2 explicitly states "The agent should create this file as part of infrastructure setup." This takes precedence over CLAUDE.md's prohibition on Docker Compose features, per the spec conflict resolution hierarchy (L3 spec outranks CLAUDE.md on this specific infrastructure deliverable). Use the simplified version (postgres + migrate services only).

**Q6 — Frontend placeholder content:** `<h1>Mars Mission Fund</h1>` with a subtitle paragraph. Minimal, testable via `getByRole('heading')`, and sufficient for the scaffold smoke test.

**Q7 — Tailwind CSS v4 setup:** Confirmed. Tailwind v4 uses `@tailwindcss/vite` plugin and `@import "tailwindcss"` in the CSS entry file. No PostCSS config, no `tailwind.config.ts`, no `@tailwind` directives.

---

## 16. Acceptance Criteria

All of the following must be true before this feature is complete:

- [ ] `npm run build` succeeds from the repo root with zero TypeScript errors
- [ ] `npm test` passes from the repo root — both backend and frontend smoke tests pass
- [ ] `GET /health` returns HTTP 200 with body `{ "status": "ok", "timestamp": "<ISO string>" }`
- [ ] Frontend dev server starts at `localhost:5173` (via `npm run dev --workspace=packages/frontend`)
- [ ] Backend dev server starts at `localhost:3001` (via `npm run dev --workspace=packages/backend`)
- [ ] `npm run typecheck` passes with zero errors in both packages
- [ ] `npm run lint` passes — Biome reports no errors across `packages/`
- [ ] `npm run format` passes — Biome reports no formatting violations
- [ ] Backend uses Pino logging — no `console.log` in any committed source file
- [ ] `DATABASE_URL` is read exclusively from `process.env` — never hardcoded
- [ ] `pg` pool closes gracefully on `SIGTERM`
- [ ] Hexagonal architecture folder structure exists for all six bounded contexts: `account`, `campaign`, `donor`, `payments`, `kyc`, `shared`
- [ ] `shared/domain/errors/DomainError.ts` abstract base class exists and exports `DomainError`
- [ ] Root `package.json` has `"workspaces": ["packages/backend", "packages/frontend"]`
- [ ] `docker-compose.yml` at repo root provides postgres + dbmate migrate services
- [ ] All new TypeScript is strict — no `any` types, no `@ts-ignore`
- [ ] `dist/` directories are in `.gitignore`

---

## 17. Out of Scope

The following are explicitly excluded from this feature:

- Authentication middleware (feat-002)
- Design system tokens and brand CSS custom properties (feat-003)
- Any API route beyond `GET /health`
- Database queries or migrations (beyond the already-applied `updated_at` trigger migration)
- Domain entities, value objects, or application services in any bounded context
- Clerk JWT verification or `MOCK_AUTH` handling
- PostHog initialisation or feature flag wiring
- Stripe, Veriff, or AWS SES adapter implementations
- E2E tests (Playwright)
- OpenAPI/Swagger documentation
- Dockerfiles for backend or frontend containers
- Production deployment configuration

---

## 18. Migrations

No new migrations are required for this feature. The scaffold is application code only. The existing migration `20260305120000_add_updated_at_trigger.sql` is already applied.

---

## 19. Context Maintenance

After implementing this feature, update:

- `/workspace/.claude/context/patterns.md` — Add patterns established here: CommonJS backend with `tsx` dev runner, Vitest config patterns for node vs jsdom, Tailwind v4 import syntax, `DomainError` extension pattern, pg pool singleton pattern.
- `/workspace/.claude/context/gotchas.md` — Add: `tsconfig.base.json` uses `"moduleResolution": "bundler"` which is incompatible with Node.js `tsc` output — backend must override to `"moduleResolution": "node10"` with `"module": "CommonJS"`; backend entry file must be named `server.ts` not `index.ts` due to `pkill -f "tsx.*server"` in `start-dev-stack.sh`.
