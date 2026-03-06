# CI/CD Report: feat-001 — Project Infrastructure and Monorepo Setup

Generated: 2026-03-06

---

## Summary

The CI workflow at `.github/workflows/ci.yml` has been updated to support the feat-001
monorepo structure. The previous single-job workflow has been replaced with three parallel/sequential
jobs that match the feat-001 scope: no PostgreSQL service, no Playwright E2E.

---

## Existing CI State (before this update)

The pre-existing `ci.yml` was a single job (`ci`) that ran lint, format check, typecheck,
and test sequentially on `ubuntu-latest` with Node 22. It had no `permissions` block,
no build step, no artifact upload, and no job separation.

---

## Changes Made

### `.github/workflows/ci.yml` — rewritten

**Before:** One monolithic `ci` job.

**After:** Three jobs:

| Job | Runs after | Purpose |
|-----|------------|---------|
| `lint-and-typecheck` | — (runs immediately) | `npm run lint`, `npm run format`, `npm run typecheck` |
| `unit-tests` | — (runs immediately, in parallel with lint-and-typecheck) | `npm test` across both workspaces; uploads coverage as artifact |
| `build` | `lint-and-typecheck` + `unit-tests` must pass | `npm run build`; uploads `packages/frontend/dist/` as artifact |

**Key decisions:**

- `PORT: 3001` set in `unit-tests` env — matches backend default and feat-001 spec.
- `NODE_ENV: test` set in `unit-tests` env — suppresses pino-pretty, uses production-like logger.
- Coverage artifacts uploaded with `if: always()` — captured even if tests fail, aiding diagnosis.
- `retention-days: 7` on all artifacts — avoids permanent storage per agent rules.
- `permissions: id-token: write, contents: read` added — required for OIDC and standard for all workflows.
- `format check` step (`npm run format`) retained from original — Biome format check is part of quality gate.
- No PostgreSQL service — feat-001 has no DB tests (health endpoint uses no DB).
- No Playwright / E2E job — feat-001 has no E2E tests.

---

## Script Verification

Root `package.json` scripts confirmed callable by CI:

| CI call | Root script | Delegates to |
|---------|------------|-------------|
| `npm run lint` | `biome check . && markdownlint-cli2 '**/*.md'` | Biome + markdownlint across all packages |
| `npm run format` | `biome format .` | Biome format check |
| `npm run typecheck` | `npm run typecheck --workspace=packages/backend && npm run typecheck --workspace=packages/frontend` | Both workspace `tsc --noEmit` |
| `npm test` | `npm run test --workspace=packages/backend && npm run test --workspace=packages/frontend` | `vitest run` in each workspace |
| `npm run build` | `npm run build --workspace=packages/backend && npm run build --workspace=packages/frontend` | `tsc` (backend) + `vite build` (frontend) |

All scripts are present and correctly delegate to workspace packages.

---

## GitHub Secrets Required

**For feat-001: none.**

No external services are called in this feature. No Clerk, no Stripe, no AWS, no database.
The backend test (`GET /health`) uses only the in-process Express app via Supertest — no live port.

Future secrets (for feat-002+, when DB and auth are introduced):

| Secret | Environment | When needed |
|--------|-------------|-------------|
| `DATABASE_URL_MAIN` | main | When PostgreSQL service is added to CI (feat-002+) |
| `AWS_ROLE_ARN_MAIN` | main | When deploy workflow is added |
| `CLERK_SECRET_KEY` | both | When Clerk auth is integrated |

---

## Branch Protection Recommendations

Required status checks before merge to `main`:

- `lint-and-typecheck`
- `unit-tests`
- `build`

Settings:
- Require status checks to pass before merging: yes
- Require branches to be up to date before merging: yes
- Require pull request reviews: no (agents auto-merge)
- Allow force pushes: no
- Allow deletions: no

---

## What Is NOT Configured Yet (intentionally deferred)

These are out of scope for feat-001 and will be added in later features:

- PostgreSQL service container (needed when DB-touching tests are added in feat-002+)
- dbmate migration step (needed with PostgreSQL)
- Playwright E2E job (no browser tests in feat-001)
- Security audit job (npm audit — can be added once external deps grow)
- `deploy-main.yml` workflow (infrastructure not provisioned yet)
- Coverage threshold enforcement script (`scripts/check-coverage.js`) — deferred until
  domain coverage targets apply (feat-002+ domain layer)

---

## YAML Validity

The workflow file uses standard GitHub Actions syntax. Verified:
- Triggers: `push` and `pull_request` on `main`
- All action references pinned to `@v4`
- No syntax errors (valid YAML structure, correct indentation, no duplicate keys)
- `needs` array correctly references job IDs defined in the same file
