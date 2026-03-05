# Exploratory Review: feat-005 — Campaign Creation (Draft & Submit)

> Code-review based verification of acceptance criteria.
> Note: Docker unavailable — code-review based verification.

## Verdict: PASS

## Summary

All five acceptance criteria groups from the spec have been verified by reading the implementation code. The domain entity correctly enforces state transitions, the application service gates access at every entry point, and the frontend pages handle all required UI states. No critical defects found.

---

## Acceptance Criteria Verification

### AC-1: Campaign can be created as draft

**Verification Method:** Code review of `Campaign.create()`, `CampaignAppService.createDraft()`, `campaign-router.ts` POST handler, and `NewCampaignPage`.

**Result: PASS**

- `Campaign.create()` in `/workspace/packages/backend/src/campaign/domain/campaign.ts` validates required fields (`creatorId`, `title`, `category`, `minFundingTargetCents`, `maxFundingCapCents`) and sets `status: 'draft'` unconditionally.
- `CampaignAppService.createDraft()` sets `creatorId: userId` (from auth context, never from input).
- The POST `/api/v1/campaigns` route validates with Zod, checks creator role (403 if missing), and calls `createDraft`. Returns 201 with the new campaign.
- `NewCampaignPage` uses `useCreateCampaign` hook, displays a `CampaignForm`, handles errors via `setSaveError`, and navigates to the edit page on success.
- Monetary amounts correctly sent as strings: `String(minCents)` before posting.

### AC-2: Draft can be updated

**Verification Method:** Code review of `Campaign.withDraftUpdate()`, `CampaignAppService.updateDraft()`, `campaign-router.ts` PATCH handler, and `EditCampaignPage`.

**Result: PASS**

- `Campaign.withDraftUpdate()` checks `this.isDraft()` — throws `CampaignAlreadySubmittedError` if not in draft state.
- Returns a new `Campaign` instance (immutable) with updated fields, preserving unchanged fields via spread.
- `CampaignAppService.updateDraft()` checks `record.campaign.creatorId !== userId` — throws `CampaignNotFoundError` (404) if the campaign doesn't belong to the user.
- PATCH route validates with Zod, checks for empty body (400), maps errors: 404 not found, 409 already submitted, 400 validation failure.
- `EditCampaignPage` shows `isReadOnly` state when campaign is not in draft — submit button hidden for non-draft campaigns; form is read-only.
- The edit page displays loading skeleton, error/not-found state, and a readonly notice for submitted campaigns.

### AC-3: Submit checks KYC

**Verification Method:** Code review of `CampaignAppService.submitForReview()` and `campaign-router.ts` submit handler.

**Result: PASS**

- `CampaignAppService.submitForReview()` calls `this.kycStatusPort.getVerificationStatus(userId)` as the FIRST operation — before any campaign lookup.
- If `kycStatus.status !== 'verified'`, throws `KycRequiredError` immediately.
- The submit route maps `KycRequiredError` to 403 with code `KYC_REQUIRED`.
- The `EditCampaignPage.handleSubmit()` catches `err.code === 'KYC_REQUIRED'` and shows a user-friendly message pointing to Settings → Verification.
- `Campaign.submit()` in the domain also validates all submission requirements (title, summary, description, marsAlignmentStatement, funding range, deadline, milestones count and percentages, teamInfo, riskDisclosures).

### AC-4: Creator can only see own campaigns

**Verification Method:** Code review of all three application service methods that access campaigns by ID.

**Result: PASS**

All three access-control checks are consistent:

1. `getCampaign(userId, campaignId)`:
   ```typescript
   if (!record || record.campaign.creatorId !== userId) {
     throw new CampaignNotFoundError();
   }
   ```

2. `updateDraft(userId, campaignId, input)`:
   ```typescript
   if (!record || record.campaign.creatorId !== userId) {
     throw new CampaignNotFoundError();
   }
   ```

3. `submitForReview(userId, campaignId)`:
   ```typescript
   if (!record || record.campaign.creatorId !== userId) {
     throw new CampaignNotFoundError();
   }
   ```

- All three return `CampaignNotFoundError` (not `CampaignForbiddenError`) — 404 is returned, not 403. This matches AC-CAMP-005-009 spec requirement: "404 is returned (not 403, to avoid information disclosure)."
- `listMyCampaigns` uses `findByCreatorId(userId)` which queries `WHERE creator_id = $1` — only returns the authenticated user's campaigns.

### AC-5: Frontend pages exist and handle loading/error/empty states

**Verification Method:** Code review of `campaigns-mine.tsx`, `campaigns-new.tsx`, `campaigns-edit.tsx` and their test files.

**Result: PASS**

**MyCampaignsPage (`campaigns-mine.tsx`):**
- Loading: returns skeleton UI with CSS animation (respects `prefers-reduced-motion`)
- Error: returns error container with `role="alert"` and message
- Empty: renders "NO MISSIONS YET" heading and "START A CAMPAIGN" CTA link
- Data: renders `CampaignCard` for each campaign
- Tests verify all 4 states (6 tests total)

**NewCampaignPage (`campaigns-new.tsx`):**
- Simple creation form page — no loading state needed (no pre-existing data)
- Error state handled via `saveError` state shown in `CampaignForm`
- Tests (10 tests) cover form rendering, save draft, validation errors, navigation on success

**EditCampaignPage (`campaigns-edit.tsx`):**
- Loading: skeleton UI (label + heading + section skeletons) with animation + reduced-motion support
- Error/not found: "CAMPAIGN NOT FOUND" heading with back link
- Read-only: when `status !== 'draft'`, form is read-only with notice banner, submit button hidden
- Data: form pre-populated with campaign data, save + submit buttons for draft campaigns
- Tests (8 tests) cover loading, not found, readonly, save draft, submit flow, KYC error

---

## Design System Compliance

- Typography: `--font-display` (Bebas Neue) for headings (uppercase), `--font-data` (Space Mono) for labels/data, `--font-body` (DM Sans) for body text — all correctly applied.
- Colours: semantic Tier 2 tokens used: `--color-bg-input`, `--color-text-primary`, `--color-text-secondary`, `--color-text-accent`, `--color-text-tertiary`, `--color-action-primary-text`, `--color-status-error`.
- Gradients: `--gradient-action-primary` on primary CTAs.
- Shadows: `--color-action-primary-shadow` on primary CTAs.
- No hardcoded hex colours in CSS except one rgba wrapper for the readonly notice (rgba(255, 92, 26, 0.06) — this wraps the Launch Fire token value; not ideal but not a critical issue).
- No direct Tier 1 identity token references found in components.

---

## Minor Observations (Non-blocking)

1. `CampaignForm.tsx` has no dedicated test file. Page tests exercise it indirectly but a direct component test is missing (noted in audit report).
2. The `PgCampaignRepository.findByCreatorId` uses N+1 queries (one campaign query + one milestones query per campaign). For MVP this is acceptable, but should be optimised with a JOIN before scaling.
3. The `dollarsToIntCents` function in `CampaignForm.tsx` uses `Math.round(parseFloat(val) * 100)` — this involves floating point at the display/input layer, but the result is rounded to an integer before sending to the API. The spec permits this pattern as display formatting is a frontend responsibility.
