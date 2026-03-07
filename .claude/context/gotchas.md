# Known Gotchas

> Pitfalls and edge cases discovered during implementation. Agents: add entries here when you hit something unexpected that future agents should know about.

## Backend

- **tsconfig.base.json uses `"moduleResolution": "bundler"`** which is incompatible with Node.js `tsc` output. The backend tsconfig must override to `"module": "CommonJS"` and `"moduleResolution": "node10"`. Never use the base `bundler` resolution for backend production builds.
- **Backend entry file must be named `server.ts`** (not `index.ts`) due to the kill pattern `pkill -f "tsx.*server"` in `autonomous/scripts/start-dev-stack.sh`. Using `index.ts` would cause the dev stack restart script to fail to terminate the backend process.
- **`@vitest/coverage-v8` must be pinned to match vitest major version.** Using `"latest"` resolves to v4 which requires vitest v4, causing an ERESOLVE conflict if vitest is on v3. Pin both to the same major: `"vitest": "^3.0.0"` and `"@vitest/coverage-v8": "^3.0.0"`.

## Frontend

- **Vite version conflict in npm workspaces:** If the root `node_modules` has a different vite version than a package's `node_modules` (e.g., vite 7 at root from hoisting, vite 6 in frontend), TypeScript will report type mismatches for `@tailwindcss/vite` and `@vitejs/plugin-react` plugins in `vite.config.ts`. Fix by aligning the frontend's `vite` version to match the hoisted root version (e.g., `"vite": "^7.0.0"`).
- **`@clerk/react` v5.54.0 is broken:** The only `@clerk/react` v5 release is v5.54.0, which references `loadClerkUiScript` from `@clerk/shared` that doesn't exist in any v3.x. Use `@clerk/react@^6.0.0` instead. npm will install a nested `@clerk/react/node_modules/@clerk/shared@^4.0.0` to satisfy the dependency.
- **Vitest OOM when loading react-router or @clerk/react in isolation:** Running a test file in its own vitest worker that imports `react-router` or the real `@clerk/react` module graph causes JS heap OOM at 4GB in this environment. Fix: (1) use `pool: 'threads'` with `singleThread: true, isolate: false` in vitest config so all tests share one worker/module cache, and (2) in individual test files, mock heavy deps (`react-router`, `@clerk/react`) in the `vi.mock` factory to prevent loading the real modules. Also add explicit `afterEach(cleanup)` when using `isolate: false`.
- **`vite-env.d.ts` is required:** The frontend `tsconfig.app.json` does not include `vite/client` types by default. Without `src/vite-env.d.ts` containing `/// <reference types="vite/client" />`, TypeScript will report `Property 'env' does not exist on type 'ImportMeta'` for `import.meta.env` usage.
- **`!important` in CSS triggers Biome warnings:** The `noImportantStyles` rule from Biome's recommended ruleset flags all `!important` usage. The `prefers-reduced-motion` safety net overrides in `tokens.css` are intentional and produce warnings (not errors). These are acceptable — do not remove them.

- **Express 5 `req.params` types:** In Express 5 with `@types/express` v5, `req.params[key]` is typed as `string | string[] | undefined`. When you need a guaranteed string, cast: `req.params.id as string`. Avoid bracket notation like `req.params['id']` — Biome flags it with `useLiteralKeys`.
- **Biome `noUselessConstructor`:** A constructor that only calls `super(message)` with an identical signature to the parent is flagged as useless and should be removed. TypeScript will inherit the parent constructor automatically. This applies to domain error subclasses that pass a fixed message to `DomainError`.
- **`UserValidationError` has no constructor:** Unlike errors with fixed messages, `UserValidationError` accepts a dynamic message. After removing the useless constructor, callers pass the message directly to the inherited `DomainError(message)` constructor — TypeScript allows this because the parent constructor is public.
- **MockAuthAdapter `getAuthContext` never returns null:** The mock adapter's `getAuthContext` always returns an `AuthContext` (not `null`). Test code that relies on getting a 401 from lack of auth should use real Clerk adapter or test the router's own null-guard code path directly.

## Infrastructure

<!-- Add gotchas here as they are discovered, e.g.:
- Terraform state locking in CI
- Migration timestamp conflicts between agents
-->
