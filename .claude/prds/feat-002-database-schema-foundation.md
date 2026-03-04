## feat-002: Database Schema Foundation

**Bounded Context(s):** Cross-cutting (Account, Campaign, Payments)
**Priority:** P0
**Dependencies:** feat-001
**Estimated Complexity:** M

### Summary

Create the foundational database migrations for the core tables across all bounded contexts: accounts, campaigns, contributions, escrow ledger, KYC records, and the event store. Establishes the CQRS event store table, audit event schema, and the `updated_at` trigger pattern used by all tables.

### Acceptance Criteria

- [ ] Migration `YYYYMMDDHHMMSS_create_event_store.sql` creates the `events` table with columns: `event_id UUID`, `event_type TEXT`, `aggregate_id UUID`, `aggregate_type TEXT`, `sequence_number BIGINT`, `timestamp TIMESTAMPTZ`, `correlation_id UUID`, `source_service TEXT`, `payload JSONB`, with primary key on `(aggregate_id, sequence_number)`
- [ ] Migration creates `accounts` table: `id UUID PK`, `clerk_user_id TEXT UNIQUE NOT NULL`, `email TEXT UNIQUE NOT NULL`, `display_name TEXT`, `status TEXT NOT NULL DEFAULT 'pending_verification'`, `roles TEXT[] NOT NULL DEFAULT '{backer}'`, `onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE`, `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- [ ] Migration creates `campaigns` table with all required fields from campaign spec: `id UUID PK`, `creator_id UUID FK accounts(id) ON DELETE RESTRICT`, `title TEXT NOT NULL`, `summary VARCHAR(280)`, `description TEXT`, `category TEXT NOT NULL`, `status TEXT NOT NULL DEFAULT 'draft'`, `min_funding_target_cents BIGINT NOT NULL`, `max_funding_cap_cents BIGINT NOT NULL`, `deadline TIMESTAMPTZ`, `created_at`, `updated_at`
- [ ] Migration creates `milestones` table: `id UUID PK`, `campaign_id UUID FK campaigns(id) ON DELETE CASCADE`, `title TEXT`, `description TEXT`, `target_date TIMESTAMPTZ`, `funding_percentage INTEGER`, `verification_criteria TEXT`, `status TEXT NOT NULL DEFAULT 'pending'`, `created_at`, `updated_at`
- [ ] Migration creates `contributions` table: `id UUID PK`, `donor_id UUID FK accounts(id) ON DELETE RESTRICT`, `campaign_id UUID FK campaigns(id) ON DELETE RESTRICT`, `amount_cents BIGINT NOT NULL`, `status TEXT NOT NULL DEFAULT 'pending_capture'`, `gateway_reference TEXT`, `created_at`, `updated_at`
- [ ] Migration creates `escrow_ledger` table: `id UUID PK`, `campaign_id UUID FK campaigns(id) ON DELETE RESTRICT`, `entry_type TEXT NOT NULL`, `amount_cents BIGINT NOT NULL`, `contribution_id UUID`, `disbursement_id UUID`, `description TEXT`, `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` — no `updated_at` (append-only)
- [ ] Migration creates `kyc_verifications` table: `id UUID PK`, `account_id UUID FK accounts(id) ON DELETE RESTRICT`, `status TEXT NOT NULL DEFAULT 'not_verified'`, `document_type TEXT`, `provider_reference TEXT`, `failure_count INTEGER NOT NULL DEFAULT 0`, `verified_at TIMESTAMPTZ`, `expires_at TIMESTAMPTZ`, `created_at`, `updated_at`
- [ ] All monetary columns use `BIGINT` (integer cents), never FLOAT/DOUBLE/NUMERIC
- [ ] All date columns use `TIMESTAMPTZ`, never TIMESTAMP without timezone
- [ ] Every FK column has an index
- [ ] Reusable `updated_at` trigger function created and applied to all tables with `updated_at`
- [ ] CHECK constraints on `status` columns with valid enum values
- [ ] CHECK constraint: `min_funding_target_cents > 0`, `max_funding_cap_cents >= min_funding_target_cents`
- [ ] CHECK constraint: `amount_cents > 0` on contributions
- [ ] All migrations have `-- migrate:up` and `-- migrate:down` sections wrapped in `BEGIN; ... COMMIT;`
- [ ] `dbmate up` runs successfully against a clean database
- [ ] `dbmate down` rolls back all migrations cleanly

### User Story

As a developer, I want the core database schema in place so that all domain features have a stable data layer to build on.

### Key Decisions / Open Questions

- Event store in PostgreSQL (not a separate broker) per architecture spec
- Escrow ledger is append-only by design — no UPDATE/DELETE operations
- Single database with logical separation per service (not separate databases for local demo)

### Out of Scope

- Read model / materialised view creation (those are built per feature as needed)
- Seed data (may be a separate task or part of individual features)
- Notification tables (deferred until notification features are built)
