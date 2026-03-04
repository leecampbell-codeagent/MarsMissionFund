# Domain Knowledge

> Accumulated domain knowledge from implementation cycles. Updated by agents as they learn.

## Key Domain Concepts

- **Campaign**: A crowdfunding campaign for a Mars mission project. Has a funding goal (USD cents), deadline, and milestones.
- **Contribution**: A backer's financial contribution to a campaign. Amount in USD integer cents.
- **Escrow**: Segregated holding of campaign funds. One escrow account per campaign. Ledger entries are append-only and immutable.
- **Milestone**: A campaign checkpoint that triggers fund disbursement when verified.
- **Disbursement**: Release of escrowed funds to campaign creator. Requires dual admin approval.

## Financial Rules

- Single currency: USD
- All amounts stored as integer cents (minor units)
- JSON serialisation: amounts as strings, never numbers
- No floating point arithmetic for money — ever
- Escrow ledger is append-only and immutable

## User Roles

- **Backer**: Browses campaigns, makes contributions, tracks funded projects
- **Creator**: Creates and manages campaigns, submits milestones
- **Reviewer**: Reviews campaign proposals against curation criteria before campaigns go live
- **Administrator**: Platform management, campaign moderation
- **Super Administrator**: Full system access, disbursement final approval

## Event Sourcing / CQRS

- **Event store**: Single `events` table in PostgreSQL, shared by domain events and audit events
- **Event envelope**: `event_id`, `event_type`, `aggregate_id`, `aggregate_type`, `sequence_number`, `timestamp`, `correlation_id`, `source_service`, `payload` (JSONB)
- **Primary key**: Composite `(aggregate_id, sequence_number)` — NOT `event_id`
- **Consumption model**: Pull-based with stored checkpoints; at-least-once delivery; all consumers must be idempotent
- **Read models**: Aggregate tables (`accounts`, `campaigns`, etc.) are materialised projections of the event stream
- **Write path**: Event insert + aggregate table update in the same transaction (transactional outbox within single DB)
- **Schema evolution**: Backward-compatible only — new payload fields may be added, existing fields never removed or changed

## Database Schema Conventions

- All PKs: `UUID DEFAULT gen_random_uuid()` (built-in since PostgreSQL 13, no extension needed)
- All monetary columns: `BIGINT` (integer cents) — never FLOAT/DOUBLE/NUMERIC
- All date columns: `TIMESTAMPTZ` — never TIMESTAMP without timezone
- Status columns: `TEXT` with `CHECK` constraint (not ENUM types — ENUMs are hard to alter in migrations)
- Roles: `TEXT[]` array type on accounts table (small fixed set, avoids join table)
- Event payloads: `JSONB` (not JSON) — supports indexing and efficient querying
- Every FK column must have an index
- Reusable `update_updated_at_column()` trigger function applied to all mutable tables
- Append-only tables (`events`, `escrow_ledger`): no `updated_at` column

## Escrow Ledger

- Append-only, immutable — no UPDATE or DELETE operations
- Entry types: `contribution`, `disbursement`, `refund`, `interest_credit`, `interest_debit`
- Balance is computed via SUM, not stored — sign convention derived from entry_type
- One logical escrow account per campaign (segregated)
- `amount_cents` is always positive; sign determined by entry_type in queries

## Authentication (Clerk)

- **Identity provider**: Clerk (OAuth 2.0 / OIDC), per L3-002 and L3-008
- **Clerk user ID**: Opaque string (`user_xxxx`) — maps to `accounts.clerk_user_id`
- **Internal identity**: `accounts.id` (UUID) — all domain operations use this, never the Clerk user ID directly
- **Frontend SDK**: `@clerk/clerk-react` — `ClerkProvider`, `SignIn`, `SignUp`, `useAuth()`, `useUser()`
- **Backend SDK**: `@clerk/express` — `clerkMiddleware()`, `getAuth(req)`, `clerkClient`
- **Token flow**: Frontend gets JWT via `useAuth().getToken()`, sends as `Authorization: Bearer <token>`, backend validates via `clerkMiddleware()`
- **Auth object**: `getAuth(req)` returns `{ userId, sessionId, sessionClaims, has(), getToken() }` — `userId` is null when unauthenticated
- **`requireAuth()` is for page redirects, NOT API routes** — use `clerkMiddleware()` + manual 401 check for APIs
- **Account sync**: JIT (just-in-time) creation on first authenticated request as primary path; webhooks (`user.created`, `user.updated`, `user.deleted`) for production reliability
- **Webhook verification**: Svix HMAC-SHA256 signature, at-least-once delivery, handlers must be idempotent
- **Environment variables**: `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` (backend), `VITE_CLERK_PUBLISHABLE_KEY` (frontend), `CLERK_WEBHOOK_SIGNING_SECRET` (webhooks)

## Infrastructure Conventions

- **Local dev**: Docker Compose stack with PostgreSQL 16, backend, frontend, dbmate
- **Database migrations**: dbmate (`ghcr.io/amacneil/dbmate`), files in `db/migrations/` at repo root
- **Logging**: Pino (structured JSON) with pino-http middleware, pino-pretty for dev only
- **Environment variables**: `.env` never committed; `.env.example` documents all vars with placeholders
- **Mock adapters**: `MOCK_[SERVICE]=true/false` env vars to toggle mock/real adapters
- **Package naming**: `@mmf/backend`, `@mmf/frontend` (npm workspace namespace)
