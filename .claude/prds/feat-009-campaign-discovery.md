## feat-009: Campaign Discovery and Search

**Bounded Context(s):** Donor, Campaign
**Priority:** P1
**Dependencies:** feat-008
**Estimated Complexity:** M

### Summary

Provides the primary campaign discovery interface: a searchable, filterable list of live campaigns with category browsing and curated featured campaigns. Both anonymous and authenticated users can search and browse. Authenticated users receive personalised elements (search history is out of scope for MVP). This is the entry point for the donor journey.

### Acceptance Criteria

- [ ] `GET /api/v1/campaigns/discover` returns paginated live and funded campaigns (default 20 per page); accessible without authentication; supports query parameters: `q` (full-text search across title, summary, description), `category` (multi-value), `status` (active|funded|ending_soon), `sort` (newest|ending_soon|most_funded|least_funded); returns `200` with `{ data: Campaign[], total: number, page: number }`
- [ ] Full-text search via the `q` parameter searches `title`, `summary`, and `description` fields; results are ordered by text search rank when `q` is present
- [ ] `ending_soon` status filter returns campaigns with `deadline` within 7 days, sorted by nearest deadline
- [ ] Filter state is reflected in the URL query string so users can share filtered views (frontend-side)
- [ ] `GET /api/v1/campaigns/categories` returns the 10 campaign categories with aggregate stats: `{ category, description, active_campaign_count, total_raised_cents }`; accessible without authentication
- [ ] The home page at `/` displays: a hero section with headline copy, a "Featured Campaigns" section (3 manually curated or most-recent live campaigns), and a category grid
- [ ] The discover page at `/discover` renders: search input with debounced query (300ms), category filter chips, status filter, sort selector, and paginated campaign cards
- [ ] Each campaign card displays: hero image (or placeholder), title, creator name, category badge, funding progress bar, amount raised (USD formatted), percentage funded, days remaining
- [ ] An unauthenticated user searching for campaigns sees results without personalised recommendations, with a subtle "Sign in for personalised picks" prompt
- [ ] Selecting a category from the category grid navigates to `/discover?category=<category>` with the filter pre-applied
- [ ] Empty state: if search returns no results, display a message "No missions found matching your search" with a "Clear filters" action
- [ ] Integration test: `GET /api/v1/campaigns/discover?q=propulsion` returns only campaigns with "propulsion" in title, summary, or description
- [ ] Integration test: `GET /api/v1/campaigns/discover?status=ending_soon` returns only campaigns with deadline within 7 days
- [ ] Integration test: `GET /api/v1/campaigns/discover?category=Propulsion&category=Power+%26+Energy` returns campaigns from both categories

### User Story

As a mission backer, I want to search and browse Mars campaigns by category and funding status so that I can discover projects that match my interests.

### Key Decisions / Open Questions

- Full-text search is implemented using PostgreSQL `tsvector`/`tsquery` — a `search_vector` generated column on the `campaigns` table, updated on insert/update
- Add migration for the `search_vector` column and GIN index as part of this feature
- Curated featured campaigns on the home page are the 3 most recently launched live campaigns (no separate editorial curation table for MVP)
- Recommendation engine (collaborative filtering) is theatre — this feature delivers content-based discovery only

### Out of Scope

- Personalised recommendation engine (theatre per L4-003 local demo scope)
- Persistent search history per user
- "Similar Missions" section on campaign pages (theatre)
- Re-engagement automation (theatre)
