## feat-010: Contribution Flow and Payment Processing Stub

**Bounded Context(s):** Donor, Payments
**Priority:** P1
**Dependencies:** feat-002, feat-005, feat-009
**Estimated Complexity:** L

### Summary

Implement the end-to-end contribution flow: donor selects amount, reviews summary, proceeds to payment, and receives confirmation. The Stripe payment gateway is stubbed for the local demo (no real money moves) — but the `PaymentGatewayPort` abstraction, contribution state machine, and escrow ledger writes are all real. Per L4-004 local demo scope, the architectural pattern is demonstrated even though the gateway is mocked.

### Acceptance Criteria

- [ ] `PaymentGatewayPort` interface in `packages/backend/src/payments/ports/` with methods: `createPaymentIntent(amount, currency, metadata)`, `confirmPayment(intentId)`, `refund(chargeId, amount)`.
- [ ] `MockStripeAdapter` implements `PaymentGatewayPort`; `createPaymentIntent` returns a fake `pi_test_xxx` intent ID; `confirmPayment` always returns success (unless `MOCK_PAYMENT_FAILURE=true` env var is set, which returns failure for testing).
- [ ] `Contribution` domain entity with status state machine: `pending_capture → captured → failed → refunded`.
- [ ] `POST /v1/campaigns/:id/contributions` initiates a contribution. Authenticated donor only. Request body: `{ amount_cents: number }`. Validates: campaign is `live` or `funded`, `amount_cents >= 500` (≥ $5), `amount_cents <= max_funding_cap - total_contributed_cents` (cannot exceed cap). Creates `contributions` row with `status: pending_capture`.
- [ ] `POST /v1/contributions/:id/confirm` confirms the contribution: calls `confirmPayment` on the adapter; on success: updates `contributions.status` to `captured`, updates `escrow_ledger.balance_cents` and `total_contributed_cents`, appends an `escrow_entries` row (`entry_type: contribution`). Updates `campaigns` funding progress. Returns the confirmed contribution with transaction reference.
- [ ] If the contribution causes `total_contributed_cents >= min_funding_target`, the campaign transitions to `funded` state and this is audit-logged.
- [ ] `POST /v1/contributions/:id/confirm` is idempotent — processing the same contribution ID twice produces the same outcome (idempotency key on `stripe_payment_intent_id`).
- [ ] Duplicate contribution guard: same donor + same campaign + same amount + within 60 seconds returns 409 with code `DUPLICATE_CONTRIBUTION`.
- [ ] All monetary amounts in API responses are serialised as strings.
- [ ] `MOCK_PAYMENT=true` environment variable (in `.env.example`) controls which adapter is used.
- [ ] Unit tests ≥ 90% on `Contribution` entity, `EscrowLedger` domain service, and payment application service.
- [ ] Integration tests cover: successful contribution, payment failure, duplicate contribution rejected, cap exceeded, campaign transitions to funded at target.
- [ ] Frontend: Contribution flow at `/campaigns/:id/contribute` — a 3-step flow:
  1. **Amount selection**: Predefined tiers (if any) + custom amount input. Min $5 validation. Amount displayed with `Intl.NumberFormat` USD formatting.
  2. **Summary screen**: Campaign title, amount, "This is a contribution, not an investment" statement per L2-001 Section 4.3 (forbidden language).
  3. **Payment screen**: Mocked payment form with a "Confirm Contribution" button (for demo, no real Stripe Elements — a placeholder card input that always succeeds).
- [ ] Frontend: Confirmation screen on success: precise amount, mission code, transaction reference, per L2-001 Section 4.2 financial confirmation copy patterns.
- [ ] Frontend: Error screen on failure: per L2-001 Section 4.2 error state copy ("We couldn't process this right now…").
- [ ] Frontend: Monetary amounts received from API are treated as strings — never parsed to `number`. Displayed via `Intl.NumberFormat`.
- [ ] Frontend: After contribution success, the campaign page funding progress bar updates immediately (optimistic update + background refetch).

### User Story

As a donor, I want to contribute to a campaign I believe in so that I can help fund Mars-enabling technology.

### Key Decisions / Open Questions

- The mocked payment form does not use Stripe Elements; a real Stripe Elements integration is a P3 feature.
- Contribution `amount_cents` is validated as an integer in cents; the frontend sends cents (e.g., 5000 for $50).
- Escrow ledger balance is updated synchronously in the same transaction as the contribution status update.

### Out of Scope

- Real Stripe Elements integration and tokenisation (P3 — feat-015).
- Stored payment methods (out of scope per L4-004 — no stored cards).
- Donor-initiated refunds (feat-012).
- Tax receipt generation (feat-011).
