# feat-002: Database Schema Foundation — Research

> **Researcher**: Spec Researcher
> **Date**: 2026-03-04
> **Feature**: feat-002-database-schema-foundation
> **Status**: Complete

---

## 1. Domain Data Models

### 1.1 Event Store (`events`)

**Source**: architecture.md Section 6.2, audit.md Section 5.1, feat-002 brief

The event store is the backbone of the CQRS/Event Sourcing pattern. It serves double duty as both the domain event log and the audit trail (audit.md Section 5.1 explicitly states audit events are stored in the same PostgreSQL event store).

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `event_id` | `UUID` | `NOT NULL DEFAULT gen_random_uuid()` | Unique event identifier |
| `event_type` | `TEXT` | `NOT NULL` | Format: `DOMAIN.ACTION` (e.g., `campaign.created`, `payment.captured`) |
| `aggregate_id` | `UUID` | `NOT NULL` | The aggregate this event belongs to |
| `aggregate_type` | `TEXT` | `NOT NULL` | e.g., `campaign`, `account`, `payment` |
| `sequence_number` | `BIGINT` | `NOT NULL` | Per-aggregate monotonic sequence |
| `timestamp` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | When the event occurred |
| `correlation_id` | `UUID` | `NOT NULL` | Request correlation ID from edge (L2-002 Section 6.2) |
| `source_service` | `TEXT` | `NOT NULL` | Emitting service name |
| `payload` | `JSONB` | `NOT NULL DEFAULT '{}'` | Event-specific data |

**Primary Key**: `(aggregate_id, sequence_number)` — composite PK enforces per-aggregate ordering and prevents duplicate sequence numbers.

**Indexes**:
- `idx_events_event_type` on `event_type` — for event type filtering in read model populators
- `idx_events_timestamp` on `timestamp` — for time-range queries (audit query service, retention enforcement)
- `idx_events_correlation_id` on `correlation_id` — for correlation trace reconstruction (audit.md Section 10.1)

**Design decisions**:
- **No `updated_at`**: Events are immutable by design. The table has no UPDATE path.
- **No DELETE**: Append-only, enforced at application level (and optionally via row-level security policies per audit.md Section 5.1).
- **`JSONB` for payload**: Enables indexing, querying, and schema-flexible event data. Architecture spec Section 6.2 shows `payload` as an object in the event envelope.
- **`event_id` is NOT the PK**: The PK is the composite `(aggregate_id, sequence_number)` to enforce the event sourcing invariant of ordered, gapless sequences per aggregate. `event_id` is a globally unique identifier for cross-referencing.

**Open consideration — hash chain for tamper detection**: Audit.md Section 5.2 specifies a SHA-256 hash chain (`previous_hash` field) per aggregate stream. This is marked as theatre for the local demo. The initial migration should NOT include the `previous_hash` column to keep the schema simple. It can be added in a future migration when tamper detection is implemented.

### 1.2 Accounts (`accounts`)

**Source**: account.md, feat-002 brief

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `UUID` | `PK DEFAULT gen_random_uuid()` | |
| `clerk_user_id` | `TEXT` | `UNIQUE NOT NULL` | External identity from Clerk |
| `email` | `TEXT` | `UNIQUE NOT NULL` | Validated format at app layer |
| `display_name` | `TEXT` | Nullable | Optional, shown on public surfaces |
| `status` | `TEXT` | `NOT NULL DEFAULT 'pending_verification'` | See status enum below |
| `roles` | `TEXT[]` | `NOT NULL DEFAULT '{backer}'` | PostgreSQL array type |
| `onboarding_completed` | `BOOLEAN` | `NOT NULL DEFAULT FALSE` | Tracks onboarding flow completion |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Auto-updated via trigger |

**CHECK constraints**:
- `status IN ('pending_verification', 'active', 'suspended', 'deactivated', 'deleted')` — derived from account.md Section 1.3 state machine

**Indexes**:
- `idx_accounts_clerk_user_id` — covered by UNIQUE constraint
- `idx_accounts_email` — covered by UNIQUE constraint
- `idx_accounts_status` on `status` — for filtering by account state

**Notes on `roles` column**:
- PostgreSQL `TEXT[]` stores multiple roles per account (account.md Section 3 confirms users may hold multiple roles simultaneously).
- Valid roles from account.md Section 3: `backer`, `creator`, `reviewer`, `administrator`, `super_administrator`.
- A CHECK constraint on array contents is possible via a function but may be deferred to application-layer validation for simplicity. The array approach avoids a join table for a small, fixed set of roles.

### 1.3 Campaigns (`campaigns`)

**Source**: campaign.md, feat-002 brief

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `UUID` | `PK DEFAULT gen_random_uuid()` | |
| `creator_id` | `UUID` | `FK accounts(id) ON DELETE RESTRICT NOT NULL` | Campaign creator |
| `title` | `TEXT` | `NOT NULL` | |
| `summary` | `VARCHAR(280)` | Nullable | Character limit per campaign.md Section 4.2 |
| `description` | `TEXT` | Nullable | Rich text (stored as HTML or markdown) |
| `category` | `TEXT` | `NOT NULL` | One of 10 categories from campaign.md Section 4.4 |
| `status` | `TEXT` | `NOT NULL DEFAULT 'draft'` | See status enum below |
| `min_funding_target_cents` | `BIGINT` | `NOT NULL` | Minimum funding goal in USD cents |
| `max_funding_cap_cents` | `BIGINT` | `NOT NULL` | Maximum cap; campaign stops accepting at this point |
| `deadline` | `TIMESTAMPTZ` | Nullable | Null while in draft; set when going live |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Auto-updated via trigger |

**CHECK constraints**:
- `status IN ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'live', 'funded', 'suspended', 'failed', 'settlement', 'complete', 'cancelled')` — from campaign.md Section 3.1
- `min_funding_target_cents > 0`
- `max_funding_cap_cents >= min_funding_target_cents`
- `category IN ('propulsion', 'entry_descent_landing', 'power_energy', 'habitats_construction', 'life_support_crew_health', 'food_water_production', 'isru', 'radiation_protection', 'robotics_automation', 'communications_navigation')` — from campaign.md Section 4.4

**Indexes**:
- `idx_campaigns_creator_id` on `creator_id` — FK index
- `idx_campaigns_status` on `status` — for filtering live/active campaigns
- `idx_campaigns_category` on `category` — for category browsing (donor.md Section 5.2)
- `idx_campaigns_deadline` on `deadline` — for deadline enforcement queries

**FK rationale**: `ON DELETE RESTRICT` prevents deleting an account that owns campaigns. Account deactivation requires campaigns to be resolved first (account.md Section 7.1).

### 1.4 Milestones (`milestones`)

**Source**: campaign.md Section 8.1, feat-002 brief

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `UUID` | `PK DEFAULT gen_random_uuid()` | |
| `campaign_id` | `UUID` | `FK campaigns(id) ON DELETE CASCADE NOT NULL` | |
| `title` | `TEXT` | Nullable | |
| `description` | `TEXT` | Nullable | |
| `target_date` | `TIMESTAMPTZ` | Nullable | Expected completion date |
| `funding_percentage` | `INTEGER` | Nullable | Portion of total funds released on verification |
| `verification_criteria` | `TEXT` | Nullable | Specific, measurable conditions |
| `status` | `TEXT` | `NOT NULL DEFAULT 'pending'` | |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Auto-updated via trigger |

**CHECK constraints**:
- `status IN ('pending', 'verified', 'returned')` — from campaign.md Section 8.3
- `funding_percentage >= 0 AND funding_percentage <= 100` (when not null)

**Indexes**:
- `idx_milestones_campaign_id` on `campaign_id` — FK index

**FK rationale**: `ON DELETE CASCADE` — milestones are owned by the campaign. If a campaign is deleted (e.g., during cleanup), its milestones should go with it.

**Note**: campaign.md Section 4.2 requires at least two milestones and funding percentages summing to 100%. These are application-layer validations, not database constraints, because they involve cross-row logic.

### 1.5 Contributions (`contributions`)

**Source**: payments.md Section 5, feat-002 brief

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `UUID` | `PK DEFAULT gen_random_uuid()` | |
| `donor_id` | `UUID` | `FK accounts(id) ON DELETE RESTRICT NOT NULL` | The backer |
| `campaign_id` | `UUID` | `FK campaigns(id) ON DELETE RESTRICT NOT NULL` | Which campaign |
| `amount_cents` | `BIGINT` | `NOT NULL` | Contribution amount in USD cents |
| `status` | `TEXT` | `NOT NULL DEFAULT 'pending_capture'` | |
| `gateway_reference` | `TEXT` | Nullable | Stripe charge/payment ID |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Auto-updated via trigger |

**CHECK constraints**:
- `amount_cents > 0`
- `status IN ('pending_capture', 'captured', 'failed', 'refunded', 'partially_refunded')` — from payments.md Section 5.3

**Indexes**:
- `idx_contributions_donor_id` on `donor_id` — FK index, also used for contribution history queries
- `idx_contributions_campaign_id` on `campaign_id` — FK index, also used for campaign funding aggregation
- `idx_contributions_status` on `status` — for filtering by contribution state

**FK rationale**: Both FKs use `ON DELETE RESTRICT`. A donor account or campaign with contributions cannot be deleted — they must go through proper lifecycle transitions.

### 1.6 Escrow Ledger (`escrow_ledger`)

**Source**: payments.md Section 6.2, feat-002 brief

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `UUID` | `PK DEFAULT gen_random_uuid()` | |
| `campaign_id` | `UUID` | `FK campaigns(id) ON DELETE RESTRICT NOT NULL` | Segregated per campaign |
| `entry_type` | `TEXT` | `NOT NULL` | Type of ledger entry |
| `amount_cents` | `BIGINT` | `NOT NULL` | Amount in USD cents (positive for credits, can vary by entry_type convention) |
| `contribution_id` | `UUID` | Nullable | References contribution (for contribution entries) |
| `disbursement_id` | `UUID` | Nullable | References disbursement (for disbursement entries) |
| `description` | `TEXT` | Nullable | Human-readable description |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | |

**CHECK constraints**:
- `entry_type IN ('contribution', 'disbursement', 'refund', 'interest_credit', 'interest_debit')` — derived from payments.md Section 6.2

**Indexes**:
- `idx_escrow_ledger_campaign_id` on `campaign_id` — FK index, primary query path for per-campaign balance
- `idx_escrow_ledger_contribution_id` on `contribution_id` — for contribution-level queries (when not null)

**Design decisions**:
- **No `updated_at`**: This table is append-only by design (payments.md Section 6.2, engineering standard Section 1.7). Entries are never modified or deleted.
- **No UPDATE/DELETE operations**: Application layer must enforce this. Consider a trigger that raises an exception on UPDATE/DELETE for defence in depth.
- **`contribution_id` and `disbursement_id` are nullable**: Not every ledger entry corresponds to a contribution or disbursement (e.g., interest entries).
- **Balance is computed**: The current balance for a campaign is `SUM(amount_cents)` grouped by `campaign_id`, with sign conventions per entry_type.

### 1.7 KYC Verifications (`kyc_verifications`)

**Source**: kyc.md Section 6, feat-002 brief

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `UUID` | `PK DEFAULT gen_random_uuid()` | |
| `account_id` | `UUID` | `FK accounts(id) ON DELETE RESTRICT NOT NULL` | |
| `status` | `TEXT` | `NOT NULL DEFAULT 'not_verified'` | |
| `document_type` | `TEXT` | Nullable | passport, national_id, drivers_licence |
| `provider_reference` | `TEXT` | Nullable | Veriff session/verification ID |
| `failure_count` | `INTEGER` | `NOT NULL DEFAULT 0` | Tracks resubmission attempts (kyc.md Section 6.3) |
| `verified_at` | `TIMESTAMPTZ` | Nullable | When verification succeeded |
| `expires_at` | `TIMESTAMPTZ` | Nullable | Document expiry or 2-year re-verification date |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Auto-updated via trigger |

**CHECK constraints**:
- `status IN ('not_verified', 'pending', 'pending_resubmission', 'in_manual_review', 'verified', 'expired', 'reverification_required', 'rejected', 'locked')` — from kyc.md Section 6.1 (9 states)
- `failure_count >= 0`

**Indexes**:
- `idx_kyc_verifications_account_id` on `account_id` — FK index
- `idx_kyc_verifications_status` on `status` — for filtering by verification state
- `idx_kyc_verifications_expires_at` on `expires_at` — for re-verification trigger queries

**Note**: kyc.md discusses document storage in a dedicated, isolated storage service (S3). The `kyc_verifications` table tracks verification metadata, not the documents themselves.

---

## 2. Event Store Design

### 2.1 Core Design Principles

From architecture.md Section 6.2:

1. **Append-only**: Events are never modified or deleted during active retention.
2. **Per-aggregate ordering**: The composite PK `(aggregate_id, sequence_number)` guarantees a total order within each aggregate.
3. **Pull-based consumption**: Read model populators and process managers poll the event store using a stored checkpoint (not push-based).
4. **At-least-once delivery**: All consumers must be idempotent.
5. **Schema evolution**: Backward-compatible only — new fields may be added to event payloads; existing fields must not be removed or changed (L2-002 Section 5.2).

### 2.2 Event Envelope

From architecture.md Section 6.2, the event envelope matches the `events` table schema:

```json
{
  "event_id": "UUID",
  "event_type": "DOMAIN.ACTION",
  "timestamp": "ISO 8601",
  "correlation_id": "Request correlation ID",
  "source_service": "Emitting service name",
  "payload": {}
}
```

The `aggregate_id`, `aggregate_type`, and `sequence_number` are stored as table columns but are not part of the serialised event envelope — they are the addressing/routing layer.

### 2.3 Audit Integration

From audit.md Section 5.1: "Audit events are stored as append-only rows in the same PostgreSQL event store used by the CQRS/Event Sourcing infrastructure."

This means the `events` table serves as both:
- The domain event store (for CQRS read model projection)
- The audit event store (for compliance and investigation)

Audit events use the same schema but have `event_type` values from the audit event categories (audit.md Section 4.1): `auth.*`, `authz.*`, `mutation.*`, `access.*`, `config.*`, `admin.*`, `financial.*`, `kyc.*`, `system.*`.

### 2.4 Indexing Strategy

The indexes on the events table serve different access patterns:

| Index | Access Pattern | Consumer |
|-------|---------------|----------|
| PK `(aggregate_id, sequence_number)` | Load all events for an aggregate in order | Command handlers (event sourcing reconstitution) |
| `idx_events_event_type` | Filter by event type | Read model populators, anomaly detection |
| `idx_events_timestamp` | Time-range queries | Audit query service, retention enforcement, hot/cold tier transition |
| `idx_events_correlation_id` | Trace reconstruction | Audit query service (audit.md Section 10.1) |

**Potential future indexes** (not for initial migration):
- `idx_events_aggregate_type` — if populators need to consume all events for a given aggregate type
- GIN index on `payload` — if JSONB field queries become a common access pattern

---

## 3. CQRS Patterns — Event Store and Aggregate Tables

### 3.1 Dual-Model Architecture

The database has two classes of tables:

1. **Event store** (`events`): The authoritative source of truth. All state changes are recorded as events.
2. **Aggregate/read model tables** (`accounts`, `campaigns`, `milestones`, `contributions`, `escrow_ledger`, `kyc_verifications`): Materialised projections of the event stream, optimised for queries.

### 3.2 Write Path

1. Command arrives at application service.
2. Application service loads current aggregate state from the aggregate table (or reconstitutes from events).
3. Domain logic validates the command and produces event(s).
4. Event(s) are appended to the `events` table.
5. Aggregate table is updated in the same transaction (transactional outbox pattern within a single database).

### 3.3 Read Path

1. Query arrives at the API layer.
2. Query is served directly from the aggregate/read model tables (not from the event store).
3. Read models are kept in sync by the write path (same-transaction update) or by asynchronous populators.

### 3.4 Consistency Model

For the local demo (single database, single deployment unit), the aggregate tables are updated in the same transaction as the event insert. This provides strong consistency between the event store and the read models.

In production, asynchronous populators may be used for cross-service read models, providing eventual consistency.

---

## 4. Escrow Ledger Design

### 4.1 Append-Only Invariant

The escrow ledger is a financial audit trail. It must be append-only and immutable (payments.md Section 6.2, engineering standard Section 1.7).

**Enforcement strategies**:
1. Application-layer: repository methods only expose `insert`, never `update` or `delete`.
2. Database-layer: a BEFORE UPDATE/DELETE trigger that raises an exception provides defence in depth.
3. The table intentionally has no `updated_at` column — signalling that updates do not occur.

### 4.2 Entry Types

From payments.md Section 6.2:

| Entry Type | Sign Convention | Description |
|------------|----------------|-------------|
| `contribution` | Positive | Funds entering escrow from a donor contribution |
| `disbursement` | Negative | Funds released to campaign creator (milestone-based) |
| `refund` | Negative | Funds returned to donors (campaign failure/cancellation) |
| `interest_credit` | Positive | Interest accrued on escrowed funds |
| `interest_debit` | Negative | Interest paid out (with disbursement or refund) |

### 4.3 Balance Calculation

The current escrow balance for a campaign is:

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

Alternatively, store `amount_cents` with the appropriate sign (positive for inflows, negative for outflows) and sum directly. The feat-002 brief specifies `amount_cents BIGINT NOT NULL` without sign guidance — the implementation should choose one convention and document it.

**Recommendation**: Store `amount_cents` as always-positive and use the `entry_type` to determine sign in queries. This prevents negative amounts from being ambiguous and makes the ledger entries more readable.

### 4.4 Audit Requirements

From payments.md Section 13.4: All payment state mutations emit audit events including: event type, correlation ID, actor ID, timestamp, contribution/disbursement/refund ID, amount, currency, old state, new state, and gateway reference ID.

Every escrow ledger insert should also produce a `financial` event in the events table for the audit trail.

---

## 5. PostgreSQL Specifics

### 5.1 UUID Generation

Use `gen_random_uuid()` (built-in since PostgreSQL 13, no extension required). This replaces the older `uuid_generate_v4()` from the `uuid-ossp` extension.

All primary keys use `UUID DEFAULT gen_random_uuid()`.

### 5.2 JSONB for Event Payloads

The `events.payload` column uses `JSONB` (not `JSON`) because:
- JSONB supports indexing (GIN indexes for containment queries).
- JSONB is stored in a decomposed binary format, faster for read queries.
- JSONB removes duplicate keys and does not preserve key order (acceptable for event payloads).
- JSONB supports the `@>`, `?`, and `?|` operators for querying nested fields.

### 5.3 Array Type for Roles

The `accounts.roles` column uses `TEXT[]` (PostgreSQL array type) because:
- The role set is small and fixed (5 roles).
- Avoids a join table for a simple many-to-many-like relationship.
- Supports `@>` containment operator for role checks: `WHERE roles @> '{creator}'`.
- Supports GIN indexing if role-based queries become a bottleneck.

### 5.4 CHECK Constraints

CHECK constraints are used for:
- Status columns: enumerate valid values as an in-list.
- Monetary amounts: enforce positivity (`amount_cents > 0`).
- Business rules: `max_funding_cap_cents >= min_funding_target_cents`.
- Percentage bounds: `funding_percentage >= 0 AND funding_percentage <= 100`.

**Why not ENUMs?** PostgreSQL ENUM types are awkward to modify (adding values requires `ALTER TYPE ... ADD VALUE` which cannot be transactional in older versions). TEXT with CHECK constraints is more flexible for evolution and easier to manage in migrations.

### 5.5 TIMESTAMPTZ Convention

All date/time columns use `TIMESTAMPTZ` (timestamp with time zone), never `TIMESTAMP` (without timezone). This is mandated by:
- The feat-002 brief acceptance criteria.
- The infra.md rules: "Date columns: `TIMESTAMPTZ` — never TIMESTAMP without timezone."
- backend.md rules (implicit in monetary/date handling).

PostgreSQL stores `TIMESTAMPTZ` internally as UTC. The timezone is used for input conversion only.

### 5.6 `updated_at` Trigger

A reusable trigger function updates the `updated_at` column automatically:

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

Applied to every table that has an `updated_at` column:
- `accounts`
- `campaigns`
- `milestones`
- `contributions`
- `kyc_verifications`

NOT applied to:
- `events` (no `updated_at` — immutable)
- `escrow_ledger` (no `updated_at` — append-only)

---

## 6. Migration Ordering

### 6.1 Dependency Graph

```
Migration 1: Create trigger function (no table dependencies)
Migration 2: Create events table (no table dependencies)
Migration 3: Create accounts table (depends on trigger function)
Migration 4: Create campaigns table (depends on accounts, trigger function)
Migration 5: Create milestones table (depends on campaigns, trigger function)
Migration 6: Create contributions table (depends on accounts, campaigns, trigger function)
Migration 7: Create escrow_ledger table (depends on campaigns)
Migration 8: Create kyc_verifications table (depends on accounts, trigger function)
```

### 6.2 Rationale

1. **Trigger function first**: All subsequent tables with `updated_at` need this function.
2. **Events table early**: No FK dependencies; foundational for the CQRS pattern.
3. **Accounts before campaigns**: `campaigns.creator_id` references `accounts(id)`.
4. **Campaigns before milestones**: `milestones.campaign_id` references `campaigns(id)`.
5. **Accounts + campaigns before contributions**: Both FKs must exist.
6. **Campaigns before escrow_ledger**: `escrow_ledger.campaign_id` references `campaigns(id)`.
7. **Accounts before kyc_verifications**: `kyc_verifications.account_id` references `accounts(id)`.

### 6.3 Alternative: Single Migration

All tables could be created in a single migration file with proper ordering within the SQL. This simplifies the migration count but makes individual rollback harder. The feat-002 brief mentions separate migrations per table. Given that these are all foundational tables created together, either approach works. The multi-migration approach is recommended because:
- Each migration has a focused rollback.
- It follows the "one concern per migration" principle.
- It makes CI failures easier to debug.

### 6.4 Migration File Names

Following dbmate's timestamp format (`YYYYMMDDHHMMSS_description.sql`):

```
20260304000001_create_updated_at_trigger.sql
20260304000002_create_event_store.sql
20260304000003_create_accounts.sql
20260304000004_create_campaigns.sql
20260304000005_create_milestones.sql
20260304000006_create_contributions.sql
20260304000007_create_escrow_ledger.sql
20260304000008_create_kyc_verifications.sql
```

---

## 7. Edge Cases

### 7.1 Concurrency

1. **Duplicate event sequence numbers**: Two concurrent commands targeting the same aggregate could attempt to insert events with the same `(aggregate_id, sequence_number)`. The composite PK prevents this — the second insert fails with a unique violation. The application must handle this with optimistic concurrency (retry with fresh state).

2. **Concurrent contribution and campaign state change**: A contribution could be submitted at the exact moment a campaign transitions to `failed` or `suspended`. The application must check campaign status within the same transaction as the contribution insert, or use a SELECT FOR UPDATE on the campaign row.

3. **Race on funding target reached**: Multiple contributions could push a campaign past its minimum funding target simultaneously. Only one should trigger the `funded` state transition. Use a serialisable transaction or advisory lock to gate the status transition check.

4. **Concurrent escrow balance reads during disbursement**: A disbursement calculates the pro-rata amount based on the current balance while a refund is also being processed. Use row-level locking or serialise financial operations per campaign.

### 7.2 Foreign Key Violations

5. **Deleting an account with contributions**: `ON DELETE RESTRICT` on `contributions.donor_id` prevents this. The application must enforce the account deactivation lifecycle (account.md Section 7.1) rather than allowing direct deletion.

6. **Deleting a campaign with escrow entries**: `ON DELETE RESTRICT` on `escrow_ledger.campaign_id` prevents this. Campaigns with financial history cannot be deleted — they transition to terminal states.

7. **Creating a contribution for a non-existent campaign**: The FK constraint catches this at the database level. The application should also validate campaign existence and status before attempting the insert.

### 7.3 Migration Rollback

8. **Rollback with existing data**: If the `accounts` table rollback (`DROP TABLE accounts`) is run when `campaigns` has rows referencing accounts, the rollback will fail due to FK constraints. Rollback order must be the reverse of creation order. The `-- migrate:down` sections must drop tables in reverse dependency order.

9. **Partial migration failure**: If migration 5 (milestones) fails mid-execution, the transaction wrapping (`BEGIN; ... COMMIT;`) ensures either all DDL succeeds or none does. PostgreSQL supports transactional DDL, unlike MySQL.

10. **Re-running migrations**: dbmate tracks applied migrations in `schema_migrations` table. Re-running `dbmate up` is safe — already-applied migrations are skipped.

### 7.4 Null Handling

11. **Nullable `deadline` on campaigns**: The deadline is null while the campaign is in draft state. Application code must handle null deadlines gracefully. Deadline enforcement queries must filter for `deadline IS NOT NULL`.

12. **Nullable `gateway_reference` on contributions**: Set only after the payment gateway responds. Code querying contributions must not assume this is populated — contributions in `pending_capture` state will have a null reference.

13. **Nullable monetary fields on milestones**: `funding_percentage` is nullable (milestones can exist in draft state without percentage allocation). The application-layer validation that percentages sum to 100% must handle partial/null allocations during draft editing.

### 7.5 Data Integrity

14. **Escrow balance going negative**: There is no database-level constraint preventing the computed escrow balance from going negative (since balance is derived from SUM, not a stored column). The application must validate that disbursement or refund amounts do not exceed the current balance before inserting ledger entries.

15. **Sequence number gaps in event store**: If a transaction inserts an event and then rolls back, the sequence number is "consumed" but not present. The PK constraint ensures uniqueness but not gaplessness. Application code should generate sequence numbers from `MAX(sequence_number) + 1` within a serialisable transaction or use `SELECT FOR UPDATE` on the aggregate.

16. **Status transition validity**: The database CHECK constraint validates that a status value is one of the allowed values, but it does NOT enforce valid transitions (e.g., it cannot prevent `draft` -> `live` skipping `submitted`). Transition validation must be enforced at the application/domain layer.

17. **Monetary overflow**: `BIGINT` can hold up to 9,223,372,036,854,775,807 cents (~$92 quadrillion). Overflow is not a practical concern, but application code should still validate that amounts are within business-meaningful bounds (campaign.md: min $1M = 100,000,000 cents, max $1B = 100,000,000,000 cents).

18. **Time zone edge cases**: `TIMESTAMPTZ` stores UTC internally, but application code must ensure all timestamps are sent as UTC or with explicit timezone offsets. A `NOW()` default uses the database server's clock — ensure NTP synchronization.

19. **JSONB payload size**: There is no database-level size constraint on the `payload` column. Extremely large payloads could impact query performance and storage. Consider an application-level size limit (e.g., 64KB per event payload).

20. **Array role validation**: The `TEXT[]` type for roles does not prevent invalid role names at the database level. The CHECK constraint for array contents is non-trivial in PostgreSQL. Validation must be enforced at the application layer or via a custom CHECK using `array_position`.

---

## 8. Spec Gaps and Ambiguities

### 8.1 Resolved by Feature Brief

- **Event store PK**: The feature brief explicitly specifies `(aggregate_id, sequence_number)` as the primary key, resolving the question of whether `event_id` should be the PK.
- **Escrow ledger append-only**: Explicitly confirmed — no `updated_at` column.
- **Single database**: Confirmed for local demo — logical separation per service, not separate databases.

### 8.2 Ambiguities to Address During Implementation

1. **`amount_cents` sign convention in escrow_ledger**: The brief specifies `amount_cents BIGINT NOT NULL` without clarifying whether values should always be positive (with sign determined by `entry_type`) or can be negative. Recommendation: always positive, with sign derived from entry type.

2. **`event_id` uniqueness**: The brief lists `event_id UUID` but does not specify a UNIQUE constraint. Since the PK is `(aggregate_id, sequence_number)`, `event_id` needs a separate UNIQUE constraint for global uniqueness (used for deduplication and cross-referencing).

3. **Disbursement tracking**: The `escrow_ledger` has a `disbursement_id` column, but there is no `disbursements` table in the feat-002 scope. Disbursement records may be tracked purely as events in the event store, or a `disbursements` table may be needed in a future feature. For now, `disbursement_id` is a UUID reference without a FK constraint.

4. **`contribution_id` in escrow_ledger**: Should this be a FK to `contributions(id)` or a loose UUID reference? The brief does not specify a FK. Recommendation: add a FK to `contributions(id)` with `ON DELETE RESTRICT` for data integrity, since contribution entries always correspond to an existing contribution.

---

## 9. Cross-Reference: Spec Alignment Matrix

| Table | Primary Spec | Supporting Specs | Key Constraints Source |
|-------|-------------|------------------|----------------------|
| `events` | architecture.md 6.2 | audit.md 3, 5.1 | Append-only, JSONB payload, correlation ID |
| `accounts` | account.md 1.3, 3 | — | Status enum, roles array, Clerk integration |
| `campaigns` | campaign.md 3.1, 4.2 | payments.md 6 | Status enum, funding amounts, categories |
| `milestones` | campaign.md 8.1 | — | Status enum, funding percentage |
| `contributions` | payments.md 5.3 | donor.md 6, 7 | Status enum, amount positive, FKs |
| `escrow_ledger` | payments.md 6.2 | engineering 1.7 | Append-only, entry types |
| `kyc_verifications` | kyc.md 6.1 | data-management.md 1.1 | 9-state lifecycle, failure count |

---

## 10. Implementation Checklist

From the feat-002 acceptance criteria, verified against specs:

- [ ] `updated_at` trigger function — reusable across all mutable tables
- [ ] `events` table with composite PK, JSONB payload, proper indexes
- [ ] `accounts` table with Clerk integration, roles array, status CHECK
- [ ] `campaigns` table with funding constraints, category CHECK, FK to accounts
- [ ] `milestones` table with FK CASCADE to campaigns, status CHECK
- [ ] `contributions` table with amount > 0, FKs to accounts and campaigns
- [ ] `escrow_ledger` table — append-only (no `updated_at`), entry type CHECK
- [ ] `kyc_verifications` table with 9-state status CHECK, failure count
- [ ] All monetary columns: `BIGINT` (integer cents)
- [ ] All date columns: `TIMESTAMPTZ`
- [ ] Every FK column has an index
- [ ] All migrations have `-- migrate:up` and `-- migrate:down` wrapped in `BEGIN; ... COMMIT;`
- [ ] `dbmate up` runs clean; `dbmate down` rolls back clean
