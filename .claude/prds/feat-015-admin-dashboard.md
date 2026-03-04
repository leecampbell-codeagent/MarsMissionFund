## feat-015: Admin Dashboard

**Bounded Context(s):** Account, Campaign, Payments
**Priority:** P2
**Dependencies:** feat-004, feat-010
**Estimated Complexity:** L

### Summary

Implement the platform administration dashboard for users with Admin or Super Administrator roles. Covers user management (role assignment, account suspension), campaign oversight (review queue management, suspension/cancellation), KYC admin actions (unlock locked accounts), and basic financial reporting (totals raised, disbursed, in escrow, refunded).

### Acceptance Criteria

- [ ] Admin dashboard accessible only to users with Administrator or Super Administrator role
- [ ] **User Management**: list all accounts, search by email/name, view account details (profile, roles, KYC status, contribution history summary)
- [ ] Assign/remove Reviewer role to a user (Administrator action, logged)
- [ ] Assign/remove Administrator role (Super Administrator only)
- [ ] Super Administrator role cannot be assigned through the UI (provisioned through controlled process)
- [ ] Suspend an account (sets status to `suspended`, revokes all sessions via Clerk)
- [ ] Reinstate a suspended account (sets status to `active`)
- [ ] **Campaign Oversight**: view all campaigns across all states, filter by state
- [ ] Manually reassign a campaign in review to a different reviewer
- [ ] Suspend/resume a live or funded campaign
- [ ] Approve campaign cancellation requests
- [ ] **KYC Admin**: view KYC verification status for any user, unlock locked KYC accounts
- [ ] **Financial Summary**: total raised, total disbursed, total in escrow, total refunded across all campaigns
- [ ] Per-campaign financial details: contributions count/amount, escrow balance, disbursements
- [ ] All admin actions emit audit events with admin identity, action, target resource, rationale
- [ ] Role-based access enforced on all admin API endpoints
- [ ] `GET /v1/admin/accounts` — paginated account list (Admin role)
- [ ] `PATCH /v1/admin/accounts/:id/roles` — role assignment (Admin/Super Admin)
- [ ] `POST /v1/admin/accounts/:id/suspend` — account suspension (Admin role)
- [ ] `GET /v1/admin/campaigns` — all campaigns, filterable by state (Admin role)
- [ ] `GET /v1/admin/financial-summary` — aggregate financial metrics (Admin role)
- [ ] Integration tests for all admin endpoints with role verification

### User Story

As a platform administrator, I want a dashboard to manage users, campaigns, and finances so that the platform operates safely and transparently.

### Key Decisions / Open Questions

- Financial metrics are read from escrow ledger aggregations and contribution/disbursement tables
- Super Admin provisioning is a controlled process (seed script or direct DB) — not through the admin UI

### Out of Scope

- Audit log viewer (Phase 2)
- Reconciliation reports (Phase 2)
- Review SLA monitoring
- Platform configuration settings
- Notification template management
