# feat-004 Exploratory Verification Report

> Note: Docker not available — this is a code-review-based verification. Browser-based E2E testing was not possible in this environment.

**Feature:** feat-004 — Account Registration & Onboarding
**Date:** 2026-03-05
**Reviewer:** Playwright Tester (code-review mode)

---

## Summary

**Overall Result: PASS**

All 8 user stories are structurally implemented. The implementation is faithful to the spec. Two minor observations are noted (not blocking) concerning a validation discrepancy and the onboarding guard mechanism.

---

## US-001: Onboarding Welcome

**Status: PASS**

**Component:** `/workspace/packages/frontend/src/components/onboarding/welcome-step.tsx`

- File exists. ✓
- Renders "WELCOME TO THE MISSION" heading and a brand-appropriate body copy describing Mars Mission Fund. ✓
- Primary CTA button "Begin Setup" is rendered as a `<button type="button">` with `--gradient-action-primary` background and box-shadow from `--color-action-primary-shadow`. ✓
- Loading and error states are handled (`isLoading` / `error` props). ✓

**Onboarding page integration:** `/workspace/packages/frontend/src/pages/onboarding.tsx`

- `WelcomeStep` renders when `localStep === 'welcome'`. ✓
- `handleWelcomeContinue()` calls `advanceOnboarding.mutateAsync({ step: 'role_selection' })` which PATCHes `/api/v1/accounts/me/onboarding`. ✓
- On success, `setLocalStep('role_selection')` is called, advancing the wizard. ✓

---

## US-002: Role Selection

**Status: PASS**

**Component:** `/workspace/packages/frontend/src/components/onboarding/role-selection-step.tsx`

- File exists. ✓
- Three role options are displayed as clickable cards (`<div role="radio">` within `<div role="radiogroup">`), not native radio buttons. ✓
  - "Backer" (default pre-selected in parent via `useState<WizardRole>('backer')`)
  - "Creator"
  - "Both"
- KYC callout renders conditionally when `selectedRole === 'creator' || selectedRole === 'both'`, informing users that creator accounts require identity verification. ✓
- "Back" button navigates client-side to `'welcome'` without server regression. ✓

**Role mapping logic in `onboarding.tsx`:**

- `wizardRoleToAccountRoles`: "Creator" → `['backer', 'creator']`, "Both" → `['backer', 'creator']`, "Backer" → `['backer']`. This matches the spec requirement that creator is additive to backer. ✓
- On continue, calls `advanceOnboarding.mutateAsync({ step: 'profile', roles })` which sends roles via PATCH. ✓
- Step advances to `'profile'` after confirmation. ✓

---

## US-003: Profile Setup

**Status: PASS (with minor observation)**

**Component:** `/workspace/packages/frontend/src/components/onboarding/profile-step.tsx`

- File exists. ✓
- Form fields present: display name (text input), bio (textarea), avatar URL (url input). ✓
- Subheading reads "All fields are optional." ✓
- "Skip" button present (calls `onSkip`, which advances to `preferences` without saving profile data). ✓
- "Back" button present (client-side navigation to `'role_selection'`). ✓
- Bio has character counter (warns at 450, errors at 500). ✓
- Avatar URL validation checks for `https://` prefix. ✓

**Validation in `onboarding.tsx` `validateProfile()`:**

- Whitespace-only `displayName` is rejected with error "Display name cannot be blank." ✓
- `displayName` > 100 characters is rejected. ✓
- `avatarUrl` not starting with `https://` is rejected. ✓

**Minor Observation (non-blocking):**
The spec states: "display name must be 1-100 characters after trimming, or empty (skipped)." The task description summary says "display_name is required," but the spec AC is clear: it is optional. The implementation correctly treats it as optional (all fields are optional), which aligns with the actual AC text. No discrepancy.

**Profile persisted when `Continue` is clicked:** Only saves if any field is filled (`displayName.trim() || bio.trim() || avatarUrl.trim()`). ✓

---

## US-004: Notification Preferences

**Status: PASS**

**Component:** `/workspace/packages/frontend/src/components/onboarding/preferences-step.tsx`

- File exists. ✓
- Uses `ToggleSwitch` component (`/workspace/packages/frontend/src/components/ui/toggle-switch.tsx`) for each row — not native checkboxes. ✓
- All 6 notification categories present with correct defaults from `DEFAULT_NOTIFICATION_PREFERENCES`:
  - campaign_updates: ON ✓
  - milestone_completions: ON ✓
  - contribution_confirmations: ON ✓
  - new_campaign_recommendations: ON ✓
  - platform_announcements: OFF ✓
  - security_alerts: ON, `locked: true` ✓
- Security alerts toggle has `disabled={row.locked}` and the `onChange` guard `!row.locked && onPreferenceChange(...)` prevents it from firing. ✓
- Lock icon (SVG padlock) is shown inline on the security alerts label. ✓
- Description text for security_alerts is "Security alerts cannot be disabled." satisfying the spec's tooltip/helper text requirement. ✓
- Changes reflected in local state only until "Complete Setup" is clicked. ✓
- On complete: calls `updatePreferences.mutateAsync(preferences)` (PATCH `/api/v1/accounts/me/preferences`) then `advanceOnboarding.mutateAsync({ step: 'completed' })` (sets `onboarding_completed = true`). ✓
- "Skip" button: calls `advanceOnboarding.mutateAsync({ step: 'completed' })` without saving preferences (DB defaults are retained). ✓

---

## US-005: Onboarding Completion

**Status: PASS**

**Component:** `/workspace/packages/frontend/src/components/onboarding/completion-step.tsx`

- File exists. ✓
- Celebration UI uses `--gradient-celebration` CSS custom property as a `::before` pseudo-element overlay (opacity 0.3). ✓
- Personalised greeting: `displayName ? "Welcome aboard, ${displayName}" : "Welcome aboard, Mission Operative"` — uses display name if set, fallback otherwise. ✓
- Primary CTA "Go to Dashboard" present. ✓
- CTA calls `onGoToDashboard` → `navigate('/dashboard')` in `onboarding.tsx`. ✓

**Already-completed redirect:** In `onboarding.tsx`, the `useEffect` detects `account.onboarding_completed === true` and calls `navigate('/dashboard', { replace: true })`. So navigating to `/onboarding` when already completed redirects to `/dashboard`. ✓

---

## US-006: Resume Onboarding

**Status: PASS**

The spec title is "Resume Onboarding" (not "Onboarding Guard"). The ACs focus on step resumption rather than a dedicated guard component.

**Implementation in `onboarding.tsx`:**

- `localStep` is initialised from `account.onboarding_step` on first account load: `if (localStep === null) { setLocalStep(account.onboarding_step); }`. ✓
- If a user with `onboarding_step = 'profile'` navigates to `/onboarding`, the wizard will render the profile step. ✓
- If the browser is refreshed, `localStep` resets to `null`, and the `useEffect` re-initialises from the server-persisted `onboarding_step`. ✓

**Guard mechanism for protected routes:**

- `/dashboard` is wrapped in `<ProtectedRoute>` which blocks unauthenticated access. ✓
- `dashboard.tsx` additionally calls `GET /api/v1/auth/me` and redirects to `/onboarding` if `onboarding_completed = false`. This implements the forward-redirect guard. ✓

**Note:** The dashboard guard queries `/api/v1/auth/me` (not `/api/v1/accounts/me`). This is a separate auth endpoint — the response shape `{ id, onboarding_completed }` is a subset of the full account. This works for the guard purpose but is a different endpoint than the full account API. This is consistent with the existing codebase structure and not a spec violation.

---

## US-007: Profile Settings Page (Post-Onboarding)

**Status: PASS**

**Component:** `/workspace/packages/frontend/src/pages/settings-profile.tsx`

- File exists. ✓
- Route `/settings/profile` is registered in `App.tsx` under `<ProtectedRoute>`. ✓
- Pre-populates form from account data via `useEffect` when `account` data loads: sets `displayName`, `bio`, `avatarUrl` from `account.display_name`, `account.bio`, `account.avatar_url`. ✓
- Email is shown as read-only. ✓
- On submit, calls `updateProfile.mutateAsync(...)` → PATCH `/api/v1/accounts/me`. ✓
- Success confirmation message "Profile updated successfully." shown for 5 seconds. ✓
- Error message shown on failure. ✓
- Save button disabled when no changes detected (`hasChanges` comparison). ✓

---

## US-008: Notification Preferences Settings Page (Post-Onboarding)

**Status: PASS**

**Component:** `/workspace/packages/frontend/src/pages/settings-preferences.tsx`

- File exists. ✓
- Route `/settings/preferences` registered in `App.tsx` under `<ProtectedRoute>`. ✓
- Pre-populates from `account.notification_preferences` via `useEffect`. ✓
- All 6 preference categories shown with `ToggleSwitch` components (not checkboxes). ✓
- Security alerts locked (`disabled={row.locked}`, toggle guard). ✓
- On save, calls `updatePreferences.mutateAsync(preferences)` → PATCH `/api/v1/accounts/me/preferences`. ✓
- Success confirmation and error handling present. ✓
- Save button disabled when no changes detected (`hasChanges` comparison using `JSON.stringify`). ✓

---

## Backend API Verification

**Router:** `/workspace/packages/backend/src/account/api/account-router.ts`

All 4 required endpoints are implemented:

| Endpoint | Method | Status |
|----------|--------|--------|
| `GET /api/v1/accounts/me` | Retrieve account | PASS ✓ |
| `PATCH /api/v1/accounts/me` | Update profile | PASS ✓ |
| `PATCH /api/v1/accounts/me/preferences` | Update preferences | PASS ✓ |
| `PATCH /api/v1/accounts/me/onboarding` | Advance onboarding step | PASS ✓ |

**Zod Validation:**
- `updateProfileSchema`: validates `display_name` (min 1, max 100), `bio` (max 500), `avatar_url` (url + starts with `https://`). All `nullish()`. `.strict()`. ✓
- `updatePreferencesSchema`: validates all 6 boolean fields. `.strict()`. ✓
- `advanceOnboardingSchema`: validates `step` (enum, excludes `'welcome'`), optional `roles` (min 1). `.strict()`. ✓

**Auth middleware:**
- All 4 handlers check `req.authContext?.userId`. If absent, return 401 with `UNAUTHENTICATED`. ✓
- `user_id` sourced from `req.authContext` — never from request body. ✓

**Response for `GET /api/v1/accounts/me`:**
`formatAccount()` returns: `id`, `email`, `display_name`, `bio`, `avatar_url`, `status`, `roles`, `onboarding_completed`, `onboarding_step`, `notification_preferences`. All fields specified in US-008 are present. ✓

---

## Domain Layer Verification

**Entity:** `/workspace/packages/backend/src/account/domain/account.ts`

- Private constructor + `create()` + `reconstitute()` pattern. ✓
- All props `readonly`. ✓
- `withProfile()`: validates display name (whitespace-only rejected, 1-100 chars), bio (0-500), avatar URL (`https://`). Throws `InvalidAccountDataError`. ✓
- `withRoles()`: validates non-empty, all valid roles, `backer` always present. ✓
- `withOnboardingStep()`: forward-only progression enforced. `completed` step sets `onboardingCompleted = true`. Throws `InvalidOnboardingStepError`. ✓
- `withNotificationPreferences()`: forces `security_alerts: true` regardless of input. ✓
- `withDisplayNameFromWebhook()`: only sets if current `displayName` is null. ✓

---

## Migration Verification

**File:** `/workspace/db/migrations/20260305000001_add_onboarding_fields.sql`

- File exists with correct dbmate timestamp naming. ✓
- `-- migrate:up` and `-- migrate:down` sections present. ✓
- Wrapped in `BEGIN; ... COMMIT;`. ✓
- Adds: `bio TEXT`, `avatar_url TEXT`, `onboarding_step TEXT NOT NULL DEFAULT 'welcome'`, `notification_preferences JSONB NOT NULL DEFAULT {...}`. ✓
- CHECK constraint on `onboarding_step` for the 5 valid values. ✓
- Down migration drops all added columns and constraint. ✓

---

## Observations (Non-Blocking)

1. **Tooltip vs. helper text for security_alerts:** The spec says "a tooltip or helper text: 'Security alerts cannot be disabled.'" The implementation uses the `description` field in the preference row (displayed as paragraph text below the label), not a tooltip. This satisfies the spirit of the AC — the message is visible and contextually placed.

2. **Profile step validation — display name minimum length:** The `onboarding.tsx` validator rejects whitespace-only strings but uses the check `displayName.trim().length === 0` when `displayName` is non-empty. An entry of a single space would be caught. The domain entity also enforces this on the server. Consistent.

3. **Dashboard guard uses `/api/v1/auth/me`:** The guard in `dashboard.tsx` calls `/api/v1/auth/me` rather than `/api/v1/accounts/me`. This is the existing auth endpoint that returns `{ id, onboarding_completed }`. It serves the guard function correctly. The spec describes the guard behaviorally; it does not mandate which endpoint the guard uses.

---

## Final Verdict

**PASS**

All acceptance criteria for US-001 through US-008 are structurally implemented. The frontend wizard components exist and are correctly wired. The backend router exposes all 4 required endpoints with auth guards, Zod validation, and correct response shapes. The domain entity enforces all business rules including security_alerts lockout and forward-only onboarding progression. The database migration matches the spec. No blocking discrepancies found.
