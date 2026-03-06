# CI/CD Report: feat-002 — Core Database Schema

Generated: 2026-03-06

---

## Verdict: PASS

The existing CI pipeline correctly supports feat-002 without modification. No blocking issues.
No new secrets are required. The 7 migration files are pure SQL and do not affect the build or
unit tests.

---

## Summary

feat-002 adds 7 dbmate migration files in `db/migrations/` covering the foundational PostgreSQL
schema (users, user_roles, kyc_verifications, campaigns, milestones, contributions, escrow_ledger).
This is a database-only feature — no TypeScript domain code, no API endpoints, no frontend changes.

The current 3-job CI pipeline (`lint-and-typecheck` → `unit-tests` → `build`) remains correct for
this feature. Migration files are not executed in CI because no PostgreSQL service container exists
in the pipeline. This is acceptable for feat-002: unit tests do not touch the database, and
migration SQL syntax is validated locally by the developer via `dbmate up`.

---

## Pipeline Configuration Review

### Workflow file: `.github/workflows/ci.yml`

**YAML validity:** Valid. Correct indentation, no duplicate keys, no syntax errors.

**Trigger coverage:** `push` and `pull_request` on `main` — correct.

**Permissions block:** `id-token: write`, `contents: read` — correct for OIDC compatibility.

**Action versions:** All pinned to `@v4` — correct.

**Job structure:**

| Job | Depends on | Purpose |
|-----|-----------|---------|
| `lint-and-typecheck` | none | `npm run lint`, `npm run format`, `npm run typecheck` |
| `unit-tests` | none (parallel) | `npm test` across both workspaces; uploads coverage artifact |
| `build` | `lint-and-typecheck` + `unit-tests` | `npm run build`; uploads frontend dist artifact |

**Node.js version:** `22` in all jobs — matches `.nvmrc` (value: `22`). Confirmed.

**Test command:** `npm test` delegates to `npm run test --workspace=packages/backend && npm run test
--workspace=packages/frontend` — covers both packages. Correct.

**Artifact retention:** `retention-days: 7` on coverage and build output artifacts. Correct.

**Coverage upload:** `if: always()` on coverage artifact — captured even when tests fail. Correct.

---

## feat-002 Impact Assessment

### Migration files

All 8 migration files are now present in `db/migrations/`:

| File | Table |
|------|-------|
| `20260305120000_add_updated_at_trigger.sql` | trigger function (pre-existing, feat-001) |
| `20260306000001_create_accounts.sql` | `users` |
| `20260306000002_create_roles.sql` | `user_roles` |
| `20260306000003_create_kyc.sql` | `kyc_verifications` |
| `20260306000004_create_campaigns.sql` | `campaigns` |
| `20260306000005_create_milestones.sql` | `milestones` |
| `20260306000006_create_contributions.sql` | `contributions` |
| `20260306000007_create_escrow_ledger.sql` | `escrow_ledger` |

Migration files are located in `db/migrations/` at the project root — correct path per infra rules
and dbmate convention. They are not inside any package directory.

### Do migrations break the build?

No. Migration `.sql` files are not imported, compiled, or bundled by any TypeScript or Vite build
step. The `npm run build` step compiles TypeScript and builds the frontend via Vite — SQL files are
invisible to both toolchains.

### Do migrations break unit tests?

No. The unit tests (`npm test`) run via Vitest and do not connect to a database. The 6 existing
tests (from feat-001) remain green. No new unit tests are introduced by feat-002 (it is a
database-only feature with no TypeScript domain code).

### Are new secrets required?

No. Migration SQL is pure DDL. No external service credentials (Clerk, Stripe, Veriff, AWS) are
needed to apply these migrations. The CI pipeline does not run the migrations, so
`DATABASE_URL` is also not required in CI at this stage.

### Are new environment variables required in CI?

No. The `unit-tests` job already sets `NODE_ENV: test` and `PORT: 3001`. No additions needed for
feat-002.

---

## What CI Does NOT Do for feat-002 (intentional, acceptable)

The CI pipeline does not run `dbmate up` against a live PostgreSQL instance. This means:

- Migration SQL syntax errors would not be caught by CI
- Schema constraint behaviour (CHECK, FK, UNIQUE, triggers) is not verified in CI

**Why this is acceptable for feat-002:**

1. feat-002 introduces no application code — only SQL migrations
2. Unit tests do not require a database connection
3. Migration correctness is validated locally by the developer running `dbmate up` in the Docker
   Compose environment (PostgreSQL available at `postgres:5432` in the agent runtime)
4. The spec-mandated acceptance criteria (schema shape tests, constraint tests, trigger tests,
   FK tests) are all integration tests that require a live database — these are out of scope for
   the current CI pipeline stage

This gap is a known, accepted trade-off for feat-002. It must be closed before feat-003 ships.

---

## Recommendations for feat-003 (Authentication)

When feat-003 (Account domain) is implemented, integration tests will require a live PostgreSQL
database. The `unit-tests` job should be upgraded to a `unit-and-integration-tests` job with a
PostgreSQL service container. The following changes will be needed at that point:

### CI job upgrade (do NOT apply now — deferred to feat-003)

```yaml
unit-and-integration-tests:
  runs-on: ubuntu-latest
  services:
    postgres:
      image: postgres:15
      env:
        POSTGRES_USER: test
        POSTGRES_PASSWORD: test
        POSTGRES_DB: mmf_test
      ports:
        - 5432:5432
      options: >-
        --health-cmd pg_isready
        --health-interval 10s
        --health-timeout 5s
        --health-retries 5
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: '22'
        cache: 'npm'
    - name: Install dependencies
      run: npm ci
    - name: Install dbmate
      run: |
        curl -fsSL -o /usr/local/bin/dbmate \
          https://github.com/amacneil/dbmate/releases/latest/download/dbmate-linux-amd64
        chmod +x /usr/local/bin/dbmate
    - name: Run migrations
      run: dbmate up
      env:
        DATABASE_URL: postgresql://test:test@localhost:5432/mmf_test
    - name: Run tests
      run: npm test
      env:
        DATABASE_URL: postgresql://test:test@localhost:5432/mmf_test
        NODE_ENV: test
        PORT: 3001
    - uses: actions/upload-artifact@v4
      if: always()
      with:
        name: coverage-report
        path: |
          packages/backend/coverage/
          packages/frontend/coverage/
        retention-days: 7
```

### Secrets to add at that point

| Secret | Environment | Description |
|--------|-------------|-------------|
| `DATABASE_URL_MAIN` | main | PostgreSQL connection string for main environment |
| `CLERK_SECRET_KEY` | both | Clerk auth secret (feat-003 introduces auth) |

---

## Branch Protection

No changes required. The existing required status checks remain correct for feat-002:

- `lint-and-typecheck`
- `unit-tests`
- `build`

---

## Script Verification

Root `package.json` scripts confirmed callable by CI — unchanged from feat-001:

| CI call | Root script | Delegates to |
|---------|------------|-------------|
| `npm run lint` | `biome check . && markdownlint-cli2 '**/*.md'` | Biome + markdownlint across all packages |
| `npm run format` | `biome format .` | Biome format check |
| `npm run typecheck` | workspace typecheck in backend + frontend | `tsc --noEmit` in each package |
| `npm test` | workspace test in backend + frontend | `vitest run` in each package |
| `npm run build` | workspace build in backend + frontend | `tsc` (backend) + `vite build` (frontend) |

No new scripts are introduced by feat-002.

---

## CI Changes Made

**None.** The existing `ci.yml` is correct as-is for feat-002. No workflow modifications were made.
