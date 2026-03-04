## feat-008: Contribution Flow

**Bounded Context(s):** Donor, Payments
**Priority:** P1
**Dependencies:** feat-007, feat-009
**Estimated Complexity:** L

### Summary

Implement the donor contribution flow from the "Back This Mission" CTA through amount selection, contribution summary, payment handoff, and confirmation. This is the core value exchange of the platform — backers funding Mars missions. The payment processing itself is handled by feat-009; this feature owns the donor-side UX and the orchestration between donor and payments bounded contexts.

### Acceptance Criteria

- [ ] "Back This Mission" CTA on campaign page initiates contribution flow (authenticated users only; unauthenticated users redirected to sign-in)
- [ ] Amount selection step: custom amount input with minimum $5 USD (500 cents) validation, maximum governed by campaign cap minus current raised
- [ ] Amount displayed with USD currency formatting via `Intl.NumberFormat`
- [ ] Contribution summary step: campaign title, contribution amount, clear "contribution not investment" disclaimer per brand spec forbidden language patterns
- [ ] Payment handoff: Stripe Elements embedded form for card details (client-side tokenisation, SAQ-A compliant)
- [ ] On successful payment: confirmation screen with precise amount, campaign name, transaction reference, and "what happens next" guidance (milestone updates)
- [ ] On payment failure: error screen with clear message and retry path, following brand error copy patterns
- [ ] Contribution recorded in `contributions` table with status `captured`
- [ ] Contribution amount added to campaign's escrow ledger
- [ ] Campaign funding progress updated in read model (contributor count + amount raised)
- [ ] When campaign reaches minimum funding target, transitions to `funded` state (remains open for contributions until deadline or max cap)
- [ ] When contribution would exceed max funding cap, contribution rejected with clear message
- [ ] `POST /v1/contributions` creates contribution: requires `campaign_id` and `amount_cents` (donor_id from auth context)
- [ ] Duplicate contribution detection: same donor, same campaign, same amount within 60 seconds — flagged for confirmation
- [ ] All contribution events emitted to event store
- [ ] Monetary amounts received from API as strings, never parsed to floating point in frontend
- [ ] Integration tests: successful contribution, failed payment, duplicate detection, amount validation, cap exceeded
- [ ] Component tests: amount selection, summary, confirmation, error states

### User Story

As a backer, I want to contribute to a Mars mission campaign so that I can help fund projects that advance humanity's journey to Mars.

### Key Decisions / Open Questions

- Immediate capture model (no pre-auth hold) per payments spec
- No stored payment methods — donors re-enter card details each time per payments spec
- Stripe Elements handles all card data; our backend never sees raw card numbers

### Out of Scope

- Predefined contribution tiers (optional future enhancement)
- Social sharing after contribution
- Donor-initiated refunds (feat-011 covers refund triggers)
- Tax receipt generation (feat-012)
- Repeat contribution / recurring payments
