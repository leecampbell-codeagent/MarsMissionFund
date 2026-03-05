## feat-006: Donor Dashboard and Contribution History

**Bounded Context(s):** Donor (L4-003)
**Priority:** P1
**Dependencies:** feat-001, feat-005
**Estimated Complexity:** M

### Summary

This feature gives authenticated donors a personal dashboard showing all their contributions, their statuses, running totals, and per-campaign impact information (milestone status, funding progress).
It closes the donor loop — after contributing, a backer can return to the platform and see where their money is, what milestones have been hit, and how much they have contributed in total.

### Acceptance Criteria

- [ ] An authenticated donor can access their contribution history dashboard (`GET /donor/contributions`); the response lists all contributions with: campaign title, mission code (campaign ID), amount (as string in cents), date, and status.
- [ ] Contribution statuses are: `pending`, `confirmed`, `in_progress`, `completed`, `refunded`; the correct status is returned based on the campaign and payment state.
- [ ] The dashboard response includes a summary: total lifetime contributions (as string in cents), total number of campaigns backed, and count of contributions per status.
- [ ] Contributions can be filtered by `status` and sorted by `date` (newest first by default) and `amount`.
- [ ] The per-campaign impact endpoint (`GET /donor/contributions/:campaign_id`) returns: funding progress (amount raised as string in cents, percentage of target), milestone timeline (each milestone's title, target date, verification status), and creator updates (empty array for MVP).
- [ ] When a milestone is verified (triggered via feat-003 admin action), the contribution status for all donors of that campaign updates from `in_progress` to reflect the milestone progress; the milestone appears as verified in per-campaign views.
- [ ] Donors only see their own contributions; requests for another user's contribution data are rejected with HTTP 403.
- [ ] All contribution history queries are scoped to the authenticated `user_id` from the auth context — never from query parameters or request body.
- [ ] The impact summary stats (total contributed, campaigns backed) are computed in real-time from the contributions table; no separate aggregation table is required for MVP.

### User Story

As a mission backer who has contributed to campaigns, I want to see all my contributions and track the progress of the missions I have funded so that I know my money is being used and the projects are moving forward.

### Key Decisions / Open Questions

- The "mission code" displayed to donors is the campaign's database ID (UUID); a human-readable mission code (e.g., `MMF-2026-001`) may be added in a future cycle — clarify at implementation.
- Contribution status `in_progress` is set when the campaign transitions to `Funded` or `Settlement` state; `completed` is set when the campaign reaches `Complete` state.
- Creator updates (campaign posts) are referenced in the spec but out of scope for this feature; the endpoint returns an empty array for `creator_updates`.
- Tax receipt generation (PDF download) is referenced in L4-003 but is theatre for the local demo; the endpoint structure may be stubbed but PDF generation is out of scope.
- The impact dashboard cumulative stats (milestones achieved, campaigns completed) require joining across contribution, campaign, and milestone tables — ensure the database schema from feat-003 and feat-005 supports this join at query time.

### Out of Scope

- Milestone notifications (in-app or email) triggered by milestone verification (theatre for local demo).
- Tax receipt PDF generation and download (theatre).
- Annual tax summary generation (theatre).
- Re-engagement recommendations post-contribution (theatre).
- Social sharing post-contribution (enhancement; deferred).
- Contribution timeline visualisation (chart/graph) (enhancement; deferred).
- Push notifications (theatre).




























