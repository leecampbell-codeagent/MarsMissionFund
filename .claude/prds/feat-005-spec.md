# feat-005 Spec: Campaign Creation (Draft & Submit)

> **Spec Status**: DRAFT
> **Based on**: feat-005 brief, feat-005-research.md, L4-002 (campaign.md), L3-001 (architecture.md), L3-002 (security.md), L2-002 (engineering.md)
> **Scope**: Draft state creation, draft updates, submit for review (Draft → Submitted transition only)
> **Out of scope**: Review pipeline, campaign live/funded states, media upload infrastructure, stretch goals, deadline enforcement

---

## 1. Domain Model

### 1.1 Campaign Entity

```
Campaign {
  id: string (UUID)
  creatorId: string (UUID — links to accounts.id)
  title: string (1–200 chars)
  summary: string | null (≤280 chars)
  description: string | null
  marsAlignmentStatement: string | null
  category: CampaignCategory
  status: CampaignStatus ('draft' | 'submitted')
  minFundingTargetCents: number (BIGINT integer cents)
  maxFundingCapCents: number (BIGINT integer cents)
  deadline: Date | null
  budgetBreakdown: string | null
  teamInfo: string | null (JSON text for MVP — free-form)
  riskDisclosures: string | null (JSON text for MVP — free-form)
  heroImageUrl: string | null
  milestones: readonly Milestone[]
  createdAt: Date
  updatedAt: Date
}
```

**CampaignStatus** (feat-005 scope): `'draft' | 'submitted'`
(Full state machine in L4-002 includes 12 states; remaining transitions are future features)

**CampaignCategory** (10-value enum):
- `propulsion`
- `entry_descent_landing`
- `power_energy`
- `habitats_construction`
- `life_support_crew_health`
- `food_water_production`
- `isru`
- `radiation_protection`
- `robotics_automation`
- `communications_navigation`

### 1.2 Milestone Value Object

```
Milestone {
  id: string (UUID)
  campaignId: string
  title: string
  description: string | null
  targetDate: Date | null
  fundingPercentage: number (0–100 integer)
  verificationCriteria: string | null
  status: 'pending' | 'verified' | 'returned'
  createdAt: Date
  updatedAt: Date
}
```

Milestones are owned by a Campaign. During draft creation/update, milestones are saved separately. At submission, at least 2 milestones are required with percentages summing to 100%.

### 1.3 Domain Errors

| Error Class | Code | Description |
|---|---|---|
| `InvalidCampaignError` | `INVALID_CAMPAIGN_DATA` | Validation failure on campaign fields |
| `CampaignNotFoundError` | `CAMPAIGN_NOT_FOUND` | Campaign does not exist or belongs to another user |
| `CampaignAlreadySubmittedError` | `CAMPAIGN_ALREADY_SUBMITTED` | Attempt to update/submit an already-submitted campaign |
| `KycRequiredError` | `KYC_REQUIRED` | Creator's KYC status is not `verified` |
| `InsufficientRoleError` | `INSUFFICIENT_ROLE` | User does not have creator role |

### 1.4 Campaign Entity Behaviour

**create(input)** — validates required fields for draft creation:
- `creatorId` required, non-empty
- `title` required, 1–200 chars (trimmed)
- `category` must be a valid `CampaignCategory` value
- `minFundingTargetCents` must be a positive integer (> 0) — range validation only at submit
- `maxFundingCapCents` must be ≥ `minFundingTargetCents`
- Initial status is `'draft'`
- Milestones start empty (populated separately)

**reconstitute(props)** — no validation, for loading from DB.

**withDraftUpdate(input)** — returns new Campaign with updated draft fields. Only allowed if status is `'draft'`. Throws `CampaignAlreadySubmittedError` if status is `'submitted'`.

**submit(options)** — returns new Campaign with status `'submitted'`. Only allowed if status is `'draft'`. Validates all submission requirements (see Section 2.2). Throws `CampaignAlreadySubmittedError` if already submitted.

---

## 2. Submission Validation Rules (AC-CAMP-001 through AC-CAMP-003)

### 2.1 KYC Gate
Before field validation, check KYC status. If creator's KYC status is NOT `'verified'`, throw `KycRequiredError`.

### 2.2 Field Validation at Submission
All of the following must be present and valid:
- `title` non-empty (1–200 chars)
- `summary` non-null, non-empty (≤280 chars)
- `description` non-null, non-empty
- `marsAlignmentStatement` non-null, non-empty
- `category` valid enum value
- `minFundingTargetCents` in range [100000000, 100000000000] (=$1M to $1B)
- `maxFundingCapCents` ≥ `minFundingTargetCents`
- `deadline` non-null, at least 7 days from submission, at most 365 days from submission
- At least 2 milestones
- Each milestone must have: `title`, `targetDate`, `fundingPercentage`
- Sum of all milestone `fundingPercentage` values = 100
- At least 1 risk disclosure (riskDisclosures non-null and parseable as non-empty array)
- At least 1 team member (teamInfo non-null and parseable as non-empty array)

All validation failures throw `InvalidCampaignError` with descriptive message.

---

## 3. Ports (Interfaces)

### 3.1 CampaignRepository

```typescript
interface CampaignRepository {
  findById(id: string): Promise<Campaign | null>;
  findByCreatorId(creatorId: string): Promise<Campaign[]>;
  save(campaign: Campaign, milestones: Milestone[]): Promise<void>;
  update(campaign: Campaign, milestones?: Milestone[]): Promise<void>;
}
```

Note: milestones are saved/updated together with the campaign to maintain consistency.

### 3.2 KycStatusPort

```typescript
interface KycStatusPort {
  getVerificationStatus(accountId: string): Promise<{ status: string }>;
}
```

This is a thin interface allowing the campaign module to check KYC status without depending on the KYC module's internals.

---

## 4. API Contracts

### 4.1 POST /api/v1/campaigns — Create Draft

**Authentication**: Required (Clerk JWT)
**Authorization**: Creator role required

**Request Body**:
```json
{
  "title": "string (required, 1-200)",
  "category": "propulsion | entry_descent_landing | ...",
  "min_funding_target_cents": "string (integer cents, >0)",
  "max_funding_cap_cents": "string (integer cents, >= min)",
  "summary": "string (optional, ≤280)",
  "description": "string (optional)",
  "mars_alignment_statement": "string (optional)",
  "deadline": "ISO 8601 date string (optional)",
  "budget_breakdown": "string (optional)",
  "team_info": "string (optional, JSON array text)",
  "risk_disclosures": "string (optional, JSON array text)",
  "hero_image_url": "string (optional, https URL)",
  "milestones": [{ "title": "string", "description": "string", "target_date": "ISO8601", "funding_percentage": 50, "verification_criteria": "string" }]
}
```

Note: monetary amounts sent as **strings** in JSON per spec to avoid precision loss.

**Response 201**:
```json
{
  "data": {
    "id": "uuid",
    "creator_id": "uuid",
    "title": "string",
    "summary": "string | null",
    "description": "string | null",
    "mars_alignment_statement": "string | null",
    "category": "string",
    "status": "draft",
    "min_funding_target_cents": "string",
    "max_funding_cap_cents": "string",
    "deadline": "ISO8601 | null",
    "budget_breakdown": "string | null",
    "team_info": "string | null",
    "risk_disclosures": "string | null",
    "hero_image_url": "string | null",
    "milestones": [...],
    "created_at": "ISO8601",
    "updated_at": "ISO8601"
  }
}
```

**Error Responses**:
- 400: Validation errors
- 401: Unauthenticated
- 403: Insufficient role (not a creator)

### 4.2 GET /api/v1/campaigns/mine — List My Campaigns

**Authentication**: Required

**Response 200**:
```json
{
  "data": [<campaign>, ...]
}
```

Note: returns campaigns for the authenticated user only.

### 4.3 GET /api/v1/campaigns/:id — Get Campaign

**Authentication**: Required

**Response 200**: Campaign object (only accessible if creator_id matches authenticated user for draft/submitted campaigns)

**Error Responses**:
- 401: Unauthenticated
- 404: Campaign not found or not owned by user

### 4.4 PATCH /api/v1/campaigns/:id — Update Draft

**Authentication**: Required

**Request Body**: Same fields as POST but all optional. At least one field required.

**Response 200**: Updated campaign object.

**Error Responses**:
- 400: Validation error
- 401: Unauthenticated
- 404: Campaign not found
- 409: Campaign already submitted (cannot update)

### 4.5 POST /api/v1/campaigns/:id/submit — Submit for Review

**Authentication**: Required

**Request Body**: Empty (all data is already on the campaign)

**Response 200**:
```json
{
  "data": {
    "id": "uuid",
    "status": "submitted",
    ...
  }
}
```

**Error Responses**:
- 400: Validation error (missing required fields)
- 401: Unauthenticated
- 403: KYC not verified (KYC_REQUIRED)
- 404: Campaign not found
- 409: Campaign already submitted

---

## 5. Application Service

### CampaignAppService

```typescript
class CampaignAppService {
  constructor(
    campaignRepository: CampaignRepository,
    kycStatusPort: KycStatusPort,
    eventStore: EventStorePort,
    logger: Logger
  )

  createDraft(userId: string, input: CreateCampaignInput): Promise<CampaignResult>
  updateDraft(userId: string, campaignId: string, input: UpdateCampaignInput): Promise<CampaignResult>
  submitForReview(userId: string, campaignId: string): Promise<CampaignResult>
  getCampaign(userId: string, campaignId: string): Promise<CampaignResult>
  listMyCampaigns(userId: string): Promise<CampaignResult[]>
}
```

### Event Types
- `campaign.draft_created` — emitted on createDraft
- `campaign.draft_updated` — emitted on updateDraft
- `campaign.submitted` — emitted on submitForReview

All events use campaignId as aggregateId, aggregateType = `'campaign'`.

---

## 6. Acceptance Criteria

### AC-CAMP-005-001 (Draft Creation)
**Given** an authenticated user with the creator role,
**When** they POST /api/v1/campaigns with valid title, category, and funding targets,
**Then** a campaign is created in draft status and returned with 201.

### AC-CAMP-005-002 (Draft Update)
**Given** a campaign in draft status owned by the authenticated creator,
**When** they PATCH /api/v1/campaigns/:id with updated fields,
**Then** the campaign is updated and returned with 200.

### AC-CAMP-005-003 (Cannot Update Submitted Campaign)
**Given** a campaign in submitted status,
**When** the creator tries to PATCH it,
**Then** 409 is returned with code CAMPAIGN_ALREADY_SUBMITTED.

### AC-CAMP-005-004 (KYC Gate)
**Given** a creator whose KYC status is NOT verified,
**When** they POST /api/v1/campaigns/:id/submit,
**Then** 403 is returned with code KYC_REQUIRED.

### AC-CAMP-005-005 (Submission with KYC and valid data)
**Given** a creator with verified KYC and a draft with all required fields,
**When** they POST /api/v1/campaigns/:id/submit,
**Then** the campaign transitions to submitted status and 200 is returned.

### AC-CAMP-005-006 (Milestone validation)
**Given** a draft campaign where milestone percentages do not sum to 100%,
**When** the creator submits,
**Then** 400 is returned with code INVALID_CAMPAIGN_DATA and descriptive message.

### AC-CAMP-005-007 (Funding target range)
**Given** a draft campaign with minFundingTargetCents below $1M (< 100000000),
**When** the creator submits,
**Then** 400 is returned with code INVALID_CAMPAIGN_DATA.

### AC-CAMP-005-008 (Deadline validation)
**Given** a draft campaign with a deadline fewer than 7 days from now,
**When** the creator submits,
**Then** 400 is returned with code INVALID_CAMPAIGN_DATA.

### AC-CAMP-005-009 (Data isolation)
**Given** creator A and creator B each have campaigns,
**When** creator A calls GET /api/v1/campaigns/:id for creator B's campaign,
**Then** 404 is returned (not 403, to avoid information disclosure).

### AC-CAMP-005-010 (Multiple drafts)
**Given** an authenticated creator,
**When** they create multiple campaigns,
**Then** all appear in GET /api/v1/campaigns/mine.

---

## 7. Database Schema Extension

New migration required (`20260304000006_extend_campaigns.sql` or similar):

Add to campaigns table:
- `mars_alignment_statement TEXT`
- `budget_breakdown TEXT`
- `team_info TEXT` (JSON array as text for MVP)
- `risk_disclosures TEXT` (JSON array as text for MVP)
- `hero_image_url TEXT`

These columns are nullable to allow draft campaigns without all fields.

---

## 8. Edge Cases

| Case | Expected Behaviour |
|---|---|
| Creator creates campaign, KYC gets revoked, tries to submit | KycRequiredError (403) |
| Creator tries to access another creator's campaign ID | 404 (not 403) |
| Empty milestones array at submission | InvalidCampaignError: at least 2 milestones required |
| 1 milestone at submission | InvalidCampaignError: at least 2 milestones required |
| Milestones sum to 99% or 101% | InvalidCampaignError: must sum to 100% |
| Max funding cap < min funding target | 400 at creation |
| Deadline exactly 7 days from now | Valid |
| Deadline 6 days from now | InvalidCampaignError |
| Deadline exactly 365 days from now | Valid |
| Deadline 366 days from now | InvalidCampaignError |
| Submit already-submitted campaign | CampaignAlreadySubmittedError (409) |
| Update already-submitted campaign | CampaignAlreadySubmittedError (409) |
| Non-existent campaign ID | CampaignNotFoundError (404) |

---

## 9. Interface Contracts with feat-006 (Campaign Review)

feat-005 exposes:
- Campaigns in `submitted` state in the `campaigns` table
- `campaign.submitted` event: `{ campaignId: string, creatorId: string, title: string, category: string }`
- `CampaignRepository.findById(id)` — feat-006 will use this for state transitions
- `CampaignRepository.update(campaign)` — feat-006 will use this to transition to `under_review`

feat-006 must NOT read KYC status (that was already checked at submission). feat-006 adds new methods to `CampaignRepository` (e.g., `findByStatus(status)` for reviewer queue) — these are additive, not breaking.

---

## 10. Testing Requirements

Per L2-002 Section 4.2:
- Domain unit tests: ≥90% coverage on Campaign entity and Milestone VO
- Application service integration tests with mock adapters
- API endpoint integration tests: 100% of documented contracts (happy path + all error paths)
- Frontend component tests: all states (default, loading, error, empty)
