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






















