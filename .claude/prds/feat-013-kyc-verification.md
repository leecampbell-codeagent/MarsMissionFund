## feat-013: KYC Verification (Mock Provider)

**Bounded Context(s):** KYC, Account
**Priority:** P1
**Dependencies:** feat-004
**Estimated Complexity:** M

### Summary

Implement the KYC verification workflow with a mock Veriff adapter that auto-approves submissions for the local demo. Establishes the KYC status lifecycle, document upload flow, status gating for Creator features, and the adapter abstraction that can be swapped for real Veriff integration later.

### Acceptance Criteria

- [ ] KYC verification page accessible to authenticated users
- [ ] Document upload form: document type selection (Passport, National ID, Driver's Licence), front image upload, back image upload (if required), file validation (JPEG/PNG/PDF, max 20MB, magic byte check)
- [ ] KYC provider adapter interface (port) defined with methods: `submitVerification`, `getVerificationStatus`
- [ ] Mock KYC adapter implements the interface — auto-approves after configurable delay (simulates async verification), configurable via `MOCK_KYC=true` environment variable
- [ ] Real Veriff adapter implements the same interface (behind feature flag, not default)
- [ ] KYC status lifecycle: `not_verified` -> `pending` -> `verified` / `in_manual_review` / `pending_resubmission` -> `rejected` / `verified`
- [ ] On successful verification: KYC status set to `verified`, account notified, Creator role features unlocked
- [ ] On verification failure: status set to `pending_resubmission`, user notified with reason to resubmit
- [ ] Failure count tracked — after 5 failures, status transitions to `locked` (admin unlock required)
- [ ] KYC status check enforced when: submitting a campaign (Creator must be verified), processing disbursement (creator KYC must be current)
- [ ] `POST /v1/kyc/submit` initiates verification with document upload
- [ ] `GET /v1/kyc/status` returns current KYC status for authenticated user
- [ ] `POST /v1/kyc/admin/unlock/:accountId` — Admin role required, unlocks a locked KYC account
- [ ] All KYC status transitions emit events to event store
- [ ] Uploaded documents stored in isolated storage (S3 adapter with local filesystem mock)
- [ ] Document content and PII never logged — only resource identifiers
- [ ] Environment variables in `.env.example`: `MOCK_KYC`
- [ ] Unit tests for KYC status state machine
- [ ] Integration tests: submit verification, status check, mock auto-approval flow, failure escalation

### User Story

As a project creator, I want to complete identity verification so that I can submit campaigns and receive disbursements.

### Key Decisions / Open Questions

- Mock adapter auto-approves by default for workshop convenience
- Video liveness check is theatre for local demo — mock adapter skips it
- Sanctions screening is theatre for local demo — mock adapter returns "clear"
- Document storage uses local filesystem in dev, S3 in production

### Out of Scope

- Real Veriff integration (adapter exists but uses mock by default)
- Video liveness capture
- Sanctions screening (OFAC, EU, UN, DFAT)
- Manual review queue for KYC (admin views KYC status but no manual review workflow for MVP)
- Re-verification triggers (document expiry, time-based)
- KYC document retention and deletion policies
