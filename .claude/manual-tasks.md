# Manual Tasks

> Tasks that require human action — cannot be automated by agents.

## Pending

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
