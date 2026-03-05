# PRD: feat-001 — Ports, Application Service & API Endpoints

> Sub-file 3 of 4. Part of `feat-001-spec.md`.
> Contents: Port interfaces, mock adapter behaviour, application service, API endpoint contracts.

---

## Directory Structure

```
packages/backend/src/account/
  domain/
    models/user.ts
    value-objects/account-status.ts
    value-objects/role.ts
    value-objects/kyc-status.ts
    value-objects/onboarding-step.ts
    value-objects/notification-preferences.ts
    errors/account-errors.ts
  ports/
    user-repository.port.ts
    clerk-auth.port.ts
    audit-logger.port.ts
  adapters/
    pg-user-repository.adapter.ts
    clerk-auth.adapter.ts
    pino-audit-logger.adapter.ts
    mock-clerk-auth.adapter.ts     (test only)
    in-memory-user-repository.adapter.ts  (test only)
  application/
    account-app-service.ts
  api/
    account-router.ts
    webhook-router.ts
    schemas/
      sync-user.schema.ts
      update-profile.schema.ts
      update-notifications.schema.ts
      webhook-clerk.schema.ts
```

---

## Port Interfaces

### `UserRepository`

**File:** `packages/backend/src/account/ports/user-repository.port.ts`

```typescript
interface UserRepository {
  save(user: User): Promise<void>;
  upsertByClerkUserId(user: User): Promise<User>;
  findById(id: string): Promise<User | null>;
  findByClerkUserId(clerkUserId: string): Promise<User | null>;
  updateProfile(clerkUserId: string, input: UpdateProfileInput): Promise<User>;
  updateNotificationPrefs(clerkUserId: string, prefs: NotificationPreferences): Promise<User>;
  updateAccountStatus(clerkUserId: string, status: AccountStatus, roles: Role[]): Promise<User>;
  touchLastSeen(clerkUserId: string): Promise<void>;
}
```

**Method contracts:**

| Method | Params | Returns | Notes |
|--------|--------|---------|-------|
| `save` | `user: User` | `Promise<void>` | INSERT only. Throws `UserAlreadyExistsError` on conflict (use `upsertByClerkUserId` for upserts). |
| `upsertByClerkUserId` | `user: User` | `Promise<User>` | `INSERT … ON CONFLICT (clerk_user_id) DO UPDATE` — updates `email`, `last_seen_at`, `account_status` if changed. Returns the persisted user. |
| `findById` | `id: string` | `Promise<User \| null>` | Lookup by internal UUID. Returns `null` if not found. |
| `findByClerkUserId` | `clerkUserId: string` | `Promise<User \| null>` | Primary lookup path from JWT. Returns `null` if not found. |
| `updateProfile` | `clerkUserId: string`, `input: UpdateProfileInput` | `Promise<User>` | Updates `display_name`, `bio`, `avatar_url`, `updated_at`. Returns updated user. Throws `UserNotFoundError` if user does not exist. |
| `updateNotificationPrefs` | `clerkUserId: string`, `prefs: NotificationPreferences` | `Promise<User>` | Updates full `notification_prefs` JSONB column. Returns updated user. |
| `updateAccountStatus` | `clerkUserId: string`, `status: AccountStatus`, `roles: Role[]` | `Promise<User>` | Atomic update of `account_status` and `roles`. Returns updated user. Used by webhook handler. |
| `touchLastSeen` | `clerkUserId: string` | `Promise<void>` | Updates `last_seen_at = NOW()`. No-op if user not found (idempotent). |

**Parameterised query requirement:** All queries use `$1`, `$2`, etc. placeholders. No string interpolation.

---

### `ClerkAuthPort`

**File:** `packages/backend/src/account/ports/clerk-auth.port.ts`

This port abstracts Clerk-specific SDK operations that the application service needs to perform (specifically, syncing `publicMetadata` after role changes). It does NOT wrap the JWT verification middleware — that remains as Clerk middleware directly on the Express app.

```typescript
interface ClerkAuthPort {
  getUserMetadata(clerkUserId: string): Promise<ClerkUserMetadata>;
  setPublicMetadata(clerkUserId: string, metadata: { role: string }): Promise<void>;
}

interface ClerkUserMetadata {
  clerkUserId: string;
  email: string;
  emailVerified: boolean;
  firstName: string | null;
  lastName: string | null;
}
```

**Method contracts:**

| Method | Params | Returns | Notes |
|--------|--------|---------|-------|
| `getUserMetadata` | `clerkUserId: string` | `Promise<ClerkUserMetadata>` | Calls Clerk Backend SDK `clerkClient.users.getUser(clerkUserId)`. Used by webhook handlers to resolve user details. |
| `setPublicMetadata` | `clerkUserId: string`, `metadata: { role: string }` | `Promise<void>` | Calls `clerkClient.users.updateUserMetadata(clerkUserId, { publicMetadata: metadata })`. Used after role assignment to cache primary role in JWT. |

**Mock adapter behaviour (`MockClerkAuthAdapter`):**

**File:** `packages/backend/src/account/adapters/mock-clerk-auth.adapter.ts`

| Method | Returns |
|--------|---------|
| `getUserMetadata('user_test_backer')` | `{ clerkUserId: 'user_test_backer', email: 'backer@test.mmf', emailVerified: true, firstName: 'Test', lastName: 'Backer' }` |
| `getUserMetadata('user_test_unverified')` | `{ clerkUserId: 'user_test_unverified', email: 'unverified@test.mmf', emailVerified: false, firstName: null, lastName: null }` |
| `getUserMetadata('user_test_admin')` | `{ clerkUserId: 'user_test_admin', email: 'admin@test.mmf', emailVerified: true, firstName: 'Test', lastName: 'Admin' }` |
| `getUserMetadata(any_other_id)` | Throws `UserNotFoundError` |
| `setPublicMetadata(any_id, any_metadata)` | Resolves silently (no-op in tests) |

---

### `AuditLoggerPort`

**File:** `packages/backend/src/account/ports/audit-logger.port.ts`

```typescript
interface AuditLoggerPort {
  log(entry: AuditEntry): Promise<void>;
}

interface AuditEntry {
  timestamp: Date;
  actorClerkUserId: string;
  action: AuditAction;
  resourceType: 'user';
  resourceId: string;       // MMF users.id (UUID)
  metadata?: Record<string, unknown>;
}

type AuditAction =
  | 'profile.updated'
  | 'notifications.updated'
  | 'role.assigned'
  | 'role.removed'
  | 'account.activated'
  | 'account.suspended'
  | 'user.synced';
```

For feat-001, the `PinoAuditLoggerAdapter` writes structured JSON log entries via pino. A persistent audit table is out of scope for feat-001 (defined in a later feature). All account state mutations MUST call `auditLogger.log()`.

**Mock adapter:** The mock implementation records calls in-memory (`entries: AuditEntry[]`). Tests can assert on `mockAuditLogger.entries` to verify logging occurred.

---

## PostgreSQL Adapter

### `PgUserRepository`

**File:** `packages/backend/src/account/adapters/pg-user-repository.adapter.ts`

Implements `UserRepository`. Uses `pg` Pool injected via constructor.

**Row-to-domain mapping:**

The adapter maps DB row columns (snake_case) to `UserData` properties (camelCase) before calling `User.reconstitute()`. The `notification_prefs` JSONB is mapped key-by-key per the mapping table in `feat-001-spec-data.md`.

**`upsertByClerkUserId` query pattern:**

```sql
INSERT INTO users (clerk_user_id, email, account_status, roles, notification_prefs, kyc_status, last_seen_at)
VALUES ($1, $2, $3, $4, $5, $6, NOW())
ON CONFLICT (clerk_user_id)
DO UPDATE SET
  email          = EXCLUDED.email,
  account_status = EXCLUDED.account_status,
  last_seen_at   = NOW(),
  updated_at     = NOW()
RETURNING *
```

**`updateAccountStatus` query pattern:**

```sql
UPDATE users
SET account_status = $1,
    roles          = $2,
    updated_at     = NOW()
WHERE clerk_user_id = $3
RETURNING *
```

**`updateProfile` query pattern:**

```sql
UPDATE users
SET display_name = $1,
    bio          = $2,
    avatar_url   = $3,
    updated_at   = NOW()
WHERE clerk_user_id = $4
RETURNING *
```

**`updateNotificationPrefs` query pattern:**

```sql
UPDATE users
SET notification_prefs = $1::JSONB,
    updated_at         = NOW()
WHERE clerk_user_id    = $2
RETURNING *
```

---

## Application Service

### `AccountAppService`

**File:** `packages/backend/src/account/application/account-app-service.ts`

**Dependencies (injected via constructor):**

| Dependency | Interface | Purpose |
|------------|-----------|---------|
| `userRepository` | `UserRepository` | Persistence |
| `clerkAuth` | `ClerkAuthPort` | Clerk metadata sync after role changes |
| `auditLogger` | `AuditLoggerPort` | Audit logging for all mutations |
| `logger` | `pino.Logger` | Structured operational logging |

---

#### `syncUser(input: SyncUserInput): Promise<User>`

Called by `POST /api/v1/auth/sync`.

```typescript
interface SyncUserInput {
  clerkUserId: string;  // From req.auth.userId (never from request body)
  email: string;        // From JWT claims or Clerk user record
  accountStatus: AccountStatus;
}
```

Steps:
1. Validate `clerkUserId` is non-empty. Throw `InvalidClerkUserIdError` if empty (should not reach here — `requireAuth()` blocks it, but defence in depth).
2. Normalise `email`: `email.toLowerCase().trim()`
3. Build a `User` via `User.create()` with the provided fields and defaults.
4. Call `userRepository.upsertByClerkUserId(user)` — creates if absent, updates `email` and `last_seen_at` if present.
5. Call `auditLogger.log({ action: 'user.synced', actorClerkUserId: clerkUserId, resourceType: 'user', resourceId: persistedUser.id, timestamp: new Date() })`
6. Return the persisted `User`.

**Error handling:**
- `InvalidClerkUserIdError` → log error, return `401 UNAUTHENTICATED` (middleware should have caught this)
- `InvalidEmailError` → log warning, return `400 VALIDATION_ERROR`
- Any unhandled database error → log error with pino, return `500 INTERNAL_ERROR`

---

#### `getMe(clerkUserId: string): Promise<User>`

Called by `GET /api/v1/me`.

Steps:
1. Call `userRepository.findByClerkUserId(clerkUserId)`.
2. If `null`, throw `UserNotFoundError`.
3. Return the `User`.

**Error handling:**
- `UserNotFoundError` → `404 USER_NOT_FOUND`

---

#### `updateProfile(clerkUserId: string, input: UpdateProfileInput): Promise<User>`

Called by `PATCH /api/v1/me/profile`.

```typescript
interface UpdateProfileInput {
  displayName?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
}
```

Steps:
1. Load current user: `userRepository.findByClerkUserId(clerkUserId)`. Throw `UserNotFoundError` if absent.
2. Call `user.updateProfile(input)` — validates field lengths, normalises empty strings to `null`.
3. Call `userRepository.updateProfile(clerkUserId, { displayName: updatedUser.displayName, bio: updatedUser.bio, avatarUrl: updatedUser.avatarUrl })`.
4. Call `auditLogger.log({ action: 'profile.updated', actorClerkUserId: clerkUserId, resourceType: 'user', resourceId: user.id, timestamp: new Date(), metadata: { fields: Object.keys(input).filter(k => input[k] !== undefined) } })`
5. Return the updated `User`.

**Error handling:**
- `UserNotFoundError` → `404 USER_NOT_FOUND`
- `DisplayNameTooLongError` → `400 VALIDATION_ERROR` (should be caught by Zod first — defence in depth)
- `BioTooLongError` → `400 VALIDATION_ERROR`
- `InvalidAvatarUrlError` → `400 VALIDATION_ERROR`

---

#### `getNotificationPrefs(clerkUserId: string): Promise<NotificationPreferences>`

Called by `GET /api/v1/me/notifications`.

Steps:
1. Call `userRepository.findByClerkUserId(clerkUserId)`. Throw `UserNotFoundError` if absent.
2. Return `user.notificationPrefs`.

---

#### `updateNotificationPrefs(clerkUserId: string, prefs: Partial<NotificationPreferences>): Promise<NotificationPreferences>`

Called by `PATCH /api/v1/me/notifications`.

Steps:
1. Load current user: `userRepository.findByClerkUserId(clerkUserId)`. Throw `UserNotFoundError` if absent.
2. Check `prefs.securityAlerts === false` — throw `SecurityAlertsCannotBeDisabledError` if so (also blocked by Zod schema).
3. Build merged preferences: `{ ...user.notificationPrefs, ...prefs, securityAlerts: true }` (always force `securityAlerts: true`).
4. Call `user.updateNotificationPrefs(mergedPrefs)`.
5. Call `userRepository.updateNotificationPrefs(clerkUserId, updatedUser.notificationPrefs)`.
6. Call `auditLogger.log({ action: 'notifications.updated', actorClerkUserId: clerkUserId, resourceType: 'user', resourceId: user.id, timestamp: new Date() })`
7. Return updated `user.notificationPrefs`.

**Error handling:**
- `UserNotFoundError` → `404 USER_NOT_FOUND`
- `SecurityAlertsCannotBeDisabledError` → `400 SECURITY_ALERTS_MANDATORY`

---

#### `handleClerkWebhook(event: ClerkWebhookEvent): Promise<void>`

Called by `POST /api/v1/webhooks/clerk`.

```typescript
interface ClerkWebhookEvent {
  type: 'user.created' | 'user.updated' | 'session.created';
  data: {
    id: string;                // Clerk user ID
    email_addresses: Array<{
      email_address: string;
      verification: { status: 'verified' | 'unverified' };
    }>;
    // session.created doesn't have email_addresses
  };
}
```

Steps for `user.created`:
1. Extract `clerkUserId = event.data.id`.
2. Extract primary email: `event.data.email_addresses[0].email_address`, normalised (lowercase, trimmed).
3. Determine `accountStatus`: if `event.data.email_addresses[0].verification.status === 'verified'` → `AccountStatus.Active`, else → `AccountStatus.PendingVerification`.
4. Determine `roles`: if `accountStatus === Active` → `[Role.Backer]`, else → `[]`.
5. Call `userRepository.upsertByClerkUserId(user)` with an `ON CONFLICT DO NOTHING` behaviour for the fields already set (do not overwrite roles if user already exists and is active).

**Revised step 5:** The upsert for `user.created` must not downgrade an existing `active` user to `pending_verification`. Use:

```sql
INSERT INTO users (clerk_user_id, email, account_status, roles, ...)
VALUES ($1, $2, $3, $4, ...)
ON CONFLICT (clerk_user_id)
DO UPDATE SET
  email        = EXCLUDED.email,
  last_seen_at = NOW(),
  updated_at   = NOW()
  -- Do NOT overwrite account_status or roles on user.created conflict
```

6. Call `auditLogger.log({ action: 'user.synced', ... })`.

Steps for `user.updated`:
1. Extract `clerkUserId`, primary email, and verification status.
2. Find existing user: `userRepository.findByClerkUserId(clerkUserId)`.
3. If user does not exist: create it (same logic as `user.created`).
4. If `verification.status === 'verified'` AND current `accountStatus !== Active`:
   - Call `userRepository.updateAccountStatus(clerkUserId, AccountStatus.Active, existingRoles.includes('backer') ? existingRoles : [...existingRoles, 'backer'])`.
   - Call `clerkAuth.setPublicMetadata(clerkUserId, { role: 'backer' })` — syncs primary role to JWT cache.
   - Call `auditLogger.log({ action: 'account.activated', ... })`.
5. If email has changed: call `userRepository.updateProfile(clerkUserId, { email: newEmail })` — note: `updateProfile` only sets `display_name`, `bio`, `avatar_url`; add a separate repository method `updateEmail` OR include email in the `updateAccountStatus` call.

**Correct email update approach:** Add `email` as an updatable field in `updateAccountStatus` signature:

```typescript
updateAccountStatus(
  clerkUserId: string,
  status: AccountStatus,
  roles: Role[],
  email?: string
): Promise<User>
```

6. For `session.created`: log the event at DEBUG level only; no state change required for feat-001.

**Idempotency:** All webhook handlers are idempotent. Processing the same event twice produces the same result (upsert semantics throughout).

**Error handling:**
- Any unhandled error → log with pino at ERROR level including `clerkUserId` and `event.type`; return `500` to Clerk (triggers retry). Do NOT swallow errors silently.
- Missing `email_addresses` array → log warning, return `200` (no-op, not actionable).

---

## API Endpoints

### Base path: `/api/v1`

All routes except `/health` and `/api/v1/webhooks/clerk` are protected by `requireAuth()` middleware.

**Middleware stack (applied in order):**

```typescript
app.use(pino-http middleware)          // request logging
app.use(clerkMiddleware())             // attaches req.auth to all requests
app.get('/health', healthHandler)      // unauthenticated
app.use('/api/v1/webhooks', webhookRouter)  // authenticated by HMAC, not Clerk
app.use('/api/v1', requireAuth({
  unauthorizedHandler: (req, res) =>
    res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } })
}))
app.use('/api/v1', accountRouter)
```

---

### `GET /health`

**Description:** Liveness check. No dependencies required to respond.
**Auth:** None.

**Success response:** `200 OK`
```json
{ "status": "ok", "timestamp": "2026-03-05T13:00:00.000Z" }
```

---

### `POST /api/v1/auth/sync`

**Description:** Upserts the MMF user record for the authenticated Clerk user. Called by the frontend after every sign-in (first-time and subsequent). Acts as lazy initialisation + last-seen refresh.
**Auth:** Required (Clerk JWT via `requireAuth()`).
**Roles:** Any authenticated user.

**Request body:**
```json
{}
```
The body is empty. All user data is derived from the JWT (`req.auth.userId`) and Clerk's user record. No user-supplied data is accepted.

**Processing:**
1. Extract `clerkUserId` from `req.auth.userId`.
2. Extract `email` from `req.auth.sessionClaims.email` if present in JWT template, otherwise call `clerkAuth.getUserMetadata(clerkUserId)` to fetch from Clerk API. Log a warning if the API call is needed (indicates missing JWT template config).
3. Determine `accountStatus` from `req.auth.sessionClaims.emailVerified` or fallback to Clerk metadata.
4. Call `accountAppService.syncUser({ clerkUserId, email, accountStatus })`.
5. Return the upserted user profile.

**Success response:** `200 OK`
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "clerkUserId": "user_2abc3XYZ",
    "email": "user@example.com",
    "displayName": null,
    "bio": null,
    "avatarUrl": null,
    "accountStatus": "active",
    "roles": ["backer"],
    "kycStatus": "not_started",
    "onboardingCompleted": false,
    "onboardingStep": null,
    "notificationPrefs": {
      "campaignUpdates": true,
      "milestoneCompletions": true,
      "contributionConfirmations": true,
      "recommendations": true,
      "securityAlerts": true,
      "platformAnnouncements": false
    },
    "lastSeenAt": "2026-03-05T13:00:00.000Z",
    "createdAt": "2026-03-05T12:00:00.000Z",
    "updatedAt": "2026-03-05T13:00:00.000Z"
  }
}
```

**Error responses:**

| Status | Code | When |
|--------|------|------|
| 401 | `UNAUTHENTICATED` | No valid Clerk JWT |
| 500 | `INTERNAL_ERROR` | Unexpected database error |

---

### `GET /api/v1/me`

**Description:** Returns the authenticated user's full profile, roles, KYC status, and notification preferences.
**Auth:** Required.
**Roles:** Any authenticated user.

**Request body:** None.

**Success response:** `200 OK`

Same shape as `POST /api/v1/auth/sync` success response above.

**Error responses:**

| Status | Code | When |
|--------|------|------|
| 401 | `UNAUTHENTICATED` | No valid Clerk JWT |
| 404 | `USER_NOT_FOUND` | Clerk JWT is valid but no MMF user record exists — user must call `/auth/sync` first |

---

### `PATCH /api/v1/me/profile`

**Description:** Updates the authenticated user's display name, bio, and/or avatar URL.
**Auth:** Required.
**Roles:** Any authenticated user.

**Request body:**
```json
{
  "displayName": "string | null — optional, max 255 chars",
  "bio": "string | null — optional, max 500 chars",
  "avatarUrl": "string | null — optional, valid absolute URL"
}
```

At least one field must be present. All fields are optional individually. Sending `null` for a field clears it. Sending an empty string is treated as `null`.

**Validation rules (Zod schema):**
- `displayName`: `z.string().max(255).nullable().optional().transform(v => v === '' ? null : v)`
- `bio`: `z.string().max(500).nullable().optional().transform(v => v === '' ? null : v)`
- `avatarUrl`: `z.string().url().nullable().optional()`
- Schema uses `.strict()` — unknown keys cause `400 VALIDATION_ERROR`
- At least one field must be present: custom Zod refine

**Success response:** `200 OK`

```json
{
  "data": {
    "id": "...",
    "clerkUserId": "...",
    "email": "...",
    "displayName": "Ada Lovelace",
    "bio": "Mars enthusiast",
    "avatarUrl": null,
    "accountStatus": "active",
    "roles": ["backer"],
    "kycStatus": "not_started",
    "onboardingCompleted": false,
    "onboardingStep": null,
    "notificationPrefs": { ... },
    "lastSeenAt": "...",
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

**Error responses:**

| Status | Code | When |
|--------|------|------|
| 400 | `VALIDATION_ERROR` | Input fails Zod validation (field too long, invalid URL, unknown key, no fields) |
| 401 | `UNAUTHENTICATED` | No valid Clerk JWT |
| 404 | `USER_NOT_FOUND` | No MMF user record |

---

### `GET /api/v1/me/notifications`

**Description:** Returns the authenticated user's notification preferences.
**Auth:** Required.
**Roles:** Any authenticated user.

**Request body:** None.

**Success response:** `200 OK`
```json
{
  "data": {
    "campaignUpdates": true,
    "milestoneCompletions": true,
    "contributionConfirmations": true,
    "recommendations": true,
    "securityAlerts": true,
    "platformAnnouncements": false
  }
}
```

**Error responses:**

| Status | Code | When |
|--------|------|------|
| 401 | `UNAUTHENTICATED` | No valid Clerk JWT |
| 404 | `USER_NOT_FOUND` | No MMF user record |

---

### `PATCH /api/v1/me/notifications`

**Description:** Updates the authenticated user's notification preferences. Only provided fields are updated (partial update / merge semantics).
**Auth:** Required.
**Roles:** Any authenticated user.

**Request body:**
```json
{
  "campaignUpdates": "boolean — optional",
  "milestoneCompletions": "boolean — optional",
  "contributionConfirmations": "boolean — optional",
  "recommendations": "boolean — optional",
  "platformAnnouncements": "boolean — optional"
}
```

`securityAlerts` is NOT an accepted key. Sending it (as any value) causes `400 VALIDATION_ERROR`.

**Validation rules (Zod schema):**
- Schema uses `.strict()` — unknown keys rejected (this prevents `securityAlerts` being sent)
- Each field: `z.boolean().optional()`
- At least one field must be present

**Success response:** `200 OK`
```json
{
  "data": {
    "campaignUpdates": true,
    "milestoneCompletions": true,
    "contributionConfirmations": true,
    "recommendations": false,
    "securityAlerts": true,
    "platformAnnouncements": false
  }
}
```

Note: `securityAlerts` is always `true` in the response even though it is not accepted in the request body.

**Error responses:**

| Status | Code | When |
|--------|------|------|
| 400 | `VALIDATION_ERROR` | Input fails Zod (unknown key, non-boolean value, no fields) |
| 400 | `SECURITY_ALERTS_MANDATORY` | `securityAlerts` key is present (caught by `.strict()` before this code is reached, but included for completeness) |
| 401 | `UNAUTHENTICATED` | No valid Clerk JWT |
| 404 | `USER_NOT_FOUND` | No MMF user record |

---

### `POST /api/v1/webhooks/clerk`

**Description:** Receives Clerk lifecycle webhooks. Verified via Svix HMAC signature.
**Auth:** HMAC-SHA256 signature verification using `CLERK_WEBHOOK_SECRET`. NOT Clerk JWT auth.
**Roles:** N/A (not user-facing).

**Webhook events handled:** `user.created`, `user.updated` (feat-001). `session.created` is received and acknowledged with no action.

**Signature verification:**

```typescript
import { Webhook } from 'svix'

const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET!)
const payload = wh.verify(rawBody, {
  'svix-id': req.headers['svix-id'],
  'svix-timestamp': req.headers['svix-timestamp'],
  'svix-signature': req.headers['svix-signature'],
})
```

IMPORTANT: `rawBody` must be the raw, unparsed request body bytes. Do NOT pass a parsed JSON object. Use `express.raw({ type: 'application/json' })` middleware on this route specifically.

**Signature failure:** Return `400` with body `{ "error": { "code": "INVALID_SIGNATURE", "message": "Webhook signature verification failed" } }`. Log as security event via pino at WARN level with field `securityEvent: true`.

**Success response:** `200 OK`
```json
{ "received": true }
```

**Error responses:**

| Status | Code | When |
|--------|------|------|
| 400 | `INVALID_SIGNATURE` | Svix signature verification fails |
| 400 | `UNKNOWN_EVENT_TYPE` | Event type not in the handled set (log and acknowledge) |
| 500 | `INTERNAL_ERROR` | Database error during user upsert (Clerk will retry) |

**Note on unknown event types:** Rather than returning 400, return `200` with `{ "received": true, "processed": false }` for unknown event types. This prevents Clerk from retrying events MMF doesn't care about.

---

## Standard Error Response Format

All error responses use this envelope:

```json
{
  "error": {
    "code": "MACHINE_READABLE_CODE",
    "message": "Human-readable message for display"
  }
}
```

**Human-readable messages follow brand voice (L2-001 Section 4.3):**

| Code | HTTP | Message |
|------|------|---------|
| `UNAUTHENTICATED` | 401 | `"Authentication required. Sign in to continue."` |
| `USER_NOT_FOUND` | 404 | `"We couldn't find your account. Try signing in again."` |
| `VALIDATION_ERROR` | 400 | `"Check your input and try again."` (field-specific detail in future) |
| `SECURITY_ALERTS_MANDATORY` | 400 | `"Security alerts are required and cannot be turned off."` |
| `INVALID_SIGNATURE` | 400 | `"Invalid webhook signature."` |
| `INTERNAL_ERROR` | 500 | `"Something went wrong on our end. We're looking into it."` |

---

## Environment Variables

Add to `.env` and `.env.example`:

```bash
# Clerk — Backend
CLERK_SECRET_KEY=sk_test_...              # Required
CLERK_PUBLISHABLE_KEY=pk_test_...         # Required (used by frontend)
CLERK_WEBHOOK_SECRET=whsec_...            # Required for webhook verification

# Database
DATABASE_URL=postgres://user:pass@localhost:5432/mmf_dev

# App
NODE_ENV=development
PORT=3000
LOG_LEVEL=info
```

`.env.example` placeholders:
```bash
CLERK_SECRET_KEY=sk_test_your_clerk_secret_key_here
CLERK_PUBLISHABLE_KEY=pk_test_your_clerk_publishable_key_here
CLERK_WEBHOOK_SECRET=whsec_your_webhook_secret_here
DATABASE_URL=postgres://postgres:postgres@localhost:5432/mmf_dev
NODE_ENV=development
PORT=3000
LOG_LEVEL=info
```




























