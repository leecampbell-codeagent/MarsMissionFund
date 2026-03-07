## feat-012: Milestone Verification and Fund Settlement

**Bounded Context(s):** Campaign, Payments
**Priority:** P2
**Dependencies:** feat-008, feat-010
**Estimated Complexity:** L

### Summary

Implement the milestone evidence submission and admin verification workflow, staged fund disbursement, and campaign settlement. Covers the `Funded → Settlement → Complete` path per L4-002. The multi-approval disbursement pattern is real (two different admins must approve); the actual bank payout is mocked (mock gateway adapter). This is a core demo feature per L4-002 local demo scope.

### Acceptance Criteria

- [ ] Migration: `disbursement_approvals` table: `id` (UUID PK), `campaign_id` (UUID FK), `milestone_id` (UUID FK → campaign_milestones), `approver_id` (UUID FK → users), `approved_at` (TIMESTAMPTZ), `created_at`. Unique constraint on `(milestone_id, approver_id)` to prevent self-double-approval.
- [ ] Migration: `milestone_evidence` table: `id` (UUID PK), `campaign_id` (UUID FK), `milestone_id` (UUID FK), `submitted_by` (UUID FK → users), `description` (TEXT), `evidence_urls` (TEXT[]), `status` (VARCHAR default `submitted`), `reviewer_notes` (TEXT nullable), `created_at`, `updated_at`. Index on `milestone_id`.
- [ ] `POST /v1/campaigns/:id/settle` transitions `funded → settlement`. Admin or system only. Triggered after deadline passes while in funded state.
- [ ] `POST /v1/campaigns/:campaignId/milestones/:milestoneId/evidence` creates evidence submission. Creator only (must own campaign). Campaign must be in `settlement` state.
- [ ] `GET /v1/admin/campaigns/:campaignId/milestones/:milestoneId/evidence` returns evidence for admin review.
- [ ] `POST /v1/admin/campaigns/:campaignId/milestones/:milestoneId/verify` marks milestone as `verified`. Two different admins must approve (first call records first approval; second call by a different admin completes verification and triggers disbursement). Returns the current approval count and whether disbursement was triggered.
- [ ] `POST /v1/admin/campaigns/:campaignId/milestones/:milestoneId/return-evidence` returns evidence to creator with `reviewer_notes`. Milestone returns to `pending` state.
- [ ] On milestone verification completion (2nd approval): Calculates disbursement amount as `milestone.funding_percentage / 100 * escrow_ledger.total_contributed_cents`. Calls `PaymentGatewayPort.payout(amount, creatorId)` (mocked — always succeeds). Appends `escrow_entries` row (`entry_type: disbursement`). Updates `escrow_ledger.total_disbursed_cents`. Writes audit log entry.
- [ ] After final milestone is verified and all funds disbursed, campaign transitions to `complete`.
- [ ] All disbursement and verification actions are audit-logged in `campaign_audit_log`.
- [ ] KYC status check before disbursement: if `creator.kyc_status !== 'verified'`, disbursement is blocked and returns 403 with code `KYC_REQUIRED_FOR_DISBURSEMENT`.
- [ ] Unit tests ≥ 90% on milestone state machine, dual-approval logic, disbursement calculation.
- [ ] Integration tests cover: single approval (pending_approval), dual approval triggers disbursement, same admin cannot double-approve, KYC blocks disbursement, final milestone completes campaign, evidence return flow.
- [ ] Frontend: Admin milestone management view at `/admin/campaigns/:id/milestones` — lists milestones with evidence submissions and "Verify" / "Return" action buttons.
- [ ] Frontend: Dual-approval state clearly displayed: "1 of 2 approvals received — awaiting second approval from a different admin."
- [ ] Frontend: Creator milestone evidence submission form at `/campaigns/:id/milestones/:milestoneId/submit-evidence`.
- [ ] Frontend: Campaign status badge updates to `complete` when all milestones are disbursed; a `--gradient-celebration` celebration banner is shown per L2-001.

### User Story

As a campaign Creator, I want to submit milestone evidence and receive staged fund disbursement so that I can access funding as I deliver on my mission commitments.

### Key Decisions / Open Questions

- `payout()` on the mock gateway adapter logs a success message but does not call any external service.
- The approval window timeout (per L4-004 Section 7.2) is not enforced in the local demo — approvals do not expire.
- Partial refunds on cancellation mid-settlement are deferred to P3.

### Out of Scope

- Actual bank payout via Stripe Connect (P3 — feat-016).
- Approval expiry window enforcement (theatre per L4-004 local demo scope).
- Interest calculation and disbursement (theatre per L4-004 local demo scope).
- Campaign failure / deadline enforcement automation (P2 — feat-013 scheduler).
