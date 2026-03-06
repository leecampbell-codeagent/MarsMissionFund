# Domain Knowledge

> Accumulated domain knowledge from research cycles. Updated by Spec Researcher agents.

---

## Infrastructure & Monorepo (feat-001)

### npm Workspaces

npm workspaces (npm 7+) hoist all dependencies to the root `node_modules` and allow cross-workspace `npm run` via `--workspace=packages/backend` flags.
The root `package.json` declares `"workspaces": ["packages/*"]`.
All installs should be run from the repo root using `--workspace=` flags to ensure correct hoisting.

### TypeScript Configuration Hierarchy

The repo uses a two-tier tsconfig pattern:
- `/workspace/tsconfig.base.json` — shared strict settings; already exists and is fully configured.
- `packages/*/tsconfig.json` — package-specific overrides; extend the base via `"extends": "../../tsconfig.base.json"`.

The base already enables: `strict: true`, `noUnusedLocals`, `noUnusedParameters`, `noUncheckedIndexedAccess`, `isolatedModules`.
`noUncheckedIndexedAccess` makes array element access return `T | undefined` — every `items[0]` needs a null check.

The base uses `"moduleResolution": "bundler"`.
Backend packages must override this to `"node16"` because they run directly in Node.js via `tsx`, not through a bundler.

### Tailwind CSS v4

The spec mandates Tailwind CSS v4 (L3-008).
Tailwind v4 eliminates `tailwind.config.js` — configuration is done via `@theme` blocks in CSS.
Do not use Tailwind v3 patterns (config file, `tailwind.config.js`, `@apply` with JIT, separate config object).

### Express 5

Express 5 (the mandated version) automatically catches rejected promises from async route handlers and passes them to error middleware.
No `asyncHandler` wrapper is needed.
Several Express 4 APIs have been removed.
Do not copy Express 4 scaffold patterns from older tutorials.

### Pino Logging

`pino-pretty` must be installed as a `devDependency` and loaded conditionally:
```ts
transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined
```

Biome's `noConsole` rule is set to `"error"` globally — `console.log` is a lint error.
Use Pino from the first line of backend code, even in the minimal scaffold.

### Runtime Environment

The agent runtime has PostgreSQL at `postgres:5432` (hostname `postgres`, not `localhost`).
`DATABASE_URL` is pre-set in the environment.
Human developer machines use `localhost:5432` (via docker-compose).
The `.env` and `.env.example` files handle both cases — never hardcode connection strings.

### Health Check

Per L2-002 Section 5.4, `/health` is the sole endpoint exempt from authentication.
It must be mounted before auth middleware.
Response should be JSON `{"status": "ok"}` for consistency with API conventions.

### Vite Environment Variables

Only env vars prefixed with `VITE_` are exposed to client-side code by Vite.
Backend secrets (`DATABASE_URL`, `CLERK_SECRET_KEY`, etc.) must never use the `VITE_` prefix.
