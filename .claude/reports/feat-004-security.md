# Security Review: feat-004 — Account Onboarding and Profile Management

**Reviewer:** Security Reviewer Agent
**Date:** 2026-03-06
**Branch diff base:** `ralph/feat-003-authentication...ralph/feat-004-account-onboarding`

---

## Overall Verdict: CONDITIONAL PASS

No CRITICAL findings. Two HIGH findings require remediation before merge. The remaining findings are MEDIUM or LOW and are documented for the team's awareness.

---

## Findings Table

| ID | Severity | Description | File:Line | Recommendation |
|----|----------|-------------|-----------|----------------|
| SEC-004-01 | HIGH | Role allowlist not enforced at DB layer — arbitrary roles can be inserted | `pg-user-repository.ts:207-215` | See detail below |
| SEC-004-02 | HIGH | `onboarding_step` column has no DB-level CHECK constraint; out-of-range values (e.g. negative integers, very large numbers) can be stored if application validation is bypassed | `20260306000008_...sql:4`, `pg-user-repository.ts:251-255` | See detail below |
| SEC-004-03 | MEDIUM | `clerkUserId` is returned in the API response — this is an internal identity provider reference and need not be exposed to frontend callers | `me-router.ts:45` | Remove `clerkUserId` from `mapUserToResponse`; it serves no frontend purpose and unnecessarily expands the attack surface |
| SEC-004-04 | MEDIUM | `OnboardingGuard` fails open — on API error it renders children (the protected page) instead of blocking access | `onboarding-guard.tsx:28-30` | On `isError`, redirect to `/onboarding` or display an error state rather than silently allowing access |
| SEC-004-05 | MEDIUM | `onboarding_step` column lacks a DB-level index; though a minor schema hygiene issue, `saveOnboardingStep` does not check whether the step value decrements (step 3 → step 1 re-opens a completed flow) | `pg-user-repository.ts:251-255` | Consider a CHECK in the migration; guard `saveOnboardingStep` against step regression for already-completed accounts |
| SEC-004-06 | MEDIUM | `avatarUrl` is sourced from the database and returned to frontend without validation; a URL stored earlier via a different pathway could be an `http://` URL or `javascript:` URI rendered in an `<img src>` | `me-router.ts:50`, `profile.tsx:115`, `onboarding.tsx:416` | Validate/sanitise `avatarUrl` server-side before storing and before returning; enforce `https://` scheme at the DB write point |
| SEC-004-07 | LOW | Frontend `use-complete-onboarding.ts` types `roles` as `string[]`, removing the compile-time enum guard that the backend Zod schema (`z.enum(['backer','creator'])`) provides. A future refactor could silently weaken the type contract. | `use-complete-onboarding.ts:7` | Change the type to `('backer' \| 'creator')[]` to match the backend allowlist |
| SEC-004-08 | LOW | `notification_preferences` JSONB column has no DB-level schema validation; if a direct DB write (migration, admin tooling) stores unexpected keys, `resolveNotificationPreferences` will silently spread them into the response object | `notification-preferences.ts:18-22` | This is acceptable given the strict Zod `.strict()` schema on the write path, but a DB CHECK constraint or explicit key-stripping in `resolveNotificationPreferences` would add defence-in-depth |
| SEC-004-09 | LOW | Error messages from the API propagate the raw `error.message` string to the frontend via the `api-client.ts` helpers; if a future error type inadvertently includes a stack trace or internal path, it will reach the browser | `api-client.ts:11,21,31,41` | The global error handler in `server.ts` already returns a generic message for unhandled errors, so this is low risk, but API response error messages should be reviewed to remain non-disclosive |
| SEC-004-10 | INFO | `security_alerts` is correctly computed as `true` in `mapUserToResponse` at the serialisation layer and never stored in DB; the Zod `.strict()` schema on the notification-preferences PUT endpoint correctly rejects any payload containing `security_alerts` (confirmed by test at line 216 of `me-router.test.ts`) | `me-router.ts:55-58` | No action required — implementation is correct |
| SEC-004-11 | INFO | All database queries in `pg-user-repository.ts` use parameterised queries (`$1`, `$2`, …) with no string interpolation; no SQL injection vectors found | `pg-user-repository.ts` (all methods) | No action required |
| SEC-004-12 | INFO | All endpoints require `req.auth` from the MMF auth middleware; `userId` is never sourced from the request body — it always comes from the auth context | `me-router.ts:80,131,179,220,262` | No action required |
| SEC-004-13 | INFO | No `dangerouslySetInnerHTML` usage found anywhere in the frontend components reviewed | Frontend components | No action required |
| SEC-004-14 | INFO | Error messages shown to users in components (`profile-edit-form.tsx`, `onboarding.tsx`) display only `error.message` from the API, which is already sanitised by the backend; no stack traces or internal paths are exposed | Frontend components | No action required |

---

## Detailed Findings

### SEC-004-01 — HIGH: Role Allowlist Not Enforced at Database Layer

**File:** `packages/backend/src/account/adapters/pg/pg-user-repository.ts`, lines 207–215

The `completeOnboarding` method in `PgUserRepository` iterates over `input.roles` and inserts each value directly into the `user_roles` table with no per-value validation at the repository level:

```typescript
for (const role of input.roles) {
  const roleId = crypto.randomUUID();
  await client.query(
    `INSERT INTO user_roles (id, user_id, role, assigned_by)
     VALUES ($1, $2, $3, NULL)
     ON CONFLICT (user_id, role) DO NOTHING`,
    [roleId, userId, role],
  );
}
```

The Zod schema in `me-router.ts` (line 31) uses `z.array(z.enum(['backer', 'creator']))`, which correctly restricts roles at the HTTP layer. However, the `UserRepository` port interface (line 22) accepts `roles: string[]`, and the `ProfileService` and repository receive a `string[]`. If the application service or port is ever called from a path that bypasses the router (e.g., an internal scheduled job, a new endpoint that forgets the Zod step), arbitrary role values could be written to the database.

**Impact:** An attacker who can reach `completeOnboarding` outside the HTTP router layer could self-assign any role string (including `admin`, `moderator`, `founder`, etc.).

**Recommendation:** Add a `CHECK` constraint on the `user_roles.role` column in a migration (e.g. `CHECK (role IN ('backer', 'creator', 'admin'))`), and/or validate the allowlist inside `ProfileService.completeOnboarding` rather than only at the router layer. Defence-in-depth requires validation at every boundary.

---

### SEC-004-02 — HIGH: No Database CHECK Constraint on `onboarding_step`

**File:** `db/migrations/20260306000008_add_onboarding_and_notifications.sql`, line 4; `pg-user-repository.ts`, lines 251–255

The migration adds `onboarding_step INT NULL DEFAULT NULL` with no CHECK constraint. The application enforces `step: z.number().int().min(1).max(3)` via Zod at the HTTP boundary. However, the `saveOnboardingStep` repository method accepts any `number`:

```typescript
async saveOnboardingStep(userId: string, step: number): Promise<void> {
  await this.pool.query(
    'UPDATE users SET onboarding_step = $2, updated_at = NOW() WHERE id = $1',
    [userId, step],
  );
}
```

If this method is called from a future internal path, negative values, zero, or very large integers could be stored. Additionally, there is no guard preventing a step regression (e.g. writing step 1 for a user who has `onboarding_completed = true`).

**Recommendation:**
1. Add `CHECK (onboarding_step IS NULL OR (onboarding_step >= 1 AND onboarding_step <= 3))` in the migration.
2. Consider guarding `saveOnboardingStep` at the application service layer to reject calls for already-completed users, or at minimum to reject out-of-range values.

---

### SEC-004-03 — MEDIUM: `clerkUserId` Returned in API Response

**File:** `packages/backend/src/account/api/me-router.ts`, line 45

`mapUserToResponse` includes `clerkUserId: user.clerkUserId` in the response. The Clerk user ID is an internal identity-provider reference. Exposing it to frontend clients increases the information available to an attacker who intercepts API responses and may expose implementation details about the identity system.

**Recommendation:** Remove `clerkUserId` from the serialised response. The frontend has no demonstrated need for it (the frontend types in `user.ts` include it, but it is unused in any UI logic reviewed).

---

### SEC-004-04 — MEDIUM: `OnboardingGuard` Fails Open on API Error

**File:** `packages/frontend/src/components/layout/onboarding-guard.tsx`, lines 28–30

```tsx
if (isError) {
  return <>{children}</>;
}
```

When the `/api/v1/me` call fails (network error, 5xx, auth expired), the guard renders the protected children (profile page, KYC page) rather than blocking. An attacker who can induce an API error (e.g. via a race condition, session expiry at just the right moment, or a proxy-level block) would be able to access onboarding-gated pages without completing onboarding.

**Recommendation:** On `isError`, redirect to `/onboarding` or render an error/retry state. The guard should not allow access when the onboarding state is unknown.

---

## Additional Notes

**JSONB notification_preferences — security_alerts handling (PASS)**

The `security_alerts` field is correctly handled end-to-end:
- It is NOT stored in the database (not a column, not a JSONB key written on any update path).
- It is injected as `security_alerts: true` at serialisation time in `mapUserToResponse`.
- The PUT `/notification-preferences` endpoint uses `z.object({...}).strict()`, which rejects any payload containing `security_alerts` with a 400 response.
- This is confirmed by the integration test at `me-router.test.ts:216`.

**Role assignment — allowlist validation (PARTIAL PASS)**

The HTTP-layer Zod schema correctly restricts `roles` to `['backer', 'creator']`. However, this is not reinforced at the DB layer — see SEC-004-01.

**Bio/DisplayName server-side length limits (PASS)**

Zod enforces `.max(100)` on `display_name` and `.max(500)` on `bio` at the router. These are also enforced in the frontend via HTML `maxLength` attributes. The limits are adequate to prevent trivial DoS via large payloads given the global `express.json()` middleware default body size limit (100kb). The limits are consistent between the onboarding and profile-edit paths.

**Error message leakage (PASS)**

The global error handler in `server.ts` (line 133) returns a generic `INTERNAL_ERROR` message for all unhandled exceptions. Domain errors are caught and returned with safe, predefined codes and messages. No stack traces or file paths are exposed.

**SQL injection (PASS)**

All queries in `pg-user-repository.ts` use parameterised queries (`$1`, `$2`, etc.). No string interpolation in query bodies was found.
