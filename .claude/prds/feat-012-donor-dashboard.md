## feat-012: Donor Dashboard and Contribution History

**Bounded Context(s):** Donor
**Priority:** P2
**Dependencies:** feat-010, feat-011
**Estimated Complexity:** M

### Summary

Delivers the authenticated donor's personal dashboard: a contribution history list with statuses, a cumulative impact summary, and per-campaign impact views showing milestone progress and creator updates. Tax receipt download is included. This completes the core donor relationship management loop.

### Acceptance Criteria

- [ ] `GET /api/v1/me/contributions` returns all contributions for the authenticated donor, paginated (default 20), with fields: `id`, `campaignId`, `campaignTitle`, `amountCents` (as string), `status`, `createdAt`; supports `sort` parameter (newest|oldest) and `status` filter
- [ ] Contribution status values returned are: `pending_capture`, `captured`, `refunded`, `partially_refunded`, `failed`; the frontend maps these to user-friendly labels: Pending, Confirmed, Refunded, Partially Refunded, Failed
- [ ] `GET /api/v1/me/impact` returns cumulative impact stats: `{ totalContributedCents: string, campaignsBacked: number, milestonesAchieved: number, campaignsCompleted: number }`
- [ ] `GET /api/v1/me/contributions/:id` returns full contribution detail including the backed campaign's current status and milestone progress
- [ ] `GET /api/v1/me/contributions/:id/receipt` generates and returns a PDF tax receipt for a confirmed contribution; includes donor display name, amount (USD), date, campaign title, transaction reference, and platform tax-exempt identifier; returns `404` if contribution is not in `captured` state
- [ ] The donor dashboard at `/dashboard` displays: cumulative impact stats (total contributed, campaigns backed, milestones achieved), and a contributions list with campaign title, amount, date, and status badge
- [ ] Each contribution row in the dashboard links to `/campaigns/:id` (the campaign public page)
- [ ] A contribution with status `refunded` displays a "Refunded" badge in a warning/muted colour using `--color-status-warning`
- [ ] The impact stats section uses `--color-status-success` for positive metrics (campaigns completed, milestones achieved)
- [ ] Empty state: if the donor has no contributions, display "You haven't backed any missions yet" with a "Discover Missions" CTA linking to `/discover`
- [ ] Integration test: `GET /api/v1/me/contributions` returns only contributions belonging to the authenticated user — not other users' contributions
- [ ] Integration test: `GET /api/v1/me/contributions/:id/receipt` for a `pending_capture` contribution returns `404`
- [ ] Integration test: `GET /api/v1/me/impact` returns correct `totalContributedCents` as the sum of all `captured` contributions for the user (not including failed or pending)

### User Story

As a mission backer, I want to see all my contributions and their impact so that I feel connected to the missions I'm funding.

### Key Decisions / Open Questions

- PDF receipt generation uses a server-side library (e.g., PDFKit); receipt template is text-only for MVP (no custom branding)
- `milestonesAchieved` is the count of `verified` milestones across all campaigns the donor has contributed to
- `campaignsCompleted` is the count of campaigns in `complete` state that the donor has contributed to
- Annual summary receipt is out of scope for MVP (single contribution receipt only)

### Out of Scope

- Annual tax summary receipt
- Push notification opt-in
- Re-engagement automation and anniversary notifications (theatre)
- Recommendation engine on the dashboard (theatre)
- Social sharing from dashboard (handled in feat-010 post-contribution)
