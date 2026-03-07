# Known Gotchas

> Pitfalls and edge cases discovered during implementation. Agents: add entries here when you hit something unexpected that future agents should know about.

## Backend

- **tsconfig.base.json uses `"moduleResolution": "bundler"`** which is incompatible with Node.js `tsc` output. The backend tsconfig must override to `"module": "CommonJS"` and `"moduleResolution": "node10"`. Never use the base `bundler` resolution for backend production builds.
- **Backend entry file must be named `server.ts`** (not `index.ts`) due to the kill pattern `pkill -f "tsx.*server"` in `autonomous/scripts/start-dev-stack.sh`. Using `index.ts` would cause the dev stack restart script to fail to terminate the backend process.
- **`@vitest/coverage-v8` must be pinned to match vitest major version.** Using `"latest"` resolves to v4 which requires vitest v4, causing an ERESOLVE conflict if vitest is on v3. Pin both to the same major: `"vitest": "^3.0.0"` and `"@vitest/coverage-v8": "^3.0.0"`.

## Frontend

- **Vite version conflict in npm workspaces:** If the root `node_modules` has a different vite version than a package's `node_modules` (e.g., vite 7 at root from hoisting, vite 6 in frontend), TypeScript will report type mismatches for `@tailwindcss/vite` and `@vitejs/plugin-react` plugins in `vite.config.ts`. Fix by aligning the frontend's `vite` version to match the hoisted root version (e.g., `"vite": "^7.0.0"`).
- **`!important` in CSS triggers Biome warnings:** The `noImportantStyles` rule from Biome's recommended ruleset flags all `!important` usage. The `prefers-reduced-motion` safety net overrides in `tokens.css` are intentional and produce warnings (not errors). These are acceptable — do not remove them.

## Infrastructure

<!-- Add gotchas here as they are discovered, e.g.:
- Terraform state locking in CI
- Migration timestamp conflicts between agents
-->
