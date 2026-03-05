# Exploratory Review: feat-006 — Campaign Review Pipeline

> Code-review based verification. Docker unavailable — code-review based verification.

## Verdict: PASS

## Summary

All core behaviours of the Campaign Review Pipeline are correctly implemented and verified by reading the source code. State transitions are properly guarded, role gates are enforced at the right layer, and the frontend handles all required UI states. One notable UX gap was found: the approval flow sends a hardcoded comment rather than prompting the reviewer for input.

---

## Verification Checklist

### 1. Review queue lists only submitted/under_review campaigns: PASS

**Code path:**
- `pg-campaign-repository.ts:32-33`: `SELECT * FROM campaigns WHERE status IN ('submitted', 'under_review') ORDER BY created_at ASC`
- `in-memory-campaign-repository.ts:29-30`: `if (campaign.status === 'submitted' || campaign.status === 'under_review')`
- Verified by test: `'does not return draft or approved campaigns'` — seeds a draft campaign, asserts `res.body.data` has length 0.

### 2. Start review transitions to under_review: PASS

**Code path:**
- `campaign.ts:411-425`: `startReview(reviewerId, reviewedAt?)` — throws `CampaignNotReviewableError` if `status !== 'submitted'`; returns new Campaign with `status: 'under_review'`, `reviewerId` set, `reviewedAt` set
- `campaign-app-service.ts:287-321`: `startReview` — asserts reviewer role, loads campaign, calls `campaign.startReview(reviewerUserId)`, persists, emits `campaign.review_started` event
- `campaign-router.ts:493-551`: `POST /:id/claim` — extracts `userId` from auth context, passes to `startReview`
- Verified by test: `'claims a submitted campaign and transitions to under_review'` — asserts `status === 'under_review'` and `reviewer_id === reviewerAccount.id`

### 3. Approve only works on under_review campaigns: PASS

**Code path:**
- `campaign.ts:431-453`: `approve(reviewerId, comment, reviewedAt?)` — throws `CampaignNotReviewableError` if `status !== 'under_review'`; throws `CampaignNotReviewableError` if `this.reviewerId !== reviewerId` (wrong reviewer); throws `ReviewerCommentRequiredError` if comment blank
- `campaign-router.ts:557-639`: maps `CampaignNotReviewableError` → 409, `ReviewerCommentRequiredError` → 400
- Verified by tests:
  - `'returns 409 when approving a submitted (not under_review) campaign'`
  - `'returns 409 when wrong reviewer tries to approve'`
  - `'approves a campaign under review with comment'`

### 4. Reject requires a comment: PASS

**Code path:**
- `campaign.ts:459-481`: `reject(reviewerId, comment, reviewedAt?)` — throws `ReviewerCommentRequiredError` if `!comment || comment.trim().length === 0`
- `campaign-router.ts:676-686`: Zod validation with `reviewCommentSchema` (`z.string().trim().min(1).max(5000)`) — returns 400 before reaching service if comment missing or empty
- `campaign-app-service.ts:369-405`: `rejectCampaign` — also calls `assertReviewerRole` and domain `reject()` which re-validates comment
- Verified by tests:
  - `'returns 400 for missing comment'` (empty body)
  - `'returns 400 for empty comment'` (whitespace-only: `'   '`)

### 5. Role gate enforced: PASS

**Code path (dual enforcement):**
- **API layer** (`campaign-router.ts`): Every review endpoint checks `roles.some((r) => REVIEWER_ROLES.includes(r))` and returns 403 before calling the service
- **Application service layer** (`campaign-app-service.ts:264-268`): `assertReviewerRole(roles)` called at the start of `listSubmittedCampaigns`, `startReview`, `approveCampaign`, `rejectCampaign`, `recuseCampaign` — throws `InsufficientRoleError` which maps to 403
- The `returnCampaignToDraft` endpoint does not require reviewer role; it enforces creator ownership instead (`record.campaign.creatorId !== creatorUserId` → 404)
- Verified by tests:
  - `'returns 403 for backer role'` across all review endpoints
  - `'allows administrator role to access review queue'`

### 6. Frontend handles all states (empty queue, loading, error, campaign cards): PASS

**Code path (`admin-review-queue.tsx`):**
- **Loading state** (lines 54-69): Returns skeleton cards with three `rq-skeleton--card` placeholder elements when `isLoading === true`
- **Error state** (lines 71-84): Returns error banner with `role="alert"` and message `'Failed to load review queue. Please try again.'` when `isError === true`
- **Empty state** (lines 94-98): Renders `rq-empty` section with heading `'QUEUE IS CLEAR'` when `queue.length === 0`
- **Populated state** (lines 99-117): Maps over campaigns and renders `ReviewQueueCard` per campaign
- `RejectionReasonModal` rendered at all times but `isOpen={rejectTargetId !== null}` controls visibility
- Animation uses `@keyframes rq-skel-pulse` with `@media (prefers-reduced-motion: reduce)` override — semantic motion tokens respected

**`ReviewQueueCard` state handling:**
- Shows "CLAIM CAMPAIGN" button when `status === 'submitted'`
- Shows Approve/Reject/Recuse buttons when `isAssignedReviewer` (status === 'under_review' AND `reviewer_id === currentUserId`)
- Uses semantic design tokens: `--font-display`, `--font-body`, `--font-data`, `--color-status-success`, `--color-status-error`, `--color-border-subtle`, `--gradient-action-primary`
- Respects `prefers-reduced-motion` for transition animations

### 7. Additional: Recuse clears reviewer fields: PASS

**Code path:**
- `campaign.ts:487-506`: `recuse(reviewerId)` — throws if not `under_review` or wrong reviewer; returns new Campaign with `status: 'submitted'`, `reviewerId: null`, `reviewerComment: null`, `reviewedAt: null`
- Verified by test: `'recuses from a campaign and returns to submitted'` — asserts `status === 'submitted'` and `reviewer_id === null`

### 8. Return-to-draft preserves data: PASS

**Code path:**
- `campaign.ts:512-523`: `returnToDraft()` — only changes `status: 'draft'` and `updatedAt`; spreads all other props including `reviewerId`, `reviewerComment` (preserved for audit history per spec)
- Verified by test: `'returns campaign to draft with data preserved'` — asserts `title` and `summary` unchanged

---

## Findings

### Notable UX Gap (Non-blocking)

**Hardcoded approval comment:**
`admin-review-queue.tsx:26-28` — `handleApprove` submits `'Campaign approved. Meets all curation criteria for Mars Mission Fund.'` as the reviewer comment without prompting the reviewer for input. The backend requires a non-empty comment (enforced by Zod + domain validation), so the API call succeeds. However, the intent of AC-006-003 is for the reviewer to provide meaningful, campaign-specific written rationale. Recommend implementing an approval comment modal.
