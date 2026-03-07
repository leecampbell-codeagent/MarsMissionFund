## feat-011: Donor Dashboard and Contribution History

**Bounded Context(s):** Donor, Payments
**Priority:** P1
**Dependencies:** feat-003, feat-004, feat-010
**Estimated Complexity:** M

### Summary

Implement the donor's personal dashboard: contribution history list, individual contribution status, cumulative impact stats, and the per-campaign impact view. Per L4-003 local demo scope, this is a core feature. The recommendation engine and re-engagement automations are theatre; browse + contribute + view history are real.

### Acceptance Criteria

- [ ] `GET /v1/me/contributions` returns the authenticated donor's contributions, paginated (20/page). Each item includes: `id`, `campaign_id`, `campaign_title`, `mission_code`, `amount_cents` (as string), `currency`, `status`, `created_at`. Supports `status` filter and `sort` by `created_at` (desc default).
- [ ] `GET /v1/me/contributions/stats` returns cumulative stats: `total_contributed_cents` (string), `campaigns_backed` (int), `confirmed_contributions` (int), `refunded_contributions` (int).
- [ ] `GET /v1/campaigns/:id/my-contribution` returns the authenticated donor's contribution to a specific campaign (or 404 if none).
- [ ] All monetary amounts in API responses are strings.
- [ ] Queries are scoped to the authenticated `user_id` from auth context — no cross-donor data leakage.
- [ ] Unit tests cover: stats calculation, contribution status aggregation.
- [ ] Integration tests cover: get contributions empty state, get contributions with data, stats aggregation, status filter, cross-donor isolation (donor A cannot see donor B's contributions).
- [ ] Frontend: Donor dashboard at `/dashboard` renders:
  - Cumulative stat cards (total contributed, campaigns backed) using `StatCard` component per L2-001 Section 3.4.
  - Contribution history table/list with: campaign title (linked to `/campaigns/:id`), mission code, amount (USD via `Intl.NumberFormat`), date, status badge.
  - Filtering by status; sorting by date.
  - Empty state: "Your mission log is empty. Find a mission to back." per L2-001 Section 4.2 empty state pattern.
- [ ] Frontend: All monetary amounts received from API are strings and displayed via `Intl.NumberFormat` — never parsed to `number`.
- [ ] Frontend: Per-campaign impact view (accessible from contribution history): campaign progress bar, milestone list with statuses, creator updates (if any).
- [ ] Frontend: Contribution status badges use the correct semantic tokens per L2-001 Section 3.5 (e.g., `--color-status-success` for `completed`, `--color-status-warning` for `pending`).
- [ ] Frontend: Dashboard is an auth-gated route (`/dashboard`) — unauthenticated users are redirected to sign-in.
- [ ] Frontend: TanStack Query `staleTime: 0` on all financial data queries (amounts, stats).

### User Story

As a donor, I want to see all my contributions and their current status so that I can track the missions I'm funding.

### Key Decisions / Open Questions

- `campaign_title` and `mission_code` are joined from the `campaigns` table at query time (not denormalised onto `contributions`).
- Contribution status transitions are driven by the payment service (feat-010) and campaign lifecycle events (feat-012).

### Out of Scope

- Tax receipt PDF generation (theatre per L4-003 local demo scope — listed as P2 but complex).
- Annual contribution summary (P2).
- Milestone notifications (feat-013).
- Recommendation engine ("Recommended for You" — theatre per L4-003 local demo scope).
- Re-engagement automation (theatre).
- Social sharing (P2 enhancement).
