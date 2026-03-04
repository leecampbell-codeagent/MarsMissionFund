## feat-009: Payment Processing (Mock Gateway)

**Bounded Context(s):** Payments
**Priority:** P1
**Dependencies:** feat-002
**Estimated Complexity:** L

### Summary

Implement the payment gateway abstraction layer, mock Stripe adapter, escrow ledger, and contribution state machine. The real Stripe SDK is integrated behind the adapter interface, but a mock adapter is the default for local development. This feature establishes the payment architecture pattern that all financial flows depend on.

### Acceptance Criteria

- [ ] Payment gateway adapter interface (port) defined with methods: `capturePayment`, `refundPayment`, `getPaymentStatus`
- [ ] Mock payment gateway adapter implements the interface — simulates success/failure without real money, configurable via `MOCK_PAYMENTS=true` environment variable
- [ ] Real Stripe adapter implements the same interface using `stripe` Node SDK (behind feature flag, not default)
- [ ] Application code references only the port interface, never the Stripe SDK or mock directly
- [ ] Contribution state machine: `pending_capture` -> `captured` -> `refunded` / `partially_refunded`; `pending_capture` -> `failed`
- [ ] On capture: escrow ledger entry created (credit to campaign escrow account)
- [ ] Escrow ledger is append-only — no UPDATE or DELETE on ledger entries
- [ ] Ledger entries record: campaign_id, entry_type (contribution, disbursement, refund), amount_cents, contribution_id, description, created_at
- [ ] `POST /v1/payments/capture` processes a payment token and campaign_id (called by contribution flow)
- [ ] Webhook handler endpoint for Stripe events (signature verification, idempotent processing)
- [ ] Mock adapter webhook simulation for local testing
- [ ] Payment failure handling: graceful error, donor notification, no inconsistent state
- [ ] All payment state mutations emit events to event store
- [ ] Sensitive data (card numbers, tokens) never logged — only resource identifiers
- [ ] Environment variables in `.env.example`: `MOCK_PAYMENTS`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY`
- [ ] Unit tests for payment state machine transitions
- [ ] Integration tests for capture success, capture failure, webhook processing (idempotent)
- [ ] 100% test coverage of success and failure paths per engineering standard

### User Story

As the platform, I want a payment processing layer with mock and real adapters so that contributions can be captured, held in escrow, and eventually disbursed or refunded.

### Key Decisions / Open Questions

- Mock adapter is default for local dev; real Stripe enabled via environment variable and feature flag
- Immediate capture (no pre-auth) per payments spec resolution
- No stored payment methods per payments spec
- Segregated escrow is logical separation in a single database for local demo

### Out of Scope

- Disbursement processing (feat-011)
- Refund processing triggered by campaign failure (feat-010)
- Donor-initiated refund flow
- Daily reconciliation
- Financial reporting dashboard (feat-015)
- Interest calculation on escrowed funds
