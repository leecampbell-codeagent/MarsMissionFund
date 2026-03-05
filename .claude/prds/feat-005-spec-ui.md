# PRD: feat-005 — Frontend Specification, Edge Cases, and Testing

> Sub-file 4 of 4. Read `feat-005-spec.md`, `feat-005-spec-data.md`, and `feat-005-spec-api.md` first.

---

## 1. Frontend Types

File: `packages/frontend/src/types/contribution.ts`

```typescript
/**
 * Contribution — as returned by POST /api/v1/contributions and GET /api/v1/contributions/:id
 * amountCents is a STRING (per G-024, monetary rule — never parse to number).
 */
export interface Contribution {
  readonly id: string;
  readonly campaignId: string;
  readonly amountCents: string;       // BIGINT serialised as string
  readonly status: ContributionStatus;
  readonly transactionRef: string | null;
  readonly failureReason: string | null;
  readonly createdAt: string;         // ISO 8601
}

export type ContributionStatus = 'pending_capture' | 'captured' | 'failed';

export interface CreateContributionInput {
  readonly campaignId: string;
  readonly amountCents: string;       // Send as string per API contract
  readonly paymentToken: string;
}

/**
 * Display helper: converts cents string to formatted USD.
 * Uses Intl.NumberFormat — never manual formatting (frontend rule).
 */
export function formatContributionAmount(amountCents: string): string {
  const cents = parseInt(amountCents, 10);
  if (Number.isNaN(cents)) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}
```

---

## 2. API Client Functions

File: `packages/frontend/src/api/contribution-api.ts`

```typescript
/**
 * Contribution API functions — typed wrappers around the authenticated API client.
 * Maps to endpoints defined in feat-005-spec-api.md.
 */

import type { Contribution, CreateContributionInput } from '../types/contribution';
import { apiClient } from './client';

interface ContributionResponse {
  readonly data: Contribution;
}

interface ContributionListResponse {
  readonly data: Contribution[];
}

/**
 * POST /api/v1/contributions
 * Creates a new contribution. Always resolves (never throws for payment failure).
 * The returned contribution may have status 'failed' — check status field.
 * Throws ApiError for validation (400), auth (401), duplicate (409), campaign (422/404) errors.
 */
export async function createContribution(
  input: CreateContributionInput,
): Promise<Contribution> {
  const response = await apiClient<ContributionResponse>({
    method: 'POST',
    path: '/contributions',
    body: input,
  });
  return response.data;
}

/**
 * GET /api/v1/contributions/:id
 * Returns the authenticated user's contribution by ID.
 * Throws ApiError 404 if not found or belongs to another user.
 */
export async function getContribution(id: string): Promise<Contribution> {
  const response = await apiClient<ContributionResponse>({
    method: 'GET',
    path: `/contributions/${id}`,
  });
  return response.data;
}

/**
 * GET /api/v1/campaigns/:campaignId/contributions
 * Returns the authenticated user's contributions to a specific campaign.
 */
export async function listCampaignContributions(
  campaignId: string,
  limit = 20,
  offset = 0,
): Promise<Contribution[]> {
  const response = await apiClient<ContributionListResponse>({
    method: 'GET',
    path: `/campaigns/${campaignId}/contributions?limit=${limit}&offset=${offset}`,
  });
  return response.data;
}
```

---

## 3. Mutation Hook

File: `packages/frontend/src/hooks/campaign/use-contribute.ts`

```typescript
import { useMutation } from '@tanstack/react-query';
import { createContribution } from '../../api/contribution-api';
import type { CreateContributionInput, Contribution } from '../../types/contribution';

export interface UseContributeResult {
  readonly contribute: (input: CreateContributionInput) => void;
  readonly isPending: boolean;
  readonly contribution: Contribution | null;
  readonly error: Error | null;
  readonly reset: () => void;
}

export function useContribute(): UseContributeResult {
  const mutation = useMutation({
    mutationFn: createContribution,
  });

  return {
    contribute: mutation.mutate,
    isPending: mutation.isPending,
    contribution: mutation.data ?? null,
    error: mutation.error,
    reset: mutation.reset,
  };
}
```

---

## 4. ContributeToMissionPage

File: `packages/frontend/src/pages/campaign/contribute-to-mission-page.tsx`

### Route

`/campaigns/:id/contribute` — **Protected** (requires sign-in via `ProtectedRoute`).

Register in `routes.tsx` BEFORE the public `/:id` route:

```tsx
// In routes.tsx lazy imports:
const ContributeToMissionPage = lazy(
  () => import('./pages/campaign/contribute-to-mission-page'),
);

// In AppRoutes — add BEFORE <Route path="/campaigns/:id" ...>
<Route
  path="/campaigns/:id/contribute"
  element={
    <ProtectedRoute>
      <ContributeToMissionPage />
    </ProtectedRoute>
  }
/>
```

**CRITICAL**: Register `/campaigns/:id/contribute` BEFORE `/campaigns/:id` in the route list.
React Router v6 uses the first matching route; `:id/contribute` is a distinct path that would
otherwise match `:id` with extra characters if order is incorrect. In React Router v6 this is
actually handled by specificity, but explicit ordering avoids ambiguity.

### Component State Machine

The page has five distinct UI states:

```
LOADING_CAMPAIGN  → (campaign loaded, live) →  FORM
LOADING_CAMPAIGN  → (campaign not live)     →  UNAVAILABLE
LOADING_CAMPAIGN  → (error)                 →  ERROR
FORM              → (submit)                →  SUBMITTING
SUBMITTING        → (status: captured)      →  SUCCESS
SUBMITTING        → (status: failed)        →  PAYMENT_FAILED  (stays on page — user can retry)
SUBMITTING        → (ApiError 409)          →  DUPLICATE_ERROR  (stays on form — show message)
SUBMITTING        → (ApiError 400/422/404)  →  FORM_ERROR      (stays on form — show message)
PAYMENT_FAILED    → (try again)             →  FORM
```

### Page Specification

```tsx
/**
 * ContributeToMissionPage — /campaigns/:id/contribute
 *
 * Protected: must be signed in.
 * Fetches the public campaign detail to display campaign context.
 * Renders a contribution form with amount + payment token inputs.
 *
 * States: loading, unavailable, form, submitting, success, payment_failed, error
 */
export default function ContributeToMissionPage(): ReactElement {
  const { id: campaignId } = useParams<{ id: string }>();
  // fetch campaign for display context (existing hook from feat-004)
  // contribution form state + useContribute hook
}
```

### Form Fields

| Field | Type | Validation | Label |
|-------|------|-----------|-------|
| `amountDollars` | `number` input | Min $5.00, no max | "Amount (USD)" |
| `paymentToken` | `text` input | Required, max 500 chars | "Payment Token" |

**Amount handling**: The form collects dollars (e.g., `"50"` → `50.00`). Convert to cents
before sending to API: `Math.round(parseFloat(amountDollars) * 100).toString()`.
Display the USD equivalent below the input as the user types.

**Payment token field hint**: Display below the input: `"Use 'tok_fail' to test payment failure."`
This is intentional UX for the stub — helps workshop participants explore both paths.

### Success State

Display a confirmation panel after `status === 'captured'`:
- Heading: "Mission Backed!" (Bebas Neue display font)
- Body: "Your contribution of [formatted amount] has been confirmed."
- Transaction reference: Display `transactionRef` value in Space Mono font
- CTA: "Return to Campaign" → links back to `/campaigns/:id`

### Payment Failed State

Display an error panel after `status === 'failed'` (NOT an exception — a `201` response):
- Heading: "Payment Not Processed"
- Body: Display `failureReason` from the API response
- CTA: "Try Again" → resets form state, allows re-submission
- Do NOT clear the form fields — allow the user to correct the token

### Duplicate Contribution State (409)

Display inline form error:
- "An identical contribution was submitted within the last 60 seconds. Please wait before trying again."
- Form fields remain populated; submit button re-enabled after showing the message
- This is rendered as a form-level error, not a full-page error state

### Loading State

Show `<LoadingSpinner size="lg" label="Loading campaign..." />` while fetching campaign detail.

### Unavailable State

When campaign is not `live` (e.g., it became `funded` while the user was on the page):
- Display: "This mission is no longer accepting contributions."
- Show the campaign status badge
- Link back to `/campaigns/:id`

### Responsive Layout

The contribute page wraps in a centered card layout (max-width ~540px):
- Campaign title and hero image thumbnail displayed at top for context
- Funding progress bar (reuse `FundingProgressBar` component from feat-004)
- Form below progress bar
- Design follows dark-first `--color-bg-page` background with `--gradient-surface-card` form card

---

## 5. routes.tsx Update

Specific changes required in `/workspace/packages/frontend/src/routes.tsx`:

1. Add lazy import for `ContributeToMissionPage`
2. Add `<Route path="/campaigns/:id/contribute" element={<ProtectedRoute>...</ProtectedRoute>} />`
   — insert **before** the existing `<Route path="/campaigns/:id" element={...} />` line

---

## 6. PublicCampaignDetailPage Update (feat-004 integration)

The "Back This Mission" CTA button already exists in `public-campaign-detail-page.tsx`.
It must link to `/campaigns/:id/contribute`.

Verify the CTA link is already correct. If not, update it:

```tsx
// In public-campaign-detail-page.tsx — find the CTA button and ensure:
<Link to={`/campaigns/${campaign.id}/contribute`}>
  Back This Mission
</Link>
```

The button should only be rendered when campaign status is `live`. For `funded` campaigns,
either hide the button or show a "Fully Funded" badge instead.

---

## 7. Edge Cases — Complete Catalogue

All 25+ edge cases from the research document with defined behaviours:

### Input Validation Edge Cases

| Case | Trigger | Behaviour |
|------|---------|-----------|
| Amount < 500 cents | `amountCents < 500` | `400 VALIDATION_ERROR` — "Minimum contribution is $5.00 (500 cents)." |
| Amount = 500 cents | `amountCents === 500` | Accept — minimum threshold is inclusive |
| Amount = 499 cents | `amountCents === 499` | `400 VALIDATION_ERROR` — one cent below minimum |
| Amount as string `"500"` | `amountCents: "500"` | Accept — Zod coerces string to integer |
| Amount as number `500` | `amountCents: 500` | Accept — Zod accepts number and validates |
| Amount as float `"5.50"` | `amountCents: "5.50"` | `400 VALIDATION_ERROR` — must be integer |
| Amount = 0 | `amountCents: 0` | `400 VALIDATION_ERROR` — fails min(500) |
| Negative amount | `amountCents: -100` | `400 VALIDATION_ERROR` — fails min(500) |
| Extremely large amount | `amountCents: 9007199254740991` | Accept — no cap in MVP; within JS safe integer range |
| Missing campaignId | Body lacks `campaignId` | `400 VALIDATION_ERROR` |
| Non-UUID campaignId | `campaignId: "not-a-uuid"` | `400 VALIDATION_ERROR` — Zod uuid() fails |
| Empty paymentToken | `paymentToken: ""` | `400 VALIDATION_ERROR` — min(1) fails |
| paymentToken > 500 chars | `paymentToken: "a".repeat(501)` | `400 VALIDATION_ERROR` — max(500) fails |
| Missing paymentToken | Body lacks `paymentToken` | `400 VALIDATION_ERROR` |
| Extra unknown body fields | `{ campaignId, amountCents, paymentToken, extra: true }` | Zod `.strict()` → `400 VALIDATION_ERROR` |

### Campaign State Edge Cases

| Case | Trigger | Behaviour |
|------|---------|-----------|
| Campaign doesn't exist | `campaignId` not in DB | `404 CAMPAIGN_NOT_FOUND` |
| Campaign is `draft` | `status: 'draft'` | `422 CAMPAIGN_NOT_ACCEPTING_CONTRIBUTIONS` |
| Campaign is `submitted` | `status: 'submitted'` | `422 CAMPAIGN_NOT_ACCEPTING_CONTRIBUTIONS` |
| Campaign is `under_review` | `status: 'under_review'` | `422 CAMPAIGN_NOT_ACCEPTING_CONTRIBUTIONS` |
| Campaign is `rejected` | `status: 'rejected'` | `422 CAMPAIGN_NOT_ACCEPTING_CONTRIBUTIONS` |
| Campaign is `funded` | `status: 'funded'` | `422 CAMPAIGN_NOT_ACCEPTING_CONTRIBUTIONS` |
| Campaign is `cancelled` | `status: 'cancelled'` | `422 CAMPAIGN_NOT_ACCEPTING_CONTRIBUTIONS` |
| Campaign is `failed` | `status: 'failed'` | `422 CAMPAIGN_NOT_ACCEPTING_CONTRIBUTIONS` |
| Campaign is `complete` | `status: 'complete'` | `422 CAMPAIGN_NOT_ACCEPTING_CONTRIBUTIONS` |
| Campaign is `live` | `status: 'live'` | Accept — proceed to payment |

### Funding Goal Edge Cases

| Case | Trigger | Behaviour |
|------|---------|-----------|
| Contribution makes total == goal | `total_raised + amount == funding_goal` | Campaign transitions to `funded` in same transaction |
| Contribution makes total > goal | `total_raised + amount > funding_goal` | Campaign transitions to `funded`; total exceeds goal (no cap enforcement) |
| Campaign has no funding goal | `funding_goal_cents IS NULL` | Never auto-transitions to `funded`; contributions accepted indefinitely |
| Campaign already funded (race) | Another request funded it concurrently | Second request sees `status: 'funded'` — returns `422 CAMPAIGN_NOT_ACCEPTING_CONTRIBUTIONS` |

### Payment Gateway Edge Cases

| Case | Trigger | Behaviour |
|------|---------|-----------|
| `tok_fail` token | `paymentToken === 'tok_fail'` | `201` with `status: "failed"`, `failureReason` from stub |
| Any other token | `paymentToken !== 'tok_fail'` | `201` with `status: "captured"`, `transactionRef` populated |
| Gateway throws unexpectedly | Stub/real adapter throws | Contribution stays `pending_capture`; `500` returned to client; `pending_capture` records are recoverable |

### Duplicate Detection Edge Cases

| Case | Trigger | Behaviour |
|------|---------|-----------|
| Same donor+campaign+amount within 60s | `created_at > NOW() - 60s`, `status != 'failed'` | `409 DUPLICATE_CONTRIBUTION` |
| Previous contribution was `failed` | Same params, `status = 'failed'` | NOT a duplicate — accept |
| Same amount, 61 seconds later | `created_at <= NOW() - 60s` | NOT a duplicate — accept |
| Same donor, different campaign | `campaign_id` differs | NOT a duplicate — accept |
| Same campaign, different donor | `donor_user_id` differs | NOT a duplicate — accept |
| Same donor+campaign, different amount | `amount_cents` differs | NOT a duplicate — accept |

### Authentication Edge Cases

| Case | Trigger | Behaviour |
|------|---------|-----------|
| No auth header | No JWT | `401 UNAUTHENTICATED` |
| Expired JWT | Expired Clerk token | `401 UNAUTHENTICATED` (handled by Clerk middleware) |
| Valid JWT, user not in MMF DB | New user who bypassed sync | `404 USER_NOT_FOUND` (maps to `500` in error handler OR explicit 404 — implementer's choice) |
| Creator contributing to own campaign | `donorUserId === campaign.creatorUserId` | Accept — no restriction in demo |

### Concurrency Edge Cases

| Case | Trigger | Behaviour |
|------|---------|-----------|
| Two simultaneous contributions from same user | Race on duplicate check | Both may pass check and be created (last-write-wins on totals); acceptable for demo |
| Two contributions both reach funding goal | Concurrent requests | Both transactions commit; `campaigns.status` ends up `funded` (conditional WHERE is idempotent); `total_raised_cents` may exceed goal |

### Frontend Edge Cases

| Case | Trigger | Behaviour |
|------|---------|-----------|
| User navigates to `/campaigns/:id/contribute` when not signed in | Unauthenticated | `ProtectedRoute` redirects to `/sign-in` |
| User navigates to contribute page for a non-live campaign | Campaign not `live` | Show "UNAVAILABLE" state — not accepting contributions |
| User submits form with `tok_fail` | Payment failure | Show payment failed state; allow retry without full page reload |
| User submits duplicate within 60s | API returns 409 | Show inline duplicate error message; form stays populated |
| Network error during submission | `fetch` throws | Show generic error state; retry CTA |
| Campaign transitions to `funded` during contribution flow | Race: API returns 422 | Show "Campaign has been fully funded" message |
| Amount input: user types decimal (e.g., `5.50`) | Frontend converts to cents | `Math.round(5.50 * 100)` = `550` — valid; display "$5.50" |
| Amount input: user types `0` | Frontend validation | Disable submit or show "Minimum $5.00" before API call |

---

## 8. Frontend Testing

### `contribute-to-mission-page.test.tsx`

Required test coverage (every component must have a `.test.tsx` file):

**Loading state**
- Renders loading spinner while campaign data is fetching

**Unavailable state**
- Renders "not accepting contributions" when campaign is `funded` or not `live`

**Form state (default)**
- Renders amount input, payment token input, and "Back This Mission" submit button
- Shows campaign title and funding progress for context
- Displays payment token hint text

**Form state — validation**
- Disables submit when amount < $5.00
- Shows min amount error message inline
- Disables submit when payment token is empty

**Submitting state**
- Submit button shows loading state during mutation
- Inputs are disabled during submission

**Success state (`captured`)**
- Shows "Mission Backed!" confirmation heading
- Shows formatted contribution amount
- Shows transaction reference
- Shows "Return to Campaign" link pointing to `/campaigns/:id`

**Payment failed state (`failed`)**
- Shows "Payment Not Processed" heading
- Shows failure reason from API response
- Shows "Try Again" button that resets to form state

**Duplicate error (409)**
- Shows inline duplicate error message
- Form fields remain populated
- Submit button re-enabled

**Network error**
- Shows error state with retry option

### `use-contribute.test.ts`

- `contribute()` calls `createContribution()` with correct input
- `isPending` is true during mutation, false after
- On success: `contribution` populated, `error` null
- On error: `error` populated, `contribution` null
- `reset()` clears state

### `contribution-api.test.ts`

- `createContribution()` sends POST to `/api/v1/contributions` with correct body
- `getContribution()` sends GET to `/api/v1/contributions/:id`
- `listCampaignContributions()` sends GET to `/api/v1/campaigns/:id/contributions`
- All functions parse response `data` property correctly
- All functions throw `ApiError` on 4xx/5xx responses

---

## 9. Design Tokens Reference

All visual values from `specs/standards/brand.md` (L2-001). Key tokens for this feature:

| Element | Token |
|---------|-------|
| Page background | `--color-bg-page` (`--void` / #060A14) |
| Form card background | `--gradient-surface-card` |
| Submit button | `--gradient-action-primary` with `--color-action-primary-shadow` |
| Success state colour | `--color-status-success` |
| Error/failure state colour | `--color-status-error` |
| Warning (duplicate) colour | `--color-status-warning` |
| Transaction ref display | `--font-data` (Space Mono) |
| Page heading | `--font-display` (Bebas Neue, uppercase) |
| Body copy | `--font-body` (DM Sans) |
| Input labels | `--font-data` (Space Mono) |

One primary CTA per viewport — the "Back This Mission" submit button is the primary CTA.
No secondary primary buttons on this page.

---

## 10. Open Questions

The following questions remain open at spec time. The implementer should resolve these before
coding, or make a decision and document it in the gotchas file.

### Q1: Table name `users` vs `accounts` — RESOLVED

Confirmed: the table is `users` (per `20260305130000_create_users_table.sql`).
The migration SQL in `feat-005-spec-data.md` uses `REFERENCES users(id)` throughout.
No action required.

### Q2: `UserRepository.findByClerkUserId()` method name

The `ContributionAppService` needs to resolve `clerkUserId` → internal `User` record.
Confirm the exact method name on `UserRepository` port:

> Implementer action: Read `packages/backend/src/account/ports/user-repository.port.ts`
> and use the correct method name. Common variants: `findByClerkId()`, `findByClerkUserId()`.

### Q3: `CampaignNotFoundError` location

The application service throws `CampaignNotFoundError` when a campaign doesn't exist.
Confirm this error class exists in the campaign context:

> Implementer action: Read `packages/backend/src/campaign/domain/errors/campaign-errors.ts`
> and confirm `CampaignNotFoundError` exists (it may be named differently, e.g., `CampaignNotFoundError`).

### Q4: `campaigns.status` value for `funded`

The auto-transition sets `status = 'funded'`. Confirm this is the exact string value used
in the `CampaignStatus` value object and the DB CHECK constraint:

> Implementer action: Read `packages/backend/src/campaign/domain/value-objects/campaign-status.ts`
> and confirm `CampaignStatus.Funded === 'funded'`.

### Q5: `Pool` injection approach for transactions

The spec injects `pool: Pool` directly into `ContributionAppService`. An alternative is to
pass `client` explicitly to all repository methods that need transaction support.
Either approach is valid. The spec uses direct pool injection as the reference pattern.
If the implementer prefers a different transaction management approach (e.g., a `withTransaction`
helper), document it in `patterns.md`.
