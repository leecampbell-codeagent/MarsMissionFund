# feat-006 Implementation Spec: Campaign Review Pipeline

**Spec ID**: feat-006-spec
**Version**: 1.0
**Status**: Draft
**Depends On**: feat-005, L4-002 (Campaign), L3-002 (Security), L3-006 (Audit)

---

## 1. Overview

This spec defines the complete implementation contract for the Campaign Review Pipeline. Reviewers claim campaigns from a FIFO queue, evaluate them against curation criteria, and approve or reject them with written notes. Only the assigned reviewer can approve or reject a campaign they have claimed.

---

## 2. Campaign Status Extension

### 2.1 Status Transitions (feat-006 scope)

| From | To | Method | Actor | Conditions |
|------|----|--------|-------|------------|
| `submitted` | `under_review` | `startReview(reviewerId)` | Reviewer / Admin | Campaign must be `submitted`; actor has `reviewer` or `administrator` role |
| `under_review` | `approved` | `approve(reviewerId, comment)` | Reviewer / Admin | Campaign must be `under_review`; actor is the assigned reviewer; comment required |
| `under_review` | `rejected` | `reject(reviewerId, comment)` | Reviewer / Admin | Campaign must be `under_review`; actor is the assigned reviewer; comment required |
| `under_review` | `submitted` | `recuse(reviewerId)` | Reviewer / Admin | Campaign must be `under_review`; actor is the assigned reviewer; clears reviewer fields |
| `rejected` | `draft` | `returnToDraft()` | Creator | Campaign must be `rejected`; called by creator (checked at app service level) |

---

## 3. Domain Extension

### 3.1 Extended `CampaignProps`

Add to `CampaignProps` interface:

```typescript
readonly reviewerId: string | null;
readonly reviewerComment: string | null;
readonly reviewedAt: Date | null;
```

### 3.2 New Campaign Methods

#### `startReview(reviewerId: string, reviewedAt?: Date): Campaign`
- Precondition: `this.status === 'submitted'`
- Throws `CampaignNotReviewableError` otherwise
- Returns new Campaign with `status: 'under_review'`, `reviewerId`, `reviewedAt: reviewedAt ?? new Date()`

#### `approve(reviewerId: string, comment: string, reviewedAt?: Date): Campaign`
- Precondition: `this.status === 'under_review'`
- Throws `CampaignNotReviewableError` if not `under_review`
- Throws `CampaignNotReviewableError` if `this.reviewerId !== reviewerId` (wrong reviewer)
- Throws `ReviewerCommentRequiredError` if comment is blank
- Returns new Campaign with `status: 'approved'`, `reviewerComment: comment`, `reviewedAt: reviewedAt ?? new Date()`

#### `reject(reviewerId: string, comment: string, reviewedAt?: Date): Campaign`
- Precondition: `this.status === 'under_review'`
- Throws `CampaignNotReviewableError` if not `under_review`
- Throws `CampaignNotReviewableError` if `this.reviewerId !== reviewerId` (wrong reviewer)
- Throws `ReviewerCommentRequiredError` if comment is blank
- Returns new Campaign with `status: 'rejected'`, `reviewerComment: comment`, `reviewedAt: reviewedAt ?? new Date()`

#### `recuse(reviewerId: string): Campaign`
- Precondition: `this.status === 'under_review'`
- Throws `CampaignNotReviewableError` if not `under_review`
- Throws `CampaignNotReviewableError` if `this.reviewerId !== reviewerId` (wrong reviewer)
- Returns new Campaign with `status: 'submitted'`, `reviewerId: null`, `reviewerComment: null`, `reviewedAt: null`

#### `returnToDraft(): Campaign`
- Precondition: `this.status === 'rejected'`
- Throws `CampaignNotReviewableError` if not `rejected`
- Returns new Campaign with `status: 'draft'`, preserving all other fields
- Does NOT clear reviewer fields (preserved for audit/history on the domain object; DB columns retain values)

### 3.3 Updated `reconstitute()`

Must accept the three new fields with `null` defaults:
```typescript
static reconstitute(props: CampaignProps & {
  reviewerId?: string | null;
  reviewerComment?: string | null;
  reviewedAt?: Date | null;
}): Campaign
```

### 3.4 New Domain Errors

#### `CampaignNotReviewableError`
```typescript
class CampaignNotReviewableError extends DomainError {
  constructor(message = 'Campaign is not in a reviewable state for this action.') {
    super('CAMPAIGN_NOT_REVIEWABLE', message);
  }
}
```

#### `ReviewerCommentRequiredError`
```typescript
class ReviewerCommentRequiredError extends DomainError {
  constructor(message = 'A written comment is required for this review action.') {
    super('REVIEWER_COMMENT_REQUIRED', message);
  }
}
```

---

## 4. Repository Port Extension

Add to `CampaignRepository` interface:

```typescript
findSubmitted(): Promise<{ campaign: Campaign; milestones: Milestone[] }[]>;
```

Returns campaigns with status `submitted` or `under_review`, ordered by `created_at` ascending (FIFO — oldest submission first).

---

## 5. Application Service Extension

### 5.1 Role Check Helper

```typescript
private assertReviewerRole(roles: readonly string[]): void {
  if (!roles.includes('reviewer') && !roles.includes('administrator')) {
    throw new InsufficientRoleError();
  }
}
```

Role check is performed at the application service level, not only at the API layer.

### 5.2 New Methods

#### `listSubmittedCampaigns(reviewerUserId: string, roles: readonly string[]): Promise<CampaignResult[]>`
- Calls `assertReviewerRole(roles)`
- Returns `campaignRepository.findSubmitted()` mapped to `CampaignResult[]`

#### `startReview(reviewerUserId: string, campaignId: string, roles: readonly string[]): Promise<CampaignResult>`
- Calls `assertReviewerRole(roles)`
- Loads campaign; throws `CampaignNotFoundError` if missing
- Calls `campaign.startReview(reviewerUserId)`
- Persists via `campaignRepository.update(updatedCampaign)`
- Emits event `campaign.review_started` to event store
- Returns updated `CampaignResult`

#### `approveCampaign(reviewerUserId: string, campaignId: string, comment: string, roles: readonly string[]): Promise<CampaignResult>`
- Calls `assertReviewerRole(roles)`
- Loads campaign; throws `CampaignNotFoundError` if missing
- Calls `campaign.approve(reviewerUserId, comment)`
- Persists via `campaignRepository.update(updatedCampaign)`
- Emits event `campaign.approved` to event store (includes `comment` in payload)
- Returns updated `CampaignResult`

#### `rejectCampaign(reviewerUserId: string, campaignId: string, comment: string, roles: readonly string[]): Promise<CampaignResult>`
- Calls `assertReviewerRole(roles)`
- Loads campaign; throws `CampaignNotFoundError` if missing
- Calls `campaign.reject(reviewerUserId, comment)`
- Persists via `campaignRepository.update(updatedCampaign)`
- Emits event `campaign.rejected` to event store (includes `comment` in payload)
- Returns updated `CampaignResult`

#### `recuseCampaign(reviewerUserId: string, campaignId: string, roles: readonly string[]): Promise<CampaignResult>`
- Calls `assertReviewerRole(roles)`
- Loads campaign; throws `CampaignNotFoundError` if missing
- Calls `campaign.recuse(reviewerUserId)`
- Persists via `campaignRepository.update(updatedCampaign)`
- Emits event `campaign.review_recused` to event store
- Returns updated `CampaignResult`

#### `returnCampaignToDraft(creatorUserId: string, campaignId: string): Promise<CampaignResult>`
- Loads campaign; throws `CampaignNotFoundError` if missing or `campaign.creatorId !== creatorUserId`
- Calls `campaign.returnToDraft()`
- Persists via `campaignRepository.update(updatedCampaign)`
- Emits event `campaign.returned_to_draft` to event store
- Returns updated `CampaignResult`

### 5.3 Extended `CampaignResult` DTO

Add to `CampaignResult`:
```typescript
readonly reviewerId: string | null;
readonly reviewerComment: string | null;
readonly reviewedAt: Date | null;
```

---

## 6. API Endpoints

All endpoints require Clerk JWT auth. Role checks are enforced at the application service level.

### 6.1 `GET /api/v1/campaigns/review-queue`

- Auth: required
- Role: `reviewer` or `administrator`
- Returns: `{ data: CampaignResponse[] }`
- Format: list of campaigns in `submitted` or `under_review` status, FIFO ordered
- Response fields include new reviewer fields: `reviewer_id`, `reviewer_comment`, `reviewed_at`

### 6.2 `POST /api/v1/campaigns/:id/claim`

- Auth: required
- Role: `reviewer` or `administrator`
- Body: none
- Returns: `{ data: CampaignResponse }` with status `under_review`
- Errors: 401 unauthenticated, 403 insufficient role, 404 not found, 409 not in claimable state

### 6.3 `POST /api/v1/campaigns/:id/approve`

- Auth: required
- Role: `reviewer` or `administrator`
- Body: `{ comment: string }` (required, non-empty)
- Returns: `{ data: CampaignResponse }` with status `approved`
- Errors: 401, 403 (role or wrong reviewer), 404, 409 (wrong state), 400 (missing comment)

### 6.4 `POST /api/v1/campaigns/:id/reject`

- Auth: required
- Role: `reviewer` or `administrator`
- Body: `{ comment: string }` (required, non-empty)
- Returns: `{ data: CampaignResponse }` with status `rejected`
- Errors: 401, 403 (role or wrong reviewer), 404, 409 (wrong state), 400 (missing comment)

### 6.5 `POST /api/v1/campaigns/:id/recuse`

- Auth: required
- Role: `reviewer` or `administrator`
- Body: none
- Returns: `{ data: CampaignResponse }` with status `submitted`
- Errors: 401, 403, 404, 409 (wrong state or wrong reviewer)

### 6.6 `POST /api/v1/campaigns/:id/return-to-draft`

- Auth: required (creator of the campaign)
- Role: any authenticated user (creator role implied by ownership check)
- Body: none
- Returns: `{ data: CampaignResponse }` with status `draft`
- Errors: 401, 404 (not found or not owner), 409 (campaign not in rejected state)

---

## 7. Database Migration

File: `db/migrations/20260305000004_add_review_fields_to_campaigns.sql`

```sql
-- migrate:up
BEGIN;

ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS reviewer_id    UUID        REFERENCES accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewer_comment TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at    TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_campaigns_reviewer_id ON campaigns (reviewer_id);

COMMIT;

-- migrate:down

DROP INDEX IF EXISTS idx_campaigns_reviewer_id;

ALTER TABLE campaigns
  DROP COLUMN IF EXISTS reviewer_id,
  DROP COLUMN IF EXISTS reviewer_comment,
  DROP COLUMN IF EXISTS reviewed_at;
```

---

## 8. Event Types

New event types to add to `CAMPAIGN_EVENT_TYPES`:

| Constant | Value |
|----------|-------|
| `REVIEW_STARTED` | `campaign.review_started` |
| `APPROVED` | `campaign.approved` |
| `REJECTED` | `campaign.rejected` |
| `REVIEW_RECUSED` | `campaign.review_recused` |
| `RETURNED_TO_DRAFT` | `campaign.returned_to_draft` |

Audit event payloads must include: `campaignId`, `reviewerId`, `previousStatus`, `newStatus`, and for approve/reject: `comment` (truncated to 500 chars for payload — full text in DB column).

---

## 9. Frontend

### 9.1 API Types (`packages/frontend/src/api/campaign-api.ts`)

Add to `CampaignResponse`:
```typescript
readonly reviewer_id: string | null;
readonly reviewer_comment: string | null;
readonly reviewed_at: string | null;
```

Add new API input types:
```typescript
export interface ReviewCommentInput {
  readonly comment: string;
}
```

### 9.2 Hooks

**`useReviewQueue()`** — `packages/frontend/src/hooks/campaign/use-review-queue.ts`
- `useQuery` on `['campaigns', 'review-queue']`
- GET `/api/v1/campaigns/review-queue`

**`useStartReview()`** — `packages/frontend/src/hooks/campaign/use-start-review.ts`
- `useMutation`; arg: `campaignId: string`
- POST `/api/v1/campaigns/:id/claim`
- Invalidates `['campaigns', 'review-queue']`

**`useApproveCampaign()`** — `packages/frontend/src/hooks/campaign/use-approve-campaign.ts`
- `useMutation`; arg: `{ campaignId: string; comment: string }`
- POST `/api/v1/campaigns/:id/approve`
- Invalidates `['campaigns', 'review-queue']`

**`useRejectCampaign()`** — `packages/frontend/src/hooks/campaign/use-reject-campaign.ts`
- `useMutation`; arg: `{ campaignId: string; comment: string }`
- POST `/api/v1/campaigns/:id/reject`
- Invalidates `['campaigns', 'review-queue']`

### 9.3 Components

**`ReviewQueueCard`** — `packages/frontend/src/components/campaign/ReviewQueueCard.tsx`
- Props: `{ campaign: CampaignResponse; onClaim?: () => void; onApprove?: (comment: string) => void; onReject?: (comment: string) => void }`
- Shows: title, category, creator_id (as "Creator ID"), submission date, status badge
- Actions: Claim button (shown when `status === 'submitted'`); Approve/Reject buttons (shown when `status === 'under_review'` and claim exists)
- All props `readonly`

**`RejectionReasonModal`** — `packages/frontend/src/components/campaign/RejectionReasonModal.tsx`
- Props: `{ isOpen: boolean; onClose: () => void; onConfirm: (comment: string) => void; isPending: boolean }`
- Contains textarea for rejection reason + confirm/cancel buttons
- Validates non-empty before submitting

### 9.4 Page

**`ReviewQueuePage`** — `packages/frontend/src/pages/admin-review-queue.tsx`
- Default export
- Uses `useReviewQueue()`, `useStartReview()`, `useApproveCampaign()`, `useRejectCampaign()`
- Handles: loading, error, empty, and populated states
- Renders `ReviewQueueCard` per campaign
- Manages `RejectionReasonModal` state

### 9.5 Route

In `App.tsx`, add:
```tsx
<Route
  path="/admin/review-queue"
  element={
    <ProtectedRoute>
      <ReviewQueuePage />
    </ProtectedRoute>
  }
/>
```

---

## 10. Acceptance Criteria

**AC-006-001**: Given a user with `reviewer` role, when they GET `/api/v1/campaigns/review-queue`, then they receive all campaigns in `submitted` or `under_review` status ordered by creation date ascending.

**AC-006-002**: Given a reviewer, when they POST to `/api/v1/campaigns/:id/claim` on a `submitted` campaign, then the campaign transitions to `under_review` and the reviewer is recorded as the assigned reviewer.

**AC-006-003**: Given a reviewer who has claimed a campaign, when they POST to `/api/v1/campaigns/:id/approve` with a non-empty comment, then the campaign transitions to `approved` and an audit event is emitted.

**AC-006-004**: Given a reviewer who has claimed a campaign, when they POST to `/api/v1/campaigns/:id/reject` with a non-empty comment, then the campaign transitions to `rejected` and an audit event is emitted.

**AC-006-005**: Given a reviewer who has NOT claimed a campaign, when they attempt to approve/reject it, then they receive a 409 error.

**AC-006-006**: Given a user without `reviewer` or `administrator` role, when they access the review queue or attempt any review action, then they receive a 403 error.

**AC-006-007**: Given a reviewer attempting to approve without a comment, then they receive a 400 error.

**AC-006-008**: Given a reviewer who claimed a campaign, when they recuse themselves, then the campaign returns to `submitted` status and the reviewer fields are cleared.

**AC-006-009**: Given a creator whose campaign was rejected, when they POST to `/api/v1/campaigns/:id/return-to-draft`, then the campaign returns to `draft` status with all previous data preserved.

**AC-006-010**: Given a campaign already in `under_review`, when another reviewer tries to claim it, then they receive a 409 error.

---

## 11. Edge Cases

| Case | Handling |
|------|----------|
| Claim already-claimed campaign | Domain throws `CampaignNotReviewableError` (status is `under_review` not `submitted`) → API 409 |
| Re-review after rejection | Creator must call `return-to-draft` first; only `rejected` → `draft` is valid |
| Approve without notes | Domain throws `ReviewerCommentRequiredError` → API 400 |
| Reject without rationale | Domain throws `ReviewerCommentRequiredError` → API 400 |
| Wrong reviewer approves | Domain checks `this.reviewerId !== reviewerId` → throws `CampaignNotReviewableError` → API 409 |
| Creator tries to claim | App service throws `InsufficientRoleError` → API 403 |
| Return-to-draft on approved | Domain throws `CampaignNotReviewableError` → API 409 |
