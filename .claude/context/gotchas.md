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

## npm Workspaces Hoisting

- npm hoists the most common version of a shared dependency to the root.
- Differing versions across packages get nested `node_modules`, which can cause type mismatches.
- Pin shared dependencies to the same version across all workspaces.
