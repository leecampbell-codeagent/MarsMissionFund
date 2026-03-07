## feat-008: Campaign Review Pipeline

**Bounded Context(s):** Campaign, Account
**Priority:** P1
**Dependencies:** feat-002, feat-005, feat-006
**Estimated Complexity:** M

### Summary

Implement the reviewer-facing workflow: a queue of submitted campaigns, the ability for Reviewers to claim, approve, or reject proposals, and the state transitions `Submitted → Under Review → Approved/Rejected`. This is a core demo feature per L4-002 local demo scope. Includes admin-facing review UI and campaign owner notifications (in-app only at this stage).

### Acceptance Criteria

- [ ] `GET /v1/admin/campaigns/review-queue` returns campaigns in `submitted` state, ordered by `created_at` ASC (FIFO). Requires `reviewer` or `administrator` role; returns 403 otherwise.
- [ ] `POST /v1/admin/campaigns/:id/claim` transitions a campaign from `submitted` to `under_review`, assigns the authenticated reviewer as the reviewing user. Returns 409 if already under review by another reviewer.
- [ ] `POST /v1/admin/campaigns/:id/approve` transitions `under_review → approved`. Requires `{ notes: string }` (non-empty). Audit-logs the action with actor, notes, timestamp.
- [ ] `POST /v1/admin/campaigns/:id/reject` transitions `under_review → rejected`. Requires `{ rationale: string, guidance: string }` (both non-empty). Audit-logs the action.
- [ ] `POST /v1/admin/campaigns/:id/recuse` returns a claimed campaign from `under_review` back to `submitted`. Clears the assigned reviewer.
- [ ] `GET /v1/admin/campaigns/:id` returns full campaign detail including team members, milestones, risk disclosures, and audit log — for the reviewer's assessment view.
- [ ] All state transitions write to `campaign_audit_log` with: `campaign_id`, `actor_id`, `action`, `previous_state`, `new_state`, `rationale` (where applicable).
- [ ] `PATCH /v1/campaigns/:id/rejected → draft`: Creator can reset a `rejected` campaign to `draft` for revision. Validates that the caller is the campaign owner.
- [ ] All endpoints enforce role-based access; `user_id` always from auth context.
- [ ] Unit tests ≥ 90% on review application service and state machine transitions.
- [ ] Integration tests cover: claim from queue, approve with notes, reject with rationale, recuse, creator reverts rejected to draft, 403 for non-reviewer, 409 for double-claim.
- [ ] Frontend: Admin review queue page at `/admin/review-queue` lists campaigns with title, creator, category, submission date, and a "Review" CTA.
- [ ] Frontend: Campaign review detail page at `/admin/campaigns/:id/review` shows all campaign fields including milestones, team, and risks; has "Approve" and "Reject" buttons with modal forms for notes/rationale.
- [ ] Frontend: "Reject" modal requires both rationale and guidance fields (non-empty validation).
- [ ] Frontend: After approve/reject, the reviewer is redirected back to the review queue.
- [ ] Frontend: Creator's campaign list (`/campaigns/my`) shows `under_review`, `approved`, and `rejected` statuses with rejection rationale visible for rejected campaigns.

### User Story

As a Reviewer, I want to claim and assess submitted campaign proposals so that only credible, Mars-aligned projects go live on the platform.

### Key Decisions / Open Questions

- The review queue is pull-based (FIFO); no auto-assignment.
- Clarification requests (Section 5.3 of L4-002) are theatre for this feature — just approve/reject/recuse are implemented.
- Admin user provisioning: Super Administrator seeding is done via direct DB insert or an env-var-driven bootstrap script.

### Out of Scope

- Appeal process (theatre per L4-002 local demo scope).
- Review SLA alerting (theatre — 5 business day SLA emails).
- Automatic assignment at the 5-day mark (theatre).
- Email notifications to creator on review outcome (feat-013).
