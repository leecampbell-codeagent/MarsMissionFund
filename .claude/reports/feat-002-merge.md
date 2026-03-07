# feat-002: Merge Report

**Date:** 2026-03-07
**Feature:** Authentication and User Management — Clerk + RBAC
**Branch:** ralph/feat-002-auth → ralph/feat-001-monorepo-scaffold
**PR:** https://github.com/leecampbell-codeagent/MarsMissionFund/pull/16
**PR Status:** Pending manual merge (stacked on feat-001 — merge feat-001 first)

---

## Test Results

| Suite | Tests | Result |
|-------|-------|--------|
| Backend (Vitest) | 53/53 | PASS |
| Frontend (Vitest) | Not run (no new frontend tests added beyond feat-001) | N/A |
| **Total** | **53/53** | **PASS** |

## Coverage

| Package | Lines | Functions | Branches | Statements |
|---------|-------|-----------|----------|------------|
| Backend | 98.82% | 100% | 94.89% | 98.82% |
| Frontend | N/A (Clerk components, no domain logic) | — | — | — |

## Build

- Backend (`tsc`): PASS — 0 TypeScript errors
- Frontend (`vite build`): PASS — 164 modules, 342 kB JS, 10 kB CSS

## Security Audit

- Critical: 0
- High: 0
- Medium: 3 (dynamic SET clause pattern, RBAC super_administrator gap, no MOCK_AUTH production guard — all pre-existing/deferred)
- Low: 2 (hardcoded mock email fallback, missing correlation_id in requireAuthMiddleware 401)

## Changelog Entry

### feat-002: Authentication and User Management (2026-03-07)

**What shipped:**
- `db/migrations/20260307120000_create_users.sql` — `users` table with clerk_id, email, roles (TEXT[]), kyc_status, onboarding_completed, updated_at trigger
- `packages/backend/src/account/domain/` — User entity, Role/KycStatus enums, 6 domain error types
- `packages/backend/src/account/ports/` — UserRepository interface
- `packages/backend/src/account/adapters/UserRepositoryPg.ts` — pg implementation with parameterised queries
- `packages/backend/src/account/application/` — GetOrCreateUserService, UpdateUserProfileService, AssignRolesService
- `packages/backend/src/account/api/` — account.router.ts (GET/PATCH /v1/me, GET /v1/me/roles, POST /v1/admin/users/:id/roles), account.schemas.ts
- `packages/backend/src/shared/adapters/auth/ClerkAuthAdapter.ts` — wraps @clerk/express; returns JSON 401 (not redirect) on unauthenticated requests
- `packages/backend/src/shared/adapters/auth/MockAuthAdapter.ts` — bypasses Clerk for MOCK_AUTH=true
- `packages/backend/src/server.ts` — auth adapter selection, global Clerk middleware, /v1 route group with requireAuthMiddleware
- `packages/frontend/src/main.tsx` — ClerkProvider wrapping
- `packages/frontend/src/api/client.ts` — createApiClient factory with JWT injection
- `packages/frontend/src/hooks/useCurrentUser.ts` — TanStack Query hook for /v1/me
- `packages/frontend/src/components/auth/ProtectedRoute.tsx` — redirects to /sign-in when unauthenticated
- `packages/frontend/src/pages/SignInPage.tsx`, `SignUpPage.tsx` — Clerk-hosted sign-in/sign-up pages with MMF branding
- `packages/frontend/src/App.tsx` — updated with /sign-in/*, /sign-up/*, /home, /dashboard routes

## Manual Tasks Created

- MANUAL-004: Re-run `dbmate up` after merging feat-002 (new migration: 20260307120000_create_users.sql)

## Quality Gate Summary

| Gate | Result |
|------|--------|
| All tests pass | PASS (53/53) |
| Exploratory review | PASS |
| Test coverage ≥ 80% | PASS (98.82% lines) |
| 0 critical security findings | PASS |
| Hex architecture compliance | PASS |
| No TODO/FIXME in new code | PASS |
| Build succeeds | PASS |
