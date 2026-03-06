## feat-011: Payment Processing Layer (Gateway Abstraction + Escrow)

**Bounded Context(s):** Payments
**Priority:** P1
**Dependencies:** feat-002, feat-003
**Estimated Complexity:** L

### Summary

Implements the payment gateway abstraction layer, contribution processing state machine, and the per-campaign segregated escrow ledger. In local demo mode, the gateway adapter is stubbed (no real money moves). The architecture is real: all application code interacts only with the `IPaymentGatewayAdapter` interface. Webhook handling is idempotent. The escrow ledger is append-only.

### Acceptance Criteria

- [ ] `IPaymentGatewayAdapter` interface is defined with methods: `createPaymentIntent(params)`, `capturePayment(paymentIntentId)`, `refundPayment(chargeId, amount?)`, `verifyWebhookSignature(payload, sig)`; no application or domain code imports a concrete gateway implementation directly
- [ ] `POST /api/v1/contributions/payment-intent` creates a payment intent via the gateway adapter; requires authentication; accepts `{ campaignId, amountCents }`; validates amount >= 500 (cents) and campaign is in `live` or `funded` state; returns `{ clientSecret: string, contributionId: string }`; the contribution record is created in `pending_capture` state
- [ ] `POST /api/v1/contributions/confirm` accepts `{ contributionId, gatewayReference }`; verifies the payment intent succeeded via the gateway adapter; transitions contribution to `captured`; appends a `contribution` entry to the `escrow_ledger` for the campaign; updates `campaigns.amount_raised_cents`; increments `campaigns.contributor_count`; returns `200` with contribution detail
- [ ] When a campaign transitions to `failed` (deadline passed, goal not met), `POST /api/v1/internal/campaigns/:id/fail` triggers full refunds for all `captured` contributions: each contribution transitions to `refunded`, `refund` entries are appended to the escrow ledger, and refunds are executed via the gateway adapter
- [ ] The stub payment gateway adapter (`MockPaymentGatewayAdapter`) always returns success for `createPaymentIntent` and `capturePayment`; controlled by `MOCK_PAYMENTS=true` environment variable
- [ ] Duplicate contribution detection: if the same donor submits a `payment-intent` request for the same campaign within 60 seconds with the same amount, the existing pending contribution is returned rather than creating a duplicate
- [ ] All contribution state transitions are logged (at minimum: `contribution_id`, `old_status`, `new_status`, `timestamp`)
- [ ] The escrow ledger is append-only — no UPDATE or DELETE queries against `escrow_ledger`; only INSERT
- [ ] `GET /api/v1/campaigns/:id/escrow` returns the current escrow balance for a campaign; requires Administrator role; returns `{ balance_cents: string, total_contributions_cents: string, total_refunds_cents: string }`
- [ ] Webhook endpoint `POST /api/v1/webhooks/stripe` verifies the Stripe signature before processing; processes `payment_intent.succeeded` and `payment_intent.payment_failed` events; is idempotent (processing the same event twice produces no side effects)
- [ ] Integration test: `POST /api/v1/contributions/confirm` called twice with the same `contributionId` and `gatewayReference` produces only one `escrow_ledger` entry
- [ ] Integration test: `POST /api/v1/contributions/payment-intent` for a campaign not in `live` or `funded` state returns `409`
- [ ] Domain unit tests achieve >= 90% coverage on contribution state machine and escrow ledger logic

### User Story

As a platform operator, I want a robust payment processing layer that isolates gateway concerns behind an interface so that we can swap payment providers without touching business logic.

### Key Decisions / Open Questions

- With `MOCK_PAYMENTS=true`, the stub gateway assigns a UUID as the `gatewayReference`; `clientSecret` is a fake string; the frontend detects mock mode and skips Stripe Elements rendering, showing a "Simulate Payment" button instead
- Interest accrual calculation is theatre for the local demo — interest is not computed on the stub escrow
- Multi-approval disbursement workflow is theatre for the local demo (feat-013 covers admin milestone verification without dual-approval)

### Out of Scope

- Real Stripe SDK integration (stub only for local demo)
- Multi-approval disbursement workflow (theatre)
- Daily reconciliation process (theatre)
- Donor-initiated refund API (feat-013)
- Financial reporting dashboard (feat-014)
- Interest accrual calculation (theatre)
