## feat-013: Milestone Verification and Fund Disbursement

**Bounded Context(s):** Campaign, Payments
**Priority:** P2
**Dependencies:** feat-011, feat-007
**Estimated Complexity:** M

### Summary

Enables the settlement phase of the campaign lifecycle: creators submit evidence for completed milestones, admins verify or return the evidence, and verified milestones trigger fund disbursement from the escrow ledger to the creator. Also handles the campaign failure path (deadline enforcement) which triggers refunds. Completes the Campaign lifecycle state machine through to `complete` or `failed`.

### Acceptance Criteria

- [ ] A background job (or scheduled check) transitions `live` and `funded` campaigns past their deadline: campaigns not meeting the funding goal transition to `failed`; campaigns that met the goal transition to `funded` if not already (redundant but safe); `funded` campaigns at deadline transition to `settlement`
- [ ] `POST /api/v1/campaigns/:id/milestones/:milestoneId/submit-evidence` allows the campaign creator to submit evidence for a milestone; accepts `{ evidenceUrl: string, description: string }`; campaign must be in `settlement` state; milestone must be `pending` or `returned`; transitions milestone to `submitted`; notifies admin; returns `201`
- [ ] `POST /api/v1/admin/campaigns/:id/milestones/:milestoneId/verify` allows an Administrator to verify a submitted milestone; transitions milestone to `verified`; triggers a disbursement: appends a `disbursement` entry to `escrow_ledger` for the milestone's funding percentage of total escrow; updates milestone status; returns `200`
- [ ] `POST /api/v1/admin/campaigns/:id/milestones/:milestoneId/return` allows an Administrator to return evidence with `{ feedback: string }`; transitions milestone to `returned`; notifies the creator with the feedback; returns `200`
- [ ] When all milestones are verified, the campaign automatically transitions to `complete`; a notification is sent to the creator and all donors who contributed
- [ ] When a campaign transitions to `failed`, all `captured` contributions are refunded via the payment gateway adapter; each contribution transitions to `refunded`; `refund` entries are appended to the escrow ledger; donors are notified
- [ ] Disbursement amounts are calculated as: `(milestone.funding_percentage / 100) * total_escrow_balance_at_settlement_start`; the calculation uses integer arithmetic (cents) to avoid floating point
- [ ] `GET /api/v1/admin/campaigns/:id/milestones` returns all milestones with their current status and any submitted evidence; requires Administrator or Reviewer role
- [ ] The admin milestone management UI at `/admin/campaigns/:id/milestones` lists milestones with evidence submission detail and verify/return action buttons
- [ ] The creator's campaign dashboard (feat-006) shows each milestone's current status with a "Submit Evidence" button for milestones in `pending` or `returned` state when the campaign is in `settlement`
- [ ] Integration test: verifying the final milestone for a campaign with all other milestones already verified transitions the campaign to `complete`
- [ ] Integration test: disbursement calculation for a 30% milestone on a campaign with total escrow of 150,000 cents produces a `disbursement` ledger entry of 45,000 cents
- [ ] Integration test: `POST /api/v1/campaigns/:id/milestones/:milestoneId/submit-evidence` for a campaign in `live` state returns `409`

### User Story

As a project creator, I want to submit evidence of completed milestones so that I can receive the corresponding portion of my campaign's funds.

### Key Decisions / Open Questions

- Deadline enforcement is implemented as a polling job that runs every minute (or on relevant endpoints — checking deadline on GET requests for live/funded campaigns and transitioning automatically if past deadline); a simple `setInterval` in the backend for the demo
- Donor refund notifications for campaign failure are stored as `notifications` records (same table as feat-007)
- The multi-approval disbursement workflow from L4-004 Section 7.2 is theatre — the demo uses single admin approval

### Out of Scope

- Multi-approval dual-authorisation disbursement (theatre per L4-004 local demo scope)
- Donor-initiated refund requests (explicitly excluded from MVP scope to keep complexity manageable)
- Interest accrual and interest disbursement (theatre)
- KYC re-check before disbursement (theatre — stub KYC always returns verified)
