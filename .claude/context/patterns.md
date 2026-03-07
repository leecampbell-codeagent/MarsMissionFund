# Established Code Patterns

> Patterns confirmed across the codebase that agents should reuse. Agents: add new entries as patterns emerge during implementation.

## Domain Patterns

- **DomainError extension:** All domain errors extend the abstract `DomainError` base class (`packages/backend/src/shared/domain/errors/DomainError.ts`) with a `readonly code: string` property. Example: `class MyError extends DomainError { readonly code = 'MY_ERROR'; }`.
- **pg pool singleton:** A single `Pool` instance is exported from `packages/backend/src/shared/adapters/db/pool.ts`. It reads `process.env.DATABASE_URL` and throws at startup if absent. Import the pool wherever DB access is needed — never create a second pool.

## API Patterns

<!-- Add patterns here as they are established, e.g.:
- Route wiring and DI conventions
- Error response format
- Zod validation middleware
-->

## Testing Patterns

- **Backend Vitest config:** `vitest.config.ts` uses `environment: 'node'`, `globals: true`, includes `src/**/*.test.ts`. Coverage excludes `src/server.ts` and test files themselves.
- **CommonJS backend with tsx dev runner:** Backend uses `"module": "CommonJS"` + `"moduleResolution": "node10"` in tsconfig for `tsc` builds. `tsx watch src/server.ts` is used in dev — tsx handles both module systems seamlessly in dev mode.
- **Tailwind CSS v4 import syntax:** Use `@import "tailwindcss"` in the CSS entry file (not `@tailwind base/components/utilities`). The `@tailwindcss/vite` plugin processes it — no `tailwind.config.*` file needed.
- **Frontend Vitest config:** `vitest.config.ts` uses `environment: 'jsdom'`, `globals: true`, `setupFiles: ['./src/test/setup.ts']`, includes `src/**/*.test.tsx` and `src/**/*.test.ts`. Setup file imports `@testing-library/jest-dom`.
- **CSS design tokens:** Two-tier token architecture in `packages/frontend/src/styles/tokens.css`. Tier 1 identity tokens (raw values) and Tier 2 semantic tokens (component consumption). Component code consumes only Tier 2 tokens. Imported via `global.css` which is the CSS entry point in `main.tsx`.
- **Frontend tsconfig composite pattern:** Root `tsconfig.json` has `"files": []` and project references to `tsconfig.app.json` (src files, `jsx: react-jsx`, `noEmit: true`, `composite: true`) and `tsconfig.node.json` (vite/vitest configs). Use `tsc -b --noEmit` for typecheck.
- **Semantic elements over ARIA roles:** Biome's `useSemanticElements` rule requires using native semantic HTML elements instead of ARIA roles on generic elements. Use `<output>` (which has `role="status"` natively) instead of `<div role="status">`.
