## feat-006: Campaign Creation and Draft Management

**Bounded Context(s):** Campaign
**Priority:** P1
**Dependencies:** feat-003, feat-002, feat-005
**Estimated Complexity:** L

### Summary

Enables verified Creators to create, edit, and submit campaign proposals through a multi-step guided form. Proposals are auto-saved as drafts. On submission, all required fields are validated including milestone funding percentages summing to 100%, funding target bounds, and deadline constraints. Approved proposals can be launched by the creator to go live.

### Acceptance Criteria

- [ ] `POST /api/v1/campaigns` creates a new campaign draft owned by the authenticated Creator; requires KYC `verified` status or returns `403` with `KYC_REQUIRED`; returns `201` with the new campaign `id` and `status: "draft"`
- [ ] `PUT /api/v1/campaigns/:id` updates a draft campaign; only the campaign's creator can update it; returns `200` with updated campaign; returns `403` if called by a non-owner or `404` if not found
- [ ] `GET /api/v1/campaigns/:id` returns full campaign detail for the owner (all states) or public campaigns (live/funded/complete/failed states only); returns `404` for non-existent or inaccessible campaigns
- [ ] `GET /api/v1/campaigns` returns all draft and submitted campaigns owned by the authenticated Creator (paginated, default 20 per page)
- [ ] `POST /api/v1/campaigns/:id/submit` transitions a draft campaign to `submitted` state after validating: all required fields present, funding goal between $1,000,000 and $1,000,000,000 cents ($10B), milestone percentages sum to 100%, deadline at least 7 days from now and no more than 1 year, at least 2 milestones, at least 1 risk disclosure; returns `200` on success, `400` with field-level error details on validation failure
- [ ] `POST /api/v1/campaigns/:id/launch` transitions an `approved` campaign to `live` state; only the campaign owner can call this; returns `200`; returns `409` if campaign is not in `approved` state
- [ ] The campaign creation UI at `/campaigns/new` renders a multi-step form with sections: Mission Objectives, Team Credentials, Funding, Milestone Plan, Risk Disclosures; progress is auto-saved via debounced PUT requests
- [ ] The Milestone Plan step allows adding/removing milestones; a running total of milestone funding percentages is displayed; the form prevents submission if percentages do not sum to 100%
- [ ] The `/campaigns/dashboard` page lists the creator's campaigns with status badges, funding progress, and a "Submit" or "Launch" action button appropriate to the current state
- [ ] A Creator with `not_verified` KYC status sees a banner on the campaigns dashboard directing them to complete KYC before they can submit
- [ ] Integration test: submitting a campaign with milestone percentages that sum to 95% returns `400` with `MILESTONE_PERCENTAGE_INVALID` error code
- [ ] Integration test: submitting a campaign with a funding goal below $1,000,000 (100000000 cents) returns `400` with `FUNDING_GOAL_OUT_OF_RANGE` error code
- [ ] Integration test: a user without Creator role calling `POST /api/v1/campaigns` returns `403`
- [ ] Domain unit tests achieve >= 90% coverage on Campaign entity and milestone validation logic

### User Story

As a verified project creator, I want to submit my Mars mission project proposal so that it can be reviewed and potentially funded by the community.

### Key Decisions / Open Questions

- Campaign categories are a closed enum matching the 10 categories in L4-002 Section 4.4; stored as text in the database
- Media (hero image, additional images/video) upload is out of scope for this feature — the form accepts a URL field instead
- Team members and advisory board are stored as a JSONB array on the campaign record
- Risk disclosures are stored as a JSONB array on the campaign record
- Stretch goals are optional and stored as a JSONB array; included in the form but not validated beyond basic structure

### Out of Scope

- Campaign appeal process after rejection (theatre per L4-002 local demo scope)
- Deadline extension requests (theatre)
- Milestone change requests after going live (theatre)
- Campaign cancellation flow
- Campaign suspension/KYC revocation handling
