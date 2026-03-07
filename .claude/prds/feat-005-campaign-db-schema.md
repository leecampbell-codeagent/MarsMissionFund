## feat-005: Campaign and Donor Database Schema

**Bounded Context(s):** Campaign, Donor, Payments
**Priority:** P0
**Dependencies:** feat-001
**Estimated Complexity:** M

### Summary

Create all database migrations for the campaign lifecycle, contribution/escrow ledger, and KYC status tables. This is the data foundation that all campaign, donor, and payment features depend on. Migrations follow dbmate format with `-- migrate:up` and `-- migrate:down`, append-only, in `db/migrations/`.

### Acceptance Criteria

- [ ] Migration: `campaigns` table with columns: `id` (UUID PK), `creator_id` (UUID FK → users), `title` (VARCHAR), `summary` (VARCHAR 280), `description` (TEXT), `mars_alignment` (TEXT), `category` (VARCHAR), `tags` (TEXT[]), `status` (VARCHAR default `draft`), `min_funding_target` (BIGINT), `max_funding_cap` (BIGINT), `deadline` (TIMESTAMPTZ nullable), `hero_image_url` (VARCHAR nullable), `created_at` (TIMESTAMPTZ), `updated_at` (TIMESTAMPTZ). Indexes on `status`, `creator_id`, `deadline`.
- [ ] Migration: `campaign_milestones` table: `id` (UUID PK), `campaign_id` (UUID FK → campaigns ON DELETE CASCADE), `title` (VARCHAR), `description` (TEXT), `target_date` (TIMESTAMPTZ), `funding_percentage` (INTEGER — must sum to 100 per campaign, enforced at application layer), `verification_criteria` (TEXT), `status` (VARCHAR default `pending`), `order` (INTEGER), `created_at`, `updated_at`. Index on `campaign_id`.
- [ ] Migration: `campaign_team_members` table: `id` (UUID PK), `campaign_id` (UUID FK → campaigns ON DELETE CASCADE), `name` (VARCHAR), `role` (VARCHAR), `bio` (TEXT), `created_at`, `updated_at`. Index on `campaign_id`.
- [ ] Migration: `campaign_risk_disclosures` table: `id` (UUID PK), `campaign_id` (UUID FK → campaigns ON DELETE CASCADE), `risk_description` (TEXT), `mitigation` (TEXT), `created_at`, `updated_at`. Index on `campaign_id`.
- [ ] Migration: `campaign_audit_log` table: `id` (UUID PK), `campaign_id` (UUID FK → campaigns), `actor_id` (UUID FK → users), `action` (VARCHAR), `previous_state` (VARCHAR nullable), `new_state` (VARCHAR nullable), `rationale` (TEXT nullable), `created_at` (TIMESTAMPTZ). Index on `campaign_id`, `created_at`.
- [ ] Migration: `contributions` table: `id` (UUID PK), `campaign_id` (UUID FK → campaigns), `donor_id` (UUID FK → users), `amount_cents` (BIGINT), `currency` (VARCHAR default `USD`), `status` (VARCHAR default `pending_capture`), `stripe_payment_intent_id` (VARCHAR nullable, unique), `created_at`, `updated_at`. Indexes on `campaign_id`, `donor_id`, `status`.
- [ ] Migration: `escrow_ledger` table: `id` (UUID PK), `campaign_id` (UUID FK → campaigns, unique), `balance_cents` (BIGINT default 0), `total_contributed_cents` (BIGINT default 0), `total_disbursed_cents` (BIGINT default 0), `total_refunded_cents` (BIGINT default 0), `created_at`, `updated_at`. Index on `campaign_id`.
- [ ] Migration: `escrow_entries` table: `id` (UUID PK), `campaign_id` (UUID FK → campaigns), `contribution_id` (UUID FK → contributions nullable), `entry_type` (VARCHAR — `contribution`, `disbursement`, `refund`, `interest`), `amount_cents` (BIGINT), `description` (VARCHAR), `created_at` (TIMESTAMPTZ). Index on `campaign_id`, `created_at`. Append-only (no `updated_at`).
- [ ] Migration: `kyc_verifications` table: `id` (UUID PK), `user_id` (UUID FK → users, unique), `status` (VARCHAR default `not_verified`), `submitted_at` (TIMESTAMPTZ nullable), `verified_at` (TIMESTAMPTZ nullable), `rejection_reason` (TEXT nullable), `provider_reference` (VARCHAR nullable), `created_at`, `updated_at`. Index on `user_id`, `status`.
- [ ] All monetary columns use `BIGINT` (integer cents) — no `FLOAT`, `DECIMAL`, or `NUMERIC` for money.
- [ ] All timestamp columns use `TIMESTAMPTZ` — no bare `TIMESTAMP`.
- [ ] Every FK column has an index.
- [ ] Every table has `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` and `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` (except append-only tables like `escrow_entries` and `campaign_audit_log`).
- [ ] The existing `updated_at` trigger from the initial migration is applied to all tables with `updated_at`.
- [ ] `dbmate up` runs all migrations without errors against a clean database.
- [ ] `dbmate down` reverses all migrations cleanly.
- [ ] CHECK constraints are present for: `amount_cents > 0` on contributions and escrow entries, `min_funding_target >= 100000000` (≥ $1M in cents), `max_funding_cap >= min_funding_target`.

### User Story

As a developer, I want a complete and correct database schema so that I can implement campaign, payment, and KYC domain logic without schema changes blocking progress.

### Key Decisions / Open Questions

- All monetary amounts stored as BIGINT integer cents per backend rules.
- The escrow ledger is a logical double-entry structure, not a separate bank account, in the local demo.
- `campaign_audit_log` is append-only; no `updated_at` column.

### Out of Scope

- Full-text search indexes (added when search feature is built in feat-009).
- KYC document storage table (theatre for local demo — Veriff is stubbed).
- Disbursement approval table (added in feat-012 milestone disbursement feature).
