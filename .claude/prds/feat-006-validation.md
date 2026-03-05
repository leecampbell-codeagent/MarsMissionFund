# feat-006 Spec Validation

**Date**: 2026-03-05
**Validator**: Spec Track Agent
**Spec Under Review**: feat-006-spec.md

---

## Validation Checklist

### 1. Completeness

| Check | Status | Notes |
|-------|--------|-------|
| Campaign status extension documented | PASS | Section 2 — all 5 transitions documented |
| New domain errors defined | PASS | `CampaignNotReviewableError`, `ReviewerCommentRequiredError` |
| Role-based access documented | PASS | `reviewer` and `administrator` both can review; checked at app service |
| Audit events for all review decisions | PASS | Section 8 — 5 event types with payload schema |
| API endpoints complete | PASS | 6 endpoints documented with status codes |
| Interface contract with feat-005 | PASS | `CampaignResult` DTO extension in Section 5.3 |
| Acceptance criteria | PASS | 10 ACs in Given/When/Then format |
| Edge cases documented | PASS | Table of 7 edge cases in Section 11 |

### 2. Consistency with Governing Specs

| Spec | Check | Status | Notes |
|------|-------|--------|-------|
| L4-002 (Campaign) | State machine transitions match Section 3.2 | PASS | All transitions from L4-002 covered |
| L4-002 (Campaign) | Reviewer can recuse — returns to queue | PASS | `recuse()` method documented |
| L4-002 (Campaign) | Rejected → Draft by creator preserved | PASS | `returnToDraft()` endpoint documented |
| L3-002 (Security) | RBAC enforced at API layer AND domain service | PASS | Role check in app service; secondary in API layer |
| L3-002 (Security) | Only assigned reviewer can approve/reject | PASS | Domain checks `this.reviewerId !== reviewerId` |
| L3-006 (Audit) | All review decisions emitted to event store | PASS | approve, reject, claim, recuse, return-to-draft all emit events |
| L3-006 (Audit) | Sensitive data not in audit payload | PASS | Comment truncated to 500 chars; no PII |
| PRD feat-006 | FIFO queue ordering | PASS | `findSubmitted()` orders by `created_at` ASC |
| PRD feat-006 | Reviewer claims from queue (pull-based) | PASS | `/claim` endpoint documented |
| Backend rules | Zero infrastructure imports in domain | PASS | Domain methods return new Campaign instances |
| Backend rules | Role checks at application service level | PASS | `assertReviewerRole()` helper in service |
| Backend rules | Parameterised SQL only | PASS | No SQL in spec; infra requirement carried forward |

### 3. Issues Found

#### ISSUE-001: `reconstitute()` signature compatibility

The spec states `reconstitute()` must accept new fields with `null` defaults. The current implementation has a fixed `CampaignProps` type. The spec must be clear that the existing `CampaignProps` interface itself gets extended (not a separate overload). This is implementation detail — spec intent is correct, implementation must extend `CampaignProps`.

**Resolution**: Clarified in implementation — `CampaignProps` interface will be extended with the 3 new fields as `readonly fieldName: Type | null` with `null` defaults in `reconstitute()` when not provided.

**Severity**: Low — no spec change required; implementation guidance clear.

#### ISSUE-002: `return-to-draft` endpoint role requirement

The spec says "any authenticated user (creator role implied by ownership check)". The PRD says creators can revise rejected campaigns. This is correct — the ownership check IS the authorization. However, it should be explicit that no reviewer role is required for this endpoint.

**Resolution**: Spec is correct. `returnCampaignToDraft()` app service method checks `campaign.creatorId !== creatorUserId` and throws `CampaignNotFoundError` (treats as not found for data isolation). No role check needed.

**Severity**: Clarification only, no change.

#### ISSUE-003: Migration `BEGIN/COMMIT` requirement

Per infra rules: `-- migrate:up` section must be wrapped in `BEGIN; ... COMMIT;`. The spec migration section shows the pattern but should be confirmed.

**Resolution**: Migration in spec Section 7 shows `BEGIN;`/`COMMIT;` correctly. PASS.

**Severity**: None.

#### ISSUE-004: `findSubmitted()` returns both `submitted` and `under_review`

The spec says the review queue shows both statuses. This is correct per PRD ("Queue displays submitted campaigns...") and the reviewer needs to see campaigns they've already claimed (under_review). Design spec confirms this.

**Resolution**: PASS — both statuses included is correct.

---

## Final Verdict: PASS

All required sections are present and consistent with governing specs. Issues found are low-severity clarifications that do not require spec revision. Implementation may proceed.

### Summary of Key Decisions

1. Both `reviewer` and `administrator` roles can perform all review actions (per L3-002 Section 5.1)
2. Only the assigned reviewer can approve/reject (domain-enforced)
3. Recuse clears reviewer fields and returns campaign to `submitted`
4. `returnToDraft` does not clear reviewer fields in domain (preserved for history) but the DB columns retain values
5. The review queue API returns both `submitted` and `under_review` campaigns
6. All 5 review transitions emit audit events to the event store
7. Approve and reject both require a non-empty written comment (domain-enforced)
