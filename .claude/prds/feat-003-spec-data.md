# PRD: feat-003 — Data Model & Domain Model

> Sub-file 2 of 4. Part of `feat-003-spec.md`.
> Contents: Database migrations, table definitions, domain entities, value objects, domain errors.

---

## Data Model

### Migration Timestamps

Existing migrations (from prior features):
| Timestamp | File |
|-----------|------|
| `20260305120000` | `add_updated_at_trigger.sql` |
| `20260305130000` | `create_users_table.sql` |
| `20260305140000` | `kyc_rename_failed_to_rejected.sql` |
| `20260305141000` | `create_kyc_audit_events_table.sql` |

feat-003 adds:
| Timestamp | File |
|-----------|------|
| `20260305150000` | `create_campaigns_table.sql` |
| `20260305151000` | `create_campaign_audit_events_table.sql` |

---

### New Tables

#### `campaigns`

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `UUID` | NOT NULL | `gen_random_uuid()` | Primary key |
| `creator_user_id` | `UUID` | NOT NULL | — | FK to `users.id`. ON DELETE RESTRICT (G-027) |
| `title` | `VARCHAR(200)` | NOT NULL | — | Campaign title. Max 200 chars. Non-empty. |
| `short_description` | `VARCHAR(500)` | NULL | `NULL` | Short description shown in cards. Max 500 chars. Required at submission. |
| `description` | `TEXT` | NULL | `NULL` | Full plain-text description. Max 10,000 chars. Required at submission. (G-028) |
| `category` | `TEXT` | NULL | `NULL` | One of 10 fixed categories. Required at submission. |
| `hero_image_url` | `TEXT` | NULL | `NULL` | External `https://` URL only. Optional at submission. Max 2048 chars. |
| `funding_goal_cents` | `BIGINT` | NULL | `NULL` | Minimum funding target in integer cents. Required at submission. Min 100,000,000 ($1M). |
| `funding_cap_cents` | `BIGINT` | NULL | `NULL` | Maximum funding cap in integer cents. Required at submission. >= `funding_goal_cents`. |
| `deadline` | `TIMESTAMPTZ` | NULL | `NULL` | Campaign end date. Required at submission. 7–365 days from submission timestamp. |
| `milestones` | `JSONB` | NOT NULL | `'[]'::JSONB` | Array of milestone objects (see structure below). |
| `team_members` | `JSONB` | NOT NULL | `'[]'::JSONB` | Array of team member objects. Min 1 at submission. Max 20. |
| `risk_disclosures` | `JSONB` | NOT NULL | `'[]'::JSONB` | Array of risk disclosure objects. Min 1 at submission. Max 10. |
| `budget_breakdown` | `JSONB` | NOT NULL | `'[]'::JSONB` | Array of budget line items. Max 20 at submission. Optional. |
| `alignment_statement` | `TEXT` | NULL | `NULL` | "How does this contribute to Mars?" Max 1,000 chars. Required at submission. |
| `tags` | `TEXT[]` | NOT NULL | `ARRAY[]::TEXT[]` | Free-form discoverable tags. Max 20 tags, each max 50 chars. Optional. |
| `status` | `TEXT` | NOT NULL | `'draft'` | Campaign lifecycle state. CHECK constraint (see below). |
| `rejection_reason` | `TEXT` | NULL | `NULL` | Populated by reviewer on rejection. |
| `resubmission_guidance` | `TEXT` | NULL | `NULL` | Guidance for creator on how to fix and resubmit. |
| `review_notes` | `TEXT` | NULL | `NULL` | Reviewer's approval notes. Populated on approval. |
| `reviewed_by_user_id` | `UUID` | NULL | `NULL` | FK to `users.id`. Set when reviewer claims campaign. ON DELETE SET NULL. |
| `reviewed_at` | `TIMESTAMPTZ` | NULL | `NULL` | Timestamp of approval or rejection decision. |
| `submitted_at` | `TIMESTAMPTZ` | NULL | `NULL` | Timestamp of most recent submission. Updated on resubmission. |
| `launched_at` | `TIMESTAMPTZ` | NULL | `NULL` | Timestamp of Live transition. |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | Row creation timestamp. |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | Last update timestamp. Auto-updated by trigger. |

**`status` CHECK constraint values:**

```
'draft', 'submitted', 'under_review', 'approved', 'rejected', 'live',
'funded', 'suspended', 'failed', 'settlement', 'complete', 'cancelled', 'archived'
```

Future states (`funded`, `suspended`, `failed`, `settlement`, `complete`, `cancelled`) are included in the CHECK constraint for forward-compatibility but are not transitioned to by feat-003 application logic.

**`category` CHECK constraint values:**

```
'propulsion', 'entry_descent_landing', 'power_energy', 'habitats_construction',
'life_support_crew_health', 'food_water_production', 'in_situ_resource_utilisation',
'radiation_protection', 'robotics_automation', 'communications_navigation'
```

**Indexes:**

| Index Name | Column(s) | Reason |
|------------|-----------|--------|
| `idx_campaigns_creator_user_id` | `creator_user_id` | Creator's campaign list (`GET /me/campaigns`) |
| `idx_campaigns_status` | `status` | Review queue filter (`WHERE status = 'submitted'`) |
| `idx_campaigns_submitted_at` | `submitted_at` | FIFO ordering in review queue |
| `idx_campaigns_reviewed_by_user_id` | `reviewed_by_user_id` | Reviewer's assigned campaigns lookup |

**Constraints:**

| Constraint | Definition |
|------------|------------|
| `PRIMARY KEY` | `id` |
| `FOREIGN KEY creator_user_id` | `creator_user_id → users(id)` ON DELETE RESTRICT |
| `FOREIGN KEY reviewed_by_user_id` | `reviewed_by_user_id → users(id)` ON DELETE SET NULL |
| `CHECK status` | `status IN ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'live', 'funded', 'suspended', 'failed', 'settlement', 'complete', 'cancelled', 'archived')` |
| `CHECK category` | `category IS NULL OR category IN ('propulsion', 'entry_descent_landing', 'power_energy', 'habitats_construction', 'life_support_crew_health', 'food_water_production', 'in_situ_resource_utilisation', 'radiation_protection', 'robotics_automation', 'communications_navigation')` |
| `CHECK description_length` | `description IS NULL OR length(description) <= 10000` |
| `CHECK funding_goal_positive` | `funding_goal_cents IS NULL OR funding_goal_cents > 0` |
| `CHECK funding_cap_gte_goal` | `funding_cap_cents IS NULL OR funding_goal_cents IS NULL OR funding_cap_cents >= funding_goal_cents` |
| `TRIGGER campaigns_updated_at` | `BEFORE UPDATE` — calls `update_updated_at_column()` |

**Note on `title` column:** `VARCHAR(200) NOT NULL` with default empty string is wrong — title is required at creation time (not optional). The `CREATE DRAFT` endpoint requires a non-empty title. This is enforced at the application layer via Zod schema requiring `title: z.string().trim().min(1).max(200)`.

**Note on JSONB field defaults:** `milestones`, `team_members`, `risk_disclosures`, and `budget_breakdown` default to empty arrays `'[]'::JSONB`. They are always JSONB, never NULL. The application layer updates them via full replacement (not JSONB merge).

---

#### JSONB Structure Definitions

##### Milestones Array Element

Each element of the `milestones` JSONB array:

```json
{
  "id": "<uuid string — generated client-side or server-side>",
  "title": "<string, max 200 chars>",
  "description": "<string, max 1000 chars>",
  "fundingBasisPoints": "<integer, 1–10000>",
  "targetDate": "<ISO 8601 date string, e.g. 2027-06-30>"
}
```

Constraints enforced at submission time:
- Array must have 2–10 elements (EC-004, EC-005, EC-038)
- Each `fundingBasisPoints` must be an integer ≥ 1 (EC-006)
- Sum of all `fundingBasisPoints` across all milestones must equal exactly 10000 (EC-002, EC-003, G-025)
- Each `title` max 200 chars, non-empty
- Each `description` max 1000 chars
- Each `targetDate` must be a valid ISO 8601 date string

##### Team Members Array Element

```json
{
  "id": "<uuid string>",
  "name": "<string, max 200 chars>",
  "role": "<string, max 200 chars — e.g. 'Propulsion Engineer'>",
  "bio": "<string, max 500 chars>"
}
```

Constraints: min 1 element (EC-012), max 20 elements (EC-037). All fields required per element.

##### Risk Disclosures Array Element

```json
{
  "id": "<uuid string>",
  "risk": "<string, max 500 chars>",
  "mitigation": "<string, max 500 chars>"
}
```

Constraints: min 1 element (EC-013), max 10 elements (EC-039). Both fields required per element.

##### Budget Breakdown Array Element

```json
{
  "id": "<uuid string>",
  "category": "<string, max 100 chars>",
  "description": "<string, max 500 chars>",
  "estimatedCents": "<string — integer cents as string, e.g. '5000000'>",
  "notes": "<string, max 200 chars, optional>"
}
```

Constraints: max 20 elements. `estimatedCents` is a string representing integer cents (G-024). Optional at submission.

---

#### `campaign_audit_events`

Stores immutable audit records for all campaign state transitions. Append-only — no UPDATE or DELETE.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `UUID` | NOT NULL | `gen_random_uuid()` | Primary key |
| `campaign_id` | `UUID` | NOT NULL | — | FK to `campaigns(id)`. ON DELETE RESTRICT — audit events must be preserved even if campaign is archived. |
| `actor_user_id` | `UUID` | NULL | `NULL` | FK to `users(id)`. NULL if user was hard-deleted (GDPR). ON DELETE SET NULL. |
| `actor_clerk_user_id` | `TEXT` | NOT NULL | — | Clerk user ID of actor. TEXT, not UUID (G-001). |
| `action` | `TEXT` | NOT NULL | — | Audit action code. See valid values below. |
| `previous_status` | `TEXT` | NULL | `NULL` | Campaign status before the transition. NULL for `campaign.created`. |
| `new_status` | `TEXT` | NOT NULL | — | Campaign status after the transition. |
| `rationale` | `TEXT` | NULL | `NULL` | Human-readable notes. Populated for approve/reject. |
| `metadata` | `JSONB` | NULL | `NULL` | Additional context (e.g., reviewer reassignment data). |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | Event timestamp. Immutable. |

**No `updated_at` column** — audit events are immutable.

**Valid `action` values:**

```
'campaign.created'     -- draft created
'campaign.updated'     -- draft auto-saved
'campaign.submitted'   -- draft → submitted (or rejected → submitted)
'campaign.claimed'     -- submitted → under_review
'campaign.approved'    -- under_review → approved
'campaign.rejected'    -- under_review → rejected
'campaign.launched'    -- approved → live
'campaign.archived'    -- any → archived
'campaign.reassigned'  -- reviewer changed while under_review
```

**Indexes:**

| Index Name | Column(s) | Reason |
|------------|-----------|--------|
| `idx_campaign_audit_campaign_id` | `campaign_id` | Lookup all events for a campaign |
| `idx_campaign_audit_created_at` | `created_at` | Time-range queries |
| `idx_campaign_audit_actor_user_id` | `actor_user_id` | Lookup actions by actor |

**Constraints:**

| Constraint | Definition |
|------------|------------|
| `PRIMARY KEY` | `id` |
| `FOREIGN KEY campaign_id` | `campaign_id → campaigns(id)` ON DELETE RESTRICT |
| `FOREIGN KEY actor_user_id` | `actor_user_id → users(id)` ON DELETE SET NULL |
| `CHECK action` | `action IN ('campaign.created', 'campaign.updated', 'campaign.submitted', 'campaign.claimed', 'campaign.approved', 'campaign.rejected', 'campaign.launched', 'campaign.archived', 'campaign.reassigned')` |

---

### Migration Files

#### `db/migrations/20260305150000_create_campaigns_table.sql`

```sql
-- migrate:up
BEGIN;

CREATE TABLE IF NOT EXISTS campaigns (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_user_id       UUID          NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title                 VARCHAR(200)  NOT NULL,
  short_description     VARCHAR(500),
  description           TEXT
                                      CHECK (description IS NULL OR length(description) <= 10000),
  category              TEXT
                                      CHECK (category IS NULL OR category IN (
                                        'propulsion',
                                        'entry_descent_landing',
                                        'power_energy',
                                        'habitats_construction',
                                        'life_support_crew_health',
                                        'food_water_production',
                                        'in_situ_resource_utilisation',
                                        'radiation_protection',
                                        'robotics_automation',
                                        'communications_navigation'
                                      )),
  hero_image_url        TEXT,
  funding_goal_cents    BIGINT        CHECK (funding_goal_cents IS NULL OR funding_goal_cents > 0),
  funding_cap_cents     BIGINT        CHECK (funding_cap_cents IS NULL OR funding_cap_cents > 0),
  deadline              TIMESTAMPTZ,
  milestones            JSONB         NOT NULL DEFAULT '[]'::JSONB,
  team_members          JSONB         NOT NULL DEFAULT '[]'::JSONB,
  risk_disclosures      JSONB         NOT NULL DEFAULT '[]'::JSONB,
  budget_breakdown      JSONB         NOT NULL DEFAULT '[]'::JSONB,
  alignment_statement   TEXT,
  tags                  TEXT[]        NOT NULL DEFAULT ARRAY[]::TEXT[],
  status                TEXT          NOT NULL DEFAULT 'draft'
                                      CHECK (status IN (
                                        'draft', 'submitted', 'under_review',
                                        'approved', 'rejected', 'live',
                                        'funded', 'suspended', 'failed',
                                        'settlement', 'complete', 'cancelled', 'archived'
                                      )),
  rejection_reason      TEXT,
  resubmission_guidance TEXT,
  review_notes          TEXT,
  reviewed_by_user_id   UUID          REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at           TIMESTAMPTZ,
  submitted_at          TIMESTAMPTZ,
  launched_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_campaigns_creator_user_id     ON campaigns (creator_user_id);
CREATE INDEX idx_campaigns_status              ON campaigns (status);
CREATE INDEX idx_campaigns_submitted_at        ON campaigns (submitted_at);
CREATE INDEX idx_campaigns_reviewed_by_user_id ON campaigns (reviewed_by_user_id);

CREATE TRIGGER campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;

-- migrate:down
BEGIN;

DROP TRIGGER IF EXISTS campaigns_updated_at ON campaigns;
DROP INDEX IF EXISTS idx_campaigns_reviewed_by_user_id;
DROP INDEX IF EXISTS idx_campaigns_submitted_at;
DROP INDEX IF EXISTS idx_campaigns_status;
DROP INDEX IF EXISTS idx_campaigns_creator_user_id;
DROP TABLE IF EXISTS campaigns;

COMMIT;
```

---

#### `db/migrations/20260305151000_create_campaign_audit_events_table.sql`

```sql
-- migrate:up
BEGIN;

CREATE TABLE IF NOT EXISTS campaign_audit_events (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id         UUID        NOT NULL REFERENCES campaigns(id) ON DELETE RESTRICT,
  actor_user_id       UUID        REFERENCES users(id) ON DELETE SET NULL,
  actor_clerk_user_id TEXT        NOT NULL,
  action              TEXT        NOT NULL
                                  CHECK (action IN (
                                    'campaign.created',
                                    'campaign.updated',
                                    'campaign.submitted',
                                    'campaign.claimed',
                                    'campaign.approved',
                                    'campaign.rejected',
                                    'campaign.launched',
                                    'campaign.archived',
                                    'campaign.reassigned'
                                  )),
  previous_status     TEXT,
  new_status          TEXT        NOT NULL,
  rationale           TEXT,
  metadata            JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_campaign_audit_campaign_id  ON campaign_audit_events (campaign_id);
CREATE INDEX idx_campaign_audit_created_at   ON campaign_audit_events (created_at);
CREATE INDEX idx_campaign_audit_actor_user_id ON campaign_audit_events (actor_user_id);

COMMIT;

-- migrate:down
BEGIN;

DROP INDEX IF EXISTS idx_campaign_audit_actor_user_id;
DROP INDEX IF EXISTS idx_campaign_audit_created_at;
DROP INDEX IF EXISTS idx_campaign_audit_campaign_id;
DROP TABLE IF EXISTS campaign_audit_events;

COMMIT;
```

---

## Domain Model

**Bounded context directory:** `packages/backend/src/campaign/`

### Value Objects

#### `CampaignStatus`

**File:** `packages/backend/src/campaign/domain/value-objects/campaign-status.ts`

```typescript
export const CampaignStatus = {
  Draft:       'draft',
  Submitted:   'submitted',
  UnderReview: 'under_review',
  Approved:    'approved',
  Rejected:    'rejected',
  Live:        'live',
  Funded:      'funded',
  Suspended:   'suspended',
  Failed:      'failed',
  Settlement:  'settlement',
  Complete:    'complete',
  Cancelled:   'cancelled',
  Archived:    'archived',
} as const;

export type CampaignStatus = (typeof CampaignStatus)[keyof typeof CampaignStatus];

/** States that are editable via PATCH (auto-save) */
export const EDITABLE_STATUSES: readonly CampaignStatus[] = [
  CampaignStatus.Draft,
  CampaignStatus.Rejected,
] as const;

/** States from which a creator can submit */
export const SUBMITTABLE_STATUSES: readonly CampaignStatus[] = [
  CampaignStatus.Draft,
  CampaignStatus.Rejected,
] as const;

/** States from which a creator can self-archive */
export const CREATOR_ARCHIVABLE_STATUSES: readonly CampaignStatus[] = [
  CampaignStatus.Draft,
  CampaignStatus.Rejected,
] as const;
```

**Pattern:** `as const` + union type — no TypeScript enums (per project rules).

---

#### `CampaignCategory`

**File:** `packages/backend/src/campaign/domain/value-objects/campaign-category.ts`

```typescript
export const CampaignCategory = {
  Propulsion:                 'propulsion',
  EntryDescentLanding:        'entry_descent_landing',
  PowerEnergy:                'power_energy',
  HabitatsConstruction:       'habitats_construction',
  LifeSupportCrewHealth:      'life_support_crew_health',
  FoodWaterProduction:        'food_water_production',
  InSituResourceUtilisation:  'in_situ_resource_utilisation',
  RadiationProtection:        'radiation_protection',
  RoboticsAutomation:         'robotics_automation',
  CommunicationsNavigation:   'communications_navigation',
} as const;

export type CampaignCategory = (typeof CampaignCategory)[keyof typeof CampaignCategory];

export const CAMPAIGN_CATEGORIES: readonly CampaignCategory[] = Object.values(CampaignCategory);
```

---

### Entities

#### `Campaign`

**File:** `packages/backend/src/campaign/domain/models/campaign.ts`

**Properties:**

| Property | Type | Description |
|----------|------|-------------|
| `id` | `string` (UUID) | Unique identifier |
| `creatorUserId` | `string` (UUID) | MMF `users.id` of creator — never the Clerk user ID |
| `title` | `string` | Campaign title, max 200 chars |
| `shortDescription` | `string \| null` | Card summary, max 500 chars |
| `description` | `string \| null` | Full plain-text description, max 10,000 chars |
| `category` | `CampaignCategory \| null` | One of 10 fixed categories |
| `heroImageUrl` | `string \| null` | External `https://` URL |
| `fundingGoalCents` | `string \| null` | Integer cents as string (BIGINT — G-024) |
| `fundingCapCents` | `string \| null` | Integer cents as string (BIGINT — G-024) |
| `deadline` | `Date \| null` | Campaign end timestamp |
| `milestones` | `Milestone[]` | Array of milestone objects |
| `teamMembers` | `TeamMember[]` | Array of team member objects |
| `riskDisclosures` | `RiskDisclosure[]` | Array of risk disclosures |
| `budgetBreakdown` | `BudgetItem[]` | Array of budget line items |
| `alignmentStatement` | `string \| null` | Mars mission alignment text |
| `tags` | `string[]` | Discoverable tags |
| `status` | `CampaignStatus` | Current lifecycle state |
| `rejectionReason` | `string \| null` | Populated on rejection |
| `resubmissionGuidance` | `string \| null` | Populated on rejection |
| `reviewNotes` | `string \| null` | Populated on approval |
| `reviewedByUserId` | `string \| null` | MMF `users.id` of reviewer |
| `reviewedAt` | `Date \| null` | Timestamp of review decision |
| `submittedAt` | `Date \| null` | Timestamp of submission |
| `launchedAt` | `Date \| null` | Timestamp of Live transition |
| `createdAt` | `Date` | Row creation timestamp |
| `updatedAt` | `Date` | Last update timestamp |

All properties are `readonly`. The entity is immutable after construction.

**Private constructor.** All external code uses `create()` or `reconstitute()`.

**Supporting interfaces (in the same file or a types file in the same domain):**

```typescript
export interface Milestone {
  readonly id: string;
  readonly title: string;          // max 200 chars
  readonly description: string;    // max 1000 chars
  readonly fundingBasisPoints: number;  // integer 1–10000
  readonly targetDate: string;     // ISO 8601 date string
}

export interface TeamMember {
  readonly id: string;
  readonly name: string;   // max 200 chars
  readonly role: string;   // max 200 chars
  readonly bio: string;    // max 500 chars
}

export interface RiskDisclosure {
  readonly id: string;
  readonly risk: string;        // max 500 chars
  readonly mitigation: string;  // max 500 chars
}

export interface BudgetItem {
  readonly id: string;
  readonly category: string;      // max 100 chars
  readonly description: string;   // max 500 chars
  readonly estimatedCents: string; // integer cents as string
  readonly notes?: string;         // max 200 chars
}
```

**Factory method — `create()`:**

```typescript
static create(input: CreateCampaignInput): Campaign
```

`CreateCampaignInput`:

| Field | Type | Validation |
|-------|------|------------|
| `creatorUserId` | `string` | Required, UUID format |
| `title` | `string` | Required, `.trim()`, min 1 char, max 200 chars |

Validation rules enforced by `create()`:
- `creatorUserId`: non-empty UUID — throws `InvalidCreatorIdError` if empty
- `title`: trimmed, non-empty — throws `InvalidCampaignTitleError` if empty after trim; max 200 chars — throws `CampaignTitleTooLongError`

Sets defaults:
- `id`: new UUID (`crypto.randomUUID()`)
- `status`: `CampaignStatus.Draft`
- All nullable fields: `null`
- All array fields: `[]`
- `createdAt`, `updatedAt`: `new Date()`

**Reconstitution — `reconstitute()`:**

```typescript
static reconstitute(data: CampaignData): Campaign
```

`CampaignData` mirrors all `Campaign` properties as plain types. No validation — data is trusted from the database.

**Business methods:**

```typescript
updateDraft(input: UpdateCampaignInput): Campaign
```
- Returns a new `Campaign` with updated fields (only fields present in `input` are changed).
- Validates structural limits only (max field lengths, URL format). Does NOT validate required-field presence or business rules.
- Throws `CampaignNotEditableError` if `status` is not in `EDITABLE_STATUSES`.
- `input` is a `Partial<UpdateCampaignInput>` — any subset of fields can be provided.

```typescript
submit(submittedAt: Date): Campaign
```
- Returns a new `Campaign` with `status = 'submitted'` and `submittedAt` set.
- Does NOT perform submission validation — validation is the application service's responsibility before calling this method.
- Throws `CampaignNotSubmittableError` if `status` is not in `SUBMITTABLE_STATUSES`.

```typescript
claim(reviewerUserId: string, claimedAt: Date): Campaign
```
- Returns a new `Campaign` with `status = 'under_review'` and `reviewedByUserId` set.
- Throws `CampaignNotClaimableError` if `status !== 'submitted'`.

```typescript
approve(reviewNotes: string, reviewedAt: Date): Campaign
```
- Returns a new `Campaign` with `status = 'approved'`, `reviewNotes` set, `reviewedAt` set.
- Throws `CampaignNotApprovableError` if `status !== 'under_review'`.

```typescript
reject(rejectionReason: string, resubmissionGuidance: string, reviewedAt: Date): Campaign
```
- Returns a new `Campaign` with `status = 'rejected'`, `rejectionReason` set, `resubmissionGuidance` set, `reviewedAt` set.
- Throws `CampaignNotRejectableError` if `status !== 'under_review'`.

```typescript
launch(launchedAt: Date): Campaign
```
- Returns a new `Campaign` with `status = 'live'` and `launchedAt` set.
- Throws `CampaignNotLaunchableError` if `status !== 'approved'`.

```typescript
archive(): Campaign
```
- Returns a new `Campaign` with `status = 'archived'`.
- Does NOT validate — the application service checks the status before calling this.

---

### Domain Errors

**File:** `packages/backend/src/campaign/domain/errors/campaign-errors.ts`

All errors extend `DomainError` from `packages/backend/src/shared/domain/errors.ts`.

```typescript
import { DomainError } from '../../../shared/domain/errors';
```

| Error Class | `code` | HTTP Status | When Thrown |
|-------------|--------|-------------|-------------|
| `CreatorRoleRequiredError` | `CREATOR_ROLE_REQUIRED` | 403 | User does not have `creator` role |
| `KycNotVerifiedError` | `KYC_NOT_VERIFIED` | 403 | User `kycStatus !== 'verified'` |
| `AccountNotActiveError` | `ACCOUNT_NOT_ACTIVE` | 403 | User `accountStatus !== 'active'` (also used in Creator role endpoint) |
| `AccountSuspendedError` | `ACCOUNT_SUSPENDED` | 403 | User `accountStatus = 'suspended'` or `'deactivated'` |
| `InvalidCampaignTitleError` | `INVALID_CAMPAIGN_TITLE` | 400 | Title empty after trim |
| `CampaignTitleTooLongError` | `CAMPAIGN_TITLE_TOO_LONG` | 400 | Title > 200 chars |
| `CampaignNotEditableError` | `CAMPAIGN_NOT_EDITABLE` | 409 | PATCH on non-draft/rejected campaign |
| `CampaignNotSubmittableError` | `CAMPAIGN_NOT_SUBMITTABLE` | 409 | Submit on non-draft/rejected campaign |
| `CampaignAlreadySubmittedError` | `CAMPAIGN_ALREADY_SUBMITTED` | 409 | Submit race condition (conditional WHERE returned 0 rows) |
| `CampaignNotRevizableError` | `CAMPAIGN_NOT_REVIZABLE` | 409 | Submit on campaign in `under_review`/`approved` state |
| `CampaignNotClaimableError` | `CAMPAIGN_NOT_CLAIMABLE` | 409 | Claim on non-submitted campaign |
| `CampaignAlreadyClaimedError` | `CAMPAIGN_ALREADY_CLAIMED` | 409 | Claim race condition (conditional WHERE returned 0 rows) |
| `CampaignNotApprovableError` | `CAMPAIGN_NOT_APPROVABLE` | 409 | Approve on non-under_review campaign |
| `CampaignNotRejectableError` | `CAMPAIGN_NOT_REJECTABLE` | 409 | Reject on non-under_review campaign |
| `CampaignNotLaunchableError` | `CAMPAIGN_NOT_LAUNCHABLE` | 409 | Launch on non-approved campaign |
| `CampaignCannotArchiveError` | `CAMPAIGN_CANNOT_ARCHIVE` | 409 | Creator archive on non-archivable state |
| `CampaignInvalidStateError` | `CAMPAIGN_INVALID_STATE` | 409 | Admin reassign on non-under_review campaign |
| `CampaignNotFoundError` | `CAMPAIGN_NOT_FOUND` | 404 | Campaign not found or access denied |
| `NotAssignedReviewerError` | `NOT_ASSIGNED_REVIEWER` | 403 | Approve/reject by non-assigned reviewer |
| `ReviewerRoleRequiredError` | `REVIEWER_ROLE_REQUIRED` | 403 | Review action by non-reviewer |
| `AdminRoleRequiredError` | `ADMIN_ROLE_REQUIRED` | 403 | Admin action by non-admin |
| `ReassignTargetNotReviewerError` | `REASSIGN_TARGET_NOT_REVIEWER` | 400 | Reassign target user lacks reviewer role |
| `MilestoneValidationError` | `MILESTONE_VALIDATION_ERROR` | 400 | Milestone sum/count/value validation fails at submission |
| `SubmissionValidationError` | `SUBMISSION_VALIDATION_ERROR` | 400 | Required fields missing or business rules violated at submission |

**Error messages (brand voice — concise and actionable):**

| Code | Message |
|------|---------|
| `CREATOR_ROLE_REQUIRED` | `"You need the Creator role to perform this action. Designate yourself as a creator first."` |
| `KYC_NOT_VERIFIED` | `"Identity verification is required. Complete your KYC verification to continue."` |
| `ACCOUNT_NOT_ACTIVE` | `"Your account must be active to perform this action. Please verify your email."` |
| `CAMPAIGN_NOT_EDITABLE` | `"This campaign cannot be edited in its current state."` |
| `CAMPAIGN_ALREADY_SUBMITTED` | `"This campaign has already been submitted for review."` |
| `CAMPAIGN_ALREADY_CLAIMED` | `"This campaign has already been claimed by another reviewer."` |
| `CAMPAIGN_NOT_LAUNCHABLE` | `"Only approved campaigns can be launched."` |
| `CAMPAIGN_NOT_FOUND` | `"Campaign not found."` |
| `NOT_ASSIGNED_REVIEWER` | `"You are not the assigned reviewer for this campaign."` |
| `REVIEWER_ROLE_REQUIRED` | `"Reviewer access is required for this action."` |
| `ADMIN_ROLE_REQUIRED` | `"Administrator access is required for this action."` |

---

### Modifications to Existing Domain Artefacts

#### `AuditLoggerPort` (modified)

**File:** `packages/backend/src/account/ports/audit-logger.port.ts`

**Change:** Extend `resourceType` union to include `'campaign'`:

```typescript
export interface AuditEntry {
  readonly timestamp: Date;
  readonly actorClerkUserId: string;
  readonly action: AuditAction;
  readonly resourceType: 'user' | 'kyc' | 'campaign';  // 'campaign' added
  readonly resourceId: string;
  readonly metadata?: Record<string, unknown>;
}
```

Add Creator role assignment audit action:

```typescript
export const AuditActions = {
  // existing account + KYC actions...
  ProfileUpdated:        'profile.updated',
  NotificationsUpdated:  'notifications.updated',
  RoleAssigned:          'role.assigned',
  RoleRemoved:           'role.removed',
  AccountActivated:      'account.activated',
  AccountSuspended:      'account.suspended',
  UserSynced:            'user.synced',
  KycStatusChange:       'kyc.status.change',
  // no new entries needed — campaign audit events go to campaign_audit_events table directly
} as const;
```

Campaign audit events are written directly to `campaign_audit_events` table via `CampaignAuditRepositoryPort`, not via the general `AuditLoggerPort`. The `resourceType: 'campaign'` extension on `AuditEntry` is for any general audit log entries in the pino logger that reference campaigns (e.g., unexpected errors during campaign operations).

#### `AccountAppService` (modified — additive)

**File:** `packages/backend/src/account/application/account-app-service.ts`

Add a new method `assignCreatorRole`. See feat-003-spec-api.md for the full method specification.
