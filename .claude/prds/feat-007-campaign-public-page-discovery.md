## feat-007: Campaign Public Page & Discovery

**Bounded Context(s):** Campaign, Donor
**Priority:** P1
**Dependencies:** feat-006
**Estimated Complexity:** L

### Summary

Implement the public campaign page and campaign listing/browse experience. Approved campaigns can be launched by creators (transition to Live). Live campaigns are publicly visible with all submission details, funding progress, contributor count, time remaining, and a "Back This Mission" CTA. The campaign listing page shows campaign cards with category browsing.

### Acceptance Criteria

- [ ] Creator can launch an approved campaign — transitions to `live` state, campaign becomes publicly visible
- [ ] Campaign listing page (`/campaigns`) displays campaign cards for all live/funded campaigns
- [ ] Campaign cards show: title, creator name, category badge, funding progress bar, percentage funded, amount raised (formatted USD), days remaining, hero image thumbnail
- [ ] Campaign cards follow the brand design system: dark-first UI, semantic tokens, gradient surfaces
- [ ] Category browsing: filter campaigns by the 10-category taxonomy
- [ ] Sort options: Newest, Ending Soon, Most Funded, Least Funded
- [ ] Individual campaign page (`/campaigns/:id`) displays: all submission fields, funding progress (amount + percentage), contributor count, time remaining, milestone plan, stretch goals (if any), "Back This Mission" CTA
- [ ] Campaign page accessible to anonymous users (no auth required for viewing)
- [ ] Funding progress updates in near-real-time as contributions are confirmed (via read model)
- [ ] Campaign listing accessible to anonymous users
- [ ] `GET /v1/campaigns?status=live` returns paginated live campaigns (public, no auth required)
- [ ] `GET /v1/campaigns/:id` returns full campaign details for live/funded campaigns (public)
- [ ] `POST /v1/campaigns/:id/launch` transitions approved campaign to live (Creator role, campaign owner only)
- [ ] Monetary amounts in API responses serialised as strings (cents)
- [ ] Frontend formats monetary amounts using `Intl.NumberFormat` — never manual string manipulation
- [ ] Frontend displays dates in user timezone from UTC ISO strings
- [ ] Responsive layout: mobile, tablet, desktop breakpoints
- [ ] Integration tests for public campaign API endpoints
- [ ] Component tests for campaign card and campaign detail page (all states: loading, empty, error, data)

### User Story

As a backer, I want to browse and view campaign details so that I can find Mars missions I want to support.

### Key Decisions / Open Questions

- Campaign listing uses PostgreSQL full-text search over CQRS read models (no external search provider)
- Anonymous access for browsing; authentication required only for contributing
- Pagination strategy: offset-based for MVP (cursor-based can be added later)

### Out of Scope

- Contribution flow (feat-008)
- Recommendation engine (Phase 2 per local demo scope)
- Curated collections / editorial features (Phase 2)
- Full-text search with auto-complete (feat-014)
- Social sharing
- Campaign updates posted by creator
