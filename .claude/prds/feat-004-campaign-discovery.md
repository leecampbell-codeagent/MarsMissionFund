## feat-004: Campaign Discovery and Public Campaign Pages

**Bounded Context(s):** Donor (L4-003), Campaign (L4-002)
**Priority:** P1
**Dependencies:** feat-003
**Estimated Complexity:** M

### Summary

This feature gives donors (and anonymous visitors) the ability to find and explore live campaigns: a search interface with full-text search and filters, a campaign listing view, and a full campaign detail page with funding progress, milestone plan, and a contribution call-to-action.
This is the primary entry point for the donor journey and a prerequisite for the contribution flow.

### Acceptance Criteria

- [ ] Anonymous and authenticated users can access the campaign search/browse interface without being prompted to log in.
- [ ] The search endpoint (`GET /campaigns`) accepts a `q` parameter for full-text search across campaign title, description, and creator name; returns paginated results sorted by relevance.
- [ ] The search endpoint accepts filter parameters: `category` (multi-value, matches L4-002 taxonomy), `status` (active, funded, ending_soon), `sort` (newest, ending_soon, most_funded, least_funded).
- [ ] A "Ending Soon" filter returns only campaigns with a deadline within 7 days, sorted by nearest deadline first.
- [ ] Each search result item includes: campaign title, creator name, category, funding progress (amount raised as string in cents, percentage of target), days remaining, hero image URL, and campaign status.
- [ ] The campaign detail endpoint (`GET /campaigns/:id`) returns: all submission fields (title, description, team, milestones, risks, category, media), funding progress (total raised in cents as string, contributor count, percentage), time remaining, campaign status, and a contribution CTA.
- [ ] Only campaigns in `Live` or `Funded` state are returned in search results and publicly accessible via the detail endpoint; campaigns in Draft, Submitted, Under Review, Approved, Rejected, Suspended, Failed, or Cancelled states are not publicly accessible.
- [ ] A campaign in `Funded` state displays a "Fully Funded" badge and continues showing the total raised above the target.
- [ ] The funding progress on the campaign detail page reflects the current total confirmed contributions from the payments domain.
- [ ] Category browse pages (`GET /campaigns?category=propulsion`) return aggregate stats: campaign count, total raised (as string in cents), active campaign count.
- [ ] Filter state round-trips through URL query parameters (the API is stateless; the frontend is responsible for URL state management).

### User Story

As a potential mission backer, I want to browse and search Mars mission campaigns so that I can find projects I believe in and learn enough to decide whether to contribute.

### Key Decisions / Open Questions

- Full-text search implementation: the tech stack (L3-008) specifies PostgreSQL — use `pg_trgm` or `tsvector`/`tsquery` for full-text search in the demo rather than an external search service (which is theatre).
- The search endpoint should be accessible to anonymous users; the backend must not require Clerk JWT for this endpoint.
- Pagination approach: cursor-based or offset/limit — define at implementation; offset/limit is simpler for the workshop.
- "Contributor count" displayed on public pages: show count only, never individual donor identities, unless the donor has opted in (opt-in feature is out of scope for MVP; show count only).
- Hero image URLs reference uploaded files; the backend returns the URL from the storage layer — define the URL shape at implementation.

### Out of Scope

- Personalised recommendations and "Recommended for You" section (theatre for local demo).
- Search history persistence per donor (theatre).
- Curated editorial collections and staff picks (theatre).
- Campaign updates/creator posts displayed on the detail page (post-launch content; out of MVP).
- Social sharing meta tags (OG tags) for campaign pages (enhancement; out of MVP).
- Anonymous user re-engagement prompts (theatre).




























