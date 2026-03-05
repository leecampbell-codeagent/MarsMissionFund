# feat-003 Infrastructure Report

> Campaign Creation, Submission, and Review Pipeline
> Author: Infrastructure Engineer agent
> Date: 2026-03-05

---

## Summary

feat-003 is infrastructure-minimal. It introduces two new database migrations and no new external
service integrations, AWS resources, or environment variables.

---

## Migrations Added

feat-003 requires two new migrations, to be authored by the Backend Engineer:

| Timestamp | File | Description |
|-----------|------|-------------|
| `20260305150000` | `db/migrations/20260305150000_create_campaigns_table.sql` | Creates the `campaigns` table with all columns, CHECK constraints, indexes, and `updated_at` trigger |
| `20260305151000` | `db/migrations/20260305151000_create_campaign_audit_events_table.sql` | Creates the `campaign_audit_events` table with indexes and FK constraints |

### Migration Timestamp Verification

Existing migrations at the time of feat-003:

| Timestamp | File |
|-----------|------|
| `20260305120000` | `add_updated_at_trigger.sql` |
| `20260305130000` | `create_users_table.sql` |
| `20260305140000` | `kyc_rename_failed_to_rejected.sql` |
| `20260305141000` | `create_kyc_audit_events_table.sql` |

The feat-003 timestamps (`20260305150000`, `20260305151000`) are correctly sequenced after
the last existing migration (`20260305141000`) and do not conflict with any existing file.

At the time of this report, neither migration file has been created yet — the Backend Engineer
is responsible for creating them with the SQL from `feat-003-spec-data.md`.

### Key Migration Details

**`campaigns` table:**
- Primary key: `UUID DEFAULT gen_random_uuid()`
- `creator_user_id`: FK to `users(id)` ON DELETE RESTRICT (prevents deletion of users with campaigns)
- `reviewed_by_user_id`: FK to `users(id)` ON DELETE SET NULL
- `status`: CHECK constraint covers 13 lifecycle states (including forward-compat states for future features)
- `category`: CHECK constraint covers 10 fixed Mars-domain categories (nullable — required only at submission)
- Monetary fields (`funding_goal_cents`, `funding_cap_cents`): BIGINT (integer cents, never FLOAT)
- JSONB fields (`milestones`, `team_members`, `risk_disclosures`, `budget_breakdown`): default to `'[]'::JSONB`
- `updated_at` auto-update trigger: `campaigns_updated_at` (calls existing `update_updated_at_column()`)
- 4 indexes: `creator_user_id`, `status`, `submitted_at`, `reviewed_by_user_id`

**`campaign_audit_events` table:**
- Append-only — no `updated_at` column, no UPDATE or DELETE operations
- `campaign_id`: FK to `campaigns(id)` ON DELETE RESTRICT (audit events preserved even if campaign is archived)
- `actor_user_id`: FK to `users(id)` ON DELETE SET NULL (GDPR-safe — NULL if user hard-deleted)
- `actor_clerk_user_id`: TEXT (not UUID — Clerk IDs are prefixed KSUIDs, see gotcha G-001)
- `action`: CHECK constraint covers 9 audit action codes
- 3 indexes: `campaign_id`, `created_at`, `actor_user_id`

---

## Environment Variables

No new environment variables are required for feat-003.

The Campaign bounded context uses:
- **PostgreSQL** — via the existing `pg` pool; connection string already in `DATABASE_URL`
- **Clerk** — JWT auth on all campaign endpoints; already configured via `CLERK_SECRET_KEY` and related vars

`.env.example` requires no changes.

---

## AWS Resources

No new AWS resources are needed for feat-003.

The Campaign feature is entirely PostgreSQL-backed with no third-party service calls, queues,
S3 buckets, Lambda functions, or other AWS resources.

---

## docker-compose.yml

No changes required. The existing `migrate` service configuration already covers feat-003:

```yaml
migrate:
  image: amacneil/dbmate:2
  volumes:
    - ./db:/db   # mounts all of db/migrations/ automatically
  command: up    # runs dbmate up — applies all pending migrations in timestamp order
```

When `docker compose run --rm migrate` is executed after the Backend Engineer creates the two
new migration files, dbmate will automatically detect and apply them in timestamp order.

---

## CI/CD Pipeline

No CI/CD pipeline changes are required for feat-003.

The existing `dbmate up` step in the CI/CD pipeline will automatically pick up and apply the
two new migrations (`20260305150000_create_campaigns_table.sql` and
`20260305151000_create_campaign_audit_events_table.sql`) when they are committed to
`db/migrations/`.

The pipeline requires no new secrets, service accounts, or environment configuration for feat-003.

---

## Mock Adapter Status

feat-003 introduces no new external service integrations. See `.claude/mock-status.md` for
the full service status table, which now includes a Campaign bounded context row confirming
no external dependencies.

---

## Manual Tasks

feat-003 introduces no new manual tasks. The existing three tasks remain:
- Task #1: Clerk Application Setup (feat-001)
- Task #2: Local PostgreSQL Database Setup (feat-001)
- Task #3: Veriff KYC Integration (feat-002, low priority — stub works for demo)

See `.claude/manual-tasks.md` for the complete task list.

---

## Checklist

- [x] Migration timestamps verified — no conflicts with existing migrations
- [x] Migration files not yet created — Backend Engineer to author
- [x] `.env.example` confirmed complete — no new variables needed
- [x] `docker-compose.yml` confirmed sufficient — no changes needed
- [x] `mock-status.md` updated to reflect Campaign bounded context
- [x] `manual-tasks.md` confirmed current — no new manual tasks for feat-003
- [x] No new AWS resources required
- [x] CI/CD pipeline requires no changes
