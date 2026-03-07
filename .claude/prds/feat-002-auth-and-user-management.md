## feat-002: Authentication and User Management

**Bounded Context(s):** Account
**Priority:** P0
**Dependencies:** feat-001
**Estimated Complexity:** M

### Summary

Integrate Clerk for authentication and implement the account domain: user registration, email verification state, role assignment, and basic profile management. This is the identity foundation that every other feature depends on for access control. The local demo scope per L4-001 covers registration, Clerk auth, role assignment, and profile management as real; session elevation, MFA enforcement, and SSO linking are theatre.

### Acceptance Criteria

- [ ] Clerk JWT middleware is wired into Express; all routes except `/health` require a valid Clerk JWT.
- [ ] `user_id` is extracted from the Clerk JWT auth context — never from the request body.
- [ ] A `users` table migration exists in `db/migrations/` with columns: `id` (UUID), `clerk_id` (VARCHAR, unique), `email` (VARCHAR, unique), `display_name` (VARCHAR nullable), `avatar_url` (VARCHAR nullable), `bio` (TEXT nullable), `roles` (TEXT[] with default `{backer}`), `kyc_status` (VARCHAR with default `not_verified`), `onboarding_completed` (BOOLEAN default false), `created_at` (TIMESTAMPTZ), `updated_at` (TIMESTAMPTZ).
- [ ] A `User` domain entity exists with `create()` and `reconstitute()` factory methods; all properties are `readonly`.
- [ ] `GET /v1/me` returns the authenticated user's profile; creates the user record on first login (upsert by `clerk_id`).
- [ ] `PATCH /v1/me` allows updating `display_name`, `bio`, and `avatar_url`; validates with Zod.
- [ ] `GET /v1/me/roles` returns the current user's roles array.
- [ ] `POST /v1/admin/users/:id/roles` allows an Administrator to assign/remove roles; role changes are logged.
- [ ] Every account with `Active` Clerk status automatically receives the `backer` role in the platform database.
- [ ] All API responses use the standard error format: `{ error: { code, message } }`.
- [ ] Domain errors extend `DomainError` with unique `code` values (e.g., `USER_NOT_FOUND`, `ROLE_ASSIGNMENT_FORBIDDEN`).
- [ ] Unit test coverage ≥ 90% on `User` entity and application service.
- [ ] Integration tests cover: first-login upsert, profile update, role assignment, forbidden role escalation.
- [ ] Frontend: `ClerkProvider` wraps the React app; `useAuth()` hook provides the current user; unauthenticated users are redirected to Clerk's hosted sign-in.
- [ ] Frontend: `GET /v1/me` is called on app load; the result is stored in React Context (`AuthContext`).

### User Story

As a new user, I want to register and log in so that I can access the Mars Mission Fund platform with the appropriate role.

### Key Decisions / Open Questions

- Clerk is the authentication provider; the platform stores a shadow user record keyed on `clerk_id` for domain data.
- `roles` is a PostgreSQL text array on the users table for simplicity at this stage.
- `kyc_status` is a denormalised column on users for fast access; the KYC service owns the canonical state.

### Out of Scope

- Full KYC verification flow (feat-007).
- Onboarding flow UI (feat-003 and beyond).
- Session elevation / MFA (theatre per L4-001).
- Data portability export (P3).
- Account deactivation and GDPR erasure (P3).
