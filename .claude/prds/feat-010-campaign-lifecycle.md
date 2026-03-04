## feat-010: Campaign Lifecycle (Funding, Deadline, Failure)

**Bounded Context(s):** Campaign, Payments
**Priority:** P1
**Dependencies:** feat-008, feat-009
**Estimated Complexity:** M

### Summary

Implement the campaign lifecycle transitions beyond launch: tracking funding targets, deadline enforcement (automatic transition to Funded or Failed), campaign cancellation with refund triggers, and the Suspended state for compliance issues. This completes the campaign state machine for the happy and unhappy paths.

### Acceptance Criteria

- [ ] When a live campaign reaches its minimum funding target, it transitions to `funded` state automatically
- [ ] Funded campaigns remain open for contributions until deadline or maximum funding cap
- [ ] When max funding cap is reached, new contributions are rejected with a clear message
- [ ] System job checks campaign deadlines periodically (or on each request)
- [ ] At deadline: if minimum target met -> `funded` state (if not already); if not met -> `failed` state
- [ ] On campaign failure: `CampaignFailed` event emitted, triggers refund of all contributions via payments domain
- [ ] Failed campaigns remain visible on platform marked as failed (for transparency)
- [ ] Contributors notified when campaign transitions to funded or failed
- [ ] Creator can request cancellation of a live campaign; if contributions exist, Admin approval required
- [ ] On cancellation: `CampaignCancelled` event emitted, all contributions refunded via payments domain
- [ ] Refund processing: payments domain processes bulk refunds, each contribution marked `refunded`, escrow ledger debited
- [ ] Cancelled and Complete states are terminal — no transitions out
- [ ] Campaign suspension (admin action): transitions to `suspended`, no new contributions accepted
- [ ] Suspended campaigns can be restored to previous state (Live or Funded) by admin
- [ ] All state transitions emit audit events with: campaign_id, previous_state, new_state, actor, timestamp, rationale
- [ ] `POST /v1/campaigns/:id/cancel` — Creator (owner) or Admin role required
- [ ] `POST /v1/campaigns/:id/suspend` — Admin role required
- [ ] `POST /v1/campaigns/:id/resume` — Admin role required
- [ ] Integration tests for: deadline reached (funded), deadline reached (failed), cancellation, suspension/resume

### User Story

As a platform operator, I want campaign deadlines and funding targets automatically enforced so that backers are protected and the platform maintains financial integrity.

### Key Decisions / Open Questions

- Deadline enforcement via periodic check (could be a scheduled job or checked on request) — exact mechanism TBD at implementation
- Bulk refund on failure is async — contributions refunded individually, each emitting its own event

### Out of Scope

- Deadline extension requests (Phase 2 per local demo scope)
- Milestone change requests (Phase 2)
- Stretch goal activation mechanics
- Donor-initiated refund policy (separate from campaign failure/cancellation refunds)
