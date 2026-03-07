# Established Code Patterns

> Patterns confirmed across the codebase that agents should reuse. Agents: add new entries as patterns emerge during implementation.

## Domain Patterns

- **DomainError extension:** All domain errors extend the abstract `DomainError` base class (`packages/backend/src/shared/domain/errors/DomainError.ts`) with a `readonly code: string` property. Example: `class MyError extends DomainError { readonly code = 'MY_ERROR'; }`.
- **pg pool singleton:** A single `Pool` instance is exported from `packages/backend/src/shared/adapters/db/pool.ts`. It reads `process.env.DATABASE_URL` and throws at startup if absent. Import the pool wherever DB access is needed — never create a second pool.

## API Patterns

- **Router factory with DI:** Routers are created via `createXxxRouter(deps)` factory functions that accept injected dependencies (authAdapter, repos, services). This enables supertest testing without touching real infrastructure.
- **Error response format:** `{ error: { code: string, message: string, correlation_id: string } }`. Domain errors map to HTTP statuses via a lookup table in the router. Unhandled errors return 500 with code `INTERNAL_SERVER_ERROR`.
- **Auth selection pattern:** `server.ts` selects `MockAuthAdapter` when `MOCK_AUTH=true`, else `ClerkAuthAdapter`. Both implement `AuthPort`. The global middleware populates auth context; `requireAuthMiddleware` is applied only to the `/v1` router group.
- **Protected route group:** `v1Router.use(authAdapter.requireAuthMiddleware())` applied to the express sub-router, then `app.use('/v1', v1Router)`. Health check mounted on `app` before the v1 group.
- **Correlation IDs:** Extracted from `x-correlation-id` header or generated via `crypto.randomUUID()` per request. Included in all error responses.
- **User serialization:** `serializeUser(user)` helper in the router omits `clerkId` — `clerk_id` never appears in API responses.
- **Result type:** `Result<T>` in `packages/backend/src/shared/domain/Result.ts` — `.isSuccess`, `.isFailure`, `.value`, `.error`. Used by domain factory methods to avoid throwing.

## Domain Patterns (continued)

- **Result type pattern:** Domain factory methods (`User.create()`) return `Result<T>` — never throw. Callers check `.isFailure` and throw `.error` at the application service boundary if needed.
- **Entity factory duality:** `Entity.create(props)` validates inputs and returns `Result<Entity>`. `Entity.reconstitute(props)` skips validation — used only for DB hydration in repository adapters.
- **Mock repository in tests:** Build a plain object implementing the port interface with `vi.fn()` mocks. Override individual methods per test case. No class needed.

## Testing Patterns

- **Backend Vitest config:** `vitest.config.ts` uses `environment: 'node'`, `globals: true`, includes `src/**/*.test.ts`. Coverage excludes `src/server.ts` and test files themselves.
- **CommonJS backend with tsx dev runner:** Backend uses `"module": "CommonJS"` + `"moduleResolution": "node10"` in tsconfig for `tsc` builds. `tsx watch src/server.ts` is used in dev — tsx handles both module systems seamlessly in dev mode.
- **Tailwind CSS v4 import syntax:** Use `@import "tailwindcss"` in the CSS entry file (not `@tailwind base/components/utilities`). The `@tailwindcss/vite` plugin processes it — no `tailwind.config.*` file needed.
- **Frontend Vitest config:** `vitest.config.ts` uses `environment: 'jsdom'`, `globals: true`, `setupFiles: ['./src/test/setup.ts']`, includes `src/**/*.test.tsx` and `src/**/*.test.ts`. Setup file imports `@testing-library/jest-dom`. Pool set to `threads` with `singleThread: true, isolate: false` to prevent OOM when loading heavy deps (Clerk/react-router) in separate workers.
- **Clerk appearance config:** `packages/frontend/src/lib/clerkAppearance.ts` exports `clerkAppearance: Appearance`. Uses raw hex values (not CSS custom properties) because Clerk's appearance prop injects inline styles. Both `SignIn` and `SignUp` share this config. Import from `@clerk/types` for the type.
- **API client factory:** `packages/frontend/src/api/client.ts` exports `createApiClient(getToken)` returning `{ get, patch, post }`. Takes a `getToken: () => Promise<string | null>` function from Clerk's `useAuth`. Throws `ApiError` with status, code, and message on non-2xx responses.
- **CSS design tokens:** Two-tier token architecture in `packages/frontend/src/styles/tokens.css`. Tier 1 identity tokens (raw values) and Tier 2 semantic tokens (component consumption). Component code consumes only Tier 2 tokens. Imported via `global.css` which is the CSS entry point in `main.tsx`.
- **Frontend tsconfig composite pattern:** Root `tsconfig.json` has `"files": []` and project references to `tsconfig.app.json` (src files, `jsx: react-jsx`, `noEmit: true`, `composite: true`) and `tsconfig.node.json` (vite/vitest configs). Use `tsc -b --noEmit` for typecheck.
- **Semantic elements over ARIA roles:** Biome's `useSemanticElements` rule requires using native semantic HTML elements instead of ARIA roles on generic elements. Use `<output>` (which has `role="status"` natively) instead of `<div role="status">`.
