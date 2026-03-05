# PRD: feat-001 — Frontend, Edge Cases & Testing

> Sub-file 4 of 4. Part of `feat-001-spec.md`.
> Contents: Frontend specification, edge cases, testing requirements.

---

## Frontend Specification

### Tech Stack

- React 19.x — functional components, TypeScript strict mode
- `@clerk/react` — `ClerkProvider`, `<SignIn />`, `<SignUp />`, `useAuth`, `useUser`
- TanStack Query v5 — all server state
- React Router v6 — client-side routing
- Tailwind CSS — layout utilities; semantic tokens via CSS custom properties for brand values

### Directory Structure

```
packages/frontend/src/
  main.tsx                         # App root — ClerkProvider wraps everything
  App.tsx                          # Router setup, protected route wrapper
  api/
    client.ts                      # Centralised fetch wrapper with JWT injection
  hooks/
    useCurrentUser.ts              # TanStack Query hook for GET /api/v1/me
    useNotificationPrefs.ts        # TanStack Query hook for GET /api/v1/me/notifications
  components/
    auth/
      ProtectedRoute.tsx           # Redirects to /sign-in if not authenticated
      AuthSync.tsx                 # Calls POST /api/v1/auth/sync on sign-in
    profile/
      ProfileCard.tsx              # Displays user profile data
      ProfileEditForm.tsx          # PATCH /api/v1/me/profile form
    notifications/
      NotificationPrefsForm.tsx    # PATCH /api/v1/me/notifications form
    layout/
      AppShell.tsx                 # Navigation + page layout
  pages/
    SignInPage.tsx                 # Clerk <SignIn /> component wrapper
    SignUpPage.tsx                 # Clerk <SignUp /> component wrapper
    ProfilePage.tsx                # /profile — profile view + edit
    OnboardingPage.tsx             # /onboarding — post-registration flow
```

---

### Pages

#### `SignInPage`

**Route:** `/sign-in`
**Auth:** Unauthenticated only (redirect to `/` if already signed in)

**Functional requirements:**
- Renders Clerk's `<SignIn />` component with `routing="path"` and `path="/sign-in"`.
- After successful sign-in, Clerk redirects to `/auth/callback`.
- Does not build a custom sign-in form — Clerk hosts the UI.
- Logo: full vertical lockup (dark variant) at 120px coin height per L2-001 Section 6.1.
- Page background: `--color-bg-page`.

**State management:** No TanStack Query needed. Clerk SDK manages auth state.

---

#### `SignUpPage`

**Route:** `/sign-up`
**Auth:** Unauthenticated only (redirect to `/` if already signed in)

**Functional requirements:**
- Renders Clerk's `<SignUp />` component with `routing="path"` and `path="/sign-up"`.
- After successful sign-up, Clerk redirects to `/auth/callback`.
- Does not build a custom sign-up form.
- Same visual treatment as `SignInPage`.

**State management:** Clerk SDK.

---

#### `AuthCallbackPage`

**Route:** `/auth/callback`
**Auth:** Required (Clerk JWT must be present — user just signed in)

**Functional requirements:**
- This page exists solely to call `POST /api/v1/auth/sync` after Clerk sign-in/sign-up.
- On mount: call the `syncUser` mutation.
- While mutation is pending: show a full-screen loading state with the MMF logo and text `"Preparing your mission profile…"` in `--type-body`, `--color-text-secondary`.
- On success: redirect to `/onboarding` if `onboardingCompleted === false`, else redirect to `/`.
- On error: show error state with retry button and message following error state voice pattern from L2-001 Section 4.3: `"Something went wrong on our end. We're looking into it. Try again in a few minutes."`

**State management:**
- `useMutation` (TanStack Query) for `POST /api/v1/auth/sync`.
- No persistent query cache needed — redirect immediately after.

---

#### `OnboardingPage`

**Route:** `/onboarding`
**Auth:** Required. Redirect to `/` if `onboardingCompleted === true`.

**Functional requirements:**
- Multi-step flow. Steps in order: Welcome → Role Selection → Progressive Profiling → Notification Preferences → Complete.
- Step state is tracked locally in React state (not persisted to server between steps — only the final `onboardingStep` DB field is updated server-side when a step is completed).
- **Step 1 — Welcome:** Brand-appropriate welcome. Section label `"01 — WELCOME"` styled per L2-001 Section 3.7. Heading uses `--type-page-title` (Bebas Neue, 56px, uppercase). Message: `"Your mission starts here."` Primary CTA: `"Get Started"` (gradient primary button per L2-001 Section 3.1).
- **Step 2 — Role Selection:** User selects primary intent: `Backer`, `Creator`, or both. Note: for feat-001, role selection is informational only — the MMF backend does NOT change roles here (Backer is set automatically on activation; Creator role assignment is a separate workflow tied to KYC). The selection updates `onboarding_step = 'role_selection'` via `PATCH /api/v1/me/profile` extended to support `onboardingStep`. WAIT: per scope — role assignment API is not in feat-001. For this step, update the local onboarding progress; do not call any role-assignment API. Simply record the preference for display purposes.
- **Step 3 — Progressive Profiling:** Display name and bio inputs. Avatar upload is out of scope for feat-001 (the API accepts `avatarUrl` as a URL string; a file upload UI is deferred). Calls `PATCH /api/v1/me/profile`. Step is skippable — "Skip for now" ghost button.
- **Step 4 — Notification Preferences:** Toggle switches for each preference category. Security alerts shown as toggled-on and disabled (non-interactive). Calls `PATCH /api/v1/me/notifications`.
- **Step 5 — Complete:** Completion screen. Sets `onboardingCompleted = true` via `PATCH /api/v1/me/profile` (the API service must accept an `onboardingCompleted` boolean field — add this to the profile update schema). Redirects to `/` after 2 seconds.
- All steps show a progress indicator (step N of 5) in `--type-label`, `--color-text-tertiary`.

**State management:**
- `useCurrentUser()` query to load initial profile state.
- `useMutation` for `PATCH /api/v1/me/profile` and `PATCH /api/v1/me/notifications`.
- Local `currentStep` state (integer 1–5).
- On completed onboarding flag: set `onboardingCompleted: true` via profile PATCH.

**Note on `PATCH /api/v1/me/profile` schema extension:** The profile update schema must accept `onboardingCompleted: z.boolean().optional()` and `onboardingStep: z.enum([...]).optional()` in addition to profile fields. Update the Zod schema in `feat-001-spec-api.md` accordingly.

**Updated `PATCH /api/v1/me/profile` Zod schema (corrected):**
```typescript
z.object({
  displayName:         z.string().max(255).nullable().optional().transform(v => v === '' ? null : v),
  bio:                 z.string().max(500).nullable().optional().transform(v => v === '' ? null : v),
  avatarUrl:           z.string().url().nullable().optional(),
  onboardingCompleted: z.boolean().optional(),
  onboardingStep:      z.enum(['role_selection', 'profiling', 'notifications', 'complete']).optional(),
}).strict()
```

---

#### `ProfilePage`

**Route:** `/profile`
**Auth:** Required.

**Functional requirements:**
- Displays current user profile (display name, bio, avatar, email, account status, roles, KYC status).
- Avatar: if `avatarUrl` is null or the image fails to load, render a circular initials avatar using the first character(s) of `displayName` (or email if no display name). Background: `--color-bg-elevated`. Text: `--color-text-primary`. Size: 80px.
- Roles displayed as badges per L2-001 Section 3.5. Use "New Mission" badge variant for `backer`, "Live / Active" for `creator`, neutral for `reviewer`/`administrator`.
- KYC status displayed as a badge: `not_started` uses `--color-status-warning` variant with text `"Identity verification pending"`.
- **Edit form:** Inline edit for `displayName` and `bio`. Inputs styled per L2-001 Section 3.6. On save: calls `PATCH /api/v1/me/profile`. Save button uses primary CTA gradient only if it is the sole action button on the viewport; otherwise secondary button.
- **Loading state:** Skeleton placeholders (background `--color-bg-elevated`, animated with `--motion-ambient` unless `prefers-reduced-motion`).
- **Error state:** If `useCurrentUser()` query fails with 404, display: `"We couldn't load your profile. Try signing in again."` with a sign-in redirect button.

**State management:**
- `useCurrentUser()` — `GET /api/v1/me`. Cache key: `['me']`. Stale time: 30 seconds. Refetch on window focus: true.
- `useUpdateProfile` mutation — `PATCH /api/v1/me/profile`. On success: invalidate `['me']` query.

---

### Components

#### `ProtectedRoute`

**File:** `packages/frontend/src/components/auth/ProtectedRoute.tsx`

```typescript
interface ProtectedRouteProps {
  readonly children: React.ReactNode;
}
```

**Functional requirements:**
- Uses `useAuth()` from `@clerk/react`.
- If `isLoaded === false`: render full-screen loading spinner.
- If `isSignedIn === false`: redirect to `/sign-in` via `<Navigate to="/sign-in" replace />`.
- If `isSignedIn === true`: render `children`.

---

#### `AuthSync`

**File:** `packages/frontend/src/components/auth/AuthSync.tsx`

**Functional requirements:**
- Mounted once at the app root (inside `ClerkProvider`, inside `ProtectedRoute`).
- On mount: if the user is signed in AND no `['me']` query data exists: calls `POST /api/v1/auth/sync`.
- Purpose: ensure the MMF user record is seeded on every session start, not just first login.
- Does not render any visible UI.

---

#### API Client

**File:** `packages/frontend/src/api/client.ts`

```typescript
async function apiRequest<T>(
  path: string,
  options?: RequestInit
): Promise<T>
```

**Functional requirements:**
- Prepends `/api/v1` to `path`.
- On every request: calls `await getToken()` from `@clerk/react`'s `useAuth()`. Attaches as `Authorization: Bearer <token>`.
- On `401` response: calls Clerk's `refreshToken()` and retries once. If retry also returns `401`: redirects to `/sign-in`.
- On `5xx` response: throws `ApiError` with `{ code: 'INTERNAL_ERROR', message: '...' }`.
- On network failure: throws `ApiError` with `{ code: 'NETWORK_ERROR', message: 'Check your connection.' }`.
- All responses expected to be JSON. Responses with non-JSON content type throw `ApiError`.
- Monetary amounts are received as strings from the API — never parsed to `number` (not applicable to this feature but enforced globally).

**Note:** The `apiRequest` function requires access to `getToken` from Clerk. Since it is called outside React components, wrap it in a factory or pass the token explicitly. Recommended approach: export a `createApiClient(getToken: () => Promise<string | null>)` factory called once in `App.tsx` and provided via React context or module singleton.

---

#### `useCurrentUser` hook

**File:** `packages/frontend/src/hooks/useCurrentUser.ts`

```typescript
function useCurrentUser(): {
  user: UserProfile | null;
  isLoading: boolean;
  isError: boolean;
  error: ApiError | null;
}
```

Uses `useQuery`:
- Query key: `['me']`
- Query function: `GET /api/v1/me`
- `staleTime`: 30_000 (30 seconds)
- `retry`: 1 (retry once on failure)
- `refetchOnWindowFocus`: true

`UserProfile` interface (frontend type — camelCase, mirrors API response `data` object):
```typescript
interface UserProfile {
  readonly id: string;
  readonly clerkUserId: string;
  readonly email: string;
  readonly displayName: string | null;
  readonly bio: string | null;
  readonly avatarUrl: string | null;
  readonly accountStatus: 'pending_verification' | 'active' | 'suspended' | 'deactivated';
  readonly roles: Array<'backer' | 'creator' | 'reviewer' | 'administrator' | 'super_administrator'>;
  readonly kycStatus: 'not_started' | 'pending' | 'in_review' | 'verified' | 'failed' | 'expired';
  readonly onboardingCompleted: boolean;
  readonly onboardingStep: string | null;
  readonly notificationPrefs: NotificationPrefs;
  readonly lastSeenAt: string | null;  // ISO 8601 string
  readonly createdAt: string;
  readonly updatedAt: string;
}
```

---

#### `useNotificationPrefs` hook

**File:** `packages/frontend/src/hooks/useNotificationPrefs.ts`

```typescript
function useNotificationPrefs(): {
  prefs: NotificationPrefs | null;
  isLoading: boolean;
  updatePrefs: (partial: Partial<Omit<NotificationPrefs, 'securityAlerts'>>) => Promise<void>;
  isUpdating: boolean;
}
```

Uses:
- `useQuery` with key `['me', 'notifications']`, query fn: `GET /api/v1/me/notifications`
- `useMutation` for `PATCH /api/v1/me/notifications`. On success: invalidate `['me', 'notifications']` and `['me']`.

---

### Design Token Usage

All components follow L2-001 two-tier token architecture. Components only reference Tier 2 semantic tokens. Summary of tokens used in this feature:

| Surface | Token |
|---------|-------|
| Page background | `--color-bg-page` |
| Form inputs | `--color-bg-input`, `--color-border-input` (default), `--color-border-emphasis` (focus) |
| Input radius | `--radius-input` |
| Input label | `--type-input-label`, `--color-text-tertiary` |
| Primary CTA | `--gradient-action-primary`, `--color-action-primary-text`, `--color-action-primary-shadow` |
| Secondary button | `--color-action-secondary-bg`, `--color-action-secondary-text`, `--color-action-secondary-border` |
| Ghost button | `--color-action-ghost-text`, `--color-action-ghost-border` |
| Card background | `--color-bg-surface`, `--color-border-subtle`, `--radius-card` |
| Body text | `--color-text-primary` (primary), `--color-text-secondary` (body), `--color-text-tertiary` (metadata) |
| Section label | `--type-section-label`, `--color-text-accent` |
| Page title | `--type-page-title` (Bebas Neue, 56px, uppercase) |
| Loading skeleton | `--color-bg-elevated` |
| Status badges | Per L2-001 Section 3.5 |
| Focus state | `outline: 2px solid --color-action-primary-hover; outline-offset: 2px` |
| Animations | `--motion-enter` (card reveals), `--motion-enter-emphasis` (CTA), `--motion-hover` (hover) |

`prefers-reduced-motion` must be applied to all animated elements per L2-001 Section 5.2.

---

## Edge Cases

| # | Scenario | Expected Behaviour | Test Type |
|---|----------|--------------------|-----------|
| EC-001 | `clerk_user_id` is NULL or empty in `/auth/sync` | `requireAuth()` blocks before reaching handler; `getAuth(req).userId` is always non-null for authenticated requests. If somehow null, `accountAppService.syncUser` throws `InvalidClerkUserIdError` → 401 | Unit |
| EC-002 | Email with leading/trailing whitespace | Service normalises: `email.toLowerCase().trim()` before creating/upserting the user row | Unit |
| EC-003 | Display name with Unicode (Arabic, CJK, emoji) | Stored and returned without corruption. PostgreSQL UTF8 handles this. DB max length enforced by character count (not byte count) in Zod: `z.string().max(255)` (Zod `.max()` counts Unicode code points) | Unit |
| EC-004 | Display name as empty string in PATCH | Transformed to `null` by Zod transform: `v === '' ? null : v`. Stored as NULL, returned as `null`. | Unit |
| EC-005 | Roles array is empty for an `active` user | Should not occur: activation atomically sets `roles = ARRAY['backer']`. If found in DB via migration: `reconstitute()` returns the user with empty roles; `activate()` is idempotent and will not be called again. Domain services checking roles will deny access. | Unit |
| EC-006 | `notification_prefs` JSONB with malformed JSON in request | Zod parses the request body first. Non-object or malformed JSON causes `400 VALIDATION_ERROR` before any DB write. | Integration |
| EC-007 | Avatar URL pointing to a non-existent file | URL is stored without liveness validation. Frontend renders a broken image or falls back to initials avatar. Backend does not validate URL liveness on profile reads. | Manual |
| EC-008 | Race condition: two concurrent `POST /auth/sync` for same clerk_user_id | `ON CONFLICT (clerk_user_id) DO UPDATE` upsert handles this. Both requests succeed; the second updates `last_seen_at`. No duplicate rows. | Integration |
| EC-009 | Role assignment during active session (JWT staleness) | Role change is immediate in DB. JWT-cached `role` claim is stale for up to the session token TTL (typically 1–5 min). This is acceptable for the demo. Document in code comments. No forced token invalidation in feat-001. | Manual |
| EC-010 | Simultaneous profile updates from two browser tabs | Last write wins. No optimistic locking. Acceptable for the demo. | Manual |
| EC-011 | Clerk webhook delivery failure → retry | All webhook handlers are idempotent (upsert semantics). Re-processing `user.created` for an existing user is a no-op for `account_status` and `roles` fields. | Integration |
| EC-012 | `user.updated` webhook arrives before `user.created` | Handler calls `userRepository.findByClerkUserId(clerkUserId)`. If null: falls through to creation path (same logic as `user.created` handler). No 500 error. | Integration |
| EC-013 | Clerk session expires during profile update | PATCH to `/me/profile` returns `401`. Frontend API client intercepts 401, calls Clerk silent token refresh, retries once. If refresh fails, redirects to `/sign-in`. | Integration |
| EC-014 | Clerk API rate limit hit during `setPublicMetadata` | Retry with exponential backoff (max 3 attempts, delays: 100ms, 500ms, 2000ms). On persistent failure: log WARN with `clerkUserId` and `roleToSync`. Role is correct in DB; JWT cache is stale until next token refresh. The feature continues to work (DB is source of truth). | Unit |
| EC-015 | Webhook signature verification failure | Return `400 INVALID_SIGNATURE`. Log at WARN with `securityEvent: true`. Do NOT process payload. | Integration |
| EC-016 | SSO provider returns unverified email (rare) | Clerk creates a new user account. MMF receives `user.created` webhook. If email already exists in MMF `users` table (from a different clerk_user_id), the DB allows it (no UNIQUE on `email`). The `clerk_user_id` UNIQUE constraint is the deduplication key. Two separate MMF user rows exist for the same email — this is intentional. | Integration |
| EC-017 | User requests re-verification when already `active` | If `account_status = 'active'`, `/auth/sync` returns the existing profile with no change. The frontend shows the user as active. There is no MMF-side re-verification endpoint — this is Clerk-managed. | Integration |
| EC-018 | Creator feature access before completing onboarding | `GET /me` returns `roles: ['backer', 'creator']` but `kycStatus: 'not_started'`. Campaign submission (feat-003) checks `kycStatus !== 'verified'` and returns 403. Onboarding is not a hard gate. | Integration (feat-003 scope) |
| EC-019 | Super Administrator self-assignment | `assignRole(Role.SuperAdministrator)` throws `SuperAdminAssignmentForbiddenError`. No API endpoint for role assignment exists in feat-001 (out of scope). The domain-level protection is in place for when feat-003+ introduces admin APIs. | Unit |
| EC-020 | Display name > 255 characters | Zod schema rejects with `400 VALIDATION_ERROR` before reaching domain layer. | Integration |
| EC-021 | Bio > 500 characters | Zod schema rejects with `400 VALIDATION_ERROR`. | Integration |
| EC-022 | Roles array with > 5 entries or invalid role values | Zod schema validates each role against the Role enum. Unknown values cause `400 VALIDATION_ERROR`. (Role values are never accepted from request bodies in feat-001 — this applies to future features that accept role arrays.) | Unit |
| EC-023 | JWT with future `iat` (clock skew / forgery) | `clerkMiddleware()` validates `iat` and `nbf`. Returns 401. Not handled by MMF application code. | Manual |
| EC-024 | Request with no Authorization header | `requireAuth()` middleware returns `401 UNAUTHENTICATED` before reaching any handler. | Integration |
| EC-025 | Notification preferences with unknown keys | Zod `.strict()` schema rejects unknown keys with `400 VALIDATION_ERROR`. | Integration |
| EC-026 | `user.updated` webhook changes email | If `event.data.email_addresses[0].email_address` differs from stored email, `updateAccountStatus` (with optional `email` param) updates the stored email. | Integration |
| EC-027 | Frontend API call when Clerk JWKS is unavailable | `clerkMiddleware()` fails to verify tokens; all `/api/v1` requests return 401. Health check (`/health`) is unaffected. Alert on-call (future observability work). | Manual |
| EC-028 | `POST /auth/sync` body contains additional fields | Request body is empty `{}`. Any fields sent are ignored (body is not parsed for user input). | Integration |

---

## Testing Requirements

### Unit Tests

**File pattern:** `*.test.ts` adjacent to source file.

#### `User` entity (`user.test.ts`)

- [ ] `User.create()` — happy path with all optional fields present
- [ ] `User.create()` — happy path with no optional fields
- [ ] `User.create()` — empty `clerkUserId` throws `InvalidClerkUserIdError`
- [ ] `User.create()` — malformed email throws `InvalidEmailError`
- [ ] `User.create()` — `displayName` exactly 255 chars is valid
- [ ] `User.create()` — `displayName` of 256 chars throws `DisplayNameTooLongError`
- [ ] `User.create()` — `bio` exactly 500 chars is valid
- [ ] `User.create()` — `bio` of 501 chars throws `BioTooLongError`
- [ ] `User.create()` — `avatarUrl` as valid absolute URL is accepted
- [ ] `User.create()` — `avatarUrl` as relative URL throws `InvalidAvatarUrlError`
- [ ] `User.reconstitute()` — reconstitutes all fields without validation
- [ ] `user.activate()` — sets status to `Active` and adds `Backer` role
- [ ] `user.activate()` — does not duplicate `Backer` role if already present
- [ ] `user.activate()` — throws `AlreadyActiveError` if already `Active`
- [ ] `user.assignRole(Role.Creator)` — adds role, does not remove existing roles
- [ ] `user.assignRole(Role.Creator)` — is idempotent (no-op if already assigned)
- [ ] `user.assignRole(Role.SuperAdministrator)` — throws `SuperAdminAssignmentForbiddenError`
- [ ] `user.removeRole(Role.Creator)` — removes role from multi-role user
- [ ] `user.removeRole(Role.Backer)` — throws `CannotRemoveBackerRoleError` if it is the last role
- [ ] `user.removeRole(Role.Creator)` — throws `RoleNotAssignedError` if user doesn't have it
- [ ] `user.updateProfile()` — updates all three fields
- [ ] `user.updateProfile()` — empty string for `displayName` stores as `null`
- [ ] `user.updateProfile()` — empty string for `bio` stores as `null`
- [ ] `user.updateProfile()` — `displayName` > 255 chars throws `DisplayNameTooLongError`
- [ ] `user.updateNotificationPrefs()` — merges partial update
- [ ] `user.updateNotificationPrefs({ securityAlerts: false })` — throws `SecurityAlertsCannotBeDisabledError`
- [ ] `user.touchLastSeen()` — updates `lastSeenAt`

#### `NotificationPreferences` value object (`notification-preferences.test.ts`)

- [ ] `NotificationPreferences.defaults()` — returns correct defaults (all true except `platformAnnouncements`)
- [ ] `securityAlerts` field — TypeScript type is literal `true` (verified by type-check, not runtime test)

#### `AccountAppService` (`account-app-service.test.ts`)

Uses `InMemoryUserRepository` and `MockClerkAuthAdapter` and `MockAuditLogger`.

- [ ] `syncUser` — creates new user when `clerkUserId` not found in repo
- [ ] `syncUser` — upserts existing user (updates `lastSeenAt`, does not reset roles)
- [ ] `syncUser` — normalises email to lowercase and trimmed
- [ ] `syncUser` — calls `auditLogger.log` with action `user.synced`
- [ ] `getMe` — returns user for valid `clerkUserId`
- [ ] `getMe` — throws `UserNotFoundError` for unknown `clerkUserId`
- [ ] `updateProfile` — updates fields and calls audit log
- [ ] `updateProfile` — throws `UserNotFoundError` for unknown user
- [ ] `updateProfile` — domain error for `displayName` > 255 chars propagates to 400
- [ ] `updateNotificationPrefs` — merges and persists
- [ ] `updateNotificationPrefs` — throws for `securityAlerts: false`
- [ ] `handleClerkWebhook('user.created')` — creates user with `pending_verification` for unverified email
- [ ] `handleClerkWebhook('user.created')` — creates user with `active` and `backer` role for verified email
- [ ] `handleClerkWebhook('user.created')` — is idempotent (second call does not downgrade active user)
- [ ] `handleClerkWebhook('user.updated')` — activates user and sets `backer` role when email becomes verified
- [ ] `handleClerkWebhook('user.updated')` — does NOT activate already-active user (no-op)
- [ ] `handleClerkWebhook('user.updated')` — updates email when email changed
- [ ] `handleClerkWebhook('user.updated')` — creates user if not found (out-of-order delivery)
- [ ] `handleClerkWebhook` — invalid signature causes `400` (tested at router level)

#### Clerk Auth adapter mock

- [ ] `MockClerkAuthAdapter.getUserMetadata('user_test_backer')` — returns correct fixture
- [ ] `MockClerkAuthAdapter.getUserMetadata(unknown_id)` — throws `UserNotFoundError`
- [ ] `MockClerkAuthAdapter.setPublicMetadata(any)` — resolves without error

---

### Integration Tests

**File pattern:** `*.integration.test.ts`. Uses real PostgreSQL (test database). Uses mock Clerk middleware (injects `req.auth` via `x-test-user-id` header).

**Test database setup:** Each test suite creates a fresh schema via `dbmate up` against a test database (`DATABASE_URL` set to `mmf_test`). Cleanup: `TRUNCATE users CASCADE` in `beforeEach`.

#### `POST /api/v1/auth/sync` integration tests

- [ ] Authenticated request creates user and returns 200 with user profile
- [ ] Authenticated request is idempotent: second call returns 200 with updated `lastSeenAt`
- [ ] Unauthenticated request (no `x-test-user-id` header) returns 401 `UNAUTHENTICATED`

#### `GET /api/v1/me` integration tests

- [ ] Authenticated request returns 200 with full user profile
- [ ] Authenticated request for non-existent MMF user returns 404 `USER_NOT_FOUND`
- [ ] Unauthenticated request returns 401 `UNAUTHENTICATED`

#### `PATCH /api/v1/me/profile` integration tests

- [ ] Valid update returns 200 with updated profile
- [ ] `displayName` = empty string stored as null, returned as null
- [ ] `displayName` > 255 chars returns 400 `VALIDATION_ERROR`
- [ ] `bio` > 500 chars returns 400 `VALIDATION_ERROR`
- [ ] Invalid `avatarUrl` (non-URL) returns 400 `VALIDATION_ERROR`
- [ ] Unknown key in body returns 400 `VALIDATION_ERROR`
- [ ] Unauthenticated request returns 401
- [ ] Update for non-existent user returns 404

#### `GET /api/v1/me/notifications` integration tests

- [ ] Returns 200 with default preferences for new user
- [ ] Unauthenticated request returns 401

#### `PATCH /api/v1/me/notifications` integration tests

- [ ] Valid partial update persists correctly
- [ ] `securityAlerts` key in body returns 400 `VALIDATION_ERROR` (caught by `.strict()`)
- [ ] Unknown key returns 400 `VALIDATION_ERROR`
- [ ] Non-boolean value for a preference returns 400 `VALIDATION_ERROR`
- [ ] Unauthenticated request returns 401

#### `POST /api/v1/webhooks/clerk` integration tests

- [ ] Valid `user.created` webhook with verified email creates user with `active` status and `backer` role
- [ ] Valid `user.created` webhook with unverified email creates user with `pending_verification`
- [ ] Valid `user.updated` webhook activating email transitions user to `active` + `backer`
- [ ] `user.updated` for non-existent user creates the user (out-of-order delivery)
- [ ] Invalid Svix signature returns 400 `INVALID_SIGNATURE`
- [ ] Missing Svix headers returns 400 `INVALID_SIGNATURE`
- [ ] Unknown event type returns 200 with `{ "received": true, "processed": false }`
- [ ] Duplicate `user.created` webhook is idempotent (no 409, no duplicate row)

#### `GET /health` integration tests

- [ ] Returns 200 without Authorization header
- [ ] Returns JSON `{ "status": "ok", "timestamp": "..." }`

#### `PgUserRepository` integration tests

- [ ] `upsertByClerkUserId` — inserts new user
- [ ] `upsertByClerkUserId` — updates existing user's `email` and `last_seen_at` on conflict
- [ ] `upsertByClerkUserId` — does NOT overwrite `account_status` or `roles` on conflict for `user.created` path
- [ ] `findByClerkUserId` — returns user
- [ ] `findByClerkUserId` — returns null for unknown ID
- [ ] `findById` — returns user
- [ ] `updateProfile` — persists field changes
- [ ] `updateNotificationPrefs` — persists JSONB with correct snake_case keys
- [ ] `updateAccountStatus` — atomically sets status and roles
- [ ] Tenant isolation: `findByClerkUserId` for user A does not return user B's data

---

### E2E Tests

E2E tests are deferred to a later feature once the full application is scaffolded. For feat-001, the integration tests cover all happy + error paths. The following flows are documented for future E2E coverage:

- [ ] New user registers via email/password → receives verification email → verifies → sees `Active` status with `Backer` role in profile
- [ ] New user registers via Google SSO → immediately `Active` with `Backer` role
- [ ] Authenticated user updates display name → change persisted → visible on profile page
- [ ] Authenticated user disables recommendations → persisted → can re-enable
- [ ] Unauthenticated browser tab → redirected to `/sign-in` on any protected route
- [ ] Expired session during profile edit → silent token refresh → update succeeds

---

### Coverage Requirements

Per L2-002 Section 4.2:

| Layer | Target | Type |
|-------|--------|------|
| Domain entities + VOs | ≥ 90% | Unit |
| Application service | ≥ 90% | Unit (with mock adapters) |
| API endpoints | 100% of documented contracts | Integration |
| Auth/authorisation paths | 100% of role + permission combinations | Integration |
| Frontend components | ≥ 80% | Unit + snapshot (Vitest + Testing Library) |

---

### Frontend Component Tests

Each component requires a `.test.tsx` file. Test patterns follow Testing Library accessible queries.

**`ProtectedRoute.test.tsx`:**
- [ ] Renders loading spinner when `isLoaded === false`
- [ ] Redirects to `/sign-in` when `isSignedIn === false`
- [ ] Renders children when `isSignedIn === true`

**`ProfileCard.test.tsx`:**
- [ ] Renders display name when present
- [ ] Renders initials avatar when `avatarUrl` is null
- [ ] Renders email as fallback when display name is null
- [ ] Renders role badges for all assigned roles
- [ ] Renders KYC status badge as `"Identity verification pending"` for `not_started`
- [ ] Loading state: renders skeleton placeholders
- [ ] Error state: renders error message with sign-in link

**`ProfileEditForm.test.tsx`:**
- [ ] Renders pre-filled form with current values
- [ ] Validates `displayName` max 255 chars (inline error before submit)
- [ ] Validates `bio` max 500 chars
- [ ] Submits PATCH request on save
- [ ] Disables save button while mutation is pending
- [ ] Shows success state after successful save

**`NotificationPrefsForm.test.tsx`:**
- [ ] Renders all 6 preference categories
- [ ] `securityAlerts` toggle is visible, checked, and disabled (non-interactive)
- [ ] Toggling `recommendations` off sends PATCH with `{ recommendations: false }`
- [ ] Shows loading state while mutation is in flight
- [ ] All toggle labels are accessible (`getByRole('switch', { name: '...' })`)

**`AuthSync.test.tsx`:**
- [ ] Calls `POST /api/v1/auth/sync` on mount when user is signed in and no `['me']` cache exists
- [ ] Does not call sync when `['me']` cache is already populated
- [ ] Does not render any visible output




























