# feat-002: Database Schema Foundation --- Implementation Spec

> **Feature ID**: feat-002
> **Type**: Infrastructure / Database
> **Priority**: P0
> **Dependencies**: feat-001 (Monorepo Scaffold & Dev Environment)
> **Status**: Ready for Implementation
> **Date**: 2026-03-04
> **Governing Specs**: L2-002 (Engineering Standard), L3-001 (Architecture), L3-006 (Audit), L3-008 (Tech Stack), L4-001 (Account), L4-002 (Campaign), L4-003 (Donor), L4-004 (Payments), L4-005 (KYC)

---

## 1. User Stories & Acceptance Criteria

### US-001: Reusable `updated_at` Trigger Function

**As a** developer,
**I want** a reusable trigger function that auto-updates the `updated_at` column on row modification,
**so that** every mutable table has consistent timestamp behaviour without manual application logic.

**Acceptance Criteria:**

```gherkin
Given a clean database with no existing functions
When I run `dbmate up` for the trigger function migration
Then a function `update_updated_at_column()` exists in the database
  And it returns TRIGGER type
  And it sets NEW.updated_at to NOW() on every invocation
```

```gherkin
Given the trigger function exists
When I run `dbmate down` for the trigger function migration
Then the function `update_updated_at_column()` is dropped
  And no orphaned triggers remain
```

### US-002: Event Store Table

**As a** developer,
**I want** an append-only `events` table with a composite primary key on `(aggregate_id, sequence_number)`,
**so that** domain events are stored with per-aggregate ordering and the CQRS/Event Sourcing pattern is supported.

**Acceptance Criteria:**

```gherkin
Given a clean database with the trigger function migration applied
When I run `dbmate up` for the event store migration
Then the `events` table exists with columns:
  | Column           | Type         | Constraints                               |
  | event_id         | UUID         | NOT NULL DEFAULT gen_random_uuid()         |
  | event_type       | TEXT         | NOT NULL                                   |
  | aggregate_id     | UUID         | NOT NULL                                   |
  | aggregate_type   | TEXT         | NOT NULL                                   |
  | sequence_number  | BIGINT       | NOT NULL                                   |
  | timestamp        | TIMESTAMPTZ  | NOT NULL DEFAULT NOW()                     |
  | correlation_id   | UUID         | NOT NULL                                   |
  | source_service   | TEXT         | NOT NULL                                   |
  | payload          | JSONB        | NOT NULL DEFAULT '{}'                      |
  And the primary key is (aggregate_id, sequence_number)
  And a UNIQUE constraint exists on event_id
  And indexes exist on event_type, timestamp, and correlation_id
  And no updated_at column exists (append-only table)
  And a BEFORE UPDATE OR DELETE trigger raises an exception to enforce immutability
```

```gherkin
Given two concurrent transactions attempt to insert events with the same aggregate_id and sequence_number
When the second transaction commits
Then it fails with a unique violation error
  And the first transaction's event is preserved
```

```gherkin
Given the events table exists
When I run `dbmate down` for the event store migration
Then the events table is dropped
```

### US-003: Accounts Table

**As a** developer,
**I want** an `accounts` table with Clerk integration, role storage, and status tracking,
**so that** user identity and authorisation data has a stable persistence layer.

**Acceptance Criteria:**

```gherkin
Given the trigger function migration has been applied
When I run `dbmate up` for the accounts migration
Then the `accounts` table exists with columns:
  | Column                | Type         | Constraints                                         |
  | id                    | UUID         | PK DEFAULT gen_random_uuid()                        |
  | clerk_user_id         | TEXT         | UNIQUE NOT NULL                                     |
  | email                 | TEXT         | UNIQUE NOT NULL                                     |
  | display_name          | TEXT         | Nullable                                            |
  | status                | TEXT         | NOT NULL DEFAULT 'pending_verification'             |
  | roles                 | TEXT[]       | NOT NULL DEFAULT '{backer}'                         |
  | onboarding_completed  | BOOLEAN      | NOT NULL DEFAULT FALSE                              |
  | created_at            | TIMESTAMPTZ  | NOT NULL DEFAULT NOW()                              |
  | updated_at            | TIMESTAMPTZ  | NOT NULL DEFAULT NOW()                              |
  And a CHECK constraint validates status IN ('pending_verification', 'active', 'suspended', 'deactivated', 'deleted')
  And an index exists on status
  And the updated_at trigger is applied
```

```gherkin
Given the accounts table exists
When I insert a row without specifying status or roles
Then the row is created with status 'pending_verification' and roles '{backer}'
```

```gherkin
Given the accounts table exists
When I attempt to insert a row with status 'invalid_status'
Then the insert fails with a CHECK constraint violation
```

```gherkin
Given the accounts table exists with data
When I update a row's display_name
Then the updated_at column is automatically set to the current timestamp
```

### US-004: Campaigns Table

**As a** developer,
**I want** a `campaigns` table with funding constraints, category validation, and FK to accounts,
**so that** campaign data is persisted with referential integrity and domain invariants enforced at the database level.

**Acceptance Criteria:**

```gherkin
Given the accounts migration has been applied
When I run `dbmate up` for the campaigns migration
Then the `campaigns` table exists with columns:
  | Column                    | Type         | Constraints                               |
  | id                        | UUID         | PK DEFAULT gen_random_uuid()              |
  | creator_id                | UUID         | FK accounts(id) ON DELETE RESTRICT NOT NULL|
  | title                     | TEXT         | NOT NULL                                  |
  | summary                   | VARCHAR(280) | Nullable                                  |
  | description               | TEXT         | Nullable                                  |
  | category                  | TEXT         | NOT NULL                                  |
  | status                    | TEXT         | NOT NULL DEFAULT 'draft'                  |
  | min_funding_target_cents  | BIGINT       | NOT NULL                                  |
  | max_funding_cap_cents     | BIGINT       | NOT NULL                                  |
  | deadline                  | TIMESTAMPTZ  | Nullable                                  |
  | created_at                | TIMESTAMPTZ  | NOT NULL DEFAULT NOW()                    |
  | updated_at                | TIMESTAMPTZ  | NOT NULL DEFAULT NOW()                    |
  And CHECK constraints enforce:
    - status IN ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'live', 'funded', 'suspended', 'failed', 'settlement', 'complete', 'cancelled')
    - category IN ('propulsion', 'entry_descent_landing', 'power_energy', 'habitats_construction', 'life_support_crew_health', 'food_water_production', 'isru', 'radiation_protection', 'robotics_automation', 'communications_navigation')
    - min_funding_target_cents > 0
    - max_funding_cap_cents >= min_funding_target_cents
  And indexes exist on creator_id, status, category, and deadline
  And the updated_at trigger is applied
```

```gherkin
Given the campaigns table exists
When I attempt to insert a campaign with min_funding_target_cents = 0
Then the insert fails with a CHECK constraint violation
```

```gherkin
Given the campaigns table exists
When I attempt to insert a campaign with max_funding_cap_cents < min_funding_target_cents
Then the insert fails with a CHECK constraint violation
```

```gherkin
Given the campaigns table exists with a campaign row
  And the accounts table has the referenced creator_id
When I attempt to delete the account
Then the delete fails with a foreign key RESTRICT violation
```

### US-005: Milestones Table

**As a** developer,
**I want** a `milestones` table with FK CASCADE to campaigns,
**so that** milestone data is owned by campaigns and automatically cleaned up when campaigns are deleted.

**Acceptance Criteria:**

```gherkin
Given the campaigns migration has been applied
When I run `dbmate up` for the milestones migration
Then the `milestones` table exists with columns:
  | Column                 | Type         | Constraints                                  |
  | id                     | UUID         | PK DEFAULT gen_random_uuid()                 |
  | campaign_id            | UUID         | FK campaigns(id) ON DELETE CASCADE NOT NULL   |
  | title                  | TEXT         | Nullable                                     |
  | description            | TEXT         | Nullable                                     |
  | target_date            | TIMESTAMPTZ  | Nullable                                     |
  | funding_percentage     | INTEGER      | Nullable                                     |
  | verification_criteria  | TEXT         | Nullable                                     |
  | status                 | TEXT         | NOT NULL DEFAULT 'pending'                   |
  | created_at             | TIMESTAMPTZ  | NOT NULL DEFAULT NOW()                       |
  | updated_at             | TIMESTAMPTZ  | NOT NULL DEFAULT NOW()                       |
  And CHECK constraints enforce:
    - status IN ('pending', 'verified', 'returned')
    - funding_percentage >= 0 AND funding_percentage <= 100 (when not null)
  And an index exists on campaign_id
  And the updated_at trigger is applied
```

```gherkin
Given milestones exist for a campaign
When the campaign is deleted
Then all associated milestones are also deleted (CASCADE)
```

### US-006: Contributions Table

**As a** developer,
**I want** a `contributions` table with FKs to accounts and campaigns and amount validation,
**so that** contribution records maintain referential integrity and enforce positive amounts.

**Acceptance Criteria:**

```gherkin
Given the accounts and campaigns migrations have been applied
When I run `dbmate up` for the contributions migration
Then the `contributions` table exists with columns:
  | Column              | Type         | Constraints                                    |
  | id                  | UUID         | PK DEFAULT gen_random_uuid()                   |
  | donor_id            | UUID         | FK accounts(id) ON DELETE RESTRICT NOT NULL     |
  | campaign_id         | UUID         | FK campaigns(id) ON DELETE RESTRICT NOT NULL    |
  | amount_cents        | BIGINT       | NOT NULL                                       |
  | status              | TEXT         | NOT NULL DEFAULT 'pending_capture'             |
  | gateway_reference   | TEXT         | Nullable                                       |
  | created_at          | TIMESTAMPTZ  | NOT NULL DEFAULT NOW()                         |
  | updated_at          | TIMESTAMPTZ  | NOT NULL DEFAULT NOW()                         |
  And CHECK constraints enforce:
    - amount_cents > 0
    - status IN ('pending_capture', 'captured', 'failed', 'refunded', 'partially_refunded')
  And indexes exist on donor_id, campaign_id, and status
  And the updated_at trigger is applied
```

```gherkin
Given the contributions table exists
When I attempt to insert a contribution with amount_cents = 0
Then the insert fails with a CHECK constraint violation
```

```gherkin
Given the contributions table exists
When I attempt to insert a contribution with amount_cents = -100
Then the insert fails with a CHECK constraint violation
```

### US-007: Escrow Ledger Table

**As a** developer,
**I want** an append-only `escrow_ledger` table with entry type validation,
**so that** the financial audit trail is immutable and every escrow movement is recorded.

**Acceptance Criteria:**

```gherkin
Given the campaigns migration has been applied
When I run `dbmate up` for the escrow ledger migration
Then the `escrow_ledger` table exists with columns:
  | Column           | Type         | Constraints                                    |
  | id               | UUID         | PK DEFAULT gen_random_uuid()                   |
  | campaign_id      | UUID         | FK campaigns(id) ON DELETE RESTRICT NOT NULL    |
  | entry_type       | TEXT         | NOT NULL                                       |
  | amount_cents     | BIGINT       | NOT NULL                                       |
  | contribution_id  | UUID         | Nullable                                       |
  | disbursement_id  | UUID         | Nullable                                       |
  | description      | TEXT         | Nullable                                       |
  | created_at       | TIMESTAMPTZ  | NOT NULL DEFAULT NOW()                         |
  And NO updated_at column exists (append-only)
  And CHECK constraint enforces entry_type IN ('contribution', 'disbursement', 'refund', 'interest_credit', 'interest_debit')
  And indexes exist on campaign_id and contribution_id
  And a BEFORE UPDATE OR DELETE trigger raises an exception to enforce immutability
```

```gherkin
Given the escrow_ledger table has existing rows
When I attempt to UPDATE a row
Then the update fails with an exception raised by the immutability trigger
```

```gherkin
Given the escrow_ledger table has existing rows
When I attempt to DELETE a row
Then the delete fails with an exception raised by the immutability trigger
```

### US-008: KYC Verifications Table

**As a** developer,
**I want** a `kyc_verifications` table with a 9-state status lifecycle and failure tracking,
**so that** identity verification metadata is persisted with full state tracking.

**Acceptance Criteria:**

```gherkin
Given the accounts migration has been applied
When I run `dbmate up` for the KYC verifications migration
Then the `kyc_verifications` table exists with columns:
  | Column              | Type         | Constraints                                    |
  | id                  | UUID         | PK DEFAULT gen_random_uuid()                   |
  | account_id          | UUID         | FK accounts(id) ON DELETE RESTRICT NOT NULL     |
  | status              | TEXT         | NOT NULL DEFAULT 'not_verified'                |
  | document_type       | TEXT         | Nullable                                       |
  | provider_reference  | TEXT         | Nullable                                       |
  | failure_count       | INTEGER      | NOT NULL DEFAULT 0                             |
  | verified_at         | TIMESTAMPTZ  | Nullable                                       |
  | expires_at          | TIMESTAMPTZ  | Nullable                                       |
  | created_at          | TIMESTAMPTZ  | NOT NULL DEFAULT NOW()                         |
  | updated_at          | TIMESTAMPTZ  | NOT NULL DEFAULT NOW()                         |
  And CHECK constraints enforce:
    - status IN ('not_verified', 'pending', 'pending_resubmission', 'in_manual_review', 'verified', 'expired', 'reverification_required', 'rejected', 'locked')
    - failure_count >= 0
  And indexes exist on account_id, status, and expires_at
  And the updated_at trigger is applied
```

### US-009: Full Migration Lifecycle

**As a** developer,
**I want** all 8 migrations to apply and roll back cleanly,
**so that** the schema can be created and destroyed reliably in any environment.

**Acceptance Criteria:**

```gherkin
Given a clean PostgreSQL database
When I run `dbmate up`
Then all 8 migrations apply in order without errors
  And the schema_migrations table shows 8 applied migrations
  And all tables, indexes, constraints, triggers, and functions exist as specified
```

```gherkin
Given all 8 migrations have been applied
When I run `dbmate down` repeatedly (8 times)
Then each migration rolls back in reverse order without errors
  And after all rollbacks, only the schema_migrations table remains
```

```gherkin
Given all 8 migrations have been applied
When I run `dbmate up` again
Then no migrations are re-applied (idempotent)
  And the command exits successfully
```

---

## 2. Data Model

### 2.1 Table Overview

| Table | Type | `updated_at` | Immutability Trigger | FK Dependencies |
|-------|------|-------------|---------------------|-----------------|
| `events` | Append-only event store | No | Yes (BEFORE UPDATE OR DELETE) | None |
| `accounts` | Mutable aggregate | Yes (auto-trigger) | No | None |
| `campaigns` | Mutable aggregate | Yes (auto-trigger) | No | `accounts` |
| `milestones` | Mutable aggregate | Yes (auto-trigger) | No | `campaigns` |
| `contributions` | Mutable aggregate | Yes (auto-trigger) | No | `accounts`, `campaigns` |
| `escrow_ledger` | Append-only ledger | No | Yes (BEFORE UPDATE OR DELETE) | `campaigns` |
| `kyc_verifications` | Mutable aggregate | Yes (auto-trigger) | No | `accounts` |

### 2.2 Monetary Column Convention

All monetary values are stored as `BIGINT` representing integer cents (USD minor units). Never `FLOAT`, `DOUBLE`, `REAL`, or `NUMERIC`. The `amount_cents` column in the `escrow_ledger` is always stored as a positive value; the sign is derived from the `entry_type` at query time per the balance calculation pattern in the research document.

### 2.3 Date Column Convention

All date/time columns use `TIMESTAMPTZ` (timestamp with time zone). Never `TIMESTAMP` without timezone. PostgreSQL stores `TIMESTAMPTZ` internally as UTC.

### 2.4 UUID Generation

All primary keys use `UUID DEFAULT gen_random_uuid()` (built-in since PostgreSQL 13, no extension required).

### 2.5 Status Column Convention

All status columns use `TEXT NOT NULL DEFAULT '<initial_state>'` with a CHECK constraint listing all valid values. Not PostgreSQL ENUM types. State machine transition validation is enforced at the domain layer, not the database.

### 2.6 Escrow Balance Calculation Pattern

The current escrow balance for a campaign is computed, not stored:

```sql
SELECT SUM(
  CASE
    WHEN entry_type IN ('contribution', 'interest_credit') THEN amount_cents
    WHEN entry_type IN ('disbursement', 'refund', 'interest_debit') THEN -amount_cents
    ELSE 0
  END
) AS balance_cents
FROM escrow_ledger
WHERE campaign_id = $1;
```

---

## 3. Migration Files

### 3.1 Migration Order and Dependency Chain

```
Migration 1: 20260304000001_create_updated_at_trigger.sql
  └── No dependencies (standalone function)

Migration 2: 20260304000002_create_event_store.sql
  └── No table dependencies

Migration 3: 20260304000003_create_accounts.sql
  └── Depends on: Migration 1 (trigger function)

Migration 4: 20260304000004_create_campaigns.sql
  └── Depends on: Migration 1 (trigger function), Migration 3 (accounts)

Migration 5: 20260304000005_create_milestones.sql
  └── Depends on: Migration 1 (trigger function), Migration 4 (campaigns)

Migration 6: 20260304000006_create_contributions.sql
  └── Depends on: Migration 1 (trigger function), Migration 3 (accounts), Migration 4 (campaigns)

Migration 7: 20260304000007_create_escrow_ledger.sql
  └── Depends on: Migration 4 (campaigns)

Migration 8: 20260304000008_create_kyc_verifications.sql
  └── Depends on: Migration 1 (trigger function), Migration 3 (accounts)
```

Rollback order is the reverse: 8, 7, 6, 5, 4, 3, 2, 1.

### 3.2 Migration File: `20260304000001_create_updated_at_trigger.sql`

```sql
-- migrate:up
BEGIN;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMIT;

-- migrate:down
BEGIN;

DROP FUNCTION IF EXISTS update_updated_at_column();

COMMIT;
```

### 3.3 Migration File: `20260304000002_create_event_store.sql`

```sql
-- migrate:up
BEGIN;

CREATE TABLE events (
  event_id         UUID         NOT NULL DEFAULT gen_random_uuid(),
  event_type       TEXT         NOT NULL,
  aggregate_id     UUID         NOT NULL,
  aggregate_type   TEXT         NOT NULL,
  sequence_number  BIGINT       NOT NULL,
  timestamp        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  correlation_id   UUID         NOT NULL,
  source_service   TEXT         NOT NULL,
  payload          JSONB        NOT NULL DEFAULT '{}',

  PRIMARY KEY (aggregate_id, sequence_number)
);

ALTER TABLE events ADD CONSTRAINT uq_events_event_id UNIQUE (event_id);

CREATE INDEX idx_events_event_type ON events (event_type);
CREATE INDEX idx_events_timestamp ON events (timestamp);
CREATE INDEX idx_events_correlation_id ON events (correlation_id);

-- Defence in depth: prevent UPDATE and DELETE on append-only table
CREATE OR REPLACE FUNCTION prevent_events_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'events table is append-only: % operations are not permitted', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_events_no_update
  BEFORE UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION prevent_events_modification();

CREATE TRIGGER trg_events_no_delete
  BEFORE DELETE ON events
  FOR EACH ROW
  EXECUTE FUNCTION prevent_events_modification();

COMMIT;

-- migrate:down
BEGIN;

DROP TRIGGER IF EXISTS trg_events_no_delete ON events;
DROP TRIGGER IF EXISTS trg_events_no_update ON events;
DROP FUNCTION IF EXISTS prevent_events_modification();
DROP TABLE IF EXISTS events;

COMMIT;
```

### 3.4 Migration File: `20260304000003_create_accounts.sql`

```sql
-- migrate:up
BEGIN;

CREATE TABLE accounts (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id         TEXT         UNIQUE NOT NULL,
  email                 TEXT         UNIQUE NOT NULL,
  display_name          TEXT,
  status                TEXT         NOT NULL DEFAULT 'pending_verification',
  roles                 TEXT[]       NOT NULL DEFAULT '{backer}',
  onboarding_completed  BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_accounts_status CHECK (
    status IN ('pending_verification', 'active', 'suspended', 'deactivated', 'deleted')
  )
);

CREATE INDEX idx_accounts_status ON accounts (status);

CREATE TRIGGER trg_accounts_updated_at
  BEFORE UPDATE ON accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMIT;

-- migrate:down
BEGIN;

DROP TRIGGER IF EXISTS trg_accounts_updated_at ON accounts;
DROP TABLE IF EXISTS accounts;

COMMIT;
```

### 3.5 Migration File: `20260304000004_create_campaigns.sql`

```sql
-- migrate:up
BEGIN;

CREATE TABLE campaigns (
  id                        UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id                UUID         NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  title                     TEXT         NOT NULL,
  summary                   VARCHAR(280),
  description               TEXT,
  category                  TEXT         NOT NULL,
  status                    TEXT         NOT NULL DEFAULT 'draft',
  min_funding_target_cents  BIGINT       NOT NULL,
  max_funding_cap_cents     BIGINT       NOT NULL,
  deadline                  TIMESTAMPTZ,
  created_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_campaigns_status CHECK (
    status IN (
      'draft', 'submitted', 'under_review', 'approved', 'rejected',
      'live', 'funded', 'suspended', 'failed', 'settlement', 'complete', 'cancelled'
    )
  ),
  CONSTRAINT chk_campaigns_category CHECK (
    category IN (
      'propulsion', 'entry_descent_landing', 'power_energy',
      'habitats_construction', 'life_support_crew_health',
      'food_water_production', 'isru', 'radiation_protection',
      'robotics_automation', 'communications_navigation'
    )
  ),
  CONSTRAINT chk_campaigns_min_funding CHECK (min_funding_target_cents > 0),
  CONSTRAINT chk_campaigns_max_funding CHECK (max_funding_cap_cents >= min_funding_target_cents)
);

CREATE INDEX idx_campaigns_creator_id ON campaigns (creator_id);
CREATE INDEX idx_campaigns_status ON campaigns (status);
CREATE INDEX idx_campaigns_category ON campaigns (category);
CREATE INDEX idx_campaigns_deadline ON campaigns (deadline);

CREATE TRIGGER trg_campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMIT;

-- migrate:down
BEGIN;

DROP TRIGGER IF EXISTS trg_campaigns_updated_at ON campaigns;
DROP TABLE IF EXISTS campaigns;

COMMIT;
```

### 3.6 Migration File: `20260304000005_create_milestones.sql`

```sql
-- migrate:up
BEGIN;

CREATE TABLE milestones (
  id                     UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id            UUID         NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  title                  TEXT,
  description            TEXT,
  target_date            TIMESTAMPTZ,
  funding_percentage     INTEGER,
  verification_criteria  TEXT,
  status                 TEXT         NOT NULL DEFAULT 'pending',
  created_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_milestones_status CHECK (
    status IN ('pending', 'verified', 'returned')
  ),
  CONSTRAINT chk_milestones_funding_percentage CHECK (
    funding_percentage IS NULL OR (funding_percentage >= 0 AND funding_percentage <= 100)
  )
);

CREATE INDEX idx_milestones_campaign_id ON milestones (campaign_id);

CREATE TRIGGER trg_milestones_updated_at
  BEFORE UPDATE ON milestones
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMIT;

-- migrate:down
BEGIN;

DROP TRIGGER IF EXISTS trg_milestones_updated_at ON milestones;
DROP TABLE IF EXISTS milestones;

COMMIT;
```

### 3.7 Migration File: `20260304000006_create_contributions.sql`

```sql
-- migrate:up
BEGIN;

CREATE TABLE contributions (
  id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_id           UUID         NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  campaign_id        UUID         NOT NULL REFERENCES campaigns(id) ON DELETE RESTRICT,
  amount_cents       BIGINT       NOT NULL,
  status             TEXT         NOT NULL DEFAULT 'pending_capture',
  gateway_reference  TEXT,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_contributions_amount CHECK (amount_cents > 0),
  CONSTRAINT chk_contributions_status CHECK (
    status IN ('pending_capture', 'captured', 'failed', 'refunded', 'partially_refunded')
  )
);

CREATE INDEX idx_contributions_donor_id ON contributions (donor_id);
CREATE INDEX idx_contributions_campaign_id ON contributions (campaign_id);
CREATE INDEX idx_contributions_status ON contributions (status);

CREATE TRIGGER trg_contributions_updated_at
  BEFORE UPDATE ON contributions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMIT;

-- migrate:down
BEGIN;

DROP TRIGGER IF EXISTS trg_contributions_updated_at ON contributions;
DROP TABLE IF EXISTS contributions;

COMMIT;
```

### 3.8 Migration File: `20260304000007_create_escrow_ledger.sql`

```sql
-- migrate:up
BEGIN;

CREATE TABLE escrow_ledger (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id      UUID         NOT NULL REFERENCES campaigns(id) ON DELETE RESTRICT,
  entry_type       TEXT         NOT NULL,
  amount_cents     BIGINT       NOT NULL,
  contribution_id  UUID,
  disbursement_id  UUID,
  description      TEXT,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_escrow_ledger_entry_type CHECK (
    entry_type IN ('contribution', 'disbursement', 'refund', 'interest_credit', 'interest_debit')
  )
);

CREATE INDEX idx_escrow_ledger_campaign_id ON escrow_ledger (campaign_id);
CREATE INDEX idx_escrow_ledger_contribution_id ON escrow_ledger (contribution_id);

-- Defence in depth: prevent UPDATE and DELETE on append-only table
CREATE OR REPLACE FUNCTION prevent_escrow_ledger_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'escrow_ledger table is append-only: % operations are not permitted', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_escrow_ledger_no_update
  BEFORE UPDATE ON escrow_ledger
  FOR EACH ROW
  EXECUTE FUNCTION prevent_escrow_ledger_modification();

CREATE TRIGGER trg_escrow_ledger_no_delete
  BEFORE DELETE ON escrow_ledger
  FOR EACH ROW
  EXECUTE FUNCTION prevent_escrow_ledger_modification();

COMMIT;

-- migrate:down
BEGIN;

DROP TRIGGER IF EXISTS trg_escrow_ledger_no_delete ON escrow_ledger;
DROP TRIGGER IF EXISTS trg_escrow_ledger_no_update ON escrow_ledger;
DROP FUNCTION IF EXISTS prevent_escrow_ledger_modification();
DROP TABLE IF EXISTS escrow_ledger;

COMMIT;
```

### 3.9 Migration File: `20260304000008_create_kyc_verifications.sql`

```sql
-- migrate:up
BEGIN;

CREATE TABLE kyc_verifications (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id          UUID         NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  status              TEXT         NOT NULL DEFAULT 'not_verified',
  document_type       TEXT,
  provider_reference  TEXT,
  failure_count       INTEGER      NOT NULL DEFAULT 0,
  verified_at         TIMESTAMPTZ,
  expires_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_kyc_verifications_status CHECK (
    status IN (
      'not_verified', 'pending', 'pending_resubmission', 'in_manual_review',
      'verified', 'expired', 'reverification_required', 'rejected', 'locked'
    )
  ),
  CONSTRAINT chk_kyc_verifications_failure_count CHECK (failure_count >= 0)
);

CREATE INDEX idx_kyc_verifications_account_id ON kyc_verifications (account_id);
CREATE INDEX idx_kyc_verifications_status ON kyc_verifications (status);
CREATE INDEX idx_kyc_verifications_expires_at ON kyc_verifications (expires_at);

CREATE TRIGGER trg_kyc_verifications_updated_at
  BEFORE UPDATE ON kyc_verifications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMIT;

-- migrate:down
BEGIN;

DROP TRIGGER IF EXISTS trg_kyc_verifications_updated_at ON kyc_verifications;
DROP TABLE IF EXISTS kyc_verifications;

COMMIT;
```

---

## 4. Edge Cases

### 4.1 Concurrency

| # | Edge Case | Defined Behaviour |
|---|-----------|-------------------|
| EC-1 | Duplicate event sequence numbers: two concurrent commands insert events with the same `(aggregate_id, sequence_number)` | The composite PK enforces uniqueness. The second insert fails with a unique violation. Application must handle with optimistic concurrency (retry with fresh state). |
| EC-2 | Concurrent contribution and campaign state change: contribution submitted while campaign transitions to `failed` or `suspended` | Application must check campaign status within the same transaction as the contribution insert, or use `SELECT FOR UPDATE` on the campaign row. |
| EC-3 | Race on funding target reached: multiple contributions push a campaign past its minimum funding target simultaneously | Only one should trigger the `funded` state transition. Use a serialisable transaction or advisory lock to gate the status transition check. |
| EC-4 | Concurrent escrow balance reads during disbursement: disbursement calculates pro-rata while a refund is also being processed | Use row-level locking or serialise financial operations per campaign. |

### 4.2 Foreign Key Violations

| # | Edge Case | Defined Behaviour |
|---|-----------|-------------------|
| EC-5 | Deleting an account that has campaigns | `ON DELETE RESTRICT` on `campaigns.creator_id` prevents deletion. Application must enforce account deactivation lifecycle. |
| EC-6 | Deleting a campaign that has escrow entries | `ON DELETE RESTRICT` on `escrow_ledger.campaign_id` prevents deletion. Campaigns with financial history transition to terminal states, never deleted. |
| EC-7 | Creating a contribution for a non-existent campaign | FK constraint catches at database level. Application should also validate campaign existence and status. |

### 4.3 Migration Rollback

| # | Edge Case | Defined Behaviour |
|---|-----------|-------------------|
| EC-8 | Rollback with existing data referencing parent tables | Rollback order must be the reverse of creation order. `dbmate down` drops dependents before parents. Each migration's `-- migrate:down` drops only its own table. |
| EC-9 | Partial migration failure mid-execution | `BEGIN; ... COMMIT;` wrapping ensures atomicity. PostgreSQL supports transactional DDL. Either all DDL succeeds or none does. |
| EC-10 | Re-running migrations | dbmate tracks applied migrations in `schema_migrations`. Re-running `dbmate up` is safe; already-applied migrations are skipped. |

### 4.4 Null Handling

| # | Edge Case | Defined Behaviour |
|---|-----------|-------------------|
| EC-11 | Nullable `deadline` on campaigns | Deadline is null while campaign is in draft. Application code must handle null deadlines. Deadline enforcement queries must filter `deadline IS NOT NULL`. |
| EC-12 | Nullable `gateway_reference` on contributions | Set only after payment gateway responds. Contributions in `pending_capture` status have null reference. |
| EC-13 | Nullable `funding_percentage` on milestones | Milestones can exist in draft state without percentage allocation. Application-layer validation that percentages sum to 100% must handle partial/null allocations. |

### 4.5 Data Integrity

| # | Edge Case | Defined Behaviour |
|---|-----------|-------------------|
| EC-14 | Escrow balance going negative | No database-level constraint prevents this (balance is derived from SUM). Application must validate that disbursement or refund amounts do not exceed current balance before inserting ledger entries. |
| EC-15 | Sequence number gaps in event store | If a transaction inserts an event and rolls back, the sequence number is consumed but not present. PK ensures uniqueness but not gaplessness. Application generates sequence numbers from `MAX(sequence_number) + 1` within a serialisable transaction. |
| EC-16 | Status transition validity | CHECK constraint validates value is in the allowed set but does NOT enforce valid transitions (e.g., cannot prevent `draft` -> `live` skipping `submitted`). Transition validation is enforced at the domain layer. |
| EC-17 | Monetary overflow | `BIGINT` holds up to 9,223,372,036,854,775,807 cents (~$92 quadrillion). Not a practical concern, but application validates amounts within business-meaningful bounds (min $1M = 100,000,000 cents, max $1B = 100,000,000,000 cents). |
| EC-18 | Time zone edge cases | `TIMESTAMPTZ` stores UTC internally. Application must send timestamps as UTC or with explicit timezone offsets. `NOW()` default uses database server clock --- ensure NTP synchronisation. |
| EC-19 | JSONB payload size | No database-level size constraint on `payload`. Application enforces max payload size (e.g., 64KB per event). |
| EC-20 | Array role validation | `TEXT[]` type does not prevent invalid role names at the database level. Application validates role values (`backer`, `creator`, `reviewer`, `administrator`, `super_administrator`). |

---

## 5. Design Decisions

### 5.1 `event_id` UNIQUE Constraint

The `event_id` is NOT the primary key. The PK is `(aggregate_id, sequence_number)` to enforce the event sourcing invariant of ordered, gapless sequences per aggregate. A separate UNIQUE constraint on `event_id` provides global uniqueness for cross-referencing and deduplication.

### 5.2 TEXT + CHECK Instead of ENUM

PostgreSQL ENUM types are awkward to modify (`ALTER TYPE ... ADD VALUE` cannot run inside a transaction in older PG versions). TEXT with CHECK constraints is more flexible for evolution and easier to manage in migrations.

### 5.3 `contribution_id` in Escrow Ledger is Not a FK

The `escrow_ledger.contribution_id` is a UUID reference without a FK constraint. While the research document considered adding a FK to `contributions(id)`, this is kept as a loose reference because: (a) not every ledger entry has a contribution (interest entries do not), and (b) the `disbursement_id` has no target table in this feature's scope. Keeping both as loose UUIDs maintains consistency within the table. FK enforcement can be added in a future migration when the disbursements table exists.

### 5.4 Append-Only Enforcement via Triggers

Both `events` and `escrow_ledger` use BEFORE UPDATE/DELETE triggers that raise exceptions. This provides defence in depth beyond application-layer enforcement. Each append-only table has its own trigger function to produce specific error messages.

### 5.5 No `previous_hash` Column on Events

The audit spec (L3-006, Section 5.2) specifies a SHA-256 hash chain for tamper detection. The research document explicitly identifies this as theatre for the local demo. The initial migration does NOT include the `previous_hash` column. It can be added in a future migration when tamper detection is implemented.

---

## 6. Testing Requirements

### 6.1 Migration Apply Test

```gherkin
Given a clean PostgreSQL database (no tables except schema_migrations)
When I run `dbmate up`
Then all 8 migrations complete without errors
  And the following tables exist: events, accounts, campaigns, milestones, contributions, escrow_ledger, kyc_verifications
  And the function update_updated_at_column() exists
  And the function prevent_events_modification() exists
  And the function prevent_escrow_ledger_modification() exists
```

### 6.2 Migration Rollback Test

```gherkin
Given all 8 migrations have been applied
When I run `dbmate down` 8 times
Then each rollback completes without errors
  And after all rollbacks, no application tables, triggers, or functions remain
  And only the schema_migrations table remains
```

### 6.3 Constraint Verification Tests

Run against the fully migrated database:

| Test | SQL | Expected Result |
|------|-----|----------------|
| Account status CHECK | `INSERT INTO accounts (clerk_user_id, email, status) VALUES ('test', 'a@b.com', 'invalid')` | CHECK violation error |
| Account default status | `INSERT INTO accounts (clerk_user_id, email) VALUES ('test', 'a@b.com') RETURNING status` | `'pending_verification'` |
| Account default roles | `INSERT INTO accounts (clerk_user_id, email) VALUES ('test', 'a@b.com') RETURNING roles` | `'{backer}'` |
| Campaign min funding CHECK | `INSERT INTO campaigns (creator_id, title, category, min_funding_target_cents, max_funding_cap_cents) VALUES (<valid_id>, 'Test', 'propulsion', 0, 100)` | CHECK violation error |
| Campaign max >= min CHECK | `INSERT INTO campaigns (creator_id, title, category, min_funding_target_cents, max_funding_cap_cents) VALUES (<valid_id>, 'Test', 'propulsion', 200, 100)` | CHECK violation error |
| Campaign category CHECK | `INSERT INTO campaigns (..., category, ...) VALUES (..., 'invalid_category', ...)` | CHECK violation error |
| Contribution amount CHECK | `INSERT INTO contributions (donor_id, campaign_id, amount_cents) VALUES (<id>, <id>, -1)` | CHECK violation error |
| Milestone funding_percentage CHECK | `INSERT INTO milestones (campaign_id, status, funding_percentage) VALUES (<id>, 'pending', 101)` | CHECK violation error |
| KYC failure_count CHECK | `UPDATE kyc_verifications SET failure_count = -1 WHERE id = <id>` | CHECK violation error |
| Event immutability | `UPDATE events SET event_type = 'changed' WHERE aggregate_id = <id>` | Exception from trigger |
| Event delete immutability | `DELETE FROM events WHERE aggregate_id = <id>` | Exception from trigger |
| Escrow immutability | `UPDATE escrow_ledger SET amount_cents = 0 WHERE id = <id>` | Exception from trigger |
| Escrow delete immutability | `DELETE FROM escrow_ledger WHERE id = <id>` | Exception from trigger |

### 6.4 FK and Referential Integrity Tests

| Test | Action | Expected Result |
|------|--------|----------------|
| Campaign FK RESTRICT | Delete account that has campaigns | FK violation error |
| Contribution donor FK RESTRICT | Delete account that has contributions | FK violation error |
| Contribution campaign FK RESTRICT | Delete campaign that has contributions | FK violation error |
| Escrow ledger FK RESTRICT | Delete campaign that has escrow entries | FK violation error |
| KYC FK RESTRICT | Delete account that has KYC records | FK violation error |
| Milestone FK CASCADE | Delete campaign that has milestones | Campaign and milestones both deleted |

### 6.5 Trigger Verification Tests

| Test | Action | Expected Result |
|------|--------|----------------|
| Accounts updated_at | Update an account row, check updated_at | `updated_at` is newer than `created_at` |
| Campaigns updated_at | Update a campaign row, check updated_at | `updated_at` is newer than `created_at` |
| Milestones updated_at | Update a milestone row, check updated_at | `updated_at` is newer than `created_at` |
| Contributions updated_at | Update a contribution row, check updated_at | `updated_at` is newer than `created_at` |
| KYC updated_at | Update a KYC row, check updated_at | `updated_at` is newer than `created_at` |

### 6.6 Index Existence Tests

Verify that all expected indexes exist by querying `pg_indexes`:

| Index Name | Table | Column(s) |
|-----------|-------|-----------|
| `idx_events_event_type` | `events` | `event_type` |
| `idx_events_timestamp` | `events` | `timestamp` |
| `idx_events_correlation_id` | `events` | `correlation_id` |
| `idx_accounts_status` | `accounts` | `status` |
| `idx_campaigns_creator_id` | `campaigns` | `creator_id` |
| `idx_campaigns_status` | `campaigns` | `status` |
| `idx_campaigns_category` | `campaigns` | `category` |
| `idx_campaigns_deadline` | `campaigns` | `deadline` |
| `idx_milestones_campaign_id` | `milestones` | `campaign_id` |
| `idx_contributions_donor_id` | `contributions` | `donor_id` |
| `idx_contributions_campaign_id` | `contributions` | `campaign_id` |
| `idx_contributions_status` | `contributions` | `status` |
| `idx_escrow_ledger_campaign_id` | `escrow_ledger` | `campaign_id` |
| `idx_escrow_ledger_contribution_id` | `escrow_ledger` | `contribution_id` |
| `idx_kyc_verifications_account_id` | `kyc_verifications` | `account_id` |
| `idx_kyc_verifications_status` | `kyc_verifications` | `status` |
| `idx_kyc_verifications_expires_at` | `kyc_verifications` | `expires_at` |

---

## 7. Out of Scope

- Read model / materialised view creation (built per feature as needed).
- Seed data (separate task or part of individual features).
- Notification tables (deferred until notification features are built).
- Disbursements table (tracked as events in the event store for now; `disbursement_id` in escrow_ledger is a loose UUID reference).
- `previous_hash` column for tamper detection on events (theatre for local demo; future migration).
- GIN index on `events.payload` (future optimisation if JSONB queries become common).
- Row-level security policies (application-layer enforcement for local demo).
- Frontend, API, or domain entity implementation.

---

## 8. Implementation Checklist

- [ ] Create `db/migrations/20260304000001_create_updated_at_trigger.sql`
- [ ] Create `db/migrations/20260304000002_create_event_store.sql`
- [ ] Create `db/migrations/20260304000003_create_accounts.sql`
- [ ] Create `db/migrations/20260304000004_create_campaigns.sql`
- [ ] Create `db/migrations/20260304000005_create_milestones.sql`
- [ ] Create `db/migrations/20260304000006_create_contributions.sql`
- [ ] Create `db/migrations/20260304000007_create_escrow_ledger.sql`
- [ ] Create `db/migrations/20260304000008_create_kyc_verifications.sql`
- [ ] Verify `dbmate up` runs successfully against a clean database
- [ ] Verify `dbmate down` rolls back all migrations cleanly
- [ ] Verify all CHECK constraints reject invalid values
- [ ] Verify all FK constraints enforce referential integrity
- [ ] Verify `updated_at` triggers fire on UPDATE for all mutable tables
- [ ] Verify immutability triggers prevent UPDATE/DELETE on `events` and `escrow_ledger`
- [ ] Verify all expected indexes exist

---

## 9. Spec Cross-References

| Spec | Relevant Sections | What This Feature Implements |
|------|-------------------|------------------------------|
| L2-002 (Engineering Standard) | 1.2 (Data Access), 1.7 (Logging & Auditability) | Parameterised query foundation; append-only audit trail via events table |
| L3-001 (Architecture) | 6.2 (CQRS & Event Sourcing) | Event store table with composite PK, JSONB payload, event envelope schema |
| L3-006 (Audit) | 5.1 (Append-Only Storage) | Events table serves as both domain event store and audit event store |
| L3-008 (Tech Stack) | Database & Data Access | Aurora PostgreSQL, pg driver, dbmate migrations |
| L4-001 (Account) | 1.3 (State Machine), 3 (Roles) | Accounts table with 5-state lifecycle, TEXT[] roles |
| L4-002 (Campaign) | 3.1 (States), 4.4 (Categories), 8.1 (Milestones) | Campaigns table with 12-state lifecycle, 10 categories; milestones table |
| L4-003 (Donor) | 6.2 (Amount Selection) | Contributions table with BIGINT amount_cents |
| L4-004 (Payments) | 5.3 (Contribution States), 6.2 (Escrow Ledger) | Contributions table with 5-state lifecycle; escrow_ledger append-only |
| L4-005 (KYC) | 6.1 (Status States) | KYC verifications table with 9-state lifecycle |
| `.claude/rules/infra.md` | Migrations section | dbmate format, `BEGIN; COMMIT;` wrapping, BIGINT for money, TIMESTAMPTZ |
| `.claude/rules/backend.md` | Database section | Raw SQL, parameterised queries, BIGINT cents, FK indexes |
