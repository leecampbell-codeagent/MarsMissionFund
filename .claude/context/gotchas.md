# Gotchas

> Known pitfalls discovered during implementation. Updated by agents when they encounter issues.

## Tailwind CSS v4 Breaking Changes

- Tailwind v4 uses CSS-first configuration --- no `tailwind.config.js` file.
- Use `@tailwindcss/vite` plugin, not the PostCSS plugin.
- CSS entry uses `@import "tailwindcss"` instead of `@tailwind base/components/utilities` directives.
- Template file discovery is automatic (no `content` array needed).

## Express 5 Changes from v4

- Express 5 auto-catches rejected promises in async route handlers (no `express-async-errors` needed).
- `app.del()` removed --- use `app.delete()`.
- `req.host` now returns the full host (including port).
- Path matching behaviour changed (stricter regex).
- `@types/express` v5 types may lag behind runtime features.

## Vite Dev Server in Docker

- Must set `server.host: true` in `vite.config.ts` for the dev server to be accessible from outside the container.
- Proxy targets must use Docker service names (e.g., `http://backend:3001`), not `localhost`.
- HMR WebSocket may need `server.hmr.clientPort` configured to match the exposed Docker port.

## node_modules in Docker

- Never share `node_modules` between host and container via bind mount when native modules are involved.
- Use an anonymous volume (`- /app/node_modules`) in `docker-compose.yml` to isolate container deps.
- Running `npm install` on macOS/Windows and then mounting into a Linux container will crash on native modules.

## dbmate in Docker Compose

- Always use `--wait` flag to handle PostgreSQL startup timing.
- `DATABASE_URL` must include `?sslmode=disable` for local development.
- Passwords with special characters must be URL-encoded in the connection string.

## Vitest 3.2+ Workspace Deprecation

- The `vitest.workspace` file is deprecated in Vitest 3.2+.
- Use `projects` option in root `vitest.config.ts` instead.
- Per-package configs can use `extends` to inherit shared settings.

## PostgreSQL Migration Gotchas

- PostgreSQL supports transactional DDL — wrap migrations in `BEGIN; ... COMMIT;` for atomicity.
- Rollback order must reverse creation order (drop dependent tables first, then parent tables).
- `gen_random_uuid()` is built-in since PostgreSQL 13 — do NOT create the `uuid-ossp` extension.
- ENUM types are awkward to modify in migrations (`ALTER TYPE ... ADD VALUE` cannot run inside a transaction in older PG versions). Use `TEXT` with `CHECK` constraints instead.
- `TEXT[]` array type does not validate array contents at the DB level. Use application-layer validation for role values, or a custom CHECK with `array_position`.
- CHECK constraints validate individual values but cannot enforce state machine transitions (e.g., `draft` -> `live` skipping `submitted`). Transition logic lives in the domain layer.
- Composite PK `(aggregate_id, sequence_number)` on events table means `event_id` needs a separate UNIQUE constraint if global uniqueness is required.
- Append-only tables should have a BEFORE UPDATE/DELETE trigger that raises an exception as defence in depth.
- `BIGINT` max value is ~9.2 quintillion cents — overflow is not a practical concern but validate business-meaningful bounds at the application layer.
- JSONB payloads have no size constraint at the DB level — enforce max payload size at the application layer.

## Clerk SDK Gotchas

- `requireAuth()` from `@clerk/express` **redirects** unauthenticated users (HTTP 302).
Do NOT use it for JSON API endpoints — use `clerkMiddleware()` + `getAuth(req)` + manual 401 response.
- `clerkMiddleware()` does NOT block unauthenticated requests.
It silently attaches a "signed-out" auth object (with `userId: null`).
You must explicitly check `userId` in your own middleware.
- Clerk's `getAuth(req)` requires `clerkMiddleware()` to have run first.
If called without it, it will return undefined or throw.
- For Vite/React, the env var must be `VITE_CLERK_PUBLISHABLE_KEY` (with `VITE_` prefix).
Without the prefix, Vite will not expose it to client code.
- `@clerk/clerk-react` and `@clerk/react-router` are separate packages.
If using React Router, evaluate whether `@clerk/react-router` gives better integration (router-aware `ClerkProvider`).
- Clerk webhooks require a publicly accessible URL.
For local dev, use ngrok or skip webhooks entirely and rely on JIT account creation.
- Webhook payloads use at-least-once delivery (Svix).
Always use `INSERT ... ON CONFLICT` or upsert patterns in webhook handlers.
- CORS: When frontend and backend run on different ports, the backend must allow `Authorization` in `Access-Control-Allow-Headers` for Bearer token requests to work.

## npm Workspaces Hoisting

- npm hoists the most common version of a shared dependency to the root.
- Differing versions across packages get nested `node_modules`, which can cause type mismatches.
- Pin shared dependencies to the same version across all workspaces.
