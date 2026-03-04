## feat-011: Milestone Verification & Settlement

**Bounded Context(s):** Campaign, Payments
**Priority:** P1
**Dependencies:** feat-010
**Estimated Complexity:** L

### Summary

Implement the settlement workflow: funded campaigns transition to Settlement state, creators submit milestone evidence, administrators verify milestones, and verified milestones trigger staged fund disbursement from escrow to the creator. Completing all milestones transitions the campaign to Complete.

### Acceptance Criteria

- [ ] Funded campaign transitions to `settlement` state when deadline is reached (or triggered by admin)
- [ ] Creator can submit evidence for a milestone: documents, images, links, reports (text + file upload)
- [ ] Evidence submissions are timestamped and immutable once submitted
- [ ] Admin notified when milestone evidence is submitted
- [ ] Admin can **verify** a milestone — marks it as verified, triggers disbursement for that milestone's funding percentage
- [ ] Admin can **return** a milestone — creator notified with specific feedback, can resubmit evidence
- [ ] Disbursement processing: `MilestoneVerified` event triggers payout for milestone's percentage of total collected funds
- [ ] Disbursement requires dual admin approval (two different administrators must independently approve)
- [ ] Disbursement states: `pending_approval` -> `partially_approved` -> `approved` -> `processing` -> `completed` / `failed`
- [ ] If second approval not received within configured window, first approval expires
- [ ] Disbursement blocked if creator's KYC status is not current (verified)
- [ ] Escrow ledger debited for each disbursement
- [ ] After final milestone verification and disbursement, campaign transitions to `complete` state
- [ ] Creator notified on campaign completion
- [ ] `POST /v1/campaigns/:id/milestones/:milestoneId/evidence` — Creator (campaign owner) submits evidence
- [ ] `POST /v1/campaigns/:id/milestones/:milestoneId/verify` — Admin role required
- [ ] `POST /v1/campaigns/:id/milestones/:milestoneId/return` — Admin role required, requires feedback text
- [ ] `POST /v1/disbursements/:id/approve` — Admin role required
- [ ] All milestone and disbursement actions emit audit events
- [ ] Integration tests: evidence submission, verification, disbursement approval flow, completion
- [ ] Unit tests for disbursement state machine

### User Story

As a platform administrator, I want to verify campaign milestones and release funds to creators so that backers' money goes to projects that deliver on their promises.

### Key Decisions / Open Questions

- Dual admin approval is critical for financial integrity — no self-approval allowed
- Mock payment adapter handles disbursement simulation for local demo
- Evidence is stored as references (file uploads to S3 / local filesystem mock)

### Out of Scope

- Interest calculation on escrowed funds (Phase 2)
- Partial campaign failure (some milestones complete, remaining cancelled)
- Donor-initiated refund based on disbursement state
- Financial reporting of disbursements (feat-015)
