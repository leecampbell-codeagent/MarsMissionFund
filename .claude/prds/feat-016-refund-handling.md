## feat-016: Refund Handling — Campaign Failure and Cancellation

**Bounded Context(s):** Payments, Campaign
**Priority:** P2
**Dependencies:** feat-010, feat-012
**Estimated Complexity:** M

### Summary

Implement refund processing for campaign failure (deadline passed without meeting minimum target) and admin-initiated campaign cancellation. This includes the campaign deadline enforcement scheduler, `Live → Failed` and `Funded → Cancelled` transitions, and the corresponding contribution refunds via the payment adapter. Donor-initiated refunds per L4-004 Section 8.5 are also included.

### Acceptance Criteria

- [ ] `POST /v1/admin/campaigns/:id/fail` manually triggers `live → failed` transition. Admin only. Initiates full refund of all `captured` contributions.
- [ ] `POST /v1/admin/campaigns/:id/cancel` triggers cancellation for `live` or `funded` campaigns. Admin only. Requires `{ rationale: string }`. Initiates full refund of all `captured` contributions.
- [ ] Refund processing calls `PaymentGatewayPort.refund(chargeId, amount)` for each captured contribution. Updates each `contributions.status` to `refunded`. Appends `escrow_entries` rows (`entry_type: refund`). Updates `escrow_ledger` balance.
- [ ] `POST /v1/me/contributions/:id/refund` allows a donor to request a refund per L4-004 Section 8.5 policy: full refund if no milestones disbursed; pro-rata of undisbursed portion if partially disbursed; rejected if fully disbursed.
- [ ] All refund events are written to `campaign_audit_log`.
- [ ] Notifications are sent to affected donors on refund processing (uses notification service from feat-014).
- [ ] A scheduled job script (`scripts/process-deadlines.ts`, runnable via `npm run process-deadlines`) checks campaigns where `deadline < NOW()` and `status = 'live'` and transitions them: `funded → settlement` if `total_contributed_cents >= min_funding_target`, else `live → failed`.
- [ ] Integration tests cover: campaign failure triggers full refund, cancellation with contributions triggers refund, donor refund with no disbursement (full), donor refund with partial disbursement (pro-rata), donor refund rejected when fully disbursed.

### User Story

As a donor, I want my contribution refunded if a campaign fails or is cancelled so that I am never at risk of losing money on a project that doesn't proceed.

### Key Decisions / Open Questions

- The deadline enforcement script is run manually (or by a cron) in the local demo; AWS EventBridge handles this in production.
- Pro-rata refund calculation: `donor_contribution / total_contributed * undisbursed_escrow_balance`.

### Out of Scope

- Partial refunds on suspended campaigns (P3).
- Interest refund on failed campaigns (theatre per L4-004).
