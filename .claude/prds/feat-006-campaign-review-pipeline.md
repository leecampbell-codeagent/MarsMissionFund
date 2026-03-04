## feat-006: Campaign Review Pipeline

**Bounded Context(s):** Campaign, Account
**Priority:** P1
**Dependencies:** feat-005
**Estimated Complexity:** M

### Summary

Implement the review pipeline for submitted campaigns: FIFO review queue, reviewer claim flow, approve/reject/request-clarification actions, and state transitions through Under Review, Approved, and Rejected. Reviewers are users with the Reviewer role (assigned by admins via feat-015 or seeded in dev).

### Acceptance Criteria

- [ ] Review queue page visible only to users with Reviewer role
- [ ] Queue displays submitted campaigns in FIFO order (oldest first) with: title, creator name, submission date, category
- [ ] Reviewer can claim a campaign from the queue — transitions to `under_review` state, creator notified
- [ ] Reviewer can recuse themselves — campaign returns to queue
- [ ] Review interface shows all campaign submission fields for evaluation against curation criteria
- [ ] Reviewer can **approve** with written approval notes — transitions to `approved`, creator notified with notes
- [ ] Reviewer can **reject** with written rationale and resubmission guidance — transitions to `rejected`, creator notified
- [ ] Reviewer can **request clarification** — sends message to creator without changing state (campaign stays `under_review`)
- [ ] Rejected campaigns can return to `draft` state when creator chooses to revise (previous data preserved)
- [ ] `GET /v1/campaigns/review-queue` returns submitted campaigns (Reviewer role required)
- [ ] `POST /v1/campaigns/:id/claim` assigns reviewer (Reviewer role required)
- [ ] `POST /v1/campaigns/:id/approve` with approval notes (Reviewer role required)
- [ ] `POST /v1/campaigns/:id/reject` with rationale and guidance (Reviewer role required)
- [ ] All review actions emit events to event store with: campaign ID, reviewer identity, action, rationale, timestamp
- [ ] Role-based access control: only Reviewers access the review queue; only the assigned reviewer can approve/reject
- [ ] Integration tests for happy path (submit -> claim -> approve) and error paths (unauthorized, invalid state transitions)

### User Story

As a reviewer, I want to evaluate submitted campaign proposals so that only quality Mars-mission projects go live on the platform.

### Key Decisions / Open Questions

- Pull-based queue (FIFO) — reviewers pull work, no automatic assignment
- Review SLA alerts (3-day, 5-day escalation) are out of scope for MVP — the queue ordering is sufficient
- Clarification messages are simple text; no threaded conversation for MVP

### Out of Scope

- Appeal process (Phase 2)
- Admin reassignment of reviewers (feat-015)
- Review SLA monitoring and alerts
- Campaign launch (transitioning from Approved to Live — that is feat-007)
