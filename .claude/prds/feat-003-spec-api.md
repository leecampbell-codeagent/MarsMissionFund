# PRD: feat-003 — Ports, Application Service & API Endpoints

> Sub-file 3 of 4. Part of `feat-003-spec.md`.
> Contents: Port interfaces, mock adapter behaviour, application service, API endpoint contracts.

---

## Port Interfaces

### `CampaignRepository`

**File:** `packages/backend/src/campaign/ports/campaign-repository.port.ts`

```typescript
export interface ListCampaignOptions {
  readonly limit?: number;
  readonly offset?: number;
}

export interface CampaignRepository {
  save(campaign: Campaign): Promise<void>;
  findById(id: string): Promise<Campaign | null>;
  findByCreatorUserId(creatorUserId: string, options?: ListCampaignOptions): Promise<Campaign[]>;
  findSubmittedOrderedBySubmittedAt(options?: ListCampaignOptions): Promise<Campaign[]>;
  updateStatus(
    campaignId: string,
    fromStatus: CampaignStatus,
    toStatus: CampaignStatus,
    updates?: Partial<CampaignStatusUpdate>
  ): Promise<Campaign>;
  updateDraftFields(campaignId: string, input: UpdateCampaignInput): Promise<Campaign>;
}

export interface CampaignStatusUpdate {
  readonly reviewedByUserId: string | null;
  readonly reviewNotes: string | null;
  readonly rejectionReason: string | null;
  readonly resubmissionGuidance: string | null;
  readonly reviewedAt: Date | null;
  readonly submittedAt: Date | null;
  readonly launchedAt: Date | null;
}
```

**Method contracts:**

| Method | Params | Returns | Notes |
|--------|--------|---------|-------|
| `save` | `campaign: Campaign` | `Promise<void>` | INSERT only. Throws if PK conflict. Used only for initial draft creation. |
| `findById` | `id: string` | `Promise<Campaign \| null>` | Lookup by UUID. Returns `null` if not found. No tenant isolation — access control enforced by application service. |
| `findByCreatorUserId` | `creatorUserId: string`, `options?` | `Promise<Campaign[]>` | Returns all campaigns for a creator, `createdAt DESC`. |
| `findSubmittedOrderedBySubmittedAt` | `options?` | `Promise<Campaign[]>` | Returns all `submitted` campaigns, `submittedAt ASC` (FIFO queue). |
| `updateStatus` | `campaignId`, `fromStatus`, `toStatus`, `updates?` | `Promise<Campaign>` | Atomic conditional UPDATE: `WHERE id = $1 AND status = $fromStatus`. If 0 rows returned, throws `CampaignAlreadyClaimedError` or `CampaignAlreadySubmittedError` depending on context. Returns updated campaign. |
| `updateDraftFields` | `campaignId: string`, `input: UpdateCampaignInput` | `Promise<Campaign>` | Partial UPDATE — only provided fields. No status check (caller verifies). Returns updated campaign. |

**`save` PostgreSQL query pattern:**

```sql
INSERT INTO campaigns (
  id, creator_user_id, title, status, created_at, updated_at
) VALUES (
  $1, $2, $3, 'draft', NOW(), NOW()
)
```

**`updateStatus` PostgreSQL query pattern (critical — G-020 pattern):**

```sql
UPDATE campaigns
SET status              = $2,
    reviewed_by_user_id = COALESCE($3, reviewed_by_user_id),
    review_notes        = COALESCE($4, review_notes),
    rejection_reason    = COALESCE($5, rejection_reason),
    resubmission_guidance = COALESCE($6, resubmission_guidance),
    reviewed_at         = COALESCE($7, reviewed_at),
    submitted_at        = COALESCE($8, submitted_at),
    launched_at         = COALESCE($9, launched_at),
    updated_at          = NOW()
WHERE id     = $1
  AND status = $10
RETURNING *
```

If `result.rowCount === 0`: throw `CampaignAlreadyClaimedError` (for claim transitions) or `CampaignAlreadySubmittedError` (for submit transitions). The calling application service method selects the correct error.

**`findSubmittedOrderedBySubmittedAt` PostgreSQL query pattern:**

```sql
SELECT * FROM campaigns
WHERE status = 'submitted'
ORDER BY submitted_at ASC
LIMIT $1 OFFSET $2
```

**`findByCreatorUserId` PostgreSQL query pattern:**

```sql
SELECT * FROM campaigns
WHERE creator_user_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3
```

**`updateDraftFields` PostgreSQL query pattern (dynamic — only update provided fields):**

The adapter builds the SET clause dynamically from the provided `input`. Every non-`undefined` field is included. Always includes `updated_at = NOW()`. No status filter in WHERE — the application service verifies status before calling.

**camelCase → snake_case field mapping for dynamic SET clause:**

| Input field (camelCase) | Column (snake_case) |
|-------------------------|---------------------|
| `title` | `title` |
| `shortDescription` | `short_description` |
| `description` | `description` |
| `category` | `category` |
| `heroImageUrl` | `hero_image_url` |
| `fundingGoalCents` | `funding_goal_cents` |
| `fundingCapCents` | `funding_cap_cents` |
| `deadline` | `deadline` |
| `milestones` | `milestones` (JSONB — serialize with `JSON.stringify`) |
| `teamMembers` | `team_members` (JSONB — serialize with `JSON.stringify`) |
| `riskDisclosures` | `risk_disclosures` (JSONB — serialize with `JSON.stringify`) |
| `budgetBreakdown` | `budget_breakdown` (JSONB — serialize with `JSON.stringify`) |
| `alignmentStatement` | `alignment_statement` |
| `tags` | `tags` (text[] — pass as array) |

```sql
UPDATE campaigns
SET <dynamic fields>, updated_at = NOW()
WHERE id = $1
RETURNING *
```

---

### `CampaignAuditRepository`

**File:** `packages/backend/src/campaign/ports/campaign-audit-repository.port.ts`

```typescript
export interface CampaignAuditEvent {
  readonly id: string;
  readonly campaignId: string;
  readonly actorUserId: string | null;
  readonly actorClerkUserId: string;
  readonly action: CampaignAuditAction;
  readonly previousStatus: CampaignStatus | null;
  readonly newStatus: CampaignStatus;
  readonly rationale: string | null;
  readonly metadata: Record<string, unknown> | null;
  readonly createdAt: Date;
}

export type CampaignAuditAction =
  | 'campaign.created'
  | 'campaign.updated'
  | 'campaign.submitted'
  | 'campaign.claimed'
  | 'campaign.approved'
  | 'campaign.rejected'
  | 'campaign.launched'
  | 'campaign.archived'
  | 'campaign.reassigned';

export interface CreateCampaignAuditEventInput {
  readonly campaignId: string;
  readonly actorUserId: string;
  readonly actorClerkUserId: string;
  readonly action: CampaignAuditAction;
  readonly previousStatus: CampaignStatus | null;
  readonly newStatus: CampaignStatus;
  readonly rationale?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface CampaignAuditRepository {
  createEvent(input: CreateCampaignAuditEventInput): Promise<CampaignAuditEvent>;
  findByCampaignId(campaignId: string): Promise<CampaignAuditEvent[]>;
}
```

**PostgreSQL implementation (`PgCampaignAuditRepository`):**

**File:** `packages/backend/src/campaign/adapters/pg-campaign-audit-repository.adapter.ts`

`createEvent` INSERT query:

```sql
INSERT INTO campaign_audit_events
  (campaign_id, actor_user_id, actor_clerk_user_id, action, previous_status, new_status, rationale, metadata)
VALUES
  ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING *
```

`findByCampaignId` query:

```sql
SELECT * FROM campaign_audit_events
WHERE campaign_id = $1
ORDER BY created_at ASC
```

**In-memory implementation (`InMemoryCampaignAuditRepository`):**

**File:** `packages/backend/src/campaign/adapters/in-memory-campaign-audit-repository.adapter.ts`

Stores events in `private readonly events: CampaignAuditEvent[] = []`. Generates `id` with `crypto.randomUUID()`. `findByCampaignId` returns all events where `campaignId` matches, ordered by `createdAt ASC`.

---

### `InMemoryCampaignRepository`

**File:** `packages/backend/src/campaign/adapters/in-memory-campaign-repository.adapter.ts`

Stores campaigns in `private campaigns: Map<string, Campaign>`. Implements all `CampaignRepository` methods using in-memory logic. `updateStatus` checks `fromStatus` matches and throws `CampaignAlreadyClaimedError` if not. Used in integration tests only.

---

## Application Service

### `CampaignAppService`

**File:** `packages/backend/src/campaign/application/campaign-app-service.ts`

**Dependencies (injected via constructor):**

| Dependency | Interface | Purpose |
|------------|-----------|---------|
| `campaignRepository` | `CampaignRepository` | Campaign persistence |
| `campaignAuditRepository` | `CampaignAuditRepository` | Audit event persistence |
| `userRepository` | `UserRepository` | User lookup for role/KYC checks |
| `logger` | `pino.Logger` | Structured operational logging |

**Named exports only. Explicit return types on all methods.**

---

#### `createDraft(clerkUserId: string, input: { title: string }): Promise<Campaign>`

Called by `POST /api/v1/campaigns`.

Steps:
1. **Load and validate user.** Call `userRepository.findByClerkUserId(clerkUserId)`. If `null`, throw `UserNotFoundError` → 404.
2. **Check account status.** If `user.accountStatus !== 'active'`, throw `AccountNotActiveError` → 403.
3. **Check Creator role.** If `!user.roles.includes('creator')`, throw `CreatorRoleRequiredError` → 403.
4. **Check KYC.** If `user.kycStatus !== 'verified'`, throw `KycNotVerifiedError` → 403.
5. **Create domain entity.** Call `Campaign.create({ creatorUserId: user.id, title: input.title.trim() })`. Throws `InvalidCampaignTitleError` if title is empty after trim.
6. **Persist.** Call `campaignRepository.save(campaign)`.
7. **Audit.** Call `campaignAuditRepository.createEvent({ campaignId: campaign.id, actorUserId: user.id, actorClerkUserId: clerkUserId, action: 'campaign.created', previousStatus: null, newStatus: 'draft' })`. Best-effort — if audit fails, log error at ERROR level but do not roll back the save.
8. **Return** the campaign.

**Error handling:**

| Error | HTTP | Code |
|-------|------|------|
| `UserNotFoundError` | 404 | `USER_NOT_FOUND` |
| `AccountNotActiveError` | 403 | `ACCOUNT_NOT_ACTIVE` |
| `CreatorRoleRequiredError` | 403 | `CREATOR_ROLE_REQUIRED` |
| `KycNotVerifiedError` | 403 | `KYC_NOT_VERIFIED` |
| `InvalidCampaignTitleError` | 400 | `INVALID_CAMPAIGN_TITLE` |
| Unhandled DB error | 500 | `INTERNAL_ERROR` |

---

#### `updateDraft(clerkUserId: string, campaignId: string, input: UpdateCampaignInput): Promise<Campaign>`

Called by `PATCH /api/v1/campaigns/:id`.

`UpdateCampaignInput` — all fields optional (Partial update):

```typescript
interface UpdateCampaignInput {
  readonly title?: string;
  readonly shortDescription?: string;
  readonly description?: string;
  readonly category?: CampaignCategory;
  readonly heroImageUrl?: string | null;
  readonly fundingGoalCents?: string;
  readonly fundingCapCents?: string;
  readonly deadline?: string;  // ISO 8601 string
  readonly milestones?: Milestone[];
  readonly teamMembers?: TeamMember[];
  readonly riskDisclosures?: RiskDisclosure[];
  readonly budgetBreakdown?: BudgetItem[];
  readonly alignmentStatement?: string;
  readonly tags?: string[];
}
```

Steps:
1. **Load user.** Call `userRepository.findByClerkUserId(clerkUserId)`. If `null`, throw `UserNotFoundError`.
2. **Load campaign.** Call `campaignRepository.findById(campaignId)`. If `null`, throw `CampaignNotFoundError` → 404.
3. **Ownership check.** If `campaign.creatorUserId !== user.id`, throw `CampaignNotFoundError` → 404 (not 403 — do not reveal existence, EC-033).
4. **Editability check.** If `campaign.status` not in `EDITABLE_STATUSES`, throw `CampaignNotEditableError` → 409.
5. **Persist.** Call `campaignRepository.updateDraftFields(campaignId, input)`.
6. **Audit.** Call `campaignAuditRepository.createEvent({ campaignId, actorUserId: user.id, actorClerkUserId: clerkUserId, action: 'campaign.updated', previousStatus: campaign.status, newStatus: campaign.status })`. Best-effort.
7. **Return** the updated campaign.

**Structural validation rules (applied by Zod schema — not at submit time):**
- `title`: max 200 chars
- `shortDescription`: max 500 chars
- `description`: max 10,000 chars
- `heroImageUrl`: `https://` URL, max 2048 chars, or `null`
- `fundingGoalCents`: string matching `/^\d+$/` (positive integer, no leading zeros except bare "0" — actually must be > 0)
- `fundingCapCents`: same pattern
- `tags`: max 20 elements, each max 50 chars
- `alignmentStatement`: max 1,000 chars

**Error handling:**

| Error | HTTP | Code |
|-------|------|------|
| `UserNotFoundError` | 404 | `USER_NOT_FOUND` |
| `CampaignNotFoundError` | 404 | `CAMPAIGN_NOT_FOUND` |
| `CampaignNotEditableError` | 409 | `CAMPAIGN_NOT_EDITABLE` |
| `VALIDATION_ERROR` (Zod) | 400 | `VALIDATION_ERROR` |

---

#### `submitCampaign(clerkUserId: string, campaignId: string): Promise<Campaign>`

Called by `POST /api/v1/campaigns/:id/submit`.

Steps:
1. **Load user.** `userRepository.findByClerkUserId(clerkUserId)`. If `null` → 404.
2. **Check Creator role.** If `!user.roles.includes('creator')` → `CreatorRoleRequiredError` → 403 (EC-043).
3. **Check KYC.** If `user.kycStatus !== 'verified'` → `KycNotVerifiedError` → 403 (EC-044).
4. **Load campaign.** `campaignRepository.findById(campaignId)`. If `null` → `CampaignNotFoundError` → 404.
5. **Ownership check.** If `campaign.creatorUserId !== user.id` → `CampaignNotFoundError` → 404.
6. **State check.** If `campaign.status === 'under_review'` or `campaign.status === 'approved'` → `CampaignNotRevizableError` → 409 (EC-017). If `campaign.status` not in `SUBMITTABLE_STATUSES` → `CampaignNotSubmittableError` → 409.
7. **Submission validation** — validate ALL required fields against the current `campaign` object:
   a. `title`: non-empty after trim
   b. `shortDescription`: non-empty, max 500 chars
   c. `description`: non-empty, max 10,000 chars
   d. `alignmentStatement`: non-empty, max 1,000 chars
   e. `category`: must be a valid `CampaignCategory`
   f. `fundingGoalCents`: must be a string representing integer ≥ 100,000,000 (= $1M)
   g. `fundingCapCents`: must be ≥ `fundingGoalCents`
   h. `deadline`: must be ≥ 7 days from `now` AND ≤ 365 days from `now` (compare UTC timestamps)
   i. `teamMembers`: min 1 element, max 20
   j. `milestones`: min 2 elements, max 10; each `fundingBasisPoints` ≥ 1; sum of all `fundingBasisPoints` = 10000
   k. `riskDisclosures`: min 1 element, max 10

   If any validation fails, throw `SubmissionValidationError` with a `field` and `message` indicating exactly which check failed and the current value vs. the requirement. (See error message examples in the edge cases table in feat-003-spec-ui.md.)
8. **Atomic state transition.** Call `campaignRepository.updateStatus(campaignId, campaign.status, 'submitted', { submittedAt: new Date() })`. If throws (0 rows — concurrent submit), throw `CampaignAlreadySubmittedError` → 409 (EC-016).
9. **Audit.** Call `campaignAuditRepository.createEvent({ ..., action: 'campaign.submitted', previousStatus: campaign.status, newStatus: 'submitted' })`. Best-effort.
10. **Return** the updated campaign.

**Error handling:**

| Error | HTTP | Code |
|-------|------|------|
| `UserNotFoundError` | 404 | `USER_NOT_FOUND` |
| `CreatorRoleRequiredError` | 403 | `CREATOR_ROLE_REQUIRED` |
| `KycNotVerifiedError` | 403 | `KYC_NOT_VERIFIED` |
| `CampaignNotFoundError` | 404 | `CAMPAIGN_NOT_FOUND` |
| `CampaignNotRevizableError` | 409 | `CAMPAIGN_NOT_REVIZABLE` |
| `CampaignNotSubmittableError` | 409 | `CAMPAIGN_NOT_SUBMITTABLE` |
| `SubmissionValidationError` | 400 | `SUBMISSION_VALIDATION_ERROR` |
| `CampaignAlreadySubmittedError` | 409 | `CAMPAIGN_ALREADY_SUBMITTED` |

---

#### `getCampaign(clerkUserId: string, campaignId: string): Promise<Campaign>`

Called by `GET /api/v1/campaigns/:id`.

Steps:
1. **Load user.** `userRepository.findByClerkUserId(clerkUserId)`. If `null` → 404.
2. **Load campaign.** `campaignRepository.findById(campaignId)`. If `null` → `CampaignNotFoundError` → 404.
3. **Access control check** — apply the access control matrix:
   - If user is Admin (`user.roles` includes `'administrator'` or `'super_administrator'`): allow access to any campaign in any status.
   - If user is Reviewer (`user.roles` includes `'reviewer'`): allow access only if status is NOT `'draft'`. If `draft` → `CampaignNotFoundError` → 404 (EC-034).
   - If `campaign.creatorUserId === user.id`: allow access to own campaign in any status.
   - Otherwise: allow access only if status is `'live'` or later terminal states. For pre-live states → `CampaignNotFoundError` → 404 (EC-033).
4. **Return** the campaign.

---

#### `listMyCampaigns(clerkUserId: string): Promise<Campaign[]>`

Called by `GET /api/v1/me/campaigns`.

Steps:
1. **Load user.** `userRepository.findByClerkUserId(clerkUserId)`. If `null` → 404.
2. **Query.** `campaignRepository.findByCreatorUserId(user.id)`.
3. **Return** the list (empty array if none).

---

#### `getReviewQueue(clerkUserId: string): Promise<Campaign[]>`

Called by `GET /api/v1/campaigns/review-queue`.

Steps:
1. **Load user.** `userRepository.findByClerkUserId(clerkUserId)`. If `null` → 404.
2. **Role check.** If user is NOT Reviewer AND NOT Admin → `ReviewerRoleRequiredError` → 403.
3. **Query.** `campaignRepository.findSubmittedOrderedBySubmittedAt()`.
4. **Return** the list (empty array if none, EC-031).

---

#### `claimCampaign(clerkUserId: string, campaignId: string): Promise<Campaign>`

Called by `POST /api/v1/campaigns/:id/claim`.

Steps:
1. **Load user.** `userRepository.findByClerkUserId(clerkUserId)`. If `null` → 404.
2. **Role check.** If NOT Reviewer AND NOT Admin → `ReviewerRoleRequiredError` → 403.
3. **Load campaign.** `campaignRepository.findById(campaignId)`. If `null` → 404.
4. **Pre-check state.** If `campaign.status !== 'submitted'` → `CampaignNotClaimableError` → 409. (Pre-check prevents unnecessary DB round-trip; the atomic UPDATE is still the final arbiter.)
5. **Atomic claim.** Call `campaignRepository.updateStatus(campaignId, 'submitted', 'under_review', { reviewedByUserId: user.id })`. If throws (0 rows), throw `CampaignAlreadyClaimedError` → 409 (EC-018).
6. **Audit.** `createEvent({ ..., action: 'campaign.claimed', previousStatus: 'submitted', newStatus: 'under_review' })`. Best-effort.
7. **Return** the updated campaign.

---

#### `approveCampaign(clerkUserId: string, campaignId: string, reviewNotes: string): Promise<Campaign>`

Called by `POST /api/v1/campaigns/:id/approve`.

Steps:
1. **Load user.** `userRepository.findByClerkUserId(clerkUserId)`. If `null` → 404.
2. **Role check.** If NOT Reviewer AND NOT Admin → `ReviewerRoleRequiredError` → 403.
3. **Load campaign.** `campaignRepository.findById(campaignId)`. If `null` → 404.
4. **State check.** If `campaign.status !== 'under_review'` → `CampaignNotApprovableError` → 409.
5. **Reviewer assignment check.** If `campaign.reviewedByUserId !== user.id` AND user is NOT Admin → `NotAssignedReviewerError` → 403 (EC-019).
6. **Validate notes.** `reviewNotes.trim()` must be non-empty (enforced by Zod schema on route, but defence in depth here: throw `SubmissionValidationError` if empty, EC-020).
7. **Atomic approve.** `campaignRepository.updateStatus(campaignId, 'under_review', 'approved', { reviewNotes: reviewNotes.trim(), reviewedAt: new Date() })`.
8. **Audit.** `createEvent({ ..., action: 'campaign.approved', previousStatus: 'under_review', newStatus: 'approved', rationale: reviewNotes.trim() })`. Best-effort.
9. **Return** the updated campaign.

---

#### `rejectCampaign(clerkUserId: string, campaignId: string, rejectionReason: string, resubmissionGuidance: string): Promise<Campaign>`

Called by `POST /api/v1/campaigns/:id/reject`.

Steps:
1. **Load user.** `userRepository.findByClerkUserId(clerkUserId)`. If `null` → 404.
2. **Role check.** If NOT Reviewer AND NOT Admin → `ReviewerRoleRequiredError` → 403.
3. **Load campaign.** `campaignRepository.findById(campaignId)`. If `null` → 404.
4. **State check.** If `campaign.status !== 'under_review'` → `CampaignNotRejectableError` → 409.
5. **Reviewer assignment check.** If `campaign.reviewedByUserId !== user.id` AND user is NOT Admin → `NotAssignedReviewerError` → 403 (EC-019).
6. **Validate fields.** Both `rejectionReason.trim()` and `resubmissionGuidance.trim()` must be non-empty (EC-021).
7. **Atomic reject.** `campaignRepository.updateStatus(campaignId, 'under_review', 'rejected', { rejectionReason: rejectionReason.trim(), resubmissionGuidance: resubmissionGuidance.trim(), reviewedAt: new Date() })`.
8. **Audit.** `createEvent({ ..., action: 'campaign.rejected', previousStatus: 'under_review', newStatus: 'rejected', rationale: rejectionReason.trim() })`. Best-effort.
9. **Return** the updated campaign.

---

#### `launchCampaign(clerkUserId: string, campaignId: string): Promise<Campaign>`

Called by `POST /api/v1/campaigns/:id/launch`.

Steps:
1. **Load user.** `userRepository.findByClerkUserId(clerkUserId)`. If `null` → 404.
2. **Load campaign.** `campaignRepository.findById(campaignId)`. If `null` → 404.
3. **Ownership check.** If `campaign.creatorUserId !== user.id` → `CampaignNotFoundError` → 404.
4. **State check.** If `campaign.status !== 'approved'` → `CampaignNotLaunchableError` → 409 (EC-022).
5. **Atomic launch.** `campaignRepository.updateStatus(campaignId, 'approved', 'live', { launchedAt: new Date() })`.
6. **Audit.** `createEvent({ ..., action: 'campaign.launched', previousStatus: 'approved', newStatus: 'live' })`. Best-effort.
7. **Return** the updated campaign.
8. **Future integration note:** Step 7.5 (after audit, before return) is where escrow creation would be triggered in a future feature. A comment must be added in the code at this point.

---

#### `archiveCampaign(clerkUserId: string, campaignId: string): Promise<Campaign>`

Called by `POST /api/v1/campaigns/:id/archive`.

Steps:
1. **Load user.** `userRepository.findByClerkUserId(clerkUserId)`. If `null` → 404.
2. **Load campaign.** `campaignRepository.findById(campaignId)`. If `null` → 404.
3. **Access check:**
   - If user is Admin: allow archiving any campaign in any status.
   - If `campaign.creatorUserId === user.id`: allow only if status in `CREATOR_ARCHIVABLE_STATUSES` (`draft`, `rejected`). If status not archivable → `CampaignCannotArchiveError` → 409.
   - Otherwise → `CampaignNotFoundError` → 404.
4. **Atomic archive.** `campaignRepository.updateStatus(campaignId, campaign.status, 'archived', {})`.
5. **Audit.** `createEvent({ ..., action: 'campaign.archived', previousStatus: campaign.status, newStatus: 'archived' })`. Best-effort.
6. **Return** the updated campaign.

---

#### `reassignReviewer(clerkUserId: string, campaignId: string, newReviewerUserId: string): Promise<Campaign>`

Called by `POST /api/v1/campaigns/:id/reassign`.

Steps:
1. **Load user.** `userRepository.findByClerkUserId(clerkUserId)`. If `null` → 404.
2. **Admin role check.** If user is NOT Admin → `AdminRoleRequiredError` → 403.
3. **Load campaign.** `campaignRepository.findById(campaignId)`. If `null` → 404.
4. **State check.** If `campaign.status !== 'under_review'` → `CampaignInvalidStateError` → 409 (EC-024).
5. **Validate new reviewer.** `userRepository.findById(newReviewerUserId)`. If `null` → 400 `USER_NOT_FOUND`. If user does not have `reviewer` role → `ReassignTargetNotReviewerError` → 400.
6. **Capture previous reviewer.** `const previousReviewerUserId = campaign.reviewedByUserId`.
7. **Update.** `campaignRepository.updateStatus(campaignId, 'under_review', 'under_review', { reviewedByUserId: newReviewerUserId })`.
8. **Audit.** `createEvent({ ..., action: 'campaign.reassigned', previousStatus: 'under_review', newStatus: 'under_review', metadata: { previousReviewerUserId, newReviewerUserId } })`. Best-effort.
9. **Return** the updated campaign.

---

### `AccountAppService` — New Method

**File:** `packages/backend/src/account/application/account-app-service.ts`

#### `assignCreatorRole(clerkUserId: string): Promise<User>`

Called by `POST /api/v1/me/roles/creator`.

Steps:
1. **Load user.** `userRepository.findByClerkUserId(clerkUserId)`. If `null` → `UserNotFoundError` → 404.
2. **Account status check.** If `user.accountStatus !== 'active'`:
   - If `'pending_verification'` → `AccountNotActiveError` → 403 (defined in `account/domain/errors/account-errors.ts`)
   - If `'suspended'` or `'deactivated'` → `AccountSuspendedError` → 403 (defined in `account/domain/errors/account-errors.ts`)
3. **KYC check.** If `user.kycStatus !== 'verified'` → `KycNotVerifiedError` (defined in `campaign/domain/errors/campaign-errors.ts`) → 403.
4. **Idempotency check.** If `user.roles.includes('creator')`:
   - Return the user unchanged (no error, no audit event — idempotent).
5. **Assign role.** Call `user.assignRole(Role.Creator)` → returns new `User` with `creator` in roles.
6. **Persist.** `userRepository.updateAccountStatus(clerkUserId, user.accountStatus, updatedUser.roles)`.
7. **Sync Clerk metadata.** `clerkAuth.setPublicMetadata(clerkUserId, { role: user.roles[0] })` — best-effort, log error if fails but do not throw.
8. **Audit.** `auditLogger.log({ action: 'role.assigned', actorClerkUserId: clerkUserId, resourceType: 'user', resourceId: user.id, timestamp: new Date(), metadata: { role: 'creator' } })`. Best-effort.
9. **Return** the updated `User`.

**Error handling:**

| Error | HTTP | Code |
|-------|------|------|
| `UserNotFoundError` | 404 | `USER_NOT_FOUND` |
| `AccountNotActiveError` | 403 | `ACCOUNT_NOT_ACTIVE` |
| `AccountSuspendedError` | 403 | `ACCOUNT_SUSPENDED` |
| `KycNotVerifiedError` | 403 | `KYC_NOT_VERIFIED` |

---

## Zod Schemas

### `createCampaignSchema`

**File:** `packages/backend/src/campaign/api/schemas/create-campaign.schema.ts`

```typescript
export const createCampaignSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200, 'Title must be 200 characters or fewer'),
}).strict();
```

### `updateCampaignSchema` (lenient — draft auto-save, G-026)

**File:** `packages/backend/src/campaign/api/schemas/update-campaign.schema.ts`

```typescript
export const updateCampaignSchema = z.object({
  title:               z.string().trim().min(1).max(200).optional(),
  shortDescription:    z.string().trim().max(500).optional(),
  description:         z.string().max(10000).optional(),
  category:            z.enum(CAMPAIGN_CATEGORIES).optional(),
  heroImageUrl:        z.string().url().startsWith('https://').max(2048).nullable().optional(),
  fundingGoalCents:    z.string().regex(/^[1-9]\d*$/, 'Must be a positive integer string').optional(),
  fundingCapCents:     z.string().regex(/^[1-9]\d*$/, 'Must be a positive integer string').optional(),
  deadline:            z.string().datetime().optional(),
  milestones:          z.array(milestoneSchema).max(10).optional(),
  teamMembers:         z.array(teamMemberSchema).max(20).optional(),
  riskDisclosures:     z.array(riskDisclosureSchema).max(10).optional(),
  budgetBreakdown:     z.array(budgetItemSchema).max(20).optional(),
  alignmentStatement:  z.string().max(1000).optional(),
  tags:                z.array(z.string().max(50)).max(20).optional(),
}).strict().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided' }
);
```

`milestoneSchema`, `teamMemberSchema`, `riskDisclosureSchema`, `budgetItemSchema` are defined in the same file. Structural validation only (max lengths, types). Business rules (e.g., milestone sum = 10000) are NOT in this schema — only in the submit endpoint.

**`milestoneSchema`:**
```typescript
const milestoneSchema = z.object({
  id:                   z.string().uuid(),
  title:                z.string().trim().min(1).max(200),
  description:          z.string().max(1000),
  fundingBasisPoints:   z.number().int().min(1).max(10000),
  targetDate:           z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
```

### `approveCampaignSchema`

**File:** `packages/backend/src/campaign/api/schemas/approve-campaign.schema.ts`

```typescript
export const approveCampaignSchema = z.object({
  reviewNotes: z.string().trim().min(1, 'Approval notes are required'),
}).strict();
```

### `rejectCampaignSchema`

**File:** `packages/backend/src/campaign/api/schemas/reject-campaign.schema.ts`

```typescript
export const rejectCampaignSchema = z.object({
  rejectionReason:       z.string().trim().min(1, 'Rejection reason is required'),
  resubmissionGuidance:  z.string().trim().min(1, 'Resubmission guidance is required'),
}).strict();
```

### `reassignCampaignSchema`

```typescript
export const reassignCampaignSchema = z.object({
  reviewerUserId: z.string().uuid('Must be a valid UUID'),
}).strict();
```

---

## API Endpoints

### Router Registration

**IMPORTANT (G-023):** The `/review-queue` route MUST be registered BEFORE the `/:id` route to prevent Express from treating `review-queue` as a campaign ID parameter.

**File:** `packages/backend/src/campaign/api/campaign-router.ts`

```typescript
export function createCampaignRouter(
  campaignAppService: CampaignAppService,
  logger: pino.Logger,
): Router
```

**Route registration order in the router:**

```typescript
router.get('/review-queue', getReviewQueueHandler);  // BEFORE /:id (G-023)
router.get('/:id', getCampaignHandler);
router.post('/', createCampaignHandler);
router.patch('/:id', updateCampaignHandler);
router.post('/:id/submit', submitCampaignHandler);
router.post('/:id/claim', claimCampaignHandler);
router.post('/:id/approve', approveCampaignHandler);
router.post('/:id/reject', rejectCampaignHandler);
router.post('/:id/launch', launchCampaignHandler);
router.post('/:id/archive', archiveCampaignHandler);
router.post('/:id/reassign', reassignCampaignHandler);
```

**App.ts wiring:**

```typescript
app.use('/api/v1/campaigns', requireAuth(...), createCampaignRouter(campaignAppService, logger));
```

The `/me/roles/creator` endpoint is added to the existing `accountRouter`.

---

### `POST /api/v1/me/roles/creator`

**Description:** Self-designate as a Creator. Idempotent — no error if already Creator.
**Auth:** Required (Clerk JWT).
**Roles:** Any active, KYC-verified user.

**Request body:** Empty (`{}` or no body).

**Validation:** `z.object({}).strict()` — reject any fields.

**Success response:** `200 OK`

```json
{
  "data": {
    "id": "...",
    "clerkUserId": "...",
    "email": "...",
    "displayName": "Ada Lovelace",
    "roles": ["backer", "creator"],
    "kycStatus": "verified",
    "accountStatus": "active",
    "... (full user profile shape as in GET /me)"
  }
}
```

**Error responses:**

| Status | Code | When |
|--------|------|------|
| 401 | `UNAUTHENTICATED` | No valid Clerk JWT |
| 403 | `ACCOUNT_NOT_ACTIVE` | `accountStatus !== 'active'` |
| 403 | `ACCOUNT_SUSPENDED` | `accountStatus = 'suspended'` or `'deactivated'` |
| 403 | `KYC_NOT_VERIFIED` | `kycStatus !== 'verified'` |
| 404 | `USER_NOT_FOUND` | No MMF user record |
| 500 | `INTERNAL_ERROR` | Unexpected DB error |

---

### `POST /api/v1/campaigns`

**Description:** Create a new campaign draft.
**Auth:** Required.
**Roles:** Creator + KYC verified.

**Request body:**
```json
{
  "title": "string — required, 1–200 chars"
}
```

**Validation:** `createCampaignSchema` (see above).

**Success response:** `201 Created`

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "creatorUserId": "660e8400-e29b-41d4-a716-446655440001",
    "title": "HelioShield: Advanced Radiation Protection for Mars Crews",
    "shortDescription": null,
    "description": null,
    "category": null,
    "heroImageUrl": null,
    "fundingGoalCents": null,
    "fundingCapCents": null,
    "deadline": null,
    "milestones": [],
    "teamMembers": [],
    "riskDisclosures": [],
    "budgetBreakdown": [],
    "alignmentStatement": null,
    "tags": [],
    "status": "draft",
    "rejectionReason": null,
    "resubmissionGuidance": null,
    "reviewNotes": null,
    "reviewedByUserId": null,
    "reviewedAt": null,
    "submittedAt": null,
    "launchedAt": null,
    "createdAt": "2026-03-05T15:00:00.000Z",
    "updatedAt": "2026-03-05T15:00:00.000Z"
  }
}
```

**Error responses:**

| Status | Code | When |
|--------|------|------|
| 400 | `VALIDATION_ERROR` | Zod validation fails |
| 401 | `UNAUTHENTICATED` | No JWT |
| 403 | `CREATOR_ROLE_REQUIRED` | Missing creator role |
| 403 | `KYC_NOT_VERIFIED` | `kycStatus !== 'verified'` |
| 403 | `ACCOUNT_NOT_ACTIVE` | Account not active |
| 404 | `USER_NOT_FOUND` | No MMF user record |
| 500 | `INTERNAL_ERROR` | DB error |

---

### `GET /api/v1/campaigns/:id`

**Description:** Get full campaign detail. Access control enforced per status/role.
**Auth:** Required.
**Roles:** Access varies — see application service access control matrix.

**Request body:** None.

**Success response:** `200 OK`

Same shape as the `POST /campaigns` success body. All fields included. `rejectionReason` and `resubmissionGuidance` are returned for the creator viewing their own rejected campaign (EC-035).

**Serialization note (G-024):** `fundingGoalCents` and `fundingCapCents` are returned as strings (from `pg` BIGINT → string, passed through without Number conversion). `budgetBreakdown[*].estimatedCents` also as string.

**Error responses:**

| Status | Code | When |
|--------|------|------|
| 401 | `UNAUTHENTICATED` | No JWT |
| 404 | `CAMPAIGN_NOT_FOUND` | Not found or access denied |
| 500 | `INTERNAL_ERROR` | DB error |

---

### `PATCH /api/v1/campaigns/:id`

**Description:** Auto-save draft fields. Partial update — any subset of fields.
**Auth:** Required.
**Roles:** Creator (own draft or rejected campaign only).

**Request body:** Any subset of `UpdateCampaignInput` fields.

```json
{
  "description": "string — optional",
  "category": "string — one of 10 categories, optional",
  "heroImageUrl": "https://... or null — optional",
  "fundingGoalCents": "string — integer, optional",
  "milestones": "array — optional",
  "..."
}
```

**Validation:** `updateCampaignSchema` (lenient — structural only, G-026).

**Success response:** `200 OK` — full campaign object (same shape as POST response).

**Error responses:**

| Status | Code | When |
|--------|------|------|
| 400 | `VALIDATION_ERROR` | Structural validation fails (field too long, bad URL, etc.) |
| 401 | `UNAUTHENTICATED` | No JWT |
| 404 | `CAMPAIGN_NOT_FOUND` | Not found, not owned by user, or access denied |
| 409 | `CAMPAIGN_NOT_EDITABLE` | Campaign not in draft/rejected status |
| 500 | `INTERNAL_ERROR` | DB error |

---

### `POST /api/v1/campaigns/:id/submit`

**Description:** Submit draft for review. Applies full submission validation.
**Auth:** Required.
**Roles:** Creator (own campaign) + KYC verified.

**Request body:** Empty (`{}` or no body). All validated data is read from the database.

**Validation:** `z.object({}).strict()` — no fields accepted.

**Success response:** `200 OK` — full campaign object with `status: 'submitted'` and `submittedAt` set.

**Error responses:**

| Status | Code | When |
|--------|------|------|
| 400 | `SUBMISSION_VALIDATION_ERROR` | Required field missing or business rule violated. Response includes `field` and `message`. |
| 401 | `UNAUTHENTICATED` | No JWT |
| 403 | `CREATOR_ROLE_REQUIRED` | Missing creator role (EC-043) |
| 403 | `KYC_NOT_VERIFIED` | KYC not verified (EC-044) |
| 404 | `CAMPAIGN_NOT_FOUND` | Not found or not owned |
| 409 | `CAMPAIGN_ALREADY_SUBMITTED` | Already submitted (EC-016) |
| 409 | `CAMPAIGN_NOT_REVIZABLE` | Campaign in under_review or approved state (EC-017) |
| 409 | `CAMPAIGN_NOT_SUBMITTABLE` | Campaign in invalid state for submission |
| 500 | `INTERNAL_ERROR` | DB error |

**Submission validation error response shape:**

```json
{
  "error": {
    "code": "SUBMISSION_VALIDATION_ERROR",
    "message": "Milestone funding basis points must sum to 10000. Current sum: 9000.",
    "field": "milestones"
  }
}
```

---

### `GET /api/v1/campaigns/review-queue`

**Description:** FIFO list of submitted campaigns for review. Oldest first.
**Auth:** Required.
**Roles:** Reviewer or Admin only.

**NOTE (G-023):** This route MUST be registered before `GET /:id` in the router.

**Request body:** None.

**Success response:** `200 OK`

```json
{
  "data": [
    {
      "id": "...",
      "title": "HelioShield: Advanced Radiation Protection for Mars Crews",
      "category": "radiation_protection",
      "fundingGoalCents": "150000000",
      "submittedAt": "2026-03-05T14:00:00.000Z",
      "creatorUserId": "...",
      "status": "submitted"
    }
  ]
}
```

The queue response is a summary view — NOT the full campaign with description, milestones, etc. Only: `id`, `title`, `category`, `fundingGoalCents`, `submittedAt`, `creatorUserId`, `status`.

**Error responses:**

| Status | Code | When |
|--------|------|------|
| 401 | `UNAUTHENTICATED` | No JWT |
| 403 | `REVIEWER_ROLE_REQUIRED` | Not a Reviewer or Admin (EC-032) |
| 404 | `USER_NOT_FOUND` | No MMF user record |
| 500 | `INTERNAL_ERROR` | DB error |

---

### `POST /api/v1/campaigns/:id/claim`

**Description:** Reviewer claims a submitted campaign for review (atomic).
**Auth:** Required.
**Roles:** Reviewer or Admin.

**Request body:** Empty.

**Success response:** `200 OK` — full campaign object with `status: 'under_review'` and `reviewedByUserId` set.

**Error responses:**

| Status | Code | When |
|--------|------|------|
| 401 | `UNAUTHENTICATED` | No JWT |
| 403 | `REVIEWER_ROLE_REQUIRED` | Not Reviewer or Admin |
| 404 | `CAMPAIGN_NOT_FOUND` | Not found |
| 409 | `CAMPAIGN_ALREADY_CLAIMED` | Race condition — another reviewer claimed first (EC-018) |
| 409 | `CAMPAIGN_NOT_CLAIMABLE` | Not in submitted status |
| 500 | `INTERNAL_ERROR` | DB error |

---

### `POST /api/v1/campaigns/:id/approve`

**Description:** Approve campaign. Requires review notes.
**Auth:** Required.
**Roles:** Reviewer (assigned) or Admin.

**Request body:**
```json
{
  "reviewNotes": "string — required, non-empty"
}
```

**Validation:** `approveCampaignSchema`.

**Success response:** `200 OK` — full campaign object with `status: 'approved'`.

**Error responses:**

| Status | Code | When |
|--------|------|------|
| 400 | `VALIDATION_ERROR` | `reviewNotes` empty or missing (EC-020) |
| 401 | `UNAUTHENTICATED` | No JWT |
| 403 | `REVIEWER_ROLE_REQUIRED` | Not a Reviewer or Admin |
| 403 | `NOT_ASSIGNED_REVIEWER` | Not the assigned reviewer (EC-019) |
| 404 | `CAMPAIGN_NOT_FOUND` | Not found |
| 409 | `CAMPAIGN_NOT_APPROVABLE` | Not in under_review status |
| 500 | `INTERNAL_ERROR` | DB error |

---

### `POST /api/v1/campaigns/:id/reject`

**Description:** Reject campaign with rationale and resubmission guidance. Both fields required.
**Auth:** Required.
**Roles:** Reviewer (assigned) or Admin.

**Request body:**
```json
{
  "rejectionReason": "string — required, non-empty",
  "resubmissionGuidance": "string — required, non-empty"
}
```

**Validation:** `rejectCampaignSchema`.

**Success response:** `200 OK` — full campaign object with `status: 'rejected'`.

**Error responses:**

| Status | Code | When |
|--------|------|------|
| 400 | `VALIDATION_ERROR` | Either field empty or missing (EC-021) |
| 401 | `UNAUTHENTICATED` | No JWT |
| 403 | `REVIEWER_ROLE_REQUIRED` | Not a Reviewer or Admin |
| 403 | `NOT_ASSIGNED_REVIEWER` | Not the assigned reviewer (EC-019) |
| 404 | `CAMPAIGN_NOT_FOUND` | Not found |
| 409 | `CAMPAIGN_NOT_REJECTABLE` | Not in under_review status |
| 500 | `INTERNAL_ERROR` | DB error |

---

### `GET /api/v1/me/campaigns`

**Description:** List all campaigns created by the authenticated user.
**Auth:** Required.
**Roles:** Any authenticated user with MMF record.

**Request body:** None.

**Success response:** `200 OK`

```json
{
  "data": [
    {
      "id": "...",
      "title": "...",
      "status": "draft",
      "category": null,
      "fundingGoalCents": null,
      "submittedAt": null,
      "createdAt": "2026-03-05T15:00:00.000Z",
      "updatedAt": "2026-03-05T15:05:00.000Z"
    }
  ]
}
```

Summary view — includes: `id`, `title`, `status`, `category`, `fundingGoalCents`, `submittedAt`, `createdAt`, `updatedAt`. Not the full campaign with description/milestones.

**Error responses:**

| Status | Code | When |
|--------|------|------|
| 401 | `UNAUTHENTICATED` | No JWT |
| 404 | `USER_NOT_FOUND` | No MMF user record |
| 500 | `INTERNAL_ERROR` | DB error |

---

### `POST /api/v1/campaigns/:id/launch`

**Description:** Launch an approved campaign to Live state.
**Auth:** Required.
**Roles:** Creator (own approved campaign only).

**Request body:** Empty.

**Success response:** `200 OK` — full campaign object with `status: 'live'` and `launchedAt` set.

**Error responses:**

| Status | Code | When |
|--------|------|------|
| 401 | `UNAUTHENTICATED` | No JWT |
| 404 | `CAMPAIGN_NOT_FOUND` | Not found or not owned |
| 409 | `CAMPAIGN_NOT_LAUNCHABLE` | Not in approved status (EC-022) |
| 500 | `INTERNAL_ERROR` | DB error |

---

### `POST /api/v1/campaigns/:id/archive`

**Description:** Archive a campaign. Creator: draft/rejected only. Admin: any status.
**Auth:** Required.
**Roles:** Creator (own campaign in archivable status) or Admin.

**Request body:** Empty.

**Success response:** `200 OK` — full campaign object with `status: 'archived'`.

**Error responses:**

| Status | Code | When |
|--------|------|------|
| 401 | `UNAUTHENTICATED` | No JWT |
| 404 | `CAMPAIGN_NOT_FOUND` | Not found or access denied |
| 409 | `CAMPAIGN_CANNOT_ARCHIVE` | Creator attempting to archive non-archivable status |
| 500 | `INTERNAL_ERROR` | DB error |

---

### `POST /api/v1/campaigns/:id/reassign`

**Description:** Admin reassigns reviewer for a campaign under review.
**Auth:** Required.
**Roles:** Admin only.

**Request body:**
```json
{
  "reviewerUserId": "string — UUID of the new reviewer"
}
```

**Validation:** `reassignCampaignSchema`.

**Success response:** `200 OK` — full campaign object with updated `reviewedByUserId`.

**Error responses:**

| Status | Code | When |
|--------|------|------|
| 400 | `VALIDATION_ERROR` | `reviewerUserId` not a valid UUID |
| 400 | `REASSIGN_TARGET_NOT_REVIEWER` | Target user lacks reviewer role |
| 401 | `UNAUTHENTICATED` | No JWT |
| 403 | `ADMIN_ROLE_REQUIRED` | Not an Admin |
| 404 | `CAMPAIGN_NOT_FOUND` | Campaign not found |
| 404 | `USER_NOT_FOUND` | `reviewerUserId` not found |
| 409 | `CAMPAIGN_INVALID_STATE` | Campaign not in under_review status (EC-024) |
| 500 | `INTERNAL_ERROR` | DB error |

---

## Serializer

**File:** `packages/backend/src/campaign/api/campaign-serializer.ts`

```typescript
export function serializeCampaign(campaign: Campaign): SerializedCampaign
export function serializeCampaignSummary(campaign: Campaign): SerializedCampaignSummary
```

**`serializeCampaign`** — full campaign object:
- All fields serialized to camelCase JSON.
- `fundingGoalCents` and `fundingCapCents`: returned as-is (already strings from DB — do NOT parse to Number, G-024).
- `deadline`, `reviewedAt`, `submittedAt`, `launchedAt`, `createdAt`, `updatedAt`: serialized as ISO 8601 strings via `.toISOString()`.
- `milestones`, `teamMembers`, `riskDisclosures`, `budgetBreakdown`: returned as-is from the domain (already camelCase — the repository adapter converts snake_case JSONB to camelCase on read).

**`serializeCampaignSummary`** — minimal fields for list views:
- `id`, `creatorUserId`, `title`, `status`, `category`, `fundingGoalCents`, `submittedAt`, `createdAt`, `updatedAt`

---

## Composition Root

**File:** `packages/backend/src/composition-root.ts`

Add the following wiring after existing account/KYC service instantiation:

```typescript
// Campaign bounded context
const campaignRepository: CampaignRepository = new PgCampaignRepository(pool);
const campaignAuditRepository: CampaignAuditRepository = new PgCampaignAuditRepository(pool);
const campaignAppService = new CampaignAppService(
  campaignRepository,
  campaignAuditRepository,
  userRepository,  // shared from account context
  logger,
);
```

**`app.ts` wiring:**

```typescript
import { createCampaignRouter } from './campaign/api/campaign-router';

// After existing KYC router registration:
app.use('/api/v1/campaigns', requireAuth({...}), createCampaignRouter(campaignAppService, logger));
```

**Error handler registration** — add to `packages/backend/src/shared/middleware/error-handler.ts`:

```typescript
// Campaign domain errors → HTTP status codes:
CreatorRoleRequiredError:    403
KycNotVerifiedError:         403  (already registered from feat-002 if using same class)
CampaignNotEditableError:    409
CampaignAlreadySubmittedError: 409
CampaignNotRevizableError:   409
CampaignNotClaimableError:   409
CampaignAlreadyClaimedError: 409
CampaignNotApprovableError:  409
CampaignNotRejectableError:  409
CampaignNotLaunchableError:  409
CampaignCannotArchiveError:  409
CampaignInvalidStateError:   409
CampaignNotFoundError:       404
NotAssignedReviewerError:    403
ReviewerRoleRequiredError:   403
AdminRoleRequiredError:      403
ReassignTargetNotReviewerError: 400
MilestoneValidationError:    400
SubmissionValidationError:   400
```

---

## Standard Error Response Format

All error responses use the same envelope established in feat-001:

```json
{
  "error": {
    "code": "MACHINE_READABLE_CODE",
    "message": "Human-readable message.",
    "field": "optional — field name for validation errors"
  }
}
```

`correlation_id` is included per P-008 (via request middleware).
