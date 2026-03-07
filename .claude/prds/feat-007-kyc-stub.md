## feat-007: KYC Verification Stub

**Bounded Context(s):** KYC, Account
**Priority:** P1
**Dependencies:** feat-001, feat-002, feat-005
**Estimated Complexity:** S

### Summary

Implement the KYC verification status lifecycle and its gating effects on Creator role features. Per L4-005 local demo scope, the actual Veriff provider is stubbed — the local demo auto-approves KYC submissions. The KYC domain entity, status state machine, adapter abstraction, and all gating hooks are real. This unblocks feat-006 (campaign submission requires `kyc_status = verified`).

### Acceptance Criteria

- [ ] `KycVerification` domain entity with `status` following the L4-005 state machine: `not_verified`, `pending`, `verified`, `rejected`, `expired`.
- [ ] A `KycProviderPort` interface exists in `packages/backend/src/kyc/ports/` with methods: `submitVerification(userId, documentData)` and `getVerificationStatus(providerRef)`.
- [ ] A `MockKycProviderAdapter` implements `KycProviderPort`; it immediately transitions status to `verified` on any submission (auto-approve for local demo).
- [ ] `GET /v1/kyc/status` returns the authenticated user's KYC status from `kyc_verifications`.
- [ ] `POST /v1/kyc/submit` accepts `{ document_type: string }` (placeholder payload); creates or updates a `kyc_verifications` record; calls the KYC provider adapter; transitions status to `verified` via the mock adapter; updates `users.kyc_status` to `verified`.
- [ ] KYC status change events are written to `campaign_audit_log` (repurposed as audit log for this scope) with action `kyc_status_changed`.
- [ ] `users.kyc_status` is kept in sync with `kyc_verifications.status` whenever KYC status changes.
- [ ] `POST /v1/campaigns/:id/submit` in feat-006 correctly reads `users.kyc_status` to gate submission.
- [ ] Unit tests ≥ 90% on `KycVerification` entity and KYC application service.
- [ ] Integration tests cover: submit KYC with mock adapter → status becomes `verified`, re-check status after verification, campaign submission unblocked after KYC verified.
- [ ] Frontend: KYC status banner on the account page shows current status with a "Start Verification" CTA when `not_verified`.
- [ ] Frontend: KYC submission form at `/account/kyc` shows a document type selector and a "Submit Verification" button; on success, shows "Verification approved" and updates the UI.
- [ ] Frontend: The campaign creation flow links to `/account/kyc` when KYC is not verified.

### User Story

As a Creator, I want to complete KYC verification so that I can submit campaign proposals on the platform.

### Key Decisions / Open Questions

- The mock adapter auto-approves immediately — no real document upload, no real Veriff calls.
- `MOCK_KYC=true` environment variable switches between mock and (future) real Veriff adapter.
- KYC document storage (S3 upload) is out of scope for the local demo.

### Out of Scope

- Real Veriff integration (P3/integration feature).
- Sanctions screening (theatre per L4-005 local demo scope).
- Manual review workflow (theatre per L4-005 local demo scope).
- Document upload to S3 (theatre for local demo).
- Re-verification triggers and expiry (P2 enhancement).
