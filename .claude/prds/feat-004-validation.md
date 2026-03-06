# feat-004 Validation Report: Account Onboarding and Profile Management

**Validator**: Spec Validator Agent
**Spec ID**: feat-004-spec
**Validation Date**: 2026-03-06
**Last Updated**: 2026-03-06 (design spec validation pass)
**Verdict**: PASS

---

## Summary

The feat-004 spec is thorough, internally consistent, and correctly grounded in the research document and codebase state. All 18 edge cases from the research document are covered, all five API endpoints are fully specified, and architecture rules are respected throughout. The design spec (`feat-004-design.md`) has now been written and validated — WARN-001 is resolved. Two remaining items carry over: WARN-002 (migration transaction wrapper) and WARN-003 (bio trim behaviour), both of which are minor implementation-time concerns. One new NOTE has been added regarding a design spec decision that supersedes a feature spec implementation detail (KYC prompt rendering model).

---

## Verdict: PASS

No blocking conditions remain. Two WARNs carry over as implementation-time reminders; one new NOTE documents a design decision that overrides a feature spec detail.

1. ~~**WARN-001**: Design spec (`feat-004-design.md`) does not exist yet.~~ **RESOLVED** — design spec written and validated; see Section 1 below.
2. **WARN-002**: Migration file is missing `BEGIN; ... COMMIT;` wrapper around the `-- migrate:up` section (infra rules require it). Implementor must add transaction delimiters.
3. **WARN-003**: `bio` trim behaviour differs between research and spec — resolve before implementation starts (see detail in Section 7).

No FAILs found. The spec is ready for implementation.

---

## 1. Design Spec

| Check | Result | Notes |
|-------|--------|-------|
| `feat-004-design.md` exists | PASS | File is present and covers all required views. WARN-001 resolved. |
| All pages/views have layout specs | PASS | Onboarding wizard (all 3 steps), Profile Page (all 5 sections: header, edit form, roles, KYC status, notification preferences), KYC Stub Page — all specified with precise layout dimensions, token assignments, and content. |
| All component states are defined | PASS | OnboardingGuard: loading/error/false/true. StepRoleSelection: no-roles-selected (CTA disabled), roles-selected, Creator-selected (KYC prompt visible). StepProfileFields: idle/submitting/error. ProfileEditForm: idle/saving/error. NotificationPreferencesForm: idle/saving/error/success. |
| Design tokens — all Tier 2 semantic tokens | PASS | All 47 token entries in the design spec token table are Tier 2 semantic tokens. No Tier 1 identity tokens (`--launchfire`, `--void`, `--ignition`, etc.) appear in the design spec component definitions. The inline `rgba(255,92,26,0.25)` value in the accessibility checklist mirrors the exact notation from L2-001 Section 5.3 and appears as a specification annotation, not a component code reference. |
| Responsive behaviour defined | PASS | Three-breakpoint table: Desktop ≥1024px (side-by-side role cards), Tablet 768–1023px (role cards stack vertically, full-width), Mobile <768px (single column, 16px padding, profile header switches to flex-col, button rows stack). |
| Accessibility checklist complete | PASS | 18-item checklist, all checked. Covers: keyboard navigation, role="checkbox"/aria-checked for multi-select role cards, fieldset/legend wrapping, label/htmlFor pairing, role="switch" for toggles, aria-disabled on security alerts row, aria-label on step indicator, dual visual indicators for selected state, contrast ratios (AAA for primary text), aria-live for loading states, aria-disabled during pending, role="alert" for errors, visible focus rings, aria-hidden for decorative icons, one primary CTA per viewport, prefers-reduced-motion, and avatar alt text. |

---

## 2. Data Model

### 2.1 Migration

| Check | Result | Notes |
|-------|--------|-------|
| Migration file named `20260306000008_add_onboarding_and_notifications.sql` | PASS | Correct timestamp (next after `20260306000007_create_escrow_ledger.sql`), correct filename format. |
| `onboarding_step INT NULL` column added | PASS | Spec Section 2.1 includes `ADD COLUMN IF NOT EXISTS onboarding_step INT NULL DEFAULT NULL`. Semantics correct: NULL = never opened, 1/2/3 = last step. |
| `notification_preferences JSONB NOT NULL DEFAULT '{}'` added | PASS | Spec Section 2.1 includes this column with correct type, NOT NULL constraint, and empty-object default. |
| `bio` not re-added (already exists) | PASS | Research Section 2.2 confirms `bio TEXT NULL` exists in `20260306000001_create_accounts.sql` (verified in codebase). Spec correctly notes no migration needed. |
| No index required for new columns | PASS | Spec correctly notes both columns are only queried for the authenticated user's own row — no index needed. |
| `updated_at` trigger — no change needed | PASS | Existing trigger on `users` fires on any UPDATE; spec confirms no trigger change needed. |
| `-- migrate:up` and `-- migrate:down` sections present | PASS | Both sections present in the SQL snippet. |
| Migration wrapped in `BEGIN; ... COMMIT;` | WARN (WARN-002) | The infra rules (`/workspace/.claude/rules/infra.md`) require `-- migrate:up` to be wrapped in `BEGIN; ... COMMIT;`. The migration SQL in Section 2.1 does not include these transaction delimiters. The `ALTER TABLE` DDL should still be wrapped per the project standard. Implementor must add `BEGIN;` and `COMMIT;` around the ALTER statements. |
| `CREATE TABLE IF NOT EXISTS` pattern | N/A | This is an ALTER, not a CREATE. IF NOT EXISTS used on ADD COLUMN — correct. |
| Append-only (no modification of existing migrations) | PASS | Spec explicitly notes this is a new file; it does not modify existing migrations. |

### 2.2 Notification Preferences Schema

| Check | Result | Notes |
|-------|--------|-------|
| Five toggleable keys defined | PASS | `campaign_updates`, `milestone_completions`, `contribution_confirmations`, `new_recommendations`, `platform_announcements` — all present. |
| `security_alerts` excluded from storage | PASS | Spec Section 2.2 explicitly excludes it: "never read from or written to the database." |
| `security_alerts` always returned as `true` in API | PASS | Noted in Sections 2.2, 7.1, and throughout. |
| Attempting to submit `security_alerts` via API is rejected with 400 | PASS | Section 7.3: Zod `.strict()` rejects it. |
| `resolveNotificationPreferences()` merges stored prefs with defaults | PASS | Value object in Section 2.2 provides `resolveNotificationPreferences(stored)` function with correct spread merge. |
| Domain layer has zero infrastructure imports | PASS | Value object file path is in `domain/value-objects/` — correct layer. No infrastructure code. |

---

## 3. Domain Model Changes

| Check | Result | Notes |
|-------|--------|-------|
| `bio: string \| null` added to `UserData` | PASS | Section 3.1 adds `bio` to the interface. Codebase confirms it's currently missing from `UserData`. |
| `onboardingStep: number \| null` added to `UserData` | PASS | Section 3.1 adds it. Currently absent from codebase `UserData`. |
| `notificationPreferences: NotificationPreferences` added to `UserData` | PASS | Section 3.1 adds it. Currently absent from codebase. |
| All new properties are `readonly` | PASS | All three new properties declared `readonly` in the interface. |
| New getters added to `User` class | PASS | Section 3.2 adds `bio`, `onboardingStep`, `notificationPreferences` getters. |
| Private constructor pattern preserved | PASS | No change to constructor or `reconstitute()` pattern. |
| Domain layer — no infrastructure imports | PASS | Only imports `NotificationPreferences` from sibling value-object file in the domain layer. |

---

## 4. Repository Port

| Check | Result | Notes |
|-------|--------|-------|
| `updateProfile(userId, fields)` added | PASS | Section 4 defines the method. Signature matches research Section 7.3. |
| `updateNotificationPreferences(userId, prefs)` added | PASS | Section 4 defines the method. |
| `completeOnboarding(userId, input)` added | PASS | Section 4 defines the method with correct input shape (`step`, `roles`, `displayName?`, `bio?`). |
| `saveOnboardingStep(userId, step)` added | PASS | Section 4 defines the method, returns `void`. |
| Research named it `updateOnboardingStep` but spec calls it `saveOnboardingStep` | NOTE | Research Section 1.3 listed `updateOnboardingStep`; spec uses `saveOnboardingStep`. This is an acceptable rename — the semantics are clearer. Naming is consistent within the spec. |
| Port methods use only port interfaces (no concrete implementations) | PASS | All parameters and return types are domain types (`User`, `NotificationPreferences`). |
| `addRole` port method from research not included | NOTE | Research Section 1.3 listed `addRole` as a separate method. The spec absorbed it into `completeOnboarding` atomically. This is the correct design decision per research Section 4.6 rationale. |

---

## 5. PgUserRepository Changes

| Check | Result | Notes |
|-------|--------|-------|
| `UserRow` extended with `bio`, `onboarding_step`, `notification_preferences` | PASS | Section 5.1 adds all three new columns to `UserRow`. |
| `toUser` mapper updated to pass new fields | PASS | Section 5.2 specifies updating the mapper with `bio`, `onboardingStep`, and resolved `notificationPreferences`. |
| Existing SELECT queries updated to include new columns | PASS | Section 5.2 specifies updating all existing queries (`findByClerkId`, `findById`, `upsertWithBackerRole`). |
| `updateProfile` handles `undefined` vs `null` distinction | PASS | Section 5.3 clearly documents two-query pattern: COALESCE for undefined (skip column), direct set for null (explicit clear). This is the correct interpretation. |
| `updateNotificationPreferences` uses parameterised query | PASS | Section 5.4 shows `$2` for the prefs object — pg driver handles serialisation. |
| `completeOnboarding` uses a single database transaction | PASS | Section 5.5 specifies explicit BEGIN/COMMIT/ROLLBACK transaction wrapping. |
| Role inserts use `ON CONFLICT (user_id, role) DO NOTHING` | PASS | Section 5.5 step 1 uses the idempotent insert pattern. Consistent with `user_roles` UNIQUE constraint verified in codebase. |
| `saveOnboardingStep` does NOT set `onboarding_completed` | PASS | Section 5.6 is explicit: "Does NOT set `onboarding_completed`." |
| Raw SQL only, no ORM | PASS | All queries shown as raw SQL parameterised strings. |
| All queries scoped to `user_id` | PASS | All UPDATE/SELECT statements include `WHERE id = $1` (user's own row). |

---

## 6. Application Service

| Check | Result | Notes |
|-------|--------|-------|
| `ProfileService` is a new file in `application/` layer | PASS | File path `packages/backend/src/account/application/profile-service.ts`. Correct layer. |
| Constructor takes `UserRepository` (port interface, not concrete) | PASS | `constructor(private readonly userRepo: UserRepository)` — depends on abstraction. |
| All four methods present | PASS | `updateProfile`, `updateNotificationPreferences`, `completeOnboarding`, `saveOnboardingStep` all specified. |
| No infrastructure imports in application service | PASS | Section 6 Rules state "No business logic beyond input forwarding — validation happens at the API layer." No pg, express, or other infrastructure imports in the service spec. |
| `userId` always from `req.auth.userId`, never request body | PASS | Section 6 explicitly states this. |
| Pino logging specified — no `console.log` | PASS | Section 6 specifies `info` level logging; explicitly excludes `displayName`, `bio`, preference values from logs. |

---

## 7. API Contracts

### All 5 Endpoints

| Check | Result | Notes |
|-------|--------|-------|
| `GET /api/v1/me` extended with new fields | PASS | Section 7.1 shows complete response shape including `bio`, `onboardingStep`, `notificationPreferences` (with `security_alerts: true`). |
| `PUT /api/v1/me` defined with request/response shapes | PASS | Section 7.2 provides Zod schema, success and error responses. |
| `PUT /api/v1/me/notification-preferences` defined | PASS | Section 7.3 provides strict Zod schema and error responses. |
| `POST /api/v1/me/onboarding/complete` defined | PASS | Section 7.4 provides schema with roles array validation, idempotency behaviour. |
| `PATCH /api/v1/me/onboarding/step` defined | PASS | Section 7.5 provides schema; returns 204 (no body). |
| All endpoints require Clerk JWT auth | PASS | Section 7 preamble states this. Existing middleware is referenced. |
| `user_id` never from request body | PASS | Consistently stated across all endpoint definitions. |
| Zod validation on every endpoint | PASS | All five endpoints have Zod schemas specified. |
| Error format `{ error: { code, message } }` | PASS | Error responses follow the standard format in all endpoints. |
| HTTP status codes — 200, 201, 204, 400, 401, 403, 404, 409, 500 | PASS | Codes used: 200 (most), 204 (PATCH step), 400, 401, 404 — all within the allowed set. |

### Specific Checks

| Check | Result | Notes |
|-------|--------|-------|
| `PUT /api/v1/me` handles `undefined` vs `null` correctly | PASS | Section 7.2 and Section 5.3 together define the expected behaviour: `undefined` = skip update, `null` = explicit clear. The Zod schema uses `.nullable().optional()` which allows both. |
| Whitespace-only `display_name` rejected with 400 | PASS | Zod schema uses `.trim().min(1)` — trim first, then min(1) catches whitespace-only strings. |
| `bio` has no server-side trim | NOTE | Section 7.2 spec says "no trim applied server-side (preserve intentional whitespace)". However, the research document's Zod schema (Section 4.2) included `.trim()` on `bio`. The spec's decision to remove trim on `bio` is a valid product decision (preserve whitespace), but implementors should be aware of this intentional deviation from research. WARN-003: clarify definitively before implementation. |
| `security_alerts` rejected if submitted | PASS | Section 7.3 Zod `.strict()` excludes `security_alerts` — rejected as unknown key. |
| `POST /api/v1/me/onboarding/complete` is idempotent | PASS | Section 7.4 explicitly states: "If `onboarding_completed` is already true: re-runs the update and returns 200 (no error, no state regression)." |
| `PATCH /api/v1/me/onboarding/step` returns 204 | PASS | Section 7.5 specifies 204 with no response body. |
| Router wiring to `server.ts` specified | PASS | Section 7.6 specifies `createApiRouter` signature change and `server.ts` construction of `ProfileService`. |

---

## 8. Edge Cases — All 18 Covered

Cross-referencing the 18 edge cases from `feat-004-research.md` Section 8 against the spec's Section 10 table:

| # | Research Edge Case | Covered in Spec | Notes |
|---|--------------------|-----------------|-------|
| 1 | Whitespace-only `display_name` → 400 | PASS | Row 1: Zod `.trim().min(1)` |
| 2 | `bio` > 500 chars → 400 | PASS | Row 2: Zod `.max(500)` |
| 3 | Creator selected, user skips KYC | PASS | Row 3: role IS added, prompt informational only |
| 4 | Creator selected, user clicks "Start KYC now" | PASS | Row 4: navigates to `/kyc`, stub page prevents 404/wildcard redirect |
| 5 | User abandons onboarding at step 2 | PASS | Row 5: step persisted via PATCH; wizard resumes on next login |
| 6 | User already completed onboarding; navigates to `/onboarding` | PASS | Row 6: `OnboardingPage` renders `<Navigate to="/dashboard" replace />` |
| 7 | User already has `creator` role; selects Creator again | PASS | Row 7: `ON CONFLICT DO NOTHING` — idempotent |
| 8 | User has `creator` role; selects Backer only | PASS | Row 8: existing `creator` role NOT removed — role removal out of scope |
| 9 | Concurrent `PUT /api/v1/me` requests | PASS | Row 9: last writer wins; no optimistic locking needed for profile fields |
| 10 | Unknown key in notification-preferences PUT | PASS | Row 10: Zod `.strict()` rejects extra keys |
| 11 | `security_alerts: false` in notification-preferences PUT | PASS | Row 11: rejected as unknown key by Zod `.strict()` |
| 12 | `notification_preferences` is `{}` (new user) | PASS | Row 12: `resolveNotificationPreferences()` merges with defaults on read |
| 13 | User navigates to `/dashboard` without completing onboarding | PASS | Row 13: `OnboardingGuard` redirects; spinner during ME query load |
| 14 | ME query fails in `OnboardingGuard` | PASS | Row 14: fail open — render children on error |
| 15 | `POST /api/v1/me/onboarding/complete` fails (network error) | PASS | Row 15: `onboarding_completed` remains false; user can retry; endpoint is idempotent |
| 16 | User with no roles in DB | PASS | Row 16: `roles: []` returned defensively; `OnboardingGuard` gates on `onboardingCompleted` only |
| 17 | `PUT /api/v1/me` with `{ display_name: null }` | PASS | Row 17: valid — clears field to NULL |
| 18 | `PUT /api/v1/me` with `{ bio: null }` | PASS | Row 18: valid — clears field to NULL |

All 18 edge cases are addressed.

---

## 9. Testing Requirements

| Check | Result | Notes |
|-------|--------|-------|
| Domain unit tests for new `User` fields | PASS | Section 11.1 specifies test cases for `bio`, `onboardingStep`, `notificationPreferences` getters and reconstitute. |
| API integration tests for all 5 endpoints | PASS | Section 11.2 specifies 15 test cases covering happy paths and key error paths for all 5 endpoints. |
| PgUserRepository integration tests for all 4 new methods | PASS | Section 11.3 specifies test cases for `updateProfile`, `updateNotificationPreferences`, `completeOnboarding`, `saveOnboardingStep`. |
| Auth middleware integration tests | NOTE | Spec does not explicitly specify "auth middleware integration tests" as a standalone requirement — however, the API tests in Section 11.2 use mock auth (`MOCK_AUTH=true`), implying 401 paths are tested at the API level. Explicit 401 test cases are not listed in Section 11.2. Minor gap — implementors should add at least one 401 test per endpoint. |
| Frontend component tests | PASS | Section 11.4 specifies test files and cases for `OnboardingGuard`, `OnboardingPage`, `ProfilePage` including loading/error/loaded states. |
| `onboarding.test.tsx` covers KYC modal and step persistence | PASS | Section 11.4 includes these specific cases. |
| `profile.test.tsx` covers Security Alerts non-interactive row | PASS | Section 11.4 includes: "Security alerts row is non-interactive (no checkbox)." |
| Realistic test data (no round numbers) | NOTE | Spec does not contain monetary values — not applicable. No round number concerns for this feature. |

---

## 10. Scope Compliance

| Check | Result | Notes |
|-------|--------|-------|
| Avatar upload excluded | PASS | Section 1 (Out of scope) and Section 9.4 (Step 3) explicitly exclude avatar upload. Step 3 only displays avatar from Clerk `useUser().user.imageUrl` or placeholder. |
| Email change excluded | PASS | Listed in out-of-scope (Section 1). |
| Account deactivation excluded | PASS | Listed in out-of-scope. |
| GDPR erasure excluded | PASS | Listed in out-of-scope. |
| Session management UI excluded | PASS | Listed in out-of-scope. |
| KYC stub page included (prevents wildcard 404) | PASS | Section 9.6 specifies the minimal `kyc-stub.tsx` page. Correctly identified in edge case #4. |
| feat-005 KYC domain not leaked into this spec | PASS | Section 9.5 `KycStatusDisplay` is a read-only placeholder. No real KYC status data or domain logic included. |
| MockUserRepository updated | PASS | Section 8 specifies updating the mock with new methods and pre-populated test user fields. |

---

## 11. Architecture Compliance (L2-002 / Hexagonal)

| Check | Result | Notes |
|-------|--------|-------|
| Domain layer: zero infrastructure imports | PASS | `NotificationPreferences` value object is pure TypeScript — no pg, express, fetch, or fs imports. |
| Ports: interfaces only | PASS | `UserRepository` interface has no implementations. |
| Adapters: only place touching infrastructure | PASS | `PgUserRepository` is correctly specified as the infrastructure adapter. |
| Application service: orchestrates via injected ports | PASS | `ProfileService` takes `UserRepository` in constructor, delegates to it. |
| Controllers: HTTP concerns only | PASS | `me-router.ts` is specified to handle HTTP request/response and delegate to `ProfileService`. |

---

## 12. Frontend Architecture Compliance (L3-005)

| Check | Result | Notes |
|-------|--------|-------|
| React 19.x, functional components only | PASS | All components specified as functional with TypeScript interfaces. |
| All props `readonly` | PASS | `OnboardingGuardProps` specified as `readonly children: React.ReactNode`. Pattern expected to continue for all new components. |
| TanStack Query for server state | PASS | All data fetching via `useCurrentUser()` and mutation hooks. |
| Native fetch via API client | PASS | Hooks call `apiClient.get/post/put/patch` — no Axios. |
| Named exports (except page-level default exports) | PASS | Section 9 specifies default exports for pages, named exports implied for components. |
| No `any` types | NOTE | Not explicitly asserted in spec, but TypeScript strict mode is the project standard. Implementors must ensure no `any` in new files. |
| All states handled (default, empty, loading, error) | PASS | Section 9.5 (Profile Page) and 9.4 (Onboarding Page) specify loading spinner, error, and loaded states. `OnboardingGuard` specifies loading (spinner) and error (fail open) states. |
| Semantic HTML for toggles | PASS | Section 9.5 and Section 13 explicitly require `<input type="checkbox">` in semantic `<label>` — not custom divs. |
| One primary CTA per viewport | PASS | Section 9.4 specifies Back button as ghost variant; "COMPLETE SETUP" is the single primary CTA. Section 13 reinforces this rule. |

---

## 13. Design System Compliance (L2-001)

| Check | Result | Notes |
|-------|--------|-------|
| Tier 2 semantic tokens only in component code | PASS | Section 13 lists only semantic tokens (`--color-bg-page`, `--gradient-action-primary`, `--radius-button`, etc.) — no Tier 1 identity tokens. |
| `--font-display` (Bebas Neue) uppercase only | PASS | Section 9.4 specifies headings using `--type-page-title` which maps to `--font-display` (uppercase). |
| Dark-first UI — `--color-bg-page` primary background | PASS | Explicitly listed in Section 13. |
| `--gradient-action-primary` for primary CTA | PASS | Specified for "Continue", "Complete Setup" buttons. |
| `--motion-enter` for step transitions | PASS | Section 9.4 specifies this. |
| `--motion-panel` for modal open/close | PASS | Section 9.4 (`KycPromptModal`) specifies this. |
| `prefers-reduced-motion` respected | PASS | Section 9.4 explicitly notes animations must respect this. Section 13 reinforces. |
| `--radius-card-large` for modal | PASS | Section 9.4 (`KycPromptModal`) specifies this. |
| `--color-bg-overlay` for modal overlay | PASS | Section 9.4 (`KycPromptModal`) specifies this. |
| No forbidden language | PASS | Copy review: "BEGIN MISSION SETUP", "COMPLETE SETUP", "HOW WILL YOU CONTRIBUTE?" — active voice, mission framing, no forbidden patterns. No "Click here", no "Investment", no passive CTAs. |
| Section label format "NN — LABEL" | PASS | "01 — WELCOME", "02 — YOUR ROLE", "03 — YOUR PROFILE" — correct format. |

---

## 14. Financial Rules

| Check | Result | Notes |
|-------|--------|-------|
| No monetary values in this feature | PASS | Spec correctly notes in Section 9.3: "Monetary amounts rule applies: no monetary values on this page." No cents/dollar handling required. |
| No BIGINT/string monetary handling needed | PASS | Confirmed — not applicable. |

---

## 15. Deviation from L4-001

| Check | Result | Notes |
|-------|--------|-------|
| Deviation documented | PASS | Section 14 documents the deviation: notification preferences not collected during onboarding (contra L4-001 Section 2.1). |
| Rationale provided | PASS | Brief is more specific and recent; default values applied on ME read. Reasonable for demo scope. |

---

## Issues Summary

### FAILs (blocking)
None.

### WARNs (must address before or during implementation)

| ID | Severity | Location | Issue |
|----|----------|----------|-------|
| ~~WARN-001~~ | ~~WARN~~ | ~~`feat-004-design.md`~~ | ~~Design spec does not exist yet. Frontend implementation must await it.~~ **RESOLVED** — design spec validated. |
| WARN-002 | WARN | Section 2.1 (Migration) | Migration `-- migrate:up` block is not wrapped in `BEGIN; ... COMMIT;` as required by infra rules. Implementor must add transaction delimiters. |
| WARN-003 | WARN | Section 7.2 vs Research 4.2 | Research Zod schema for `bio` included `.trim()`; spec explicitly removes it (intentional to preserve whitespace). This is a valid product decision but should be confirmed before implementation to avoid a back-and-forth if the original intent was to trim bio. |

### Notes (informational, no action required)

| ID | Location | Note |
|----|----------|------|
| NOTE-1 | Section 4 | Method renamed from `updateOnboardingStep` (research) to `saveOnboardingStep` (spec). Clearer semantics — no action needed. |
| NOTE-2 | Section 4 | `addRole` port method from research absorbed into `completeOnboarding` transaction. Correct design. |
| NOTE-3 | Section 11.2 | No explicit 401 test cases listed for the new endpoints. Implementors should add at least one 401 path test per new endpoint. |
| NOTE-4 | General | TypeScript strict mode / no `any` types not explicitly re-stated in spec. Project standard applies — implementors must comply. |
| NOTE-5 | Design spec vs. feat-004-spec.md Section 9.4 | The feature spec describes `KycPromptModal` with "Modal overlay: `--color-bg-overlay`, `--motion-panel` transition, `--radius-card-large`", implying a full overlay modal. The design spec explicitly overrides this: the KYC prompt is an **inline panel** below the role cards, not an overlay modal. `--color-bg-overlay`, `--motion-panel`, and `--radius-card-large` are all explicitly marked "Not used in this feature" in the design spec token table. The design spec's decision is correct (inline is simpler and avoids focus-trap complexity at this scope), and it has authority over visual implementation detail. Implementors must follow the design spec for the KYC prompt rendering model — not the feature spec's modal framing. |

---

## Codebase Delta Confirmation

The spec correctly identifies the current codebase state:

- `UserData` in `/workspace/packages/backend/src/account/domain/models/user.ts`: currently missing `bio`, `onboardingStep`, `notificationPreferences` — confirmed by reading the file.
- `UserRepository` port: currently has only `findByClerkId`, `upsertWithBackerRole`, `findById` — confirmed.
- `PgUserRepository.UserRow`: currently missing `bio`, `onboarding_step`, `notification_preferences` columns — confirmed.
- `me-router.ts`: currently only has `GET /` handler, missing `bio`/`onboardingStep`/`notificationPreferences` in response — confirmed.
- `bio TEXT NULL` already exists in `20260306000001_create_accounts.sql` — confirmed.
- `UNIQUE (user_id, role)` constraint on `user_roles` supports `ON CONFLICT DO NOTHING` — confirmed in `20260306000002_create_roles.sql`.
- Last migration is `20260306000007_create_escrow_ledger.sql` — confirmed; `20260306000008` is the correct next timestamp.
