# PRD: feat-005 — Data Model, Domain, and Ports

> Sub-file 2 of 4. Read `feat-005-spec.md` first for overview and decisions.
> Read `feat-005-spec-api.md` for application service and API contracts.
> Read `feat-005-spec-ui.md` for frontend specification.

---

## 1. Database Migration

**File**: `db/migrations/20260305170000_feat005_contributions.sql`

The migration file name uses timestamp `20260305170000` — one increment after the last migration
`20260305160000_campaign_search_vector.sql`. Confirm by listing `db/migrations/` before writing.

```sql
-- migrate:up
BEGIN;

-- ─── 1. Add funding progress columns to campaigns ────────────────────────────
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS total_raised_cents BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS contributor_count  INTEGER NOT NULL DEFAULT 0;

-- CHECK constraint: cannot be negative
ALTER TABLE campaigns
  ADD CONSTRAINT campaigns_total_raised_cents_non_negative
    CHECK (total_raised_cents >= 0),
  ADD CONSTRAINT campaigns_contributor_count_non_negative
    CHECK (contributor_count >= 0);

-- ─── 2. contributions table ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contributions (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_user_id     UUID          NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  campaign_id       UUID          NOT NULL REFERENCES campaigns(id) ON DELETE RESTRICT,
  amount_cents      BIGINT        NOT NULL,
  payment_token     VARCHAR(500)  NOT NULL,
  status            VARCHAR(20)   NOT NULL DEFAULT 'pending_capture',
  transaction_ref   VARCHAR(500)  NULL,
  failure_reason    VARCHAR(500)  NULL,
  idempotency_key   VARCHAR(255)  NULL,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT contributions_amount_cents_positive
    CHECK (amount_cents > 0),
  CONSTRAINT contributions_status_values
    CHECK (status IN ('pending_capture', 'captured', 'failed')),
  CONSTRAINT contributions_idempotency_key_unique
    UNIQUE (idempotency_key)  -- partial unique index below handles NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_contributions_donor_user_id
  ON contributions (donor_user_id);
CREATE INDEX IF NOT EXISTS idx_contributions_campaign_id
  ON contributions (campaign_id);
-- Composite index to support duplicate-detection window query
CREATE INDEX IF NOT EXISTS idx_contributions_duplicate_check
  ON contributions (donor_user_id, campaign_id, amount_cents, created_at DESC)
  WHERE status != 'failed';

-- Auto-update trigger for updated_at
CREATE TRIGGER contributions_updated_at_trigger
  BEFORE UPDATE ON contributions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── 3. escrow_ledger table ──────────────────────────────────────────────────
-- Append-only — NO updated_at. Never DELETE or UPDATE rows.
CREATE TABLE IF NOT EXISTS escrow_ledger (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id           UUID          NOT NULL REFERENCES campaigns(id) ON DELETE RESTRICT,
  contribution_id       UUID          NOT NULL REFERENCES contributions(id) ON DELETE RESTRICT,
  entry_type            VARCHAR(20)   NOT NULL,
  amount_cents          BIGINT        NOT NULL,
  running_balance_cents BIGINT        NOT NULL,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT escrow_ledger_entry_type_values
    CHECK (entry_type IN ('credit')),    -- 'debit' added when feat-006 disbursements implemented
  CONSTRAINT escrow_ledger_amount_cents_positive
    CHECK (amount_cents > 0),
  CONSTRAINT escrow_ledger_running_balance_non_negative
    CHECK (running_balance_cents >= 0)
);

CREATE INDEX IF NOT EXISTS idx_escrow_ledger_campaign_id
  ON escrow_ledger (campaign_id);
CREATE INDEX IF NOT EXISTS idx_escrow_ledger_contribution_id
  ON escrow_ledger (contribution_id);

-- ─── 4. contribution_audit_events table ─────────────────────────────────────
-- Append-only — NO updated_at. Immutable audit trail.
CREATE TABLE IF NOT EXISTS contribution_audit_events (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  contribution_id  UUID         NOT NULL REFERENCES contributions(id) ON DELETE RESTRICT,
  campaign_id      UUID         NOT NULL REFERENCES campaigns(id) ON DELETE RESTRICT,
  donor_user_id    UUID         NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  previous_status  VARCHAR(20)  NULL,
  new_status       VARCHAR(20)  NOT NULL,
  amount_cents     BIGINT       NOT NULL,
  event_type       VARCHAR(50)  NOT NULL,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT contribution_audit_events_new_status_values
    CHECK (new_status IN ('pending_capture', 'captured', 'failed')),
  CONSTRAINT contribution_audit_events_event_type_values
    CHECK (event_type IN ('contribution.created', 'contribution.captured', 'contribution.failed'))
);

CREATE INDEX IF NOT EXISTS idx_contribution_audit_events_contribution_id
  ON contribution_audit_events (contribution_id);
CREATE INDEX IF NOT EXISTS idx_contribution_audit_events_campaign_id
  ON contribution_audit_events (campaign_id);
CREATE INDEX IF NOT EXISTS idx_contribution_audit_events_donor_user_id
  ON contribution_audit_events (donor_user_id);

COMMIT;

-- migrate:down
BEGIN;
DROP TABLE IF EXISTS contribution_audit_events;
DROP TABLE IF EXISTS escrow_ledger;
DROP TABLE IF EXISTS contributions;
ALTER TABLE campaigns
  DROP CONSTRAINT IF EXISTS campaigns_contributor_count_non_negative,
  DROP CONSTRAINT IF EXISTS campaigns_total_raised_cents_non_negative,
  DROP COLUMN IF EXISTS contributor_count,
  DROP COLUMN IF EXISTS total_raised_cents;
COMMIT;
```

### Schema Notes

**`contributions.donor_user_id`**: References `users(id)` — this is the MMF internal UUID, NOT
the Clerk user ID. The application layer resolves `clerkUserId` → `user.id` before inserting.
Confirmed: the table is named `users` per `20260305130000_create_users_table.sql`.

**`contributions.payment_token`**: Stored as `VARCHAR(500)`. NEVER log this value at any layer
(P-SECURITY). The token is a reference for the stub; in a real integration, Stripe tokens are
one-time-use and should NOT be stored at all. The stub stores it purely for auditability
in the demo context. A production migration would drop this column entirely.

**`contributions.idempotency_key`**: Optional `VARCHAR(255) UNIQUE`. Reserved for future use —
feat-005 does not generate or validate idempotency keys. The UNIQUE constraint exists so future
implementations can safely add the feature without a schema migration.

**`escrow_ledger.running_balance_cents`**: Must be computed by the application layer at insert
time: `previous_running_balance + amount_cents` for a credit entry. Query the last ledger entry
for the campaign to get the previous balance. The application service handles this within the
atomic transaction.

**`campaigns.total_raised_cents` and `campaigns.contributor_count`**: Updated atomically in the
same DB transaction as the `contributions` and `escrow_ledger` inserts. Never updated independently.

**Table naming**: Confirmed via `20260305130000_create_users_table.sql` — the table is `users`,
not `accounts`. All FK references in the migration SQL above use `users(id)`.

---

## 2. Domain: Value Objects

### `ContributionStatus`

File: `packages/backend/src/payments/domain/value-objects/contribution-status.ts`

```typescript
// Per P-001: no TypeScript enums — use as const object + union type
export const ContributionStatus = {
  PendingCapture: 'pending_capture',
  Captured: 'captured',
  Failed: 'failed',
} as const;

export type ContributionStatus = (typeof ContributionStatus)[keyof typeof ContributionStatus];

export const ACTIVE_STATUSES: readonly ContributionStatus[] = [
  ContributionStatus.PendingCapture,
  ContributionStatus.Captured,
] as const;
```

---

## 3. Domain: Contribution Entity

File: `packages/backend/src/payments/domain/models/contribution.ts`

```typescript
import { ContributionStatus } from '../value-objects/contribution-status.js';
import {
  ContributionAmountBelowMinimumError,
  InvalidContributionAmountError,
  InvalidContributionCampaignIdError,
  InvalidContributionDonorIdError,
} from '../errors/payment-errors.js';

export const MINIMUM_CONTRIBUTION_CENTS = 500; // $5.00 USD

export interface ContributionData {
  readonly id: string;
  readonly donorUserId: string;
  readonly campaignId: string;
  readonly amountCents: number;       // Integer cents; BIGINT from DB parsed to number (safe for amounts < $90T)
  readonly paymentToken: string;      // NEVER LOG
  readonly status: ContributionStatus;
  readonly transactionRef: string | null;
  readonly failureReason: string | null;
  readonly idempotencyKey: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateContributionInput {
  readonly donorUserId: string;
  readonly campaignId: string;
  readonly amountCents: number;
  readonly paymentToken: string;      // NEVER LOG
  readonly idempotencyKey?: string;
}

export class Contribution {
  private constructor(private readonly props: ContributionData) {}

  // Getters
  get id(): string { return this.props.id; }
  get donorUserId(): string { return this.props.donorUserId; }
  get campaignId(): string { return this.props.campaignId; }
  get amountCents(): number { return this.props.amountCents; }
  get paymentToken(): string { return this.props.paymentToken; }
  get status(): ContributionStatus { return this.props.status; }
  get transactionRef(): string | null { return this.props.transactionRef; }
  get failureReason(): string | null { return this.props.failureReason; }
  get idempotencyKey(): string | null { return this.props.idempotencyKey; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  /**
   * create() — validates business rules.
   * Called when a new contribution is initiated.
   */
  static create(input: CreateContributionInput): Contribution {
    if (!input.donorUserId || input.donorUserId.trim() === '') {
      throw new InvalidContributionDonorIdError();
    }
    if (!input.campaignId || input.campaignId.trim() === '') {
      throw new InvalidContributionCampaignIdError();
    }
    if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
      throw new InvalidContributionAmountError();
    }
    if (input.amountCents < MINIMUM_CONTRIBUTION_CENTS) {
      throw new ContributionAmountBelowMinimumError(input.amountCents);
    }

    return new Contribution({
      id: '',                                    // Set by DB on insert
      donorUserId: input.donorUserId,
      campaignId: input.campaignId,
      amountCents: input.amountCents,
      paymentToken: input.paymentToken,
      status: ContributionStatus.PendingCapture,
      transactionRef: null,
      failureReason: null,
      idempotencyKey: input.idempotencyKey ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  /**
   * reconstitute() — no validation. Called when reading from DB.
   */
  static reconstitute(data: ContributionData): Contribution {
    return new Contribution(data);
  }

  /**
   * capture() — transitions to 'captured'. Returns new immutable instance.
   */
  capture(transactionRef: string): Contribution {
    return new Contribution({
      ...this.props,
      status: ContributionStatus.Captured,
      transactionRef,
      updatedAt: new Date(),
    });
  }

  /**
   * fail() — transitions to 'failed'. Returns new immutable instance.
   */
  fail(reason: string): Contribution {
    return new Contribution({
      ...this.props,
      status: ContributionStatus.Failed,
      failureReason: reason,
      updatedAt: new Date(),
    });
  }
}
```

### Key Note on amountCents Type

`amountCents` is typed as `number` in the domain entity (not `string`) per backend rules.
BIGINT values from PostgreSQL arrive as `string` via the `pg` driver (G-024).
The repository adapter must parse: `parseInt(row.amount_cents, 10)` when reconstituting.
The API serializer must re-stringify for the JSON response (per monetary serialisation rules).

---

## 4. Domain: Errors

File: `packages/backend/src/payments/domain/errors/payment-errors.ts`

```typescript
import { DomainError } from '../../../shared/domain/errors.js';

export class ContributionAmountBelowMinimumError extends DomainError {
  readonly code = 'CONTRIBUTION_AMOUNT_BELOW_MINIMUM';
  constructor(amountCents: number) {
    super(
      'CONTRIBUTION_AMOUNT_BELOW_MINIMUM',
      `Minimum contribution is $5.00. You submitted ${amountCents} cents.`,
    );
  }
}

export class InvalidContributionAmountError extends DomainError {
  readonly code = 'INVALID_CONTRIBUTION_AMOUNT';
  constructor() {
    super('INVALID_CONTRIBUTION_AMOUNT', 'Contribution amount must be a positive integer (cents).');
  }
}

export class InvalidContributionDonorIdError extends DomainError {
  readonly code = 'INVALID_CONTRIBUTION_DONOR_ID';
  constructor() {
    super('INVALID_CONTRIBUTION_DONOR_ID', 'Donor user ID is required.');
  }
}

export class InvalidContributionCampaignIdError extends DomainError {
  readonly code = 'INVALID_CONTRIBUTION_CAMPAIGN_ID';
  constructor() {
    super('INVALID_CONTRIBUTION_CAMPAIGN_ID', 'Campaign ID is required.');
  }
}

export class CampaignNotAcceptingContributionsError extends DomainError {
  readonly code = 'CAMPAIGN_NOT_ACCEPTING_CONTRIBUTIONS';
  constructor(status: string) {
    super(
      'CAMPAIGN_NOT_ACCEPTING_CONTRIBUTIONS',
      `This campaign is not accepting contributions (status: ${status}).`,
    );
  }
}

export class DuplicateContributionError extends DomainError {
  readonly code = 'DUPLICATE_CONTRIBUTION';
  constructor() {
    super(
      'DUPLICATE_CONTRIBUTION',
      'An identical contribution was submitted within the last 60 seconds. Please wait before trying again.',
    );
  }
}

export class ContributionNotFoundError extends DomainError {
  readonly code = 'CONTRIBUTION_NOT_FOUND';
  constructor() {
    super('CONTRIBUTION_NOT_FOUND', 'Contribution not found.');
  }
}

export class PaymentCaptureError extends DomainError {
  readonly code = 'PAYMENT_CAPTURE_FAILED';
  constructor(reason: string) {
    super('PAYMENT_CAPTURE_FAILED', reason);
  }
}
```

---

## 5. Port Interfaces

### `PaymentGatewayPort`

File: `packages/backend/src/payments/ports/payment-gateway.port.ts`

```typescript
export interface CaptureInput {
  readonly contributionId: string;
  readonly amountCents: number;
  readonly paymentToken: string;   // NEVER LOG
  readonly campaignId: string;
  readonly donorUserId: string;
}

export interface CaptureResult {
  readonly success: boolean;
  readonly transactionRef: string | null;  // Populated on success; null on failure
  readonly failureReason: string | null;   // Populated on failure; null on success
}

export interface PaymentGatewayPort {
  capture(input: CaptureInput): Promise<CaptureResult>;
}
```

### `ContributionRepository`

File: `packages/backend/src/payments/ports/contribution-repository.port.ts`

```typescript
import type { Contribution } from '../domain/models/contribution.js';

export interface ContributionRepository {
  /**
   * Inserts a new contribution. Sets id from DB.
   * Returns the persisted contribution with id populated.
   */
  save(contribution: Contribution): Promise<Contribution>;

  /**
   * Finds a contribution by ID. Returns null if not found.
   */
  findById(id: string): Promise<Contribution | null>;

  /**
   * Finds a contribution by ID scoped to a specific donor.
   * Returns null if not found OR if it belongs to a different donor.
   */
  findByIdForDonor(id: string, donorUserId: string): Promise<Contribution | null>;

  /**
   * Updates status, transactionRef, and failureReason.
   * Returns the updated contribution.
   */
  updateStatus(
    contributionId: string,
    status: string,
    transactionRef: string | null,
    failureReason: string | null,
  ): Promise<Contribution>;

  /**
   * Duplicate check: returns true if a non-failed contribution exists for
   * (donorUserId, campaignId, amountCents) created within the last windowSeconds.
   */
  existsDuplicate(
    donorUserId: string,
    campaignId: string,
    amountCents: number,
    windowSeconds: number,
  ): Promise<boolean>;

  /**
   * Lists all contributions by a donor for a specific campaign, ordered by created_at DESC.
   */
  listByDonorForCampaign(
    donorUserId: string,
    campaignId: string,
    limit: number,
    offset: number,
  ): Promise<Contribution[]>;
}
```

### `EscrowLedgerRepository`

File: `packages/backend/src/payments/ports/escrow-ledger-repository.port.ts`

```typescript
export interface EscrowLedgerEntry {
  readonly id: string;
  readonly campaignId: string;
  readonly contributionId: string;
  readonly entryType: 'credit';
  readonly amountCents: number;
  readonly runningBalanceCents: number;
  readonly createdAt: Date;
}

export interface CreateLedgerEntryInput {
  readonly campaignId: string;
  readonly contributionId: string;
  readonly entryType: 'credit';
  readonly amountCents: number;
}

export interface EscrowLedgerRepository {
  /**
   * Inserts a new ledger entry. Computes runningBalanceCents as
   * (previous balance for campaign) + amountCents.
   * MUST be called within an existing database transaction (client param).
   */
  createEntry(
    input: CreateLedgerEntryInput,
    client: import('pg').PoolClient,
  ): Promise<EscrowLedgerEntry>;

  /**
   * Returns the current running balance (sum of all credit entries) for a campaign.
   */
  getRunningBalance(campaignId: string): Promise<number>;
}
```

### `ContributionAuditRepository`

File: `packages/backend/src/payments/ports/contribution-audit-repository.port.ts`

```typescript
export interface ContributionAuditEvent {
  readonly id: string;
  readonly contributionId: string;
  readonly campaignId: string;
  readonly donorUserId: string;
  readonly previousStatus: string | null;
  readonly newStatus: string;
  readonly amountCents: number;
  readonly eventType: string;
  readonly createdAt: Date;
}

export interface CreateAuditEventInput {
  readonly contributionId: string;
  readonly campaignId: string;
  readonly donorUserId: string;
  readonly previousStatus: string | null;
  readonly newStatus: string;
  readonly amountCents: number;
  readonly eventType: 'contribution.created' | 'contribution.captured' | 'contribution.failed';
}

export interface ContributionAuditRepository {
  createEvent(input: CreateAuditEventInput): Promise<ContributionAuditEvent>;
}
```

---

## 6. Stub Adapter

File: `packages/backend/src/payments/adapters/stub-payment-gateway.adapter.ts`

```typescript
import type {
  CaptureInput,
  CaptureResult,
  PaymentGatewayPort,
} from '../ports/payment-gateway.port.js';

const FAIL_SENTINEL = 'tok_fail';

/**
 * StubPaymentGatewayAdapter — for local demo / testing.
 *
 * Rules:
 *   - paymentToken === 'tok_fail' → failure with descriptive reason
 *   - any other non-empty token   → success with generated transactionRef
 *
 * SECURITY: The paymentToken is NEVER logged at any level.
 */
export class StubPaymentGatewayAdapter implements PaymentGatewayPort {
  async capture(input: CaptureInput): Promise<CaptureResult> {
    // Simulate minimal network latency for demo realism
    await new Promise((resolve) => setTimeout(resolve, 50));

    if (input.paymentToken === FAIL_SENTINEL) {
      return {
        success: false,
        transactionRef: null,
        failureReason: 'Your payment method was declined. Please check your payment details and try again.',
      };
    }

    return {
      success: true,
      transactionRef: `stub_txn_${input.contributionId}_${Date.now()}`,
      failureReason: null,
    };
  }
}
```

---

## 7. PG Adapter Implementation Notes

### `PgContributionRepository`

File: `packages/backend/src/payments/adapters/pg-contribution-repository.adapter.ts`

Key SQL patterns to implement:

**`save()`**: INSERT with `RETURNING *`. Map returned row to `Contribution.reconstitute()`.

```sql
INSERT INTO contributions
  (donor_user_id, campaign_id, amount_cents, payment_token, status, idempotency_key)
VALUES ($1, $2, $3, $4, 'pending_capture', $5)
RETURNING *
```

**`updateStatus()`**: UPDATE with `RETURNING *`.

```sql
UPDATE contributions
SET status = $2, transaction_ref = $3, failure_reason = $4, updated_at = NOW()
WHERE id = $1
RETURNING *
```

**`existsDuplicate()`**: Duplicate detection window query.
This must use parameterised SQL with `INTERVAL`. Returns boolean.

```sql
SELECT EXISTS (
  SELECT 1
  FROM contributions
  WHERE donor_user_id = $1
    AND campaign_id   = $2
    AND amount_cents  = $3
    AND status != 'failed'
    AND created_at > NOW() - ($4 * INTERVAL '1 second')
) AS duplicate_exists
```

**`findByIdForDonor()`**: Scopes query to donor.

```sql
SELECT * FROM contributions
WHERE id = $1 AND donor_user_id = $2
```

**`listByDonorForCampaign()`**: Paginated list.

```sql
SELECT * FROM contributions
WHERE donor_user_id = $1 AND campaign_id = $2
ORDER BY created_at DESC
LIMIT $3 OFFSET $4
```

**Row mapping** (`rowToContribution`): Follow P-005 pattern. Critical: parse `BIGINT` from string.

```typescript
function rowToContribution(row: ContributionRow): Contribution {
  return Contribution.reconstitute({
    id: row.id,
    donorUserId: row.donor_user_id,
    campaignId: row.campaign_id,
    amountCents: parseInt(row.amount_cents, 10),   // G-024: BIGINT comes as string
    paymentToken: row.payment_token,
    status: row.status as ContributionStatus,
    transactionRef: row.transaction_ref,
    failureReason: row.failure_reason,
    idempotencyKey: row.idempotency_key,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}
```

### `PgEscrowLedgerRepository`

**`createEntry(client)`**: Takes a `PoolClient` — MUST be called inside the atomic transaction
that also updates `contributions` and `campaigns`. The calling code must pass the same client
that holds the open transaction.

```sql
-- Step 1: get previous running balance for this campaign
SELECT COALESCE(MAX(running_balance_cents), 0) AS prev_balance
FROM escrow_ledger
WHERE campaign_id = $1

-- Step 2: insert new entry with computed running balance
INSERT INTO escrow_ledger
  (campaign_id, contribution_id, entry_type, amount_cents, running_balance_cents)
VALUES ($1, $2, $3, $4, $5)
RETURNING *
```

Both queries must use the passed `PoolClient` (not the pool), to run within the same transaction.

### Campaign Total Update (within transaction)

This query is executed in the `PgContributionRepository` or a dedicated method. It must run
within the same `PoolClient` transaction:

```sql
UPDATE campaigns
SET total_raised_cents  = total_raised_cents + $2,
    contributor_count   = contributor_count + 1,
    updated_at          = NOW()
WHERE id = $1
RETURNING id, total_raised_cents, funding_goal_cents, status
```

If the returned `total_raised_cents >= funding_goal_cents` AND `funding_goal_cents IS NOT NULL`
AND `status = 'live'`, execute the funded transition in the same transaction:

```sql
UPDATE campaigns
SET status = 'funded', updated_at = NOW()
WHERE id = $1 AND status = 'live'
```

This uses the same conditional WHERE pattern as P-020 to prevent double-transition on concurrent
requests.

---

## 8. `AuditLoggerPort` resourceType Extension

Per G-021, the existing `AuditEntry` interface has `resourceType: 'user' | 'kyc'`.
Payment audit events use a separate `ContributionAuditRepository` (not the shared audit logger)
so no change to the existing `AuditLoggerPort` is required. The `contribution_audit_events` table
serves as the immutable audit trail for the payments context.
