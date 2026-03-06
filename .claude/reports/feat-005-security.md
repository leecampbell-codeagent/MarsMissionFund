# Security Review — feat-005

## Verdict: CONDITIONAL PASS

## Findings

### CRITICAL

None.

### HIGH

None.

### MEDIUM

**M1: TOCTOU race condition in `StubKycAdapter.submit()` — already-verified check is non-atomic**

File: `packages/backend/src/kyc/adapters/stub/stub-kyc-adapter.ts`, lines 38–41

The adapter calls `this.getStatus(input.userId)` to check for `verified` status, then opens a separate DB client and begins a transaction. Between the check and the `INSERT … ON CONFLICT DO UPDATE`, a concurrent request from the same user can pass the guard and issue a second write. The `ON CONFLICT DO UPDATE` upsert will silently overwrite the `verified` row back to `pending` and then to `verified` again, but both requests will succeed with 201 rather than one receiving 409.

Mitigation: move the already-verified guard inside the transaction and enforce it with a conditional `UPDATE … WHERE status != 'verified'` or a `SELECT … FOR UPDATE` row lock, so the check and write are atomic.

Note: this is a stub adapter used in non-production environments, which limits the immediate risk, but the pattern will be replicated when the real Veriff adapter is built.

**M2: Frontend error message may surface internal API error strings**

File: `packages/frontend/src/pages/kyc-stub.tsx`, lines 252–255

The error display renders `error.message` directly:

```tsx
{error instanceof Error
  ? error.message
  : 'Verification failed. Please try again.'}
```

If the API client propagates raw server error messages (e.g., from a 500 response body) into the thrown `Error.message`, internal implementation details could be displayed to the user. The risk is bounded by the global error handler in `server.ts` returning only `{ error: { code, message } }` with a fixed generic message for 500s, but structured 4xx messages (e.g., `ALREADY_VERIFIED`) are already user-safe. Recommend confirming that the API client normalises error messages to user-safe strings before populating `Error.message`, or replace with a hardcoded fallback for all error cases on this page.

### LOW

**L1: `KycStatusData.status` typed as `string` instead of the known union**

File: `packages/frontend/src/types/kyc.ts`, line 2

The `status` field is typed as `string` rather than the `KycStatus` union defined in `packages/backend/src/kyc/ports/kyc-adapter.ts`. This means unexpected status values from the API pass TypeScript checks silently and are rendered verbatim in the UI (e.g., `Verification status: ${status}` in `profile.tsx` line 100). There is no XSS risk because React escapes template literals, but the loose typing removes compile-time safety. Recommend sharing or duplicating the `KycStatus` union type in the frontend.

**L2: `MOCK_KYC` environment variable defaults to mock (true) — negated logic is easy to misconfigure**

File: `packages/backend/src/server.ts`, line 47

```ts
const IS_MOCK_KYC = process.env.MOCK_KYC !== 'false'; // default: true
```

The opt-out pattern (`!== 'false'`) means a missing, misspelled, or accidentally unset `MOCK_KYC` variable silently enables the in-memory mock rather than failing loudly. If this service were deployed without setting `MOCK_KYC=false`, KYC would appear to pass for all users without any real verification. The comment acknowledges the intent, but the variable should be documented in `.env.example` with a prominent warning, and a startup log message should confirm which adapter is active.

**L3: KYC submission audit log does not record the outcome status explicitly**

File: `packages/backend/src/kyc/adapters/stub/stub-kyc-adapter.ts`, line 83

The audit log on auto-approval logs `userId` and `documentType` but not the resulting `status` or `verifiedAt` timestamp. For a real KYC flow the outcome status is the most important field for the audit trail. Low severity here because this is a stub, but the pattern should include `{ userId, documentType, status, verifiedAt }` when carried forward.

## Summary

No critical or high findings. The implementation is well-structured: all SQL queries are parameterised, both KYC endpoints check `req.auth` and source `userId` exclusively from the auth context, the Zod schema uses `.strict()` and `.enum()` for constrained values, transactions use `BEGIN/COMMIT/ROLLBACK` with proper `finally` release, and the global error handler prevents stack trace leakage.

Two medium findings require attention before the pattern is carried into the production Veriff adapter: the TOCTOU race in the already-verified guard (M1), and confirmation that the frontend API client normalises error messages before display (M2). Three low-severity items (loose frontend typing, negated env-var defaulting to mock, sparse audit log) should be addressed in a follow-up.
