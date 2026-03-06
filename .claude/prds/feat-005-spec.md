# feat-005 Spec: KYC Identity Verification (Stub Adapter)

> Implementation-ready spec. Engineers implement directly from this document without asking questions.
> Status: Ready for implementation.
> Date: 2026-03-06

---

## Section 1: Overview

### What is in scope

- New bounded context: `packages/backend/src/kyc/`
- Domain errors: `KycRequiredError`, `AlreadyVerifiedError`
- Port interface: `IKycAdapter`
- Stub adapter: `StubKycAdapter` — auto-approves synchronously within a single DB transaction
- Mock adapter: `MockKycAdapter` — in-memory, for unit/integration tests only
- Application service: `KycService` — `getStatus`, `submitVerification`, `requireVerified`
- API endpoints: `GET /api/v1/kyc/status`, `POST /api/v1/kyc/submit`
- Server wiring: `MOCK_KYC` env var, composition root additions in `server.ts`
- Frontend hooks: `useKycStatus`, `useSubmitKyc`
- Frontend type: `KycStatusResponse`
- Frontend page: full replacement of `packages/frontend/src/pages/kyc-stub.tsx`
- Frontend profile page: KYC section reads live status from `useKycStatus()`
- Tests: backend router integration tests, frontend component/hook tests

### What is out of scope

- Real Veriff SDK integration
- Document image upload and storage
- Video liveness capture
- Sanctions screening
- Manual review workflow and admin queue
- Re-verification triggers (document expiry, time-based, suspicious activity)
- Resubmission failure count escalation
- Any new DB migration — the `kyc_verifications` table already exists

### Bounded context

All new backend code lives in `packages/backend/src/kyc/`. This context is parallel to `account/` and has no circular dependencies with it. The KYC context depends on `shared/domain/errors.ts` only.

---

## Section 2: Data Model

### No new migration required

The `kyc_verifications` table was created in `db/migrations/20260306000003_create_kyc.sql`. Do not create or modify any migration file.

### Existing schema

```sql
CREATE TABLE IF NOT EXISTS kyc_verifications (
  id                 UUID        NOT NULL,
  user_id            UUID        NOT NULL,
  status             TEXT        NOT NULL,
  provider_reference TEXT        NULL,
  verified_at        TIMESTAMPTZ NULL,
  expires_at         TIMESTAMPTZ NULL,
  failure_count      INT         NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT kyc_verifications_pkey PRIMARY KEY (id),
  CONSTRAINT kyc_verifications_user_id_unique UNIQUE (user_id),
  CONSTRAINT kyc_verifications_status_check CHECK (
    status IN (
      'not_verified',
      'pending',
      'pending_resubmission',
      'in_manual_review',
      'verified',
      'expired',
      're_verification_required',
      'rejected',
      'locked'
    )
  ),
  CONSTRAINT kyc_verifications_failure_count_check CHECK (failure_count >= 0),
  CONSTRAINT kyc_verifications_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_kyc_verifications_user_id ON kyc_verifications (user_id);

CREATE TRIGGER set_kyc_verifications_updated_at
  BEFORE UPDATE ON kyc_verifications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Allowed status values (9 total from CHECK constraint)

```
'not_verified'
'pending'
'pending_resubmission'
'in_manual_review'
'verified'
'expired'
're_verification_required'
'rejected'
'locked'
```

### Key schema notes for implementation

- `user_id` is UNIQUE — one row per user, enforced at DB level
- `ON CONFLICT (user_id) DO UPDATE` upsert pattern works because of this unique constraint
- `updated_at` is auto-maintained by the `set_kyc_verifications_updated_at` trigger — do not set it manually in UPDATE statements
- `provider_reference`: always `NULL` in stub — the real Veriff adapter would populate this
- `failure_count`: never incremented by the stub — leave at default `0`
- `expires_at`: always `NULL` for feat-005 — out of scope

---

## Section 3: Domain Layer

### File: `packages/backend/src/kyc/domain/errors.ts`

```typescript
import { DomainError } from '../../shared/domain/errors.js';

export class KycRequiredError extends DomainError {
  readonly code = 'KYC_REQUIRED' as const;

  constructor() {
    super('KYC_REQUIRED', 'Identity verification is required to access this feature.');
  }
}

export class AlreadyVerifiedError extends DomainError {
  readonly code = 'ALREADY_VERIFIED' as const;

  constructor() {
    super('ALREADY_VERIFIED', 'Identity verification is already complete.');
  }
}
```

**Rules:**
- Import `DomainError` from `../../shared/domain/errors.js` — exact path with `.js` extension (Node16 module resolution)
- No infrastructure imports — no `pg`, no `process.env`, no `fetch`
- No `console.log` anywhere in domain code — Pino is used at the application/adapter layers only

---

## Section 4: Port Interface

### File: `packages/backend/src/kyc/ports/kyc-adapter.ts`

This file defines all shared types used across domain, application, and adapter layers.

```typescript
export type KycStatus =
  | 'not_verified'
  | 'pending'
  | 'pending_resubmission'
  | 'in_manual_review'
  | 'verified'
  | 'expired'
  | 're_verification_required'
  | 'rejected'
  | 'locked';

export type DocumentType = 'passport' | 'national_id' | 'drivers_licence';

export interface KycVerification {
  readonly userId: string;
  readonly status: KycStatus;
  readonly verifiedAt: Date | null;
  readonly providerReference: string | null;
}

export interface SubmitKycInput {
  readonly userId: string;
  readonly documentType: DocumentType;
}

export interface IKycAdapter {
  getStatus(userId: string): Promise<KycVerification | null>;
  submit(input: SubmitKycInput): Promise<KycVerification>;
}
```

**Design notes:**
- `KycVerification` is a read model / plain data object — NOT a domain entity with private constructor. The adapter returns it; the service layer reads from it.
- `getStatus` returns `null` when no row exists (user has never submitted). Callers treat `null` as `not_verified`. No row is created on status check.
- `providerReference` is included for future real Veriff adapter compatibility. Stub always returns `null`.
- Application service and domain code import ONLY from this port file — never from adapter implementations.

---

## Section 5: Stub Adapter

### File: `packages/backend/src/kyc/adapters/stub/stub-kyc-adapter.ts`

```typescript
import type { Pool } from 'pg';
import type { Logger } from 'pino';
import { AlreadyVerifiedError } from '../../domain/errors.js';
import type { DocumentType, IKycAdapter, KycVerification } from '../../ports/kyc-adapter.js';

export class StubKycAdapter implements IKycAdapter {
  constructor(
    private readonly pool: Pool,
    private readonly logger: Logger,
  ) {}

  async getStatus(userId: string): Promise<KycVerification | null> {
    const result = await this.pool.query<{
      user_id: string;
      status: string;
      verified_at: Date | null;
      provider_reference: string | null;
    }>(
      `SELECT user_id, status, verified_at, provider_reference
       FROM kyc_verifications
       WHERE user_id = $1`,
      [userId],
    );

    const row = result.rows[0];
    if (!row) return null;

    return {
      userId: row.user_id,
      status: row.status as KycVerification['status'],
      verifiedAt: row.verified_at,
      providerReference: row.provider_reference,
    };
  }

  async submit(input: { userId: string; documentType: DocumentType }): Promise<KycVerification> {
    // Check existing status before writing
    const existing = await this.getStatus(input.userId);
    if (existing?.status === 'verified') {
      throw new AlreadyVerifiedError();
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Step 1: upsert to 'pending'
      await client.query(
        `INSERT INTO kyc_verifications (id, user_id, status, provider_reference, verified_at)
         VALUES (gen_random_uuid(), $1, 'pending', NULL, NULL)
         ON CONFLICT (user_id)
         DO UPDATE SET
           status = 'pending',
           provider_reference = NULL,
           verified_at = NULL,
           updated_at = NOW()`,
        [input.userId],
      );

      // Step 2: immediately transition to 'verified' (stub auto-approval)
      const verifiedResult = await client.query<{
        user_id: string;
        status: string;
        verified_at: Date | null;
        provider_reference: string | null;
      }>(
        `UPDATE kyc_verifications
         SET status = 'verified',
             verified_at = NOW(),
             updated_at = NOW()
         WHERE user_id = $1
         RETURNING user_id, status, verified_at, provider_reference`,
        [input.userId],
      );

      await client.query('COMMIT');

      const row = verifiedResult.rows[0];
      if (!row) {
        throw new Error('KYC upsert returned no row after COMMIT');
      }

      this.logger.info({ userId: input.userId, documentType: input.documentType }, 'KYC stub auto-approved');

      return {
        userId: row.user_id,
        status: row.status as KycVerification['status'],
        verifiedAt: row.verified_at,
        providerReference: row.provider_reference,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
```

**Implementation rules:**
- The `already verified` guard happens BEFORE the transaction — avoids unnecessary DB writes
- Two-step upsert inside a single transaction: pending → verified. The `updated_at` column is set manually in the UPDATE because the trigger fires on UPDATE but the upsert's `ON CONFLICT DO UPDATE` path IS an UPDATE — the trigger will fire and set `updated_at`. However, explicit `updated_at = NOW()` in the UPDATE statement is also safe (trigger will overwrite with the same value). To be explicit and safe, set it in both paths.
- `ROLLBACK` in the catch ensures no partial writes persist
- Always release the client in `finally`
- Logger injected — use `this.logger.info(...)` for the auto-approval event. Never `console.log`.
- `noUncheckedIndexedAccess` is enabled — always guard `result.rows[0]` with a null check before accessing properties. Use the pattern shown above.

---

## Section 6: Mock Adapter (for tests only)

### File: `packages/backend/src/kyc/adapters/mock/mock-kyc-adapter.ts`

This adapter is used ONLY in tests. It stores state in-memory with a `Map`.

```typescript
import { AlreadyVerifiedError } from '../../domain/errors.js';
import type { IKycAdapter, KycStatus, KycVerification, SubmitKycInput } from '../../ports/kyc-adapter.js';

export class MockKycAdapter implements IKycAdapter {
  private readonly store: Map<string, KycVerification> = new Map();

  async getStatus(userId: string): Promise<KycVerification | null> {
    return this.store.get(userId) ?? null;
  }

  async submit(input: SubmitKycInput): Promise<KycVerification> {
    const existing = this.store.get(input.userId);
    if (existing?.status === 'verified') {
      throw new AlreadyVerifiedError();
    }

    const result: KycVerification = {
      userId: input.userId,
      status: 'verified',
      verifiedAt: new Date(),
      providerReference: null,
    };
    this.store.set(input.userId, result);
    return result;
  }

  /** Test helper — pre-seed a user's KYC state without going through submit() */
  setStatus(userId: string, status: KycStatus, verifiedAt: Date | null = null): void {
    this.store.set(userId, { userId, status, verifiedAt, providerReference: null });
  }

  /** Test helper — clear all stored state between tests */
  clear(): void {
    this.store.clear();
  }
}
```

---

## Section 7: Application Service

### File: `packages/backend/src/kyc/application/kyc-service.ts`

```typescript
import type { Logger } from 'pino';
import { AlreadyVerifiedError, KycRequiredError } from '../domain/errors.js';
import type { DocumentType, IKycAdapter, KycStatus, KycVerification } from '../ports/kyc-adapter.js';

export class KycService {
  constructor(
    private readonly kycAdapter: IKycAdapter,
    private readonly logger: Logger,
  ) {}

  async getStatus(userId: string): Promise<{ status: KycStatus; verifiedAt: Date | null }> {
    const verification = await this.kycAdapter.getStatus(userId);
    if (!verification) {
      return { status: 'not_verified', verifiedAt: null };
    }
    return { status: verification.status, verifiedAt: verification.verifiedAt };
  }

  async submitVerification(userId: string, documentType: DocumentType): Promise<KycVerification> {
    // AlreadyVerifiedError is thrown by the adapter if status === 'verified'.
    // Let it propagate — the controller catches it and returns 409.
    return this.kycAdapter.submit({ userId, documentType });
  }

  async requireVerified(userId: string): Promise<void> {
    const { status } = await this.getStatus(userId);
    if (status !== 'verified') {
      this.logger.warn({ userId, kycStatus: status }, 'KYC check failed — access denied');
      throw new KycRequiredError();
    }
  }
}
```

**Method contracts:**
- `getStatus`: never throws; returns `{ status: 'not_verified', verifiedAt: null }` when no DB row exists
- `submitVerification`: throws `AlreadyVerifiedError` if already verified; otherwise returns the final `KycVerification` (stub returns `status: 'verified'`)
- `requireVerified`: throws `KycRequiredError` if status is anything other than `'verified'`; resolves with `void` if verified. Used by future creator-gated endpoints.

**Logger injection:** The logger is passed from `server.ts`. The service uses it for warn-level KYC denial events. No `console.log`.

---

## Section 8: API Layer

### File: `packages/backend/src/kyc/api/kyc-router.ts`

```typescript
import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import { AlreadyVerifiedError } from '../domain/errors.js';
import type { KycService } from '../application/kyc-service.js';

const submitKycSchema = z
  .object({
    documentType: z.enum(['passport', 'national_id', 'drivers_licence']),
  })
  .strict();

export function createKycRouter(kycService: KycService): Router {
  const router = Router();

  // GET /api/v1/kyc/status
  router.get('/status', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.auth) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required.' } });
        return;
      }

      const { status, verifiedAt } = await kycService.getStatus(req.auth.userId);

      res.status(200).json({
        data: {
          status,
          verifiedAt: verifiedAt ? verifiedAt.toISOString() : null,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/v1/kyc/submit
  router.post('/submit', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.auth) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required.' } });
        return;
      }

      const parsed = submitKycSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message ?? 'Validation failed.',
          },
        });
        return;
      }

      const verification = await kycService.submitVerification(
        req.auth.userId,
        parsed.data.documentType,
      );

      res.status(201).json({
        data: {
          status: verification.status,
          verifiedAt: verification.verifiedAt ? verification.verifiedAt.toISOString() : null,
        },
      });
    } catch (err) {
      if (err instanceof AlreadyVerifiedError) {
        res.status(409).json({
          error: {
            code: 'ALREADY_VERIFIED',
            message: err.message,
          },
        });
        return;
      }
      next(err);
    }
  });

  return router;
}
```

**Endpoint contracts:**

| Method | Path | Auth | Success | Error cases |
|---|---|---|---|---|
| GET | `/api/v1/kyc/status` | Required | 200 `{ data: { status, verifiedAt } }` | 401 UNAUTHORIZED |
| POST | `/api/v1/kyc/submit` | Required | 201 `{ data: { status, verifiedAt } }` | 400 VALIDATION_ERROR, 401 UNAUTHORIZED, 409 ALREADY_VERIFIED |

**Response shape — GET /api/v1/kyc/status:**
```json
{
  "data": {
    "status": "not_verified",
    "verifiedAt": null
  }
}
```
or:
```json
{
  "data": {
    "status": "verified",
    "verifiedAt": "2026-03-06T12:34:56.000Z"
  }
}
```

**Response shape — POST /api/v1/kyc/submit (success — 201):**
```json
{
  "data": {
    "status": "verified",
    "verifiedAt": "2026-03-06T12:34:56.000Z"
  }
}
```

**Response shape — POST /api/v1/kyc/submit (409):**
```json
{
  "error": {
    "code": "ALREADY_VERIFIED",
    "message": "Identity verification is already complete."
  }
}
```

**Notes:**
- The controller does NOT check `req.auth` twice — check once at the top of the handler and return early
- `AlreadyVerifiedError` is caught inline in the POST handler — it does NOT propagate to the global error handler
- `KycRequiredError` is not relevant to these endpoints; it is for future creator-gated endpoints in other routers
- `.strict()` on the Zod schema ensures unknown fields return 400 (not silently ignored)

---

## Section 9: Server Wiring

### Modify: `packages/backend/src/account/api/api-router.ts`

Add `kycService` parameter and mount the KYC router at `/kyc`.

```typescript
import { Router } from 'express';
import type { KycService } from '../../kyc/application/kyc-service.js';
import { createKycRouter } from '../../kyc/api/kyc-router.js';
import type { ProfileService } from '../application/profile-service.js';
import type { UserRepository } from '../ports/user-repository.js';
import { createMeRouter } from './me-router.js';

export function createApiRouter(
  userRepository: UserRepository,
  profileService: ProfileService,
  kycService: KycService,
): Router {
  const router = Router();

  router.use('/me', createMeRouter(userRepository, profileService));
  router.use('/kyc', createKycRouter(kycService));

  return router;
}
```

### Modify: `packages/backend/src/server.ts`

Add the following to the composition root section (after `profileService` is constructed, before `app` is created):

```typescript
// --- add these imports at the top of server.ts ---
import { StubKycAdapter } from './kyc/adapters/stub/stub-kyc-adapter.js';
import { KycService } from './kyc/application/kyc-service.js';

// --- add this in the composition root section ---
const IS_MOCK_KYC = process.env.MOCK_KYC !== 'false'; // default: true
const kycAdapter = new StubKycAdapter(pool, logger);   // only stub exists for feat-005
const kycService = new KycService(kycAdapter, logger);

// --- update the createApiRouter call ---
app.use('/api/v1', createApiRouter(userRepository, profileService, kycService));
```

**Important:**
- `IS_MOCK_KYC` is evaluated once at module scope — never per-request
- For feat-005, `StubKycAdapter` is always used (the real Veriff adapter is out of scope). The `IS_MOCK_KYC` flag is wired but both branches use the stub for now. When a real adapter is added, the branch becomes: `IS_MOCK_KYC ? new StubKycAdapter(pool, logger) : new VeriffKycAdapter(pool, logger)`
- The `logger` instance already exists in `server.ts` — pass it to both `StubKycAdapter` and `KycService`

### Modify: `.env.example`

Add the following line in the env vars section:

```
MOCK_KYC=true   # Set to false to use real Veriff adapter (not yet implemented)
```

---

## Section 10: Frontend Types

### New file: `packages/frontend/src/types/kyc.ts`

```typescript
export interface KycStatusData {
  readonly status: string;
  readonly verifiedAt: string | null;
}

export interface KycStatusResponse {
  readonly data: KycStatusData;
}

export interface KycSubmitResponse {
  readonly data: KycStatusData;
}
```

**Note:** `status` is typed as `string` (not a union) in the frontend type — the frontend renders based on string comparison and does not need to enumerate all 9 status values. This avoids frontend/backend type coupling.

---

## Section 11: Frontend Hooks

### New file: `packages/frontend/src/hooks/use-kyc-status.ts`

```typescript
import { useQuery } from '@tanstack/react-query';
import { useTypedApiClient } from '../lib/api-client.js';
import type { KycStatusResponse } from '../types/kyc.js';

export function useKycStatus() {
  const client = useTypedApiClient();
  return useQuery({
    queryKey: ['kyc-status'],
    queryFn: () => client.get<KycStatusResponse>('/api/v1/kyc/status'),
    staleTime: 30_000,
  });
}
```

**Pattern:** Follows `use-current-user.ts` exactly — `useTypedApiClient`, typed generic, `staleTime: 30_000`.

### New file: `packages/frontend/src/hooks/use-submit-kyc.ts`

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTypedApiClient } from '../lib/api-client.js';
import type { KycSubmitResponse } from '../types/kyc.js';

interface SubmitKycInput {
  readonly documentType: 'passport' | 'national_id' | 'drivers_licence';
}

export function useSubmitKyc() {
  const client = useTypedApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SubmitKycInput) =>
      client.post<KycSubmitResponse>('/api/v1/kyc/submit', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['kyc-status'] });
    },
  });
}
```

**Pattern:** Follows `use-update-profile.ts` exactly — `useMutation`, typed generic, invalidate on success.

**Note on `client.post`:** The `useTypedApiClient` in `lib/api-client.ts` must expose a `post` method. Check if it already exists; if not, add it following the same pattern as `put`. The `post` method sends `method: 'POST'` with a JSON body.

---

## Section 12: KYC Page (Full Replacement)

### File: `packages/frontend/src/pages/kyc-stub.tsx`

This is a full replacement of the existing static stub. The file name stays the same (`kyc-stub.tsx`) to avoid changes to `App.tsx` routing.

The page has three render states:
1. **Loading** — while `useKycStatus()` is fetching
2. **Verified** — when `status === 'verified'`
3. **Form** — all other statuses (including `not_verified`, `pending`, `pending_resubmission`, etc.)

**Loading state:** Show a centred `<LoadingSpinner />` (import from `../components/ui/loading-spinner.js`).

**Verified state:** Show success content — no form. Navigation link back to profile.

**Form state:** Show document type selector and submit button.

```tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LoadingSpinner } from '../components/ui/loading-spinner.js';
import { useKycStatus } from '../hooks/use-kyc-status.js';
import { useSubmitKyc } from '../hooks/use-submit-kyc.js';

type DocumentType = 'passport' | 'national_id' | 'drivers_licence';

export default function KycStubPage() {
  const { data: kycData, isLoading } = useKycStatus();
  const { mutate: submitKyc, isPending, isError, error } = useSubmitKyc();
  const [selectedDoc, setSelectedDoc] = useState<DocumentType>('passport');

  const status = kycData?.data.status;

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: 'calc(100vh - 64px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--color-bg-page)',
        }}
      >
        <LoadingSpinner label="Loading verification status" />
      </div>
    );
  }

  return (
    <>
      <title>Identity Verification — Mars Mission Fund</title>
      <div
        style={{
          minHeight: 'calc(100vh - 64px)',
          backgroundColor: 'var(--color-bg-page)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 24px',
        }}
      >
        <div
          style={{
            maxWidth: '480px',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: '32px',
          }}
        >
          {status === 'verified' ? (
            /* --- Verified / success state --- */
            <>
              {/* Section label for verified state */}
              <p
                style={{
                  fontFamily: 'var(--font-data)',
                  fontSize: '11px',
                  fontWeight: 400,
                  letterSpacing: '0.3em',
                  textTransform: 'uppercase',
                  color: 'var(--color-text-accent)',
                  margin: 0,
                }}
              >
                01 — IDENTITY VERIFIED
              </p>
              <h1
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '48px',
                  fontWeight: 400,
                  letterSpacing: '0.04em',
                  color: 'var(--color-text-primary)',
                  lineHeight: 1,
                  textTransform: 'uppercase',
                  margin: 0,
                }}
              >
                VERIFICATION APPROVED
              </h1>
              {/* Checkmark icon - simple inline character, no undocumented container tokens */}
              <div
                style={{
                  fontSize: '32px',
                  color: 'var(--color-status-success)',
                  lineHeight: 1,
                }}
                aria-hidden="true"
              >
                ✓
              </div>
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '16px',
                  lineHeight: 1.7,
                  color: 'var(--color-text-secondary)',
                  margin: 0,
                }}
              >
                Your identity has been verified. You can now submit campaigns.
              </p>
              <Link
                to="/profile"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  alignSelf: 'flex-start',
                  minHeight: '44px',
                  padding: '12px 24px',
                  fontFamily: 'var(--font-body)',
                  fontSize: '14px',
                  fontWeight: 600,
                  letterSpacing: '0.01em',
                  color: 'var(--color-action-ghost-text)',
                  backgroundColor: 'transparent',
                  border: '1px solid var(--color-action-ghost-border)',
                  borderRadius: 'var(--radius-button)',
                  textDecoration: 'none',
                  cursor: 'pointer',
                  transition: 'opacity var(--motion-hover)',
                }}
              >
                Return to Profile
              </Link>
            </>
          ) : (
            /* --- Form state (not_verified, pending, etc.) --- */
            <>
              {/* Section label for form state */}
              <p
                style={{
                  fontFamily: 'var(--font-data)',
                  fontSize: '11px',
                  fontWeight: 400,
                  letterSpacing: '0.3em',
                  textTransform: 'uppercase',
                  color: 'var(--color-text-accent)',
                  margin: 0,
                }}
              >
                01 — VERIFY YOUR IDENTITY
              </p>

              {/* Page heading */}
              <h1
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '48px',
                  fontWeight: 400,
                  letterSpacing: '0.04em',
                  color: 'var(--color-text-primary)',
                  lineHeight: 1,
                  margin: 0,
                  textTransform: 'uppercase',
                }}
              >
                IDENTITY VERIFICATION
              </h1>

              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '16px',
                  lineHeight: 1.7,
                  color: 'var(--color-text-secondary)',
                  margin: 0,
                }}
              >
                To launch campaigns on Mars Mission Fund, we need to verify your identity. Select your document type below and submit — verification is processed automatically.
              </p>

              {/* Issue 5: Pending status banner */}
              {status === 'pending' && (
                <div
                  role="status"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '12px 16px',
                    backgroundColor: 'rgba(255, 183, 71, 0.1)',
                    border: '1px solid var(--color-status-warning)',
                    borderRadius: 'var(--radius-input)',
                  }}
                >
                  <LoadingSpinner size="sm" label="Pending" />
                  <span
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: '14px',
                      color: 'var(--color-status-warning)',
                    }}
                  >
                    Your verification is pending review.
                  </span>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label
                  htmlFor="document-type"
                  style={{
                    fontFamily: 'var(--font-data)',
                    fontSize: '11px',
                    letterSpacing: '0.2em',
                    textTransform: 'uppercase',
                    color: 'var(--color-text-tertiary)',
                  }}
                >
                  Document Type
                </label>
                <select
                  id="document-type"
                  value={selectedDoc}
                  onChange={(e) => setSelectedDoc(e.target.value as DocumentType)}
                  disabled={isPending}
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '16px',
                    color: 'var(--color-text-primary)',
                    backgroundColor: 'var(--color-bg-input)',
                    border: '1px solid var(--color-border-input)',
                    borderRadius: 'var(--radius-input)',
                    padding: '12px 16px',
                    width: '100%',
                    cursor: 'pointer',
                  }}
                >
                  <option value="passport">Passport</option>
                  <option value="national_id">National ID</option>
                  <option value="drivers_licence">Driver's Licence</option>
                </select>
              </div>

              {isError && (
                <p
                  role="alert"
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '14px',
                    color: 'var(--color-status-error)',
                    margin: 0,
                  }}
                >
                  {error instanceof Error ? error.message : 'Verification failed. Please try again.'}
                </p>
              )}

              <button
                type="button"
                onClick={() => submitKyc({ documentType: selectedDoc })}
                disabled={isPending}
                style={{
                  alignSelf: 'flex-start',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '44px',
                  padding: '12px 32px',
                  fontFamily: 'var(--font-body)',
                  fontSize: '14px',
                  fontWeight: 600,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  color: 'var(--color-text-on-action)',
                  background: 'var(--gradient-action-primary)',
                  border: 'none',
                  borderRadius: 'var(--radius-button)',
                  cursor: isPending ? 'not-allowed' : 'pointer',
                  opacity: isPending ? 0.7 : 1,
                  boxShadow: '0 4px 16px var(--color-action-primary-shadow)',
                }}
              >
                {isPending ? <LoadingSpinner size="sm" label="Submitting" /> : 'SUBMIT FOR VERIFICATION'}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
```

**Design system tokens used:**
- `--color-bg-page` — page background
- `--color-bg-input` — select background
- `--color-text-primary`, `--color-text-secondary`, `--color-text-tertiary`, `--color-text-accent` — text hierarchy
- `--color-status-success` — verified checkmark/icon colour
- `--color-status-warning` — pending banner border, text
- `--color-status-error` — error message colour
- `--color-border-input` — select border
- `--color-text-on-action`, `--gradient-action-primary`, `--color-action-primary-shadow` — primary CTA button
- `--color-action-ghost-text` — return link
- `--font-display` (Bebas Neue, uppercase) — headings
- `--font-body` (DM Sans) — body text, button text
- `--font-data` (Space Mono) — labels, section markers
- `--radius-button` — button border radius; `--radius-input` — select border radius; `--radius-card` — card border radius

**No `App.tsx` changes required** — the route `/kyc` already exists pointing to `KycStubPage`.

---

## Section 13: Profile Page KYC Integration

### Modify: `packages/frontend/src/pages/profile.tsx`

Import `useKycStatus` and use it in the KYC section. All other parts of the profile page remain unchanged.

**Add imports:**
```typescript
import { LoadingSpinner } from '../components/ui/loading-spinner.js';
import { useKycStatus } from '../hooks/use-kyc-status.js';
```

**Add inside the `ProfilePage` component body** (after existing `useCurrentUser` call):
```typescript
const { data: kycData, isLoading: kycLoading } = useKycStatus();
const kycStatus = kycData?.data.status ?? 'not_verified';
```

**Add a named `KycStatusDisplay` component** in the same file (above `ProfilePage`), as specified by the design spec. This component encapsulates all variant rendering logic:

```tsx
interface KycStatusDisplayProps {
  readonly status: string;
  readonly isLoading: boolean;
}

export function KycStatusDisplay({ status, isLoading }: KycStatusDisplayProps): JSX.Element {
  return (
    <div
      style={{
        padding: '16px 20px',
        backgroundColor: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 'var(--radius-card)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
      }}
    >
      {isLoading ? (
        <>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '14px',
              color: 'var(--color-text-tertiary)',
              margin: 0,
            }}
          >
            Loading verification status…
          </p>
          <LoadingSpinner size="sm" label="Loading KYC status" />
        </>
      ) : status === 'verified' ? (
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '14px',
            color: 'var(--color-status-success)',
            margin: 0,
          }}
        >
          ✓ Identity verified.
        </p>
      ) : status === 'pending' ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <LoadingSpinner size="sm" />
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '14px',
              color: 'var(--color-status-warning)',
              margin: 0,
            }}
          >
            Verification pending review.
          </p>
        </div>
      ) : status === 'not_verified' ? (
        <>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '14px',
              color: 'var(--color-text-secondary)',
              margin: 0,
            }}
          >
            Identity verification not yet started.
          </p>
          <a
            href="/kyc"
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '14px',
              color: 'var(--color-action-ghost-text)',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            Start verification →
          </a>
        </>
      ) : (
        <>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '14px',
              color: 'var(--color-text-secondary)',
              margin: 0,
            }}
          >
            {`Verification status: ${status}`}
          </p>
          <a
            href="/kyc"
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '14px',
              color: 'var(--color-action-ghost-text)',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            Retry verification →
          </a>
        </>
      )}
    </div>
  );
}
```

**Replace the existing KYC section** in `ProfilePage` (the `<section aria-label="Identity verification">` div content) using `<KycStatusDisplay>`:

**Replace the existing KYC section** (the `<section aria-label="Identity verification">` block) with the following:

```tsx
{/* KYC Status section */}
<section aria-label="Identity verification">
  <h2
    style={{
      fontFamily: 'var(--font-display)',
      fontSize: '24px',
      fontWeight: 400,
      letterSpacing: '0.04em',
      color: 'var(--color-text-primary)',
      textTransform: 'uppercase',
      margin: '0 0 24px 0',
    }}
  >
    IDENTITY VERIFICATION
  </h2>
  <KycStatusDisplay status={kycStatus} isLoading={kycLoading} />
</section>
```

**Status rendering rules:**
- `isLoading === true` → "Loading verification status…" + `<LoadingSpinner size="sm" />`
- `'verified'` → "✓ Identity verified." in `--color-status-success`, no link
- `'pending'` → "Verification pending review." in `--color-status-warning`, no link
- `'not_verified'` → "Identity verification not yet started." + "Start verification →" link
- `'rejected'`, `'expired'`, or any other status → `Verification status: {status}` + "Retry verification →" link

**TanStack Query deduplication:** If `useKycStatus()` is called on the same page multiple times (e.g., from a child component), TanStack Query deduplicates the network request. Adding a second `useQuery` call with the same `queryKey: ['kyc-status']` in `profile.tsx` is safe and performant.

---

## Section 14: Testing Requirements

### Backend: `packages/backend/src/kyc/api/kyc-router.test.ts`

Pattern: follows `me-router.test.ts` exactly. Use `MockKycAdapter` (in-memory, no DB).

**`buildTestApp` helper for KYC tests:**

```typescript
function buildTestApp(mockUserRepo: MockUserRepository, mockKycAdapter: MockKycAdapter) {
  const clerkPort = new MockClerkAdapter();
  const authSyncService = new AuthSyncService(mockUserRepo, clerkPort);
  const profileService = new ProfileService(mockUserRepo);
  const kycService = new KycService(mockKycAdapter, pinoLogger); // use pino({ level: 'silent' })

  const app = express();
  app.use(express.json());
  app.use(correlationIdMiddleware);
  app.use(buildClerkMiddleware(true));
  app.use(createMmfAuthMiddleware(authSyncService, true));
  app.use('/api/v1', createApiRouter(mockUserRepo, profileService, kycService));
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction): void => {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: String(err) } });
  });
  return app;
}
```

**Test cases to implement:**

```
describe('GET /api/v1/kyc/status')
  ✓ returns 200 { data: { status: 'not_verified', verifiedAt: null } } when no KYC row exists
  ✓ returns 200 { data: { status: 'verified', verifiedAt: <ISO string> } } after mock.setStatus('verified')
  ✓ returns 200 { data: { status: 'pending', verifiedAt: null } } after mock.setStatus('pending')
  ✓ returns 401 without Authorization header

describe('POST /api/v1/kyc/submit')
  ✓ returns 201 with { data: { status: 'verified', verifiedAt: <not null> } } for valid submission
  ✓ status: 'verified' is confirmed by subsequent GET /api/v1/kyc/status call (acceptance criterion)
  ✓ returns 400 VALIDATION_ERROR for invalid documentType value (e.g. 'drivers_license')
  ✓ returns 400 VALIDATION_ERROR for unknown fields (e.g. { documentType: 'passport', extra: true })
  ✓ returns 409 ALREADY_VERIFIED when mock adapter has status 'verified'
  ✓ returns 401 without Authorization header

describe('KYC gating — requireVerified()')
  ✓ a mock endpoint that calls kycService.requireVerified() returns 403 KYC_REQUIRED when user has not_verified status
  ✓ a mock endpoint that calls kycService.requireVerified() returns 200 when user has verified status
```

**For the KYC gating tests:** Add a test-only route in `buildTestApp` or in the describe block:
```typescript
app.get('/api/v1/test/creator-only', async (req, res, next) => {
  try {
    await kycService.requireVerified(req.auth!.userId);
    res.status(200).json({ ok: true });
  } catch (err) {
    if (err instanceof KycRequiredError) {
      res.status(403).json({ error: { code: 'KYC_REQUIRED', message: err.message } });
      return;
    }
    next(err);
  }
});
```

### Backend: `packages/backend/src/kyc/adapters/stub/stub-kyc-adapter.test.ts`

Integration tests against live PostgreSQL. Uses the `TEST_PREFIX` pattern.

```typescript
const TEST_PREFIX = 'test_kyc_stub_';

// Use pool from shared/infra/db.ts
// beforeEach: DELETE FROM kyc_verifications WHERE user_id IN (SELECT id FROM users WHERE clerk_id LIKE $1)
// afterEach: same cleanup
// Use a real user created in the users table for FK constraint

describe('StubKycAdapter')
  ✓ getStatus returns null when no row exists
  ✓ submit creates a new row with status 'verified' and non-null verifiedAt
  ✓ getStatus returns 'verified' after submit
  ✓ submit on already-verified user throws AlreadyVerifiedError
  ✓ submit is idempotent when called from pending state (treated as allowed re-submission)
  ✓ verifiedAt is a Date object (not string) in the returned KycVerification
```

### Frontend: `packages/frontend/src/pages/kyc-stub.test.tsx`

Full replacement — all 4 existing tests become stale when the component is rewritten.

```
vi.mock('../hooks/use-kyc-status.js')
vi.mock('../hooks/use-submit-kyc.js')

describe('KycStubPage')
  ✓ renders loading spinner when useKycStatus is loading
  ✓ renders "IDENTITY VERIFICATION" heading in all non-loading states
  ✓ renders document type selector and submit button when status is 'not_verified'
  ✓ renders document type selector and submit button when status is 'pending'
  ✓ renders "VERIFICATION APPROVED" and "Return to Profile" link when status is 'verified'
  ✓ submit button calls submitKyc mutation with selected documentType
  ✓ shows error message when mutation isError is true
  ✓ submit button shows LoadingSpinner (with label="Submitting") when isPending is true
  ✓ submit button is disabled when isPending is true
  ✓ document type select defaults to 'passport'
  ✓ document type select can be changed (e.g. to 'national_id')
```

**Mock pattern:**
```typescript
vi.mock('../hooks/use-kyc-status.js', () => ({
  useKycStatus: vi.fn(),
}));
vi.mock('../hooks/use-submit-kyc.js', () => ({
  useSubmitKyc: vi.fn(),
}));

// in beforeEach:
mockUseKycStatus.mockReturnValue({ data: undefined, isLoading: true });
mockUseSubmitKyc.mockReturnValue({ mutate: mockSubmitKyc, isPending: false, isError: false, error: null });
```

### Frontend: `packages/frontend/src/hooks/use-kyc-status.test.ts`

```
describe('useKycStatus')
  ✓ queryKey is ['kyc-status']
  ✓ staleTime is 30_000
  ✓ calls GET /api/v1/kyc/status via api client
```

Pattern: follows existing hook tests (if any) — test via `renderHook` from `@testing-library/react` with a `QueryClientProvider` wrapper.

### Frontend: `packages/frontend/src/hooks/use-submit-kyc.test.ts`

```
describe('useSubmitKyc')
  ✓ calls POST /api/v1/kyc/submit with { documentType }
  ✓ invalidates ['kyc-status'] query on success
```

### Frontend: `packages/frontend/src/pages/profile.test.tsx`

Update existing tests — add `useKycStatus` mock alongside existing `useCurrentUser` mock.

**Add to test file:**
```typescript
vi.mock('../hooks/use-kyc-status.js', () => ({
  useKycStatus: vi.fn(),
}));

import { useKycStatus } from '../hooks/use-kyc-status.js';
const mockUseKycStatus = vi.mocked(useKycStatus);

// in beforeEach — default to not_verified:
mockUseKycStatus.mockReturnValue({
  data: { data: { status: 'not_verified', verifiedAt: null } },
  isLoading: false,
  isError: false,
} as unknown as ReturnType<typeof useKycStatus>);
```

**Existing test to preserve (passes with not_verified default):**
- `'renders KYC status placeholder with link to /kyc'` — still passes because `not_verified` shows the existing text and link

**New tests to add:**
```
✓ shows "Identity verified." (with success colour) when KYC status is 'verified'
✓ shows "Verification pending review." when KYC status is 'pending'
✓ shows "Identity verification not yet started." and Start verification link when status is 'not_verified'
✓ shows "Identity verification not yet started." and Start verification link when useKycStatus returns undefined (loading/error)
```

---

## Section 15: Files Summary

### New backend files

| Path | Description |
|---|---|
| `packages/backend/src/kyc/domain/errors.ts` | `KycRequiredError`, `AlreadyVerifiedError` |
| `packages/backend/src/kyc/ports/kyc-adapter.ts` | `IKycAdapter`, `KycVerification`, `KycStatus`, `DocumentType`, `SubmitKycInput` |
| `packages/backend/src/kyc/adapters/stub/stub-kyc-adapter.ts` | `StubKycAdapter` — auto-approves via two-step DB transaction |
| `packages/backend/src/kyc/adapters/mock/mock-kyc-adapter.ts` | `MockKycAdapter` — in-memory, for tests only |
| `packages/backend/src/kyc/application/kyc-service.ts` | `KycService` — `getStatus`, `submitVerification`, `requireVerified` |
| `packages/backend/src/kyc/api/kyc-router.ts` | Express router: `GET /status`, `POST /submit` |
| `packages/backend/src/kyc/api/kyc-router.test.ts` | Integration tests (supertest + MockKycAdapter) |
| `packages/backend/src/kyc/adapters/stub/stub-kyc-adapter.test.ts` | Integration tests against live PostgreSQL |

### Modified backend files

| Path | Change |
|---|---|
| `packages/backend/src/account/api/api-router.ts` | Add `kycService: KycService` param; mount `createKycRouter(kycService)` at `/kyc` |
| `packages/backend/src/server.ts` | Import and wire `StubKycAdapter`, `KycService`; read `MOCK_KYC`; pass `kycService` to `createApiRouter` |
| `.env.example` | Add `MOCK_KYC=true` line |

### New frontend files

| Path | Description |
|---|---|
| `packages/frontend/src/types/kyc.ts` | `KycStatusResponse`, `KycSubmitResponse`, `KycStatusData` types |
| `packages/frontend/src/hooks/use-kyc-status.ts` | `useKycStatus()` — `useQuery` on `['kyc-status']` |
| `packages/frontend/src/hooks/use-submit-kyc.ts` | `useSubmitKyc()` — `useMutation`, invalidates `['kyc-status']` |
| `packages/frontend/src/hooks/use-kyc-status.test.ts` | Hook tests |
| `packages/frontend/src/hooks/use-submit-kyc.test.ts` | Hook tests |

### Modified frontend files

| Path | Change |
|---|---|
| `packages/frontend/src/pages/kyc-stub.tsx` | Full replacement — real KYC form and success state |
| `packages/frontend/src/pages/kyc-stub.test.tsx` | Full replacement — all existing tests replaced |
| `packages/frontend/src/pages/profile.tsx` | Import `useKycStatus`; replace hardcoded KYC section with dynamic status display |
| `packages/frontend/src/pages/profile.test.tsx` | Add `useKycStatus` mock; add status-variant tests |

### No changes required

| Path | Reason |
|---|---|
| `packages/frontend/src/App.tsx` | `/kyc` route already exists and points to `KycStubPage` — filename unchanged |
| `db/migrations/` | No new migration — `kyc_verifications` table already exists |

---

## Section 16: Edge Cases and Defined Behaviours

| # | Edge case | Defined behaviour |
|---|---|---|
| 1 | User calls `GET /api/v1/kyc/status` with no row in `kyc_verifications` | Returns 200 `{ data: { status: 'not_verified', verifiedAt: null } }`. No row is created. |
| 2 | User calls `POST /api/v1/kyc/submit` when already `verified` | Returns 409 `ALREADY_VERIFIED`. DB is not written to. The check happens before the transaction. |
| 3 | User calls `POST /api/v1/kyc/submit` from `pending` status | Treated as allowed re-submission (same as `not_verified`). Stub transitions to `verified` within the same transaction. `verifiedAt` is refreshed. |
| 4 | User calls `POST /api/v1/kyc/submit` from `pending_resubmission` status | Treated as allowed — stub proceeds and transitions to `verified`. |
| 5 | User calls `POST /api/v1/kyc/submit` with `documentType: 'drivers_license'` (US spelling, missing 'c') | Zod enum rejects it with 400 `VALIDATION_ERROR` before reaching the service layer. |
| 6 | User calls `POST /api/v1/kyc/submit` with extra unknown fields (e.g. `{ documentType: 'passport', session_id: 'abc' }`) | Zod `.strict()` rejects with 400 `VALIDATION_ERROR`. |
| 7 | Two concurrent `POST /api/v1/kyc/submit` requests for the same user | The `UNIQUE (user_id)` constraint and `ON CONFLICT DO UPDATE` upsert serialise writes at the DB level. The last write wins. Both requests will return `verified`. No application-level lock needed. |
| 8 | The DB transaction fails mid-way (e.g. pending write succeeds, verified write fails) | `ROLLBACK` is called in the catch block. The user remains in their pre-submission state (or `pending` if the upsert succeeded before the error). No partial `verified` state is left. |
| 9 | `useKycStatus()` is loading on the profile page | `kycStatus` falls back to `'not_verified'` via `kycData?.data.status ?? 'not_verified'`. The profile page shows the default "Identity verification not yet started." text. |
| 10 | `useKycStatus()` fails (API error) on the profile page | `data` is `undefined`; `kycStatus` falls back to `'not_verified'`. Same fallback as loading. The profile page does not crash. |
| 11 | `useKycStatus()` is loading on the KYC page | `LoadingSpinner` is shown. No form or success content is visible. |
| 12 | `requireVerified()` is called for a user with `status: 'pending'` | Throws `KycRequiredError` (status is not `'verified'`). Calling controller returns 403 `KYC_REQUIRED`. |
| 13 | `requireVerified()` is called for a user with no DB row | `getStatus` returns `{ status: 'not_verified' }`. `requireVerified` throws `KycRequiredError`. |
| 14 | `MOCK_KYC` env var is absent | `process.env.MOCK_KYC !== 'false'` evaluates to `true`. `StubKycAdapter` is used. |
| 15 | `MOCK_KYC=false` in env | Same code path — for feat-005 `StubKycAdapter` is still used since no real adapter exists. The flag is wired for future use. |
| 16 | KYC page is rendered when `status` is an unexpected value (e.g. `'locked'`, `'rejected'`) | Falls through to the form state (not the verified state). The user sees the document selector and submit button. If they submit, the stub will approve them. |
| 17 | `noUncheckedIndexedAccess` — accessing `result.rows[0]` in stub adapter | Always guard with a null check: `const row = result.rows[0]; if (!row) throw new Error(...)`. Never access `result.rows[0].field` directly. |

---

## Implementation Order

Implement in this sequence to avoid import errors:

1. `packages/backend/src/kyc/domain/errors.ts`
2. `packages/backend/src/kyc/ports/kyc-adapter.ts`
3. `packages/backend/src/kyc/adapters/mock/mock-kyc-adapter.ts`
4. `packages/backend/src/kyc/adapters/stub/stub-kyc-adapter.ts`
5. `packages/backend/src/kyc/application/kyc-service.ts`
6. `packages/backend/src/kyc/api/kyc-router.ts`
7. Modify `packages/backend/src/account/api/api-router.ts`
8. Modify `packages/backend/src/server.ts`
9. `packages/backend/src/kyc/api/kyc-router.test.ts`
10. `packages/backend/src/kyc/adapters/stub/stub-kyc-adapter.test.ts`
11. `packages/frontend/src/types/kyc.ts`
12. `packages/frontend/src/hooks/use-kyc-status.ts`
13. `packages/frontend/src/hooks/use-submit-kyc.ts`
14. Replace `packages/frontend/src/pages/kyc-stub.tsx`
15. Modify `packages/frontend/src/pages/profile.tsx`
16. Replace `packages/frontend/src/pages/kyc-stub.test.tsx`
17. Modify `packages/frontend/src/pages/profile.test.tsx`
18. Add hook test files
19. Add `MOCK_KYC=true` to `.env.example`
