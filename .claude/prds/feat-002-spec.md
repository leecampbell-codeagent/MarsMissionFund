# feat-002: Authentication and User Management — Technical Spec

**Feature ID:** feat-002
**Bounded Context:** Account
**Priority:** P0
**Dependencies:** feat-001 (infrastructure baseline)
**Status:** Ready for Implementation
**Date:** 2026-03-07

---

## 1. Overview

This feature delivers the identity foundation for Mars Mission Fund. It integrates Clerk as the authentication provider and establishes a local shadow user record in PostgreSQL keyed on `clerk_id`. Every other feature depends on this for access control.

**What is implemented (real, not theatre):**
- Clerk JWT middleware wired into Express — all routes except `/health` require a valid Clerk JWT
- Local `users` table with lazy-sync upsert on first authenticated request
- `User` domain entity with `create()` / `reconstitute()` factory methods
- RBAC roles stored as a `TEXT[]` column on `users`; `backer` assigned by default
- `GET /v1/me` — returns authenticated user profile, creates record on first call
- `PATCH /v1/me` — updates `display_name` and `bio`
- `GET /v1/me/roles` — returns current user's roles array
- `POST /v1/admin/users/:id/roles` — Administrator assigns/removes roles (not Super Administrator)
- Frontend: `ClerkProvider` wrapping, sign-in/sign-up pages, `ProtectedRoute`, API client with JWT injection

**What is out of scope (theatre or deferred):**
- Session elevation / MFA enforcement (Clerk handles session management transparently)
- Onboarding flow UI (feat-003)
- Full KYC verification flow (feat-007)
- SSO provider linking UI (Clerk handles transparently)
- Profile picture upload
- Account deletion / GDPR erasure workflow (P3)
- Data portability export (P3)

**Spec conflict notes:**
- The PRD (feat-002-auth-and-user-management.md) specifies `kyc_status` default `'not_verified'` and check constraint values aligned with the KYC domain lifecycle (`not_verified`, `pending`, `in_review`, `verified`, `failed`, `expired`). The spec task brief uses `'not_started'` and a shorter set. The research file (feat-002-research.md) aligns with the PRD values. L4-001 Section 8.1 references KYC lifecycle states (`Pending`, `In Review`, `Verified`, `Failed`, `Expired`) plus an initial state. The PRD is the higher-authority input; this spec uses the PRD values: `not_verified`, `pending`, `in_review`, `verified`, `failed`, `expired`.
- The PRD specifies `PATCH /v1/me` allows updating `display_name`, `bio`, and `avatar_url`. This spec includes `avatar_url` in the PATCH endpoint per the PRD.

---

## 2. Database Migration

**File:** `db/migrations/20260307120000_create_users.sql`

```sql
-- migrate:up

CREATE TABLE IF NOT EXISTS users (
    id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    clerk_id             VARCHAR(255) NOT NULL UNIQUE,
    email                VARCHAR(255) NOT NULL UNIQUE,
    display_name         VARCHAR(255),
    avatar_url           VARCHAR(500),
    bio                  TEXT,
    roles                TEXT[]       NOT NULL DEFAULT '{backer}',
    kyc_status           VARCHAR(50)  NOT NULL DEFAULT 'not_verified',
    onboarding_completed BOOLEAN      NOT NULL DEFAULT false,
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_users_kyc_status CHECK (
        kyc_status IN ('not_verified', 'pending', 'in_review', 'verified', 'failed', 'expired')
    )
);

CREATE INDEX idx_users_clerk_id ON users (clerk_id);
CREATE INDEX idx_users_email ON users (email);

-- update_updated_at_column() is defined in 20260305120000_add_updated_at_trigger.sql
-- Do NOT redefine it here.
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- migrate:down

DROP TABLE IF EXISTS users;
```

**Notes:**
- `update_updated_at_column()` function already exists from migration `20260305120000_add_updated_at_trigger.sql`. Do not redefine it.
- `roles` uses PostgreSQL `TEXT[]` with literal default `'{backer}'` (not `ARRAY['backer']` — the latter is not valid as a column default in PostgreSQL DDL).
- `kyc_status` values match the KYC domain lifecycle defined in L4-005 plus the initial `not_verified` state.
- `email` has a `UNIQUE` constraint because Clerk guarantees one account per verified email.
- No `BEGIN; ... COMMIT;` wrapper — dbmate wraps each migration in a transaction automatically.

---

## 3. Backend Domain Layer

### 3.1 `packages/backend/src/account/domain/Role.ts`

```typescript
export const Role = {
  Backer: 'backer',
  Creator: 'creator',
  Reviewer: 'reviewer',
  Administrator: 'administrator',
  SuperAdministrator: 'super_administrator',
} as const;

export type Role = (typeof Role)[keyof typeof Role];

export const ALL_ROLES: Role[] = Object.values(Role);

export const ADMIN_ROLES: Role[] = [
  Role.Reviewer,
  Role.Administrator,
  Role.SuperAdministrator,
];
```

**Rules:**
- Roles are stored as lowercase snake_case strings in the database array.
- `super_administrator` cannot be assigned through the standard role assignment endpoint (AC-ACCT-014).

### 3.2 `packages/backend/src/account/domain/KycStatus.ts`

```typescript
export const KycStatus = {
  NotVerified: 'not_verified',
  Pending: 'pending',
  InReview: 'in_review',
  Verified: 'verified',
  Failed: 'failed',
  Expired: 'expired',
} as const;

export type KycStatus = (typeof KycStatus)[keyof typeof KycStatus];
```

### 3.3 `packages/backend/src/account/domain/User.ts`

Entity with private constructor. All properties `readonly`. Two factory methods: `create()` validates inputs; `reconstitute()` skips validation (for DB hydration).

```typescript
import { Result } from '../../shared/domain/Result';
import { Role } from './Role';
import { KycStatus } from './KycStatus';

export interface UserProps {
  id: string;
  clerkId: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  roles: Role[];
  kycStatus: KycStatus;
  onboardingCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class User {
  readonly id: string;
  readonly clerkId: string;
  readonly email: string;
  readonly displayName: string | null;
  readonly avatarUrl: string | null;
  readonly bio: string | null;
  readonly roles: Role[];
  readonly kycStatus: KycStatus;
  readonly onboardingCompleted: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(props: UserProps) {
    this.id = props.id;
    this.clerkId = props.clerkId;
    this.email = props.email;
    this.displayName = props.displayName;
    this.avatarUrl = props.avatarUrl;
    this.bio = props.bio;
    this.roles = props.roles;
    this.kycStatus = props.kycStatus;
    this.onboardingCompleted = props.onboardingCompleted;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: {
    clerkId: string;
    email: string;
    displayName?: string | null;
    avatarUrl?: string | null;
    bio?: string | null;
  }): Result<User> {
    // Validation rules:
    // - clerkId must be a non-empty string
    // - email must match a basic email format
    // Returns Result.fail() with UserValidationError on invalid input
    // On success, returns Result.ok() with a new User with:
    //   - id: generated via crypto.randomUUID()
    //   - roles: [Role.Backer]
    //   - kycStatus: KycStatus.NotVerified
    //   - onboardingCompleted: false
    //   - createdAt / updatedAt: new Date()
  }

  static reconstitute(props: UserProps): User {
    return new User(props);
  }

  hasRole(role: Role): boolean {
    return this.roles.includes(role);
  }

  isAdmin(): boolean {
    return (
      this.hasRole(Role.Reviewer) ||
      this.hasRole(Role.Administrator) ||
      this.hasRole(Role.SuperAdministrator)
    );
  }
}
```

**Validation rules in `create()`:**
- `clerkId` must be a non-empty string (trim; reject empty or whitespace-only)
- `email` must pass a basic RFC 5321 format check (presence of `@` and a domain part is sufficient; Clerk already validates email format)
- Return `Result.fail(new UserValidationError(...))` if either check fails
- Never throws — always returns a `Result`

### 3.4 Domain Errors

**`packages/backend/src/account/domain/errors/UserNotFoundError.ts`**

```typescript
import { DomainError } from '../../../shared/domain/errors/DomainError';

export class UserNotFoundError extends DomainError {
  readonly code = 'USER_NOT_FOUND';

  constructor() {
    super('User not found.');
  }
}
```

**`packages/backend/src/account/domain/errors/UserAlreadyExistsError.ts`**

```typescript
import { DomainError } from '../../../shared/domain/errors/DomainError';

export class UserAlreadyExistsError extends DomainError {
  readonly code = 'USER_ALREADY_EXISTS';

  constructor() {
    super('A user with this identity already exists.');
  }
}
```

**`packages/backend/src/account/domain/errors/RoleAssignmentForbiddenError.ts`**

```typescript
import { DomainError } from '../../../shared/domain/errors/DomainError';

export class RoleAssignmentForbiddenError extends DomainError {
  readonly code = 'ROLE_ASSIGNMENT_FORBIDDEN';

  constructor() {
    super('You do not have permission to assign this role.');
  }
}
```

**`packages/backend/src/account/domain/errors/InvalidRoleError.ts`**

```typescript
import { DomainError } from '../../../shared/domain/errors/DomainError';

export class InvalidRoleError extends DomainError {
  readonly code = 'INVALID_ROLE';

  constructor(role: string) {
    super(`'${role}' is not a valid role.`);
  }
}
```

**`packages/backend/src/account/domain/errors/SuperAdminAssignmentRestrictedError.ts`**

```typescript
import { DomainError } from '../../../shared/domain/errors/DomainError';

export class SuperAdminAssignmentRestrictedError extends DomainError {
  readonly code = 'SUPER_ADMIN_ASSIGNMENT_RESTRICTED';

  constructor() {
    super('Super Administrator role cannot be assigned through this endpoint.');
  }
}
```

**`packages/backend/src/account/domain/errors/UserValidationError.ts`**

```typescript
import { DomainError } from '../../../shared/domain/errors/DomainError';

export class UserValidationError extends DomainError {
  readonly code = 'USER_VALIDATION_ERROR';

  constructor(message: string) {
    super(message);
  }
}
```

---

## 4. Backend Ports

### 4.1 `packages/backend/src/account/ports/UserRepository.ts`

```typescript
import { User } from '../domain/User';

export interface UserRepository {
  findByClerkId(clerkId: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  upsert(user: User): Promise<User>;
  updateProfile(
    id: string,
    fields: { displayName?: string | null; bio?: string | null; avatarUrl?: string | null }
  ): Promise<User | null>;
  updateRoles(id: string, roles: string[]): Promise<User | null>;
}
```

### 4.2 `packages/backend/src/shared/ports/AuthPort.ts`

```typescript
import type { Request, RequestHandler } from 'express';

export interface AuthContext {
  clerkUserId: string;
}

export interface AuthPort {
  /**
   * Extracts auth context from an Express request after middleware has run.
   * Returns null if not authenticated.
   */
  getAuthContext(req: Request): AuthContext | null;

  /**
   * Returns an Express middleware that rejects unauthenticated requests with 401.
   */
  requireAuthMiddleware(): RequestHandler;

  /**
   * Returns an Express middleware that populates auth context on the request.
   * Does NOT reject unauthenticated requests.
   */
  globalMiddleware(): RequestHandler;
}
```

---

## 5. Backend Adapters

### 5.1 `packages/backend/src/shared/adapters/auth/ClerkAuthAdapter.ts`

Wraps `@clerk/express` v1.x. Implements `AuthPort`.

```typescript
import { clerkMiddleware, requireAuth, getAuth } from '@clerk/express';
import type { Request, RequestHandler } from 'express';
import type { AuthPort, AuthContext } from '../../ports/AuthPort';

export class ClerkAuthAdapter implements AuthPort {
  getAuthContext(req: Request): AuthContext | null {
    const auth = getAuth(req);
    if (!auth.userId) return null;
    return { clerkUserId: auth.userId };
  }

  requireAuthMiddleware(): RequestHandler {
    return requireAuth();
  }

  globalMiddleware(): RequestHandler {
    return clerkMiddleware();
  }
}
```

**Important:** `clerkMiddleware()` populates `req.auth` but does NOT reject unauthenticated requests. `requireAuth()` rejects with 401. Use `clerkMiddleware()` globally and `requireAuth()` only on protected route groups.

### 5.2 `packages/backend/src/shared/adapters/auth/MockAuthAdapter.ts`

Used when `MOCK_AUTH=true`. Implements `AuthPort`. Bypasses all JWT verification.

```typescript
import type { Request, RequestHandler } from 'express';
import type { AuthPort, AuthContext } from '../../ports/AuthPort';

export const MOCK_CLERK_USER_ID = 'mock_user_clerk_id';

export class MockAuthAdapter implements AuthPort {
  getAuthContext(_req: Request): AuthContext {
    return { clerkUserId: MOCK_CLERK_USER_ID };
  }

  requireAuthMiddleware(): RequestHandler {
    return (_req, _res, next) => next();
  }

  globalMiddleware(): RequestHandler {
    return (req, _res, next) => {
      // Attach a compatible auth object so getAuth(req) works if called
      (req as Request & { auth: AuthContext }).auth = { clerkUserId: MOCK_CLERK_USER_ID };
      next();
    };
  }
}
```

**Note:** When `MOCK_AUTH=true`, do not call `clerkMiddleware()` or `requireAuth()` from Clerk — they will attempt real JWT validation. The `MockAuthAdapter` replaces both.

### 5.3 `packages/backend/src/account/adapters/UserRepositoryPg.ts`

Implements `UserRepository` using the shared `pool` singleton from `packages/backend/src/shared/adapters/db/pool.ts`.

```typescript
import { Pool } from 'pg';
import type { UserRepository } from '../ports/UserRepository';
import { User } from '../domain/User';
import type { Role } from '../domain/Role';
import type { KycStatus } from '../domain/KycStatus';

export class UserRepositoryPg implements UserRepository {
  constructor(private readonly pool: Pool) {}

  async findByClerkId(clerkId: string): Promise<User | null> {
    // SELECT * FROM users WHERE clerk_id = $1
    // Map row to User.reconstitute(...)
    // Return null if no row found
  }

  async findById(id: string): Promise<User | null> {
    // SELECT * FROM users WHERE id = $1
    // Map row to User.reconstitute(...)
    // Return null if no row found
  }

  async upsert(user: User): Promise<User> {
    // INSERT INTO users (id, clerk_id, email, display_name, avatar_url, bio, roles,
    //   kyc_status, onboarding_completed, created_at, updated_at)
    // VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    // ON CONFLICT (clerk_id) DO UPDATE SET
    //   email = EXCLUDED.email,
    //   updated_at = NOW()
    // RETURNING *
    // Map returned row to User.reconstitute(...)
  }

  async updateProfile(
    id: string,
    fields: { displayName?: string | null; bio?: string | null; avatarUrl?: string | null }
  ): Promise<User | null> {
    // Build dynamic SET clause from provided fields using parameterised values
    // UPDATE users SET <dynamic fields>, updated_at = NOW() WHERE id = $N RETURNING *
    // Return null if no row updated (user not found)
  }

  async updateRoles(id: string, roles: string[]): Promise<User | null> {
    // UPDATE users SET roles = $1, updated_at = NOW() WHERE id = $2 RETURNING *
    // Return null if no row updated
  }
}
```

**Row mapping helper (private):**
```typescript
private mapRow(row: Record<string, unknown>): User {
  return User.reconstitute({
    id: row.id as string,
    clerkId: row.clerk_id as string,
    email: row.email as string,
    displayName: (row.display_name as string | null) ?? null,
    avatarUrl: (row.avatar_url as string | null) ?? null,
    bio: (row.bio as string | null) ?? null,
    roles: row.roles as Role[],
    kycStatus: row.kyc_status as KycStatus,
    onboardingCompleted: row.onboarding_completed as boolean,
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
  });
}
```

**Constraints:**
- Parameterised queries only — no string interpolation in query construction.
- `upsert()` updates only `email` and `updated_at` on conflict — it does not overwrite roles, kyc_status, or onboarding_completed.
- `updateProfile()` must only update the fields that are explicitly passed (partial update). Build the SET clause dynamically but safely using parameterised values.

---

## 6. Backend Application Services

### 6.1 `packages/backend/src/account/application/GetOrCreateUserService.ts`

```typescript
import type { UserRepository } from '../ports/UserRepository';
import { User } from '../domain/User';

export class GetOrCreateUserService {
  constructor(private readonly userRepo: UserRepository) {}

  async execute(clerkId: string, email: string): Promise<User> {
    const existing = await this.userRepo.findByClerkId(clerkId);
    if (existing) return existing;

    const result = User.create({ clerkId, email });
    if (result.isFailure) {
      throw result.error;
    }

    return await this.userRepo.upsert(result.value);
  }
}
```

**Behaviour:**
- Tries `findByClerkId` first.
- If not found: calls `User.create()`, then `userRepo.upsert()`.
- `upsert()` uses `ON CONFLICT (clerk_id) DO UPDATE` — safe against race conditions on concurrent first-login requests.
- The `email` value comes from the Clerk JWT session claims (`req.auth.sessionClaims?.email` after `clerkMiddleware()` runs). This is the authoritative source for email at sync time.

### 6.2 `packages/backend/src/account/application/UpdateUserProfileService.ts`

```typescript
import type { UserRepository } from '../ports/UserRepository';
import { User } from '../domain/User';
import { UserNotFoundError } from '../domain/errors/UserNotFoundError';

export class UpdateUserProfileService {
  constructor(private readonly userRepo: UserRepository) {}

  async execute(
    userId: string,
    fields: { displayName?: string | null; bio?: string | null; avatarUrl?: string | null }
  ): Promise<User> {
    const updated = await this.userRepo.updateProfile(userId, fields);
    if (!updated) throw new UserNotFoundError();
    return updated;
  }
}
```

### 6.3 `packages/backend/src/account/application/AssignRolesService.ts`

```typescript
import type { UserRepository } from '../ports/UserRepository';
import { User } from '../domain/User';
import { Role, ALL_ROLES } from '../domain/Role';
import { UserNotFoundError } from '../domain/errors/UserNotFoundError';
import { RoleAssignmentForbiddenError } from '../domain/errors/RoleAssignmentForbiddenError';
import { InvalidRoleError } from '../domain/errors/InvalidRoleError';
import { SuperAdminAssignmentRestrictedError } from '../domain/errors/SuperAdminAssignmentRestrictedError';

export class AssignRolesService {
  constructor(private readonly userRepo: UserRepository) {}

  async execute(
    actorUser: User,
    targetUserId: string,
    newRoles: string[]
  ): Promise<User> {
    // 1. Actor must have Administrator role
    if (!actorUser.hasRole(Role.Administrator)) {
      throw new RoleAssignmentForbiddenError();
    }

    // 2. Validate all requested roles are known values
    for (const role of newRoles) {
      if (!ALL_ROLES.includes(role as Role)) {
        throw new InvalidRoleError(role);
      }
    }

    // 3. Super Administrator cannot be assigned through this endpoint (AC-ACCT-014)
    if (newRoles.includes(Role.SuperAdministrator)) {
      throw new SuperAdminAssignmentRestrictedError();
    }

    // 4. Apply role update
    const updated = await this.userRepo.updateRoles(targetUserId, newRoles);
    if (!updated) throw new UserNotFoundError();
    return updated;
  }
}
```

---

## 7. Backend API Layer

### 7.1 `packages/backend/src/account/api/account.schemas.ts`

```typescript
import { z } from 'zod';

export const patchMeSchema = z.object({
  display_name: z.string().max(255).nullable().optional(),
  bio: z.string().nullable().optional(),
  avatar_url: z.string().url().max(500).nullable().optional(),
});

export type PatchMeBody = z.infer<typeof patchMeSchema>;

export const assignRolesSchema = z.object({
  roles: z.array(z.string()).min(1),
});

export type AssignRolesBody = z.infer<typeof assignRolesSchema>;
```

### 7.2 `packages/backend/src/account/api/account.router.ts`

Routes:

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/v1/me` | Required | Get or create authenticated user's profile |
| `PATCH` | `/v1/me` | Required | Update display_name, bio, avatar_url |
| `GET` | `/v1/me/roles` | Required | Get current user's roles array |
| `POST` | `/v1/admin/users/:id/roles` | Required + Administrator | Assign roles to a user |

**Controller logic for `GET /v1/me`:**
1. Extract `clerkUserId` from auth context via `authPort.getAuthContext(req)`.
2. Extract `email` from Clerk session claims: `getAuth(req).sessionClaims?.email` (cast to string; fall back to empty string if absent — Clerk guarantees email is present for verified accounts).
3. Call `GetOrCreateUserService.execute(clerkUserId, email)`.
4. Serialize and return the user profile response (see Section 7.3).

**Controller logic for `PATCH /v1/me`:**
1. Validate request body against `patchMeSchema` — return 400 on validation failure.
2. Extract `clerkUserId` from auth context.
3. Load user via `userRepo.findByClerkId(clerkUserId)` — return 404 if not found (should not happen in normal flow).
4. Call `UpdateUserProfileService.execute(user.id, { displayName, bio, avatarUrl })`.
5. Return updated profile.

**Controller logic for `GET /v1/me/roles`:**
1. Extract `clerkUserId` from auth context.
2. Load user via `userRepo.findByClerkId(clerkUserId)`.
3. Return `{ roles: user.roles }`.

**Controller logic for `POST /v1/admin/users/:id/roles`:**
1. Validate body against `assignRolesSchema`.
2. Load actor user via `findByClerkId(clerkUserId)`.
3. Call `AssignRolesService.execute(actorUser, req.params.id, body.roles)`.
4. Return updated target user profile.
5. Role changes must be logged (use Pino logger with structured fields: actor_id, target_id, new_roles, timestamp).

**Error mapping:**
| Domain Error Code | HTTP Status |
|---|---|
| `USER_NOT_FOUND` | 404 |
| `USER_ALREADY_EXISTS` | 409 |
| `ROLE_ASSIGNMENT_FORBIDDEN` | 403 |
| `INVALID_ROLE` | 400 |
| `SUPER_ADMIN_ASSIGNMENT_RESTRICTED` | 403 |
| `USER_VALIDATION_ERROR` | 400 |
| Any unhandled error | 500 |

### 7.3 API Response Shape

**User profile response** (returned by `GET /v1/me`, `PATCH /v1/me`, and `POST /v1/admin/users/:id/roles`):

```typescript
{
  id: string,              // Internal UUID — NOT clerk_id
  email: string,
  displayName: string | null,
  avatarUrl: string | null,
  bio: string | null,
  roles: string[],
  kycStatus: string,
  onboardingCompleted: boolean
}
```

`clerk_id` is NEVER returned in any API response. It is an internal join key only.

**Roles response** (returned by `GET /v1/me/roles`):
```typescript
{
  roles: string[]
}
```

**Error response format** (per L3-001, Section 6.1):
```json
{
  "error": {
    "code": "USER_NOT_FOUND",
    "message": "User not found.",
    "correlation_id": "<request correlation ID>"
  }
}
```

---

## 8. Server.ts Updates

The following changes are required to `packages/backend/src/server.ts`:

1. **Auth adapter selection** based on `process.env.MOCK_AUTH`:

```typescript
import { ClerkAuthAdapter } from './shared/adapters/auth/ClerkAuthAdapter';
import { MockAuthAdapter } from './shared/adapters/auth/MockAuthAdapter';
import type { AuthPort } from './shared/ports/AuthPort';

const authAdapter: AuthPort =
  process.env.MOCK_AUTH === 'true'
    ? new MockAuthAdapter()
    : new ClerkAuthAdapter();
```

2. **Global middleware** — register before all routes:

```typescript
app.use(authAdapter.globalMiddleware());
```

3. **Health check** — mount before auth-protected routes:

```typescript
app.get('/health', (_req, res) => { res.json({ status: 'ok' }); });
```

4. **Protected route group** — all `/v1` routes require auth:

```typescript
const v1Router = express.Router();
v1Router.use(authAdapter.requireAuthMiddleware());
// Mount sub-routers
v1Router.use(accountRouter);
app.use('/v1', v1Router);
```

5. **Dependency wiring** — construct and inject dependencies:

```typescript
import { pool } from './shared/adapters/db/pool';
import { UserRepositoryPg } from './account/adapters/UserRepositoryPg';
import { GetOrCreateUserService } from './account/application/GetOrCreateUserService';
import { UpdateUserProfileService } from './account/application/UpdateUserProfileService';
import { AssignRolesService } from './account/application/AssignRolesService';
import { createAccountRouter } from './account/api/account.router';

const userRepo = new UserRepositoryPg(pool);
const getOrCreateUserService = new GetOrCreateUserService(userRepo);
const updateUserProfileService = new UpdateUserProfileService(userRepo);
const assignRolesService = new AssignRolesService(userRepo);

const accountRouter = createAccountRouter({
  authAdapter,
  userRepo,
  getOrCreateUserService,
  updateUserProfileService,
  assignRolesService,
});
```

---

## 9. Frontend Layer

### 9.1 `packages/frontend/src/main.tsx`

Wrap the app in `ClerkProvider` before `App` renders:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ClerkProvider } from '@clerk/react';
import App from './App';
import './styles/global.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');

createRoot(rootElement).render(
  <StrictMode>
    <ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}>
      <App />
    </ClerkProvider>
  </StrictMode>
);
```

`VITE_CLERK_PUBLISHABLE_KEY` is already documented in `.env.example`.

### 9.2 `packages/frontend/src/api/client.ts`

Centralised fetch wrapper that injects the Clerk JWT as a Bearer token. Must be used for all API calls.

```typescript
// Returns a configured fetch function bound to the provided getToken function.
// Usage: const apiClient = createApiClient(getToken);
//        const user = await apiClient('/v1/me');

export interface ApiClient {
  get<T>(path: string): Promise<T>;
  patch<T>(path: string, body: unknown): Promise<T>;
  post<T>(path: string, body: unknown): Promise<T>;
}

export function createApiClient(
  getToken: () => Promise<string | null>
): ApiClient {
  const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001';

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await getToken();
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new ApiError(response.status, error?.error?.code, error?.error?.message);
    }
    return response.json() as Promise<T>;
  }

  return {
    get: <T>(path: string) => request<T>(path),
    patch: <T>(path: string, body: unknown) =>
      request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
    post: <T>(path: string, body: unknown) =>
      request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  };
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string | undefined,
    message: string | undefined
  ) {
    super(message ?? `HTTP ${status}`);
    this.name = 'ApiError';
  }
}
```

`VITE_API_BASE_URL` should be added to `.env.example` with value `http://localhost:3001`.

### 9.3 `packages/frontend/src/hooks/useCurrentUser.ts`

```typescript
import { useAuth } from '@clerk/react';
import { useQuery } from '@tanstack/react-query';
import { createApiClient } from '../api/client';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  roles: string[];
  kycStatus: string;
  onboardingCompleted: boolean;
}

export function useCurrentUser() {
  const { isSignedIn, getToken } = useAuth();
  const apiClient = createApiClient(getToken);

  return useQuery<UserProfile>({
    queryKey: ['currentUser'],
    queryFn: () => apiClient.get<UserProfile>('/v1/me'),
    enabled: isSignedIn === true,
    staleTime: 5 * 60 * 1000, // 5 minutes — aligns with Clerk access token lifetime
  });
}
```

The `useCurrentUser` hook is the primary way to access the authenticated user's local profile throughout the app. It is backed by TanStack Query and re-fetches when the query is stale.

### 9.4 `packages/frontend/src/components/auth/ProtectedRoute.tsx`

```tsx
import { useAuth } from '@clerk/react';
import { Navigate } from 'react-router';

interface ProtectedRouteProps {
  readonly children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    // Use a semantic loading indicator respecting the design system
    // See specs/standards/brand.md for motion tokens
    return <div aria-busy="true" aria-label="Loading..." />;
  }

  if (!isSignedIn) {
    return <Navigate to="/sign-in" replace />;
  }

  return <>{children}</>;
}
```

### 9.5 `packages/frontend/src/pages/SignInPage.tsx`

```tsx
import { SignIn } from '@clerk/react';

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignIn routing="path" path="/sign-in" />
    </div>
  );
}
```

### 9.6 `packages/frontend/src/pages/SignUpPage.tsx`

```tsx
import { SignUp } from '@clerk/react';

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignUp routing="path" path="/sign-up" />
    </div>
  );
}
```

### 9.7 `packages/frontend/src/App.tsx` — Router Updates

Add routes for auth pages and protect the application routes:

```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import SignInPage from './pages/SignInPage';
import SignUpPage from './pages/SignUpPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/sign-in/*" element={<SignInPage />} />
        <Route path="/sign-up/*" element={<SignUpPage />} />

        {/* Protected routes */}
        <Route
          path="/home"
          element={
            <ProtectedRoute>
              {/* HomePage placeholder — feat-003 onwards */}
              <div>Home</div>
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              {/* Dashboard placeholder */}
              <div>Dashboard</div>
            </ProtectedRoute>
          }
        />

        {/* Root redirect */}
        <Route path="/" element={<Navigate to="/home" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
```

`/sign-in/*` and `/sign-up/*` use wildcard routes because Clerk's `<SignIn>` / `<SignUp>` components handle their own internal sub-routing (e.g., `/sign-in/factor-one`, `/sign-in/factor-two`).

---

## 10. Tests

### 10.1 Backend Unit Tests

**`packages/backend/src/account/domain/User.test.ts`**

Test cases:
- `create()` with valid inputs returns a `Result.ok` with a `User` having default `backer` role, `not_verified` kyc_status, `onboardingCompleted: false`
- `create()` with empty `clerkId` returns `Result.fail`
- `create()` with invalid email format returns `Result.fail`
- `reconstitute()` returns a `User` without validation (accepts any inputs)
- `hasRole()` returns `true` for an assigned role and `false` for an unassigned role
- `isAdmin()` returns `true` for Reviewer, Administrator, SuperAdministrator; `false` for Backer and Creator

**`packages/backend/src/account/application/GetOrCreateUserService.test.ts`**

Uses mock `UserRepository`. Test cases:
- Returns existing user when `findByClerkId` returns a user
- Creates and returns new user when `findByClerkId` returns null
- Propagates domain error when `User.create()` fails

**`packages/backend/src/account/application/AssignRolesService.test.ts`**

Uses mock `UserRepository`. Test cases:
- Throws `RoleAssignmentForbiddenError` when actor does not have Administrator role
- Throws `InvalidRoleError` for an unrecognised role string
- Throws `SuperAdminAssignmentRestrictedError` when `super_administrator` is in the roles list
- Updates roles successfully when actor is Administrator and roles are valid
- Throws `UserNotFoundError` when target user does not exist

### 10.2 Backend Integration Tests

**`packages/backend/src/account/adapters/UserRepositoryPg.test.ts`**

Integration test using the real PostgreSQL pool (requires `DATABASE_URL` in environment). Tests:
- `upsert()` creates a new user record
- `upsert()` with an existing `clerk_id` updates `email` only — does not overwrite `roles`
- `findByClerkId()` returns the correct user
- `findById()` returns the correct user
- `updateProfile()` updates only the provided fields
- `updateRoles()` replaces the roles array

**`packages/backend/src/account/api/account.router.test.ts`**

SuperTest integration tests with `MOCK_AUTH=true`. Tests:
- `GET /v1/me` with no auth token → 401 (when using real Clerk adapter; skip for mock)
- `GET /v1/me` creates user record on first call and returns profile without `clerk_id`
- `GET /v1/me` returns existing user on subsequent calls
- `PATCH /v1/me` with valid body → 200, updated profile returned
- `PATCH /v1/me` with invalid body (e.g., `avatar_url` not a valid URL) → 400
- `GET /v1/me/roles` returns the user's roles array
- `POST /v1/admin/users/:id/roles` with non-administrator actor → 403
- `POST /v1/admin/users/:id/roles` with `super_administrator` in roles list → 403
- `POST /v1/admin/users/:id/roles` with unknown role → 400
- `POST /v1/admin/users/:id/roles` with valid request by Administrator → 200

### 10.3 Frontend Tests

**`packages/frontend/src/components/auth/ProtectedRoute.test.tsx`**

Uses `@testing-library/react` with mocked `@clerk/react`:
- Renders a loading indicator when `isLoaded` is `false`
- Redirects to `/sign-in` when `isLoaded` is `true` and `isSignedIn` is `false`
- Renders children when `isLoaded` is `true` and `isSignedIn` is `true`

**`packages/frontend/src/hooks/useCurrentUser.test.ts`**

Uses MSW to intercept `GET /v1/me`. Tests:
- Returns `isLoading: true` initially
- Returns user data after successful response
- Returns error state on API failure
- Does not fetch when `isSignedIn` is `false`

---

## 11. Environment Variables

No new environment variables are required. The following are already documented in `.env.example`:

| Variable | Used By | Purpose |
|---|---|---|
| `CLERK_SECRET_KEY` | Backend | Clerk server-side secret for JWT validation |
| `VITE_CLERK_PUBLISHABLE_KEY` | Frontend | Clerk publishable key for `ClerkProvider` |
| `MOCK_AUTH` | Backend | Set to `true` to bypass Clerk JWT verification (dev/test) |

One addition to `.env.example` is needed:

| Variable | Value | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:3001` | Base URL for frontend API client |

---

## 12. Acceptance Criteria

- [ ] `GET /v1/me` returns 401 without a valid auth token (using real Clerk adapter)
- [ ] `GET /v1/me` creates a new user record on first call with `backer` role and `not_verified` kyc_status
- [ ] `GET /v1/me` returns the existing record on subsequent calls (upsert is idempotent)
- [ ] `PATCH /v1/me` updates `display_name`, `bio`, and `avatar_url`; ignores any other fields in the request body
- [ ] `GET /v1/me/roles` returns the authenticated user's roles array
- [ ] `POST /v1/admin/users/:id/roles` assigns roles when the actor is an Administrator
- [ ] `POST /v1/admin/users/:id/roles` returns 403 when actor is not an Administrator
- [ ] `POST /v1/admin/users/:id/roles` returns 403 when `super_administrator` is in the requested roles
- [ ] `clerk_id` never appears in any API response
- [ ] Users have `backer` role by default on creation
- [ ] All error responses follow the format: `{ error: { code, message, correlation_id } }`
- [ ] Domain errors extend `DomainError` with unique `code` values
- [ ] Frontend renders Clerk's Sign In page at `/sign-in`
- [ ] Frontend renders Clerk's Sign Up page at `/sign-up`
- [ ] Authenticated users can access protected routes; unauthenticated users are redirected to `/sign-in`
- [ ] `ClerkProvider` wraps the React app in `main.tsx`
- [ ] `GET /v1/me` is called on app load via `useCurrentUser` hook when user is signed in
- [ ] All tests pass with `MOCK_AUTH=true`
- [ ] Unit test coverage ≥ 90% on `User` entity and application services
- [ ] No `console.log` in committed code — use Pino logger
- [ ] No `any` types in new TypeScript code
- [ ] `npm run build` succeeds with no TypeScript errors
- [ ] Biome lint passes with no errors

---

## 13. Out of Scope

- Role assignment UI (administrators set roles directly in DB or via the admin API for the demo)
- SSO provider linking UI (Clerk handles OAuth transparently)
- MFA configuration UI
- Profile picture upload (file upload validation and S3 integration deferred)
- Account deletion / GDPR erasure workflow (P3)
- Data portability export (P3)
- Session management UI (session list, revocation)
- Onboarding flow UI (feat-003)
- Full KYC verification flow (feat-007)
- Clerk webhook integration for user sync (lazy sync on first API call is sufficient for the demo)

---

## 14. Implementation Notes and Gotchas

1. **`requireAuth()` vs `clerkMiddleware()`:** `clerkMiddleware()` must run globally (populates context but does not reject). `requireAuth()` rejects unauthenticated requests. When `MOCK_AUTH=true`, neither should be called — use `MockAuthAdapter` for both.

2. **Email from JWT claims:** Use `getAuth(req).sessionClaims?.email` (after `clerkMiddleware()` has run) to get the email for upsert. Do not call the Clerk backend API for this — JWT claims are sufficient.

3. **`roles` array PostgreSQL default:** Use `'{backer}'` (PostgreSQL array literal syntax) as the column default, not `ARRAY['backer']` — the latter is invalid in a `CREATE TABLE` default clause.

4. **Migration timestamp ordering:** The migration `20260307120000_create_users.sql` must come after `20260305120000_add_updated_at_trigger.sql`. The trigger function `update_updated_at_column()` must exist before the `CREATE TRIGGER` statement runs.

5. **`super_administrator` database seeding:** For the local demo, Super Administrator accounts are seeded directly in the database. The API enforces that `super_administrator` cannot be assigned through `POST /v1/admin/users/:id/roles`.

6. **Frontend wildcard routes:** Clerk's `<SignIn routing="path" path="/sign-in" />` component handles sub-routes internally. The React Router route must be `/sign-in/*` (with wildcard) to allow Clerk's internal routing to work (e.g., `/sign-in/factor-one`).

7. **`VITE_` prefix:** Environment variables consumed by Vite's frontend build must be prefixed with `VITE_`. The backend `MOCK_AUTH` and `CLERK_SECRET_KEY` are not exposed to the frontend.

8. **`onboarding_completed` flag:** This field is set to `false` on user creation and is used by the frontend to determine whether to show the onboarding flow (feat-003). The API does not provide an endpoint to set this flag — that will be added in feat-003.

9. **Biome `useSemanticElements` rule:** When rendering loading states in `ProtectedRoute`, use `<output>` (which has `role="status"` natively) or `aria-busy` on a block element rather than `<div role="status">` — Biome will flag the latter.

10. **`@clerk/express` v1 API only:** Use `clerkMiddleware`, `getAuth`, `requireAuth` from `@clerk/express`. Do not use the deprecated `ClerkExpressRequireAuth` from v0.
