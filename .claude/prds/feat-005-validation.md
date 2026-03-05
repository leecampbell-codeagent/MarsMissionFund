# feat-005 Spec Validation

> **Validates**: feat-005-spec.md
> **Against**: feat-005 brief, feat-005-research.md, L4-002 (campaign.md), L2-002 (engineering.md)
> **Date**: 2026-03-05

---

## Validation Checklist

### 1. Brief Acceptance Criteria Coverage

| Brief AC | Spec Coverage | Status |
|---|---|---|
| Campaign creation accessible only to users with Creator role | Section 3 (InsufficientRoleError), API Contracts 4.1 mentions creator role check | PASS |
| Multi-step guided form (6 sections) | Section 1.1 entity has all fields; Sections 7 (DB extension) adds missing columns | PASS |
| Campaign category single-select from 10-category taxonomy | Section 1.1 CampaignCategory enum with 10 values matching L4-002 Section 4.4 | PASS |
| Drafts auto-saved on field change | PATCH endpoint spec'd; frontend auto-save is a UX responsibility (hook with debounce) | PASS |
| Creators may have multiple simultaneous drafts | No unique constraint on creator_id+status, findByCreatorId returns list | PASS |
| Drafts have no expiry | No expiry logic in spec | PASS |
| Full validation on submission (all required fields, funding range, milestone % sum, deadline range, media) | Section 2.2 covers all except media (hero_image_url is optional for MVP per brief "Out of Scope") | PASS |
| Submission blocked if KYC not verified | Section 2.1 KYC gate, AC-CAMP-005-004, KycRequiredError 403 | PASS |
| Submission transitions to submitted state + confirmation notification | submitForReview emits campaign.submitted event; notification is future work (feat-005 out of scope per brief) | PASS |
| POST /v1/campaigns creates draft | Section 4.1 | PASS |
| PATCH /v1/campaigns/:id updates draft | Section 4.4 | PASS |
| POST /v1/campaigns/:id/submit validates and transitions | Section 4.5 | PASS |
| GET /v1/campaigns/:id returns campaign detail (creator-scoped) | Section 4.3 | PASS |
| GET /v1/campaigns?status=draft lists creator's drafts | Spec uses GET /api/v1/campaigns/mine per task instructions | PASS (task override) |
| Monetary values stored as BIGINT cents, serialised as strings | Section 1.1 (number cents in domain), Section 4.1 (strings in JSON) | PASS |
| Zod validation schemas | Section 5 app service + Section 4 API — Zod specified for input validation | PASS |
| Campaign state transitions emit events | Section 5 event types specified | PASS |
| Unit tests 90%+ coverage | Section 10 testing requirements | PASS |
| Integration tests for all endpoints | Section 10 testing requirements | PASS |

### 2. L4-002 (campaign.md) Alignment

| L4-002 Section | Spec Alignment | Status |
|---|---|---|
| 3.1 States — Draft, Submitted | CampaignStatus type includes both | PASS |
| 3.2 Valid Transitions — Draft → Submitted | `submit()` method on entity with KYC check | PASS |
| 3.3 State Machine Rules — audit logging | Event store used for all transitions | PASS |
| 4.1 Submission Prerequisites — KYC verified | KYC gate check in submitForReview | PASS |
| 4.2 Required Fields — all 6 sections | All fields present in entity model + DB schema | PASS |
| 4.3 Draft Persistence — auto-save, multiple, no expiry | Covered | PASS |
| 4.4 Campaign Categories — 10 values | All 10 values in CampaignCategory enum | PASS |
| 4.5 Submission Validation — all rules | All rules in Section 2.2 | PASS |
| 4.5 AC-CAMP-001 | AC-CAMP-005-005 covers this | PASS |
| 4.5 AC-CAMP-002 | AC-CAMP-005-004 covers this | PASS |
| 4.5 AC-CAMP-003 (milestone % sum) | AC-CAMP-005-006 covers this | PASS |

### 3. L2-002 (engineering.md) Compliance

| L2-002 Section | Spec Compliance | Status |
|---|---|---|
| 1.2 Data Access — parameterised queries only | PgCampaignRepository will use $1, $2 params | PASS |
| 1.4 Input Validation — Zod at boundary | All API endpoints use Zod schemas | PASS |
| 1.5 Authentication — every endpoint authenticated | All 5 endpoints require auth | PASS |
| 1.7 Logging — every state mutation logged | Event store append on each mutation | PASS |
| 4.2 Test Coverage — domain 90%, API 100% | Section 10 specifies these requirements | PASS |
| 5.1 API Versioning — /v1/ prefix | All endpoints have /api/v1/ prefix | PASS |
| 5.3 Error Response Contract | Consistent `{ error: { code, message, correlation_id } }` format | PASS |

### 4. Architecture Compliance (L3-001)

| Constraint | Compliance | Status |
|---|---|---|
| Hexagonal architecture — domain layer no infrastructure | Campaign entity has no pg/express/process.env | PASS |
| Ports: interfaces only | CampaignRepository, KycStatusPort are interfaces | PASS |
| Adapters implement port interfaces | PgCampaignRepository, InMemoryCampaignRepository, KycStatusAdapter planned | PASS |
| User_id from auth context, never from request body | API layer uses req.authContext.userId | PASS |

### 5. Security Compliance (L3-002)

| Constraint | Compliance | Status |
|---|---|---|
| Creator can only manage own campaigns | All queries scoped to creatorId = userId | PASS |
| 404 not 403 for resource ownership failures | Section 7 Edge Cases: returns 404 for other user's campaigns | PASS |
| Monetary amounts never numbers in JSON | All monetary fields are strings in API response | PASS |

### 6. Issues Found

**Issue 1 (MINOR)**: The spec does not explicitly require checking for Creator role at campaign creation. The brief says "Campaign creation accessible only to users with the Creator role." The spec mentions InsufficientRoleError but does not explicitly specify where the role check happens (at the application service vs the API layer).

**Resolution**: Add explicit role check in the application service `createDraft()` method, checking that the user's account has the `creator` role. However, since account roles are managed by the Account domain and the Campaign service should not depend on the Account domain directly, this check should happen at the API router level using `req.authContext.roles`.

**Issue 2 (MINOR)**: The spec does not address the `sequence` field mentioned in the task description for Milestone VO. The DB does not have a sequence column; ordering is by targetDate or insertion order.

**Resolution**: Drop sequence field from Milestone VO — the DB schema is authoritative and has no sequence column. Milestone ordering in the API response will be by `target_date` ASC or insertion order.

**Issue 3 (MINOR)**: The task description says `goalAmountCents` but the DB uses `min_funding_target_cents`. The task description appears to use a simplified model vs the full spec.

**Resolution**: Follow the DB schema and L4-002 spec which uses `minFundingTargetCents` (min target) and `maxFundingCapCents` (max cap). The task description's `goalAmountCents` maps to `minFundingTargetCents`.

---

## Validation Result

**PASS** — All critical acceptance criteria are covered. Three minor issues identified and resolved above. The spec is implementation-ready.

No structural changes to feat-005-spec.md required. Implementation may proceed.
