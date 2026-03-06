# CI/CD Report: feat-003 — Authentication Integration

## Verdict: FAIL

## Summary

The build and tests pass cleanly, and all required environment variables for feat-003 are documented in `.env.example`. However, `npm run lint` fails with 3 errors (2 lint rule violations in new auth middleware code and 1 formatter error in `index.css`), which blocks the CI pipeline at the `lint-and-typecheck` job. The branch is also 3 commits ahead of its remote tracking branch and has untracked report files.

## Checks

| Check | Status | Notes |
|-------|--------|-------|
| npm test | PASS | 65 tests passing (35 backend, 30 frontend) |
| npm run build | PASS | Clean build; frontend bundle 432 kB |
| npm run typecheck | PASS | No type errors |
| npm run lint | FAIL | 3 errors, 3 warnings — details below |
| Environment vars documented | PASS | `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_PUBLISHABLE_KEY`, `MOCK_AUTH`, `VITE_API_URL` all present in `.env.example` |
| No secrets committed | PASS | `.env` is gitignored (`.gitignore` line 9) and not tracked by git |
| Branch clean | FAIL | 3 commits unpushed to remote; 3 untracked report files in `.claude/reports/` |

## CI Pipeline Structure

The pipeline at `.github/workflows/ci.yml` has three jobs:

1. `lint-and-typecheck` — runs `npm run lint`, `npm run format`, `npm run typecheck`
2. `unit-tests` — runs `npm test` with `NODE_ENV=test`
3. `build` — runs `npm run build`, gated on both prior jobs passing

The `unit-tests` job does **not** inject Clerk environment variables (`CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`). This is acceptable because tests use the `MOCK_AUTH=true` path, which does not require live Clerk credentials. No change needed here.

## Issues

### Issue 1 (BLOCKING): Lint errors in `packages/backend/src/shared/middleware/auth.ts`

Three `lint/complexity/useLiteralKeys` violations — computed string property access where dot notation suffices:

- Line 40: `req.headers['authorization']` → `req.headers.authorization`
- Line 70: `claims['email']` (typeof check) → `claims.email`
- Line 71: `claims['email']` (assignment) → `claims.email`

**Fix:** Run `npx biome check --write packages/backend/src/shared/middleware/auth.ts` or apply the dot-notation replacements manually.

### Issue 2 (BLOCKING): Lint error in `packages/frontend/src/hooks/use-api-client.test.ts`

- Line 47: `headers['Authorization']` → `headers.Authorization` (`lint/complexity/useLiteralKeys`)

**Fix:** Run `npx biome check --write packages/frontend/src/hooks/use-api-client.test.ts`.

### Issue 3 (BLOCKING): Formatter error in `packages/frontend/src/index.css`

Biome formatter expects single-quoted font family names changed to double-quotes, trailing zeros removed from opacity values (e.g. `0.20` → `0.2`), and CSS selector lists expanded to one-per-line.

**Fix:** Run `npm run lint:fix` (or `npm run format:fix`) to apply all auto-fixes. Note the `!important` usages flagged as warnings in `prefers-reduced-motion` media query — these are intentional accessibility overrides and may be suppressed with a Biome ignore comment if desired.

### Issue 4 (NON-BLOCKING): Branch not pushed to remote

The branch is 3 commits ahead of `origin/ralph/feat-003-authentication`. The CI pipeline only runs on `push` to `main` or `pull_request` targeting `main`; the unpushed commits will not be checked by CI until pushed.

**Fix:** `git push` to publish commits and trigger CI.

### Issue 5 (NON-BLOCKING): Untracked report files

`.claude/reports/feat-003-audit.md`, `feat-003-exploratory.md`, and `feat-003-security.md` are untracked. These are not committed and pose no risk, but should be staged/committed or added to `.gitignore` if they are not intended for the repo.
