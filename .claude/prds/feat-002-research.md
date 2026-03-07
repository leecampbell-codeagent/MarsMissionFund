# feat-002: Authentication — Research

## Clerk Express Middleware Pattern

`@clerk/express` v1.x is already installed in `packages/backend/package.json`. The package exposes:

- `clerkMiddleware()` — global middleware that processes the Clerk session token from incoming requests. Must be registered **before** any route that needs auth. It does not reject requests; it populates auth context on the request object.
- `requireAuth()` — middleware that rejects unauthenticated requests with 401. Use this on protected routes.
- `getAuth(req)` — utility to extract the auth object from the Express request. Returns `{ userId, sessionId, orgId, ... }`. The `userId` field is the Clerk user ID (string, e.g. `user_2abc...`).

Pattern in `server.ts`:

```ts
import { clerkMiddleware, requireAuth, getAuth } from '@clerk/express';

app.use(clerkMiddleware());
// Health check stays before requireAuth
app.get('/health', ...);
// Protected routes
app.use('/v1', requireAuth(), v1Router);
```

In a controller:

```ts
const { userId } = getAuth(req);
// userId is the clerk_id — map to internal user via repo
```

TypeScript augmentation: `@clerk/express` extends Express's `Request` type — `req.auth` is available and typed as `AuthObject` after `clerkMiddleware()` runs. No manual type declaration needed.

## User Sync Strategy

**Lazy sync on first authenticated request is the correct approach for this feature.**

The PRD's AC for `GET /v1/me` specifies: "creates the user record on first login (upsert by `clerk_id`)". This means:

1. User authenticates via Clerk (frontend).
2. Frontend calls `GET /v1/me` with the JWT.
3. Backend middleware verifies JWT, extracts `userId` (Clerk ID).
4. Application service does `INSERT ... ON CONFLICT (clerk_id) DO UPDATE` (upsert).
5. Returns the local user record.

**Webhook approach is out of scope for feat-002.** The `.env.example` has `CLERK_WEBHOOK_SIGNING_SECRET` present but it is for future use. Webhooks require a public endpoint; for local demo, lazy sync is sufficient and simpler. Webhooks are theatre for this scope.

The upsert should pull `email` and optionally `firstName`/`lastName` from the Clerk JWT claims (standard OIDC claims are present in the JWT: `email`, `given_name`, `family_name`). Alternatively, call the Clerk backend API using `@clerk/express`'s `clerkClient` to fetch user details at sync time — but JWT claims are sufficient for `email`.

## Database Schema

Migration file: `db/migrations/20260307HHMMSS_create_users_table.sql`

The PRD acceptance criteria specify the exact columns:

```sql
-- migrate:up
CREATE TABLE IF NOT EXISTS users (
    id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    clerk_id         VARCHAR(255) NOT NULL UNIQUE,
    email            VARCHAR(255) NOT NULL UNIQUE,
    display_name     VARCHAR(255),
    avatar_url       VARCHAR(500),
    bio              TEXT,
    roles            TEXT[]       NOT NULL DEFAULT '{backer}',
    kyc_status       VARCHAR(50)  NOT NULL DEFAULT 'not_verified',
    onboarding_completed BOOLEAN  NOT NULL DEFAULT false,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_clerk_id ON users(clerk_id);
CREATE INDEX idx_users_email ON users(email);

ALTER TABLE users ADD CONSTRAINT chk_users_kyc_status
    CHECK (kyc_status IN ('not_verified', 'pending', 'in_review', 'verified', 'failed', 'expired'));

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- migrate:down
DROP TABLE IF EXISTS users;
```

Key notes:
- `update_updated_at_column()` function already exists from migration `20260305120000_add_updated_at_trigger.sql` — do NOT redefine it.
- `roles` is `TEXT[]` per PRD decision ("PostgreSQL text array for simplicity at this stage").
- `kyc_status` values must align with the KYC domain lifecycle defined in L4-005 (Pending, In Review, Verified, Failed, Expired) plus the initial `not_verified` state.
- The template in `.template.sql` references `accounts(id)` for the FK — for the users table itself there is no parent FK; other tables will reference `users(id)`.

## RBAC Design

**Roles stored as `TEXT[]` on the users table** — this is explicitly decided in the PRD ("Key Decisions" section).

The five roles from L4-001 and L3-002: `backer`, `creator`, `reviewer`, `administrator`, `super_administrator`.

Storage format: lowercase snake_case strings in the array, e.g. `{backer}`, `{backer,creator}`.

**Enforcement pattern:**

1. Clerk JWT does NOT carry MMF roles — roles live only in the local `users` table.
2. After auth middleware extracts `clerk_id`, the application service loads the local user record (which includes `roles`).
3. A role-guard middleware or helper checks `user.roles.includes('administrator')` before proceeding.
4. The `POST /v1/admin/users/:id/roles` endpoint requires the calling user to have `administrator` role — enforced at the controller layer.
5. Domain rule: `super_administrator` cannot be assigned through the standard UI (AC-ACCT-014 in L4-001).

**Role check helper pattern (in application service / controller):**

```ts
function requireRole(user: User, role: string): void {
  if (!user.roles.includes(role)) {
    throw new RoleAssignmentForbiddenError(); // extends DomainError
  }
}
```

## Mock Auth Pattern

`MOCK_AUTH=true` is present in `.env.example`. The pattern should be:

1. Create an `AuthPort` interface in `packages/backend/src/shared/ports/` (or `account/ports/`).
2. Create a real `ClerkAuthAdapter` that calls `clerkMiddleware()` + `getAuth()`.
3. Create a `MockAuthAdapter` that bypasses JWT verification and injects a fixed test user context.
4. In `server.ts`, select the adapter based on `process.env.MOCK_AUTH === 'true'`.

**Concrete mock middleware pattern:**

```ts
// MockAuthMiddleware — for MOCK_AUTH=true
export function mockAuthMiddleware(req: Request, _res: Response, next: NextFunction) {
  (req as AuthenticatedRequest).auth = {
    userId: 'mock_user_clerk_id',
    // other fields as needed
  };
  next();
}
```

Integration tests that need auth can set `MOCK_AUTH=true` or inject a test-specific middleware. For API integration tests using SuperTest, the pattern is to set `MOCK_AUTH=true` in the test environment and rely on the mock adapter.

**Important:** `requireAuth()` from `@clerk/express` will still check for a real Clerk token even if `clerkMiddleware()` is bypassed. When `MOCK_AUTH=true`, skip both `clerkMiddleware()` and `requireAuth()` and use the mock middleware instead.

## Frontend Auth Setup

**Package installed:** `@clerk/react` v5.x in `packages/frontend/package.json`.

**ClerkProvider placement:** Wrap the app in `main.tsx` (not `App.tsx`), wrapping the `<StrictMode>` content. This ensures Clerk is initialised before anything renders.

```tsx
// main.tsx
import { ClerkProvider } from '@clerk/react';

createRoot(rootElement).render(
  <StrictMode>
    <ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}>
      <App />
    </ClerkProvider>
  </StrictMode>
);
```

`VITE_CLERK_PUBLISHABLE_KEY` is already documented in `.env.example`.

**useAuth() hook:** Returns `{ isLoaded, isSignedIn, userId, getToken, signOut }`. `getToken()` returns the JWT for API requests. The centralised API client must call `getToken()` and inject it as a Bearer token.

**API client pattern:**

```ts
const token = await getToken();
fetch('/v1/me', { headers: { Authorization: `Bearer ${token}` } });
```

**Sign in / Sign up routing:** Clerk provides `<SignIn>` and `<SignUp>` components. Routes:
- `/sign-in` — renders `<SignIn routing="path" path="/sign-in" />`
- `/sign-up` — renders `<SignUp routing="path" path="/sign-up" />`

These must be public routes (outside `ProtectedRoute`).

**ProtectedRoute pattern:**

```tsx
import { useAuth } from '@clerk/react';
import { Navigate } from 'react-router';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <LoadingSpinner />;
  if (!isSignedIn) return <Navigate to="/sign-in" replace />;
  return <>{children}</>;
}
```

**AuthContext pattern (per PRD AC):** The PRD requires `GET /v1/me` result stored in a React Context. The pattern is:
1. `AuthContext` holds the local `User` object (from our database, not just Clerk claims).
2. A `useCurrentUser()` hook consumes the context.
3. On app load (inside a component after ClerkProvider), call `GET /v1/me` when `isSignedIn === true`.
4. Use TanStack Query for the fetch — the result populates context.

**Session management:** Clerk handles JWT expiry and refresh automatically. The `getToken()` call always returns a fresh token (Clerk refreshes in the background). Access token lifetime is 5 minutes per L3-002 Section 4.3 — this is configured in the Clerk dashboard, not in code.

## App Routing Structure

Current `App.tsx` uses `BrowserRouter` with React Router v7. The updated structure should be:

```tsx
// Routes:
// /              → redirects to /home or /sign-in based on auth
// /sign-in/*     → Clerk SignIn (public)
// /sign-up/*     → Clerk SignUp (public)
// /home          → ProtectedRoute → HomePage
// /profile       → ProtectedRoute → ProfilePage (feat-002)
```

React Router v7 is already installed. The `<SignIn>` and `<SignUp>` components need wildcard routes (`/sign-in/*`) because Clerk's component handles its own sub-routing internally.

## Hexagonal Architecture Layout for Account Domain

The `account/` directories already exist (all empty with `.gitkeep`):

```
packages/backend/src/account/
  domain/          — User entity, domain errors, value objects
  ports/           — IUserRepository interface, IAuthContext interface
  application/     — UserService (orchestrates via ports)
  adapters/        — UserRepository (pg), ClerkAuthAdapter, MockAuthAdapter
  api/             — Express router, controllers
```

The `shared/ports/` directory exists for cross-cutting port interfaces.

## Key Decisions for Spec Writer

1. **Mock auth middleware typing:** `req.auth` is typed by `@clerk/express` — when using mock auth, the type must be compatible. Consider defining a shared `AuthContext` interface that both real and mock adapters satisfy, to avoid casting.

2. **Clerk JWT claims vs. backend API for email sync:** The Clerk JWT contains `email` as a standard OIDC claim at `req.auth.sessionClaims.email`. This is sufficient for the initial upsert. No need to call the Clerk backend API for basic email — but it should be documented as the authoritative source.

3. **roles array validation:** When `POST /v1/admin/users/:id/roles` is called, Zod should validate that assigned roles are members of the allowed set. Super Administrator cannot be assigned via this endpoint (domain rule from AC-ACCT-014).

4. **`clerk_id` vs `id` in API responses:** The external API should expose the internal `id` (UUID), not `clerk_id`. The `clerk_id` is an internal join key and should not appear in API responses.

5. **`GET /v1/me` upsert behaviour:** First call creates the user with `{backer}` role and `not_verified` kyc_status. Subsequent calls return the existing record. The upsert should only update `email` if it has changed in Clerk (email can change on Clerk's side).

6. **`onboarding_completed` flag:** Set to `false` on creation. The frontend should check this field from `GET /v1/me` to decide whether to show the onboarding flow (feat-003).

7. **Error codes to define:** `USER_NOT_FOUND`, `ROLE_ASSIGNMENT_FORBIDDEN`, `INVALID_ROLE`, `SUPER_ADMIN_ASSIGNMENT_RESTRICTED`. These extend `DomainError` per the established pattern in `packages/backend/src/shared/domain/errors/DomainError.ts`.

8. **`@clerk/express` version:** Installed as `^1.0.0`. The `clerkMiddleware` / `getAuth` / `requireAuth` API is the v1 API. Do not use the deprecated `ClerkExpressRequireAuth` from v0.

9. **Migration timestamp:** Must use current date format `YYYYMMDDHHMMSS`. Since today is 2026-03-07, use `20260307HHMMSS` (e.g. `20260307120000`). Must come after `20260305120000` (the existing trigger migration).

10. **Frontend `MOCK_AUTH`:** There is no frontend equivalent — `MOCK_AUTH=true` only affects the backend JWT verification. In frontend tests, use MSW (already installed) to intercept `GET /v1/me` and return a fixture user.
