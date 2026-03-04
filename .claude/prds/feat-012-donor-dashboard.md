## feat-012: Donor Dashboard & Contribution History

**Bounded Context(s):** Donor
**Priority:** P2
**Dependencies:** feat-008
**Estimated Complexity:** M

### Summary

Implement the donor's personal dashboard showing contribution history, per-campaign status tracking, and cumulative impact stats. This is the ongoing relationship surface that keeps backers engaged and informed about the missions they fund.

### Acceptance Criteria

- [ ] Donor dashboard page (`/dashboard`) accessible to authenticated users with Backer role
- [ ] Dashboard displays cumulative stats: total amount contributed (lifetime), number of campaigns backed, number of milestones achieved across backed campaigns, number of campaigns completed
- [ ] Contribution history list: all contributions with campaign title, amount (formatted USD), date, status (pending, confirmed, in progress, completed, refunded)
- [ ] Contribution history sortable by date, amount, status
- [ ] Contribution history filterable by status and campaign category
- [ ] Per-campaign detail: clicking a contribution shows campaign progress, milestone timeline with completion status, fund disbursement events
- [ ] Running total of all contributions displayed prominently
- [ ] Contribution statuses driven by events from Payments and Campaign domains
- [ ] `GET /v1/donors/me/contributions` returns paginated contribution history
- [ ] `GET /v1/donors/me/contributions/:id` returns contribution detail with campaign progress
- [ ] `GET /v1/donors/me/stats` returns cumulative impact stats
- [ ] Monetary amounts displayed via `Intl.NumberFormat` — received from API as strings
- [ ] All states handled in UI: default (has contributions), empty (no contributions yet, with encouraging CTA to browse campaigns), loading, error
- [ ] Responsive layout
- [ ] Component tests for dashboard, contribution list, contribution detail (all states)
- [ ] Integration tests for donor API endpoints

### User Story

As a backer, I want to see my contribution history and the impact of my funding so that I feel connected to the missions I support.

### Key Decisions / Open Questions

- Read model populated from contribution and campaign events (CQRS pattern)
- Contribution timeline visualisation is a stretch goal for this feature — text list is MVP

### Out of Scope

- Tax receipt generation / download (Phase 2 per local demo scope)
- Recommendation engine (Phase 2)
- Re-engagement notifications (Phase 2)
- Social sharing
- Impact reports from campaign creators
- Milestone notifications (would need notification service)
