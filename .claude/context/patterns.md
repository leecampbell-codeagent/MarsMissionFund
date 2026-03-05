# Patterns

> Established implementation patterns for Mars Mission Fund.
> Updated by implementation agents across feature cycles.

---

## Domain Layer Patterns

### P-001: Value type constants (no TypeScript enums)

Per WARN-001, TypeScript enums are prohibited. Use `as const` object + union type:

```typescript
export const AccountStatus = {
  PendingVerification: 'pending_verification',
  Active: 'active',
  Suspended: 'suspended',
  Deactivated: 'deactivated',
} as const;

export type AccountStatus = (typeof AccountStatus)[keyof typeof AccountStatus];
```

**Files:** `packages/backend/src/account/domain/value-objects/account-status.ts`, role.ts, kyc-status.ts, onboarding-step.ts

---

### P-002: Entity immutability with private constructor

All domain entities use private constructor, static `create()` (with validation), and static `reconstitute()` (no validation):

```typescript
export class User {
  private constructor(private readonly props: UserData) {}

  static create(input: CreateUserInput): User { /* validates */ }
  static reconstitute(data: UserData): User { /* no validation */ }
}
```

All state mutations return a **new** instance — entities are immutable after creation.

**File:** `packages/backend/src/account/domain/models/user.ts`

---

### P-003: Domain errors extend DomainError with unique code

```typescript
export abstract class DomainError extends Error {
  abstract readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = code;
    Object.setPrototypeOf(this, new.target.prototype); // Fix prototype chain for instanceof
  }
}

export class UserNotFoundError extends DomainError {
  readonly code = 'USER_NOT_FOUND';
  constructor() { super('USER_NOT_FOUND', "We couldn't find your account."); }
}
```

**Files:** `packages/backend/src/shared/domain/errors.ts`, account/domain/errors/account-errors.ts

---

### P-004: SecurityAlerts literal true type pattern

`securityAlerts` has TypeScript type `true` (literal, not `boolean`). Runtime guard uses `as unknown` cast to compare against `false`:

```typescript
if ('securityAlerts' in prefs && (prefs.securityAlerts as unknown) === false) {
  throw new SecurityAlertsCannotBeDisabledError();
}
```

**Files:** `user.ts`, `account-app-service.ts`

---

## Adapter Patterns

### P-005: PG repository row mapping

Database rows use `snake_case`. Domain entities use `camelCase`. Convert explicitly in `rowToDomain()`:

```typescript
function rowToDomain(row: UserRow): User {
  return User.reconstitute({
    id: row.id,
    clerkUserId: row.clerk_user_id,
    notificationPrefs: {
      campaignUpdates: row.notification_prefs.campaign_updates,
      securityAlerts: true, // Always forced — never read from DB
    },
  });
}
```

**File:** `packages/backend/src/account/adapters/pg-user-repository.adapter.ts`

---

### P-006: Upsert semantics for idempotency

All create/sync operations use `ON CONFLICT ... DO UPDATE` to handle concurrent requests and at-least-once webhook delivery:

```sql
INSERT INTO users (clerk_user_id, email, ...)
ON CONFLICT (clerk_user_id)
DO UPDATE SET email = EXCLUDED.email, last_seen_at = NOW(), updated_at = NOW()
```

**Per:** Gotcha G-004, G-013

---

## API Patterns

### P-007: requireAuth returns JSON 401 (not redirect)

Per gotcha G-003, Clerk's `requireAuth()` in `@clerk/express` v1.x does NOT support `unauthorizedHandler`. Implement manually using `getAuth()`:

```typescript
export function createRequireAuth(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const auth = getAuth(req);
    if (!auth.userId) {
      res.status(401).json({
        error: { code: 'UNAUTHENTICATED', message: '...', correlation_id: req.correlationId ?? null }
      });
      return;
    }
    next();
  };
}
```

**File:** `packages/backend/src/shared/middleware/auth.ts`

---

### P-008: WARN-002 — All error responses include correlation_id

Every error response must include `correlation_id`:

```typescript
res.status(401).json({
  error: {
    code: 'UNAUTHENTICATED',
    message: 'Authentication required. Sign in to continue.',
    correlation_id: req.correlationId ?? null,
  },
});
```

`correlationId` is injected via `correlationIdMiddleware` which sets `req.correlationId = crypto.randomUUID()`.

---

### P-009: Webhook route must use express.raw() before express.json()

Per the Svix webhook verification requirement, the webhook route must receive the raw body as a `Buffer`:

```typescript
// Register BEFORE express.json()
app.use(
  '/api/v1/webhooks',
  express.raw({ type: 'application/json' }),
  createWebhookRouter(services.accountAppService, logger),
);

// JSON body parsing for all other routes (registered AFTER webhook route)
app.use(express.json());
```

**File:** `packages/backend/src/app.ts`

---

### P-010: Health endpoint before Clerk middleware

Per gotcha G-015, `/health` must be registered before `clerkMiddleware()`:

```typescript
// Health check BEFORE clerkMiddleware
app.get('/health', (_req, res) => { ... });

// Webhook route (raw body)
app.use('/api/v1/webhooks', express.raw(...), webhookRouter);

// JSON body parsing
app.use(express.json());

// Clerk middleware (registered after health + webhook routes)
app.use(clerkMiddleware());
```

---

### P-011: WARN-003 — Profile PATCH schema includes onboarding fields

The `PATCH /api/v1/me/profile` Zod schema includes `onboardingCompleted` and `onboardingStep`:

```typescript
z.object({
  displayName: z.string().max(255).nullable().optional().transform(v => v === '' ? null : v),
  bio: z.string().max(500).nullable().optional().transform(v => v === '' ? null : v),
  avatarUrl: z.string().url().nullable().optional(),
  onboardingCompleted: z.boolean().optional(),
  onboardingStep: z.enum(['role_selection', 'profiling', 'notifications', 'complete']).optional(),
}).strict()
```

---

### P-012: WARN-004 — Profile route is /me/profile

The profile update endpoint is `PATCH /api/v1/me/profile`, NOT `/api/v1/profile`. Registered in `createAccountRouter` under the `/api/v1` prefix as `/me/profile`.

---

### P-013: WARN-005 — Assign Backer role on Active status

In `syncUser`, always assign `[Role.Backer]` when `accountStatus === Active` and the roles array is empty:

```typescript
const userToUpsert =
  input.accountStatus === AccountStatus.Active && user.roles.length === 0
    ? User.reconstitute({ ...user, roles: [Role.Backer] })
    : user;
```

Same logic applies in webhook handlers (`user.created`, `user.updated` out-of-order delivery).

---

## Testing Patterns

### P-014: Mock Clerk in tests via vi.mock

Per gotcha G-012, mock `@clerk/express` to avoid real JWT validation:

```typescript
vi.mock('@clerk/express', () => ({
  clerkMiddleware: () => (_req, _res, next) => next(),
  getAuth: (req) => {
    const userId = req.headers['x-test-user-id'];
    return { userId: userId ?? null };
  },
}));
```

Inject `x-test-user-id` header in test requests. Real Clerk middleware is replaced with a header-based stub.

**File:** `packages/backend/src/account/api/account-router.test.ts`

---

### P-015: pino-http CJS interop in ESM context

`pino-http` is a CJS module used in an ESM project. Import as namespace and handle default:

```typescript
import * as pinoHttpModule from 'pino-http';
const httpLogger =
  (pinoHttpModule as unknown as { default: (opts: { logger: Logger }) => RequestHandler })
    .default ?? pinoHttpModule;
```

**File:** `packages/backend/src/app.ts`

---

## Monorepo Patterns

### P-016: Workspace package references

`packages/backend` references `packages/shared` via `tsconfig.json` paths + composite references:

```json
// packages/backend/tsconfig.json
{
  "compilerOptions": {
    "paths": { "@mmf/shared": ["../shared/src/index.ts"] }
  },
  "references": [{ "path": "../shared" }]
}
```

Vitest resolves `@mmf/shared` via `resolve.alias` in `vitest.config.ts`.

---

## Migration Patterns

### P-017: users table schema summary

Key constraints on `users` table:
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `clerk_user_id TEXT NOT NULL UNIQUE` — never UUID (Gotcha G-001)
- `roles TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]`
- `notification_prefs JSONB NOT NULL DEFAULT { all true except platform_announcements }`
- `account_status TEXT CHECK (... 4 values ...)`
- All `TIMESTAMPTZ` — never bare `TIMESTAMP`
- `updated_at` auto-trigger via `update_updated_at_column()` function

---

### P-018: Campaign status state machine with status-set constants

The Campaign entity exposes named sets of statuses for guard checks rather than
hardcoding status comparisons everywhere:

```typescript
export const EDITABLE_STATUSES: readonly CampaignStatus[] = ['draft', 'rejected'];
export const SUBMITTABLE_STATUSES: readonly CampaignStatus[] = ['draft', 'rejected'];
export const CREATOR_ARCHIVABLE_STATUSES: readonly CampaignStatus[] = ['draft', 'rejected'];
```

Entity methods check membership against these constants:

```typescript
submit(): Campaign {
  if (!SUBMITTABLE_STATUSES.includes(this.status)) {
    throw new CampaignNotSubmittableError();
  }
  return Campaign.reconstitute({ ...this.props, status: CampaignStatus.Submitted, submittedAt: new Date() });
}
```

This keeps transition rules in one place and avoids scattered inline status comparisons.

**Files:** `packages/backend/src/campaign/domain/value-objects/campaign-status.ts`,
`packages/backend/src/campaign/domain/models/campaign.ts`

---

### P-019: Dynamic SQL SET clause for partial draft updates

When a PATCH operation accepts any subset of optional fields, build the SET clause
dynamically using a field map and a parameters array:

```typescript
const fieldMap: Record<string, string> = {
  title: 'title',
  shortDescription: 'short_description',
  fundingGoalCents: 'funding_goal_cents',
  milestones: 'milestones',   // JSONB
};

const setClauses: string[] = [];
const values: unknown[] = [campaignId];

for (const [key, col] of Object.entries(fieldMap)) {
  if (key in input && (input as Record<string, unknown>)[key] !== undefined) {
    const isJsonb = ['milestones', 'teamMembers', ...].includes(key);
    setClauses.push(`${col} = $${values.length + 1}${isJsonb ? '::JSONB' : ''}`);
    values.push(isJsonb ? JSON.stringify(value) : value);
  }
}

if (setClauses.length === 0) return currentCampaign; // no-op

const sql = `UPDATE campaigns SET ${setClauses.join(', ')}, updated_at = NOW()
             WHERE id = $1 RETURNING *`;
```

Key points:
- Always append `updated_at = NOW()` regardless of which fields are provided.
- JSONB columns must be cast with `::JSONB` in the SET clause.
- If `setClauses` is empty, return the existing entity without hitting the DB.

**File:** `packages/backend/src/campaign/adapters/pg-campaign-repository.adapter.ts`

---

### P-020: Atomic conditional status transition (optimistic locking)

To prevent race conditions on campaign status changes, use a conditional WHERE clause
that checks the current status as part of the UPDATE:

```sql
UPDATE campaigns
SET status = $2, reviewer_user_id = $3, updated_at = NOW()
WHERE id = $1 AND status = $fromStatus
RETURNING *
```

If 0 rows are affected, another concurrent request already changed the status.
The repository throws a specific conflict error (e.g., `CampaignAlreadyClaimedError`)
which the error handler maps to HTTP 409:

```typescript
const result = await this.db.query(sql, [campaignId, toStatus, reviewerId]);
if (result.rowCount === 0) {
  throw new CampaignAlreadyClaimedError();
}
```

This is the same technique as the KYC `not_started → pending` pattern (G-020).

**File:** `packages/backend/src/campaign/adapters/pg-campaign-repository.adapter.ts`

---

### P-021: Best-effort audit events — error does not roll back main operation

Audit event inserts (and external metadata sync calls like Clerk `setPublicMetadata`)
must not cause the primary operation to fail if they throw. Wrap in try/catch and log:

```typescript
// Step 6: Persist (primary — must succeed)
const persistedUser = await this.userRepository.updateAccountStatus(...);

// Step 7: Sync Clerk metadata (best-effort)
try {
  await this.clerkAuth.setPublicMetadata(clerkUserId, { role: updatedUser.roles[0] ?? 'backer' });
} catch (err) {
  this.logger.warn({ clerkUserId, err }, 'Failed to sync publicMetadata to Clerk');
}

// Step 8: Audit (best-effort)
try {
  await this.auditLogger.log({ ... });
} catch (auditErr) {
  this.logger.error({ err: auditErr }, 'Failed to write audit event');
}
```

Log Clerk sync failures at `warn` (recoverable — JWT cache stale until next refresh).
Log audit failures at `error` (data integrity concern worth alerting on).

**Files:** `packages/backend/src/account/application/account-app-service.ts`,
`packages/backend/src/campaign/application/campaign-app-service.ts`

---

### P-022: `GET /api/v1/me/<resource>` served directly in app.ts

When a sub-resource belongs to the user context (`/me/campaigns`) but its service
is mounted at a different prefix (`/api/v1/campaigns`), add the `/me/...` route
directly in `app.ts` rather than in either router. This avoids cross-context
contamination and keeps each router's scope clean:

```typescript
// In app.ts — after mounting both routers
app.get('/api/v1/me/campaigns', requireAuth(), async (req, res, next) => {
  try {
    const clerkUserId = getClerkAuth(req)!;
    const campaigns = await services.campaignAppService.listMyCampaigns(clerkUserId);
    res.status(200).json({ data: campaigns.map(serializeCampaign) });
  } catch (err) {
    next(err);
  }
});
```

**File:** `packages/backend/src/app.ts`

---

### P-023: Cross-context read via shared repository injection

When a bounded context needs to read an entity owned by another context (e.g., Campaign
app service needs to verify the creator's role), inject the foreign repository as a
constructor parameter — do NOT import the foreign application service:

```typescript
export class CampaignAppService {
  constructor(
    private readonly campaignRepository: CampaignRepository,
    private readonly campaignAuditRepository: CampaignAuditRepository,
    private readonly userRepository: UserRepository,  // Cross-context read
    private readonly logger: Logger,
  ) {}
}
```

In the composition root, pass the same `userRepository` instance to both
`AccountAppService` and `CampaignAppService`:

```typescript
const userRepo = new PgUserRepository(db);
const accountService = new AccountAppService(userRepo, ...);
const campaignService = new CampaignAppService(campaignRepo, auditRepo, userRepo, logger);
```

No circular imports, no application-layer coupling between contexts.

**Files:** `packages/backend/src/campaign/application/campaign-app-service.ts`,
`packages/backend/src/composition-root.ts`

---

### P-024: `KycNotVerifiedError` lives in campaign errors, not kyc context

`KycNotVerifiedError` is defined in `campaign/domain/errors/campaign-errors.ts` because
it is a precondition error raised by the campaign context when it checks a user's KYC
status before allowing creator role assignment or campaign creation. It is not a KYC
workflow error (which would be in the `kyc` context).

The `assignCreatorRole` method in `AccountAppService` imports it from campaign errors:

```typescript
import { KycNotVerifiedError } from '../../campaign/domain/errors/campaign-errors.js';
```

**File:** `packages/backend/src/account/application/account-app-service.ts`

---

### P-025: Zod `z.enum()` requires a tuple type from `as const` arrays

Zod's `z.enum()` expects `[string, ...string[]]` (a non-empty tuple), not `string[]`.
When deriving the enum from a domain `as const` array, cast it:

```typescript
import { CAMPAIGN_CATEGORIES } from '../../domain/value-objects/campaign-category.js';

// Wrong — TypeScript error: Argument of type 'string[]' is not assignable to parameter
z.enum(CAMPAIGN_CATEGORIES)

// Correct
z.enum(CAMPAIGN_CATEGORIES as [string, ...string[]])
```

**File:** `packages/backend/src/campaign/api/schemas/update-campaign.schema.ts`























## feat-005 Patterns (Payments Bounded Context)

### Atomic payment capture transaction
When capturing a contribution, all side-effects must be wrapped in a single `PoolClient` transaction:
1. UPDATE contribution status → captured
2. INSERT escrow_ledger credit entry
3. UPDATE campaigns SET total_raised_cents = total_raised_cents + $amount, contributor_count = contributor_count + 1
4. If total_raised_cents >= funding_goal_cents: UPDATE campaigns SET status = 'funded'
5. COMMIT

Never split these across separate queries — partial state is unrecoverable.

### HTTP 201 for payment failure
When the payment gateway returns a failure, respond with HTTP 201 (not 422/400).
The contribution record exists with `status: 'failed'` and must be returned for client audit trail.

### Payment token handling
- Payment tokens must NEVER be logged at any layer (Pino, console, error messages)
- Tokens are stored in the contributions table for reconciliation but never returned in API responses
- Serialiser explicitly omits `paymentToken` from all response shapes

### Port interface satisfaction pattern
```typescript
// Define the port interface
export interface PaymentGatewayPort {
  capture(token: string, amountCents: number, contributionId: string): Promise<PaymentResult>;
}
// Stub adapter — satisfies interface without changes to application code
export class StubPaymentGatewayAdapter implements PaymentGatewayPort { ... }
```

### Route ordering (contribution vs campaign detail)
```tsx
// CORRECT — specific route before parameterised route
<Route path="/campaigns/:id/contribute" element={<ProtectedRoute><ContributeToMissionPage /></ProtectedRoute>} />
<Route path="/campaigns/:id" element={<PublicCampaignDetailPage />} />
```
