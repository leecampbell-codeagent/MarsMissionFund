# Domain Knowledge

> Accumulated domain knowledge for the Mars Mission Fund platform.
> Updated by Spec Researcher agents across feature cycles.

---

## Clerk Integration

### Clerk User ID Format

Clerk user IDs are prefixed KSUIDs — strings of the form `user_2abc3XYZ...`.
They are **not UUIDs**.
All MMF database columns that reference Clerk user identity must use `TEXT` (not `UUID`).
This affects every table with a `clerk_user_id` FK.

### Dual-Record Pattern

Every authenticated user has two records:

1. **Clerk user record** — owns credentials, email verification, MFA, SSO links, session tokens.
2. **MMF `users` table row** — owns application data: roles, onboarding state, display name, bio, avatar URL, notification preferences.

These records are linked by `clerk_user_id` (MMF stores Clerk's `sub` claim value).
The MMF record is created lazily on first API call or via Clerk webhook.

### Role Storage Pattern (RBAC)

- **Source of truth**: MMF `users.roles` column (TEXT array) in the database.
- **Cache for JWT**: Clerk `publicMetadata.role` (primary role as string) — synced whenever role changes.
- **JWT embedding**: A Clerk JWT template adds `role` from `publicMetadata` to session token claims.
- This avoids a Clerk API call on every request while keeping the DB authoritative.
- `publicMetadata` can only be written from the backend, not the frontend (unlike `unsafeMetadata`).

### Clerk Metadata Types

| Type | Read | Write | MMF Use |
|------|------|-------|---------|
| `publicMetadata` | Frontend + Backend | Backend only | Role cache for JWT embedding |
| `privateMetadata` | Backend only | Backend only | Internal IDs, admin flags |
| `unsafeMetadata` | Frontend + Backend | Frontend + Backend | Do NOT use for roles (can be tampered) |

### Session Token JWT Claims (Default)

Default Clerk session tokens contain: `sub` (user ID), `sid` (session ID), `azp`, `iss`, `exp`, `iat`.
They do NOT include roles or `publicMetadata` by default.
A Clerk Dashboard JWT template must be configured to embed role data.

### Express Middleware Pattern

```typescript
import { clerkMiddleware, requireAuth, getAuth } from '@clerk/express'

app.use(clerkMiddleware())          // attaches req.auth to all requests
app.use('/v1', requireAuth())       // protects all /v1 routes

// In a handler:
const { userId } = getAuth(req)    // Clerk user ID (TEXT, e.g. "user_abc123")
```

`requireAuth()` by default redirects unauthenticated users (web behaviour).
For an API server, configure a custom `unauthorizedHandler` that returns 401 JSON instead.

### Webhook Events

Clerk uses Svix to sign webhooks.
Webhook signature verification uses `CLERK_WEBHOOK_SECRET` and `verifyWebhook()` from `@clerk/backend`.
Key events for feat-001:
- `user.created` — trigger lazy MMF user record creation
- `user.updated` — sync email, account status, linked SSO identities

All webhook handlers must be idempotent (upsert semantics).
Webhooks may arrive out of order or be replayed.

### Session Token Version

As of April 2025, Clerk deprecated session token v1 and released v2.
Ensure the Clerk Dashboard is configured to use v2 and the SDK (`@clerk/express`) supports it.

### Enumeration Protection

Clerk has opt-in enumeration attack protection (released August 2025).
Must be explicitly enabled in the Clerk Dashboard to prevent email existence disclosure via sign-up/sign-in responses.

---

## Account Domain

### Account States

Five states per L4-001:
- `pending_verification` — email not yet confirmed; limited access
- `active` — email confirmed; full access per roles
- `suspended` — administratively suspended; no access
- `deactivated` — user-initiated; may reactivate within 90 days
- `deleted` — GDPR erasure complete; row removed from DB

The `deleted` state is not stored in the DB — the row is removed.
Audit records retain anonymised references.

### Role Definitions

| Role | Assignment | KYC Required | Default |
|------|-----------|--------------|---------|
| Backer | Automatic on activation | No | Yes |
| Creator | Self-select + KYC | Yes (Verified) | No |
| Reviewer | Assigned by Administrator | No | No |
| Administrator | Assigned by Super Administrator | No | No |
| Super Administrator | Assigned by another Super Admin with MFA | No | No |

`Backer` is the default role granted automatically when an account reaches `active` state.
A user may hold multiple roles simultaneously.
Role changes must be logged as security-critical audit events.

### KYC Gate

The Creator role requires `kyc_status = 'verified'` before Creator-gated features are accessible.
The role may be assigned before KYC is complete, but features remain locked until KYC passes.
This means the API layer must check both role AND KYC status for Creator-gated endpoints.

### Anti-Enumeration

Registration and password-reset endpoints must return identical responses for registered and unregistered emails.
Never reveal whether an existing account uses SSO or password auth (per AC-ACCT-002).

### Notification Preferences

Six categories (from L4-001 Section 4.2):
1. Campaign updates (backed campaigns)
2. Milestone completions
3. Contribution confirmations
4. New campaign recommendations
5. Account security alerts — **mandatory, cannot be disabled**
6. Platform announcements

Stored as JSONB in `users.notification_prefs`.
Default: all opt-in except platform announcements (opt-out).
Security alerts: always forced `true`, cannot be set to `false` at the API layer.

---

## KYC Domain

### KYC Status State Machine (Stub Scope)

The full L4-005 lifecycle has 9 states. The stub (feat-002) implements only:

```
not_started → pending   (user calls POST /kyc/submit)
pending     → verified  (stub auto-approves synchronously)
failed      → pending   (user resubmits after failure — allowed)
```

In production (real Veriff), transitions via `in_review` and `pending_resubmission` apply.
Those states exist in the domain design but are out of scope for the local demo.

### KYC vs. Role Gate (Critical Distinction)

Do NOT conflate the Creator role with KYC verification status. They are independent:
- The Creator role may be assigned BEFORE KYC is complete.
- Creator-gated features require BOTH `roles CONTAINS 'creator'` AND `kyc_status = 'verified'`.
- API endpoints that gate on KYC must check both — role alone is insufficient.
- Error code when KYC is required but not verified: `KYC_NOT_VERIFIED`, HTTP 403.

### KYC DB Column Naming Mismatch

The current `users.kyc_status` CHECK constraint uses `'failed'` as the rejection value.
L4-005 calls this state "Rejected". This naming inconsistency should be resolved in the
feat-002 migration by renaming `'failed'` to `'rejected'` in the CHECK constraint and the
`KycStatus` value object.

### KYC Adapter Interface (Port Design)

The `KycVerificationPort` interface in `packages/backend/src/kyc/ports/kyc-provider.port.ts`
must define the contract for both the stub and the eventual real Veriff adapter:

```typescript
interface KycSessionResult {
  sessionId: string;
  sessionUrl?: string;  // not used by stub
  outcome: 'approved' | 'declined' | 'pending';
}

interface KycVerificationPort {
  initiateSession(userId: string): Promise<KycSessionResult>;
}
```

The stub always returns `{ sessionId: 'stub-session', outcome: 'approved' }` synchronously.
The real Veriff adapter would return a session URL and wait for a webhook.

### Audit Events for KYC

KYC status transitions emit two distinct audit events per stub submission:
1. `kyc.status.change` — `not_started → pending`
2. `kyc.status.change` — `pending → verified`

Each event must include `previous_status`, `new_status`, `trigger_reason`, and actor identity.
Document content and PII are NEVER included in audit events (per L3-006).

The `kyc_audit_events` table stores KYC-specific events. It is NOT the general `audit_events`
table — KYC audit is its own table for retention and data classification reasons.

### Veriff (Production KYC Provider)

Veriff uses a session-based flow:
- Create session → receive session URL and ID.
- User completes verification in Veriff's hosted flow.
- Veriff sends `decision` webhook (HMAC-SHA256 signed) with outcome.

For MMF, the Veriff adapter is behind the `KycVerificationPort` interface.
The `MOCK_KYC=true` environment variable selects the stub adapter at composition root level.

---

## Database

### Migration Convention

- Location: `db/migrations/`
- Naming: `YYYYMMDDHHMMSS_description.sql`
- Format: dbmate format with `-- migrate:up` and `-- migrate:down` sections
- Wrap in `BEGIN; ... COMMIT;`
- Append-only: never modify existing migrations

### Existing Migrations

| Timestamp | Description |
|-----------|-------------|
| 20260305120000 | `add_updated_at_trigger` — creates `update_updated_at_column()` trigger function |

### Schema Conventions

- Monetary: `BIGINT` (integer cents), never FLOAT
- Timestamps: `TIMESTAMPTZ`, never bare `TIMESTAMP`
- All tables: `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `updated_at` auto-update trigger (using the `update_updated_at_column()` function already created)
- Index on every FK column
- Index on columns used in WHERE/ORDER BY
- Explicit `ON DELETE` on every FK
- CHECK constraints for domain invariants

---

---

## Campaign Domain

### Campaign State Machine (Full L4-002)

Twelve states total. feat-003 implements the first segment only (Draft through Live):

| State | Terminal? | feat-003 scope? |
|-------|-----------|----------------|
| `draft` | No | Yes |
| `submitted` | No | Yes |
| `under_review` | No | Yes |
| `approved` | No | Yes |
| `rejected` | No | Yes |
| `live` | No | Yes (launch transition only) |
| `funded` | No | Future feature |
| `suspended` | No | Future feature |
| `failed` | Yes | Future feature |
| `settlement` | No | Future feature |
| `complete` | Yes | Future feature |
| `cancelled` | Yes | Future feature |

### Campaign State Transitions (feat-003 scope)

| From | To | Actor | Conditions |
|------|----|-------|-----------|
| (new) | `draft` | Creator | Creator role + KYC verified |
| `draft` | `draft` | Creator | Auto-save (partial update, no validation) |
| `draft` | `submitted` | Creator | All required fields valid; milestone % sum = 100%; deadline 1 week–1 year from now |
| `submitted` | `under_review` | Reviewer | Reviewer claims from FIFO queue (atomic: conditional WHERE) |
| `under_review` | `approved` | Reviewer | Written approval notes required |
| `under_review` | `rejected` | Reviewer | Written rationale AND resubmission guidance required |
| `rejected` | `draft` | Creator | Creator chooses to revise; prior data preserved |
| `approved` | `live` | Creator | Launch action; triggers escrow creation (future) |

### Campaign Required Fields (submission validation)

All fields are optional at draft save time, required at submission time:

| Field | Type | Constraint |
|-------|------|-----------|
| `title` | TEXT | max 100 chars, non-empty |
| `summary` | TEXT | max 280 chars, non-empty |
| `description` | TEXT | max 10,000 chars, non-empty |
| `alignmentStatement` | TEXT | max 1,000 chars — "How does this contribute to Mars?" |
| `category` | TEXT | one of 10 fixed categories (see below) |
| `heroImageUrl` | TEXT | `https://` URL only, max 2048 chars |
| `fundingGoalCents` | string (BIGINT) | min 100,000,000 (= $1M), max 100,000,000,000 (= $1B) |
| `fundingCapCents` | string (BIGINT) | >= fundingGoalCents |
| `deadline` | TIMESTAMPTZ | 7 days to 1 year from submission timestamp |
| `teamMembers` | JSONB array | min 1, max 20 members |
| `milestones` | JSONB array | min 2, max 10; percentages sum to 100% (basis points: 10000) |
| `riskDisclosures` | JSONB array | min 1, max 10 |
| `budgetBreakdown` | JSONB array | max 20 line items |

### Campaign Categories (10 fixed values, L4-002 Section 4.4)

Stored as TEXT with CHECK constraint:

```
'propulsion', 'entry_descent_landing', 'power_energy', 'habitats_construction',
'life_support_crew_health', 'food_water_production', 'in_situ_resource_utilisation',
'radiation_protection', 'robotics_automation', 'communications_navigation'
```

### Milestone Structure

Each milestone in the JSONB array:

```typescript
interface Milestone {
  title: string;            // max 100 chars
  description: string;      // max 500 chars
  targetDate: string;       // ISO 8601 date string
  fundingBasisPoints: number; // integer 1–10000; all milestones must sum to 10000
  verificationCriteria: string; // max 1,000 chars
}
```

Using basis points (not whole percentages) avoids the 33+33+34 rounding problem with
three equal milestones.

### Campaign Monetary Values

- All monetary amounts stored as `BIGINT` (integer cents) in PostgreSQL.
- API accepts and returns monetary amounts as **strings** (to avoid JSON number precision loss).
- PostgreSQL's `pg` library returns `BIGINT` columns as JavaScript strings automatically —
  do NOT cast to Number.
- Display formatting is frontend responsibility using `Intl.NumberFormat`.

### Campaign Access Control Matrix

| State | Creator (own) | Other Creator | Reviewer | Admin | Public |
|-------|--------------|--------------|---------|-------|--------|
| `draft` | Read + Write | 404 | 404 | Read | 404 |
| `submitted` | Read | 404 | Read | Read | 404 |
| `under_review` | Read | 404 | Read | Read | 404 |
| `approved` | Read + Launch | 404 | Read | Read | 404 |
| `rejected` | Read + Revise | 404 | Read | Read | 404 |
| `live` and beyond | Read | Read | Read | Read | Read |

### Campaign Bounded Context Directory

```
packages/backend/src/campaign/
├── domain/
│   ├── models/campaign.ts
│   ├── value-objects/campaign-status.ts
│   ├── value-objects/campaign-category.ts
│   └── errors/campaign-errors.ts
├── ports/campaign-repository.port.ts
├── adapters/
│   ├── pg-campaign-repository.adapter.ts
│   └── in-memory-campaign-repository.adapter.ts
├── application/campaign-app-service.ts
└── api/
    ├── campaign-router.ts
    ├── campaign-serializer.ts
    └── schemas/
```

### Campaign KYC and Role Gate

Campaign creation AND submission require BOTH:
1. `user.roles.includes('creator')` — true
2. `user.kycStatus === 'verified'` — true

Error codes:
- Missing Creator role: `CREATOR_ROLE_REQUIRED`, HTTP 403
- KYC not verified: `KYC_NOT_VERIFIED`, HTTP 403 (same error code from feat-002)

The campaign application service checks both via `UserRepository.findByClerkUserId()`.
It does NOT call the KYC application service directly.

### Campaign Audit Events Table

`campaign_audit_events` — follows same pattern as `kyc_audit_events`:

```sql
CREATE TABLE IF NOT EXISTS campaign_audit_events (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id           UUID        NOT NULL REFERENCES campaigns(id) ON DELETE RESTRICT,
  actor_user_id         UUID        REFERENCES users(id) ON DELETE SET NULL,
  actor_clerk_user_id   TEXT        NOT NULL,
  action                TEXT        NOT NULL,
  previous_status       TEXT,
  new_status            TEXT,
  rationale             TEXT,
  metadata              JSONB,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Audit events for campaigns:
- `campaign.created` — Draft created
- `campaign.updated` — Draft auto-saved
- `campaign.submitted` — Draft → Submitted
- `campaign.claimed` — Submitted → Under Review (reviewer assigned)
- `campaign.approved` — Under Review → Approved
- `campaign.rejected` — Under Review → Rejected
- `campaign.revised` — Rejected → Draft
- `campaign.launched` — Approved → Live
- `campaign.reassigned` — Admin changes reviewer while Under Review

### Review Queue Ordering

The review queue is FIFO (oldest submitted_at first). The `GET /campaigns/review-queue`
endpoint returns campaigns in `submitted` state ordered by `submitted_at ASC`.

A reviewer claiming a campaign transitions it to `under_review` atomically using a conditional
WHERE clause (`WHERE id = $1 AND status = 'submitted'`). If two reviewers claim simultaneously,
the second receives a 409 conflict.

### `AuditLoggerPort` Resource Type Union

The `resourceType` field in `AuditEntry` (in `audit-logger.port.ts`) must be extended to
include `'campaign'` when campaign audit events are introduced:

```typescript
readonly resourceType: 'user' | 'kyc' | 'campaign';
```

---

## Testing

### Clerk Mock Strategy

For Vitest integration tests, mock `@clerk/express` to bypass real JWT validation:

```typescript
vi.mock('@clerk/express', () => ({
  clerkMiddleware: () => (req, _res, next) => next(),
  requireAuth: () => (req, res, next) => {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } })
    }
    next()
  },
  getAuth: (req) => req.auth ?? { userId: null }
}))
```

Inject auth state per test by setting `req.auth` via a test-only middleware that reads `x-test-user-id` header.
Never use real Clerk tokens in unit or integration tests.

### Test Data Conventions

- Use realistic Clerk user IDs in test data: `user_test_` prefix + deterministic suffix (e.g., `user_test_backer01`, `user_test_admin01`)
- Avoid round numbers for monetary amounts (per backend rules)
- Use realistic names and emails in seed data




























