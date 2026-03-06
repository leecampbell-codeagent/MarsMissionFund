## feat-014: Admin Financial Dashboard

**Bounded Context(s):** Payments, Campaign
**Priority:** P2
**Dependencies:** feat-011, feat-013
**Estimated Complexity:** S

### Summary

Provides the Administrator role with a financial overview dashboard showing platform-wide financial metrics and per-campaign financial breakdowns. Read-only reporting view over the escrow ledger. Restricted to users with the Administrator or Super Administrator role.

### Acceptance Criteria

- [ ] `GET /api/v1/admin/financials/summary` returns: `{ totalRaisedCents: string, totalDisbursedCents: string, totalInEscrowCents: string, totalRefundedCents: string, activeCampaignCount: number, fundedCampaignCount: number }`; requires Administrator role; returns `403` otherwise
- [ ] `GET /api/v1/admin/financials/campaigns` returns paginated list of all campaigns with per-campaign financial summary: `{ campaignId, title, status, totalContributionsCents, escrowBalanceCents, disbursedCents, refundedCents, contributorCount }`; requires Administrator role
- [ ] All monetary values in API responses are returned as strings (never numbers) to preserve precision
- [ ] The admin dashboard at `/admin` is accessible only to users with the Administrator role; non-admins are redirected to `/` with a `403` toast notification
- [ ] The admin dashboard displays platform-wide financial stats in a summary card grid: Total Raised, Total Disbursed, Total in Escrow, Total Refunded
- [ ] The admin dashboard includes a campaign financial table listing all campaigns with financial data columns; sortable by total raised and escrow balance
- [ ] The admin dashboard links to the review queue (`/review`) and milestone management per campaign
- [ ] Integration test: `GET /api/v1/admin/financials/summary` called by a user with only Backer role returns `403`
- [ ] Integration test: `totalInEscrowCents` equals `totalRaisedCents` minus `totalDisbursedCents` minus `totalRefundedCents` (within integer arithmetic)

### User Story

As a platform administrator, I want to see a financial overview so that I can monitor platform health and ensure funds are accounted for correctly.

### Key Decisions / Open Questions

- All financial totals are computed by querying the `escrow_ledger` table (summing by `entry_type`), not from denormalised columns — this ensures consistency with the source of truth
- `totalInEscrowCents` = SUM of contribution entries − SUM of disbursement entries − SUM of refund entries

### Out of Scope

- Daily reconciliation reports and discrepancy detection (theatre)
- Net platform position (requires interest accounting which is theatre)
- Export to CSV/PDF
- Real-time WebSocket updates to the dashboard
