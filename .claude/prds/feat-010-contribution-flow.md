## feat-010: Contribution Flow (Donor UI)

**Bounded Context(s):** Donor, Payments
**Priority:** P1
**Dependencies:** feat-008, feat-011
**Estimated Complexity:** M

### Summary

Delivers the donor-facing contribution experience: from clicking "Back This Mission" on a campaign page through amount selection, contribution summary, payment handoff to the payments layer (feat-011), and the confirmation or error screen. Authenticated users only. Minimum contribution is $5 USD. The donor never sees raw card input outside of Stripe Elements (PCI SAQ-A scope).

### Acceptance Criteria

- [ ] Clicking "Back This Mission" on a live campaign navigates authenticated users to `/campaigns/:id/contribute`
- [ ] The contribution amount page displays: campaign title, predefined tier buttons (if configured on campaign), and a custom amount input; minimum $5 USD enforced client-side and server-side
- [ ] Entering an amount below $5 USD shows an inline error "Minimum contribution is $5"
- [ ] The contribution summary page displays: campaign title, contribution amount (USD formatted via `Intl.NumberFormat`), a clear statement "This is a contribution, not an investment", and a "Confirm and Pay" button
- [ ] Monetary amounts are received from the API as strings and displayed without parsing to `number` (BigInt-safe handling)
- [ ] The payment step renders Stripe Elements (card input) in a contained iframe; the platform backend never receives raw card numbers
- [ ] On successful payment processing, the donor is redirected to `/campaigns/:id/contribute/success` showing: precise amount, campaign title, transaction reference, and a "Share this mission" section
- [ ] On payment failure, the donor sees an error page with a retry button and the error message from the payments layer
- [ ] `GET /api/v1/contributions/:id` returns the contribution status for the authenticated donor who owns it; returns `403` if called by a different user
- [ ] The contribution flow handles the campaign being at its funding cap: attempting to contribute to a fully capped campaign returns a message "This campaign has reached its funding cap" and no payment form is shown
- [ ] Integration test: `POST /api/v1/contributions` with `amount_cents < 500` (less than $5) returns `400` with `AMOUNT_BELOW_MINIMUM` error
- [ ] Integration test: `POST /api/v1/contributions` for a `failed` or `complete` campaign returns `409` with `CAMPAIGN_NOT_ACCEPTING_CONTRIBUTIONS`

### User Story

As a mission backer, I want to contribute to a campaign I believe in so that I can help fund humanity's journey to Mars.

### Acceptance Criteria — Social Sharing

- [ ] The contribution success page includes share buttons for X/Twitter, LinkedIn, Facebook, and a "Copy link" option
- [ ] Shared content includes only the campaign title and URL — contribution amount is never included in shared content
- [ ] "Copy link" copies the campaign URL to the clipboard and shows a "Copied!" confirmation tooltip

### Key Decisions / Open Questions

- Stripe Elements is embedded using `@stripe/react-stripe-js` and `@stripe/stripe-js` on the frontend
- The frontend calls `POST /api/v1/contributions/payment-intent` to get a Stripe PaymentIntent client secret; the Stripe Elements form uses this secret to confirm the payment client-side
- After Stripe confirms the payment client-side, the frontend calls `POST /api/v1/contributions/confirm` with the PaymentIntent ID to record the contribution in the backend
- `STRIPE_PUBLISHABLE_KEY` and `STRIPE_SECRET_KEY` documented in `.env.example`; in local demo with `MOCK_PAYMENTS=true`, a stub gateway is used

### Out of Scope

- Stored payment methods (explicitly excluded per L4-004 Section 4.3)
- Contribution tiers defined by creator (UI shows custom amount only for MVP)
- Donor-initiated refund request UI (feat-013)
