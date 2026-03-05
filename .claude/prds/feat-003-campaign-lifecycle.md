## feat-003: Campaign Creation, Submission, and Review Pipeline

**Bounded Context(s):** Campaign (L4-002)
**Priority:** P0
**Dependencies:** feat-001, feat-002
**Estimated Complexity:** L

### Summary

This feature implements the campaign lifecycle from Draft through to Live: a Creator builds a campaign proposal (title, description, milestones, funding targets, category, media), submits it for review, a Reviewer approves or rejects it, and the Creator then launches the approved campaign to a Live state.
It is the core of the platform's curation model and is the prerequisite for donors to discover and fund anything.

### Acceptance Criteria

- [ ] A user with `Verified` KYC status and `Creator` role can create a campaign draft with all required fields: title, summary (<=280 chars), description, Mars-mission alignment statement, team members (min 1), funding target (min $1,000,000 USD in cents), max funding cap, deadline (1 week to 1 year from submission date), budget breakdown, category (one of the 10 defined categories), milestone plan (min 2 milestones, percentages summing to 100%), risk disclosures (min 1), and hero image.
- [ ] Drafts are auto-saved; the creator can return to an incomplete draft and continue editing.
- [ ] A creator without `Verified` KYC status receives HTTP 403 with `KYC_NOT_VERIFIED` when attempting to create or submit a campaign.
- [ ] When a creator submits a valid draft, the campaign transitions from `Draft` to `Submitted` and a confirmation notification is recorded.
- [ ] Submitting a draft where milestone funding percentages do not sum to 100% returns a validation error identifying the discrepancy.
- [ ] A user with the `Reviewer` role can view the review queue (FIFO ordered list of `Submitted` campaigns) and claim one; the campaign transitions to `Under Review`.
- [ ] A reviewer can approve a campaign with written approval notes; the campaign transitions to `Approved` and the creator is notified.
- [ ] A reviewer can reject a campaign with written rationale and resubmission guidance; the campaign transitions to `Rejected` and the creator is notified with the full rationale.
- [ ] A creator can revise a `Rejected` campaign; the campaign transitions back to `Draft` with all prior submission data preserved.
- [ ] A creator can launch an `Approved` campaign; the campaign transitions to `Live` and is publicly visible.
- [ ] Every campaign state transition is audit-logged with: campaign ID, previous state, new state, actor identity, timestamp, and rationale.
- [ ] The `GET /campaigns/:id` endpoint returns full campaign detail including current state, funding progress (initially 0), milestones, and all submission fields.
- [ ] An administrator can reassign a campaign in `Under Review` to a different reviewer.

### User Story

As a project creator with verified KYC, I want to submit my Mars mission project proposal and go through the review process so that my campaign can go live and start accepting contributions.

### Key Decisions / Open Questions

- The campaign submission form is a multi-step guided flow on the frontend; the backend accepts a single creation endpoint and a separate submit endpoint.
- Funding targets are stored as integer cents (BIGINT) in the database; the API accepts and returns them as strings to avoid precision loss.
- Campaign categories must be stored as an enum or reference table matching the 10 categories in L4-002 Section 4.4.
- Milestone funding percentages are stored as integers (basis points or whole percentages); define the precision at implementation.
- The `Creator` role is assigned by the user selecting it during onboarding OR by an administrator — the spec writer must clarify the exact mechanism for the local demo (likely: any Verified KYC user can self-designate as Creator).
- Media uploads (hero image): define maximum file size and accepted formats; the spec references L2-001 brand standards.

### Out of Scope

- Campaign updates and creator posts to a live campaign (post-launch creator management).
- Deadline enforcement automation (cron jobs for Live → Funded / Failed transitions).
- Stretch goal mechanics (theatre).
- Deadline extension requests (theatre).
- Milestone change requests post-launch (theatre).
- KYC revocation handling (campaign suspension) (theatre).
- Appeal process for rejected proposals (theatre).




























