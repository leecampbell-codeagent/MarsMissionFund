# feat-002: Database Schema Foundation --- Validation Report

> **Validator**: Spec Validator
> **Date**: 2026-03-04
> **Feature**: feat-002-database-schema-foundation
> **Documents Reviewed**:
> - `.claude/prds/feat-002-spec.md` (implementation spec)
> - `.claude/prds/feat-002-research.md` (research document)
> - `.claude/prds/feat-002-database-schema-foundation.md` (original brief)
> **Design Spec**: N/A (database-only feature)
> **Result**: **PASS**

---

## 1. Automatic FAIL Trigger Checklist

| Trigger | Status | Evidence |
|---------|--------|----------|
| FLOAT/DOUBLE for monetary columns | PASS | All monetary columns use `BIGINT` --- `min_funding_target_cents`, `max_funding_cap_cents`, `amount_cents` across contributions and escrow_ledger. Spec Section 2.2 explicitly states "Never FLOAT, DOUBLE, REAL, or NUMERIC." |
| Missing ON DELETE on FKs | PASS | Every FK specifies ON DELETE behaviour: `campaigns.creator_id` ON DELETE RESTRICT, `milestones.campaign_id` ON DELETE CASCADE, `contributions.donor_id` ON DELETE RESTRICT, `contributions.campaign_id` ON DELETE RESTRICT, `escrow_ledger.campaign_id` ON DELETE RESTRICT, `kyc_verifications.account_id` ON DELETE RESTRICT. |
| Missing indexes on FK columns | PASS | Every FK column has a named index: `idx_campaigns_creator_id`, `idx_milestones_campaign_id`, `idx_contributions_donor_id`, `idx_contributions_campaign_id`, `idx_escrow_ledger_campaign_id`, `idx_kyc_verifications_account_id`. Index existence tests listed in spec Section 6.6. |
| TIMESTAMP without timezone | PASS | All date/time columns use `TIMESTAMPTZ`. Spec Section 2.3 explicitly states "Never TIMESTAMP without timezone." Verified in all 8 migration files. |
| Edge case from research with no defined behaviour | PASS | All 20 edge cases from research document Section 7 are addressed in spec Section 4 (EC-1 through EC-20) with defined behaviour for each. |

**No automatic FAIL triggers detected.**

---

## 2. Completeness

### 2.1 Table Coverage

Every table from the brief is present in the spec with a full migration file:

| Brief Requirement | Spec Migration | Migration # |
|-------------------|---------------|-------------|
| `updated_at` trigger function | `20260304000001_create_updated_at_trigger.sql` | 1 |
| `events` table | `20260304000002_create_event_store.sql` | 2 |
| `accounts` table | `20260304000003_create_accounts.sql` | 3 |
| `campaigns` table | `20260304000004_create_campaigns.sql` | 4 |
| `milestones` table | `20260304000005_create_milestones.sql` | 5 |
| `contributions` table | `20260304000006_create_contributions.sql` | 6 |
| `escrow_ledger` table | `20260304000007_create_escrow_ledger.sql` | 7 |
| `kyc_verifications` table | `20260304000008_create_kyc_verifications.sql` | 8 |

### 2.2 Column Coverage

Each table's columns, types, constraints, and defaults were cross-referenced against the brief's acceptance criteria. All columns specified in the brief are present in the spec migrations. No columns are missing.

| Table | Columns in Brief | Columns in Spec | Match |
|-------|-----------------|-----------------|-------|
| `events` | 9 | 9 + UNIQUE on event_id | Yes (UNIQUE is an improvement) |
| `accounts` | 9 | 9 | Yes |
| `campaigns` | 11 | 11 | Yes |
| `milestones` | 9 | 9 | Yes |
| `contributions` | 7 | 7 | Yes |
| `escrow_ledger` | 7 | 7 | Yes |
| `kyc_verifications` | 9 | 9 | Yes |

### 2.3 Acceptance Criteria Coverage

Every acceptance criterion from the brief is addressed:

- [x] Event store with composite PK `(aggregate_id, sequence_number)` --- spec Section 3.3
- [x] All monetary columns `BIGINT` --- verified in all migration SQL
- [x] All date columns `TIMESTAMPTZ` --- verified in all migration SQL
- [x] Every FK column has an index --- spec Section 6.6 lists all 6 FK indexes
- [x] Reusable `updated_at` trigger --- spec Section 3.2, applied to 5 tables
- [x] CHECK constraints on status columns --- all 7 status columns have CHECK constraints
- [x] CHECK: `min_funding_target_cents > 0` --- spec Section 3.5
- [x] CHECK: `max_funding_cap_cents >= min_funding_target_cents` --- spec Section 3.5
- [x] CHECK: `amount_cents > 0` on contributions --- spec Section 3.7
- [x] `-- migrate:up` and `-- migrate:down` sections wrapped in `BEGIN; ... COMMIT;` --- verified in all 8 migrations
- [x] `dbmate up` / `dbmate down` lifecycle tested --- spec Sections 6.1 and 6.2

---

## 3. Architecture Compliance

### 3.1 Monetary Values

| Rule | Compliance |
|------|-----------|
| BIGINT for money (infra.md, backend.md) | PASS --- all monetary columns are `BIGINT` |
| Integer cents, never floating point | PASS --- spec Section 2.2 explicitly documents this |
| JSON serialisation as strings (backend.md) | N/A --- no API layer in this feature |

### 3.2 Date/Time Values

| Rule | Compliance |
|------|-----------|
| TIMESTAMPTZ, never TIMESTAMP (infra.md) | PASS --- all 8 migrations use `TIMESTAMPTZ` exclusively |
| `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` on all tables (infra.md) | PASS --- present on all 7 tables |
| `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` on mutable tables (infra.md) | PASS --- present on 5 mutable tables; correctly absent from `events` and `escrow_ledger` |

### 3.3 Indexes

| Rule | Compliance |
|------|-----------|
| Index on every FK column (infra.md, backend.md) | PASS --- 6 FK columns, 6 indexes |
| Index on columns used in WHERE/ORDER BY (infra.md) | PASS --- status, category, deadline, expires_at, event_type, timestamp, correlation_id all indexed |

### 3.4 Constraints

| Rule | Compliance |
|------|-----------|
| Explicit ON DELETE on every FK (infra.md) | PASS --- all 6 FKs have explicit ON DELETE |
| CHECK constraints for domain invariants (infra.md) | PASS --- status enums, funding amounts, percentages, failure count |
| `updated_at` auto-update trigger (infra.md) | PASS --- trigger function in migration 1, applied to all 5 mutable tables |

### 3.5 Migration Format

| Rule | Compliance |
|------|-----------|
| Managed by dbmate (infra.md) | PASS --- all migrations use dbmate format |
| Files in `db/migrations/` (infra.md) | PASS --- spec Section 8 lists paths under `db/migrations/` |
| Timestamp naming `YYYYMMDDHHMMSS_description.sql` (infra.md) | PASS --- e.g., `20260304000001_create_updated_at_trigger.sql` |
| `-- migrate:up` and `-- migrate:down` sections (infra.md) | PASS --- all 8 migrations |
| Wrapped in `BEGIN; ... COMMIT;` (infra.md) | PASS --- all 16 sections (8 up + 8 down) |
| Append-only migrations (infra.md) | PASS --- no existing migrations to modify |
| `CREATE TABLE IF NOT EXISTS` where possible (infra.md) | NOTE --- spec uses `CREATE TABLE` without `IF NOT EXISTS`. This is acceptable because dbmate tracks applied migrations and prevents re-application. The `IF NOT EXISTS` rule is a guideline, not a hard requirement, and `CREATE TABLE` is safer for detecting unexpected state. |

---

## 4. Financial Data Rules

### 4.1 Escrow Ledger

| Rule | Compliance |
|------|-----------|
| Append-only (payments.md 6.2, engineering standard 1.7) | PASS --- no `updated_at` column; BEFORE UPDATE/DELETE trigger raises exception |
| Monetary columns are BIGINT | PASS --- `amount_cents BIGINT NOT NULL` |
| Entry types match payments.md | PASS --- `('contribution', 'disbursement', 'refund', 'interest_credit', 'interest_debit')` matches payments.md Section 6.2 |
| Per-campaign segregation | PASS --- `campaign_id` FK with index; balance computed per campaign |
| Sign convention documented | PASS --- spec Section 2.6 documents the balance calculation query with sign per entry_type |

### 4.2 Events Table

| Rule | Compliance |
|------|-----------|
| Append-only (architecture.md 6.2) | PASS --- no `updated_at`; immutability trigger prevents UPDATE/DELETE |
| Composite PK `(aggregate_id, sequence_number)` | PASS |
| JSONB for payload | PASS |
| Correlation ID column | PASS --- `correlation_id UUID NOT NULL` with index |

---

## 5. Scope

### 5.1 No Extra Tables

The spec includes exactly the tables listed in the brief: `events`, `accounts`, `campaigns`, `milestones`, `contributions`, `escrow_ledger`, `kyc_verifications`, plus the `updated_at` trigger function. No additional tables are introduced.

### 5.2 Out of Scope Items Match

The spec's out-of-scope section (Section 7) aligns with the brief's out-of-scope items:
- Read model / materialised views --- deferred
- Seed data --- deferred
- Notification tables --- deferred
- Disbursements table --- correctly deferred; `disbursement_id` is a loose UUID
- `previous_hash` tamper detection --- correctly deferred (theatre for local demo)
- Row-level security policies --- deferred to application layer

---

## 6. Testability

| Aspect | Assessment |
|--------|-----------|
| Migration apply test | PASS --- spec Section 6.1 defines a clean `dbmate up` test |
| Migration rollback test | PASS --- spec Section 6.2 defines a full rollback test |
| Constraint verification | PASS --- spec Section 6.3 lists 13 specific SQL tests for CHECK constraints and triggers |
| FK integrity tests | PASS --- spec Section 6.4 lists 6 referential integrity tests |
| Trigger verification | PASS --- spec Section 6.5 lists 5 `updated_at` trigger tests |
| Index existence tests | PASS --- spec Section 6.6 lists all 17 expected indexes with a `pg_indexes` query approach |

The testing section is thorough and covers all constraint types. Tests can be automated as part of CI by running `dbmate up`, executing the test SQL, and then running `dbmate down`.

---

## 7. Consistency with Domain Specs

### 7.1 Account States (account.md Section 1.3)

| Domain Spec States | Spec CHECK Constraint | Match |
|-------------------|----------------------|-------|
| Pending Verification, Active, Suspended, Deactivated, Deleted | `'pending_verification', 'active', 'suspended', 'deactivated', 'deleted'` | PASS |

### 7.2 Campaign States (campaign.md Section 3.1)

| Domain Spec States | Spec CHECK Constraint | Match |
|-------------------|----------------------|-------|
| Draft, Submitted, Under Review, Approved, Rejected, Live, Funded, Suspended, Failed, Settlement, Complete, Cancelled (12 states) | `'draft', 'submitted', 'under_review', 'approved', 'rejected', 'live', 'funded', 'suspended', 'failed', 'settlement', 'complete', 'cancelled'` (12 states) | PASS |

### 7.3 Campaign Categories (campaign.md Section 4.4)

| Domain Spec Categories | Spec CHECK Constraint | Match |
|------------------------|----------------------|-------|
| 10 categories from campaign taxonomy | `'propulsion', 'entry_descent_landing', 'power_energy', 'habitats_construction', 'life_support_crew_health', 'food_water_production', 'isru', 'radiation_protection', 'robotics_automation', 'communications_navigation'` (10 categories) | PASS |

### 7.4 Milestone States (campaign.md Section 8.3)

| Domain Spec States | Spec CHECK Constraint | Match |
|-------------------|----------------------|-------|
| Pending, Verified, Returned | `'pending', 'verified', 'returned'` | PASS |

### 7.5 Contribution States (payments.md Section 5.3)

| Domain Spec States | Spec CHECK Constraint | Match |
|-------------------|----------------------|-------|
| pending_capture, captured, failed, refunded, partially_refunded | `'pending_capture', 'captured', 'failed', 'refunded', 'partially_refunded'` | PASS |

### 7.6 Escrow Entry Types (payments.md Section 6.2)

| Domain Spec Entry Types | Spec CHECK Constraint | Match |
|------------------------|----------------------|-------|
| contribution, disbursement, refund, interest_credit, interest_debit | `'contribution', 'disbursement', 'refund', 'interest_credit', 'interest_debit'` | PASS |

### 7.7 KYC States (kyc.md Section 6.1)

| Domain Spec States | Spec CHECK Constraint | Match |
|-------------------|----------------------|-------|
| Not Verified, Pending, Pending Resubmission, In Manual Review, Verified, Expired, Re-verification Required, Rejected, Locked (9 states) | `'not_verified', 'pending', 'pending_resubmission', 'in_manual_review', 'verified', 'expired', 'reverification_required', 'rejected', 'locked'` (9 states) | PASS |

### 7.8 Event Store Schema (architecture.md Section 6.2)

| Architecture Spec | Spec Migration | Match |
|-------------------|---------------|-------|
| event_id UUID | `event_id UUID NOT NULL DEFAULT gen_random_uuid()` | PASS |
| event_type "DOMAIN.ACTION" | `event_type TEXT NOT NULL` | PASS |
| timestamp ISO 8601 | `timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()` | PASS |
| correlation_id | `correlation_id UUID NOT NULL` | PASS |
| source_service | `source_service TEXT NOT NULL` | PASS |
| payload {} | `payload JSONB NOT NULL DEFAULT '{}'` | PASS |
| aggregate_id, aggregate_type, sequence_number (addressing layer) | Present as table columns; PK on `(aggregate_id, sequence_number)` | PASS |

### 7.9 Audit Integration (audit.md Section 5.1)

| Audit Spec Requirement | Compliance |
|----------------------|-----------|
| Audit events stored in same PostgreSQL event store | PASS --- events table serves dual purpose (spec Section 5.5, research Section 2.3) |
| Append-only, immutable | PASS --- trigger enforcement |

---

## 8. Complexity Assessment

**Estimated Complexity**: M (Medium) --- aligns with the brief's assessment.

Rationale:
- 8 migration files with well-defined SQL
- No application code required
- No external service integration
- Clear dependency chain
- Straightforward testing approach (SQL assertions)
- The main complexity is getting all constraints, indexes, and triggers correct, which is addressed by the comprehensive spec

---

## 9. Observations (Non-Blocking)

### 9.1 `contribution_id` FK Decision

The spec (Section 5.3) intentionally does NOT add a FK from `escrow_ledger.contribution_id` to `contributions(id)`. The research document recommended adding one, but the spec provides sound rationale: consistency with `disbursement_id` (which has no target table yet) and the fact that not all entries have a contribution. This is a defensible design decision.

### 9.2 `event_id` UNIQUE Constraint

The spec adds a UNIQUE constraint on `event_id` that was not explicitly in the brief but was identified as needed in the research document (Section 8.2). This is a correct improvement for deduplication and cross-referencing.

### 9.3 Immutability Triggers

The spec adds BEFORE UPDATE/DELETE triggers on both `events` and `escrow_ledger` tables. These were not in the brief but were recommended in the research document (Section 4.1). This is a correct defence-in-depth measure aligned with the engineering standard and audit spec requirements.

### 9.4 `CREATE TABLE IF NOT EXISTS`

The infra.md rule suggests `CREATE TABLE IF NOT EXISTS where possible`. The spec uses `CREATE TABLE` without the conditional. This is acceptable and arguably safer --- dbmate's migration tracking prevents re-application, and bare `CREATE TABLE` will fail loudly if unexpected state exists, which is preferable for detecting problems.

---

## 10. Verdict

**PASS** --- The feat-002 spec package is complete, consistent with all governing specifications, compliant with all architecture and infrastructure rules, and has no automatic FAIL triggers. The spec is ready for implementation.

### Checklist Summary

| Validation Focus | Result |
|-----------------|--------|
| Completeness | PASS |
| Architecture Compliance | PASS |
| Financial Data Rules | PASS |
| Design System | N/A |
| Scope | PASS |
| Testability | PASS |
| Consistency | PASS |
| Complexity | M (confirmed) |
| Automatic FAIL Triggers | None detected |
