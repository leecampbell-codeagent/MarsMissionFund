# feat-004 Research: Account Onboarding and Profile Management

**Feature brief**: `/workspace/.claude/prds/feat-004-account-onboarding.md`
**Spec**: L4-001 (`/workspace/specs/domain/account.md`)
**Researcher date**: 2026-03-06

---

## 1. Codebase State (What feat-003 Left Behind)

### 1.1 Database Schema

Two migrations are already applied and relevant:

- `20260306000001_create_accounts.sql` — `users` table with:
  - `id UUID`, `clerk_id TEXT`, `email TEXT`, `display_name TEXT NULL`, `avatar_url TEXT NULL`, `bio TEXT NULL`, `onboarding_completed BOOLEAN DEFAULT false`, `account_status TEXT`, `created_at TIMESTAMPTZ`, `updated_at TIMESTAMPTZ`
  - Note: `bio` is already present in the schema — no migration needed for it
  - Missing: `notification_preferences JSONB` and `onboarding_step INT`

- `20260306000002_create_roles.sql` — `user_roles` table with:
  - `id UUID`, `user_id UUID FK`, `role TEXT`, `assigned_by UUID NULL`, `created_at TIMESTAMPTZ`
  - `UNIQUE (user_id, role)` constraint — idempotent inserts via `ON CONFLICT DO NOTHING` are safe
  - Valid roles: `backer`, `creator`, `reviewer`, `administrator`, `super_administrator`

The last migration timestamp is `20260306000007_create_escrow_ledger.sql`.
The next migration timestamp to use is `20260306000008`.

### 1.2 Domain Model

`/workspace/packages/backend/src/account/domain/models/user.ts`:

- `UserData` interface has: `id`, `clerkUserId`, `email`, `displayName`, `avatarUrl`, `accountStatus`, `onboardingCompleted`, `createdAt`, `updatedAt`
- `bio` is NOT in the `UserData` interface or the `User` entity — it exists in the DB but was never surfaced in the domain model
- `notificationPreferences` is NOT in the `UserData` interface
- `onboardingStep` is NOT in the `UserData` interface
- The entity uses private constructor + `reconstitute()` pattern; there is no `create()` method (not needed for feat-003, may be needed now)

### 1.3 Repository Port

`/workspace/packages/backend/src/account/ports/user-repository.ts`:

- Methods: `findByClerkId`, `upsertWithBackerRole`, `findById`
- Missing methods needed for feat-004:
  - `updateProfile(userId, fields)` — update `display_name`, `bio`
  - `updateNotificationPreferences(userId, prefs)` — update `notification_preferences`
  - `completeOnboarding(userId, step)` — set `onboarding_completed = true`, record `onboarding_step`
  - `addRole(userId, role, assignedBy)` — insert into `user_roles` ON CONFLICT DO NOTHING
  - `updateOnboardingStep(userId, step)` — persist mid-flow progress without completing

### 1.4 PgUserRepository

`/workspace/packages/backend/src/account/adapters/pg/pg-user-repository.ts`:

- `UserRow` interface maps DB columns to TypeScript — will need extending for new columns
- All queries already scope to user ID via parameterised queries
- The `upsertWithBackerRole` method uses a transaction with explicit `BEGIN/COMMIT/ROLLBACK` — good pattern to follow for multi-step operations (e.g., complete onboarding + add role atomically)

### 1.5 API Layer

`/workspace/packages/backend/src/account/api/me-router.ts`:

- Only has `GET /` (maps to `GET /api/v1/me`)
- Returns: `id`, `clerkUserId`, `email`, `displayName`, `avatarUrl`, `accountStatus`, `onboardingCompleted`, `roles`, `createdAt`, `updatedAt`
- Missing from response: `bio`, `notificationPreferences`, `onboardingStep`
- No `PUT` handlers exist yet

`/workspace/packages/backend/src/account/api/api-router.ts`:

- Mounts `meRouter` at `/me`
- No other routes exist yet

### 1.6 Frontend

`/workspace/packages/frontend/src/App.tsx`:

- Routes: `/sign-in/*`, `/sign-up/*`, `/dashboard` (protected), `/` → redirect to `/dashboard`
- Missing routes: `/onboarding`, `/profile`
- `ProtectedRoute` only checks Clerk `isSignedIn` — does NOT check `onboardingCompleted`

`/workspace/packages/frontend/src/components/layout/protected-route.tsx`:

- Checks `isLoaded` + `isSignedIn` only
- Must be extended (or a new wrapper added) to also redirect to `/onboarding` if `onboardingCompleted === false`

`/workspace/packages/frontend/src/pages/dashboard.tsx`:

- Uses `useUser()` from Clerk — does NOT call `GET /api/v1/me`
- Has no awareness of MMF user profile data (bio, notificationPreferences, etc.)
- Will need to integrate with TanStack Query hook for MMF user data

---

## 2. Data Model Changes Required

### 2.1 New Migration: `20260306000008_add_onboarding_and_notifications.sql`

```sql
-- migrate:up
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS onboarding_step INT NULL,
  ADD COLUMN IF NOT EXISTS notification_preferences JSONB NOT NULL DEFAULT '{}';

-- migrate:down
ALTER TABLE users
  DROP COLUMN IF EXISTS onboarding_step,
  DROP COLUMN IF EXISTS notification_preferences;
```

Rationale:
- `onboarding_step INT NULL` — NULL means not started, 1/2/3 maps to wizard step reached
- `notification_preferences JSONB NOT NULL DEFAULT '{}'` — empty object on creation; application fills defaults on first onboarding completion
- No index needed on `notification_preferences` — queried only for the authenticated user's own record
- No `updated_at` trigger change needed — existing trigger fires on any `UPDATE` to the `users` row

### 2.2 `bio` Column Status

`bio TEXT NULL` already exists in `20260306000001_create_accounts.sql`.
No migration needed.
The domain model (`UserData` interface) and `UserRow` in `PgUserRepository` simply do not expose it yet — that is a code-only fix.

---

## 3. Notification Preferences Schema

The `notification_preferences` JSONB column stores a structured object.

### 3.1 Canonical Schema

```typescript
interface NotificationPreferences {
  campaign_updates: boolean;           // default: true
  milestone_completions: boolean;      // default: true
  contribution_confirmations: boolean; // default: true
  new_recommendations: boolean;        // default: true
  platform_announcements: boolean;     // default: false (per L4-001 Section 2.1)
  // security_alerts: intentionally absent — always-on, not persisted
}
```

### 3.2 Design Decisions

- `security_alerts` is NOT stored — it is always-on and the API always returns `security_alerts: true` as a computed constant, never from the DB.
  This prevents any future code path from accidentally reading `false` from a legacy row.
- Unknown keys sent by the client are rejected via Zod validation (strict schema), not silently ignored.
  Rationale: forward compatibility is not a concern at this stage; strict validation surfaces client bugs.
- Default value when `notification_preferences = '{}'` (newly created user, never completed onboarding):
  The `GET /api/v1/me` response should compute defaults in application code, not rely on DB default.
  This prevents inconsistency if defaults change.

### 3.3 Default Computation

```typescript
const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  campaign_updates: true,
  milestone_completions: true,
  contribution_confirmations: true,
  new_recommendations: true,
  platform_announcements: false,
};
```

When `notification_preferences` is `{}` or does not contain a key, the GET response merges with defaults before returning.

---

## 4. API Design

### 4.1 Endpoint Inventory

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/v1/me` | Already exists. Must be extended to return `bio`, `notificationPreferences` (with `security_alerts: true` computed), `onboardingStep`. |
| `PUT` | `/api/v1/me` | Update profile fields: `display_name`, `bio`. |
| `PUT` | `/api/v1/me/notification-preferences` | Replace notification preferences. |
| `POST` | `/api/v1/me/onboarding/complete` | Mark onboarding complete, set final step. |
| `PATCH` | `/api/v1/me/onboarding/step` | Persist current step mid-flow (resume support). |

### 4.2 `PUT /api/v1/me` Request/Response

**Request body** (Zod schema):
```typescript
z.object({
  display_name: z.string().trim().min(1).max(100).nullable().optional(),
  bio: z.string().trim().max(500).nullable().optional(),
})
```

- `display_name` must not be empty-after-trim if provided (min(1) after trim catches whitespace-only)
- `bio` max 500 characters (reasonable for demo; not specified in brief, derive from UX constraints)
- Both fields optional — PATCH semantics within PUT (only provided fields are updated)
- Returns `200` with full updated user profile

**Response body** (same shape as `GET /api/v1/me`):
```json
{
  "data": {
    "id": "...",
    "clerkUserId": "...",
    "email": "...",
    "displayName": "Yuki Tanaka",
    "bio": "Aerospace engineer and Mars advocate.",
    "avatarUrl": null,
    "accountStatus": "active",
    "onboardingCompleted": true,
    "onboardingStep": 3,
    "roles": ["backer", "creator"],
    "notificationPreferences": {
      "campaign_updates": true,
      "milestone_completions": true,
      "contribution_confirmations": true,
      "new_recommendations": true,
      "platform_announcements": false,
      "security_alerts": true
    },
    "createdAt": "2026-03-06T00:00:00.000Z",
    "updatedAt": "2026-03-06T01:23:45.000Z"
  }
}
```

### 4.3 `PUT /api/v1/me/notification-preferences` Request/Response

**Request body** (Zod schema — strict, no extra keys):
```typescript
z.object({
  campaign_updates: z.boolean(),
  milestone_completions: z.boolean(),
  contribution_confirmations: z.boolean(),
  new_recommendations: z.boolean(),
  platform_announcements: z.boolean(),
  // security_alerts not accepted — always true, ignored if sent
}).strict()
```

- All five toggleable fields required (full replacement, not partial)
- `security_alerts` is rejected if present (strict mode); alternatively stripped — decision: **reject with 400** to be explicit
- Returns `200` with updated notification preferences

### 4.4 `POST /api/v1/me/onboarding/complete`

**Request body**:
```typescript
z.object({
  step: z.number().int().min(1).max(3),
  roles: z.array(z.enum(['backer', 'creator'])).min(1).max(2),
  display_name: z.string().trim().min(1).max(100).nullable().optional(),
  bio: z.string().trim().max(500).nullable().optional(),
})
```

This endpoint:
1. Upserts the selected roles into `user_roles` (ON CONFLICT DO NOTHING for backer; new row for creator if selected)
2. Updates `display_name` and `bio` if provided
3. Sets `onboarding_completed = true` and `onboarding_step = step`

All three operations execute in a single DB transaction for atomicity.

Returns `200` with full updated user profile (same shape as GET).

### 4.5 `PATCH /api/v1/me/onboarding/step`

**Request body**:
```typescript
z.object({
  step: z.number().int().min(1).max(3),
})
```

- Only updates `onboarding_step`, does NOT set `onboarding_completed = true`
- Returns `200` with `{ data: { onboardingStep: 2 } }` (minimal response)
- Used by frontend to persist step as user navigates the wizard

### 4.6 Onboarding State Decision

**Decision**: Keep onboarding completion as a separate endpoint (`POST /api/v1/me/onboarding/complete`) rather than embedding in `PUT /api/v1/me`.

Rationale:
- Completion is a state transition (idempotent after first call, but semantically distinct from profile edits)
- The completion endpoint bundles role assignment atomically — mixing this into a general PUT adds complexity
- `PUT /api/v1/me` remains a simple profile update; the onboarding endpoint is a workflow action

---

## 5. Onboarding Flow Details

### 5.1 Step Definition

| Step | Route | Content |
|------|-------|---------|
| 1 | `/onboarding` or `/onboarding?step=1` | Welcome screen — brand copy, "Begin" CTA |
| 2 | `/onboarding?step=2` | Role selection — Backer, Creator, or both |
| 3 | `/onboarding?step=3` | Optional profile fields — display name, bio |

Step 3 is followed by completion: call `POST /api/v1/me/onboarding/complete`, then redirect to `/dashboard`.

### 5.2 Role Selection Behaviour

- **Backer selected only**: No additional prompts. Backer role is already assigned (from auth sync).
- **Creator selected** (with or without Backer): A modal/inline prompt appears explaining KYC is required.
  - "Start KYC now" → navigate to `/kyc` (feat-005 stub; page may not exist yet — renders a placeholder)
  - "Skip for now" → onboarding still completes; creator role IS added to `user_roles`
  - The KYC prompt is informational only; it does not block onboarding completion

### 5.3 Role Addition on Completion

When `POST /api/v1/me/onboarding/complete` includes `roles: ['backer', 'creator']`:

```sql
-- backer: already exists from auth sync, but idempotent:
INSERT INTO user_roles (id, user_id, role, assigned_by)
VALUES ($1, $2, 'backer', NULL)
ON CONFLICT (user_id, role) DO NOTHING;

-- creator: new insert
INSERT INTO user_roles (id, user_id, role, assigned_by)
VALUES ($3, $2, 'creator', NULL)
ON CONFLICT (user_id, role) DO NOTHING;
```

### 5.4 Progress Persistence

- On every step advance: `PATCH /api/v1/me/onboarding/step` with current step number
- On mount of `/onboarding` page: check `user.onboardingStep` from `GET /api/v1/me` and initialise wizard to that step
- If `onboardingStep` is null and `onboardingCompleted` is false → start from step 1

### 5.5 Redirect Logic

The `ProtectedRoute` component needs extending. Two patterns are possible:

**Option A**: Add a second wrapper `OnboardingGuard` around protected routes:
```tsx
// In App.tsx:
<ProtectedRoute>
  <OnboardingGuard>
    <DashboardPage />
  </OnboardingGuard>
</ProtectedRoute>
```
`OnboardingGuard` calls `GET /api/v1/me`, checks `onboardingCompleted`, and redirects to `/onboarding` if false.

**Option B**: Extend `ProtectedRoute` to also check onboarding status.

**Recommendation: Option A** (separate `OnboardingGuard`).
- Keeps `ProtectedRoute` single-responsibility (auth only)
- `OnboardingGuard` can show a spinner while the ME query loads
- The `/onboarding` route itself does NOT use `OnboardingGuard` (infinite redirect loop prevention)

### 5.6 Already-Completed Redirect

If a user navigates directly to `/onboarding` when `onboardingCompleted === true`:

- The onboarding page component checks `user.onboardingCompleted` from the ME query
- If true, renders `<Navigate to="/dashboard" replace />`
- This prevents re-running the wizard

---

## 6. Frontend Architecture

### 6.1 New Routes in App.tsx

```tsx
<Route path="/onboarding" element={
  <ProtectedRoute>
    <OnboardingPage />
  </ProtectedRoute>
} />
<Route path="/profile" element={
  <ProtectedRoute>
    <OnboardingGuard>
      <ProfilePage />
    </OnboardingGuard>
  </ProtectedRoute>
} />
```

The `/onboarding` route uses `ProtectedRoute` but NOT `OnboardingGuard` (avoids redirect loop).

### 6.2 TanStack Query Hooks

A `useCurrentUser()` hook wraps `GET /api/v1/me`:

```typescript
// packages/frontend/src/hooks/use-current-user.ts
export function useCurrentUser() {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => apiClient.get('/api/v1/me'),
    staleTime: 30_000,
  });
}
```

Mutations:
- `useUpdateProfile()` — wraps `PUT /api/v1/me`
- `useUpdateNotificationPreferences()` — wraps `PUT /api/v1/me/notification-preferences`
- `useCompleteOnboarding()` — wraps `POST /api/v1/me/onboarding/complete`
- `useSaveOnboardingStep()` — wraps `PATCH /api/v1/me/onboarding/step`

All mutations call `queryClient.invalidateQueries({ queryKey: ['me'] })` on success.

### 6.3 Component Tree

```
OnboardingPage
  OnboardingWizard
    Step1Welcome
    Step2RoleSelection
      KycPromptModal (conditional — shown when Creator selected)
    Step3ProfileFields

ProfilePage
  ProfileHeader (display name, avatar placeholder, email read-only)
  ProfileEditForm (display_name, bio)
  RolesDisplay (read-only list)
  KycStatusDisplay (read-only — sourced from user.kycStatus, out of scope for this feature but placeholder)
  NotificationPreferencesForm
    NotificationToggle (per category)
    SecurityAlertRow (always-on, non-interactive)
```

---

## 7. Backend Architecture

### 7.1 Domain Model Changes

Extend `UserData` interface:
- Add `bio: string | null`
- Add `notificationPreferences: NotificationPreferences` (with type imported from a shared value object)
- Add `onboardingStep: number | null`

Extend `User` entity with getters for new fields.

### 7.2 New Application Service: `ProfileService`

```typescript
// packages/backend/src/account/application/profile-service.ts
export class ProfileService {
  constructor(private readonly userRepo: UserRepository) {}

  async updateProfile(userId: string, fields: UpdateProfileInput): Promise<User>
  async updateNotificationPreferences(userId: string, prefs: NotificationPreferences): Promise<User>
  async completeOnboarding(userId: string, input: CompleteOnboardingInput): Promise<User>
  async saveOnboardingStep(userId: string, step: number): Promise<void>
}
```

### 7.3 New Port Methods on `UserRepository`

```typescript
updateProfile(userId: string, fields: { displayName?: string | null; bio?: string | null }): Promise<User>;
updateNotificationPreferences(userId: string, prefs: NotificationPreferences): Promise<User>;
completeOnboarding(userId: string, input: {
  step: number;
  roles: string[];
  displayName?: string | null;
  bio?: string | null;
}): Promise<User>;
saveOnboardingStep(userId: string, step: number): Promise<void>;
```

### 7.4 Server Wiring

`server.ts` currently passes only `userRepository` to `createApiRouter`.
After feat-004, `createApiRouter` will also receive `profileService`:

```typescript
const profileService = new ProfileService(userRepository);
app.use('/api/v1', createApiRouter(userRepository, profileService));
```

---

## 8. Edge Cases

The following edge cases must be handled. These inform test coverage and validation logic.

1. **Empty/whitespace display_name** → `PUT /api/v1/me` with `{ display_name: "   " }` — Zod `.trim().min(1)` rejects this → `400` with `{ error: { code: 'VALIDATION_ERROR', message: '...' } }`.

2. **bio exceeds max length** → `PUT /api/v1/me` with bio > 500 chars → `400` validation error.

3. **Creator selected in onboarding; user clicks "Skip KYC"** → onboarding still completes; `creator` role IS added to `user_roles`. The KYC prompt is informational, not a gate.

4. **Creator selected; user clicks "Start KYC now"** → navigates to `/kyc`. If `/kyc` page does not yet exist (feat-005 not built), the wildcard route in `App.tsx` redirects to `/`. Solution: add a `/kyc` stub route that renders a placeholder page, or update the wildcard to redirect to `/dashboard`.

5. **User abandons onboarding at step 2** → `PATCH /api/v1/me/onboarding/step` has saved step 2. On next login, `OnboardingGuard` redirects to `/onboarding`; wizard reads `onboardingStep: 2` from ME response and resumes at step 2.

6. **User already completed onboarding; navigates to `/onboarding`** → OnboardingPage reads `onboardingCompleted: true` from ME query → renders `<Navigate to="/dashboard" replace />`.

7. **User already has `creator` role; selects Creator again in onboarding** → `INSERT INTO user_roles ... ON CONFLICT (user_id, role) DO NOTHING` — idempotent, no error, no duplicate row.

8. **User already has `creator` role; selects Backer only in onboarding** → `POST /api/v1/me/onboarding/complete` with `roles: ['backer']` — does NOT remove the existing creator role. Role removal is not in scope for onboarding (per L4-001 Section 2.2: role selection does not permanently lock assignment).

9. **Concurrent `PUT /api/v1/me` requests** → last writer wins. No optimistic locking required. The `updated_at` trigger records the final update time. This is acceptable for profile fields (no financial or security implications).

10. **`notification_preferences` with unknown category key** → Zod strict schema on the request body rejects extra keys → `400`. This prevents silent acceptance of typo'd category names.

11. **User sends `security_alerts: false` in `PUT /api/v1/me/notification-preferences`** → Zod strict schema does not include `security_alerts` as a valid key → rejected with `400`. The always-on constraint is enforced at the schema level, not just in the response mapping.

12. **`notification_preferences` is `{}` in DB (newly created user, never completed onboarding)** → `GET /api/v1/me` merges with `DEFAULT_NOTIFICATION_PREFERENCES` before returning → response always contains all five toggleable keys plus `security_alerts: true`.

13. **User directly navigates to `/dashboard` without completing onboarding** → `OnboardingGuard` fetches ME, sees `onboardingCompleted: false` → redirects to `/onboarding`. Redirect happens after ME query resolves; show spinner while loading.

14. **ME query is slow / fails on redirect** → `OnboardingGuard` must handle loading and error states. On error, fall through to render the protected page (fail open, not fail closed — onboarding redirect is UX, not security).

15. **User completes onboarding but `POST /api/v1/me/onboarding/complete` request fails (network error)** → `onboarding_completed` remains false in DB. On retry, the endpoint is idempotent (setting the same values again is safe). Frontend shows error state and allows retry.

16. **User with no roles in DB** → This should not occur (auth sync always assigns `backer`), but `GET /api/v1/me` returns `roles: []` defensively. The `OnboardingGuard` should not gate on role presence — only on `onboardingCompleted`.

17. **display_name set to null (explicit clear)** → `PUT /api/v1/me` with `{ display_name: null }` is valid — clears the display name. The domain entity permits `displayName: string | null`. Public surfaces fall back to email or Clerk name.

18. **bio set to null (explicit clear)** → Same as above — `{ bio: null }` clears the bio field. Valid and permitted.

---

## 9. Migration Timestamp

Last existing migration: `20260306000007_create_escrow_ledger.sql`

Next migration: `20260306000008_add_onboarding_and_notifications.sql`

---

## 10. Spec Compliance Notes

### L4-001 Cross-references

- Section 2.1 (Onboarding Flow): feat-004 implements steps 1–3 and the KYC trigger. Notification preferences are shown during onboarding per spec — this means step 3 may need an optional step 4 for notification prefs, or they default on completion. **Decision**: spec brief (feat-004-account-onboarding.md) does not include notification prefs as an onboarding step; they live on the profile page only. The L4-001 spec mentions them as part of onboarding, but the brief (more specific, more recent) takes precedence for this implementation. Flag as a known deviation.

- Section 2.2 (Onboarding State): Persistence via `onboarding_step` column — implemented.

- Section 3.1 (Role Rules): Creator role may be assigned before KYC — implemented as described. KYC status display on profile is read-only placeholder (KYC domain is feat-005).

- Section 4.2 (Notification Preferences): `security_alerts` mandatory and non-disableable — implemented via computed constant in API response and Zod rejection of the field in PUT.

### L2-001 / L3-005 (Brand / Frontend Standards)

- Dark-first UI: `--color-bg-page` background throughout onboarding wizard and profile page
- `--font-display` (Bebas Neue, uppercase) for step headings
- `--font-body` (DM Sans) for instructional copy and form labels
- `--gradient-action-primary` on the primary CTA ("Continue", "Complete Setup")
- One primary CTA per viewport — "Back" is ghost/secondary
- `prefers-reduced-motion` respected on any step transition animations
- Toggles for notification preferences: use semantic HTML `<input type="checkbox">` wrapped in accessible label, not custom `<div>` elements

### L2-002 / Backend Rules

- Domain layer: `NotificationPreferences` value object — no infrastructure imports
- Zod validation on all request bodies — all three new endpoints
- `user_id` always from `req.auth.userId`, never from request body
- Parameterised queries throughout
- Pino logging for all state mutations (profile update, onboarding complete, role addition)

---

## 11. Files to Create / Modify

### New Files

| Path | Purpose |
|------|---------|
| `db/migrations/20260306000008_add_onboarding_and_notifications.sql` | Add `onboarding_step` and `notification_preferences` columns |
| `packages/backend/src/account/domain/value-objects/notification-preferences.ts` | `NotificationPreferences` type + defaults + validation |
| `packages/backend/src/account/application/profile-service.ts` | Application service for profile and onboarding mutations |
| `packages/backend/src/account/application/profile-service.test.ts` | Integration tests with mock adapter |
| `packages/backend/src/account/api/me-router.test.ts` | API integration tests (PUT /me, PUT /me/notification-preferences, POST /me/onboarding/complete, PATCH /me/onboarding/step) |
| `packages/frontend/src/hooks/use-current-user.ts` | TanStack Query hook for GET /api/v1/me |
| `packages/frontend/src/hooks/use-update-profile.ts` | Mutation hook for PUT /api/v1/me |
| `packages/frontend/src/hooks/use-update-notification-preferences.ts` | Mutation hook |
| `packages/frontend/src/hooks/use-complete-onboarding.ts` | Mutation hook |
| `packages/frontend/src/hooks/use-save-onboarding-step.ts` | Mutation hook |
| `packages/frontend/src/components/layout/onboarding-guard.tsx` | Redirect to /onboarding if not completed |
| `packages/frontend/src/pages/onboarding.tsx` | Multi-step onboarding wizard page |
| `packages/frontend/src/pages/profile.tsx` | Profile management page |
| `packages/frontend/src/components/onboarding/step-welcome.tsx` | Step 1 component |
| `packages/frontend/src/components/onboarding/step-role-selection.tsx` | Step 2 component |
| `packages/frontend/src/components/onboarding/step-profile-fields.tsx` | Step 3 component |
| `packages/frontend/src/components/onboarding/kyc-prompt-modal.tsx` | KYC prompt shown on Creator selection |
| `packages/frontend/src/components/profile/notification-preferences-form.tsx` | Toggle form for notification prefs |
| `packages/frontend/src/pages/kyc-stub.tsx` | Minimal stub for `/kyc` route (prevents wildcard redirect) |

### Modified Files

| Path | Change |
|------|--------|
| `packages/backend/src/account/domain/models/user.ts` | Add `bio`, `notificationPreferences`, `onboardingStep` to `UserData` and `User` getters |
| `packages/backend/src/account/ports/user-repository.ts` | Add new port methods |
| `packages/backend/src/account/adapters/pg/pg-user-repository.ts` | Implement new port methods; extend `UserRow` |
| `packages/backend/src/account/adapters/mock/mock-user-repository.ts` | Implement new port methods for test/mock use |
| `packages/backend/src/account/api/me-router.ts` | Add `PUT /`, `PUT /notification-preferences`, `POST /onboarding/complete`, `PATCH /onboarding/step` handlers; extend GET response |
| `packages/backend/src/account/api/api-router.ts` | Accept `profileService` parameter; pass to router |
| `packages/backend/src/server.ts` | Construct `ProfileService`, pass to `createApiRouter` |
| `packages/frontend/src/App.tsx` | Add `/onboarding`, `/profile`, `/kyc` routes |

---

## 12. Open Questions / Decisions Made

| Question | Decision |
|----------|----------|
| Should notification preferences be collected during onboarding? | No — per feat-004 brief, they live on the profile page. Deviation from L4-001 Section 2.1. Acceptable for demo scope. |
| Should `security_alerts` be stored in JSONB? | No — computed constant in API layer. Cannot be toggled. |
| Unknown keys in notification-preferences PUT? | Reject with 400 (Zod strict). |
| Should onboarding completion and profile update be one endpoint? | No — separate endpoints. Completion is a state transition; profile update is ongoing. |
| What happens if user sends `{ display_name: "   " }`? | 400 — Zod `.trim().min(1)` on the server catches whitespace-only strings. |
| What is the bio max length? | 500 characters. Not specified in brief; derived from typical bio field UX conventions. |
| What migration number to use? | `20260306000008` (next after `20260306000007`). |
| Avatar upload in onboarding step 3? | Out of scope per brief. Step 3 shows display name + bio only. Avatar from Clerk or placeholder. |
