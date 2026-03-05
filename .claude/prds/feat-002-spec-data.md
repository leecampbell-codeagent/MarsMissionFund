# PRD: feat-002 — Data Model & Domain Model

> Sub-file 2 of 4. Part of `feat-002-spec.md`.
> Contents: Database migrations, table definitions, domain entities, value objects, domain errors.

---

## Data Model

### Table Modifications

#### `users` — Rename `kyc_status` CHECK constraint value `'failed'` to `'rejected'`

Per gotcha G-018, the existing CHECK constraint uses `'failed'` but L4-005 calls this state "Rejected". This migration renames the value to align naming across all layers.

**Migration file:** `db/migrations/20260305140000_kyc_rename_failed_to_rejected.sql`

```sql
-- migrate:up
BEGIN;

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_kyc_status_check;

ALTER TABLE users
  ADD CONSTRAINT users_kyc_status_check
    CHECK (kyc_status IN (
      'not_started',
      'pending',
      'in_review',
      'verified',
      'rejected',
      'expired'
    ));

-- Migrate any existing 'failed' values to 'rejected'
UPDATE users SET kyc_status = 'rejected' WHERE kyc_status = 'failed';

COMMIT;

-- migrate:down
BEGIN;

UPDATE users SET kyc_status = 'failed' WHERE kyc_status = 'rejected';

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_kyc_status_check;

ALTER TABLE users
  ADD CONSTRAINT users_kyc_status_check
    CHECK (kyc_status IN (
      'not_started',
      'pending',
      'in_review',
      'verified',
      'failed',
      'expired'
    ));

COMMIT;
```

**Notes:**
- Timestamp `20260305140000` places this after the `users` table migration (`20260305130000`).
- The `UPDATE` in `migrate:up` handles any existing test data with `'failed'` status.
- The frontend `UserProfile.kycStatus` union type must also be updated from `'failed'` to `'rejected'` (see `feat-002-spec-ui.md`).

---

### New Tables

#### `kyc_audit_events`

Stores immutable audit records for all KYC status transitions. Audit events are append-only — no `UPDATE` or `DELETE` is ever performed on this table.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `UUID` | NOT NULL | `gen_random_uuid()` | Primary key |
| `user_id` | `UUID` | NULL | — | FK to `users.id`. `NULL` if the user row has been hard-deleted (GDPR erasure). ON DELETE SET NULL. |
| `actor_clerk_user_id` | `TEXT` | NOT NULL | — | Clerk user ID of the actor. For stub auto-approval, this is the user's own `clerk_user_id`. TEXT, not UUID (G-001). |
| `action` | `TEXT` | NOT NULL | — | Audit action code. Values: `'kyc.status.change'`. |
| `previous_status` | `TEXT` | NULL | `NULL` | KYC status before the transition. `NULL` only for the initial transition from `not_started` if not yet captured (in practice, always set). |
| `new_status` | `TEXT` | NOT NULL | — | KYC status after the transition. |
| `trigger_reason` | `TEXT` | NULL | `NULL` | Human-readable trigger reason. For stub: `'stub_auto_approve'`. |
| `metadata` | `JSONB` | NULL | `NULL` | Additional context. Reserved for future use (session IDs, provider references). |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | Event timestamp. Immutable. |

**No `updated_at` column** — audit events are immutable; they are never updated.

**Indexes:**

| Index Name | Column(s) | Reason |
|------------|-----------|--------|
| `idx_kyc_audit_events_user_id` | `user_id` | Lookup all events for a user |
| `idx_kyc_audit_events_created_at` | `created_at` | Time-range queries, compliance reporting |

**Constraints:**

| Constraint | Definition |
|------------|------------|
| `PRIMARY KEY` | `id` |
| `FOREIGN KEY` | `user_id` → `users(id)` ON DELETE SET NULL |
| `CHECK action` | `action IN ('kyc.status.change')` |
| `CHECK new_status` | `new_status IN ('not_started', 'pending', 'in_review', 'verified', 'rejected', 'expired')` |
| `CHECK previous_status` | `previous_status IS NULL OR previous_status IN ('not_started', 'pending', 'in_review', 'verified', 'rejected', 'expired')` |

**Migration file:** `db/migrations/20260305141000_create_kyc_audit_events_table.sql`

```sql
-- migrate:up
BEGIN;

CREATE TABLE IF NOT EXISTS kyc_audit_events (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID        REFERENCES users(id) ON DELETE SET NULL,
  actor_clerk_user_id  TEXT        NOT NULL,
  action               TEXT        NOT NULL
                                   CHECK (action IN ('kyc.status.change')),
  previous_status      TEXT
                                   CHECK (previous_status IS NULL OR previous_status IN (
                                     'not_started',
                                     'pending',
                                     'in_review',
                                     'verified',
                                     'rejected',
                                     'expired'
                                   )),
  new_status           TEXT        NOT NULL
                                   CHECK (new_status IN (
                                     'not_started',
                                     'pending',
                                     'in_review',
                                     'verified',
                                     'rejected',
                                     'expired'
                                   )),
  trigger_reason       TEXT,
  metadata             JSONB,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_kyc_audit_events_user_id   ON kyc_audit_events(user_id);
CREATE INDEX idx_kyc_audit_events_created_at ON kyc_audit_events(created_at);

COMMIT;

-- migrate:down
BEGIN;

DROP INDEX IF EXISTS idx_kyc_audit_events_created_at;
DROP INDEX IF EXISTS idx_kyc_audit_events_user_id;
DROP TABLE IF EXISTS kyc_audit_events;

COMMIT;
```

**Notes:**
- Timestamp `20260305141000` places this after the `kyc_rename_failed_to_rejected` migration.
- `user_id` is nullable (`REFERENCES users(id) ON DELETE SET NULL`) to preserve audit records after GDPR erasure per G-010.
- No `updated_at` trigger — audit events are immutable.
- `actor_clerk_user_id` is TEXT (not UUID) per G-001.

---

## Domain Model

**New bounded context directory:** `packages/backend/src/kyc/`

```
packages/backend/src/kyc/
  domain/
    errors/
      kyc-errors.ts
  ports/
    kyc-provider.port.ts
    kyc-audit-repository.port.ts
  adapters/
    stub-kyc-provider.adapter.ts
    pg-kyc-audit-repository.adapter.ts
    in-memory-kyc-audit-repository.adapter.ts   (test only)
  application/
    kyc-app-service.ts
  api/
    kyc-router.ts
    schemas/
      kyc-submit.schema.ts
```

**Account bounded context modifications** (minimal, additive only):

```
packages/backend/src/account/
  domain/
    value-objects/
      kyc-status.ts          ← UPDATE: rename 'failed' to 'rejected', add 'rejected' key
  ports/
    user-repository.port.ts  ← ADD: updateKycStatus() method
    audit-logger.port.ts     ← UPDATE: resourceType union, AuditActions
  adapters/
    pg-user-repository.adapter.ts           ← ADD: updateKycStatus() implementation
    in-memory-user-repository.adapter.ts    ← ADD: updateKycStatus() implementation
```

---

### Modifications to Existing Value Objects

#### `KycStatus` (modified)

**File:** `packages/backend/src/account/domain/value-objects/kyc-status.ts`

**Change:** Rename `Failed: 'failed'` to `Rejected: 'rejected'`. Add `Rejected` as a valid resubmission-from state.

```typescript
export const KycStatus = {
  NotStarted: 'not_started',
  Pending:    'pending',
  InReview:   'in_review',
  Verified:   'verified',
  Rejected:   'rejected',  // was 'Failed: failed' — renamed per G-018
  Expired:    'expired',
} as const;

export type KycStatus = (typeof KycStatus)[keyof typeof KycStatus];
```

**Note on `in_review`:** This value is reserved for the real Veriff integration. The stub never transitions to `in_review`. Do not write tests exercising `in_review` in feat-002 (G-022).

**Valid stub state machine transitions:**

| From | To | Trigger |
|------|----|---------|
| `not_started` | `pending` | `POST /kyc/submit` (application service step 1) |
| `pending` | `verified` | Stub adapter auto-approves (application service step 2) |
| `rejected` | `pending` | `POST /kyc/submit` resubmission |

**Invalid transitions (return 409):**

| From | Attempted To | Error Code |
|------|-------------|------------|
| `pending` | `pending` | `KYC_ALREADY_PENDING` |
| `verified` | `pending` | `KYC_ALREADY_VERIFIED` |
| `expired` | `pending` | `KYC_RESUBMISSION_NOT_ALLOWED` |

---

### Modifications to Existing Port Interfaces

#### `AuditLoggerPort` (modified)

**File:** `packages/backend/src/account/ports/audit-logger.port.ts`

**Changes:**
1. Expand `resourceType` from `'user'` to `'user' | 'kyc'` (G-021).
2. Add `KycStatusChange` to `AuditActions`.

```typescript
export const AuditActions = {
  // existing account actions
  ProfileUpdated:        'profile.updated',
  NotificationsUpdated:  'notifications.updated',
  RoleAssigned:          'role.assigned',
  RoleRemoved:           'role.removed',
  AccountActivated:      'account.activated',
  AccountSuspended:      'account.suspended',
  UserSynced:            'user.synced',
  // new KYC actions
  KycStatusChange:       'kyc.status.change',
} as const;

export type AuditAction = (typeof AuditActions)[keyof typeof AuditActions];

export interface AuditEntry {
  readonly timestamp: Date;
  readonly actorClerkUserId: string;
  readonly action: AuditAction;
  readonly resourceType: 'user' | 'kyc';   // expanded from 'user' only
  readonly resourceId: string;              // MMF users.id (UUID) for 'user'; MMF users.id for 'kyc'
  readonly metadata?: Record<string, unknown>;
}
```

**No other changes to the `AuditLoggerPort` interface or `PinoAuditLoggerAdapter`.**

---

### New Domain Errors

**File:** `packages/backend/src/kyc/domain/errors/kyc-errors.ts`

All errors extend `DomainError` per pattern P-003:

```typescript
import { DomainError } from '../../../shared/domain/errors';

export class KycAlreadyPendingError extends DomainError {
  readonly code = 'KYC_ALREADY_PENDING';
  constructor() {
    super('KYC_ALREADY_PENDING', 'Your identity verification is already in progress.');
  }
}

export class KycAlreadyVerifiedError extends DomainError {
  readonly code = 'KYC_ALREADY_VERIFIED';
  constructor() {
    super('KYC_ALREADY_VERIFIED', 'Your identity has already been verified.');
  }
}

export class KycResubmissionNotAllowedError extends DomainError {
  readonly code = 'KYC_RESUBMISSION_NOT_ALLOWED';
  constructor() {
    super('KYC_RESUBMISSION_NOT_ALLOWED', 'Resubmission is not available for your current verification status.');
  }
}

export class KycAccountNotActiveError extends DomainError {
  readonly code = 'ACCOUNT_NOT_ACTIVE';
  constructor() {
    super('ACCOUNT_NOT_ACTIVE', 'Your account must be active before you can complete identity verification. Please verify your email first.');
  }
}

export class KycAccountSuspendedError extends DomainError {
  readonly code = 'ACCOUNT_SUSPENDED';
  constructor() {
    super('ACCOUNT_SUSPENDED', 'Your account has been suspended. Identity verification is unavailable.');
  }
}

export class KycTransitionConflictError extends DomainError {
  readonly code = 'KYC_TRANSITION_CONFLICT';
  constructor() {
    super('KYC_TRANSITION_CONFLICT', 'Your verification status changed while processing. Please refresh and try again.');
  }
}
```

**Error → HTTP status mapping:**

| Error Class | `code` | HTTP Status | Scenario |
|-------------|--------|-------------|---------|
| `KycAlreadyPendingError` | `KYC_ALREADY_PENDING` | 409 | Submit while already pending |
| `KycAlreadyVerifiedError` | `KYC_ALREADY_VERIFIED` | 409 | Submit while already verified |
| `KycResubmissionNotAllowedError` | `KYC_RESUBMISSION_NOT_ALLOWED` | 409 | Submit from `expired` status |
| `KycAccountNotActiveError` | `ACCOUNT_NOT_ACTIVE` | 403 | Account is `pending_verification` |
| `KycAccountSuspendedError` | `ACCOUNT_SUSPENDED` | 403 | Account is `suspended` or `deactivated` |
| `KycTransitionConflictError` | `KYC_TRANSITION_CONFLICT` | 409 | Conditional WHERE update returned 0 rows (concurrent request won the race, G-020) |
| `UserNotFoundError` (existing) | `USER_NOT_FOUND` | 404 | User record not found |
