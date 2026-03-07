## feat-006: Campaign Submission and Draft Management

**Bounded Context(s):** Campaign
**Priority:** P1
**Dependencies:** feat-001, feat-002, feat-005
**Estimated Complexity:** L

### Summary

Implement the campaign creation and submission flow: creators can draft, auto-save, and submit project proposals. This covers the full `Draft → Submitted` state transition per L4-002, including multi-step form validation, all required fields, and the KYC gate check. The frontend delivers a multi-step guided form experience.

### Acceptance Criteria

- [ ] `Campaign` domain entity exists with `create()` and `reconstitute()` factory methods; all properties `readonly`; extends `DomainError` for all domain errors.
- [ ] `POST /v1/campaigns` creates a new campaign draft (status: `draft`) owned by the authenticated Creator. Returns 403 if the user does not have the `creator` role.
- [ ] `GET /v1/campaigns` returns the authenticated creator's own campaigns (drafts + submitted + all states).
- [ ] `GET /v1/campaigns/:id` returns a single campaign (creator sees own draft; public sees only live/funded/complete/failed).
- [ ] `PATCH /v1/campaigns/:id` updates a draft campaign. Returns 403 for non-owner. Returns 409 if the campaign is not in `draft` state.
- [ ] `POST /v1/campaigns/:id/submit` transitions a campaign from `draft` to `submitted`. Validates:
  - All required fields per L4-002 Section 4.2 are present and non-empty.
  - `min_funding_target` ≥ $1,000,000 (100000000 cents).
  - `max_funding_cap` ≥ `min_funding_target`.
  - `deadline` is at least 7 days in the future and at most 1 year from submission date.
  - At least 2 milestones are defined; milestone `funding_percentage` values sum to 100.
  - At least 1 team member is defined.
  - At least 1 risk disclosure is defined.
  - Creator's `kyc_status` is `verified` — returns 403 with code `KYC_VERIFICATION_REQUIRED` otherwise.
- [ ] Submission creates an entry in `campaign_audit_log` with `action: 'submitted'`, `new_state: 'submitted'`.
- [ ] All Zod schemas for request bodies are defined in a shared `packages/backend/src/campaign/api/schemas.ts` file.
- [ ] Unit tests ≥ 90% on `Campaign` entity and submission application service.
- [ ] Integration tests cover: draft creation, draft update, successful submission, submission blocked by missing fields, submission blocked by KYC status, submission blocked by milestone percentage sum ≠ 100.
- [ ] Frontend: Multi-step campaign creation form with steps: Mission Objectives → Team → Funding → Milestones → Risks → Media → Review.
- [ ] Frontend: Form state persists across steps using React state; auto-save calls `PATCH /v1/campaigns/:id` after each step completion (debounced, 1s).
- [ ] Frontend: Each step validates its own fields before allowing progression to the next step; validation errors use brand error copy patterns from L2-001 Section 4.2.
- [ ] Frontend: "Submit for Review" button on the Review step calls `POST /v1/campaigns/:id/submit`; success navigates to a confirmation screen.
- [ ] Frontend: KYC gate — if `kyc_status !== 'verified'`, the "Submit for Review" button is disabled with a tooltip directing the user to complete KYC.
- [ ] Frontend: Campaign list page at `/campaigns/my` shows the creator's drafts and submitted campaigns with status badges.

### User Story

As a project Creator, I want to draft and submit a campaign proposal so that my Mars-enabling project can be reviewed and potentially funded.

### Key Decisions / Open Questions

- Auto-save uses debounced `PATCH` — a missing `campaign_id` on first save triggers `POST /v1/campaigns` to create the draft.
- Milestone percentage validation is enforced at submission time, not on every draft save.
- Hero image upload is deferred to media upload feature; the form accepts a URL string for now.

### Out of Scope

- Campaign review pipeline (feat-007).
- Campaign media/image upload to S3 (P2 enhancement).
- Stretch goal management (theatre per L4-002 local demo scope).
- Appeal process (theatre per L4-002 local demo scope).
