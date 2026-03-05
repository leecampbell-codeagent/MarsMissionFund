# Mock vs Real Adapter Status

> Tracks which external service integrations are mocked vs real.
> Maintained by the Infrastructure Engineer agent.
> Updated: 2026-03-05 (feat-004)

---

## Current Status

| Service | Status | Mock Adapter | Real Adapter | Manual Task | Feature |
|---------|--------|-------------|--------------|-------------|---------|
| Clerk Auth | Real | — (module-level mock in tests only) | `clerk-auth.adapter.ts` | Task #1 | feat-001 |
| KYC (Veriff) | Mocked | `stub-kyc-provider.adapter.ts` | `veriff-kyc-adapter.ts` (not yet built) | Task #3 | feat-002 |
| Payments (Stripe) | Mocked | `mock-payment-adapter.ts` | `stripe-payment-adapter.ts` (not yet built) | TBD | feat-005 |
| Email (AWS SES) | Mocked | `mock-email-adapter.ts` | `ses-email-adapter.ts` (not yet built) | TBD | feat-TBD |
| PostgreSQL | Real | `in-memory-user-repository.adapter.ts` (unit tests only) | `pg-user-repository.adapter.ts` | Task #2 | feat-001 |
| Campaign (bounded context) | Real | — (no external service) | PostgreSQL via `pg` pool | — | feat-003 |
| Campaign Discovery (feat-004) | Real | — (no external service) | PostgreSQL FTS via `tsvector`/`tsquery` | — | feat-004 |

---

## Environment Variable Reference

| Variable | Value | Effect |
|----------|-------|--------|
| `MOCK_AUTH` | `false` | Clerk JWT verification is live — all requests require a valid Clerk session token |
| `MOCK_AUTH` | `true` | For CI/unit tests only — `@clerk/express` is mocked at the module level via `vi.mock()` |
| `MOCK_KYC` | `true` | KYC verification calls use `mock-kyc-adapter.ts` — always returns stubbed responses |
| `MOCK_PAYMENTS` | `true` | Payment gateway calls use `mock-payment-adapter.ts` — no Stripe charges are made |
| `MOCK_EMAIL` | `true` | Email delivery uses `mock-email-adapter.ts` — emails are logged to console, not sent via SES |

---

## Notes

- **Clerk Auth is always a real integration.** It is never mocked in running application code.
  The `MOCK_AUTH=true` flag is reserved exclusively for CI/unit test environments where
  `@clerk/express` is mocked at the module level using `vi.mock()`. Do not set `MOCK_AUTH=true`
  in a deployed environment.

- **KYC, Payments, and Email** are mocked for the local demo and all non-production environments
  until the corresponding real adapters are built and the manual tasks for each third-party service
  are completed.

- **PostgreSQL** is always real. The `in-memory-user-repository.adapter.ts` is used only in unit
  tests — it is not an application-level mock controlled by an environment variable.

- **Campaign bounded context (feat-003)** introduces no new external service integrations.
  Campaigns are stored in PostgreSQL using the existing `pg` pool. No new environment variable
  flags are required. No new mock adapters are needed — the Campaign feature is entirely
  database-backed with no third-party service dependencies.

- **Campaign Discovery (feat-004)** introduces no new external service integrations.
  Full-text search uses PostgreSQL native `tsvector`/`tsquery` with a GIN index on the
  `campaigns.search_vector` column — no Elasticsearch, Algolia, or other search provider.
  No new environment variable flags are required. No new mock adapters are needed.




























