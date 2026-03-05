# PRD: feat-005 — Application Service and API Contracts

> Sub-file 3 of 4. Read `feat-005-spec.md` and `feat-005-spec-data.md` first.

---

## 1. Zod Request Schema

File: `packages/backend/src/payments/api/schemas/create-contribution.schema.ts`

```typescript
import { z } from 'zod';

export const createContributionSchema = z.object({
  campaignId: z.string().uuid({ message: 'campaignId must be a valid UUID.' }),

  // amountCents: accepts string OR number (Zod coerces number → string then parses)
  // Must represent a positive integer >= 500 (minimum $5.00)
  amountCents: z
    .union([z.string(), z.number()])
    .transform((val) => {
      const parsed = typeof val === 'number' ? val : parseInt(val, 10);
      return parsed;
    })
    .pipe(
      z
        .number()
        .int({ message: 'amountCents must be an integer.' })
        .min(500, { message: 'Minimum contribution is $5.00 (500 cents).' }),
    ),

  paymentToken: z
    .string()
    .min(1, { message: 'Payment token is required.' })
    .max(500, { message: 'Payment token must be 500 characters or fewer.' }),
}).strict();

export type CreateContributionInput = z.infer<typeof createContributionSchema>;
```

**Note on amountCents**: The `.union([z.string(), z.number()])` pattern handles both cases:
- Frontend sends `"500"` (string) — accepted
- Frontend sends `500` (number) — accepted via Zod coercion
The parsed integer is passed to the application service.

---

## 2. Application Service

File: `packages/backend/src/payments/application/contribution-app-service.ts`

### Constructor

```typescript
import type { Logger } from 'pino';
import type { Pool, PoolClient } from 'pg';
import type { UserRepository } from '../../account/ports/user-repository.port.js';
import type { CampaignRepository } from '../../campaign/ports/campaign-repository.port.js';
import type { ContributionRepository } from '../ports/contribution-repository.port.js';
import type { EscrowLedgerRepository } from '../ports/escrow-ledger-repository.port.js';
import type { ContributionAuditRepository } from '../ports/contribution-audit-repository.port.js';
import type { PaymentGatewayPort } from '../ports/payment-gateway.port.js';
import { Contribution } from '../domain/models/contribution.js';
import {
  CampaignNotAcceptingContributionsError,
  ContributionNotFoundError,
  DuplicateContributionError,
} from '../domain/errors/payment-errors.js';
import { UserNotFoundError } from '../../account/domain/errors/account-errors.js';
import { CampaignNotFoundError } from '../../campaign/domain/errors/campaign-errors.js';

export class ContributionAppService {
  constructor(
    private readonly pool: Pool,                         // For transaction management
    private readonly contributionRepository: ContributionRepository,
    private readonly escrowLedgerRepository: EscrowLedgerRepository,
    private readonly contributionAuditRepository: ContributionAuditRepository,
    private readonly campaignRepository: CampaignRepository,  // Cross-context read (P-023)
    private readonly userRepository: UserRepository,           // Cross-context read (P-023)
    private readonly paymentGateway: PaymentGatewayPort,
    private readonly logger: Logger,
  ) {}
```

### `createContribution()` — Core Method

```typescript
async createContribution(
  clerkUserId: string,
  input: {
    campaignId: string;
    amountCents: number;
    paymentToken: string;    // NEVER LOG
  },
): Promise<Contribution>
```

**Step-by-step logic** (MUST follow this exact order):

```
1. Resolve clerkUserId → internal user record
   - userRepository.findByClerkUserId(clerkUserId)
   - If null → throw UserNotFoundError

2. Validate campaign exists and is 'live'
   - campaignRepository.findById(input.campaignId)
   - If null → throw CampaignNotFoundError
   - If campaign.status !== 'live' → throw CampaignNotAcceptingContributionsError(campaign.status)
   NOTE: 'funded' campaigns also fail this check — only 'live' accepts contributions

3. Duplicate check (60-second window)
   - contributionRepository.existsDuplicate(user.id, input.campaignId, input.amountCents, 60)
   - If true → throw DuplicateContributionError

4. Create contribution domain entity
   - const contribution = Contribution.create({
       donorUserId: user.id,
       campaignId: input.campaignId,
       amountCents: input.amountCents,
       paymentToken: input.paymentToken,   // NEVER LOG
     })

5. Persist contribution as 'pending_capture'
   - const savedContribution = await contributionRepository.save(contribution)
   NOTE: At this point, an immutable record of intent exists — crash-safe

6. Emit 'contribution.created' audit event (best-effort AFTER save — per G-019)
   try {
     await contributionAuditRepository.createEvent({
       contributionId: savedContribution.id,
       campaignId: savedContribution.campaignId,
       donorUserId: savedContribution.donorUserId,
       previousStatus: null,
       newStatus: 'pending_capture',
       amountCents: savedContribution.amountCents,
       eventType: 'contribution.created',
     })
   } catch (auditErr) {
     logger.error({ err: auditErr }, 'Failed to write contribution.created audit event')
   }

7. Call payment gateway
   - const result = await paymentGateway.capture({
       contributionId: savedContribution.id,
       amountCents: savedContribution.amountCents,
       paymentToken: savedContribution.paymentToken,   // NEVER LOG
       campaignId: savedContribution.campaignId,
       donorUserId: savedContribution.donorUserId,
     })
   NOTE: logger.info MUST NOT include paymentToken in the log context

8a. FAILURE PATH (result.success === false):
   - Update contribution to 'failed':
     const failedContribution = await contributionRepository.updateStatus(
       savedContribution.id, 'failed', null, result.failureReason
     )
   - Emit 'contribution.failed' audit event (best-effort):
     try { await contributionAuditRepository.createEvent({...}) } catch { ... }
   - Return failedContribution (caller returns 201 with status 'failed')
   NOTE: Do NOT throw — the audit trail must be preserved

8b. SUCCESS PATH (result.success === true):
   - Begin atomic DB transaction (acquire PoolClient from pool)
   - Within transaction:
     a. UPDATE contributions SET status='captured', transaction_ref=$2, updated_at=NOW()
        WHERE id=$1
     b. INSERT INTO escrow_ledger (campaign_id, contribution_id, entry_type, amount_cents, running_balance_cents)
        (compute running_balance as prev_balance + amountCents)
     c. UPDATE campaigns SET total_raised_cents += amountCents, contributor_count += 1, updated_at=NOW()
        WHERE id=$1 RETURNING id, total_raised_cents, funding_goal_cents, status
     d. If total_raised_cents >= funding_goal_cents AND funding_goal_cents IS NOT NULL AND status='live':
        UPDATE campaigns SET status='funded', updated_at=NOW() WHERE id=$1 AND status='live'
   - COMMIT transaction
   - Release PoolClient back to pool
   - Emit 'contribution.captured' audit event (best-effort, AFTER commit — per G-019):
     try { await contributionAuditRepository.createEvent({...}) } catch { ... }
   - Return captured contribution
```

### Transaction Implementation Detail

The atomic success transaction uses a raw `PoolClient` from the pool, NOT the repository methods
that use the pool directly. Pass the `client` to each repository method that needs to participate
in the transaction:

```typescript
const client: PoolClient = await this.pool.connect();
try {
  await client.query('BEGIN');

  // a. Update contribution status
  const updatedContrib = await this.contributionRepository.updateStatus(
    savedContribution.id, 'captured', result.transactionRef, null, client
  );

  // b. Create escrow ledger entry
  await this.escrowLedgerRepository.createEntry({
    campaignId: savedContribution.campaignId,
    contributionId: savedContribution.id,
    entryType: 'credit',
    amountCents: savedContribution.amountCents,
  }, client);

  // c. Update campaign totals — returns updated totals row
  const campaignRow = await this.updateCampaignTotals(
    savedContribution.campaignId,
    savedContribution.amountCents,
    client,
  );

  // d. Auto-transition to funded if goal reached
  if (
    campaignRow.fundingGoalCents !== null &&
    campaignRow.totalRaisedCents >= campaignRow.fundingGoalCents &&
    campaignRow.status === 'live'
  ) {
    await client.query(
      `UPDATE campaigns SET status = 'funded', updated_at = NOW()
       WHERE id = $1 AND status = 'live'`,
      [savedContribution.campaignId],
    );
  }

  await client.query('COMMIT');
  return updatedContrib;
} catch (err) {
  await client.query('ROLLBACK');
  throw err;
} finally {
  client.release();
}
```

The `updateStatus()` method on `ContributionRepository` needs an optional `client?: PoolClient`
parameter to support transactional usage. Add this to the port interface:

```typescript
updateStatus(
  contributionId: string,
  status: string,
  transactionRef: string | null,
  failureReason: string | null,
  client?: PoolClient,   // Optional — if provided, use this client (within transaction)
): Promise<Contribution>;
```

### `getContributionForDonor()` — Fetch by ID

```typescript
async getContributionForDonor(
  clerkUserId: string,
  contributionId: string,
): Promise<Contribution>
```

Logic:
1. Resolve `clerkUserId` → `user.id`
2. `contributionRepository.findByIdForDonor(contributionId, user.id)`
3. If null → throw `ContributionNotFoundError` (do NOT reveal if it belongs to another user)
4. Return contribution

### `listContributionsForDonorCampaign()` — Paginated List

```typescript
async listContributionsForDonorCampaign(
  clerkUserId: string,
  campaignId: string,
  limit: number,
  offset: number,
): Promise<Contribution[]>
```

Logic:
1. Resolve `clerkUserId` → `user.id`
2. `contributionRepository.listByDonorForCampaign(user.id, campaignId, limit, offset)`
3. Return array (may be empty)

---

## 3. API Routes

### Router File

File: `packages/backend/src/payments/api/contribution-router.ts`

All routes require `requireAuth` middleware (applied at mount point in `app.ts`).

### `POST /api/v1/contributions`

**Request**:
```
POST /api/v1/contributions
Content-Type: application/json
Authorization: Bearer <clerk-jwt>

{
  "campaignId": "uuid",
  "amountCents": "500",
  "paymentToken": "tok_abc123"
}
```

**Handler logic**:
```typescript
const clerkUserId = getClerkAuth(req);   // From P-007 auth middleware
const parseResult = createContributionSchema.safeParse(req.body);
if (!parseResult.success) {
  return res.status(400).json({
    error: {
      code: 'VALIDATION_ERROR',
      message: parseResult.error.errors[0]?.message ?? 'Invalid request body.',
      correlation_id: req.correlationId ?? null,
    },
  });
}

const contribution = await contributionAppService.createContribution(
  clerkUserId,
  parseResult.data,
);

return res.status(201).json({ data: serializeContribution(contribution) });
```

**Always returns `201`** — including payment failures (`status: "failed"` in body).

**Success response** (`captured`):
```json
{
  "data": {
    "id": "uuid",
    "campaignId": "uuid",
    "amountCents": "500",
    "status": "captured",
    "transactionRef": "stub_txn_...",
    "failureReason": null,
    "createdAt": "2026-03-05T17:00:00.000Z"
  }
}
```

**Failure response** (`tok_fail`):
```json
{
  "data": {
    "id": "uuid",
    "campaignId": "uuid",
    "amountCents": "500",
    "status": "failed",
    "transactionRef": null,
    "failureReason": "Your payment method was declined. Please check your payment details and try again.",
    "createdAt": "2026-03-05T17:00:00.000Z"
  }
}
```

**Error responses** (all follow standard error contract with `correlation_id`):

| HTTP | code | Trigger |
|------|------|---------|
| `400` | `VALIDATION_ERROR` | Zod parse failure — invalid UUID, amount < 500, missing fields |
| `401` | `UNAUTHENTICATED` | No valid Clerk JWT |
| `404` | `CAMPAIGN_NOT_FOUND` | campaignId does not exist |
| `409` | `DUPLICATE_CONTRIBUTION` | Same donor+campaign+amount within 60s |
| `422` | `CAMPAIGN_NOT_ACCEPTING_CONTRIBUTIONS` | Campaign status is not `live` |
| `500` | `INTERNAL_ERROR` | Unexpected errors |

**Note on 400 vs 422**: `VALIDATION_ERROR` (400) is for schema/input format errors.
`CAMPAIGN_NOT_ACCEPTING_CONTRIBUTIONS` (422) is a semantic rejection of a syntactically valid
request.

---

### `GET /api/v1/contributions/:id`

**Request**:
```
GET /api/v1/contributions/:id
Authorization: Bearer <clerk-jwt>
```

**Handler logic**:
```typescript
const clerkUserId = getClerkAuth(req);
const contribution = await contributionAppService.getContributionForDonor(
  clerkUserId,
  req.params.id,
);
return res.status(200).json({ data: serializeContribution(contribution) });
```

**Success response** (`200`):
```json
{
  "data": {
    "id": "uuid",
    "campaignId": "uuid",
    "amountCents": "500",
    "status": "captured",
    "transactionRef": "stub_txn_...",
    "failureReason": null,
    "createdAt": "2026-03-05T17:00:00.000Z"
  }
}
```

**Error responses**:

| HTTP | code | Trigger |
|------|------|---------|
| `401` | `UNAUTHENTICATED` | No valid Clerk JWT |
| `404` | `NOT_FOUND` | Contribution not found or belongs to another user |

---

### `GET /api/v1/campaigns/:id/contributions`

This route is added to the **existing authenticated campaign router**.
It returns the authenticated user's own contributions to a specific campaign.

**Request**:
```
GET /api/v1/campaigns/:id/contributions?limit=20&offset=0
Authorization: Bearer <clerk-jwt>
```

**Query params** (Zod schema):
- `limit`: integer 1–100, default 20
- `offset`: integer >= 0, default 0

**Handler logic**:
```typescript
const clerkUserId = getClerkAuth(req);
const campaignId = req.params.id;
const limit = parseInt(req.query.limit as string ?? '20', 10);
const offset = parseInt(req.query.offset as string ?? '0', 10);

const contributions = await contributionAppService.listContributionsForDonorCampaign(
  clerkUserId, campaignId, limit, offset,
);
return res.status(200).json({ data: contributions.map(serializeContribution) });
```

**Note on router mounting** (G-036): The `GET /api/v1/campaigns/:id/contributions` route is
mounted inside the existing authenticated campaign router. Because `requireAuth` is already
applied to the `/api/v1/campaigns` prefix, this route is automatically protected.

**Register this route BEFORE `/:id` in the campaign router** (G-023) — or add it to a specific
path after the `:id` segment (`:id/contributions` does not conflict with `:id`).

**Success response** (`200`):
```json
{
  "data": [
    {
      "id": "uuid",
      "campaignId": "uuid",
      "amountCents": "500",
      "status": "captured",
      "transactionRef": "stub_txn_...",
      "failureReason": null,
      "createdAt": "2026-03-05T17:00:00.000Z"
    }
  ]
}
```

---

## 4. Contribution Serializer

File: `packages/backend/src/payments/api/contribution-serializer.ts`

```typescript
import type { Contribution } from '../domain/models/contribution.js';

export interface SerializedContribution {
  readonly id: string;
  readonly campaignId: string;
  readonly amountCents: string;       // BIGINT as string (G-024, monetary rule)
  readonly status: string;
  readonly transactionRef: string | null;
  readonly failureReason: string | null;
  readonly createdAt: string;         // ISO 8601
}

export function serializeContribution(contribution: Contribution): SerializedContribution {
  return {
    id: contribution.id,
    campaignId: contribution.campaignId,
    amountCents: contribution.amountCents.toString(),   // number → string per monetary rule
    status: contribution.status,
    transactionRef: contribution.transactionRef,
    failureReason: contribution.failureReason,
    createdAt: contribution.createdAt.toISOString(),
  };
}
```

**Note**: `donorUserId` and `paymentToken` are intentionally excluded from the serialized
response. Donors do not need their own user ID in the response (they are already authenticated),
and `paymentToken` must NEVER be returned in any response.

---

## 5. Error Handler Mapping

Add to the existing error handler middleware (`packages/backend/src/shared/` or `app.ts`):

```typescript
// Payment domain errors
import {
  CampaignNotAcceptingContributionsError,
  ContributionAmountBelowMinimumError,
  ContributionNotFoundError,
  DuplicateContributionError,
  InvalidContributionAmountError,
} from './payments/domain/errors/payment-errors.js';

// In the error handler switch/if-else:
if (err instanceof ContributionAmountBelowMinimumError ||
    err instanceof InvalidContributionAmountError) {
  return res.status(400).json({ error: { code: err.code, message: err.message, correlation_id } });
}
if (err instanceof DuplicateContributionError) {
  return res.status(409).json({ error: { code: err.code, message: err.message, correlation_id } });
}
if (err instanceof CampaignNotAcceptingContributionsError) {
  return res.status(422).json({ error: { code: err.code, message: err.message, correlation_id } });
}
if (err instanceof ContributionNotFoundError) {
  return res.status(404).json({ error: { code: 'NOT_FOUND', message: err.message, correlation_id } });
}
```

---

## 6. `app.ts` Routing Registration

The contributions router is mounted with `requireAuth` at the `/api/v1/contributions` prefix.
Add to `app.ts` alongside existing router registrations:

```typescript
// Contributions router — requires auth
app.use(
  '/api/v1/contributions',
  requireAuth(),
  createContributionRouter(services.contributionAppService, logger),
);
```

The `GET /api/v1/campaigns/:id/contributions` route is registered inside the existing campaign
router, OR as a cross-context route in `app.ts` (per P-022). Prefer registering it in `app.ts`
to avoid contaminating the campaign router with a payments concern:

```typescript
// Cross-context: donor's contributions for a campaign — registered in app.ts (P-022)
app.get(
  '/api/v1/campaigns/:id/contributions',
  requireAuth(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clerkUserId = getClerkAuth(req)!;
      const limit = Math.min(Math.max(parseInt(req.query.limit as string ?? '20', 10), 1), 100);
      const offset = Math.max(parseInt(req.query.offset as string ?? '0', 10), 0);
      const contributions = await services.contributionAppService.listContributionsForDonorCampaign(
        clerkUserId, req.params.id, limit, offset,
      );
      res.status(200).json({ data: contributions.map(serializeContribution) });
    } catch (err) {
      next(err);
    }
  },
);
```

---

## 7. Composition Root Updates

File: `packages/backend/src/composition-root.ts`

Add to `createServices()`:

```typescript
import { PgContributionRepository } from './payments/adapters/pg-contribution-repository.adapter.js';
import { PgEscrowLedgerRepository } from './payments/adapters/pg-escrow-ledger-repository.adapter.js';
import { PgContributionAuditRepository } from './payments/adapters/pg-contribution-audit-repository.adapter.js';
import { StubPaymentGatewayAdapter } from './payments/adapters/stub-payment-gateway.adapter.js';
import { ContributionAppService } from './payments/application/contribution-app-service.js';
import type { PaymentGatewayPort } from './payments/ports/payment-gateway.port.js';

// In createServices():

// Payment gateway — stub unless MOCK_PAYMENT=false (reserved for real Stripe)
const mockPayment = process.env.MOCK_PAYMENT !== 'false';
const paymentGateway: PaymentGatewayPort = mockPayment
  ? new StubPaymentGatewayAdapter()
  : (() => { throw new Error('Real payment gateway not implemented'); })();

const contributionRepository = new PgContributionRepository(pool);
const escrowLedgerRepository = new PgEscrowLedgerRepository(pool);
const contributionAuditRepository = new PgContributionAuditRepository(pool);

const contributionAppService = new ContributionAppService(
  pool,                      // Raw pool for transaction management
  contributionRepository,
  escrowLedgerRepository,
  contributionAuditRepository,
  campaignRepository,        // Shared — same instance as campaignAppService (P-023)
  userRepository,            // Shared — same instance as accountAppService (P-023)
  paymentGateway,
  logger,
);

return { accountAppService, kycAppService, campaignAppService, contributionAppService };
```

Add `MOCK_PAYMENT=true` to `.env.example`:

```
# Payment gateway — set to false when real Stripe integration is implemented
MOCK_PAYMENT=true
```

---

## 8. Application Service Tests

File: `packages/backend/src/payments/application/contribution-app-service.test.ts`

**Coverage requirement**: 100% of payment flow paths (per L2-002 quality gate).

### Required test cases:

**Happy path — successful contribution**
- Creates `pending_capture` record → calls gateway → updates to `captured` → creates escrow entry → updates campaign totals → returns captured contribution

**Happy path — contribution reaches funding goal**
- Contribution that pushes `total_raised_cents >= funding_goal_cents` causes campaign to transition to `funded` in same transaction

**Happy path — contribution exceeds cap (no goal)**
- Campaign with `funding_goal_cents = null` never auto-transitions regardless of amount

**Failure path — tok_fail**
- Gateway returns failure → contribution updated to `failed` → campaign totals NOT updated → escrow NOT created → returns failed contribution (no throw)

**Validation: amount below minimum**
- `amountCents = 499` → `ContributionAmountBelowMinimumError` thrown before DB interaction

**Validation: amount exactly at minimum**
- `amountCents = 500` → accepted, proceeds to gateway

**Validation: campaign not found**
- `campaignRepository.findById` returns null → `CampaignNotFoundError`

**Validation: campaign not live (submitted)**
- Campaign status is `submitted` → `CampaignNotAcceptingContributionsError`

**Validation: campaign not live (funded)**
- Campaign status is `funded` → `CampaignNotAcceptingContributionsError`

**Validation: campaign not live (draft)**
- Campaign status is `draft` → `CampaignNotAcceptingContributionsError`

**Duplicate within 60s**
- `existsDuplicate` returns true → `DuplicateContributionError` → gateway NOT called

**Duplicate with failed previous contribution**
- Previous `failed` contribution with same details → NOT flagged as duplicate → proceeds

**Duplicate: same amount 61s later**
- `existsDuplicate` returns false → accepted

**User not found**
- `userRepository.findByClerkUserId` returns null → `UserNotFoundError`

**Audit events written on both success and failure**
- `contribution.created` always emitted after step 5
- `contribution.captured` emitted on success path
- `contribution.failed` emitted on failure path

**Audit failure does not break main operation** (per G-019, P-021)
- `contributionAuditRepository.createEvent` throws → logged at error level → contribution still returned

Use **in-memory adapters** for all tests — no real DB.
Use **fake clock / Date mocking** for duplicate detection window tests.
