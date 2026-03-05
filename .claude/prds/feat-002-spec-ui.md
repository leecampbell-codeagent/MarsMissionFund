# PRD: feat-002 — Frontend, Edge Cases & Testing

> Sub-file 4 of 4. Part of `feat-002-spec.md`.
> Contents: Frontend specification, edge cases, testing requirements.

---

## Frontend Specification

### Updated Type Definitions

#### `UserProfile` (modified)

**File:** `packages/frontend/src/api/account-api.ts`

**Change:** Update `kycStatus` union to replace `'failed'` with `'rejected'` (aligning with the migration in `feat-002-spec-data.md`):

```typescript
interface UserProfile {
  // ... existing fields unchanged ...
  readonly kycStatus: 'not_started' | 'pending' | 'in_review' | 'verified' | 'rejected' | 'expired';
  // ... existing fields unchanged ...
}
```

---

### New API Functions

**File:** `packages/frontend/src/api/kyc-api.ts`

```typescript
export interface KycStatusResponse {
  readonly kycStatus: 'not_started' | 'pending' | 'in_review' | 'verified' | 'rejected' | 'expired';
  readonly updatedAt: string; // ISO 8601 string
}

export async function getKycStatus(getToken: () => Promise<string | null>): Promise<KycStatusResponse>

export async function submitKyc(getToken: () => Promise<string | null>): Promise<UserProfile>
```

Both functions use the centralised API client from `packages/frontend/src/api/client.ts`. `submitKyc` returns the full `UserProfile` (the API returns the complete user object so the frontend does not need a separate `GET /me` call after submission).

---

### New Hooks

#### `useKycStatus`

**File:** `packages/frontend/src/hooks/useKycStatus.ts`

```typescript
export function useKycStatus(): {
  readonly kycStatus: KycStatusResponse | null;
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly error: ApiError | null;
}
```

Uses `useQuery`:
- Query key: `['kyc', 'status']`
- Query function: `GET /api/v1/kyc/status`
- `staleTime`: 0 (KYC status is authoritative real-time data — always fresh, EC-011)
- `retry`: 1
- `refetchOnWindowFocus`: true

**Note on EC-011 (stale data):** `GET /api/v1/kyc/status` is the authoritative real-time source. The `['me']` query (stale time 30s) may lag behind after a status change. The frontend must invalidate `['me']` after calling `submitKyc` (see `useKycSubmit`).

---

#### `useKycSubmit`

**File:** `packages/frontend/src/hooks/useKycSubmit.ts`

```typescript
export function useKycSubmit(): {
  readonly submitKyc: () => Promise<void>;
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly error: ApiError | null;
}
```

Uses `useMutation`:
- Mutation function: `POST /api/v1/kyc/submit`
- On success:
  1. Invalidate `['me']` query (so `useCurrentUser` reflects `kycStatus: 'verified'`)
  2. Invalidate `['kyc', 'status']` query
- On error: surface error to the component via `isError` and `error`

**Important:** Because `POST /api/v1/kyc/submit` returns the full user profile in its response body, the mutation can also update the `['me']` TanStack Query cache directly using `queryClient.setQueryData(['me'], response.data)` on success, avoiding an unnecessary re-fetch.

---

### Directory Structure

```
packages/frontend/src/
  api/
    kyc-api.ts                            (new)
  hooks/
    useKycStatus.ts                       (new)
    useKycSubmit.ts                       (new)
  components/
    kyc/
      KycStatusBadge.tsx                  (new)
      KycVerificationPanel.tsx            (new)
  pages/
    ProfilePage.tsx                       (modified — add KYC section)
```

---

### New Components

#### `KycStatusBadge`

**File:** `packages/frontend/src/components/kyc/KycStatusBadge.tsx`

```typescript
interface KycStatusBadgeProps {
  readonly kycStatus: 'not_started' | 'pending' | 'in_review' | 'verified' | 'rejected' | 'expired';
}
```

**Functional requirements:**
- Renders a status badge communicating the user's KYC state. Status badge patterns follow L2-001 Section 3.5.
- The badge text and visual treatment per status:

| `kycStatus` | Badge text | Token |
|------------|-----------|-------|
| `not_started` | `"Identity Verification Required"` | `--color-status-warning` |
| `pending` | `"Verification In Progress"` | `--color-status-warning` |
| `in_review` | `"Under Review"` | `--color-status-warning` |
| `verified` | `"Identity Verified"` | `--color-status-success` |
| `rejected` | `"Verification Failed"` | `--color-status-error` |
| `expired` | `"Verification Expired"` | `--color-status-error` |

- Uses `--type-label` (Space Mono) for badge text.
- Named export: `export function KycStatusBadge(props: KycStatusBadgeProps): JSX.Element`
- Has a `.test.tsx` file.

---

#### `KycVerificationPanel`

**File:** `packages/frontend/src/components/kyc/KycVerificationPanel.tsx`

```typescript
interface KycVerificationPanelProps {
  readonly kycStatus: 'not_started' | 'pending' | 'in_review' | 'verified' | 'rejected' | 'expired';
}
```

**Functional requirements:**

- Renders the full KYC action panel in the Profile page's verification section.
- Panel background: `--color-bg-surface`, border: `--color-border-subtle`, radius: `--radius-card`.
- Section label above the panel: `"04 — IDENTITY VERIFICATION"` styled with `--type-section-label`, `--color-text-accent` (per L2-001 Section 3.7 section label pattern).

**Rendering per `kycStatus`:**

| Status | Panel content |
|--------|--------------|
| `not_started` | Heading: `"Verify Your Identity"` (`--type-card-title`). Body text: `"To submit campaigns and receive funds, you must complete identity verification."` (`--type-body`, `--color-text-secondary`). Primary CTA button: `"Start Verification"` (gradient primary, `--gradient-action-primary`). One primary CTA per viewport rule applies — ensure no other primary buttons are visible when this panel is shown. |
| `pending` | `KycStatusBadge` with `'pending'`. Body text: `"Your verification is being processed."`. No action button. |
| `in_review` | `KycStatusBadge` with `'in_review'`. Body text: `"Your documents are under review. This may take up to 24 hours."`. No action button. |
| `verified` | `KycStatusBadge` with `'verified'`. Body text: `"Your identity has been verified. You are eligible to submit campaigns."`. No action button. |
| `rejected` | `KycStatusBadge` with `'rejected'`. Body text: `"Your verification was not successful. You may resubmit."`. Primary CTA: `"Resubmit Verification"`. |
| `expired` | `KycStatusBadge` with `'expired'`. Body text: `"Your verification has expired."`. No action button (resubmission from expired is out of scope). |

**CTA button behaviour (`not_started` and `rejected` states):**
- Uses `useKycSubmit()` hook.
- While `isLoading === true`: button is disabled, shows a loading spinner (per brand motion tokens), text changes to `"Verifying…"`.
- On error (`isError === true`): show inline error message below the button using `--color-status-error`. Message: `"Verification could not be completed. [error.message]"`.
- On success: component re-renders with `kycStatus: 'verified'` (because the parent `ProfilePage` invalidates the `['me']` query and reads the updated status from `useCurrentUser()`).
- Shadow on primary button: `--color-action-primary-shadow` per design system.

**State management:** Uses `useKycSubmit()` from the hook. Does not manage its own query — receives `kycStatus` as a prop from the parent.

**Named export:** `export function KycVerificationPanel(props: KycVerificationPanelProps): JSX.Element`

Has a `.test.tsx` file.

---

### Modified Pages

#### `ProfilePage` (modified)

**File:** `packages/frontend/src/pages/ProfilePage.tsx`

**Change:** Add a KYC verification section rendered by `KycVerificationPanel`.

**Functional requirements:**
- After the existing profile sections (display name, bio, avatar), add a KYC section rendered as `<KycVerificationPanel kycStatus={user.kycStatus} />`.
- `kycStatus` is read from `useCurrentUser()` — the existing `['me']` query already returns `kycStatus`.
- No new query is needed for the ProfilePage itself — `useCurrentUser()` provides all required data.
- If the `['me']` query is loading: render skeleton placeholder for the KYC section (same `--color-bg-elevated` skeleton pattern used for the rest of the profile page).
- If the `['me']` query errors: the existing profile error state handles this — no KYC-specific error state needed at the page level.

---

### Design Token Usage (additions to feat-001 tokens)

All feat-001 tokens remain in use. Additional tokens for KYC panel:

| Surface | Token |
|---------|-------|
| KYC verified badge | `--color-status-success` |
| KYC warning badge (`not_started`, `pending`, `in_review`) | `--color-status-warning` |
| KYC error badge (`rejected`, `expired`) | `--color-status-error` |
| CTA loading state animation | `--motion-ambient` (spinner), respect `prefers-reduced-motion` |

---

## Edge Cases

All 20 edge cases from `feat-002-research.md` Section 5 are defined below with expected behaviour.

| # | Scenario | Expected Behaviour | Test Type |
|---|----------|--------------------|-----------|
| EC-001 | Submit when `kycStatus = 'pending'` | Application service validates status before calling provider. Returns `409 KYC_ALREADY_PENDING`. No audit event emitted. No DB update. | Unit |
| EC-002 | Submit when `kycStatus = 'verified'` | Application service validates status before calling provider. Returns `409 KYC_ALREADY_VERIFIED`. No audit event emitted. No DB update. | Unit |
| EC-003 | Submit when `accountStatus = 'pending_verification'` | Application service step 2 throws `KycAccountNotActiveError`. Returns `403 ACCOUNT_NOT_ACTIVE`. KYC provider not called. | Unit |
| EC-004 | Submit when `accountStatus = 'suspended'` or `'deactivated'` | Application service step 2 throws `KycAccountSuspendedError`. Returns `403 ACCOUNT_SUSPENDED`. KYC provider not called. | Unit |
| EC-005 | Submit when `kycStatus = 'rejected'` | Valid resubmission path. Application service transitions `rejected → pending → verified`. Two audit events emitted. Returns `200` with `kycStatus: 'verified'`. | Integration |
| EC-006 | Concurrent submit requests (double-click / React strict mode) | First request transitions `not_started → pending` using conditional `WHERE kyc_status = 'not_started'`. Second request's `updateKycStatus(clerkUserId, 'not_started', 'pending')` updates 0 rows, throws `KycTransitionConflictError`. Returns `409 KYC_TRANSITION_CONFLICT`. Only one set of audit events is emitted. Per G-020. | Integration |
| EC-007 | `GET /kyc/status` for user who has not called `/auth/sync` | `userRepository.findByClerkUserId()` returns `null`. Returns `404 USER_NOT_FOUND`. | Integration |
| EC-008 | `kyc_status` updated without audit event (maintenance script) | Not preventable at the application layer. The spec mandates that ALL `kyc_status` transitions go through `KycAppService.submitKyc()`. Direct DB updates bypass audit logging. Document as a risk in code comments. `kyc_audit_events` is the audit trail — direct DB changes will leave it inconsistent. | Manual / Documentation |
| EC-009 | Audit event emit fails after successful DB update | DB update completes. `kycAuditRepository.createEvent()` throws (e.g., DB timeout). The error is caught, logged at ERROR level via pino, but the state update is NOT rolled back. The final `kycStatus` is correct in DB; the audit trail has a gap. This is an accepted trade-off for the local demo. Document in code comment. | Unit (mock audit repo that throws) |
| EC-010 | `kyc_status` in DB diverges from audit trail via admin direct update | Out of scope for stub. Note as a production risk in code comments. A real implementation would require admin override events. | Documentation |
| EC-011 | `GET /me` caches stale `kycStatus` after submit | `GET /api/v1/kyc/status` is the authoritative real-time source (stale time: 0). `POST /api/v1/kyc/submit` response includes the final `kycStatus` — frontend uses `queryClient.setQueryData(['me'], response.data)` to immediately update the `['me']` cache. Frontend also invalidates both `['me']` and `['kyc', 'status']` queries on mutation success. No stale data scenario. | Integration |
| EC-012 | Campaign submission during KYC transition | Campaign service (feat-003) reads `kycStatus` at point-in-time. If it reads `'pending'`, it returns `403 KYC_NOT_VERIFIED`. User must wait for KYC to complete and retry. The `403` is correct — no race condition fix needed here. Frontend displays `KYC_NOT_VERIFIED` error and routes user to KYC flow. | Integration (feat-003 scope) |
| EC-013 | User deletes account mid-KYC (`kycStatus = 'pending'`) | The `users` row is hard-deleted (GDPR erasure / Clerk `user.deleted` webhook). The `kyc_audit_events.user_id` FK is `ON DELETE SET NULL` — audit records are preserved with `user_id = NULL`. The stub has no real KYC session to cancel. In production with Veriff, the adapter would need to cancel the active session — out of scope for the stub. | Manual |
| EC-014 | User polls `GET /kyc/status` repeatedly | Endpoint is idempotent — reads `kycStatus` from DB on every call with no side effects. No rate limiting for the stub. Polling is safe. The stub resolves synchronously so polling is unnecessary in practice, but the endpoint design supports it for the real async Veriff flow. | Integration |
| EC-015 | User with `kycStatus = 'not_started'` attempts campaign submission | feat-003 campaign service returns `403 KYC_NOT_VERIFIED`. The frontend recognises this error code and routes the user to `ProfilePage` (KYC section). The `KYC_NOT_VERIFIED` error code is defined in this spec as the contract feat-003 depends on. No `docs_url` or `redirect` hint in the API response — the frontend handles routing based on the error code. | Integration (feat-003 scope) |
| EC-016 | User initiates KYC while `accountStatus = 'pending_verification'` | Covered by EC-003. Returns `403 ACCOUNT_NOT_ACTIVE`. The frontend should surface this error with: `"Please verify your email address before completing identity verification."` | Integration |
| EC-017 | Frontend shows stale `not_started` status after stub approval | `POST /api/v1/kyc/submit` response body contains `kycStatus: 'verified'`. The `useKycSubmit` mutation handler calls `queryClient.setQueryData(['me'], response.data)` immediately on success. The profile page re-renders with `kycStatus: 'verified'` before any network re-fetch occurs. No stale display. | Component test |
| EC-018 | `kyc_status` CHECK constraint violation | The domain `KycStatus` value object (updated to include `'rejected'`) is the only source of valid status strings in application code. Only values from the `KycStatus` constant are ever written to the DB. Invalid values are a programming error caught at compile time by TypeScript. If somehow an invalid value reaches the DB, PostgreSQL raises a constraint violation → `500 INTERNAL_ERROR`. | Unit (TypeScript type checking) |
| EC-019 | `kyc.status.change` event emitted without `previous_status` | The application service always reads the current user record (step 1) before any update. `previousStatus` is captured before the first `updateKycStatus` call. For the `not_started → pending` event, `previousStatus` is the user's current `kycStatus` (always known). For the `pending → verified` event, `previousStatus` is always `'pending'` (hardcoded — it was just set in step 5). The read-before-write pattern is mandated. | Unit |
| EC-020 | Multiple audit events for single submission | The stub emits exactly two `kyc.status.change` events per successful `POST /kyc/submit`: (1) `not_started → pending` and (2) `pending → verified`. These are distinct events, emitted in sequence, not coalesced. Integration tests verify that `kycAuditRepository.findByUserId()` returns exactly 2 events after a single submit call. | Integration |

---

## Testing Requirements

### Unit Tests

**File pattern:** `*.test.ts` adjacent to source file. Use `vitest` + `vi.mock` pattern per P-014.

#### `KycStatus` value object (`kyc-status.test.ts`)

- [ ] All 6 values present: `not_started`, `pending`, `in_review`, `verified`, `rejected`, `expired`
- [ ] Value `'failed'` is NOT present (confirm rename via G-018)
- [ ] Type is `as const` union (no TypeScript enum)

#### KYC domain errors (`kyc-errors.test.ts`)

- [ ] `KycAlreadyPendingError` has `code = 'KYC_ALREADY_PENDING'`
- [ ] `KycAlreadyVerifiedError` has `code = 'KYC_ALREADY_VERIFIED'`
- [ ] `KycResubmissionNotAllowedError` has `code = 'KYC_RESUBMISSION_NOT_ALLOWED'`
- [ ] `KycAccountNotActiveError` has `code = 'ACCOUNT_NOT_ACTIVE'`
- [ ] `KycAccountSuspendedError` has `code = 'ACCOUNT_SUSPENDED'`
- [ ] `KycTransitionConflictError` has `code = 'KYC_TRANSITION_CONFLICT'`
- [ ] All errors extend `DomainError` (instanceof check passes)

#### `StubKycVerificationAdapter` (`stub-kyc-provider.adapter.test.ts`)

- [ ] `initiateSession(userId)` — default (`shouldApprove = true`) returns `{ sessionId: 'stub-session-<userId>', outcome: 'approved' }`
- [ ] `initiateSession(userId)` — `shouldApprove = false` returns `{ outcome: 'declined' }`
- [ ] `initiateSession(userId)` — is deterministic: same `userId` always returns same `sessionId`

#### `KycAppService` unit tests (`kyc-app-service.test.ts`)

Uses `InMemoryUserRepository`, `InMemoryKycAuditRepository`, and `StubKycVerificationAdapter`. All dependencies injected via constructor.

**`getKycStatus` tests:**
- [ ] Returns `{ kycStatus, updatedAt }` for a valid user
- [ ] Throws `UserNotFoundError` for unknown `clerkUserId`

**`submitKyc` — account status validation:**
- [ ] Throws `KycAccountNotActiveError` when `accountStatus = 'pending_verification'` (EC-003)
- [ ] Throws `KycAccountSuspendedError` when `accountStatus = 'suspended'` (EC-004)
- [ ] Throws `KycAccountSuspendedError` when `accountStatus = 'deactivated'` (EC-004)

**`submitKyc` — KYC status validation:**
- [ ] Throws `KycAlreadyPendingError` when `kycStatus = 'pending'` (EC-001)
- [ ] Throws `KycAlreadyPendingError` when `kycStatus = 'in_review'` (reserved state)
- [ ] Throws `KycAlreadyVerifiedError` when `kycStatus = 'verified'` (EC-002)
- [ ] Throws `KycResubmissionNotAllowedError` when `kycStatus = 'expired'`

**`submitKyc` — happy path (`not_started`):**
- [ ] Calls `userRepository.updateKycStatus(clerkUserId, 'not_started', 'pending')` first
- [ ] Calls `kycAuditRepository.createEvent` with `previousStatus: 'not_started'`, `newStatus: 'pending'`
- [ ] Calls `kycProvider.initiateSession(user.id)`
- [ ] Calls `userRepository.updateKycStatus(clerkUserId, 'pending', 'verified')` after provider returns `'approved'`
- [ ] Calls `kycAuditRepository.createEvent` with `previousStatus: 'pending'`, `newStatus: 'verified'`, `triggerReason: 'stub_auto_approve'`
- [ ] Returns user with `kycStatus: 'verified'`
- [ ] Exactly 2 audit events are created per submission (EC-020)

**`submitKyc` — resubmission (`rejected`):**
- [ ] Transitions `rejected → pending → verified` successfully (EC-005)
- [ ] Two audit events emitted: `rejected → pending` and `pending → verified`

**`submitKyc` — audit event failure (EC-009):**
- [ ] If `kycAuditRepository.createEvent` throws, the error is logged but NOT re-thrown — DB status update is NOT rolled back
- [ ] User is returned with the updated status despite audit failure

**`submitKyc` — transition conflict (EC-006):**
- [ ] If `userRepository.updateKycStatus` throws `KycTransitionConflictError`, the service re-throws it (no recovery)
- [ ] No audit event is emitted when the first DB update fails

**`submitKyc` — stub declined:**
- [ ] With `StubKycVerificationAdapter(false)`: transitions `not_started → pending → rejected`
- [ ] Two audit events: `not_started → pending` and `pending → rejected`
- [ ] Returns user with `kycStatus: 'rejected'`

---

### Integration Tests

**File pattern:** `*.integration.test.ts`. Uses real PostgreSQL test database. Mocks Clerk middleware via `x-test-user-id` header (P-014).

**Test setup:** `TRUNCATE users, kyc_audit_events CASCADE` in `beforeEach`. Use `dbmate up` against test database.

#### `GET /api/v1/kyc/status` integration tests

- [ ] Returns `200` with `kycStatus: 'not_started'` for a new active user
- [ ] Returns `200` with `kycStatus: 'verified'` after KYC submission
- [ ] Returns `401 UNAUTHENTICATED` for request with no auth header
- [ ] Returns `404 USER_NOT_FOUND` for Clerk ID with no MMF record (EC-007)
- [ ] Response includes `correlation_id` in all error responses (P-008)

#### `POST /api/v1/kyc/submit` integration tests

- [ ] Active user with `kycStatus = 'not_started'` — returns `200` with `kycStatus: 'verified'` in response
- [ ] Active user with `kycStatus = 'rejected'` — returns `200` with `kycStatus: 'verified'` (EC-005)
- [ ] User with `kycStatus = 'pending'` — returns `409 KYC_ALREADY_PENDING` (EC-001)
- [ ] User with `kycStatus = 'verified'` — returns `409 KYC_ALREADY_VERIFIED` (EC-002)
- [ ] User with `kycStatus = 'expired'` — returns `409 KYC_RESUBMISSION_NOT_ALLOWED`
- [ ] User with `accountStatus = 'pending_verification'` — returns `403 ACCOUNT_NOT_ACTIVE` (EC-003)
- [ ] User with `accountStatus = 'suspended'` — returns `403 ACCOUNT_SUSPENDED` (EC-004)
- [ ] Request with no auth header — returns `401 UNAUTHENTICATED`
- [ ] Clerk ID with no MMF record — returns `404 USER_NOT_FOUND`
- [ ] Request body with unexpected field — returns `400 VALIDATION_ERROR`
- [ ] After successful submit — `kyc_audit_events` table contains exactly 2 rows for the user (EC-020)
- [ ] Audit event 1: `previousStatus = 'not_started'`, `newStatus = 'pending'`, `triggerReason = 'user_submission'`
- [ ] Audit event 2: `previousStatus = 'pending'`, `newStatus = 'verified'`, `triggerReason = 'stub_auto_approve'`
- [ ] After successful submit — `GET /api/v1/me` returns `kycStatus: 'verified'` (EC-011)
- [ ] All error responses include `correlation_id` (P-008)

#### `PgUserRepository.updateKycStatus` integration tests

- [ ] Updates `kyc_status` from `not_started` to `pending` when condition matches
- [ ] Returns the updated user with new `kycStatus`
- [ ] Returns `KycTransitionConflictError` when `fromStatus` does not match current DB value (EC-006)
- [ ] `updated_at` is updated on successful transition

#### `PgKycAuditRepository` integration tests

- [ ] `createEvent` inserts a row and returns the persisted event with generated `id` and `createdAt`
- [ ] `createEvent` with `previousStatus: null` is stored correctly
- [ ] `findByUserId` returns events in `createdAt` ascending order
- [ ] `findByUserId` returns empty array for user with no events
- [ ] `findByUserId` returns only events for the requested `userId` (tenant isolation)

---

### Frontend Component Tests

#### `KycStatusBadge.test.tsx`

- [ ] Renders `"Identity Verification Required"` for `not_started`
- [ ] Renders `"Verification In Progress"` for `pending`
- [ ] Renders `"Under Review"` for `in_review`
- [ ] Renders `"Identity Verified"` for `verified`
- [ ] Renders `"Verification Failed"` for `rejected`
- [ ] Renders `"Verification Expired"` for `expired`
- [ ] Badge text is accessible (rendered in visible text, not just title/aria-label)

#### `KycVerificationPanel.test.tsx`

- [ ] `not_started` state: renders `"Start Verification"` primary CTA button
- [ ] `not_started` state: CTA button is enabled (not disabled)
- [ ] `pending` state: renders status badge, no action button
- [ ] `in_review` state: renders status badge, no action button
- [ ] `verified` state: renders `KycStatusBadge` with `'verified'`, no CTA button
- [ ] `rejected` state: renders `"Resubmit Verification"` CTA button
- [ ] `expired` state: renders status badge, no CTA button
- [ ] Loading state (mutation in-flight): CTA button is disabled, shows loading indicator
- [ ] Error state (mutation failed): inline error message is visible below the button
- [ ] CTA click triggers `useKycSubmit().submitKyc()` mutation (mock the hook)
- [ ] Section label `"04 — IDENTITY VERIFICATION"` is rendered (accessible via `getByText`)

#### `ProfilePage.test.tsx` (additions to existing test file)

- [ ] `KycVerificationPanel` is rendered within the profile page
- [ ] `kycStatus` prop is passed from `useCurrentUser()` result to `KycVerificationPanel`
- [ ] Loading skeleton is shown for the KYC section while the `['me']` query is loading

#### `useKycSubmit.test.ts`

- [ ] On successful mutation: `queryClient.setQueryData(['me'], ...)` is called with the response data
- [ ] On successful mutation: `['me']` and `['kyc', 'status']` queries are invalidated
- [ ] On error: `isError` is `true` and `error` contains the API error
- [ ] `isLoading` is `true` while mutation is in-flight

---

### Coverage Requirements

| Layer | Target | Type |
|-------|--------|------|
| KYC domain errors | 100% | Unit |
| `StubKycVerificationAdapter` | 100% | Unit |
| `KycAppService` | ≥ 90% | Unit (with mock adapters) |
| API endpoints (`/kyc/status`, `/kyc/submit`) | 100% of documented contracts | Integration |
| `PgUserRepository.updateKycStatus` | 100% of contracts | Integration |
| `PgKycAuditRepository` | 100% of contracts | Integration |
| Frontend components (`KycStatusBadge`, `KycVerificationPanel`) | ≥ 80% | Unit + Testing Library |
| Frontend hooks (`useKycStatus`, `useKycSubmit`) | ≥ 80% | Unit |
