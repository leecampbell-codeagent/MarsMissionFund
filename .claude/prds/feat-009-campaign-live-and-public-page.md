## feat-009: Campaign Launch and Public Campaign Page

**Bounded Context(s):** Campaign, Donor
**Priority:** P1
**Dependencies:** feat-003, feat-004, feat-008
**Estimated Complexity:** M

### Summary

Implement the `Approved → Live` transition (creator launches a campaign) and the public campaign page that donors see. This is the primary discovery surface: the campaign card in search results and the full campaign detail page. Includes funding progress display, campaign metadata, and the "Back This Mission" CTA that feeds into the contribution flow.

### Acceptance Criteria

- [ ] `POST /v1/campaigns/:id/launch` transitions `approved → live`. Creator only. Sets `deadline` if not already set. Creates the escrow ledger row for this campaign (`escrow_ledger` table).
- [ ] `GET /v1/campaigns/:id` returns full public campaign data for `live`, `funded`, `complete`, `failed` campaigns — accessible without authentication.
- [ ] `GET /v1/campaigns` (public) returns a paginated list of `live` and `funded` campaigns. Supports query params: `category`, `status`, `sort` (`newest`, `ending_soon`, `most_funded`). Returns 20 items per page default.
- [ ] Campaign response payload includes: `id`, `title`, `summary`, `description`, `category`, `status`, `min_funding_target`, `max_funding_cap`, `total_contributed_cents` (from escrow ledger), `contributor_count`, `deadline`, `hero_image_url`, `milestones` (array), `team_members` (array), `risk_disclosures` (array), `mission_code` (format: `MMF-YYYY-XXXX`, auto-generated on submission).
- [ ] Monetary amounts in all API responses are serialised as **strings** (not numbers), e.g., `"total_contributed_cents": "15750000"`.
- [ ] `contributor_count` is a live COUNT query from the `contributions` table where `status = 'captured'`.
- [ ] `GET /v1/campaigns/:id/updates` returns creator-posted updates (campaign updates table required — add to feat-005's schema or add migration here).
- [ ] All campaign endpoints require no authentication for read operations on `live`/`funded`/`complete`/`failed` campaigns.
- [ ] Frontend: Public campaign page at `/campaigns/:id` renders:
  - Hero image (with fallback placeholder).
  - Campaign title in `--type-page-title` (Bebas Neue, uppercase).
  - Status badge (`live`, `funded`, etc.) per L2-001 Section 3.5.
  - Funding progress bar with percentage funded and days remaining per L2-001 Section 3.3.
  - "Back This Mission" primary CTA button (navigates to contribution flow at `/campaigns/:id/contribute`).
  - Campaign description, team members, milestones timeline, risk disclosures.
  - `--gradient-campaign-hero` for the hero section background.
- [ ] Frontend: Funding progress updates via TanStack Query refetch every 30 seconds while the page is visible.
- [ ] Frontend: Campaign card component (used in discovery/search): title, category badge, progress bar, % funded, days remaining, hero thumbnail.
- [ ] Frontend: Campaign listing page at `/campaigns` shows a grid of campaign cards with category filter and sort controls.
- [ ] Frontend: Empty state when no campaigns match filters follows L2-001 Section 4.2 empty state copy patterns.
- [ ] Frontend: `staleTime: 0` on financial data (funding totals, contributor count) — always revalidate on mount.

### User Story

As a donor, I want to discover live campaigns and see their funding progress so that I can decide which Mars missions to back.

### Key Decisions / Open Questions

- Mission codes are auto-generated on submission using the format `MMF-{YEAR}-{4-digit-zero-padded-sequence}`.
- Campaign updates are posted by creators after going live; the table migration can be added here.
- The "Back This Mission" CTA on the campaign page is the only primary CTA per viewport per L2-001.

### Out of Scope

- Full-text search (feat-010).
- Contribution flow (feat-010).
- Stretch goals display (theatre per L4-002 local demo scope).
- Deadline enforcement automation (system transition to `failed` state — added in a scheduler task, P2).
- Social sharing Open Graph meta tags (P2).
