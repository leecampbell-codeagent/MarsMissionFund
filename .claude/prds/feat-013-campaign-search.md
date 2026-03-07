## feat-013: Campaign Search and Discovery

**Bounded Context(s):** Donor, Campaign
**Priority:** P2
**Dependencies:** feat-005, feat-009
**Estimated Complexity:** M

### Summary

Implement full-text search over campaigns using PostgreSQL full-text search on CQRS read models, plus filter and sort functionality per L4-003. No external search provider — per L3-001 and L3-008, search is served by PostgreSQL FTS. Includes the search interface on the frontend, auto-complete suggestions, filter state in URL, and the "Ending Soon" filter.

### Acceptance Criteria

- [ ] Migration: Add GIN full-text search index on `campaigns` table over `title || ' ' || summary || ' ' || description` as a `tsvector` column (`campaign_search_vector`), populated by trigger and updated on INSERT/UPDATE.
- [ ] `GET /v1/campaigns/search` accepts query params: `q` (text), `category` (multi, comma-separated), `status` (single: `active`, `funded`, `ending_soon`, `new`), `sort` (`relevance`, `newest`, `ending_soon`, `most_funded`, `least_funded`), `page` (int, default 1), `limit` (int, default 20, max 100).
- [ ] "Ending Soon" filter returns campaigns with `deadline <= NOW() + INTERVAL '7 days'` sorted by nearest deadline first, per L4-003 AC-DONOR-003.
- [ ] Search results ranked by `ts_rank` when `q` is provided; falls back to `sort` parameter otherwise.
- [ ] Response includes: `results` array, `total_count`, `page`, `limit`, `has_next_page`.
- [ ] Anonymous access is permitted; no auth required for search.
- [ ] Search queries use parameterised `$1` placeholders — never string interpolation in SQL.
- [ ] Input: `q` is sanitised and limited to 200 characters before use in `to_tsquery`.
- [ ] Integration tests cover: full-text match, category filter, status filter, ending soon filter, sort orders, pagination, empty results, anonymous access.
- [ ] Frontend: Search bar in the navigation and on the `/campaigns` discovery page; debounced input (300ms) calls `GET /v1/campaigns/search`.
- [ ] Frontend: Filter panel with category multi-select checkboxes, status single-select, sort dropdown.
- [ ] Frontend: Filter state is serialised into URL query params so filters are shareable and survive browser back/forward navigation.
- [ ] Frontend: Search results display as `CampaignCard` grid; loading skeleton state during fetch.
- [ ] Frontend: Empty state on no results: "No missions match that search. Browse active campaigns instead." per L2-001 Section 4.2.
- [ ] Frontend: Active filters are visually indicated; each filter is individually dismissible.

### User Story

As a donor, I want to search and filter campaigns so that I can find Mars missions aligned with my interests.

### Key Decisions / Open Questions

- `tsvector` column approach (stored computed column + GIN index) is chosen over `to_tsvector()` at query time for performance.
- Auto-complete suggestions endpoint (`GET /v1/campaigns/search/suggest`) can be added as a follow-up; not required for this feature.
- "New" status in filters = campaigns created within the last 7 days.

### Out of Scope

- Personalised recommendation engine (theatre per L4-003 local demo scope).
- Saved search / search history (P3).
- Auto-complete suggestions endpoint (P2 enhancement).
- Curated collections / editorial curation (P2).
