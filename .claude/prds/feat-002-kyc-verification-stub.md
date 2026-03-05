## feat-002: KYC Verification Stub

**Bounded Context(s):** KYC (L4-005)
**Priority:** P0
**Dependencies:** feat-001
**Estimated Complexity:** S

### Summary

This feature implements the KYC verification status lifecycle and its gating effects on the Creator role, using a stubbed provider that auto-approves all submissions.
The local demo does not perform real document verification, but the status machine, API contracts, and gating logic are fully real — other features (campaign submission, disbursement) depend on the KYC status being enforced.

### Acceptance Criteria

- [ ] An authenticated user can initiate KYC verification; the system transitions their status from `Not Verified` to `Pending` and records the submission timestamp.
- [ ] The stub adapter automatically approves the submission: status transitions from `Pending` to `Verified` without manual review or sanctions screening.
- [ ] Every KYC status transition emits an audit event containing: previous status, new status, trigger reason, and actor identity (no document content).
- [ ] The KYC status query endpoint (`GET /kyc/status`) returns the authenticated user's current verification status.
- [ ] A user with `Verified` KYC status has the Creator role eligibility unlocked (the Account domain reads this status to gate campaign submission — see feat-003).
- [ ] A user with non-`Verified` KYC status who attempts to submit a campaign receives HTTP 403 with error code `KYC_NOT_VERIFIED`.
- [ ] The KYC status is visible in the user's profile response from feat-001 (`GET /me`).
- [ ] The Veriff adapter interface is defined and the stub implementation satisfies it; swapping to the real Veriff SDK requires only replacing the adapter.

### User Story

As a project creator, I want to complete identity verification so that I can submit campaigns to the platform and eventually receive fund disbursements.

### Key Decisions / Open Questions

- The stub adapter auto-approves all submissions synchronously; production would use an async webhook from Veriff.
- The KYC adapter interface must be defined in the ports layer (no Veriff SDK imports in domain or application code).
- Document upload endpoints are out of scope for the stub — the stub only accepts a "submit" action that triggers auto-approval.
- Sanctions screening is theatre; the stub skips it entirely and moves directly from `Pending` to `Verified`.

### Out of Scope

- Real document upload, storage, and encryption (theatre).
- Automated verification via real Veriff SDK (theatre).
- Sanctions screening (theatre).
- Manual review queue and admin review UI (theatre).
- Re-verification triggers (document expiry, 2-year cycle) (theatre).
- Resubmission failure tracking and Locked state (theatre).




























