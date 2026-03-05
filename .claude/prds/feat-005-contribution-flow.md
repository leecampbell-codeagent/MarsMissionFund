## feat-005: Contribution Flow and Payment Processing (Stubbed Gateway)

**Bounded Context(s):** Payments (L4-004), Donor (L4-003)
**Priority:** P1
**Dependencies:** feat-001, feat-003, feat-004
**Estimated Complexity:** L

### Summary

This feature implements the end-to-end contribution flow: a donor selects an amount on a campaign page, submits payment via Stripe Elements (client-side tokenisation), and the backend captures the payment through the stubbed Stripe adapter, records it to the escrow ledger, and returns a confirmation with a transaction reference.
The payment gateway is stubbed — no real money moves — but the architectural pattern (port/adapter abstraction, escrow ledger, contribution state machine) is fully implemented.

### Acceptance Criteria

- [ ] The contribution flow is accessible only to authenticated users; unauthenticated attempts to initiate a contribution receive HTTP 401.
- [ ] An authenticated user can submit a contribution to a `Live` campaign with a minimum amount of $5 USD (500 cents); amounts below the minimum are rejected with a descriptive error.
- [ ] The contribution initiation endpoint (`POST /contributions`) accepts: campaign ID, amount (integer cents as string), and a payment method token; returns a contribution ID and pending status.
- [ ] The stub payment gateway adapter returns a successful capture for any valid token; the contribution transitions from `pending_capture` to `captured`.
- [ ] On successful capture, a segregated escrow ledger entry is created for the campaign, recording the contribution amount, donor ID, campaign ID, and timestamp.
- [ ] The campaign's total raised amount and contributor count are updated immediately after a successful capture.
- [ ] The contribution confirmation response includes: contribution ID, campaign ID, amount (as string in cents), status (`captured`), and a transaction reference.
- [ ] The stub adapter returns a payment failure when the payment token equals a sentinel value (e.g., `tok_fail`); the contribution transitions to `failed` and the donor receives a clear error response.
- [ ] Submitting an identical contribution (same donor, same campaign, same amount) within a 60-second window is rejected with HTTP 409 and error code `DUPLICATE_CONTRIBUTION`.
- [ ] A contribution to a campaign that is not in `Live` state is rejected with HTTP 422 and error code `CAMPAIGN_NOT_ACCEPTING_CONTRIBUTIONS`.
- [ ] Every contribution state transition is audit-logged with: contribution ID, campaign ID, donor ID, previous state, new state, amount, and timestamp.
- [ ] The payment gateway adapter interface (port) is defined; the stub and any future real Stripe adapter both satisfy this interface without changes to application or domain code.
- [ ] No raw card data or payment tokens are logged at any layer.

### User Story

As a mission backer, I want to contribute money to a Mars campaign I believe in so that I can help make the mission a reality and track my contribution's status.

### Key Decisions / Open Questions

- The Stripe Elements integration (client-side tokenisation) means the frontend communicates directly with Stripe to produce a `paymentMethod` token; the backend receives only the token ID — never card data.
- For the local demo stub, define the sentinel token values for success and failure (e.g., `tok_success` and `tok_fail`) so the frontend can test both paths.
- The escrow ledger is a double-entry ledger table in PostgreSQL; define the schema (campaign_id, contribution_id, entry_type, amount, balance, created_at) at implementation.
- Interest accrual on escrowed funds is theatre for the local demo; the ledger schema should include an `interest` column but the calculation is not implemented.
- Multi-approval disbursement workflow is theatre for the local demo; the disbursement endpoints are out of scope for this feature.
- Donor-initiated refunds are out of scope for this feature; handled in feat-006 as part of the post-contribution experience.

### Out of Scope

- Real Stripe gateway integration with live credentials (theatre; mock adapter only).
- Multi-approval disbursement workflow (theatre).
- Milestone-based fund release (triggers wired in feat-003 but execution theatre).
- Campaign failure refund automation (theatre).
- Donor-initiated refund requests (out of MVP for this feature).
- Tax receipt generation (out of MVP; deferred to a future cycle).
- Stored payment methods (explicitly excluded in L4-004 Section 4.3).
- Daily reconciliation and financial reporting dashboards (theatre).




























