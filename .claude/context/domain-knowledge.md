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
