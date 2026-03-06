# Domain Knowledge

> Accumulated domain knowledge from research cycles. Updated by Spec Researcher agents.

---

## Infrastructure & Monorepo (feat-001)

### npm Workspaces

npm workspaces (npm 7+) hoist all dependencies to the root `node_modules` and allow cross-workspace `npm run` via `--workspace=packages/backend` flags.
The root `package.json` declares `"workspaces": ["packages/*"]`.
All installs should be run from the repo root using `--workspace=` flags to ensure correct hoisting.

### TypeScript Configuration Hierarchy

The repo uses a two-tier tsconfig pattern:
- `/workspace/tsconfig.base.json` — shared strict settings; already exists and is fully configured.
- `packages/*/tsconfig.json` — package-specific overrides; extend the base via `"extends": "../../tsconfig.base.json"`.

The base already enables: `strict: true`, `noUnusedLocals`, `noUnusedParameters`, `noUncheckedIndexedAccess`, `isolatedModules`.
`noUncheckedIndexedAccess` makes array element access return `T | undefined` — every `items[0]` needs a null check.

The base uses `"moduleResolution": "bundler"`.
Backend packages must override this to `"node16"` because they run directly in Node.js via `tsx`, not through a bundler.

### Tailwind CSS v4

The spec mandates Tailwind CSS v4 (L3-008).
Tailwind v4 eliminates `tailwind.config.js` — configuration is done via `@theme` blocks in CSS.
Do not use Tailwind v3 patterns (config file, `tailwind.config.js`, `@apply` with JIT, separate config object).

### Express 5

Express 5 (the mandated version) automatically catches rejected promises from async route handlers and passes them to error middleware.
No `asyncHandler` wrapper is needed.
Several Express 4 APIs have been removed.
Do not copy Express 4 scaffold patterns from older tutorials.

### Pino Logging

`pino-pretty` must be installed as a `devDependency` and loaded conditionally:
```ts
transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined
```

Biome's `noConsole` rule is set to `"error"` globally — `console.log` is a lint error.
Use Pino from the first line of backend code, even in the minimal scaffold.

### Runtime Environment

The agent runtime has PostgreSQL at `postgres:5432` (hostname `postgres`, not `localhost`).
`DATABASE_URL` is pre-set in the environment.
Human developer machines use `localhost:5432` (via docker-compose).
The `.env` and `.env.example` files handle both cases — never hardcode connection strings.

### Health Check

Per L2-002 Section 5.4, `/health` is the sole endpoint exempt from authentication.
It must be mounted before auth middleware.
Response should be JSON `{"status": "ok"}` for consistency with API conventions.

### Vite Environment Variables

Only env vars prefixed with `VITE_` are exposed to client-side code by Vite.
Backend secrets (`DATABASE_URL`, `CLERK_SECRET_KEY`, etc.) must never use the `VITE_` prefix.

---

## Database Schema (feat-002)

### dbmate Migration Format

dbmate applies migrations in filename timestamp order.
Files must be named `YYYYMMDDHHMMSS_description.sql` and contain exactly one `-- migrate:up` and one `-- migrate:down` section marker.
dbmate manages the `schema_migrations` table automatically — never create or modify it manually.
The `-- migrate:up` section does NOT need to be idempotent (dbmate will not re-run an applied migration).
All `-- migrate:up` sections must be wrapped in `BEGIN; ... COMMIT;` to make each migration atomic.

### The `update_updated_at_column()` Trigger Function

Migration `20260305120000_add_updated_at_trigger.sql` already exists and creates the `update_updated_at_column()` PL/pgSQL function.
Each table with an `updated_at` column must separately bind a `CREATE TRIGGER` to this function.
Trigger naming convention: `set_<table>_updated_at`.
Running the down migration for `20260305120000` will fail if any table triggers still reference the function — all table migrations must be rolled back first.

### UUID Generation Strategy

Per the feat-002 feature brief, UUIDs are generated at the application layer, not by the database.
Columns use `UUID PRIMARY KEY` with no `DEFAULT gen_random_uuid()`.
This allows domain entities to know their own ID before persistence, supporting the hexagonal architecture pattern.

### Monetary Columns

All monetary values are stored as BIGINT (integer cents) — never NUMERIC, FLOAT, DOUBLE, or REAL.
Maximum campaign cap is $1,000,000,000 USD = 100,000,000,000 cents — fits within BIGINT range.
Minimum campaign funding goal is $1,000,000 USD = 100,000,000 cents.

### Escrow Ledger Design

The `escrow_ledger` table is append-only and has no `updated_at` column.
Valid `entry_type` values: `contribution`, `disbursement`, `refund`, `interest`.
Escrow balance is calculated as: contributions + interest credits minus disbursements + refunds.
Store all `amount_cents` as positive values; the `entry_type` determines whether it is a credit or debit.

### Schema Status Column Pattern

All status/lifecycle columns use the text enum pattern (text column + CHECK constraint listing valid values).
No PostgreSQL enum type is used — text + CHECK is easier to evolve (ALTER TABLE to update CHECK vs. ALTER TYPE for enum).
Every status column must have an explicit CHECK constraint — silent insertion of invalid status values is a known risk without it.

### Soft Delete Pattern

The platform never hard-deletes user rows.
GDPR erasure is accomplished by nulling PII fields (email, display_name, etc.) and setting `account_status = 'deleted'`.
Physical row deletion does not occur — KYC and financial records are retained per AML/CTF requirements even after account closure.
`ON DELETE CASCADE` on `kyc_verifications.user_id` is likely safe in practice because the users row is never physically deleted.

### Denormalised `amount_raised_cents` Counter

`campaigns.amount_raised_cents` is a denormalised counter incremented by the application on each captured contribution.
It is not automatically consistent — the application must maintain it.
The authoritative source of truth for total raised is `SUM` of captured contributions, but the counter is used for performance on listing queries.
A `CHECK (amount_raised_cents >= 0)` constraint prevents negative values from data inconsistency.

### Cross-Context Foreign Keys

All five bounded contexts share a single PostgreSQL database and schema in the local demo.
Foreign keys cross bounded contexts: `contributions.donor_id → users`, `campaigns.creator_id → users`, etc.
No separate schema-per-domain isolation is applied in the local demo.

---

## Authentication / Clerk (feat-003)

### Clerk Package Landscape

Two backend packages exist for Clerk integration with Node.js:

- `@clerk/express` — current recommended package.
  Provides `clerkMiddleware()` (global) and `requireAuth()` (route-level) as Express-native middleware.
  `getAuth(req)` extracts the verified auth state inside handlers.
- `@clerk/clerk-sdk-node` — legacy package, lower-level, requires manual token verification.

The feature brief (feat-003) names `@clerk/clerk-sdk-node` but `@clerk/express` is the better choice for Express 5.
All future auth-related research should assume `@clerk/express` unless overridden by a spec decision.

### Clerk User ID Format

Clerk user IDs are strings of the form `user_<alphanumeric>` (e.g., `user_2NNEqL2nrIRdJ194ndJqAHwjfxe`).
They are not UUIDs.
They are stored in `users.clerk_id` (TEXT, UNIQUE).
The JWT `sub` claim contains the Clerk user ID.

### Email in Clerk JWT

By default, the Clerk JWT does not include the user's email address.
To get email during lazy sync, either:
1. Configure a custom JWT template in the Clerk Dashboard to add `email` as a claim (one-time setup; no extra API call at runtime), or
2. Call the Clerk Backend API: `GET https://api.clerk.com/v1/users/{clerk_user_id}` with `Authorization: Bearer <CLERK_SECRET_KEY>`.

Option 1 (custom JWT template) is preferred for the demo — no extra API round-trip on first login.

### Clerk JWT Lifetime

Clerk access tokens have a default lifetime of **60 seconds** (much shorter than a typical OAuth token).
The frontend Clerk SDK auto-refreshes tokens transparently.
The backend must verify the JWT on every request — never cache auth decisions based on a token.

### Lazy Sync Pattern

MMF uses lazy sync (not Clerk webhooks) to populate the `users` table.
On the first authenticated request from a new Clerk user:
1. Auth middleware verifies the Clerk JWT and extracts `clerkId`.
2. Middleware queries `users` for `clerk_id = clerkId`.
3. If not found: generate a UUID for `users.id` via `crypto.randomUUID()`, insert a `users` row, and insert a `user_roles` row with `role = 'backer'` (both in a single transaction).
4. Populate `req.auth` with `{ userId, clerkId, roles }`.

The upsert for `users` uses `ON CONFLICT (clerk_id) DO UPDATE SET email = EXCLUDED.email, updated_at = NOW()`.
The upsert for `user_roles` uses `ON CONFLICT (user_id, role) DO NOTHING`.
Both operations must be in a single database transaction to prevent partial state from concurrent first-login requests.

### `req.auth` Type Augmentation

Express's `Request` type does not include an `auth` property by default.
The `AuthContext` type must be declared via module augmentation:

```typescript
declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}
```

Without this, TypeScript will error on every `req.auth` access in route handlers.

### `MOCK_AUTH=true` Flag

The `.env.example` includes `MOCK_AUTH=true`.
When this flag is set, the auth middleware must bypass Clerk JWT verification and inject a pre-configured test `AuthContext` into `req.auth`.
This is required for integration tests that cannot call the real Clerk API.
The mock user identity should be a stable, deterministic test user with known `userId`, `clerkId`, and `roles`.

### `users.id` is Application-Generated

Per the UUID generation strategy (domain-knowledge.md, feat-002 section), `users.id` has no `DEFAULT gen_random_uuid()` in the schema.
The lazy sync code must call `crypto.randomUUID()` (Node.js 22.x built-in) before the INSERT and pass the UUID as a parameter.
Do not rely on the database to generate this value.

### Account Status Gating in Auth Middleware

After the DB lookup, the auth middleware must check `users.account_status`:
- `active` → proceed, populate `req.auth`.
- `suspended` → return HTTP 403, error code `ACCOUNT_SUSPENDED`.
- `deactivated` → return HTTP 403, error code `ACCOUNT_DEACTIVATED`.
- `deleted` → return HTTP 403, error code `ACCOUNT_DELETED`.
- `pending_verification` → the lazy sync sets `active` directly (Clerk already verified email for most flows), so this state should not normally appear for users arriving via Clerk JWT. If it does, treat as 403.

### Security Headers for Clerk

The CSP defined in L3-002 (Section 7.2) includes `connect-src 'self' https://*.clerk.accounts.dev`.
This is required because Clerk's frontend SDK communicates with Clerk's API domain.
Without this `connect-src` entry, Clerk's components will fail under a strict CSP.
The backend must set this header on all responses (use `helmet` or manual middleware).

### Frontend Environment Variables

| Variable | Scope | Notes |
|----------|-------|-------|
| `VITE_CLERK_PUBLISHABLE_KEY` | Frontend (exposed via Vite) | Starts with `pk_test_` or `pk_live_`. Safe to expose in client bundle. |
| `CLERK_SECRET_KEY` | Backend only | Never prefix with `VITE_`. Exposing this in the frontend bundle would be a critical security incident. |
| `CLERK_PUBLISHABLE_KEY` | Backend only | Used by `@clerk/express` for token issuer validation. Not required by frontend separately. |
| `CLERK_WEBHOOK_SIGNING_SECRET` | Backend only | For webhook verification (not used in feat-003 lazy sync pattern). |
