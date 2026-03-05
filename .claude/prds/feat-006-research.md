# feat-006 Research: Campaign Review Pipeline

## 1. Feature Brief Summary

feat-006 implements the reviewer claim flow, approve/reject pipeline, and recuse action for submitted campaigns. Reviewers are users with the `reviewer` role. The queue is FIFO (ordered by submission time). Only the claiming reviewer can approve/reject their claimed campaign. The feature depends on feat-005 (Campaign entity with `draft`/`submitted` states).

## 2. Existing Domain State

### Campaign Entity (`packages/backend/src/campaign/domain/campaign.ts`)

- `CampaignStatus` already includes: `'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'live' | 'funded' | 'suspended' | 'failed' | 'settlement' | 'complete' | 'cancelled'`
- Entity uses private constructor + `create()` / `reconstitute()` pattern
- All props `readonly` — mutations return new instances
- Missing from entity: `reviewerId`, `reviewerComment`, `reviewedAt` fields and `startReview()`, `approve()`, `reject()`, `returnToDraft()` methods

### Domain Errors (`packages/backend/src/campaign/domain/errors.ts`)

- `InsufficientRoleError` already defined (code `INSUFFICIENT_ROLE`)
- Need to add: `CampaignNotReviewableError`, `ReviewerCommentRequiredError`

### Campaign App Service (`packages/backend/src/campaign/application/campaign-app-service.ts`)

- Existing event types: `campaign.draft_created`, `campaign.draft_updated`, `campaign.submitted`
- Needs additions: `campaign.review_started`, `campaign.approved`, `campaign.rejected`, `campaign.returned_to_draft`, `campaign.review_recused`
- Missing methods: `listSubmittedCampaigns()`, `startReview()`, `approveCampaign()`, `rejectCampaign()`, `returnToDraft()`
- Role check pattern: roles are checked at application service level via `req.authContext?.roles` passed in from API

### Campaign Repository Port (`packages/backend/src/campaign/ports/campaign-repository.ts`)

- Missing: `findSubmitted()` method — returns submitted/under_review campaigns for review queue
- Missing: `findByReviewerId()` — not strictly needed if we scope by status

### Database (`db/migrations/20260304000004_create_campaigns.sql`)

- Missing columns: `reviewer_id`, `reviewer_comment`, `reviewed_at`
- `status` CHECK constraint already includes `under_review`, `approved`, `rejected`
- No FK on `reviewer_id` (reviewer accounts exist in `accounts` table but reviewer could be from external system; safer to use UUID without FK or with FK to accounts)

### Account Domain (`packages/backend/src/account/domain/account.ts`)

- `AccountRole` includes `'reviewer'` and `'administrator'`
- Role checks in the campaign router use `req.authContext?.roles` array

## 3. Review Workflow States and Transitions

Per spec L4-002 Section 3.2:

| From | To | Trigger | Conditions |
|------|----|---------|------------|
| `submitted` | `under_review` | Reviewer claims | `reviewer` or `administrator` role |
| `under_review` | `approved` | Reviewer approves | Claiming reviewer only; written approval notes |
| `under_review` | `rejected` | Reviewer rejects | Claiming reviewer only; written rationale required |
| `under_review` | `submitted` | Reviewer recuses | Returns to queue |
| `rejected` | `draft` | Creator revises | Creator must own the campaign |

### Spec Constraints

- Only the reviewer who claimed a campaign can approve/reject it (per PRD: "only the assigned reviewer can approve/reject")
- Admins can reassign (feat-015, out of scope here)
- Double-review guard: `startReview` only valid on `submitted` status
- Reject requires non-empty written comment
- Approve requires written approval notes

## 4. Reviewer Role Requirements (L3-002)

- `reviewer` role: access review queue, claim, approve, reject, recuse
- `administrator` role: all reviewer capabilities (per L3-002 Section 5.1)
- Role enforcement at application service level — API layer is secondary
- Both `reviewer` and `administrator` roles can perform all review actions

## 5. Audit Trail Requirements (L3-006)

Per L3-006 Section 4.1, review decisions are `mutation` event type (state change). Required fields:
- `event_type`: `mutation`
- `actor_id`: reviewer userId
- `actor_type`: `user`
- `action`: e.g. `campaign.approved`, `campaign.rejected`
- `resource_type`: `campaign`
- `resource_id`: campaignId
- `outcome`: `success`
- `previous_state`: `{ status: 'under_review' }`
- `new_state`: `{ status: 'approved' | 'rejected' }`
- `reason`: reviewer comment/rationale (for reject/approve)

The existing `EventStorePort.append()` captures this via `payload`. The event store is already wired in the app service.

## 6. API Endpoints Required

Per PRD:
- `GET /api/v1/campaigns/review-queue` — list submitted + under_review campaigns (reviewer role required)
- `POST /api/v1/campaigns/:id/claim` — claim campaign (reviewer role) — transitions submitted → under_review
- `POST /api/v1/campaigns/:id/approve` — approve (reviewer role, must be assigned reviewer)
- `POST /api/v1/campaigns/:id/reject` — reject with comment (reviewer role, must be assigned reviewer)
- `POST /api/v1/campaigns/:id/recuse` — recuse (reviewer role, must be assigned reviewer; returns to submitted)
- `POST /api/v1/campaigns/:id/return-to-draft` — creator revises after rejection (creator role, must own)

The task spec also mentions `POST /api/v1/campaigns/:id/start-review` as an alias for claim.

## 7. Frontend Requirements

- `/admin/review-queue` page — visible to reviewer/admin only
- `ReviewQueueCard` component — campaign card with approve/reject/claim actions
- `RejectionReasonModal` — modal to enter rejection reason
- Status badges already handle `under_review`, `approved`, `rejected` in existing `CampaignStatusBadge`
- Hooks: `useReviewQueue()`, `useStartReview()`, `useApproveCampaign()`, `useRejectCampaign()`

## 8. Edge Cases

- **Double-review**: `startReview` on a non-`submitted` campaign throws `CampaignNotReviewableError`
- **Wrong reviewer tries to approve/reject**: throws `InsufficientRoleError` or a specific error — spec says "only the assigned reviewer can approve/reject"
- **Approve without notes**: domain throws `ReviewerCommentRequiredError`
- **Reject without rationale**: domain throws `ReviewerCommentRequiredError`
- **Creator tries to return-to-draft non-rejected campaign**: throws `CampaignNotReviewableError`
- **Reviewer approves already-approved campaign**: throws `CampaignNotReviewableError`

## 9. Interface Contract with feat-005

The existing `CampaignResult` DTO must be extended with:
- `reviewerId: string | null`
- `reviewerComment: string | null`
- `reviewedAt: Date | null`

The existing `reconstitute()` method must be updated to accept these fields. `CampaignProps` interface must be extended.

## 10. Missing Infrastructure Items

- New migration: `db/migrations/20260305000004_add_review_fields_to_campaigns.sql`
  - ADD COLUMN `reviewer_id UUID REFERENCES accounts(id) ON DELETE SET NULL`
  - ADD COLUMN `reviewer_comment TEXT`
  - ADD COLUMN `reviewed_at TIMESTAMPTZ`
  - ADD INDEX on `reviewer_id`
- Repository `findSubmitted()` for the review queue
- `CampaignRepository` port must add `findSubmitted(): Promise<...[]>`
