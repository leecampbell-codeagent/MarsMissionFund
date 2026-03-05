# Gotchas

> Known pitfalls, anti-patterns, and implementation traps discovered during research cycles.
> Updated by Spec Researcher agents across feature cycles.

---

## Clerk Integration Gotchas

### G-001: Clerk User ID Is NOT a UUID

**Problem:** Clerk user IDs are prefixed KSUIDs (`user_2abc3XYZ...`), not UUIDs.
Using `UUID` type for `clerk_user_id` columns in PostgreSQL will cause type mismatch errors at runtime.

**Fix:** Always use `TEXT` (or `VARCHAR`) for `clerk_user_id` columns.
Never use `UUID` for this field.
Every table that references user identity must use `TEXT`.

**Detected in:** feat-001 research

---

### G-002: JWT Does NOT Include Roles by Default

**Problem:** Clerk's default session tokens contain only: `sub`, `sid`, `azp`, `iss`, `exp`, `iat`.
They do NOT include roles or `publicMetadata`.
Backend code that tries to read role claims from the JWT without configuring a JWT template will find nothing.

**Fix:** Configure a Clerk Dashboard JWT template to embed the role claim:
- Go to Sessions → Customize session token in the Clerk Dashboard.
- Add: `"role": "{{user.publicMetadata.role}}"`.
Without this, every request requires a separate Clerk API call to fetch user metadata — a performance and availability anti-pattern.

**Detected in:** feat-001 research

---

### G-003: `requireAuth()` Redirects Instead of Returning 401

**Problem:** Clerk's `requireAuth()` middleware in `@clerk/express` by default redirects unauthenticated users to a sign-in page.
For a REST API server, this returns a 3xx redirect response where a 401 JSON error is expected.
This breaks API clients that are not browsers.

**Fix:** Configure `requireAuth()` with a custom `unauthorizedHandler`:

```typescript
requireAuth({
  signInUrl: undefined,
  unauthorizedHandler: (req, res) => {
    res.status(401).json({
      error: {
        code: 'UNAUTHENTICATED',
        message: 'Authentication required',
        correlation_id: req.correlationId
      }
    })
  }
})
```

Or, use `clerkMiddleware()` + manual `getAuth()` check in each handler, returning 401 manually.

**Detected in:** feat-001 research

---

### G-004: Webhook Handlers Must Be Idempotent

**Problem:** Clerk delivers webhooks at-least-once and does not guarantee delivery order.
`user.created` may arrive after `user.updated`.
A webhook handler that blindly inserts a new row on `user.created` will fail if the row already exists.

**Fix:** All webhook handlers and the `/v1/auth/sync` endpoint must use upsert semantics:

```sql
INSERT INTO users (clerk_user_id, email, ...)
VALUES ($1, $2, ...)
ON CONFLICT (clerk_user_id) DO UPDATE SET email = EXCLUDED.email, updated_at = NOW();
```

Handle `user.updated` by checking if the MMF user record exists; create it if not (do not assume `user.created` arrived first).

**Detected in:** feat-001 research

---

### G-005: Cookie Size Limit with JWT Templates

**Problem:** Clerk stores session tokens in cookies.
Most browsers limit cookies to 4KB.
If the Clerk JWT template embeds too much data (e.g., the full role array plus other metadata), the cookie exceeds the limit and Clerk cannot set it, breaking authentication for ALL requests.

**Fix:** Keep the JWT template minimal.
Embed only the primary role as a string (`"role": "{{user.publicMetadata.role}}"`), not the full role array or any large metadata objects.
For features that need the full role set, query the MMF database using `clerk_user_id`.

**Detected in:** feat-001 research

---

### G-006: `unsafeMetadata` Can Be Modified from the Frontend

**Problem:** Using `unsafeMetadata` to store MMF roles would allow any frontend client to self-assign roles by calling `user.update({ unsafeMetadata: { role: 'super_administrator' } })`.
This is a critical privilege escalation vulnerability.

**Fix:** Always store MMF roles in `publicMetadata` (backend-write only) or in the MMF database.
Never use `unsafeMetadata` for authorization-relevant data.

**Detected in:** feat-001 research

---

### G-007: Enumeration Protection Is Opt-In

**Problem:** Without explicitly enabling Clerk's enumeration protection in the Dashboard, Clerk's hosted sign-up/sign-in UI may reveal whether an email address is already registered (different error messages for known vs. unknown emails).
This violates AC-ACCT-002 and L3-002 security requirements.

**Fix:** Enable the "Enumeration protection" setting in the Clerk Dashboard (released August 2025).
Additionally, ensure MMF's own API endpoints (`GET /me`, error responses from `/v1/auth/sync`) never reveal whether an email exists in the system.

**Detected in:** feat-001 research

---

### G-008: Session Token Version Mismatch

**Problem:** As of April 2025, Clerk released session token v2 and deprecated v1.
If the Clerk Dashboard is still using v1 but the `@clerk/express` SDK expects v2 format, token parsing fails silently or throws cryptic errors.

**Fix:** When setting up the Clerk application:
1. Check the Clerk Dashboard → Updates → Session token version.
2. Upgrade to v2 if on v1.
3. Ensure the `@clerk/express` package version supports the SDK API version `2025-04-10` or later.

**Detected in:** feat-001 research

---

### G-009: Email Column Staleness After Clerk Profile Update

**Problem:** Clerk allows users to change their email address via Clerk's hosted account portal.
If MMF stores a copy of the email in `users.email`, this copy becomes stale without a webhook sync.

**Fix:** Register a `user.updated` webhook handler that updates `users.email` whenever the email changes.
Alternatively, avoid storing email in MMF's DB and always derive it from the JWT or a Clerk API call (trade-off: no email without a JWT or API call, complicates server-side email sending).
Recommended: store email in MMF DB but treat it as a cache, synced via `user.updated` webhook.

**Detected in:** feat-001 research

---

## Database / Schema Gotchas

### G-010: Do Not Store `deleted` Status in the Users Table

**Problem:** Storing `account_status = 'deleted'` as a row in the `users` table after GDPR erasure means the row still contains PII in other columns (email, display name, etc.), defeating the purpose of erasure.

**Fix:** When a user is deleted (GDPR erasure, or 90-day reactivation window expires):
1. Delete the row from `users` entirely.
2. Audit log entries use anonymised references (no PII).
3. Other tables referencing `users.id` must define `ON DELETE SET NULL` or `ON DELETE CASCADE` as appropriate.
Plan the cascade rules in the migration for each FK relationship before implementing deletion.

**Detected in:** feat-001 research

---

### G-011: `notification_prefs` Security Alerts Must Be Hardcoded True

**Problem:** If the API blindly writes the `notification_prefs` JSONB from the request body, a user could send `{ "security_alerts": false }` and disable mandatory security notifications, violating L4-001 Section 4.2 and AC-ACCT-018.

**Fix:** The PATCH `/me/notifications` endpoint must always enforce `security_alerts: true` regardless of what the request body contains.
Either:
- Validate with Zod that `security_alerts` is not present in the request body (disallow setting it), or
- After applying the request body update, always overwrite `security_alerts` to `true` before persisting.

**Detected in:** feat-001 research

---

## Testing Gotchas

### G-012: Never Use Real Clerk Tokens in Unit or Integration Tests

**Problem:** Real Clerk tokens expire quickly (5-minute access tokens), are tied to a specific Clerk application instance, and require network calls to JWKS endpoints.
Using real tokens in tests makes tests flaky and environment-dependent.

**Fix:** Always mock `@clerk/express` in tests:

```typescript
vi.mock('@clerk/express', () => ({
  clerkMiddleware: () => (_req, _res, next) => next(),
  requireAuth: () => (req, res, next) => {
    if (!req.auth?.userId) return res.status(401).json({ error: { code: 'UNAUTHENTICATED' } })
    next()
  },
  getAuth: (req) => req.auth ?? { userId: null }
}))
```

Inject `req.auth` via test-specific middleware that reads a `x-test-user-id` header.

**Detected in:** feat-001 research

---

### G-013: Concurrent Auth/Sync Requests Create Duplicate Users Without UNIQUE Constraint

**Problem:** Frontend may fire two concurrent requests to `/v1/auth/sync` (double login event, React strict mode double invocation, etc.).
Without a UNIQUE constraint on `clerk_user_id`, two rows may be created for the same user.

**Fix:**
1. The `users` table migration must include `UNIQUE` constraint on `clerk_user_id`.
2. The `/v1/auth/sync` endpoint must use `INSERT ... ON CONFLICT (clerk_user_id) DO UPDATE` (upsert).
3. Tests must cover the concurrent creation scenario.

**Detected in:** feat-001 research

---

## Architecture Gotchas

### G-014: No Packages Directory — Monorepo Structure Needs Scaffolding

**Problem:** The repository has no `packages/` directory.
There are no `packages/backend` or `packages/frontend` subdirectories.
Any implementation agent that assumes a pre-existing monorepo structure will fail to find the codebase.

**Fix:** The first implementation feature (feat-001) must scaffold:
- `packages/backend/` — Express app with hexagonal architecture
- `packages/frontend/` — React + Vite app

Update `package.json` workspaces configuration to include both packages.

**Detected in:** feat-001 research

---

### G-015: Health Endpoint Must Not Require Clerk Auth

**Problem:** Per the feature brief, `/health` is the only unauthenticated endpoint.
If `clerkMiddleware()` or `requireAuth()` is applied globally at the top level before the `/health` route, health checks will fail when Clerk's JWKS endpoint is unreachable (circular dependency during startup).

**Fix:**
1. Register `/health` route BEFORE applying `clerkMiddleware()` or `requireAuth()`.
2. Or, exclude `/health` from the `requireAuth()` middleware scope by applying it only to `/v1/` routes.

**Detected in:** feat-001 research






















