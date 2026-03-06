# feat-005 Research: KYC Identity Verification (Stub Adapter)

> Researcher output — all open questions resolved. Ready for implementation.

---

## 1. DB Schema Analysis

**File:** `db/migrations/20260306000003_create_kyc.sql`

### Columns

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `user_id` | UUID | FK → `users(id) ON DELETE CASCADE`, UNIQUE |
| `status` | TEXT | CHECK constraint (see below) |
| `provider_reference` | TEXT NULL | For real Veriff session IDs — null in stub |
| `verified_at` | TIMESTAMPTZ NULL | Set when status reaches `verified` |
| `expires_at` | TIMESTAMPTZ NULL | Out of scope for feat-005, always null |
| `failure_count` | INT NOT NULL DEFAULT 0 | Tracks rejections — out of scope for feat-005 |
| `created_at` | TIMESTAMPTZ NOT NULL DEFAULT NOW() | Standard |
| `updated_at` | TIMESTAMPTZ NOT NULL DEFAULT NOW() | Auto-updated by trigger |

### Status values (CHECK constraint)

```
'not_verified'
'pending'
'pending_resubmission'
'in_manual_review'
'verified'
'expired'
're_verification_required'
'rejected'
'locked'
```

For feat-005, only these transitions are used: `not_verified → pending → verified` (within one request via stub). `pending_resubmission` is the allowed re-entry state after a prior rejection (out of scope for feat-005, but the schema supports it). The `not_verified` status is the implicit default when no row exists — a row is only created on first submission.

### Indexes

- `CONSTRAINT kyc_verifications_user_id_unique UNIQUE (user_id)` — enforces one row per user
- `CREATE UNIQUE INDEX IF NOT EXISTS idx_kyc_verifications_user_id ON kyc_verifications (user_id)` — explicit index for lookup performance

### Trigger

`set_kyc_verifications_updated_at` — BEFORE UPDATE trigger using the shared `update_updated_at_column()` function. Already defined by prior migrations (feat-002 pattern). `updated_at` is automatically maintained.

### Key constraint for upsert logic

The `UNIQUE` constraint on `user_id` means the repository can use `INSERT ... ON CONFLICT (user_id) DO UPDATE` for upsert semantics. No separate SELECT needed before INSERT.

---

## 2. IKycAdapter Port Interface Design

**Location:** `packages/backend/src/kyc/ports/kyc-adapter.ts`

The KYC bounded context is new and should live in `packages/backend/src/kyc/` (parallel to `account/`). The port interface should be:

```typescript
export type KycDocumentType = 'passport' | 'national_id' | 'drivers_licence';

export type KycStatus =
  | 'not_verified'
  | 'pending'
  | 'pending_resubmission'
  | 'in_manual_review'
  | 'verified'
  | 'expired'
  | 're_verification_required'
  | 'rejected'
  | 'locked';

export interface KycVerification {
  readonly userId: string;
  readonly status: KycStatus;
  readonly verifiedAt: Date | null;
  readonly providerReference: string | null;
}

export interface SubmitKycInput {
  readonly userId: string;
  readonly documentType: KycDocumentType;
}

export interface IKycAdapter {
  getStatus(userId: string): Promise<KycVerification | null>;
  submit(input: SubmitKycInput): Promise<KycVerification>;
}
```

**Rationale:**
- `getStatus` returns `null` when no row exists (user never submitted) — callers treat `null` as `not_verified`
- `submit` handles the full transition including auto-approval in the stub — returns the final state
- No separate `approve()` or `reject()` methods: the stub's auto-approval happens inside `submit()`
- `KycVerification` is a plain data object (not a domain entity) — it is a read model returned by the adapter
- `providerReference` is included so the real Veriff adapter can populate it; the stub always returns `null`
- The interface lives in `ports/` — the domain and application service only import from here

---

## 3. Stub Adapter: Auto-Approval Flow

**Location:** `packages/backend/src/kyc/adapters/stub/stub-kyc-adapter.ts`

The stub implements `IKycAdapter` and auto-approves within the same `submit()` call:

```
submit() called
  → upsert row: status = 'pending'
  → immediately upsert again: status = 'verified', verified_at = NOW()
  → return { status: 'verified', verifiedAt: <now> }
```

This is synchronous from the caller's perspective (single async function, two DB writes). No background job, no webhook, no delay.

**Implementation details:**
- The stub adapter holds a `Pool` reference and performs the two upserts directly via parameterised SQL
- Both writes can be wrapped in a single transaction: BEGIN → INSERT/UPDATE to pending → UPDATE to verified → COMMIT
- If the user is already `verified`, re-submit sets them back to `pending` then immediately to `verified` again (idempotent outcome, `verified_at` is refreshed)
- `provider_reference` is always `null` in the stub
- `failure_count` is never incremented by the stub

**Why application service layer, not controller:** The stub adapter is injected into a `KycService` application service. The controller calls `kycService.submitVerification(userId, documentType)` and receives the final `KycVerification` result. The controller never knows whether it's the stub or real Veriff.

---

## 4. KYC Repository

**Location:** `packages/backend/src/kyc/adapters/pg/pg-kyc-repository.ts`

A separate `IKycRepository` port handles raw persistence. The stub adapter delegates to this repository:

```typescript
export interface IKycRepository {
  findByUserId(userId: string): Promise<KycVerificationRow | null>;
  upsert(userId: string, fields: { status: KycStatus; verifiedAt?: Date | null; providerReference?: string | null }): Promise<KycVerificationRow>;
}
```

**Upsert SQL pattern:**

```sql
INSERT INTO kyc_verifications (id, user_id, status, verified_at, provider_reference)
VALUES (gen_random_uuid(), $1, $2, $3, $4)
ON CONFLICT (user_id)
DO UPDATE SET
  status = EXCLUDED.status,
  verified_at = EXCLUDED.verified_at,
  provider_reference = EXCLUDED.provider_reference,
  updated_at = NOW()
RETURNING *;
```

This handles both first-time creation and updates atomically.

---

## 5. KYC Service (Application Layer)

**Location:** `packages/backend/src/kyc/application/kyc-service.ts`

```typescript
export class KycService {
  constructor(
    private readonly kycAdapter: IKycAdapter,
    private readonly logger: Logger,
  ) {}

  async getStatus(userId: string): Promise<KycVerification | null> { ... }
  async submitVerification(userId: string, documentType: KycDocumentType): Promise<KycVerification> { ... }
  async requireVerified(userId: string): Promise<void> { ... } // throws KycRequiredError if not verified
}
```

`requireVerified` is the gating method called by creator-gated endpoints.

---

## 6. Creator-Gated Endpoints: KYC Check Placement

**Decision: Application service layer, not middleware.**

Per the PRD: "KYC status is checked at the application service layer via the `IKycAdapter` interface — never directly querying the `kyc_verifications` table from a controller."

**Pattern:** Each creator-gated route handler calls `kycService.requireVerified(req.auth.userId)` before executing its business logic, or the application service for that feature calls it.

For feat-005 specifically there are no campaign endpoints yet — the check is implemented now so future campaign submission endpoints simply call `kycService.requireVerified()`.

**403 KYC_REQUIRED response format:**

```json
{
  "error": {
    "code": "KYC_REQUIRED",
    "message": "Identity verification is required to access this feature."
  }
}
```

**Domain error:**

```typescript
// packages/backend/src/kyc/domain/errors.ts
export class KycRequiredError extends DomainError {
  readonly code = 'KYC_REQUIRED' as const;
  constructor() {
    super('KYC_REQUIRED', 'Identity verification is required to access this feature.');
  }
}
```

The controller catches `KycRequiredError` and returns 403. The global error handler does not need to know about it — controllers handle it inline.

---

## 7. API Router Structure

**New KYC router:** `packages/backend/src/kyc/api/kyc-router.ts`

Mounted in `server.ts` via the top-level API router:

```
GET  /api/v1/kyc/status   → kycRouter
POST /api/v1/kyc/submit   → kycRouter
```

**Update to `packages/backend/src/account/api/api-router.ts`:** The existing `createApiRouter` function accepts `userRepository` and `profileService`. It needs to be extended (or a separate top-level router created) to also mount the KYC router. The cleanest approach: add `kycService: KycService` as a third parameter to `createApiRouter` and mount `createKycRouter(kycService)` at `/kyc`.

**`server.ts` composition root additions:**

```typescript
const IS_MOCK_KYC = process.env.MOCK_KYC !== 'false'; // default true
const kycAdapter = IS_MOCK_KYC
  ? new StubKycAdapter(pool)
  : new VeriffKycAdapter(pool); // real adapter stubbed for now — same as stub
const kycService = new KycService(kycAdapter, logger);
// pass kycService to createApiRouter
```

`MOCK_KYC` defaults to `true` if the env var is absent (i.e. `process.env.MOCK_KYC !== 'false'`). This mirrors the convention where local demo always uses the stub.

---

## 8. API Response Shapes

### GET /api/v1/kyc/status

Returns 200 always (no 404 — absence of a row means `not_verified`):

```json
{
  "data": {
    "status": "not_verified",
    "verifiedAt": null
  }
}
```

```json
{
  "data": {
    "status": "verified",
    "verifiedAt": "2026-03-06T12:34:56.000Z"
  }
}
```

`verifiedAt` is an ISO 8601 UTC string or `null`. Uses `.toISOString()` — same pattern as `createdAt`/`updatedAt` in the user response.

### POST /api/v1/kyc/submit

**Request body** (Zod validated, `.strict()`):

```json
{
  "documentType": "passport"
}
```

Valid values: `"passport"`, `"national_id"`, `"drivers_licence"`

**Success response — 202 Accepted** (the PRD specifies 202):

```json
{
  "data": {
    "status": "verified",
    "verifiedAt": "2026-03-06T12:34:56.000Z"
  }
}
```

The stub returns `verified` immediately. A real adapter would return `pending` here and the status would update asynchronously — 202 signals the submission was accepted and processing may be ongoing.

**Error responses:**
- 400 `VALIDATION_ERROR` — invalid `documentType`
- 401 `UNAUTHORIZED` — no auth
- 409 `ALREADY_VERIFIED` — user is already `verified` and re-submission is not allowed

Wait — the PRD says "transitions from `not_verified` or `pending_resubmission` to `pending`". This implies that if status is `verified`, re-submission should be blocked. A 409 is the correct status code for a conflict with current state.

---

## 9. Frontend KYC Page: What Changes

**Current state (`packages/frontend/src/pages/kyc-stub.tsx`):**
- Static stub page, no API calls
- Shows "KYC verification is not yet available"
- Has a "Go Back" button
- No document type selector, no submit button

**Required changes:**
- Replace the entire page content (the file is being replaced, not extended)
- Fetch `GET /api/v1/kyc/status` via a new `useKycStatus()` hook
- If status is `verified`: show success state with "Verification approved" copy
- If status is `not_verified` or `pending_resubmission`: show the form
- If status is `pending`: show a "Verification pending" state (edge case — stub resolves synchronously, but guards against stale state)
- Form contains:
  - Document type selector (radio group or `<select>`): `passport`, `national_id`, `drivers_licence`
  - Submit button (primary CTA)
- On submit: call `POST /api/v1/kyc/submit` via a `useSubmitKyc()` mutation hook
- On success: invalidate `['kyc-status']` query → page re-renders showing success state
- Success state shows "Verification approved" with a "Return to profile" link

**Document type display labels:**
- `passport` → "Passport"
- `national_id` → "National ID"
- `drivers_licence` → "Driver's Licence"

**New hooks:**
- `packages/frontend/src/hooks/use-kyc-status.ts` — `useQuery` on `['kyc-status']`, calls `GET /api/v1/kyc/status`
- `packages/frontend/src/hooks/use-submit-kyc.ts` — `useMutation`, calls `POST /api/v1/kyc/submit`, on success invalidates `['kyc-status']`

**New type:**
- `packages/frontend/src/types/kyc.ts` — `KycStatusResponse { data: { status: string; verifiedAt: string | null } }`

**Test file (`kyc-stub.test.tsx`):** All 4 existing tests will break when the component is rewritten. The test file must be fully replaced with tests covering: loading state, `not_verified` state (form visible), `verified` state (success copy), submission flow, error state.

---

## 10. Profile Page: KYC Status Integration

**Current state (`packages/frontend/src/pages/profile.tsx`):**
- Hard-coded "Identity verification not yet started." text and "Start verification →" link
- No API call for KYC status

**Required changes:**
- Import and use `useKycStatus()` hook in the KYC section
- Render different content based on status:
  - `not_verified` / no row: "Identity verification not yet started." + "Start verification →" link (current text, no change)
  - `pending`: "Verification pending review." (no link needed)
  - `verified`: "Identity verified." with `--color-status-success` colour + no link
  - Error/loading: keep current static text as fallback

**Important:** The KYC section in `profile.tsx` currently hardcodes the "not yet started" text. The profile page uses `useCurrentUser()` which does NOT return KYC status — KYC status is a separate data domain. The profile page needs to call `useKycStatus()` independently. This is a second `useQuery` call on the profile page, which is fine — TanStack Query deduplicates.

**Profile test (`profile.test.tsx`):** Currently has a test asserting "Identity verification not yet started" text. That test will still pass for the `not_verified` case, but the test setup needs a mock for `useKycStatus`.

---

## 11. MOCK_KYC Environment Variable

**Pattern (from `server.ts`):**

```typescript
const IS_MOCK_KYC = process.env.MOCK_KYC !== 'false'; // default: true
```

This mirrors `IS_MOCK_AUTH = process.env.MOCK_AUTH === 'true'` but inverts the default — KYC stub is on by default (no env var needed for local demo), opt-out by setting `MOCK_KYC=false`.

**`.env.example` addition:**

```
MOCK_KYC=true   # Set to false to use real Veriff adapter (not yet implemented)
```

**Where it is read:** `server.ts` composition root only, at module scope. Never per-request.

**Note on consistency:** `MOCK_AUTH` defaults to `false` (requires explicit opt-in). `MOCK_KYC` should default to `true` (local demo scope — real Veriff is out of scope). This asymmetry is intentional and matches the PRD note "default to `true` for local demo".

---

## 12. Edge Cases and Their Handling

### User submits KYC when already `verified`

**Decision: Return 409 ALREADY_VERIFIED.**

The PRD says submit transitions from `not_verified` or `pending_resubmission`. A `verified` user attempting to re-submit gets 409. The service layer checks current status before calling the adapter:

```typescript
async submitVerification(userId: string, documentType: KycDocumentType): Promise<KycVerification> {
  const current = await this.kycAdapter.getStatus(userId);
  if (current?.status === 'verified') {
    throw new AlreadyVerifiedError();
  }
  return this.kycAdapter.submit({ userId, documentType });
}
```

### User submits KYC from `pending` state

`pending` is not in the allowed transition states per the PRD (`not_verified` or `pending_resubmission` only). In the stub this state can only be reached if the stub fails mid-transaction (unlikely). Decision: treat `pending` as an allowed re-submission state (same as `not_verified`) — it is safer than blocking and the stub will resolve to `verified` immediately anyway.

### Concurrent submissions (race condition)

The `UNIQUE` constraint on `user_id` and the `ON CONFLICT DO UPDATE` upsert pattern mean concurrent writes are serialised by the DB. No explicit application-level locking needed. The last write wins, which is fine for the stub's auto-approval scenario.

### User with no row calls GET /api/v1/kyc/status

The repository returns `null`. The service returns `{ status: 'not_verified', verifiedAt: null }` without creating a row. A row is only created on the first POST /api/v1/kyc/submit.

### User calls a Creator-gated endpoint without creator role

Two separate checks are needed: (1) the user must have the `creator` role, and (2) the user's KYC status must be `verified`. For feat-005, only the KYC check is implemented (since campaign submission endpoints are in a future feature). The role check is already enforced by the `user_roles` table — a user with `creator` role but unverified KYC will get 403 KYC_REQUIRED.

### Document type not in allowed list

The Zod schema uses `z.enum(['passport', 'national_id', 'drivers_licence']).strict()` — any other value returns 400 VALIDATION_ERROR before reaching the service layer.

---

## 13. Integration Test Strategy

**Test file:** `packages/backend/src/kyc/api/kyc-router.test.ts`

**Pattern:** Follows `me-router.test.ts` exactly — builds a `buildTestApp()` function using `MockUserRepository` and a `MockKycAdapter` (in-memory, no DB), uses supertest with `Authorization: Bearer mock-token`.

### Tests to write:

**GET /api/v1/kyc/status**
- Returns `{ data: { status: 'not_verified', verifiedAt: null } }` when no KYC row exists (200)
- Returns `{ data: { status: 'verified', verifiedAt: <ISO string> } }` after verification (200)
- Returns 401 without auth header

**POST /api/v1/kyc/submit**
- Returns 202 with `{ data: { status: 'verified', verifiedAt: <not null> } }` for valid submission (200 = verified immediately)
- Subsequent GET returns `{ status: 'verified' }` (the acceptance criterion test)
- Returns 400 VALIDATION_ERROR for invalid `documentType`
- Returns 400 VALIDATION_ERROR for unknown fields (`.strict()`)
- Returns 409 ALREADY_VERIFIED when user is already verified
- Returns 401 without auth header

**Creator-gated endpoint KYC check (acceptance criterion)**
- A user with `not_verified` KYC status calling a creator-gated endpoint returns 403 KYC_REQUIRED

### Mock KYC adapter for tests

`packages/backend/src/kyc/adapters/mock/mock-kyc-adapter.ts` — in-memory Map, no DB:

```typescript
export class MockKycAdapter implements IKycAdapter {
  private readonly store: Map<string, KycVerification> = new Map();

  async getStatus(userId: string): Promise<KycVerification | null> {
    return this.store.get(userId) ?? null;
  }

  async submit(input: SubmitKycInput): Promise<KycVerification> {
    const result: KycVerification = {
      userId: input.userId,
      status: 'verified',
      verifiedAt: new Date(),
      providerReference: null,
    };
    this.store.set(input.userId, result);
    return result;
  }

  // Test helper
  setStatus(userId: string, status: KycStatus, verifiedAt: Date | null = null): void {
    this.store.set(userId, { userId, status, verifiedAt, providerReference: null });
  }
}
```

---

## 14. File Structure Summary

### New backend files

```
packages/backend/src/kyc/
├── domain/
│   └── errors.ts                          # KycRequiredError, AlreadyVerifiedError
├── ports/
│   ├── kyc-adapter.ts                     # IKycAdapter, KycVerification, SubmitKycInput, KycDocumentType, KycStatus
│   └── kyc-repository.ts                  # IKycRepository (used by PgKycRepository and StubKycAdapter)
├── adapters/
│   ├── stub/
│   │   └── stub-kyc-adapter.ts            # Implements IKycAdapter — auto-approves, writes to DB
│   ├── pg/
│   │   └── pg-kyc-repository.ts           # Implements IKycRepository — raw SQL upsert
│   └── mock/
│       └── mock-kyc-adapter.ts            # In-memory adapter for unit/integration tests
├── application/
│   └── kyc-service.ts                     # KycService — getStatus, submitVerification, requireVerified
└── api/
    ├── kyc-router.ts                      # Express router: GET /status, POST /submit
    └── kyc-router.test.ts                 # Integration tests (supertest + MockKycAdapter)
```

### Modified backend files

- `packages/backend/src/account/api/api-router.ts` — add `kycService` param, mount `createKycRouter(kycService)` at `/kyc`
- `packages/backend/src/server.ts` — read `MOCK_KYC`, wire `StubKycAdapter` → `KycService`, pass to `createApiRouter`

### New frontend files

```
packages/frontend/src/
├── types/kyc.ts                           # KycStatusResponse type
├── hooks/
│   ├── use-kyc-status.ts                  # useQuery on ['kyc-status']
│   └── use-submit-kyc.ts                  # useMutation, invalidates ['kyc-status'] on success
```

### Modified frontend files

- `packages/frontend/src/pages/kyc-stub.tsx` — full replacement with real KYC form/status UI
- `packages/frontend/src/pages/kyc-stub.test.tsx` — full replacement (all 4 existing tests become stale)
- `packages/frontend/src/pages/profile.tsx` — KYC section reads from `useKycStatus()` instead of hardcoded text
- `packages/frontend/src/pages/profile.test.tsx` — add mock for `useKycStatus`, add KYC status rendering tests

### New env var

- `MOCK_KYC=true` added to `.env.example`

---

## 15. Decisions Summary

| Question | Decision |
|---|---|
| Auto-approval timing | Synchronous within `submit()` — two writes in one transaction |
| Where KYC check lives | Application service (`KycService.requireVerified()`) — not middleware |
| `GET /status` when no row | Returns `{ status: 'not_verified', verifiedAt: null }` — no 404 |
| `POST /submit` HTTP status | 202 Accepted |
| Already-verified re-submit | 409 ALREADY_VERIFIED |
| `verifiedAt` format | ISO 8601 UTC string via `.toISOString()` or `null` |
| `MOCK_KYC` default | `true` — opt-out via `MOCK_KYC=false` |
| Profile page KYC display | Separate `useKycStatus()` call — not bundled in `GET /me` |
| KYC bounded context location | `packages/backend/src/kyc/` — separate from `account/` |
| DB upsert strategy | `INSERT ... ON CONFLICT (user_id) DO UPDATE` |
| Concurrent submissions | DB-level serialisation via unique constraint — no app lock needed |
