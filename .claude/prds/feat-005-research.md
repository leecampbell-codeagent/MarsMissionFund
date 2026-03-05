# feat-005 Research: Campaign Creation (Draft & Submit)

## 1. Feature Brief Summary

Campaign creation is the core value-creation flow for project creators on Mars Mission Fund. It covers the **Draft** and **Submitted** states of the campaign state machine. Key points:

- Creators can draft campaigns without KYC; submission requires KYC `verified`
- Multi-step guided form with 6 required sections: Mission Objectives, Team Credentials, Funding, Milestone Plan, Risk Disclosures, Media
- Draft auto-save, multiple simultaneous drafts, no expiry
- Submission triggers full validation
- Campaign categories: 10-category taxonomy (see L4-002, Section 4.4)
- Funding: min $1M (100000000 cents), max $1B (100000000000 cents)
- Deadline: 1 week to 1 year from submission
- Milestones: at least 2, funding percentages sum to 100%

## 2. Domain Entity Analysis

### Campaign Entity (from DB migration + spec)

**campaigns table** (`db/migrations/20260304000004_create_campaigns.sql`):
- `id` UUID PK
- `creator_id` UUID FK -> accounts.id
- `title` TEXT NOT NULL
- `summary` VARCHAR(280) - optional in draft
- `description` TEXT - optional in draft
- `category` TEXT NOT NULL - checked enum
- `status` TEXT NOT NULL DEFAULT 'draft' - checked enum (12 states)
- `min_funding_target_cents` BIGINT NOT NULL
- `max_funding_cap_cents` BIGINT NOT NULL
- `deadline` TIMESTAMPTZ - nullable (set at submission or later)
- `created_at`, `updated_at` TIMESTAMPTZ

**milestones table** (`db/migrations/20260304000005_create_milestones.sql`):
- `id` UUID PK
- `campaign_id` UUID FK -> campaigns.id ON DELETE CASCADE
- `title` TEXT
- `description` TEXT
- `target_date` TIMESTAMPTZ
- `funding_percentage` INTEGER (0-100)
- `verification_criteria` TEXT
- `status` TEXT NOT NULL DEFAULT 'pending' (pending/verified/returned)
- `created_at`, `updated_at` TIMESTAMPTZ

Note: milestones table uses nullable columns — they are optional during draft, required at submission. The milestone entity does **not** have a `sequence` column in the DB — ordering is implicit by `target_date` or insertion order.

### Campaign State Machine (feat-005 scope)
Only `draft` → `submitted` transitions are in scope. The full state machine (12 states) is defined in L4-002 but other transitions are future features.

## 3. Lifecycle & Validation Rules

### Draft State
- All fields optional except: `title`, `category`, `min_funding_target_cents`, `max_funding_cap_cents` (required at creation)
- Can be updated any number of times
- Multiple simultaneous drafts per creator allowed

### Submission Validation (L4-002, Section 4.5)
- All required fields present and non-empty
- `min_funding_target_cents` ≥ 100000000 (=$1M) and ≤ 100000000000 (=$1B)
- `max_funding_cap_cents` ≥ `min_funding_target_cents`
- At least 2 milestones
- Milestone funding percentages sum to 100%
- Deadline at least 1 week (7 days) from submission date
- Deadline at most 1 year (365 days) from submission date
- Creator must have KYC status = `verified`
- At least one risk disclosure (from brief AC)
- At least one team member (from brief AC)

### Brief vs spec discrepancy
The PRD brief specifies more fields (Team Credentials, Risk Disclosures, Media) but the DB migration only has the core fields. For MVP implementation, we focus on what the DB has plus a JSON/text approach for the additional fields. The brief notes "Budget breakdown is free-form text for MVP."

## 4. API Contracts

Per L4-002 and feat-005 brief:

| Endpoint | Method | Purpose |
|---|---|---|
| `POST /api/v1/campaigns` | Create draft | Creates new campaign in draft state |
| `GET /api/v1/campaigns/mine` | List creator's campaigns | Returns campaigns for authenticated creator |
| `GET /api/v1/campaigns/:id` | Get campaign by ID | Returns campaign detail (creator-scoped for drafts) |
| `PATCH /api/v1/campaigns/:id` | Update draft | Updates draft fields only |
| `POST /api/v1/campaigns/:id/submit` | Submit for review | KYC gate + full validation + state transition |

Note from brief: `GET /v1/campaigns?status=draft` — using `GET /campaigns/mine` pattern (as specified in task) instead of query param. The `mine` route must be registered **before** `/:id` to avoid param collision.

## 5. KYC Integration Pattern

Looking at existing code:
- `KycAppService.getVerificationStatus(userId)` returns a `KycStatusResult` with `status` field
- The campaign service needs to check if status is `'verified'`
- Pattern: `KycStatusPort` interface with `getVerificationStatus(accountId): Promise<{ status: string }>` implemented by reading from kyc_verifications table (or calling KycAppService)

## 6. Existing Code Patterns

### Domain Entity Pattern (from account.ts, kyc-verification.ts)
- Private constructor
- Static `create()` with validation
- Static `reconstitute()` without validation
- All properties `readonly` via getter
- Mutation returns new instances
- Extends `DomainError` for errors

### Repository Pattern (from kyc-repository.ts, pg-kyc-repository.ts)
- Interface in `ports/`
- InMemory implementation for tests
- PgRepository for production
- Raw parameterised SQL via `pg`

### Application Service Pattern (from kyc-app-service.ts)
- Constructor injection of ports
- Emit events to event store for state mutations
- Return plain data DTOs (not domain objects)

### Router Pattern (from kyc-router.ts)
- Zod validation at boundary
- `req.authContext.userId` for user identity
- Standard error format `{ error: { code, message, correlation_id } }`
- Domain errors mapped to HTTP status codes

### Event Store Usage
- `eventStore.getNextSequenceNumber(aggregateId)` then `eventStore.append(...)`
- `aggregateType` = noun (e.g., 'campaign')
- `eventType` = `'<domain>.<action>'` (e.g., `'campaign.draft_created'`)

### Composition Root Pattern
- `composition-root.ts` wires dependencies
- `AppDependencies` interface in `app.ts`
- Router registered in `app.ts`

## 7. Frontend Patterns

### Hook Pattern (from use-kyc-status.ts)
- `useQuery` for reads (TanStack Query)
- `useMutation` for writes
- `useApiClient()` for auth-injected fetch

### API Client Pattern (from kyc-api.ts)
- Types defined in `src/api/<domain>-api.ts`
- Monetary amounts as strings in API responses

### Page Pattern (from settings-verification.tsx)
- Default export page components
- CSS-in-JS with `<style>` tag
- Semantic tokens only (Tier 2): `var(--color-bg-page)`, `var(--font-display)`, etc.
- Handle loading, error, empty states
- `<button>` not `<div onClick>`

## 8. Missing DB Columns for Full Brief Compliance

The brief mentions fields not in the current DB schema:
- Team members (name, role, bio)
- Risk disclosures
- Media/hero image
- Budget breakdown
- Mars-alignment statement
- Tags

For MVP (feat-005): implement with the existing DB columns plus a `mars_alignment_statement` and `budget_breakdown` as additional text fields. For team members, risk disclosures, and media — these would require additional migrations. Given the task scope focuses on `draft → submitted` with the DB as-is, we'll use extended JSON fields stored as TEXT or add additional columns.

**Decision**: Add a new migration to extend the campaigns table with: `mars_alignment_statement TEXT`, `budget_breakdown TEXT`, `risk_disclosures TEXT` (JSON array as text for MVP), `team_info TEXT` (JSON as text for MVP), `hero_image_url TEXT`. This keeps MVP implementable while spec-compliant.

## 9. Event Types

Following the `'<domain>.<action>'` pattern:
- `campaign.draft_created`
- `campaign.draft_updated`
- `campaign.submitted`

## 10. Edge Cases

- Creator submits then tries to update: must fail with `CampaignAlreadySubmittedError`
- Creator tries to submit someone else's campaign: must fail with `CampaignNotFoundError` (user-scoped query)
- Creator tries to submit without KYC: must fail with `KycRequiredError`
- Two milestones with percentages that don't sum to 100: must fail with `InvalidCampaignError`
- Deadline in the past or less than 7 days: must fail
- Goal amount below $1M: must fail at submission
- Non-creator role tries to create: the DB enforces `creator_id` FK but the app should check role
- Empty milestone list: must fail at submission (need >= 2)

## 11. Interface with feat-006 (Campaign Review)

feat-005 produces:
- Campaigns in `submitted` state in the DB
- `campaign.submitted` event in the event store with `{ campaignId, creatorId, submittedAt }`

feat-006 will:
- Read from campaigns table WHERE status = 'submitted'
- Transition campaigns from submitted → under_review

The `CampaignRepository` interface must expose methods that feat-006 can extend without modification.
