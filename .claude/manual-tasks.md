# Manual Tasks

> Tasks that require human action — cannot be automated by agents.

## Pending

### MANUAL-003: Merge PR for feat-001
**Feature:** feat-001
**Branch:** `ralph/feat-001-monorepo-scaffold` → `main`
**Action:** The agent token lacks `createPullRequest` permission. Create and merge the PR manually:
```bash
gh pr create --head ralph/feat-001-monorepo-scaffold --base main \
  --title "feat-001: Monorepo Scaffold — Backend and Frontend Packages" \
  --body "Monorepo scaffold: Express backend, React frontend, hex arch, CSS token system. All quality gates pass."
```
Or use the GitHub UI to open a PR from `ralph/feat-001-monorepo-scaffold` → `main`.

### MANUAL-001: Configure environment variables
**Feature:** feat-001
**Action:** Copy `.env.example` to `.env` and fill in the following values:
- `DATABASE_URL` — PostgreSQL connection string (default: `postgresql://mmf:mmf@localhost:5432/mmf_dev?sslmode=disable`)
- `CLERK_SECRET_KEY` — Clerk dashboard > API Keys
- `CLERK_PUBLISHABLE_KEY` — Clerk dashboard > API Keys
- `VITE_CLERK_PUBLISHABLE_KEY` — Clerk dashboard > API Keys
- `POSTHOG_API_KEY` — PostHog project settings > Project API Key
- All mock adapter flags default to `true` for local dev — no action needed

### MANUAL-002: Start PostgreSQL
**Feature:** feat-001
**Action:** Start the PostgreSQL container: `docker-compose up -d postgres`
Then run migrations: `docker-compose run --rm migrate`
Or run migrations directly: `dbmate --url "$DATABASE_URL" up`
