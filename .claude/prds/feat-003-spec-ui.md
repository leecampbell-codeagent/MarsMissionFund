# PRD: feat-003 — Frontend Specification, Edge Cases & Testing

> Sub-file 4 of 4. Part of `feat-003-spec.md`.
> Contents: Frontend functional requirements, components, state management, edge cases (all 45), testing requirements.

---

## Frontend Specification

### New API Client

**File:** `packages/frontend/src/api/campaign-api.ts`

Follows the pattern of `packages/frontend/src/api/account-api.ts`. All functions use the authenticated API client from `packages/frontend/src/api/client.ts`.

**Functions:**

```typescript
export async function createCampaign(input: { title: string }): Promise<Campaign>
export async function updateCampaign(id: string, input: UpdateCampaignInput): Promise<Campaign>
export async function submitCampaign(id: string): Promise<Campaign>
export async function getCampaign(id: string): Promise<Campaign>
export async function listMyCampaigns(): Promise<CampaignSummary[]>
export async function getReviewQueue(): Promise<CampaignSummary[]>
export async function claimCampaign(id: string): Promise<Campaign>
export async function approveCampaign(id: string, input: { reviewNotes: string }): Promise<Campaign>
export async function rejectCampaign(id: string, input: { rejectionReason: string; resubmissionGuidance: string }): Promise<Campaign>
export async function launchCampaign(id: string): Promise<Campaign>
export async function archiveCampaign(id: string): Promise<Campaign>
export async function reassignReviewer(id: string, input: { reviewerUserId: string }): Promise<Campaign>
export async function assignCreatorRole(): Promise<User>
```

**Frontend types** (in `packages/frontend/src/types/campaign.ts`):

```typescript
export interface Campaign {
  readonly id: string;
  readonly creatorUserId: string;
  readonly title: string;
  readonly shortDescription: string | null;
  readonly description: string | null;
  readonly category: CampaignCategory | null;
  readonly heroImageUrl: string | null;
  readonly fundingGoalCents: string | null;   // string — never parse to Number (G-024)
  readonly fundingCapCents: string | null;    // string — never parse to Number (G-024)
  readonly deadline: string | null;           // ISO 8601 UTC string
  readonly milestones: Milestone[];
  readonly teamMembers: TeamMember[];
  readonly riskDisclosures: RiskDisclosure[];
  readonly budgetBreakdown: BudgetItem[];
  readonly alignmentStatement: string | null;
  readonly tags: string[];
  readonly status: CampaignStatus;
  readonly rejectionReason: string | null;
  readonly resubmissionGuidance: string | null;
  readonly reviewNotes: string | null;
  readonly reviewedByUserId: string | null;
  readonly reviewedAt: string | null;
  readonly submittedAt: string | null;
  readonly launchedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CampaignSummary {
  readonly id: string;
  readonly creatorUserId: string;
  readonly title: string;
  readonly status: CampaignStatus;
  readonly category: CampaignCategory | null;
  readonly fundingGoalCents: string | null;
  readonly submittedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}
```

**Monetary display rule:** All `*Cents` fields are `string`. Display using `Intl.NumberFormat`:

```typescript
function formatCents(cents: string): string {
  const dollars = Number(cents) / 100;  // Safe: MMF amounts fit in Number.MAX_SAFE_INTEGER
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(dollars);
}
```

**Milestone basis points display:**

```typescript
function formatBasisPoints(basisPoints: number): string {
  return `${(basisPoints / 100).toFixed(2)}%`;
}
```

---

### Pages

#### Creator Role Designation Page / Flow

**Route:** Integrated into onboarding or profile page — not a standalone page for feat-003.

**Functional requirements:**
- On the profile page (`/profile`), show a "Become a Creator" section if `user.kycStatus === 'verified'` AND `!user.roles.includes('creator')`.
- Show a "Verify Identity First" prompt if `kycStatus !== 'verified'` (linking to the KYC flow from feat-002).
- The "Become a Creator" button calls `assignCreatorRole()` mutation.
- On success: invalidate `['me']` TanStack Query key; show success state ("You are now a Creator").
- On error `KYC_NOT_VERIFIED`: show "Identity verification required" with link to KYC flow.
- Button is disabled and shows loading indicator while mutation is in-flight.

---

#### Campaign Create Page (Multi-Step Form)

**Route:** `/campaigns/new`
**Auth:** Required. Creator + KYC verified.
**Data requirements:** None on load (empty form). Campaign ID is created on first save.

**Functional requirements:**

The form is split into logical sections but not strict step-by-step with a blocker between steps. Creators can jump between sections. Each section is auto-saved on blur or after a debounce (500ms). The campaign draft is created on the server when the creator first lands on this page.

**Sections:**

1. **Basics**: Title (required to create), short description, category, alignment statement
2. **Details**: Full description (plain text, `<textarea>`, `white-space: pre-wrap` rendering — G-028), hero image URL
3. **Funding**: Funding goal (USD display via `Intl.NumberFormat`, stored as cents string), funding cap, deadline
4. **Team**: Team member entries (add/remove form rows)
5. **Milestones**: Milestone entries (add/remove form rows; running basis-points total shown to creator; submit blocked until sum = 10000)
6. **Risk**: Risk disclosures (add/remove form rows)
7. **Budget**: Budget breakdown line items (optional)
8. **Review & Submit**: Summary of all sections with validation status; Submit button

**State management:**

```typescript
// TanStack Query queries
useQuery(['campaign', id], () => getCampaign(id))

// TanStack Query mutations
const createMutation = useMutation(createCampaign)
const updateMutation = useMutation(({ id, input }) => updateCampaign(id, input))
const submitMutation = useMutation((id) => submitCampaign(id))
```

**Auto-save behaviour:**
- On field blur or after 500ms debounce, call `updateCampaign(id, { [field]: value })` mutation.
- Show "Saving..." → "Saved" indicator.
- If auto-save returns `CAMPAIGN_NOT_EDITABLE`, redirect to campaign detail page (campaign state changed externally).
- Do NOT block the UI during auto-save. Queue auto-saves; do not send concurrent PATCH requests for the same campaign.

**Funding goal input:**
- User inputs in USD dollars (e.g., "1500000").
- Frontend multiplies by 100 to convert to cents for the API.
- Display the entered value formatted via `Intl.NumberFormat` as confirmation.
- Min $1,000,000 shown as hint. Validation error shown immediately if below minimum.

**Milestone basis points:**
- Each milestone has a "Funding %" input showing percentage (0.01–100.00) with two decimal places.
- Frontend converts to basis points: `Math.round(percentage * 100)`.
- Show running total: "Total: 9500 / 10000 basis points (95.00%)". Warn if not 10000.
- Frontend warns immediately; server validates at submission.

**Submit button:**
- On the "Review & Submit" section, the Submit button is enabled only when there are no known local validation errors (not a hard gate — server validates authoritatively).
- On click: call `submitCampaign(id)`.
- If server returns `SUBMISSION_VALIDATION_ERROR`, display the specific field error inline.
- If success: redirect to `/campaigns/:id` (campaign detail page showing submitted status).

**States:**
- Loading: spinner while initial draft is created on mount.
- Saving: per-field indicator ("Saving...", "Saved", "Failed").
- Submit error: inline error per field from server response.
- Submit success: redirect.

---

#### Campaign Detail Page

**Route:** `/campaigns/:id`
**Auth:** Required.
**Data requirements:** `getCampaign(id)` — full campaign.

**Functional requirements:**

- Display all campaign fields: title, short description, description (rendered as `white-space: pre-wrap`), category, hero image (rendered as `<img src>` — only `https://` URLs accepted, EC-041), funding goal, funding cap, deadline, team members, milestones, risk disclosures, budget breakdown, alignment statement, tags.
- Display current status with a `CampaignStatusBadge` component.
- Display `submittedAt`, `createdAt`, `updatedAt` in user's local timezone using `Intl.DateTimeFormat`.

**Creator-specific UI:**
- In `draft` or `rejected` status: show "Edit Campaign" button (navigates to `/campaigns/:id/edit`).
- In `rejected` status: prominently display rejection reason and resubmission guidance (EC-035).
- In `approved` status: show "Launch Campaign" button; disable after click.
- In any status: show "Archive Campaign" button (only if status allows creator archiving).

**Reviewer-specific UI:**
- In `submitted` status: show "Claim for Review" button.
- In `under_review` and `reviewedByUserId === user.id`: show "Approve" and "Reject" buttons with forms.
- In `under_review` status: show who has claimed it.

**Admin-specific UI:**
- Show "Reassign Reviewer" button on `under_review` campaigns.
- Show "Archive Campaign" button on any campaign.

**State management:**

```typescript
useQuery(['campaign', id], () => getCampaign(id), { staleTime: 30_000 })

const claimMutation = useMutation(() => claimCampaign(id), {
  onSuccess: () => queryClient.invalidateQueries(['campaign', id])
})
const approveMutation = useMutation(({ reviewNotes }) => approveCampaign(id, { reviewNotes }), {
  onSuccess: () => queryClient.invalidateQueries(['campaign', id])
})
const rejectMutation = useMutation(({ rejectionReason, resubmissionGuidance }) => rejectCampaign(id, { rejectionReason, resubmissionGuidance }), {
  onSuccess: () => queryClient.invalidateQueries(['campaign', id])
})
const launchMutation = useMutation(() => launchCampaign(id), {
  onSuccess: () => queryClient.invalidateQueries(['campaign', id])
})
const archiveMutation = useMutation(() => archiveCampaign(id), {
  onSuccess: () => queryClient.invalidateQueries(['campaign', id])
})
```

**Loading state:** Skeleton UI while `getCampaign` resolves.
**Error state:** If `getCampaign` returns 404, show "Campaign not found" (no information about why — do not reveal if access-denied, EC-033).
**Empty state:** N/A.

---

#### My Campaigns Page

**Route:** `/me/campaigns`
**Auth:** Required.
**Data requirements:** `listMyCampaigns()` — summary list.

**Functional requirements:**

- Display a list of `CampaignCard` components (see below).
- Empty state: "You haven't created any campaigns yet. Start your Mars mission proposal." with a "Create Campaign" CTA button.
- "Create Campaign" button navigates to `/campaigns/new`.
- Each card links to `/campaigns/:id` (campaign detail page).

**State management:**

```typescript
useQuery(['myCampaigns'], listMyCampaigns)
```

---

#### Review Queue Page

**Route:** `/review-queue`
**Auth:** Required. Reviewer or Admin only.
**Data requirements:** `getReviewQueue()` — summary list.

**Functional requirements:**

- Display a list of `CampaignCard` components in submission order (oldest first — FIFO).
- Each card shows: title, category, funding goal (formatted in USD), submission timestamp ("Submitted X days ago").
- Empty state: "No campaigns awaiting review." (Not an error — EC-031).
- Each card links to `/campaigns/:id` for full review.
- If user is not Reviewer or Admin: redirect to home with an error message (role check on page load).
- Show submission age prominently — campaigns submitted more than 5 days ago should display an overdue indicator (matches L4-002 Section 5.4 SLA guidance).

**State management:**

```typescript
useQuery(['reviewQueue'], getReviewQueue, { refetchInterval: 60_000 })  // poll every minute
```

---

### Components

#### `CampaignStatusBadge`

**File:** `packages/frontend/src/components/campaign/campaign-status-badge/CampaignStatusBadge.tsx`

Displays campaign status as a colour-coded badge.

**Status → colour mapping** (using semantic tokens):

| Status | Token | Display text |
|--------|-------|-------------|
| `draft` | `--color-bg-elevated` / `--color-text-tertiary` / `--color-border-subtle` | "Draft" |
| `submitted` | `--color-status-warning` | "Submitted" |
| `under_review` | `--color-status-warning` | "Under Review" |
| `approved` | `--color-status-success` | "Approved" |
| `rejected` | `--color-status-error` | "Rejected" |
| `live` | `--color-status-success` | "Live" |
| `archived` | `--color-bg-elevated` / `--color-text-tertiary` / `--color-border-subtle` | "Archived" |

**Props:**

```typescript
interface CampaignStatusBadgeProps {
  readonly status: CampaignStatus;
}
```

---

#### `CampaignCard`

**File:** `packages/frontend/src/components/campaign/campaign-card/CampaignCard.tsx`

Summary card for use in list views (my campaigns, review queue).

**Props:**

```typescript
interface CampaignCardProps {
  readonly campaign: CampaignSummary;
  readonly onClick?: () => void;
}
```

**Displays:** Title (truncated at 2 lines), status badge, category (human-readable label), funding goal (formatted USD), submitted/created date.

**States:** Default, hover (cursor pointer if `onClick` provided).

Uses `--gradient-surface-card` for card background. Title uses `--font-display` (Bebas Neue, uppercase). Meta info uses `--font-body` (DM Sans). Amounts use `--font-data` (Space Mono).

---

#### `CampaignForm` (multi-section)

**File:** `packages/frontend/src/components/campaign/campaign-form/`

Multi-section form with auto-save. Each section is a sub-component:
- `BasicsSection.tsx`
- `DetailsSection.tsx`
- `FundingSection.tsx`
- `TeamSection.tsx`
- `MilestonesSection.tsx`
- `RiskSection.tsx`
- `BudgetSection.tsx`
- `ReviewSubmitSection.tsx`

Each section handles its own validation display. The parent `CampaignForm.tsx` manages the active campaign state and auto-save debounce.

**Milestone sum indicator component** (in `MilestonesSection.tsx`):
- Shows running total basis points / 10000 and equivalent percentage.
- Green when total = 10000, warning colour otherwise.

**Description field:**
- `<textarea>` with `white-space: pre-wrap` CSS applied to the preview.
- Max 10,000 characters — show character count.
- Plain text only — do NOT use a rich text editor (G-028).

---

#### `ReviewActionPanel`

**File:** `packages/frontend/src/components/campaign/review-action-panel/ReviewActionPanel.tsx`

Shown to Reviewers on the campaign detail page when campaign is in `under_review` and they are the assigned reviewer.

**Contains:**
- Approve form: `<textarea>` for review notes + Approve button.
- Reject form: `<textarea>` for rejection reason + `<textarea>` for resubmission guidance + Reject button.
- Both forms require non-empty content before submit button is enabled.

**Props:**

```typescript
interface ReviewActionPanelProps {
  readonly campaignId: string;
  readonly onApprove: (reviewNotes: string) => void;
  readonly onReject: (rejectionReason: string, resubmissionGuidance: string) => void;
  readonly isLoading: boolean;
}
```

---

### Design System Compliance

All components must follow the brand standards from `specs/standards/brand.md` (L2-001):

- **Background:** `--color-bg-page` (`--void` / #060A14) — dark-first
- **Card backgrounds:** `--gradient-surface-card`
- **Primary CTAs** (Submit, Launch, Approve): `--gradient-action-primary` with `--color-action-primary-shadow`
- **Destructive CTAs** (Reject, Archive): `--color-status-error` styling
- **Headings:** `--font-display` (Bebas Neue), uppercase
- **Body text:** `--font-body` (DM Sans)
- **Data/labels** (amounts, dates, IDs): `--font-data` (Space Mono)
- **Status colours:** `--color-status-success`, `--color-status-error`, `--color-status-warning` per the badge mapping above
- **One primary CTA per viewport** — Submit is primary on campaign create; no competing primary buttons

**Animation:** All transitions use semantic motion tokens. Respect `prefers-reduced-motion`.

---

## Edge Cases

All 45 edge cases from `feat-003-research.md` Section 5 with defined behaviours:

### Data Edge Cases

| # | Scenario | Expected Behaviour | Test Type |
|---|----------|--------------------|-----------|
| EC-001 | Summary exceeds 500 characters at submission | `submitCampaign` returns `400 SUBMISSION_VALIDATION_ERROR` with `field: 'shortDescription'`, message: "Short description must be 500 characters or fewer. Provided: {n}." | Integration |
| EC-002 | Milestone basis points sum to 9000 (off-by-one) | `submitCampaign` returns `400 SUBMISSION_VALIDATION_ERROR` with `field: 'milestones'`, message: "Milestone funding basis points must sum to 10000. Current sum: 9000." | Integration |
| EC-003 | Milestone basis points sum to 10001 (over by one) | Same pattern: `"Current sum: 10001."` | Integration |
| EC-004 | Zero milestones at submission | `400 SUBMISSION_VALIDATION_ERROR` with `field: 'milestones'`, message: "At least 2 milestones are required." | Integration |
| EC-005 | Only one milestone at submission | `400 SUBMISSION_VALIDATION_ERROR` with `field: 'milestones'`, message: "At least 2 milestones are required." (The 100% basis points check passes but count check fires first.) | Integration |
| EC-006 | A milestone has `fundingBasisPoints: 0` | `400 SUBMISSION_VALIDATION_ERROR` with `field: 'milestones'`, message: "Each milestone must have a funding allocation greater than zero." | Integration |
| EC-007 | `fundingGoalCents: "50000000"` (below $1M) | `400 SUBMISSION_VALIDATION_ERROR` with `field: 'fundingGoalCents'`, message: "Minimum funding goal is $1,000,000 (100000000 cents)." | Integration |
| EC-008 | `fundingCapCents` below `fundingGoalCents` | `400 SUBMISSION_VALIDATION_ERROR` with `field: 'fundingCapCents'`, message: "Funding cap must be greater than or equal to the funding goal." | Integration |
| EC-009 | `fundingGoalCents === fundingCapCents` | Valid — allowed. Campaign stops accepting contributions when goal is met. No error. | Unit |
| EC-010 | Deadline in the past at submission time | `400 SUBMISSION_VALIDATION_ERROR` with `field: 'deadline'`, message: "Deadline must be at least 7 days from now." | Integration |
| EC-011 | Deadline exactly 7 days from submission (boundary) | Valid — the boundary is inclusive. Comparison: `deadline >= submissionTimestamp + 7 * 24 * 60 * 60 * 1000`. Both in UTC to avoid DST issues. | Unit |
| EC-012 | No team members at submission | `400 SUBMISSION_VALIDATION_ERROR` with `field: 'teamMembers'`, message: "At least 1 team member is required." | Integration |
| EC-013 | No risk disclosures at submission | `400 SUBMISSION_VALIDATION_ERROR` with `field: 'riskDisclosures'`, message: "At least 1 risk disclosure is required." | Integration |
| EC-014 | Title is empty or whitespace-only | `POST /campaigns` returns `400 VALIDATION_ERROR`. `PATCH /campaigns/:id` with whitespace `title` returns `400 VALIDATION_ERROR`. Zod `.trim().min(1)` catches this. | Unit |
| EC-015 | `fundingGoalCents` sent as a number (not string) | `PATCH` or `POST`: `400 VALIDATION_ERROR` — Zod schema uses `z.string()` for monetary fields, rejects numbers. | Unit |

### State Machine Edge Cases

| # | Scenario | Expected Behaviour | Test Type |
|---|----------|--------------------|-----------|
| EC-016 | Double-submit (two concurrent submit requests) | First succeeds (draft → submitted). Second returns `409 CAMPAIGN_ALREADY_SUBMITTED`. Enforced by conditional WHERE `status = 'draft'` in `updateStatus`. | Integration |
| EC-017 | Creator submits a campaign in `under_review` state | `409 CAMPAIGN_NOT_REVIZABLE`. The `SUBMITTABLE_STATUSES` array does not include `under_review` or `approved`; this specific error fires for those states. | Unit |
| EC-018 | Two reviewers claim the same campaign simultaneously | First claim succeeds (submitted → under_review). Second returns `409 CAMPAIGN_ALREADY_CLAIMED`. Enforced by conditional WHERE `status = 'submitted'` in `updateStatus`. | Integration |
| EC-019 | Reviewer who did not claim tries to approve/reject | `403 NOT_ASSIGNED_REVIEWER`. Check: `campaign.reviewedByUserId !== user.id` AND user is not Admin. | Integration |
| EC-020 | Reviewer approves with empty `reviewNotes` | `400 VALIDATION_ERROR` from Zod schema (`z.string().trim().min(1)`). Also defended in service layer. | Unit + Integration |
| EC-021 | Reviewer rejects without `resubmissionGuidance` (or without `rejectionReason`) | `400 VALIDATION_ERROR`. Both fields required by `rejectCampaignSchema`. | Unit + Integration |
| EC-022 | Creator launches a campaign not in `approved` status | `409 CAMPAIGN_NOT_LAUNCHABLE`. State check in `launchCampaign` service method. | Unit |
| EC-023 | Creator attempts to revise an `approved` campaign via PATCH | `409 CAMPAIGN_NOT_EDITABLE`. `approved` is not in `EDITABLE_STATUSES`. Spec decision: creators cannot revise approved campaigns without admin intervention. | Unit |
| EC-024 | Admin reassigns reviewer on approved or rejected campaign | `409 CAMPAIGN_INVALID_STATE`. State check: `campaign.status !== 'under_review'`. | Unit |
| EC-025 | Creator deletes account while campaign is in `under_review` | Account deletion fails at the DB level: `ON DELETE RESTRICT` on `campaigns.creator_user_id` (G-027). The application layer (account deletion feature) must check for active campaigns before proceeding. For feat-003: document the constraint — account deletion is out of scope here. | Documentation |
| EC-026 | Draft campaign has no time limit | Drafts never auto-delete. No cron job or expiry logic in feat-003. Explicit behaviour: `status = 'draft'` rows persist indefinitely. | Documentation |

### Concurrency Edge Cases

| # | Scenario | Expected Behaviour | Test Type |
|---|----------|--------------------|-----------|
| EC-027 | Concurrent PATCH (auto-save) and submit request | Both succeed independently. Submit reads the latest campaign state from DB (not from request body). PATCH and POST operate on the same DB row with no locking conflict — last-write-wins for the PATCH fields, submit uses conditional WHERE only on `status`. The combination is safe. | Integration |
| EC-028 | Two creators create campaigns with the same title | Both succeed — no uniqueness constraint on `campaigns.title`. Each creator gets their own draft with a different `id`. | Integration |

### Permission Edge Cases

| # | Scenario | Expected Behaviour | Test Type |
|---|----------|--------------------|-----------|
| EC-029 | Backer (no creator role) calls `POST /campaigns` | `403 CREATOR_ROLE_REQUIRED`. Role check fires before KYC check. | Integration |
| EC-030 | Creator role + KYC not verified calls `POST /campaigns` | `403 KYC_NOT_VERIFIED`. Both create and submit require `kycStatus='verified'` (spec decision). | Integration |
| EC-031 | Reviewer calls `GET /review-queue` with no submitted campaigns | `200 OK` with `{ "data": [] }` — empty array, not 404. | Integration |
| EC-032 | Backer calls `GET /review-queue` | `403 REVIEWER_ROLE_REQUIRED`. | Integration |
| EC-033 | Creator calls `GET /campaigns/:id` on another creator's draft | `404 CAMPAIGN_NOT_FOUND` — not 403. Do not reveal the existence of other creators' drafts. | Integration |
| EC-034 | Reviewer calls `GET /campaigns/:id` on a draft campaign | `404 CAMPAIGN_NOT_FOUND`. Reviewers can only see campaigns in `submitted` or later status (except admins). | Integration |
| EC-035 | Creator views their own rejected campaign | `200 OK` with `rejectionReason` and `resubmissionGuidance` fields populated in the response. | Integration |

### Boundary Edge Cases

| # | Scenario | Expected Behaviour | Test Type |
|---|----------|--------------------|-----------|
| EC-036 | Creator has multiple simultaneous drafts | Allowed — no limit. Each draft is a separate campaign record. `GET /me/campaigns` returns all. | Integration |
| EC-037 | `teamMembers` array has 21 elements | `PATCH /campaigns/:id` returns `400 VALIDATION_ERROR` — max 20 team members (caught by `updateCampaignSchema`). | Unit |
| EC-038 | `milestones` array has 11 elements | `PATCH /campaigns/:id` returns `400 VALIDATION_ERROR` — max 10 milestones (caught by `updateCampaignSchema`). `submit` also validates max 10. | Unit |
| EC-039 | `riskDisclosures` array has 11 elements | `400 VALIDATION_ERROR` — max 10 risk disclosures. | Unit |
| EC-040 | `description` field contains HTML or script tags | Stored as plain text. Backend does NOT parse or sanitise HTML — it treats the description as an opaque string. Frontend renders as `white-space: pre-wrap` inside a `<div>` (not via `dangerouslySetInnerHTML`). HTML tags appear as literal characters, not rendered. XSS is prevented by never injecting into the DOM as HTML. (G-028) | Unit |
| EC-041 | `heroImageUrl` is `javascript:alert('xss')` or `data:text/html,...` | `PATCH /campaigns/:id` returns `400 VALIDATION_ERROR`. Zod `z.string().url().startsWith('https://')` rejects non-https URLs. The `data:` and `javascript:` schemes fail the `https://` startsWith check. | Unit |
| EC-042 | `fundingGoalCents: "0100000000"` (leading zeros) | `400 VALIDATION_ERROR`. Zod regex `/^[1-9]\d*$/` rejects leading zeros. | Unit |

### Integration Edge Cases

| # | Scenario | Expected Behaviour | Test Type |
|---|----------|--------------------|-----------|
| EC-043 | Creator role removed between draft creation and submission | `POST /campaigns/:id/submit` returns `403 CREATOR_ROLE_REQUIRED`. Role check is point-in-time at submission — not cached from draft creation. | Integration |
| EC-044 | KYC expires between draft creation and submission | `POST /campaigns/:id/submit` returns `403 KYC_NOT_VERIFIED`. KYC check is point-in-time at submission. | Integration |
| EC-045 | Reviewer role removed while a campaign is `under_review` | The campaign remains in `under_review` with `reviewedByUserId` still set. The ex-reviewer can no longer access the review queue but the campaign is NOT automatically returned to `submitted`. An Admin must call `POST /campaigns/:id/reassign` to assign a new reviewer. The spec does NOT auto-return the campaign to the queue. Document this in admin runbook (not implemented in code for feat-003). | Documentation + Integration |

---

## Testing Requirements

### Unit Tests

**Campaign entity (`packages/backend/src/campaign/domain/models/campaign.test.ts`):**

- [ ] `Campaign.create()` — happy path with valid title and creatorUserId
- [ ] `Campaign.create()` — empty title after trim → `InvalidCampaignTitleError`
- [ ] `Campaign.create()` — title > 200 chars → `CampaignTitleTooLongError`
- [ ] `Campaign.create()` — sets all defaults correctly (status=draft, all arrays empty, all nullable=null)
- [ ] `campaign.updateDraft()` — updates provided fields, leaves others unchanged
- [ ] `campaign.updateDraft()` — throws `CampaignNotEditableError` when status is `submitted`
- [ ] `campaign.updateDraft()` — throws `CampaignNotEditableError` when status is `approved`
- [ ] `campaign.updateDraft()` — does NOT throw when status is `rejected` (editing allowed)
- [ ] `campaign.submit()` — transitions draft → submitted, sets submittedAt
- [ ] `campaign.submit()` — throws `CampaignNotSubmittableError` when already submitted
- [ ] `campaign.claim()` — transitions submitted → under_review, sets reviewedByUserId
- [ ] `campaign.claim()` — throws `CampaignNotClaimableError` when not submitted
- [ ] `campaign.approve()` — transitions under_review → approved
- [ ] `campaign.approve()` — throws `CampaignNotApprovableError` when not under_review
- [ ] `campaign.reject()` — transitions under_review → rejected, sets rejectionReason + resubmissionGuidance
- [ ] `campaign.launch()` — transitions approved → live, sets launchedAt
- [ ] `campaign.launch()` — throws `CampaignNotLaunchableError` when not approved (EC-022)
- [ ] `Campaign.reconstitute()` — no validation, reconstructs from raw data

**Zod schema unit tests (`packages/backend/src/campaign/api/schemas/`):**

- [ ] `updateCampaignSchema` — accepts all valid field types
- [ ] `updateCampaignSchema` — rejects `heroImageUrl` with `http://` scheme (EC-041)
- [ ] `updateCampaignSchema` — rejects `heroImageUrl` with `javascript:` scheme (EC-041)
- [ ] `updateCampaignSchema` — rejects `fundingGoalCents` as number (EC-015)
- [ ] `updateCampaignSchema` — rejects `fundingGoalCents` with leading zeros (EC-042)
- [ ] `updateCampaignSchema` — rejects `teamMembers` with 21 elements (EC-037)
- [ ] `updateCampaignSchema` — rejects `milestones` with 11 elements (EC-038)
- [ ] `updateCampaignSchema` — rejects `description` > 10,000 chars (structural check)
- [ ] `updateCampaignSchema` — accepts partial updates (any single field is valid)
- [ ] `updateCampaignSchema` — rejects empty object (no fields provided)
- [ ] `approveCampaignSchema` — rejects empty `reviewNotes` (EC-020)
- [ ] `rejectCampaignSchema` — rejects empty `rejectionReason` (EC-021)
- [ ] `rejectCampaignSchema` — rejects empty `resubmissionGuidance` (EC-021)

**Milestone basis points validation (unit tests in app service or separate utility):**

- [ ] Sum = 10000 → valid
- [ ] Sum = 9000 → `SubmissionValidationError` with current sum (EC-002)
- [ ] Sum = 10001 → error with current sum (EC-003)
- [ ] 0 milestones → error "at least 2 required" (EC-004)
- [ ] 1 milestone → error "at least 2 required" (EC-005)
- [ ] Milestone with `fundingBasisPoints: 0` → error (EC-006)
- [ ] 10 milestones summing to 10000 → valid (max milestone count boundary)
- [ ] 11 milestones → error (EC-038)
- [ ] Equal thirds: 3333 + 3333 + 3334 = 10000 → valid (G-025 demonstration)

**Deadline validation (unit tests):**

- [ ] Deadline exactly 7 days from now → valid (EC-011 boundary inclusive)
- [ ] Deadline 6 days 23 hours from now → error (EC-010)
- [ ] Deadline 365 days from now → valid
- [ ] Deadline 366 days from now → error (max boundary)
- [ ] Deadline in past → error (EC-010)

**Funding amount validation (unit tests):**

- [ ] `fundingGoalCents = "100000000"` (= $1M) → valid (boundary)
- [ ] `fundingGoalCents = "99999999"` → error (EC-007)
- [ ] `fundingGoalCents = fundingCapCents` → valid (EC-009)
- [ ] `fundingCapCents < fundingGoalCents` → error (EC-008)

### Integration Tests

**Campaign CRUD (`packages/backend/src/campaign/api/campaign-router.test.ts`):**

- [ ] `POST /campaigns` — creates draft successfully with valid title, creator role, KYC verified
- [ ] `POST /campaigns` — 403 when user lacks creator role (EC-029)
- [ ] `POST /campaigns` — 403 when KYC not verified (EC-030)
- [ ] `POST /campaigns` — 400 when title is whitespace (EC-014)
- [ ] `POST /campaigns` — 401 when no JWT
- [ ] `PATCH /campaigns/:id` — updates draft fields partially
- [ ] `PATCH /campaigns/:id` — 404 when campaign owned by different user (EC-033)
- [ ] `PATCH /campaigns/:id` — 409 when campaign is submitted (not editable)
- [ ] `PATCH /campaigns/:id` — 200 when campaign is rejected (editable, EC-017 revision flow)
- [ ] `PATCH /campaigns/:id` — 400 when `heroImageUrl` uses `http://` (EC-041)
- [ ] `PATCH /campaigns/:id` — 400 when `fundingGoalCents` is a number not string (EC-015)
- [ ] `PATCH /campaigns/:id` — 400 when `fundingGoalCents` has leading zeros (EC-042)
- [ ] `POST /campaigns/:id/submit` — submits successfully with all valid fields
- [ ] `POST /campaigns/:id/submit` — 400 when milestone sum ≠ 10000 (EC-002)
- [ ] `POST /campaigns/:id/submit` — 400 when only 1 milestone (EC-005)
- [ ] `POST /campaigns/:id/submit` — 400 when milestone has 0 basis points (EC-006)
- [ ] `POST /campaigns/:id/submit` — 400 when deadline too close (EC-010)
- [ ] `POST /campaigns/:id/submit` — 400 when funding goal below minimum (EC-007)
- [ ] `POST /campaigns/:id/submit` — 400 when funding cap below goal (EC-008)
- [ ] `POST /campaigns/:id/submit` — 400 when no team members (EC-012)
- [ ] `POST /campaigns/:id/submit` — 400 when no risk disclosures (EC-013)
- [ ] `POST /campaigns/:id/submit` — 409 when already submitted (double-submit, EC-016)
- [ ] `POST /campaigns/:id/submit` — 409 when campaign is under_review (EC-017)
- [ ] `POST /campaigns/:id/submit` — 403 when creator role removed (EC-043)
- [ ] `POST /campaigns/:id/submit` — 403 when KYC expired (EC-044)
- [ ] `GET /campaigns/:id` — 200 for campaign creator
- [ ] `GET /campaigns/:id` — 404 for reviewer viewing a draft (EC-034)
- [ ] `GET /campaigns/:id` — 200 for reviewer viewing submitted campaign
- [ ] `GET /campaigns/:id` — response includes rejectionReason for creator viewing rejected campaign (EC-035)
- [ ] `GET /campaigns/review-queue` — 200 with FIFO ordering for reviewer
- [ ] `GET /campaigns/review-queue` — 200 empty array when no submitted campaigns (EC-031)
- [ ] `GET /campaigns/review-queue` — 403 for backer (EC-032)
- [ ] `POST /campaigns/:id/claim` — 200 successful claim
- [ ] `POST /campaigns/:id/claim` — 409 concurrent claim conflict (EC-018)
- [ ] `POST /campaigns/:id/approve` — 200 with required notes
- [ ] `POST /campaigns/:id/approve` — 400 with empty notes (EC-020)
- [ ] `POST /campaigns/:id/approve` — 403 when reviewer not assigned (EC-019)
- [ ] `POST /campaigns/:id/reject` — 200 with both required fields
- [ ] `POST /campaigns/:id/reject` — 400 with missing resubmissionGuidance (EC-021)
- [ ] `POST /campaigns/:id/launch` — 200 for creator with approved campaign
- [ ] `POST /campaigns/:id/launch` — 409 for non-approved campaign (EC-022)
- [ ] `POST /campaigns/:id/archive` — 200 for creator archiving draft
- [ ] `POST /campaigns/:id/archive` — 409 for creator archiving submitted campaign
- [ ] `POST /campaigns/:id/reassign` — 200 for admin reassigning reviewer
- [ ] `POST /campaigns/:id/reassign` — 409 when campaign not under_review (EC-024)
- [ ] `POST /campaigns/:id/reassign` — 403 for non-admin
- [ ] `GET /me/campaigns` — 200 with user's own campaigns only
- [ ] `GET /me/campaigns` — 200 empty array when no campaigns
- [ ] Two creators can create campaigns with same title (EC-028)

**Creator role endpoint:**

- [ ] `POST /me/roles/creator` — 200 assigns creator role to verified active user
- [ ] `POST /me/roles/creator` — 200 idempotent if already creator (no error)
- [ ] `POST /me/roles/creator` — 403 when KYC not verified
- [ ] `POST /me/roles/creator` — 403 when account not active
- [ ] `POST /me/roles/creator` — audit event written

**Audit event tests:**

- [ ] `campaign.created` event is written on draft creation
- [ ] `campaign.submitted` event is written on submission
- [ ] `campaign.claimed` event is written on claim
- [ ] `campaign.approved` event is written on approval (with rationale)
- [ ] `campaign.rejected` event is written on rejection (with rationale)
- [ ] `campaign.launched` event is written on launch
- [ ] `campaign.reassigned` event is written with metadata containing both reviewer IDs

### Frontend Component Tests

**All component test files are `.test.tsx` files in the same directory as the component.**

- [ ] `CampaignStatusBadge` — renders correct label and colour token for each status
- [ ] `CampaignCard` — renders title, status badge, category, funding goal (formatted USD)
- [ ] `CampaignCard` — loading state (skeleton)
- [ ] `CampaignCard` — calls `onClick` when clicked
- [ ] `MilestonesSection` — shows running basis points total
- [ ] `MilestonesSection` — shows warning state when total ≠ 10000
- [ ] `MilestonesSection` — shows success state when total = 10000
- [ ] `ReviewActionPanel` — approve button disabled until notes non-empty
- [ ] `ReviewActionPanel` — reject button disabled until both fields non-empty
- [ ] Campaign Detail Page — displays `rejectionReason` when status is `rejected`
- [ ] Campaign Detail Page — 404 error state shows "Campaign not found" without leaking access reason
- [ ] My Campaigns Page — empty state shows "Create Campaign" CTA

### E2E Tests

**Full campaign creation → review → launch flow:**

1. User logs in, calls `POST /kyc/submit` → KYC verified
2. User calls `POST /me/roles/creator` → Creator role assigned
3. User calls `POST /campaigns` with title → Draft created
4. User calls `PATCH /campaigns/:id` multiple times to fill all fields
5. User calls `POST /campaigns/:id/submit` → Campaign submitted
6. Reviewer logs in, calls `GET /campaigns/review-queue` → Campaign appears
7. Reviewer calls `POST /campaigns/:id/claim` → Under Review
8. Reviewer calls `POST /campaigns/:id/approve` with notes → Approved
9. Creator calls `POST /campaigns/:id/launch` → Live
10. `GET /campaigns/:id` now returns `status: 'live'`

**Full rejection → revision → resubmission flow:**

1. Campaign in `under_review` state (reuse steps 1–7 from above)
2. Reviewer calls `POST /campaigns/:id/reject` with both fields
3. Creator calls `GET /campaigns/:id` → sees `rejectionReason` and `resubmissionGuidance`
4. Creator calls `PATCH /campaigns/:id` to update fields
5. Creator calls `POST /campaigns/:id/submit` → campaign resubmitted (rejected → submitted)
6. Reviewer calls review queue → campaign appears (FIFO — at end of queue with new `submittedAt`)
