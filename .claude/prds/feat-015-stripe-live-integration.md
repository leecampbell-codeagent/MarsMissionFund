## feat-015: Stripe Live Payment Integration

**Bounded Context(s):** Payments
**Priority:** P3
**Dependencies:** feat-010
**Estimated Complexity:** L

### Summary

Replace the mock Stripe adapter with a real `StripePaymentGatewayAdapter` using Stripe Elements for PCI DSS SAQ-A compliant card tokenisation. Real money does not move in demo/development, but the integration uses Stripe's test mode with real API calls. This covers the full tokenisation flow, webhook handling, and idempotency per L4-004 Sections 3–5.

### Acceptance Criteria

- [ ] `StripePaymentGatewayAdapter` implements `PaymentGatewayPort` using the `stripe` Node SDK behind the adapter interface — no direct Stripe SDK references in application or domain code.
- [ ] `POST /v1/payments/create-intent` creates a Stripe Payment Intent and returns `{ client_secret }` to the frontend (never the raw intent object).
- [ ] Frontend payment form uses `@stripe/stripe-js` Stripe Elements (CardElement) for card tokenisation. Raw card data never touches the platform server.
- [ ] Stripe webhook endpoint `POST /v1/webhooks/stripe` verifies the `Stripe-Signature` header using `stripe.webhooks.constructEvent`. Rejects unverified webhooks with 400.
- [ ] Webhook processing is idempotent — the same `payment_intent.succeeded` event processed twice produces no duplicate contributions.
- [ ] `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `VITE_STRIPE_PUBLISHABLE_KEY` are documented in `.env.example`.
- [ ] `MOCK_PAYMENT=false` switches to the real adapter.
- [ ] Integration tests cover: payment intent creation, webhook signature verification, idempotent webhook replay, failed payment handling.

### User Story

As a donor, I want to pay with my real card via a secure, PCI-compliant payment form so that my contribution is processed safely.

### Key Decisions / Open Questions

- Stripe test mode is used in development; live mode keys are environment-specific.
- No stored payment methods per L4-004 Section 4.3.

### Out of Scope

- Stripe Connect for payouts to creators (feat-016).
- Multi-currency support (out of scope per L4-004).
