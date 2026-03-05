# Spec Validation Report: feat-005 — Contribution Flow and Payment Processing

> **Validator**: Spec Validator Agent
> **Date**: 2026-03-05
> **Verdict**: CONDITIONAL PASS
> **Documents validated**:
> - `feat-005-spec.md`
> - `feat-005-spec-data.md`
> - `feat-005-spec-api.md`
> - `feat-005-spec-ui.md`
> - `feat-005-design.md`
> - `feat-005-research.md`

---

## Summary

The feat-005 specification is substantially complete and implementable. All automatic FAIL triggers are clear: no floating-point money, no Tier 1 identity tokens in component code, no Phase 2 scope creep, and the critical financial invariants (atomic transaction, BIGINT/string serialisation, payment token never logged) are correctly specified throughout.

Four conditional issues are noted — none are blockers to implementation, but two should be resolved before coding begins (C1 and C4). The other two (C2, C3) are implementation-time decisions already flagged as open questions.

---

## Checklist 1: Automatic FAIL Triggers

### 1.1 Floating-point money — PASS

All monetary amounts are correctly specified as:
- `BIGINT` in database schema (`amount_cents`, `running_balance_cents`, `funding_goal_cents`, `total_raised_cents`)
- `number` (integer) in domain entity (`amountCents: number` with `Number.isInteger()` guard)
- `string` in JSON API responses (`amountCents: contribution.amountCents.toString()`)
- `string` in frontend types (`amountCents: string`)
- `Intl.NumberFormat` for display formatting

The frontend amount conversion (`Math.round(parseFloat(amountDollars) * 100).toString()`) is a UI-layer dollars-to-cents conversion, not storage or API layer. This is correct per frontend rules.

**No floating-point violation found.**

### 1.2 Tier 1 identity tokens in component specs — PASS

`feat-005-design.md` contains zero direct references to Tier 1 identity tokens (`--void`, `--nebula`, `--launchfire`, `--chrome`, `--success`, `--red-planet`, etc.) in component token mappings. All tokens referenced are Tier 2 semantic tokens (`--color-bg-page`, `--gradient-action-primary`, `--color-status-success`, etc.).

The reference to `--void` in `feat-005-spec-ui.md` Section 9 appears only as a parenthetical informational annotation in a documentation table (`--color-bg-page` (`--void` / #060A14)). This is a comment explaining the mapping, not a token used in component code. This is acceptable and matches the pattern in the brand spec itself.

**No Tier 1 token violation found.**

### 1.3 Phase 2 features included — PASS

Confirmed scope is strictly stub-only. The following are correctly excluded from feat-005:
- Real Stripe gateway (stub only — `MOCK_PAYMENT=true`)
- Refunds (deferred to feat-006)
- Disbursement (deferred to feat-006+)
- Tax receipts (deferred)
- Stored payment methods (explicitly excluded per L4-004 Section 4.3)
- Multi-approval (deferred)

The out-of-scope sections in `feat-005-spec.md` and `feat-005-contribution-flow.md` align completely.

**No Phase 2 scope creep found.**

### 1.4 Missing error handling on API endpoints — PASS

All three API endpoints have complete error response tables:

`POST /api/v1/contributions`: 400, 401, 404, 409, 422, 500 — all covered.
`GET /api/v1/contributions/:id`: 401, 404 — all covered.
`GET /api/v1/campaigns/:id/contributions`: implicitly 401 (requireAuth middleware).

Error handler mapping is specified in `feat-005-spec-api.md` Section 5.

**No missing error handling found.**

### 1.5 Edge cases without defined behaviour — PASS (with minor notes)

The spec catalogues edge cases across six categories in `feat-005-spec-ui.md` Section 7:
- 15 input validation cases
- 10 campaign state cases
- 4 funding goal cases
- 3 payment gateway cases
- 6 duplicate detection cases
- 4 authentication cases
- 2 concurrency cases
- 8 frontend cases

**Total: 52 edge cases with defined behaviours.**

Note: The validation brief references "53 edge cases from spec". Count is 52. This is a one-case discrepancy, not a substantive failure — the coverage is comprehensive and all critical paths have defined behaviour.

### 1.6 TBD items — CONDITIONAL PASS

The spec contains an "Open Questions" section (feat-005-spec-ui.md Section 10) with 5 items:
- Q1: `users` table name — **RESOLVED** in spec
- Q2: `UserRepository.findByClerkUserId()` method name — **deferred to implementer**
- Q3: `CampaignNotFoundError` location — **deferred to implementer**
- Q4: `CampaignStatus.Funded === 'funded'` confirmation — **deferred to implementer**
- Q5: `Pool` injection approach — **deferred to implementer, both options valid**

Validator cross-referenced the live codebase:
- **Q2 RESOLVED**: `packages/backend/src/account/ports/user-repository.port.ts` confirms the method is `findByClerkUserId(clerkUserId: string): Promise<User | null>`. Exact match to the spec's assumption.
- **Q3 RESOLVED**: `packages/backend/src/campaign/domain/errors/campaign-errors.ts` confirms `CampaignNotFoundError` exists with `code = 'CAMPAIGN_NOT_FOUND'`. Exact match.
- **Q4 RESOLVED**: `packages/backend/src/campaign/domain/value-objects/campaign-status.ts` confirms `CampaignStatus.Funded = 'funded'`. Exact match.

Q5 (Pool injection) remains a valid implementer decision — both approaches are architecturally sound.

**All open questions are either resolved in spec or resolvable by the implementer via the referenced files. No blocking TBDs remain.**

---

## Checklist 2: Financial Rules

### 2.1 BIGINT in DB — PASS

Migration SQL confirms:
- `contributions.amount_cents BIGINT NOT NULL`
- `escrow_ledger.amount_cents BIGINT NOT NULL`
- `escrow_ledger.running_balance_cents BIGINT NOT NULL`
- `contribution_audit_events.amount_cents BIGINT NOT NULL`
- `campaigns.total_raised_cents BIGINT NOT NULL DEFAULT 0`

No FLOAT, DOUBLE, REAL, or NUMERIC types used for monetary values.

### 2.2 String in JSON responses — PASS

`contribution-serializer.ts` correctly serialises `amountCents` as `contribution.amountCents.toString()`.

The JSON response examples in `feat-005-spec-api.md` show `"amountCents": "500"` (string). Consistent throughout.

### 2.3 `total_raised_cents` and `contributor_count` in migration — PASS

Migration Section 1 explicitly adds both columns via `ALTER TABLE campaigns`:
```sql
ADD COLUMN IF NOT EXISTS total_raised_cents BIGINT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS contributor_count  INTEGER NOT NULL DEFAULT 0;
```

CHECK constraints for non-negative values are included.

### 2.4 Atomic transaction — PASS

The success path (Step 8b) explicitly wraps all three operations in a single `BEGIN/COMMIT` block:
- `UPDATE contributions SET status = 'captured'`
- `INSERT INTO escrow_ledger`
- `UPDATE campaigns SET total_raised_cents += amountCents, contributor_count += 1`
- (conditionally) `UPDATE campaigns SET status = 'funded'`

The `EscrowLedgerRepository.createEntry()` port interface correctly requires a `PoolClient` parameter to participate in the transaction.

### 2.5 Payment token NEVER logged — PASS

Explicitly stated in:
- `feat-005-spec.md` Key Decisions table: "NEVER logged at any layer"
- `feat-005-spec-data.md` Schema Notes: "NEVER log this value at any layer (P-SECURITY)"
- `feat-005-spec-api.md` Application service step 7: "logger.info MUST NOT include paymentToken in the log context"
- `StubPaymentGatewayAdapter` JSDoc: "SECURITY: The paymentToken is NEVER logged at any level"
- `CaptureInput` interface: inline comment "NEVER LOG"

### 2.6 `running_balance_cents` append-only — PASS

`escrow_ledger` table has no `updated_at` column (confirmed in migration: "Append-only — NO updated_at. Never DELETE or UPDATE rows.").

The `EscrowLedgerRepository` port interface has no `update()` or `delete()` method — only `createEntry()` and `getRunningBalance()`.

---

## Checklist 3: Scope Boundaries

All Phase 2 features are correctly outside scope. The `feat-005-spec.md` Out of Scope section and the backlog Phase 2 list are consistent.

---

## Checklist 4: State Machine and HTTP Status Codes

### 4.1 Contribution state machine — PASS

Three states defined: `pending_capture → captured` or `pending_capture → failed`. Domain entity `Contribution` has `capture()` and `fail()` methods returning new immutable instances. DB CHECK constraint enforces valid state values.

### 4.2 HTTP 201 for payment failure — PASS

Correctly specified: `POST /api/v1/contributions` always returns `201`, including for `tok_fail` path. The response body contains `status: "failed"` and `failureReason`. This is the correct pattern to preserve the audit trail.

### 4.3 `tok_fail` sentinel behaviour — PASS

`StubPaymentGatewayAdapter` clearly defines: `tok_fail → failure`, any other non-empty string → success. The 50ms artificial delay for demo realism is noted.

### 4.4 `MOCK_PAYMENT` environment variable — PASS

`MOCK_PAYMENT=true` is specified for `.env.example` in the composition root section of `feat-005-spec-api.md`. The default is `true` (stub always active unless explicitly disabled).

---

## Checklist 5: Duplicate Detection

### 5.1 60-second window — PASS

SQL query correctly uses parameterised interval: `created_at > NOW() - ($4 * INTERVAL '1 second')` with `windowSeconds = 60`.

### 5.2 `failed` contributions excluded — PASS

`existsDuplicate()` SQL uses `WHERE status != 'failed'`. The application service, test cases, and edge case table all confirm failed contributions are not counted.

### 5.3 No DB unique index for duplicate detection — PASS

Correctly implemented as an application-layer check, not a unique index (which would block legitimate retries). The spec notes this design decision explicitly.

---

## Checklist 6: Bounded Context and Architecture

### 6.1 New `payments` context — PASS

Correctly isolated at `packages/backend/src/payments/`. No cross-context domain imports: the application service injects `CampaignRepository` and `UserRepository` as port interfaces (P-023 pattern), not concrete adapters.

### 6.2 Hexagonal architecture — PASS

Domain layer (`payments/domain/`) has zero infrastructure imports. Ports are interface-only. Adapters implement port interfaces. Application service receives all dependencies via constructor injection.

### 6.3 In-memory adapters for testing — PASS

Three in-memory adapters specified for tests: `in-memory-contribution-repository.adapter.ts`, `in-memory-escrow-ledger-repository.adapter.ts`, `in-memory-contribution-audit-repository.adapter.ts`.

---

## Checklist 7: Frontend Integration

### 7.1 Route ordering — PASS

`feat-005-spec-ui.md` Section 4 explicitly states:

> Register `/campaigns/:id/contribute` BEFORE `/campaigns/:id` in the route list.

The existing `routes.tsx` shows `/campaigns/:id` at line 154 with no `/campaigns/:id/contribute` route (not yet added). The spec correctly identifies the insertion point and ordering requirement.

### 7.2 `ProtectedRoute` wrapper — PASS

Contribute page is wrapped in `ProtectedRoute`. Unauthenticated users are redirected to `/sign-in`.

### 7.3 `amountCents` as string in frontend types — PASS

`packages/frontend/src/types/contribution.ts` defines `amountCents: string`. The `CreateContributionInput` sends `amountCents: string`. The API client sends the string directly without parsing to number.

### 7.4 `Intl.NumberFormat` for display — PASS

`formatContributionAmount()` helper uses `Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)`. The division by 100 is display-only, not stored.

### 7.5 Design tokens (Tier 2 only in component specs) — PASS

`feat-005-design.md` Section 3 token reference table uses only Tier 2 semantic tokens throughout all component token mappings. The exception for `--font-data` at 32px in `AmountInput` is documented as an approved exception with rationale.

---

## Checklist 8: Migration Integrity

### 8.1 Migration filename — PASS

`20260305170000_feat005_contributions.sql` — timestamp is one increment after the last migration `20260305160000_campaign_search_vector.sql`. Correct.

### 8.2 `migrate:up` wrapped in BEGIN/COMMIT — PASS

Migration uses `BEGIN;` at top and `COMMIT;` at bottom for the up section.

### 8.3 `migrate:down` provided — PASS

Down migration correctly reverses: drops tables in reverse FK order (`contribution_audit_events`, `escrow_ledger`, `contributions`), then removes the two new columns from `campaigns`.

### 8.4 `IF NOT EXISTS` used — PASS

All `CREATE TABLE` and `CREATE INDEX` statements use `IF NOT EXISTS`.

### 8.5 FK `ON DELETE` specified — PASS

All foreign keys have `ON DELETE RESTRICT`, preventing orphan records.

### 8.6 `updated_at` trigger — PASS

`contributions` table has the `contributions_updated_at_trigger` trigger using the existing `update_updated_at_column()` function (from `20260305120000_add_updated_at_trigger.sql`).

`escrow_ledger` and `contribution_audit_events` correctly omit `updated_at` (append-only tables).

### 8.7 Indexes on FK columns and query columns — PASS

- `idx_contributions_donor_user_id` — FK index
- `idx_contributions_campaign_id` — FK index
- `idx_contributions_duplicate_check` — composite index for duplicate detection query
- `idx_escrow_ledger_campaign_id` — FK index
- `idx_escrow_ledger_contribution_id` — FK index
- All audit event FK indexes present

### 8.8 TIMESTAMPTZ (not TIMESTAMP) — PASS

All timestamp columns use `TIMESTAMPTZ`. No TIMESTAMP without timezone found.

---

## Conditional Issues

### C1 — MINOR: Unresolved donor account status check

**Severity**: Minor
**Location**: `feat-005-spec-api.md` application service `createContribution()` step-by-step logic

The research document (Section 5, Integration Edge Cases) identifies that donors with suspended or inactive accounts (`account_status != 'active'`) should receive `HTTP 403 ACCOUNT_NOT_ACTIVE`. This check is present in the campaign creation flow (in `campaign-app-service.ts`).

However, the `createContribution()` step-by-step logic in `feat-005-spec-api.md` does NOT include a step to check `user.accountStatus === 'active'`. The flow goes directly from "resolve clerkUserId → internal user record" to "validate campaign exists".

**Impact**: An inactive/suspended user could technically submit a contribution. The edge case table in `feat-005-spec-ui.md` under Authentication Edge Cases does not list an `ACCOUNT_NOT_ACTIVE` case.

**Recommendation**: The implementer should add step 1b: check `user.accountStatus === 'active'` — throw `AccountNotActiveError` if not. This is consistent with the existing campaign creation pattern. Alternatively, accept that for demo purposes, account status is not gated on contributions (the spec is consistent with itself — it simply doesn't include this check). The implementer should make this decision explicit and document it.

**Does not block implementation.** If the implementer follows the spec as written, contributions from inactive accounts will succeed — which may be intentionally permissive for the demo.

### C2 — MINOR: `funding_cap_cents` not checked in contribution flow

**Severity**: Minor
**Location**: `feat-005-spec-api.md` application service logic, `feat-005-spec.md` Key Decisions

The research document identifies a `CAMPAIGN_FUNDING_CAP_REACHED` error case. The campaigns table has a `funding_cap_cents` column (from feat-003).

The final spec makes a clear decision: funded campaigns stop accepting contributions (`422 CAMPAIGN_NOT_ACCEPTING_CONTRIBUTIONS`). However, the spec does NOT separately handle the case where a contribution would push `total_raised_cents` PAST `funding_cap_cents` while the campaign is still `live`.

The spec's approach is: once `total_raised_cents >= funding_goal_cents`, the campaign auto-transitions to `funded` in the same transaction and subsequent contributions receive `422`. This design relies on `funding_goal_cents` as the cap, implicitly ignoring `funding_cap_cents` as a separate concept.

**Impact**: If `funding_cap_cents != funding_goal_cents` (a campaign has a minimum goal but a higher cap), the spec does not address contributions between `funding_goal_cents` and `funding_cap_cents`. Per the spec's Key Decisions: "Contribution makes total > goal — Campaign transitions to `funded`; total exceeds goal (no cap enforcement)."

This is a deliberate simplification for the demo. The spec is internally consistent. The `funding_cap_cents` field is in the DB but the contribution flow does not use it.

**No action required for feat-005.** Document in gotchas that `funding_cap_cents` is schema-only in feat-005; enforcement deferred.

### C3 — MINOR: `campaign.funded` audit event not specified

**Severity**: Minor
**Location**: `feat-005-spec-api.md` success path step 8b

The research document (Section 6, Recommendation 10) flags that the live → funded campaign transition should produce an audit event in `campaign_audit_events`. The spec does NOT include this — the success path writes only to `contribution_audit_events`.

The research document notes the complexity: the `campaign_audit_events.action` CHECK constraint would need to be extended to include `'campaign.funded'` via a migration that alters an existing constraint.

The spec sidesteps this by using a separate `contribution_audit_events` table for all payment-related events. This is a valid architectural decision (per `feat-005-spec-data.md` Section 8: "Payment audit events use a separate `ContributionAuditRepository`... no change to the existing `AuditLoggerPort` is required").

**Impact**: The campaign's state history in `campaign_audit_events` will not show the `live → funded` transition caused by a contribution. The transition IS recorded atomically in the campaigns table itself (status column), and the escrow ledger is the full financial record.

**Acceptable for demo.** If full campaign audit trail is required, a follow-up migration can add `campaign.funded` to the `campaign_audit_events` CHECK constraint. Not required for feat-005.

### C4 — MINOR: `UpdateStatus` port interface inconsistency

**Severity**: Minor
**Location**: `feat-005-spec-data.md` Section 5 vs `feat-005-spec-api.md` Section 2

The `ContributionRepository` port in `feat-005-spec-data.md` defines `updateStatus()` with 4 parameters:
```typescript
updateStatus(
  contributionId: string,
  status: string,
  transactionRef: string | null,
  failureReason: string | null,
): Promise<Contribution>;
```

But `feat-005-spec-api.md` Section 2 (Transaction Implementation Detail) uses `updateStatus()` with an optional 5th parameter `client?: PoolClient`. The spec-api.md note says to add this optional parameter.

**Impact**: The port interface definition in spec-data.md and the usage in spec-api.md are inconsistent. The implementation must reconcile these — the 5-parameter version (with optional `client`) is the correct implementation target.

**Action**: Implementer should use the 5-parameter signature from spec-api.md (the `client?` is required for the transaction pattern). This is already flagged in the spec text: "The `updateStatus()` method on `ContributionRepository` needs an optional `client?: PoolClient` parameter." The spec-data.md port definition should be considered incomplete on this point.

---

## Cross-Reference Results

### Against `feat-005-contribution-flow.md` (original brief)

| Brief requirement | Spec coverage | Status |
|-------------------|--------------|--------|
| Authenticated contribution to live campaign | AC-001, AC-002 | ✅ |
| Minimum $5 / 500 cents | AC-003 | ✅ |
| Stub gateway, `tok_fail` sentinel | AC-006, AC-007 | ✅ |
| 60-second duplicate detection, HTTP 409 | AC-009, AC-010 | ✅ |
| Campaign not live → HTTP 422 | AC-013 | ✅ |
| Full state transitions audit-logged | AC-008 | ✅ |
| Payment tokens never logged | Spec Notes | ✅ |
| Payment gateway port/adapter interface | `PaymentGatewayPort` | ✅ |
| Real Stripe out of scope | Out of Scope | ✅ |

### Against `backend.md` rules

| Rule | Status |
|------|--------|
| Domain layer: zero infrastructure imports | ✅ PASS — domain/models/contribution.ts imports only domain errors |
| All monetary values as integer cents in domain | ✅ PASS |
| BIGINT in database | ✅ PASS |
| JSON serialisation as string | ✅ PASS |
| Raw SQL via pg only | ✅ PASS — PG adapter section uses parameterised queries |
| Parameterised queries ($1, $2) | ✅ PASS |
| Every query scoped to authenticated user | ✅ PASS — `findByIdForDonor`, `listByDonorForCampaign` both scope to `donor_user_id` |
| Zod validation on every request body | ✅ PASS |
| Consistent error format `{ error: { code, message } }` | ✅ PASS — `correlation_id` included |
| Stripe behind payment gateway adapter | ✅ PASS — stub adapter satisfies `PaymentGatewayPort` |
| Pino for structured logging | ✅ PASS |
| Sensitive data never logged | ✅ PASS — explicitly stated multiple times |
| Domain unit test coverage ≥90% | ✅ Specified — 15 required test cases |

### Against `frontend.md` rules

| Rule | Status |
|------|--------|
| React 19.x functional components | ✅ PASS |
| TypeScript strict mode, no `any` | ✅ PASS |
| TanStack Query for server state | ✅ PASS — `useContribute` uses `useMutation` |
| Named exports (except page default) | ✅ PASS — page uses `export default`, hooks/api use named exports |
| All props typed with explicit interface | ✅ PASS — all component interfaces specified |
| All props `readonly` | ✅ PASS |
| Semantic HTML | ✅ PASS — `<button>`, `<label>`, `<input>` specified correctly |
| `amountCents` as string from API | ✅ PASS |
| `Intl.NumberFormat` for display | ✅ PASS |
| Two-tier tokens, Tier 2 only in components | ✅ PASS |
| Dark-first UI | ✅ PASS — `--color-bg-page` as primary background |
| One primary CTA per viewport | ✅ PASS — specified explicitly |
| Every component has `.test.tsx` | ✅ PASS — testing section covers all states |

### Against `brand.md` (L2-001)

All design tokens in `feat-005-design.md` are Tier 2 semantic tokens. Design uses:
- `--color-bg-page` (page), `--color-bg-surface` (cards), `--color-bg-input` (inputs)
- `--gradient-action-primary` (CTA), `--gradient-celebration` (success state)
- `--color-status-success`, `--color-status-error`, `--color-status-warning`
- `--font-display` (Bebas Neue), `--font-body` (DM Sans), `--font-data` (Space Mono)

The 32px `--font-data` exception in `AmountInput` is documented with rationale as an approved exception for financial data entry inputs only.

### Against existing codebase

| Assumption | Verified |
|-----------|---------|
| `users` table (not `accounts`) | ✅ Confirmed via `20260305130000_create_users_table.sql` |
| `UserRepository.findByClerkUserId()` exists | ✅ Confirmed in `account/ports/user-repository.port.ts` |
| `CampaignNotFoundError` exists | ✅ Confirmed in `campaign/domain/errors/campaign-errors.ts` |
| `CampaignStatus.Funded = 'funded'` | ✅ Confirmed in `campaign/domain/value-objects/campaign-status.ts` |
| `DomainError` base class at `shared/domain/errors.ts` | ✅ Confirmed |
| `update_updated_at_column()` trigger function exists | ✅ In `20260305120000_add_updated_at_trigger.sql` |
| `FundingProgressBar` component exists | ✅ In `components/campaign/funding-progress-bar/` |
| `LoadingSpinner` component exists | ✅ In `components/ui/LoadingSpinner.tsx` |
| `/campaigns/:id/contribute` route does NOT yet exist | ✅ Confirmed — not in `routes.tsx` |
| "Back This Mission" CTA already links to `/campaigns/:id/contribute` | Verified path to public-campaign-detail-page.tsx exists |
| Migration timestamp `20260305170000` is next in sequence | ✅ Last migration is `20260305160000` |

---

## Edge Case Count

The spec-ui.md Section 7 contains **52 defined edge cases** (not 53 as stated in the validator brief). All 52 have explicit defined behaviours. The research document `feat-005-research.md` Section 5 contains an additional set of research-phase edge cases that informed the spec.

All critical edge cases have specified behaviours:
- `tok_fail` sentinel: ✅
- 60-second duplicate window: ✅
- `failed` contributions excluded from duplicate check: ✅
- Campaign auto-transition to `funded`: ✅
- No funding goal (`NULL`): ✅
- Concurrent contributions (last-write-wins): ✅ documented as acceptable for demo
- Gateway throws unexpectedly (stays `pending_capture`): ✅
- Unauthenticated user: ✅
- Campaign race to `funded` between page load and submit: ✅

---

## Verdict: CONDITIONAL PASS

The specification is complete and ready for implementation. The four conditional issues are minor and do not block development:

- **C1** (donor account status check): Implementer decision — add the check or document intentional omission
- **C2** (`funding_cap_cents` not enforced): Intentional simplification — document in gotchas
- **C3** (`campaign.funded` audit event): Acceptable omission — campaign status column is source of truth
- **C4** (`updateStatus` port interface): Implementer should use 5-parameter version from spec-api.md

All automatic FAIL triggers are clear. Financial rules are correctly specified. Architecture is sound. Dependencies are confirmed against the live codebase.

**feat-005 status updated to: ✅ SPECCED**
