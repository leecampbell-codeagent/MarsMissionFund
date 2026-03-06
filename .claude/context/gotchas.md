# Gotchas

> Known pitfalls and issues discovered during research and implementation cycles. Updated by all agents.

---

## Infrastructure (feat-001)

### Biome `noConsole: "error"` is global

`biome.json` sets `suspicious.noConsole: "error"` for all non-test files.
Any `console.log` in backend or frontend source code will fail `npm run lint`.
Use Pino for backend logging from the very first file written.
There is no `console` at all in backend code — not even during startup.

### `noUncheckedIndexedAccess` is enabled in base tsconfig

Array element access returns `T | undefined`, not `T`.
Every pattern like `const first = items[0]; first.name` requires a null check first.
This will surprise agents copying examples from external sources.

### `tsconfig.base.json` uses `"moduleResolution": "bundler"`

This is correct for Vite-built frontend code.
It is incorrect for Node.js direct execution (backend via `tsx`).
Backend `tsconfig.json` MUST override: `"moduleResolution": "node16"`.
Failure to override causes subtle ESM import resolution bugs.

### `packages/` does not exist yet

There is no `packages/` directory — it must be created from scratch.
No `packages/backend/` or `packages/frontend/` directories exist.
Do not assume any package scaffold exists before feat-001 is complete.

### `start-dev-stack.sh` requires exact script names

`autonomous/scripts/start-dev-stack.sh` runs `npm run dev` inside each package.
The script name must be exactly `dev` — no variation (`start:dev`, `serve`, etc.) will work.
Same applies to: the frontend `dev` script must start Vite on port `5173`.

### Docker Compose is not available in agent runtime

The agent runs inside a Docker container — there is no Docker daemon.
Do not attempt `docker compose up`, `docker-compose run`, or any Docker commands.
PostgreSQL is already running at `postgres:5432`.
The `docker-compose.yml` file should be created for human developer workflow only, as documented in architecture spec Section 12.2, but the agent must never execute it.

### `.env` points to `postgres:5432`, not `localhost`

The live `.env` uses `DATABASE_URL=postgres://mmf:mmf@postgres:5432/mmf?sslmode=disable`.
The `.env.example` uses `localhost:5432` (for human developer context).
Code must read `DATABASE_URL` from environment — never hardcode connection strings.

### Tailwind v4 has no `tailwind.config.js`

Configuration lives in CSS via `@theme {}` blocks.
Any code that creates or references `tailwind.config.js` or `tailwind.config.ts` is using v3 patterns.
The `@tailwindcss/vite` plugin is used in `vite.config.ts` (not `postcss.config.js` for v4).

### React 19 StrictMode double-invocation

React 19 StrictMode (enabled by default in development) double-invokes `useEffect` cleanup functions.
This is intentional and helps surface bugs.
Effects must be idempotent — network requests, event listener registration, and timers inside effects should account for this.

### `pino-pretty` as devDependency only

`pino-pretty` must be `devDependencies`, not `dependencies`.
If listed as a regular dependency, it ships in production builds unnecessarily.
Load it conditionally: only when `NODE_ENV !== 'production'`.

### Express 5 error handling differs from Express 4

Async route handlers in Express 5 automatically propagate rejected promises to error middleware.
No `asyncHandler` wrapper (`express-async-handler` package) is needed.
Express 4 patterns using `next(err)` manually still work but are redundant for async routes.

### Pre-commit hooks (prek) — empty `$@` causes recursive grep

prek (Rust pre-commit tool) invokes `sh -c 'script' file1 file2` without a dummy `$0` placeholder.
This makes the first filename become `$0`, so `$@` may be empty when only one file is staged.
Empty `$@` causes `grep -rn "pattern" -- "$@"` to scan the entire working directory (including node_modules).
Fix: add `[ "$#" -eq 0 ] && exit 0` guard at the start of every `sh -c` hook script.
Also: use `grep -n` (not `grep -rn`) to avoid recursive directory scanning on unexpected paths.

### gitleaks matches Stripe-format placeholder strings

gitleaks (RuleID: `stripe-access-token`) matches strings beginning with `sk_test_` or `whsec_` — even as placeholders.
Never use realistic-format placeholder strings for Stripe keys in report or doc files.
Instead, use descriptive prose: "non-sensitive placeholder strings (no real credentials)".

### `.pre-commit-config.yaml` is gitignored but prek reads it from disk

The `.pre-commit-config.yaml` file is in `.gitignore` and is NOT tracked by git.
It exists locally (managed outside git) and prek reads it from disk at commit time.
Changes to this file take effect immediately without being committed.

### `gh pr create` fails with personal access token (GraphQL limitation)

`gh pr create` uses the GraphQL API and fails with: "Resource not accessible by personal access token".
Workaround: use `gh api repos/{owner}/{repo}/pulls --method POST` (REST API) — this works with PATs.

### Backend listens on port 3001, not 3000

The backend runs on `PORT=3001` (from `.env`), not the commonly assumed `3000`.
Frontend Vite proxy and health checks must target `http://localhost:3001`.
The `.claude/agents/spec-writer.md` and specs may reference port 3000 — override with 3001.
