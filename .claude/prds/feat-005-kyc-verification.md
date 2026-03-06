## feat-005: KYC Identity Verification (Stub Adapter)

**Bounded Context(s):** KYC, Account
**Priority:** P1
**Dependencies:** feat-003, feat-002
**Estimated Complexity:** M

### Summary

Implements the KYC verification status lifecycle and its gating effects on Creator role features, using a stubbed KYC adapter that auto-approves submissions. Users with the Creator role intent must complete KYC before they can submit campaigns. The verification status lifecycle (Not Verified → Pending → Verified) is real; the document verification itself is mocked. This matches the local demo scope defined in L4-005.

### Acceptance Criteria

- [ ] `GET /api/v1/kyc/status` returns the authenticated user's current KYC status (`{ status: string, verifiedAt: string | null }`)
- [ ] `POST /api/v1/kyc/submit` accepts a document type field (`{ documentType: "passport" | "national_id" | "drivers_licence" }`), transitions the user's KYC status from `not_verified` or `pending_resubmission` to `pending`, and returns `202`
- [ ] The stub KYC adapter automatically transitions status from `pending` to `verified` within the same request cycle (simulating instant auto-approval per local demo scope)
- [ ] `kyc_verifications` table row is created on first KYC submission if it does not exist; updated on subsequent submissions
- [ ] A user whose KYC status is `verified` has the `creator` role accessible (can submit campaigns)
- [ ] A user whose KYC status is NOT `verified` attempting to access a Creator-gated endpoint receives `403` with `{ error: { code: "KYC_REQUIRED", message: "..." } }`
- [ ] The KYC verification UI page at `/kyc` renders the current status, a document type selector, and a submit button; on submission shows a success state with "Verification approved" copy
- [ ] The profile page (feat-004) shows the correct KYC status label synced from the backend
- [ ] The KYC adapter is behind an interface (`IKycAdapter`) — the stub implementation satisfies this interface, and the interface is the only thing application/domain code references
- [ ] Integration test: `POST /api/v1/kyc/submit` transitions status to `verified` and subsequent `GET /api/v1/kyc/status` returns `{ status: "verified" }`
- [ ] Integration test: a user with `not_verified` KYC status calling a Creator-gated endpoint returns `403`

### User Story

As a project creator, I want to complete identity verification so that I can submit my Mars mission campaign for review.

### Key Decisions / Open Questions

- The `MOCK_KYC=true` environment variable controls whether the stub or a real adapter is used; default to `true` for local demo
- Sanctions screening, manual review queue, document image upload, and video liveness are all theatre for the local demo
- KYC status is checked at the application service layer via the `IKycAdapter` interface — never directly querying the `kyc_verifications` table from a controller

### Out of Scope

- Real Veriff SDK integration
- Document image upload and storage
- Video liveness capture
- Sanctions screening
- Manual review workflow and admin queue
- Re-verification triggers (document expiry, time-based, suspicious activity)
- Resubmission failure count escalation
