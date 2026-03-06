## feat-007: Campaign Review Pipeline

**Bounded Context(s):** Campaign, Account
**Priority:** P1
**Dependencies:** feat-006, feat-003
**Estimated Complexity:** M

### Summary

Implements the reviewer-facing workflow where users with the Reviewer role can claim submitted campaigns from a FIFO queue, evaluate them against curation criteria, and approve or reject them with written rationale. Admins can assign the Reviewer role and reassign campaigns. All review actions are logged. This is the core demo feature for the campaign lifecycle's review phase.

### Acceptance Criteria

- [ ] `GET /api/v1/review/queue` returns all campaigns in `submitted` status ordered by submission time (FIFO); requires Reviewer or Administrator role; returns `403` otherwise
- [ ] `POST /api/v1/review/queue/:campaignId/claim` transitions the campaign from `submitted` to `under_review` and records the claiming reviewer's ID; returns `200`; returns `409` if already claimed; requires Reviewer role
- [ ] `POST /api/v1/review/:campaignId/approve` requires written `notes` field (non-empty); transitions `under_review` campaign to `approved`; notifies the creator (in-app notification record); logs the action with reviewer ID, timestamp, and notes; returns `200`; requires Reviewer role
- [ ] `POST /api/v1/review/:campaignId/reject` requires non-empty `rationale` and `resubmission_guidance` fields; transitions `under_review` campaign to `rejected`; notifies the creator; logs the action; returns `200`; requires Reviewer role
- [ ] `POST /api/v1/review/:campaignId/recuse` returns the campaign to `submitted` state (removes reviewer claim); requires Reviewer role; returns `200`
- [ ] `POST /api/v1/admin/campaigns/:campaignId/assign-reviewer` accepts `{ reviewerId }` and assigns the campaign to the specified reviewer; requires Administrator role; returns `200`
- [ ] `POST /api/v1/admin/users/:userId/roles` accepts `{ role: "reviewer" | "administrator" }` and assigns the role to the specified user; requires Administrator role; returns `200`; returns `400` if role is `super_administrator` (not assignable via API)
- [ ] The review queue UI at `/review` lists all submitted campaigns with submission date, category, and funding goal; each item has a "Claim" button
- [ ] The review detail UI at `/review/:campaignId` renders all campaign submission fields, the curation criteria checklist, and approve/reject forms with required text fields
- [ ] After approving or rejecting, the reviewer is redirected back to the review queue
- [ ] Integration test: `POST /api/v1/review/:campaignId/approve` without a `notes` field returns `400`
- [ ] Integration test: a user without Reviewer role calling `GET /api/v1/review/queue` returns `403`
- [ ] Integration test: approve action on a campaign not in `under_review` state returns `409`

### User Story

As a platform reviewer, I want to evaluate submitted campaign proposals so that only credible, Mars-enabling projects reach backers.

### Key Decisions / Open Questions

- Review actions are logged in a `campaign_review_log` table (add migration): `id`, `campaign_id`, `reviewer_id`, `action` (claim/approve/reject/recuse), `notes`, `created_at`
- In-app notifications are stored in a `notifications` table (add migration): `id`, `user_id`, `type`, `payload` JSONB, `read_at`, `created_at`
- The 5-day SLA alert is theatre for the demo — the queue simply shows submission age
- Campaign appeal process is theatre for the demo

### Out of Scope

- Appeal process
- 5-day SLA automated alerts
- Clarification request action (theatre — reviewers use approve/reject/recuse)
- Email notifications (theatre — only in-app notification records)
