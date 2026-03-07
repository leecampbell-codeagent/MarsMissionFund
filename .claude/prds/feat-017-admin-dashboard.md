## feat-017: Admin Dashboard and Financial Reporting

**Bounded Context(s):** Payments, Campaign, Account
**Priority:** P2
**Dependencies:** feat-010, feat-012
**Estimated Complexity:** M

### Summary

Implement the admin-facing financial dashboard showing platform-level metrics (total raised, total in escrow, total disbursed, total refunded), per-campaign financials, and basic user management (view users, assign/remove roles). This surfaces the data from the escrow ledger and contribution records per L4-004 Section 12.

### Acceptance Criteria

- [ ] `GET /v1/admin/financials/summary` returns: `total_raised_cents`, `total_in_escrow_cents`, `total_disbursed_cents`, `total_refunded_cents`. All as strings. Admin role required.
- [ ] `GET /v1/admin/campaigns` returns all campaigns (all statuses) with basic stats. Admin role required. Supports pagination and status filter.
- [ ] `GET /v1/admin/campaigns/:id/financials` returns per-campaign: `total_contributions`, `contribution_count`, `escrow_balance_cents`, `total_disbursed_cents`, `total_refunded_cents`, `funding_percentage`. Admin role required.
- [ ] `GET /v1/admin/users` returns paginated user list with: `id`, `email`, `display_name`, `roles`, `kyc_status`, `created_at`. Admin role required.
- [ ] `POST /v1/admin/users/:id/roles` adds/removes roles (existing from feat-002, confirm it's wired here).
- [ ] All financial amounts returned as strings.
- [ ] All admin endpoints enforce `administrator` or `super_administrator` role; return 403 otherwise.
- [ ] Access to financial reports is logged (admin user ID, endpoint, timestamp).
- [ ] Integration tests cover: summary stats, per-campaign financials, user list, role assignment, 403 for non-admin.
- [ ] Frontend: Admin dashboard at `/admin` with stat cards for platform financials using `StatCard` component.
- [ ] Frontend: Campaign management table at `/admin/campaigns` with status, funding progress, and action buttons (view detail, settle, fail, cancel).
- [ ] Frontend: User management table at `/admin/users` with role badges and "Assign Role" / "Remove Role" controls.
- [ ] Frontend: Navigation sidebar for admin section: Dashboard, Review Queue, Campaigns, Users.

### User Story

As an Administrator, I want to see platform financial health and manage users and campaigns so that I can maintain platform integrity.

### Key Decisions / Open Questions

- Financial summary uses simple SUM queries over the `escrow_ledger` and `contributions` tables.
- This feature adds the admin navigation layout; the review queue from feat-008 is integrated into it.

### Out of Scope

- Daily reconciliation report (theatre per L4-004).
- Downloadable financial reports (P3).
- Audit log viewer (P3).
