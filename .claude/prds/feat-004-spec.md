# feat-004 Spec: Account Onboarding and Profile Management

**Spec ID**: feat-004-spec
**Feature Brief**: `.claude/prds/feat-004-account-onboarding.md`
**Research**: `.claude/prds/feat-004-research.md`
**Bounded Context**: Account
**Spec Date**: 2026-03-06
**Status**: Implementation-Ready

---

## 1. Overview

This spec delivers the first-run onboarding wizard and profile management page for Mars Mission Fund. It extends the Account bounded context established in feat-003.

**Scope**:
- Database migration: two new columns on `users`
- Domain model extensions: `bio`, `onboardingStep`, `notificationPreferences`
- Five new/extended API endpoints under `/api/v1/me`
- Frontend: onboarding wizard (3-step), profile page, `OnboardingGuard`, three new routes

**Out of scope**: avatar upload, email change, account deactivation, GDPR erasure, session management UI.

---

## 2. Data Model

### 2.1 Migration

**File**: `db/migrations/20260306000008_add_onboarding_and_notifications.sql`

```sql
-- migrate:up
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS onboarding_step INT NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS notification_preferences JSONB NOT NULL DEFAULT '{}';

-- migrate:down
ALTER TABLE users
  DROP COLUMN IF EXISTS onboarding_step,
  DROP COLUMN IF EXISTS notification_preferences;
```

- `onboarding_step INT NULL DEFAULT NULL`: NULL = wizard never opened; 1/2/3 = last step reached
- `notification_preferences JSONB NOT NULL DEFAULT '{}'`: empty object on row creation; application fills defaults at read time
- No new index required: both columns are only ever queried for the authenticated user's own row
- `updated_at` trigger already exists on `users`; no trigger change needed
- `bio TEXT NULL` already exists from `20260306000001_create_accounts.sql`; no migration needed

### 2.2 Notification Preferences Schema

Stored in `notification_preferences` JSONB. Five toggleable keys; `security_alerts` is NOT stored.

```typescript
// packages/backend/src/account/domain/value-objects/notification-preferences.ts

export interface NotificationPreferences {
  readonly campaign_updates: boolean;
  readonly milestone_completions: boolean;
  readonly contribution_confirmations: boolean;
  readonly new_recommendations: boolean;
  readonly platform_announcements: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  campaign_updates: true,
  milestone_completions: true,
  contribution_confirmations: true,
  new_recommendations: true,
  platform_announcements: false,
};

/** Merge stored prefs with defaults so missing keys always have a value. */
export function resolveNotificationPreferences(
  stored: Partial<NotificationPreferences>,
): NotificationPreferences {
  return { ...DEFAULT_NOTIFICATION_PREFERENCES, ...stored };
}
```

`security_alerts` is a computed constant — always returned as `true` in API responses, never read from or written to the database. Any attempt to submit it via API is rejected with `400`.

---

## 3. Domain Model Changes

**File to modify**: `packages/backend/src/account/domain/models/user.ts`

### 3.1 Updated `UserData` Interface

Add three fields to the existing `UserData` interface:

```typescript
import type { NotificationPreferences } from '../value-objects/notification-preferences.js';

export interface UserData {
  readonly id: string;
  readonly clerkUserId: string;
  readonly email: string;
  readonly displayName: string | null;
  readonly avatarUrl: string | null;
  readonly bio: string | null;                                    // ADD
  readonly accountStatus: AccountStatus;
  readonly onboardingCompleted: boolean;
  readonly onboardingStep: number | null;                         // ADD
  readonly notificationPreferences: NotificationPreferences;      // ADD
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
```

### 3.2 New Getters on `User`

Add corresponding getters to the `User` class:

```typescript
get bio(): string | null { return this.data.bio; }
get onboardingStep(): number | null { return this.data.onboardingStep; }
get notificationPreferences(): NotificationPreferences { return this.data.notificationPreferences; }
```

---

## 4. Repository Port

**File to modify**: `packages/backend/src/account/ports/user-repository.ts`

Add the following methods to the `UserRepository` interface:

```typescript
updateProfile(
  userId: string,
  fields: { displayName?: string | null; bio?: string | null },
): Promise<User>;

updateNotificationPreferences(
  userId: string,
  prefs: NotificationPreferences,
): Promise<User>;

completeOnboarding(
  userId: string,
  input: {
    step: number;
    roles: string[];
    displayName?: string | null;
    bio?: string | null;
  },
): Promise<User>;

saveOnboardingStep(userId: string, step: number): Promise<void>;
```

---

## 5. PgUserRepository Changes

**File to modify**: `packages/backend/src/account/adapters/pg/pg-user-repository.ts`

### 5.1 Extended `UserRow`

```typescript
interface UserRow {
  id: string;
  clerk_id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;                          // ADD
  account_status: string;
  onboarding_completed: boolean;
  onboarding_step: number | null;              // ADD
  notification_preferences: Record<string, boolean>;  // ADD
  created_at: Date;
  updated_at: Date;
}
```

### 5.2 Updated `toUser` Mapper

The `toUser` function must pass `bio`, `onboardingStep`, and `notificationPreferences` (resolved via `resolveNotificationPreferences`) to `User.reconstitute`.

All existing SELECT queries (`findByClerkId`, `findById`, `upsertWithBackerRole`) must be updated to include `bio, onboarding_step, notification_preferences` in the column list.

### 5.3 New Method: `updateProfile`

```sql
UPDATE users
SET display_name = COALESCE($2, display_name),
    bio = COALESCE($3, bio),
    updated_at = NOW()
WHERE id = $1
RETURNING id, clerk_id, email, display_name, avatar_url, bio,
          account_status, onboarding_completed, onboarding_step,
          notification_preferences, created_at, updated_at
```

- `$2` = `displayName ?? null`; `$3` = `bio ?? null`
- If caller passes `null` explicitly (to clear a field), use a different UPDATE that sets the column directly to NULL:
  ```sql
  UPDATE users SET display_name = $2, bio = $3, updated_at = NOW() WHERE id = $1 RETURNING ...
  ```
  The application layer passes `undefined` for "not provided" and `null` for "explicit clear". The repository must distinguish these: if `displayName` key is absent from the input object, skip the column; if present as `null`, set to NULL. Use parameterised conditional SQL or separate queries as needed.
- Fetch roles after update; return reconstituted `User`.

### 5.4 New Method: `updateNotificationPreferences`

```sql
UPDATE users
SET notification_preferences = $2,
    updated_at = NOW()
WHERE id = $1
RETURNING id, clerk_id, email, display_name, avatar_url, bio,
          account_status, onboarding_completed, onboarding_step,
          notification_preferences, created_at, updated_at
```

- `$2` = JSON.stringify(prefs) — pg driver serialises objects automatically when parameterised
- Returns reconstituted `User`

### 5.5 New Method: `completeOnboarding`

Executes inside a single database transaction:

1. For each role in `input.roles`:
   ```sql
   INSERT INTO user_roles (id, user_id, role, assigned_by)
   VALUES ($1, $2, $3, NULL)
   ON CONFLICT (user_id, role) DO NOTHING
   ```
2. Update profile fields and mark completion:
   ```sql
   UPDATE users
   SET display_name = $2,
       bio = $3,
       onboarding_completed = true,
       onboarding_step = $4,
       updated_at = NOW()
   WHERE id = $1
   RETURNING id, clerk_id, email, display_name, avatar_url, bio,
             account_status, onboarding_completed, onboarding_step,
             notification_preferences, created_at, updated_at
   ```
   - `$2` = `input.displayName ?? null` (pass-through; do not use COALESCE here — explicit null clears the field, undefined means do not change, resolve in the service layer before calling repository)
3. Fetch roles within the same client connection
4. COMMIT; return reconstituted `User`
5. On error: ROLLBACK; rethrow

### 5.6 New Method: `saveOnboardingStep`

```sql
UPDATE users SET onboarding_step = $2, updated_at = NOW() WHERE id = $1
```

- Returns `void`
- Does NOT set `onboarding_completed`

---

## 6. Application Service

**New file**: `packages/backend/src/account/application/profile-service.ts`

```typescript
export interface UpdateProfileInput {
  displayName?: string | null;
  bio?: string | null;
}

export interface CompleteOnboardingInput {
  step: number;
  roles: ('backer' | 'creator')[];
  displayName?: string | null;
  bio?: string | null;
}

export class ProfileService {
  constructor(private readonly userRepo: UserRepository) {}

  async updateProfile(userId: string, fields: UpdateProfileInput): Promise<User>
  async updateNotificationPreferences(userId: string, prefs: NotificationPreferences): Promise<User>
  async completeOnboarding(userId: string, input: CompleteOnboardingInput): Promise<User>
  async saveOnboardingStep(userId: string, step: number): Promise<void>
}
```

Rules:
- No business logic beyond input forwarding — validation happens at the API layer (Zod)
- `userId` is always sourced from `req.auth.userId` (set by the caller); never passed from request body
- Log each mutation at `info` level using the injected or module-level Pino logger: include `userId` and operation name; never log `displayName`, `bio`, or preference values

---

## 7. API Endpoints

All endpoints are under `/api/v1/me`. All require a valid Clerk JWT (enforced by existing middleware). `user_id` is always taken from `req.auth.userId`.

### 7.1 `GET /api/v1/me` (Extend Existing)

**File to modify**: `packages/backend/src/account/api/me-router.ts`

Add `bio`, `onboardingStep`, and `notificationPreferences` to the existing response. `notificationPreferences` always includes the computed constant `securityAlerts: true`.

**Response shape** (200):
```json
{
  "data": {
    "id": "uuid",
    "clerkUserId": "user_xxx",
    "email": "user@example.com",
    "displayName": "Yuki Tanaka",
    "bio": "Aerospace engineer.",
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

Note: `security_alerts` is appended in the API response mapping — it is not on the `NotificationPreferences` type and is never read from the database.

### 7.2 `PUT /api/v1/me`

Update `display_name` and/or `bio` for the authenticated user.

**Zod schema** (request body):
```typescript
z.object({
  display_name: z.string().trim().min(1, 'Display name cannot be empty').max(100).nullable().optional(),
  bio: z.string().max(500).nullable().optional(),
})
```

- `display_name`: if provided as a non-null string, trimmed and must be at least 1 character after trim (rejects whitespace-only)
- `display_name: null`: valid — clears the field
- `bio`: no trim applied server-side (preserve intentional whitespace); max 500 chars; `null` clears the field
- Both fields optional — provide neither and nothing changes

**Success** (200): full user object (same shape as `GET /api/v1/me`)

**Errors**:
- 400 `VALIDATION_ERROR`: schema violation (whitespace-only name, bio too long, unexpected fields)
- 401 `UNAUTHORIZED`: no auth
- 404 `USER_NOT_FOUND`: user deleted between auth and lookup (defensive)

### 7.3 `PUT /api/v1/me/notification-preferences`

Replace all notification preferences for the authenticated user.

**Zod schema** (request body, strict — extra keys rejected):
```typescript
z.object({
  campaign_updates: z.boolean(),
  milestone_completions: z.boolean(),
  contribution_confirmations: z.boolean(),
  new_recommendations: z.boolean(),
  platform_announcements: z.boolean(),
}).strict()
```

- All five fields required (full replacement, not partial merge)
- `security_alerts` is not in the schema; if included, Zod `.strict()` rejects it with 400
- No unknown keys accepted

**Success** (200): full user object (same shape as `GET /api/v1/me`)

**Errors**:
- 400 `VALIDATION_ERROR`: missing required fields, unknown keys (including `security_alerts`), non-boolean values
- 401 `UNAUTHORIZED`: no auth

### 7.4 `POST /api/v1/me/onboarding/complete`

Atomically: upsert roles, optionally update profile, set `onboarding_completed = true`.

**Zod schema** (request body):
```typescript
z.object({
  step: z.number().int().min(1).max(3),
  roles: z.array(z.enum(['backer', 'creator'])).min(1).max(2),
  display_name: z.string().trim().min(1).max(100).nullable().optional(),
  bio: z.string().max(500).nullable().optional(),
})
```

- `step`: the wizard step the user completed (1–3); stored in `onboarding_step`
- `roles`: at least one of `backer` or `creator`; duplicates in the array are harmless (DB handles via `ON CONFLICT DO NOTHING`)
- `display_name` and `bio`: optional profile fields collected during onboarding
- If `onboarding_completed` is already `true` in the database: the endpoint is idempotent — re-runs the update and returns 200 (no error, no state regression)

**Success** (200): full user object (same shape as `GET /api/v1/me`)

**Errors**:
- 400 `VALIDATION_ERROR`: invalid roles array, step out of range, name/bio violations
- 401 `UNAUTHORIZED`: no auth

### 7.5 `PATCH /api/v1/me/onboarding/step`

Persist current wizard step mid-flow without marking onboarding complete.

**Zod schema** (request body):
```typescript
z.object({
  step: z.number().int().min(1).max(3),
})
```

**Success** (204): no response body

**Errors**:
- 400 `VALIDATION_ERROR`: step not an integer or out of range
- 401 `UNAUTHORIZED`: no auth

### 7.6 Router Wiring

**File to modify**: `packages/backend/src/account/api/api-router.ts`

`createApiRouter` must accept `profileService: ProfileService` as a second parameter and pass it to `createMeRouter`:

```typescript
export function createApiRouter(
  userRepository: UserRepository,
  profileService: ProfileService,
): Router
```

**File to modify**: `packages/backend/src/account/api/me-router.ts`

`createMeRouter` must accept `profileService: ProfileService` as a second parameter.

**File to modify**: `packages/backend/src/server.ts`

Construct `ProfileService` and pass it:

```typescript
const profileService = new ProfileService(userRepository);
// ...
app.use('/api/v1', createApiRouter(userRepository, profileService));
```

---

## 8. MockUserRepository Changes

**File to modify**: `packages/backend/src/account/adapters/mock/mock-user-repository.ts`

Implement the four new `UserRepository` methods using in-memory state mutation. Reconstitute updated `User` objects and update the internal Map. Follow the same pattern as the existing `setAccountStatus` helper. The pre-populated test user must be updated to include `bio: null`, `onboardingStep: null`, and `notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES`.

---

## 9. Frontend

### 9.1 New Routes in `App.tsx`

**File to modify**: `packages/frontend/src/App.tsx`

Add before the wildcard route:

```tsx
import { OnboardingGuard } from './components/layout/onboarding-guard.js';
import OnboardingPage from './pages/onboarding.js';
import ProfilePage from './pages/profile.js';
import KycStubPage from './pages/kyc-stub.js';

// In Routes:
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
<Route path="/kyc" element={
  <ProtectedRoute>
    <OnboardingGuard>
      <KycStubPage />
    </OnboardingGuard>
  </ProtectedRoute>
} />
```

- `/onboarding` uses `ProtectedRoute` only — NOT `OnboardingGuard` (prevents redirect loop)
- `/profile` and `/kyc` use both wrappers

### 9.2 `OnboardingGuard` Component

**New file**: `packages/frontend/src/components/layout/onboarding-guard.tsx`

```tsx
interface OnboardingGuardProps {
  readonly children: React.ReactNode;
}
```

Behaviour:
1. Calls `useCurrentUser()` to get `onboardingCompleted`
2. While loading: render a full-screen spinner (centered, `--color-bg-page` background)
3. On error: render `children` (fail open — onboarding redirect is UX, not a security gate)
4. If `onboardingCompleted === false`: `<Navigate to="/onboarding" replace />`
5. If `onboardingCompleted === true`: render `children`

### 9.3 TanStack Query Hooks

All hooks live in `packages/frontend/src/hooks/`.

**`use-current-user.ts`**:
```typescript
export function useCurrentUser() {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => apiClient.get<MeResponse>('/api/v1/me'),
    staleTime: 30_000,
  });
}
```

**`use-update-profile.ts`**: wraps `PUT /api/v1/me`; on success `invalidateQueries({ queryKey: ['me'] })`

**`use-update-notification-preferences.ts`**: wraps `PUT /api/v1/me/notification-preferences`; on success invalidates `['me']`

**`use-complete-onboarding.ts`**: wraps `POST /api/v1/me/onboarding/complete`; on success invalidates `['me']`

**`use-save-onboarding-step.ts`**: wraps `PATCH /api/v1/me/onboarding/step`; on success invalidates `['me']`

All mutation hooks expose `mutate`/`mutateAsync`, `isPending`, and `error` from `useMutation`.

**Frontend type** for `MeResponse` (shared interface in `packages/frontend/src/types/user.ts`):
```typescript
export interface NotificationPreferencesResponse {
  readonly campaign_updates: boolean;
  readonly milestone_completions: boolean;
  readonly contribution_confirmations: boolean;
  readonly new_recommendations: boolean;
  readonly platform_announcements: boolean;
  readonly security_alerts: boolean;  // always true from API
}

export interface MeData {
  readonly id: string;
  readonly clerkUserId: string;
  readonly email: string;
  readonly displayName: string | null;
  readonly bio: string | null;
  readonly avatarUrl: string | null;
  readonly accountStatus: string;
  readonly onboardingCompleted: boolean;
  readonly onboardingStep: number | null;
  readonly roles: string[];
  readonly notificationPreferences: NotificationPreferencesResponse;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface MeResponse {
  readonly data: MeData;
}
```

Monetary amounts rule applies: no monetary values on this page. Date fields are UTC ISO strings.

### 9.4 Onboarding Page

**New file**: `packages/frontend/src/pages/onboarding.tsx` (default export)

On mount:
- Calls `useCurrentUser()`
- If `onboardingCompleted === true`: renders `<Navigate to="/dashboard" replace />`
- If `onboardingStep` is not null: initialises wizard to that step
- Otherwise: starts at step 1

State: wizard step managed in local React state (`useState<1 | 2 | 3>`). Roles selection also managed locally until `POST /api/v1/me/onboarding/complete` on final submit.

On step advance: call `useSaveOnboardingStep()` to persist step server-side. Do not await — fire and forget (step persistence is best-effort; losing it is a minor UX issue, not a data integrity issue).

On step 3 completion: call `useCompleteOnboarding()` with all collected data. On success: navigate to `/dashboard`.

**Design**:
- Page background: `--color-bg-page`
- Step heading: `--type-page-title` (`--font-display`, uppercase)
- Section label format per spec: e.g., "01 — WELCOME" (`--type-section-label`, `--color-text-accent`)
- Primary CTA ("Continue", "Complete Setup"): `--gradient-action-primary`, `--radius-button`
- Back button: ghost variant
- One primary CTA per viewport (Back is ghost, not primary)
- Step transition: use `--motion-enter` for step panel swap; respect `prefers-reduced-motion`

#### Step 1 — Welcome

Content:
- Section label: "01 — WELCOME"
- Heading: "READY FOR LAUNCH"
- Body copy: "Join the mission. Back the projects taking humanity to Mars. Let's get you set up — it takes less than two minutes."
- CTA: "BEGIN MISSION SETUP"

#### Step 2 — Role Selection

Content:
- Section label: "02 — YOUR ROLE"
- Heading: "HOW WILL YOU CONTRIBUTE?"
- Two selectable cards: **Backer** ("Fund breakthrough Mars missions") and **Creator** ("Launch your own mission campaign")
- Cards are multi-select (both can be chosen); at least one must be selected to continue
- Selecting **Creator** triggers `KycPromptModal` to appear (see below)
- CTA: "CONTINUE"

**`KycPromptModal`** (`packages/frontend/src/components/onboarding/kyc-prompt-modal.tsx`):
- Shown when Creator is selected
- Content: heading "IDENTITY VERIFICATION REQUIRED"; body "Creator accounts require identity verification (KYC) before launching campaigns. You can complete this now or skip and verify later."
- Two buttons: "START KYC NOW" (secondary, navigates to `/kyc`) and "SKIP FOR NOW" (ghost, closes modal)
- Closing or clicking "Skip for now" does NOT deselect Creator role — the role is still added on completion
- Modal overlay: `--color-bg-overlay`, `--motion-panel` transition, `--radius-card-large`

#### Step 3 — Profile Fields

Content:
- Section label: "03 — YOUR PROFILE"
- Heading: "TELL US ABOUT YOURSELF"
- Body copy: "Optional — you can always update this later from your profile."
- Field: Display Name (text input, max 100 chars; empty is valid here — skips setting it)
- Field: Bio (textarea, max 500 chars; char counter displayed)
- Avatar: rendered from Clerk `useUser().user.imageUrl` or a circular placeholder; no upload in this flow
- CTA: "COMPLETE SETUP"

On submit:
- If display name is non-empty after trim: include in request; otherwise omit (do not send empty string; send undefined/omit key)
- Call `POST /api/v1/me/onboarding/complete`
- On success: `navigate('/dashboard', { replace: true })`
- On error: show inline error message; allow retry

### 9.5 Profile Page

**New file**: `packages/frontend/src/pages/profile.tsx` (default export)

Uses `useCurrentUser()` for data. Handles loading (spinner), error (error message with retry), and loaded states.

**Sections**:

**ProfileHeader**: avatar (from `avatarUrl` or circular placeholder), display name or email fallback, role badges, email (read-only, `--color-text-tertiary`), `accountStatus` badge

**ProfileEditForm** (`packages/frontend/src/components/profile/profile-edit-form.tsx`):
- Fields: Display Name (text input), Bio (textarea with 500 char counter)
- Submit: `PUT /api/v1/me`; show `isPending` spinner on button; show success/error inline
- Validation matches server: whitespace-only display name prevented client-side

**RolesDisplay**: read-only list of current roles as badges

**KycStatusDisplay**: read-only placeholder — displays "Identity verification not yet started" with a link to `/kyc`. KYC domain is feat-005; no real status data in this feature.

**NotificationPreferencesForm** (`packages/frontend/src/components/profile/notification-preferences-form.tsx`):
- Renders one row per category:
  - Campaign Updates (default: on)
  - Milestone Completions (default: on)
  - Contribution Confirmations (default: on)
  - New Recommendations (default: on)
  - Platform Announcements (default: off)
  - Security Alerts — always-on row, non-interactive; visually distinct (e.g., lock icon, muted label "Always enabled")
- Each toggleable row: `<input type="checkbox">` in semantic `<label>` — accessible, not custom div
- Submit via "SAVE PREFERENCES" button (secondary variant); calls `PUT /api/v1/me/notification-preferences`
- All five fields submitted on every save (full replacement)

### 9.6 KYC Stub Page

**New file**: `packages/frontend/src/pages/kyc-stub.tsx` (default export)

Minimal placeholder:
- Heading: "IDENTITY VERIFICATION"
- Body: "Identity verification is coming soon. Check back shortly."
- Link: "Return to profile" → `/profile`

Prevents the wildcard route from redirecting `/kyc` to `/`.

---

## 10. Edge Cases

All 18 edge cases from the research document have defined behaviours:

| # | Scenario | Expected Behaviour |
|---|----------|--------------------|
| 1 | `PUT /api/v1/me` with `display_name: "   "` (whitespace-only) | 400 `VALIDATION_ERROR` — Zod `.trim().min(1)` rejects after trim |
| 2 | `PUT /api/v1/me` with `bio` exceeding 500 chars | 400 `VALIDATION_ERROR` — Zod `.max(500)` rejects |
| 3 | Creator selected in onboarding; user clicks "Skip KYC" | Onboarding completes normally; `creator` role IS added to `user_roles`; KYC prompt is informational only |
| 4 | Creator selected; user clicks "Start KYC now" | Navigate to `/kyc`; `/kyc` route renders `KycStubPage` placeholder; no 404 or wildcard redirect |
| 5 | User abandons onboarding at step 2 | `PATCH /api/v1/me/onboarding/step` saved step 2; on next login `OnboardingGuard` redirects to `/onboarding`; wizard initialises to step 2 from `onboardingStep` field in ME response |
| 6 | User already completed onboarding; navigates to `/onboarding` | `OnboardingPage` reads `onboardingCompleted: true`; renders `<Navigate to="/dashboard" replace />` |
| 7 | User already has `creator` role; selects Creator again in onboarding | `ON CONFLICT (user_id, role) DO NOTHING` — idempotent insert; no error, no duplicate row |
| 8 | User already has `creator` role; selects Backer only in onboarding | `POST /api/v1/me/onboarding/complete` with `roles: ['backer']` only adds backer; does NOT remove existing `creator` role; role removal is out of scope |
| 9 | Concurrent `PUT /api/v1/me` requests | Last writer wins; no optimistic locking; `updated_at` records final update time; acceptable for profile fields with no financial implications |
| 10 | `PUT /api/v1/me/notification-preferences` with unknown category key | 400 `VALIDATION_ERROR` — Zod `.strict()` rejects extra keys |
| 11 | `PUT /api/v1/me/notification-preferences` with `security_alerts: false` | 400 `VALIDATION_ERROR` — Zod `.strict()` does not include `security_alerts`; rejected as an unknown key |
| 12 | `notification_preferences` is `{}` in DB (newly created user) | `GET /api/v1/me` merges stored `{}` with `DEFAULT_NOTIFICATION_PREFERENCES` via `resolveNotificationPreferences()`; response always includes all five toggleable keys plus `security_alerts: true` |
| 13 | User navigates to `/dashboard` without completing onboarding | `OnboardingGuard` fetches ME; `onboardingCompleted: false` → `<Navigate to="/onboarding" replace />`; spinner shown while ME query is loading |
| 14 | ME query fails in `OnboardingGuard` | Error state: render `children` (fail open); onboarding redirect is UX guard, not security |
| 15 | `POST /api/v1/me/onboarding/complete` fails (network error) | `onboarding_completed` remains `false` in DB; frontend shows inline error; user can retry; endpoint is idempotent on re-submission |
| 16 | User has no roles in DB | `GET /api/v1/me` returns `roles: []` defensively; `OnboardingGuard` gates only on `onboardingCompleted`, not role presence |
| 17 | `PUT /api/v1/me` with `{ display_name: null }` | Valid — clears `display_name` to NULL in DB; 200 with `displayName: null` in response |
| 18 | `PUT /api/v1/me` with `{ bio: null }` | Valid — clears `bio` to NULL in DB; 200 with `bio: null` in response |

---

## 11. Testing Requirements

### 11.1 Backend Unit Tests

**New file**: `packages/backend/src/account/domain/models/user.test.ts` (or extend existing if present)

Cover:
- `User.reconstitute()` with all new fields (`bio`, `onboardingStep`, `notificationPreferences`)
- `bio: null` and `bio: "string"` both produce correct getter values
- `onboardingStep: null` and `onboardingStep: 2` both produce correct getter values
- `notificationPreferences` getter returns the passed object unchanged

### 11.2 Backend Integration Tests — API Endpoints

**New file**: `packages/backend/src/account/api/me-router.test.ts`

Use `supertest` with the exported `app`. Use mock auth (`MOCK_AUTH=true` or equivalent test setup).

Required test cases:
- `GET /api/v1/me` returns `bio`, `onboardingStep`, `notificationPreferences` including `security_alerts: true`
- `PUT /api/v1/me` with valid `display_name` and `bio` → 200, updated values in response
- `PUT /api/v1/me` with `display_name: "   "` → 400 `VALIDATION_ERROR`
- `PUT /api/v1/me` with `bio` of 501 chars → 400 `VALIDATION_ERROR`
- `PUT /api/v1/me` with `display_name: null` → 200, `displayName: null` in response
- `PUT /api/v1/me/notification-preferences` with all five fields → 200, updated values, `security_alerts: true`
- `PUT /api/v1/me/notification-preferences` missing a required field → 400
- `PUT /api/v1/me/notification-preferences` with `security_alerts: false` → 400
- `PUT /api/v1/me/notification-preferences` with unknown key → 400
- `POST /api/v1/me/onboarding/complete` with `roles: ['backer', 'creator']`, `step: 3` → 200, `onboardingCompleted: true`, roles in response
- `POST /api/v1/me/onboarding/complete` with `roles: []` → 400
- `POST /api/v1/me/onboarding/complete` idempotent on second call → 200 (no error)
- `PATCH /api/v1/me/onboarding/step` with `step: 2` → 204
- `PATCH /api/v1/me/onboarding/step` with `step: 0` → 400
- `PATCH /api/v1/me/onboarding/step` with `step: 4` → 400

### 11.3 Backend Integration Tests — PgUserRepository

**Existing file to extend**: (follow the `TEST_PREFIX` pattern from `patterns.md`)

Required test cases:
- `updateProfile` sets `display_name` and `bio`; `updatedAt` is newer
- `updateProfile` with `null` clears fields
- `updateNotificationPreferences` persists all five keys; GET returns merged with `security_alerts: true`
- `completeOnboarding` sets `onboarding_completed = true`, adds roles idempotently, updates profile in one transaction
- `saveOnboardingStep` updates `onboarding_step` without setting `onboarding_completed`

### 11.4 Frontend Tests

**`onboarding-guard.test.tsx`**:
- Loading state: renders spinner, not children
- Error state: renders children (fail open)
- `onboardingCompleted: false`: renders `<Navigate to="/onboarding" />`
- `onboardingCompleted: true`: renders children

**`onboarding.test.tsx`**:
- Step 1 renders welcome copy and "BEGIN MISSION SETUP" button
- Clicking continue advances to step 2 and fires `PATCH /api/v1/me/onboarding/step`
- Step 2 role selection — selecting Creator shows `KycPromptModal`
- `KycPromptModal` "Skip for now" closes modal without deselecting Creator
- Step 3 submit fires `POST /api/v1/me/onboarding/complete` with collected data
- If `onboardingCompleted: true` on load, renders redirect to `/dashboard`
- Error on final submit shows error message (not redirect)

**`profile.test.tsx`**:
- Loading state renders spinner
- Loaded state renders display name, bio, roles, KYC placeholder, notification prefs
- Security alerts row is non-interactive (no checkbox)
- ProfileEditForm submit fires `PUT /api/v1/me`
- Whitespace-only display name blocked client-side before submit
- NotificationPreferencesForm submit fires `PUT /api/v1/me/notification-preferences` with all five fields

---

## 12. Files Summary

### New Files

| Path | Purpose |
|------|---------|
| `db/migrations/20260306000008_add_onboarding_and_notifications.sql` | Add `onboarding_step`, `notification_preferences` columns |
| `packages/backend/src/account/domain/value-objects/notification-preferences.ts` | `NotificationPreferences` type, defaults, `resolveNotificationPreferences()` |
| `packages/backend/src/account/application/profile-service.ts` | Application service for profile and onboarding mutations |
| `packages/backend/src/account/application/profile-service.test.ts` | Integration tests with mock adapter |
| `packages/backend/src/account/api/me-router.test.ts` | API integration tests for all 5 endpoints |
| `packages/frontend/src/types/user.ts` | `MeData`, `MeResponse`, `NotificationPreferencesResponse` types |
| `packages/frontend/src/hooks/use-current-user.ts` | TanStack Query hook: `GET /api/v1/me` |
| `packages/frontend/src/hooks/use-update-profile.ts` | Mutation hook: `PUT /api/v1/me` |
| `packages/frontend/src/hooks/use-update-notification-preferences.ts` | Mutation hook: `PUT /api/v1/me/notification-preferences` |
| `packages/frontend/src/hooks/use-complete-onboarding.ts` | Mutation hook: `POST /api/v1/me/onboarding/complete` |
| `packages/frontend/src/hooks/use-save-onboarding-step.ts` | Mutation hook: `PATCH /api/v1/me/onboarding/step` |
| `packages/frontend/src/components/layout/onboarding-guard.tsx` | Redirect to `/onboarding` if `onboardingCompleted: false` |
| `packages/frontend/src/pages/onboarding.tsx` | Multi-step onboarding wizard page |
| `packages/frontend/src/pages/profile.tsx` | Profile management page |
| `packages/frontend/src/pages/kyc-stub.tsx` | `/kyc` stub placeholder |
| `packages/frontend/src/components/onboarding/step-welcome.tsx` | Wizard step 1 |
| `packages/frontend/src/components/onboarding/step-role-selection.tsx` | Wizard step 2 |
| `packages/frontend/src/components/onboarding/step-profile-fields.tsx` | Wizard step 3 |
| `packages/frontend/src/components/onboarding/kyc-prompt-modal.tsx` | KYC informational modal on Creator selection |
| `packages/frontend/src/components/profile/profile-edit-form.tsx` | Display name + bio edit form |
| `packages/frontend/src/components/profile/notification-preferences-form.tsx` | Notification preferences toggles |

### Modified Files

| Path | Change |
|------|--------|
| `db/migrations/` | Append-only; do not modify existing migrations |
| `packages/backend/src/account/domain/models/user.ts` | Add `bio`, `onboardingStep`, `notificationPreferences` to `UserData`; add getters to `User` |
| `packages/backend/src/account/ports/user-repository.ts` | Add four new methods |
| `packages/backend/src/account/adapters/pg/pg-user-repository.ts` | Extend `UserRow`; update `toUser`; update all SELECT queries; implement four new methods |
| `packages/backend/src/account/adapters/mock/mock-user-repository.ts` | Update pre-populated test user; implement four new methods |
| `packages/backend/src/account/api/me-router.ts` | Extend GET response; add PUT, PUT notification-preferences, POST onboarding/complete, PATCH onboarding/step handlers |
| `packages/backend/src/account/api/api-router.ts` | Accept `profileService` parameter; pass to `createMeRouter` |
| `packages/backend/src/server.ts` | Construct `ProfileService`; pass to `createApiRouter` |
| `packages/frontend/src/App.tsx` | Add `/onboarding`, `/profile`, `/kyc` routes with correct guard wrapping |

---

## 13. Design Constraints (L2-001 Enforcement)

All new frontend components must comply with the Brand Application Standard:

- **Backgrounds**: `--color-bg-page` for page backgrounds; `--color-bg-surface` for cards and modals
- **Step headings**: `--type-page-title` or `--type-section-heading` using `--font-display` (Bebas Neue, always uppercase)
- **Section labels**: `--type-section-label`, `--color-text-accent`, format "NN — LABEL"
- **Body text**: `--type-body`, `--color-text-secondary`
- **Primary CTA**: `--gradient-action-primary`, `--color-action-primary-text`, `--color-action-primary-shadow`, `--radius-button` — one per viewport
- **Ghost/Back buttons**: `--color-action-ghost-text`, `--color-action-ghost-border`
- **Form inputs**: `--color-bg-input` background, `--color-border-input` default border, `--color-border-emphasis` focus border, `--radius-input`, `--type-input-label` for labels
- **Notification toggles**: `<input type="checkbox">` in semantic `<label>` — no custom div toggles
- **Animations**: `--motion-enter` for step transitions; `--motion-panel` for modal open/close; all must respect `prefers-reduced-motion: reduce`
- **No Tier 1 tokens** in component code — only Tier 2 semantic tokens
- **No forbidden language**: no "Click here", "Investment", passive CTAs; see brand.md Section 4.3

---

## 14. Known Deviations from L4-001

| Deviation | Decision | Rationale |
|-----------|----------|-----------|
| L4-001 Section 2.1 lists notification preferences as part of onboarding | Notification preferences live on profile page only; not an onboarding step | Feature brief (feat-004-account-onboarding.md) is more specific and recent; default values applied on ME read ensure users have sensible prefs without an onboarding step |
