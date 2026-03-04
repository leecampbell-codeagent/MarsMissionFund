## feat-014: Campaign Search & Filtering

**Bounded Context(s):** Donor
**Priority:** P2
**Dependencies:** feat-007
**Estimated Complexity:** M

### Summary

Implement full-text search across campaigns and advanced filtering to help donors discover relevant missions. Search is powered by PostgreSQL full-text search over CQRS read models (no external search provider). Enhances the basic category browsing from feat-007 with keyword search, multi-filter composition, and result highlighting.

### Acceptance Criteria

- [ ] Search bar on campaign listing page with full-text search across campaign titles, descriptions, creator names, and category names
- [ ] Search results ranked by relevance using PostgreSQL `ts_rank`
- [ ] Search result highlighting of matched terms in title and summary
- [ ] Auto-complete suggestions as donor types (debounced input, results within 200ms)
- [ ] Filters composable with AND logic: category (multi-select), funding status (Active, Fully Funded, Ending Soon, New), deadline range, sort order (Relevance, Newest, Ending Soon, Most Funded, Least Funded)
- [ ] "Ending Soon" filter shows campaigns with deadlines within 7 days, sorted by nearest deadline
- [ ] Filter state preserved in URL query parameters (shareable, back-button compatible)
- [ ] Active filters visually indicated with clear option to remove individual filters
- [ ] `GET /v1/campaigns/search?q=...&category=...&status=...&sort=...` returns filtered, paginated results
- [ ] PostgreSQL `tsvector` column on campaign read model, updated on campaign creation/update
- [ ] GIN index on `tsvector` column for search performance
- [ ] Search accessible to anonymous users (no auth required)
- [ ] Empty state: no results found, with suggestion to broaden search
- [ ] Component tests for search bar, filter panel, search results (all states)
- [ ] Integration tests for search API with various filter combinations

### User Story

As a backer, I want to search and filter campaigns so that I can find Mars missions aligned with my interests.

### Key Decisions / Open Questions

- PostgreSQL full-text search over CQRS read models (per architecture spec — no Elasticsearch)
- Pagination: offset-based for MVP

### Out of Scope

- Persistent search history per donor
- Personalised recommendations
- Curated collections / editorial features
- Faceted search counts
