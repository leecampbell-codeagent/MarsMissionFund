# feat-004 Audit Report: Account Onboarding and Profile Management

**Branch**: `ralph/feat-004-account-onboarding`
**Spec**: `/workspace/.claude/prds/feat-004-spec.md`
**Auditor**: Claude Sonnet 4.6
**Date**: 2026-03-06

---

## Overall Verdict: FAIL

Two failures: (1) the Profile page is missing the `KycStatusDisplay` section required by spec Section 9.5, and (2) the corresponding `profile.test.tsx` is missing required test cases for "Security alerts row is non-interactive" and "Whitespace-only display name blocked client-side before submit" (spec Section 11.4). All other checks pass cleanly.

---

## Section Results

### 1. Architecture Compliance — PASS

All hexagonal boundaries are maintained across every examined file.

**Domain layer** (`domain/value-objects/notification-preferences.ts`, `domain/models/user.ts`): Zero infrastructure imports. No `pg`, `express`, `fetch`, `fs`, or `process.env` references. `NotificationPreferences` is a pure interface. `resolveNotificationPreferences` is a pure function. `User` uses private constructor with `reconstitute()` factory. All properties `readonly`.

**Ports** (`ports/user-repository.ts`): Interface only. Four new methods added (`updateProfile`, `updateNotificationPreferences`, `completeOnboarding`, `saveOnboardingStep`) with correct signatures matching the spec.

**Adapters** (`adapters/pg/pg-user-repository.ts`): Only touches infrastructure (`pg`). Imports domain types via the port interface. Uses parameterised queries throughout ($1, $2 placeholders — no string interpolation). `resolveNotificationPreferences` called in `toUser` mapper. `completeOnboarding` runs inside a BEGIN/COMMIT transaction with ROLLBACK on error. `saveOnboardingStep` correctly does not set `onboarding_completed`.

**Mock adapter** (`adapters/mock/mock-user-repository.ts`): Pre-populated test user correctly includes `bio: null`, `onboardingStep: null`, and `notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES`. All four new methods implemented with in-memory state mutation.

**Application service** (`application/profile-service.ts`): Orchestrates via injected `UserRepository` port. No infrastructure imports. Pino logger at module level using `process.env.LOG_LEVEL` (acceptable — this is the service bootstrap layer). Each method logs at `info` level with `userId` and `operation`; no sensitive values logged.

**API layer** (`api/me-router.ts`, `api/api-router.ts`): HTTP concerns only. All five endpoints delegate to `ProfileService`. Zod validation on every request body. `userId` always sourced from `req.auth.userId`, never from request body. `security_alerts: true` appended in `mapUserToResponse` — not read from DB.

**Server wiring** (`server.ts`): `ProfileService` constructed at composition root and passed to `createApiRouter`. Correct.

---

### 2. Test Coverage — PASS (with noted gaps)

**Backend tests**: 57 tests across 5 test files, all passing.

| Suite | Tests |
|-------|-------|
| `auth-sync-service.test.ts` | 8 |
| `shared/middleware/auth.test.ts` | 13 |
| `pg-user-repository.test.ts` | 13 |
| `health-router.test.ts` | 4 |
| `me-router.test.ts` | 19 |
| **Total** | **57** |

`me-router.test.ts` covers all required cases from spec Section 11.2:
- `GET /api/v1/me` returns `bio`, `onboardingStep`, `notificationPreferences` with `security_alerts: true` — COVERED
- `PUT /api/v1/me` valid update — COVERED
- `PUT /api/v1/me` whitespace-only `display_name` → 400 — COVERED
- `PUT /api/v1/me` bio > 500 chars → 400 — COVERED
- `PUT /api/v1/me` with `display_name: null` → 200 — COVERED
- `PUT /api/v1/me/notification-preferences` all five fields → 200 with `security_alerts: true` — COVERED
- `PUT /api/v1/me/notification-preferences` missing field → 400 — COVERED
- `PUT /api/v1/me/notification-preferences` with `security_alerts` → 400 — COVERED
- `PUT /api/v1/me/notification-preferences` unknown key → 400 — COVERED
- `POST /api/v1/me/onboarding/complete` → 200 with `onboardingCompleted: true` and roles — COVERED
- `POST /api/v1/me/onboarding/complete` with `roles: []` → 400 — COVERED
- `POST /api/v1/me/onboarding/complete` idempotent → 200 — COVERED
- `PATCH /api/v1/me/onboarding/step` step 2 → 204 — COVERED
- `PATCH /api/v1/me/onboarding/step` step 0 → 400 — COVERED
- `PATCH /api/v1/me/onboarding/step` step 4 → 400 — COVERED

`pg-user-repository.test.ts` covers all required integration cases from spec Section 11.3: `updateProfile` sets fields and clears with null; `updateNotificationPreferences` persists; `completeOnboarding` transactional and idempotent; `saveOnboardingStep` does not set `onboarding_completed`.

**Frontend tests**: 79 tests across 13 test files, all passing.

| Suite | Tests |
|-------|-------|
| `use-api-client.test.ts` | 6 |
| `onboarding-guard.test.tsx` | 4 |
| `protected-route.test.tsx` | 3 |
| `loading-spinner.test.tsx` | 7 |
| `kyc-stub.test.tsx` | 4 |
| `App.test.tsx` | 2 |
| `kyc-prompt-modal.test.tsx` | 5 |
| `profile-edit-form.test.tsx` | 6 |
| `dashboard.test.tsx` | 7 |
| `notification-preferences-form.test.tsx` | 6 |
| `header.test.tsx` | 5 |
| `profile.test.tsx` | 11 |
| `onboarding.test.tsx` | 13 |
| **Total** | **79** |

`onboarding-guard.test.tsx` covers all four required cases: loading spinner, error fail-open, redirect when `onboardingCompleted: false`, render children when `onboardingCompleted: true`.

`onboarding.test.tsx` (13 tests) covers all seven required cases from spec Section 11.4: step 1 content, continue fires save-step, Creator shows KycPromptModal, skip-for-now closes modal without deselecting, step 3 submit fires complete, redirect when already completed, error on submit shows alert.

`notification-preferences-form.test.tsx` covers "Security Alerts is always checked and disabled" (spec required from profile test context).

**Missing test cases in `profile.test.tsx`** (spec Section 11.4 requires these in profile tests):
- "Security alerts row is non-interactive (no checkbox)" — not present in `profile.test.tsx`. (`notification-preferences-form.test.tsx` covers it at component level, but the spec lists it as a `profile.test.tsx` requirement.)
- "Whitespace-only display name blocked client-side before submit" — not present in `profile.test.tsx`. (`profile-edit-form.test.tsx` does not have this test case either; the form silently drops whitespace-only names instead of showing an error.)

---

### 3. Spec Compliance — FAIL

#### PASS items

**`GET /api/v1/me`** (spec 7.1): Response shape correct. `bio`, `onboardingStep`, `notificationPreferences` added. `security_alerts: true` appended in `mapUserToResponse` via spread — not stored in DB. `resolveNotificationPreferences()` called in `toUser` mapper so defaults are applied on read. PASS.

**`PUT /api/v1/me`** (spec 7.2): Zod schema uses `.trim().min(1)` rejecting whitespace-only display names. `null` clears fields. `bio` max 500. Schema uses `.strict()` — unknown fields rejected with 400. PASS.

**`PUT /api/v1/me/notification-preferences`** (spec 7.3): Schema has all five required keys as `z.boolean()` required fields with `.strict()`. `security_alerts` absent from schema — submitted value rejected as unknown key. PASS.

**`POST /api/v1/me/onboarding/complete`** (spec 7.4): Sets `onboarding_completed = true` in DB. Idempotent. Roles via `ON CONFLICT DO NOTHING`. PASS.

**`PATCH /api/v1/me/onboarding/step`** (spec 7.5): Returns 204, validates step 1–3. Does not set `onboarding_completed`. PASS.

**`security_alerts` computed constant**: Never stored in DB, never in `NotificationPreferences` type, appended only in `mapUserToResponse`. PASS.

**`resolveNotificationPreferences()` on read**: Called in `toUser` in `pg-user-repository.ts`. PASS.

**Migration** (`20260306000008_add_onboarding_and_notifications.sql`): Correct columns, wrapped in `BEGIN/COMMIT`, uses `IF NOT EXISTS`. Matches spec Section 2.1. PASS.

**`OnboardingGuard`**: Calls `useCurrentUser()`. Shows full-screen spinner while loading. Fails open on error (renders children). Redirects to `/onboarding` when `onboardingCompleted === false`. Renders children when `onboardingCompleted === true`. PASS.

**Route wiring in `App.tsx`**: `/onboarding` uses `ProtectedRoute` only (no `OnboardingGuard` — prevents redirect loop). `/profile` and `/kyc` use both `ProtectedRoute` and `OnboardingGuard`. PASS.

**Onboarding page**: Redirects to `/dashboard` if `onboardingCompleted === true`. Initialises wizard step from `onboardingStep` field if non-null. Step labels, headings, and body copy match spec. `KycPromptModal` shown on Creator selection; "Skip for now" closes modal without deselecting Creator role. `saveOnboardingStep` called fire-and-forget on step advance. `completeOnboarding` called on final submit with collected data. Error shown inline on failure. PASS.

**Profile page — header, edit form, notification prefs**: Profile header with avatar, display name fallback to email, role badges, email, account status badge — all present. `ProfileEditForm` with whitespace-only guard and bio char counter. `NotificationPreferencesForm` with five toggles and non-interactive Security Alerts row (`disabled={true}`). PASS.

#### FAIL items

**Profile page — `KycStatusDisplay` missing** (spec Section 9.5): The spec requires a `KycStatusDisplay` section on the profile page: "read-only placeholder — displays 'Identity verification not yet started' with a link to `/kyc`." This section is entirely absent from `/workspace/packages/frontend/src/pages/profile.tsx`. There is no mention of KYC status, `/kyc` link, or identity verification placeholder anywhere in the profile page. The corresponding test case in `profile.test.tsx` is also absent.

**`profile.test.tsx` missing two required test cases** (spec Section 11.4):
1. "Security alerts row is non-interactive (no checkbox)" — listed as a required `profile.test.tsx` test in the spec. It is tested at component level in `notification-preferences-form.test.tsx` but not in the integration context of the profile page test.
2. "Whitespace-only display name blocked client-side before submit" — listed as a required `profile.test.tsx` test in the spec. Not present in either `profile.test.tsx` or `profile-edit-form.test.tsx`.

---

### 4. TODO/FIXME Check — PASS

```
grep -rn "TODO\|FIXME" \
  packages/backend/src/account/application/profile-service.ts \
  packages/backend/src/account/api/me-router.ts \
  packages/frontend/src/pages/onboarding.tsx \
  packages/frontend/src/pages/profile.tsx
```

No matches. Zero TODOs or FIXMEs in any of the four scanned files.

---

### 5. User Stories Check — PARTIAL PASS

Spec Section 8 acceptance criteria verified against implementation:

| User Story | Status |
|-----------|--------|
| First-run wizard shown when `onboardingCompleted: false` | PASS — `OnboardingGuard` redirects |
| Step progress saved on advance | PASS — `saveOnboardingStep` fire-and-forget |
| Creator role triggers KYC prompt (informational) | PASS — `KycPromptModal` shown, role still added |
| Onboarding completion sets flag, adds roles, updates profile | PASS — atomic transaction |
| Already-completed user navigating to `/onboarding` redirected to `/dashboard` | PASS — `OnboardingPage` checks `onboardingCompleted` |
| Profile page shows bio, display name, roles, account status | PASS |
| Profile edit form validates and submits | PASS |
| Notification preferences form submits all five fields; security alerts always on | PASS |
| KYC status placeholder shown on profile page with link to `/kyc` | FAIL — section absent from profile page |
| `/kyc` route renders stub page (no 404) | PASS — `KycStubPage` exists and is wired |

---

## Failures (Must Fix)

### F-001: `KycStatusDisplay` section missing from Profile page

**File**: `/workspace/packages/frontend/src/pages/profile.tsx`

**Spec reference**: Section 9.5

The profile page must include a `KycStatusDisplay` section between `RolesDisplay` (role badges) and `NotificationPreferencesForm`. The spec requires: "read-only placeholder — displays 'Identity verification not yet started' with a link to `/kyc`. KYC domain is feat-005; no real status data in this feature."

The implementation skips from the profile header (which includes role badges) directly to `ProfileEditForm` and then `NotificationPreferencesForm`. No KYC status section exists.

**Fix required**: Add a KYC status section to `profile.tsx` (and a corresponding `KycStatusDisplay` component or inline section) displaying "Identity verification not yet started" with a `<a href="/kyc">` or `<Link to="/kyc">` link.

### F-002: Missing required test cases in `profile.test.tsx`

**File**: `/workspace/packages/frontend/src/pages/profile.test.tsx`

**Spec reference**: Section 11.4

Two test cases required by the spec are absent:

1. "Security alerts row is non-interactive (no checkbox)" — while `notification-preferences-form.test.tsx` covers `disabled={true}` on the Security Alerts input, the spec explicitly lists this as a `profile.test.tsx` requirement to verify the full-page rendering context.

2. "Whitespace-only display name blocked client-side before submit" — the `ProfileEditForm` does silently block submission when `displayName.trim().length === 0 && displayName.length > 0` (lines 21–23 of `profile-edit-form.tsx`), but this logic is untested in either `profile.test.tsx` or `profile-edit-form.test.tsx`. The spec requires this to be an explicit test case.

**Fix required**: Add both test cases to `profile.test.tsx`. The whitespace-only display name test should also be added to `profile-edit-form.test.tsx` to match the spec's intent of preventing silent submission.

---

## Test Count Summary

| Package | Test Files | Tests | Result |
|---------|-----------|-------|--------|
| `packages/backend` | 5 | 57 | All pass |
| `packages/frontend` | 13 | 79 | All pass |
| **Total** | **18** | **136** | **All pass** |

All 136 tests pass. The failures identified are missing implementation (F-001) and missing test coverage (F-002), not failing tests.
