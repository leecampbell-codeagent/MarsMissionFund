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

## KYC Domain Gotchas

### G-018: KYC Status Column Value Naming Mismatch

**Problem:** The `users.kyc_status` CHECK constraint (created in feat-001) uses `'failed'` as the
value for rejected verification. L4-005 calls this state "Rejected". The `KycStatus` value object
also uses `Failed: 'failed'`. This inconsistency makes the code misleading and will cause confusion
when implementing the full state machine.

**Fix:** The feat-002 migration must rename `'failed'` to `'rejected'` in the CHECK constraint.
Add an `ALTER TABLE` in the migration to drop and recreate the constraint with the new value.
Update the `KycStatus` value object to use `Rejected: 'rejected'`. Update all references in
`pg-user-repository.adapter.ts` and frontend `UserProfile` type.

**Detected in:** feat-002 research

---

### G-019: Audit Event Ordering — DB Update Before Audit Log

**Problem:** If the audit event is emitted BEFORE the DB update, and the DB update subsequently
fails (timeout, constraint violation), the audit log shows a state transition that never completed.
The audit trail becomes inaccurate.

**Fix:** Always perform the DB state update first, then emit the audit event. If the audit event
emission fails (e.g., insert to `kyc_audit_events` fails), log the error to pino but do not
roll back the state update — the audit is best-effort for the local demo. For production, the
audit insert should be in the same DB transaction as the status update.

**Detected in:** feat-002 research

---

### G-020: Concurrent KYC Submit Requests Need Conditional WHERE

**Problem:** Two simultaneous `POST /kyc/submit` requests (e.g., double-click, React strict mode
double-invocation) could both read `kyc_status = 'not_started'`, both pass the validation check,
and both trigger the state machine — resulting in two audit events and potentially two competing
DB updates.

**Fix:** The `updateKycStatus()` repository method for the `not_started → pending` transition
must use a conditional WHERE clause:

```sql
UPDATE users
SET kyc_status = 'pending', updated_at = NOW()
WHERE clerk_user_id = $1 AND kyc_status = 'not_started'
RETURNING *
```

If the UPDATE affects 0 rows (because another concurrent request already changed the status),
the application service must treat this as a conflict and return `409 KYC_ALREADY_PENDING`.
This makes the transition atomic without requiring an explicit lock.

**Detected in:** feat-002 research

---

### G-021: `AuditLoggerPort.resourceType` Typed as `'user'` Only

**Problem:** The `AuditEntry` interface in `packages/backend/src/account/ports/audit-logger.port.ts`
has `resourceType: 'user'` as a literal type. KYC audit events should use `resourceType: 'kyc'`
per L3-006 Section 4.1. TypeScript will reject `resourceType: 'kyc'` until the union is expanded.

**Fix:** Change the `resourceType` field type to `'user' | 'kyc'` (and future resource types as
needed). Update the `AuditEntry` interface:

```typescript
readonly resourceType: 'user' | 'kyc';
```

**Detected in:** feat-002 research

---

### G-022: `in_review` DB Value Reserved but Not Used by Stub

**Problem:** The `users.kyc_status` CHECK constraint includes `'in_review'` as a valid value.
The stub never transitions to `in_review` (it auto-approves). Code that assumes all valid
CHECK constraint values are reachable via the stub will be confused.

**Fix:** The `in_review` value is reserved for the real Veriff integration. The stub state
machine only uses `not_started`, `pending`, and `verified` (and `rejected` for failure testing).
Document this clearly in the KYC application service and test coverage — do not write tests for
`in_review` in feat-002; they belong in the real Veriff adapter feature.

**Detected in:** feat-002 research

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

---

## Pre-commit Hook Gotchas

### G-016: Hooks With `-r` Flag Scan Everything When Called With No Files

**Problem:** When pre-commit calls a hook and no staged files match the hook's `types` filter, pre-commit passes an empty filenames list. A hook using `grep -rn "pattern" -- "$@"` with `$@` empty will have `grep` scan the current directory recursively (GNU grep default when no files given with `-r`), matching `node_modules/`, `autonomous/`, and other directories.

This causes false positives for `check-merge-conflict` (lines ending with `=====...====` in HISTORY.md files match `=======$`), `detect-private-key` (test fixtures in `node_modules/@clerk/backend`), and `trailing-whitespace` (`sed: no input files`).

**Fix:** Add an early exit when no filenames are passed:
```sh
sh -c 'if [ $# -eq 0 ]; then exit 0; fi; if grep -n "pattern" -- "$@"; then exit 1; fi; exit 0'
```

Remove the `-r` flag from grep (not needed when pre-commit passes explicit filenames).

**Note:** `.pre-commit-config.yaml` is in `.gitignore` (runtime-injected). Edits apply for the current session but are not committed. If this keeps happening across sessions, the `autonomous/scripts/.pre-commit-config.yaml` source file needs to be updated.

**Detected in:** feat-001 pipeline

---

---

## Campaign Domain Gotchas

### G-023: Express Router Order — `review-queue` Matches `/:id` Parameter

**Problem:** If `GET /api/v1/campaigns/:id` is registered before `GET /api/v1/campaigns/review-queue`,
Express will interpret `review-queue` as a campaign ID. The route handler will look up a campaign
with ID `"review-queue"`, find nothing, and return 404 instead of the review queue.

**Fix:** Always register specific path segments before parameterised paths in Express:

```typescript
router.get('/review-queue', reviewerOnly, getReviewQueueHandler); // BEFORE /:id
router.get('/:id', getCampaignHandler);
```

This is a general Express routing rule — literal path segments always match before param
segments IF they are registered first.

**Detected in:** feat-003 research

---

### G-024: BIGINT from PostgreSQL Returns as JavaScript String

**Problem:** PostgreSQL's `BIGINT` type exceeds JavaScript's safe integer range for large
monetary amounts (e.g., 100_000_000_000 cents = $1B, which is within `Number.MAX_SAFE_INTEGER`
at 9,007,199,254,740,991, but 64-bit BIGINT can exceed this). The `pg` library returns BIGINT
columns as JavaScript strings to be safe. Code that tries to use arithmetic operators directly
on these values (e.g., `fundingGoalCents + 100`) will fail at runtime or produce incorrect results
because the values are strings.

**Fix:** Never parse BIGINT monetary amounts to `Number`. Pass them as strings throughout:
- Backend: keep as `string` from DB result to API response.
- Frontend: display via `Intl.NumberFormat` with cents-to-dollars conversion (`BigInt` or
  `Number` is safe for values below $90 trillion).
- Validation: Zod schema uses `z.string()` for monetary fields; validate that the string is a
  valid integer using a regex or `z.string().regex(/^\d+$/)`.

**Detected in:** feat-003 research

---

### G-025: Milestone Percentage Sum — Use Basis Points, Not Whole Percents

**Problem:** Three equal milestones at 33% each sum to 99%, not 100%. If whole integer
percentages are used for milestone funding allocation, equal splits of three or more milestones
cannot be represented exactly (33+33+34 requires one milestone to absorb the rounding).
Creators expecting "equal thirds" will be confused by the asymmetry.

**Fix:** Use basis points (integers summing to 10,000) instead of whole percentages summing to
100. Three equal milestones can be represented as 3333 + 3333 + 3334 = 10000.
Store as `INTEGER NOT NULL CHECK (funding_basis_points > 0)` in the milestones JSONB or
a future milestones table. Validate `SUM(funding_basis_points) = 10000` at submission time.
Display to users as percentages in the frontend: `(basisPoints / 100).toFixed(2) + '%'`.

**Detected in:** feat-003 research

---

### G-026: Campaign Draft Update and Submit are Different Operations

**Problem:** Auto-save (partial draft update) and final submission have fundamentally different
semantics. If the PATCH (auto-save) endpoint applies the same strict validation as the submit
endpoint, creators cannot save incomplete drafts (they'd get validation errors for missing
required fields while mid-form).

**Fix:**
- `PATCH /campaigns/:id` (auto-save): Accept partial updates, store whatever is provided,
  apply only structural validation (max field lengths, valid URL formats, no XSS). Do NOT
  validate required-field presence or business rules (milestone % sum, deadline range).
- `POST /campaigns/:id/submit`: Read the full campaign from DB, apply ALL submission
  validation rules. Reject if any required field is missing or any business rule fails.
The two operations must use different Zod schemas: a lenient `updateCampaignSchema` and a
strict `submitCampaignSchema`.

**Detected in:** feat-003 research

---

### G-027: `campaigns.creator_user_id` ON DELETE Must Be `RESTRICT`

**Problem:** If `campaigns.creator_user_id` is defined as `ON DELETE CASCADE` or `ON DELETE
SET NULL`, deleting a user's account would cascade-delete all their campaigns (including Live
or Funded campaigns), potentially erasing financial records and disrupting backers. `SET NULL`
is marginally safer but leaves orphaned campaign records with no creator identity.

**Fix:** Use `ON DELETE RESTRICT` for `campaigns.creator_user_id`. This prevents account
deletion while any non-terminal campaign exists. The application layer must check for active
campaigns before allowing account deletion (GDPR erasure requests from users with active
campaigns require admin intervention). Terminal states are: `complete`, `cancelled`, `failed`.

**Detected in:** feat-003 research

---

### G-028: Rich Text Description Is an XSS Vector

**Problem:** If the campaign `description` field accepts and renders HTML (rich text), a
malicious creator could inject `<script>alert('xss')</script>` or other payloads that execute
in a backer's browser when viewing the campaign page.

**Fix:** For feat-003 (local demo), treat `description` as plain text with newline preservation.
Do NOT build a full WYSIWYG rich text editor for the demo. Render as `white-space: pre-wrap`
in the frontend. If Markdown is desired later, sanitise server-side before rendering. Never
render raw user-supplied HTML without sanitisation.

**Detected in:** feat-003 research

---

### G-017: `=======$` Grep Pattern Matches `=====...=====` Section Dividers

**Problem:** The regex `=======$` (without `^`) matches any line that *ends* with 7+ `=` characters, including `# =============================================` comment dividers common in shell scripts.

**Fix:** Always anchor with `^`: use `^=======$` to match only a line that is *exactly* `=======` (a genuine merge conflict marker).

**Detected in:** feat-001 pipeline

---

## Campaign Implementation Gotchas

### G-029: `claimCampaign` pre-check fires before atomic DB conflict error

**Problem:** Tests that assert `CampaignAlreadyClaimedError` for a second reviewer attempting
to claim an already-claimed campaign will fail. By the time the second request reaches the
`claimCampaign` method, the campaign's status has already been changed to `under_review` by
the first claimer. The application service pre-checks `campaign.status !== 'submitted'` and
throws `CampaignNotClaimableError` before even reaching the repository's atomic `updateStatus`
call — which is the only place `CampaignAlreadyClaimedError` can be thrown.

`CampaignAlreadyClaimedError` is only reachable in a true race condition where two requests
read `status = 'submitted'` simultaneously and one wins the DB UPDATE's WHERE clause.
That race cannot be simulated via sequential test steps.

**Fix:** Test the second-claim scenario with `CampaignNotClaimableError`, not
`CampaignAlreadyClaimedError`. Document that `CampaignAlreadyClaimedError` is for DB-level
races (tested via the InMemory adapter's atomic check directly, not through the app service).

**Detected in:** feat-003 implementation

---

### G-030: Test user IDs must be valid UUIDs when Zod schemas use `z.string().uuid()`

**Problem:** Using non-UUID strings as user IDs in API integration tests (e.g.,
`'user-id-reviewer_001'`, `'test-creator-id'`) causes 400 VALIDATION_ERROR responses when
the request body is validated against a Zod schema that includes `z.string().uuid()` for
a user ID field (e.g., `reassignCampaignSchema`'s `reviewerUserId`).

The test appears to be testing a 403 or 200 path but receives 400 instead, causing
misleading test failures.

**Fix:** Always use `crypto.randomUUID()` for user IDs in test fixtures when the API
schema validates them as UUIDs:

```typescript
function makeTestIds() {
  return {
    creatorId: crypto.randomUUID(),
    reviewerId: crypto.randomUUID(),
    adminId: crypto.randomUUID(),
  };
}
```

**Detected in:** feat-003 implementation

---

### G-031: `roles[0]` may be `undefined` — use nullish coalescing for string parameters

**Problem:** When setting Clerk public metadata after a role change, TypeScript's strict
mode will reject `roles[0]` as the argument to a parameter typed `string` because array
element access can return `undefined`. This causes a type error at compile time:

```typescript
// Error: Type 'Role | undefined' is not assignable to type 'string'
await this.clerkAuth.setPublicMetadata(clerkUserId, { role: updatedUser.roles[0] });
```

**Fix:** Use nullish coalescing to provide a fallback:

```typescript
await this.clerkAuth.setPublicMetadata(clerkUserId, { role: updatedUser.roles[0] ?? 'backer' });
```

The fallback `'backer'` is safe because by this point in `assignCreatorRole`, the roles
array has just been updated and will contain at least `Role.Creator`.

**Detected in:** feat-003 implementation

---

### G-032: `UpdateCampaignInput.category` type incompatibility with Zod inference

**Problem:** `updateCampaignSchema` uses `z.enum(CAMPAIGN_CATEGORIES as [string, ...string[]])`
which infers `category` as `string | undefined`. However `UpdateCampaignInput.category` is
typed as `CampaignCategory | undefined`. TypeScript rejects passing the Zod parse result
directly to `campaignAppService.updateDraft()`:

```
Type 'string | undefined' is not assignable to type 'CampaignCategory | undefined'
```

**Fix:** Cast the parse result to the expected input type at the router boundary:

```typescript
const campaign = await campaignAppService.updateDraft(
  clerkUserId,
  req.params.id,
  parseResult.data as UpdateCampaignInput,  // Safe: Zod validated the enum value
);
```

This is safe because Zod has already validated the `category` value is one of the
`CAMPAIGN_CATEGORIES` values. The cast bridges the structural equivalence that TypeScript
cannot infer automatically due to the tuple cast at the schema level.

**Detected in:** feat-003 implementation

---

### G-033: Redeclaring a function parameter variable causes a build error

**Problem:** Inside an application service method that takes `campaignId` as a parameter,
adding `const campaignId = campaign.id` as a later line causes a variable redeclaration
error (TypeScript/ESBuild: "Cannot redeclare block-scoped variable 'campaignId'").

Example of the mistake:
```typescript
async claimCampaign(clerkUserId: string, campaignId: string): Promise<Campaign> {
  const campaign = await this.campaignRepository.findById(campaignId);
  // ...
  const campaignId = campaign.id;  // ERROR: already declared as parameter
}
```

**Fix:** Remove the redundant declaration. The parameter value and `campaign.id` are
identical at this point; the parameter already holds the correct value.

**Detected in:** feat-003 implementation



















---

### G-034: Frontend/Backend Schema Drift in JSONB Arrays

**Problem:** When backend domain models store complex objects in JSONB columns (milestones, team members, risk disclosures, budget items), the frontend type definitions can drift from the backend Zod schemas. This happened 4 times in feat-003 quality gates:
- `RiskDisclosure`: frontend had `{title, description, severity}`, backend had `{id, risk, mitigation}`
- `CampaignCategory`: frontend had `propulsion_systems`, backend had `propulsion`
- `TeamMember`: frontend missing `id`, had extra `linkedInUrl`, `bio: string | null` vs `z.string()`
- `Milestone`: frontend missing `id`, `targetDate` format mismatch (ISO vs YYYY-MM-DD)

**Fix:** When implementing JSONB array schemas:
1. Define the schema in the backend FIRST (`update-campaign.schema.ts`)
2. Export the inferred TypeScript type: `export type TeamMemberInput = z.infer<typeof teamMemberSchema>`
3. Use the shared type in `packages/shared/` or manually keep frontend types in sync
4. Add a contract test that validates the frontend types against the backend Zod schemas
5. For `id` fields: backend schemas require UUID, frontend components must call `crypto.randomUUID()` when creating new entries

**Detected in:** feat-003 quality gate (4 quality loop iterations needed)

---

## Discovery / Public Campaign Gotchas

### G-036: `requireAuth` Applied to Entire `/api/v1/campaigns` Mount — Cannot Add Anonymous Routes to Existing Router

**Problem:** In `app.ts`, `requireAuth` is applied as middleware to the entire `/api/v1/campaigns`
prefix before the campaign router:

```typescript
app.use('/api/v1/campaigns', requireAuth, createCampaignRouter(...));
```

Any route registered inside `createCampaignRouter()` will require authentication, regardless
of what the route handler does. Adding a public anonymous endpoint to the existing router is
NOT possible without either:
a) Removing `requireAuth` from the mount (breaks all existing protected routes), or
b) Restructuring the router to apply `requireAuth` selectively per-route.

**Fix:** Mount public/anonymous campaign endpoints on a SEPARATE router prefix (e.g.,
`/api/v1/public/campaigns`) in `app.ts` WITHOUT `requireAuth`. The existing authenticated
router is unchanged. The public router is a separate Express Router instance.

```typescript
// Existing authenticated routes — unchanged
app.use('/api/v1/campaigns', requireAuth, createCampaignRouter(...));

// New anonymous public routes — no requireAuth
app.use('/api/v1/public/campaigns', createPublicCampaignRouter(...));
```

`clerkMiddleware()` is already applied globally and populates `req.auth` for all requests
(including unauthenticated ones). Anonymous requests have `req.auth.userId === null`.
The public router handlers must NOT call `getClerkAuth()` as a gate — call it only if
you want to personalise the response for authenticated users.

**Detected in:** feat-004 research

---

### G-037: `websearch_to_tsquery` Returns NULL for Empty Input — Guard Required

**Problem:** PostgreSQL's `websearch_to_tsquery('english', '')` returns `NULL`, not an empty
tsquery. If the WHERE clause is `WHERE search_vector @@ websearch_to_tsquery('english', $1)`,
a blank search term will return 0 results (NULL @@ anything = false).

**Fix:** Guard the search condition:

```sql
WHERE ($1 = '' OR search_vector @@ websearch_to_tsquery('english', $1))
```

Or use a CASE expression in the WHERE clause. When `q` is blank or absent, return all
`live`/`funded` campaigns without FTS filtering.

Additionally, trim and validate the `q` parameter at the Zod boundary:
- `q: z.string().max(200).optional().transform(v => v?.trim() ?? '')`
- Empty string after trim → treat as "no search term" → return all results sorted by default

**Detected in:** feat-004 research

---

### G-038: `tsvector` Trigger Cannot JOIN Other Tables Directly

**Problem:** A PostgreSQL trigger function on the `campaigns` table cannot JOIN the `users`
table to include `creator_display_name` in the `search_vector` tsvector. Trigger functions
operate on the NEW row in isolation; JOINs require a separate query inside a PL/pgSQL
function, which is possible but adds complexity and a second DB read on every campaign write.

**Fix:** For the workshop demo, do not include creator name in the pre-computed `search_vector`.
Instead, include the creator name match at query time via a JOIN:

```sql
SELECT c.*, u.display_name AS creator_name,
       ts_rank(c.search_vector, websearch_to_tsquery('english', $1)) AS rank
FROM campaigns c
JOIN users u ON c.creator_user_id = u.id
WHERE c.status IN ('live', 'funded')
  AND ($1 = '' OR c.search_vector @@ websearch_to_tsquery('english', $1)
       OR to_tsvector('english', COALESCE(u.display_name, '')) @@ websearch_to_tsquery('english', $1))
ORDER BY rank DESC, c.launched_at DESC
LIMIT $2 OFFSET $3
```

The `to_tsvector()` call on `display_name` at query time is not index-supported, but for
the workshop demo dataset this is acceptable.

**Detected in:** feat-004 research

---

### G-039: Multi-Value Category Filter — Use `= ANY($1::TEXT[])` Not Dynamic SQL

**Problem:** The campaign search endpoint accepts multi-value `category` filter (e.g.,
`?category=propulsion&category=power_energy`). Building SQL with `IN ($1, $2, $3)` requires
dynamic query construction with variable parameter counts. Dynamic SQL construction is fragile
and risks SQL injection if done incorrectly.

**Fix:** Use PostgreSQL's array operator instead:

```sql
WHERE ($1::TEXT[] IS NULL OR category = ANY($1::TEXT[]))
```

Pass the category array as a PostgreSQL array parameter:
```typescript
const categoryArray = categories.length > 0 ? categories : null;
// $1 = null means "no filter" → condition evaluates to true
```

Validate each category value against the `CAMPAIGN_CATEGORIES` enum at the Zod layer before
passing to SQL — never pass raw user input as the array contents.

**Detected in:** feat-004 research

---

### G-035: `z.object()` Does NOT Reject Unknown Keys by Default

**Problem:** Zod's `z.object()` silently strips unknown keys by default. Fields present in the frontend payload but absent from the Zod schema are silently dropped without a 400 error. This caused `linkedInUrl` to appear to work in the UI (no error) but never get persisted. Users lose data with no indication of the failure.

**Fix:** Either:
- Use `.strict()` on all object schemas to reject unknown keys (breaks if frontend sends extra fields)
- OR add all frontend-collected fields to the backend schema
- OR explicitly document which fields are UI-only and not persisted (note this in the frontend type and TeamSection component)

The `emptyBodySchema = z.object({}).strict()` pattern (for body-less endpoints) correctly uses `.strict()`. Apply the same rigor to entity sub-schemas.

**Detected in:** feat-003 quality gate


## feat-005 Gotchas (Payments)

### MOCK_PAYMENTS vs MOCK_PAYMENT
The `.env.example` already has `MOCK_PAYMENTS=true` (with S). The composition root reads `MOCK_PAYMENTS`. Do not introduce a second env var `MOCK_PAYMENT` (without S) — it creates confusion.

### contributions table FK is `users(id)`, not `accounts(id)`
The auth table is named `users`, not `accounts`. All FK references from payments tables must use `REFERENCES users(id)`.

### Duplicate detection excludes `failed` contributions
The 60-second window SQL must include `WHERE status != 'failed'` — a previous failed attempt for the same donor/campaign/amount should not block a retry.

### Escrow ledger is append-only — no `updated_at`
`escrow_ledger` and `contribution_audit_events` are append-only tables. Do NOT add `updated_at` column or `update_updated_at_column()` trigger to them.

### `tok_fail` is the sentinel for failure, not `tok_decline`
The sentinel token for triggering the payment failure path is `tok_fail`. Frontend helper text must show this exact value.
