## feat-003: Authentication Integration (Clerk)

**Bounded Context(s):** Account
**Priority:** P0
**Dependencies:** feat-001, feat-002
**Estimated Complexity:** M

### Summary

Integrates Clerk as the authentication provider for both frontend and backend. The frontend uses Clerk's React SDK for sign-in/sign-up UI and JWT token management. The backend validates Clerk JWTs on every protected endpoint via middleware. On first sign-in after registration, a user record is created in the local database linked to the Clerk user ID.

### Acceptance Criteria

- [ ] `CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` environment variables are documented in `.env.example`
- [ ] Frontend renders Clerk's `<SignIn />` and `<SignUp />` components at `/sign-in` and `/sign-up` routes
- [ ] Frontend injects the Clerk JWT Bearer token into every API request via a centralised API client (not per-request)
- [ ] Backend `authMiddleware` verifies Clerk JWT on every request except `GET /health`; returns `401` with `{ error: { code: "UNAUTHORIZED", message: "..." } }` for missing or invalid tokens
- [ ] On first authenticated request from a new Clerk user, the backend upserts a row in the `users` table with the Clerk user ID and email, setting `account_status = 'active'` and assigning the `backer` role in `user_roles`
- [ ] The `req.auth` context object on all authenticated routes contains `{ userId: string, clerkId: string, roles: string[] }` populated from the database
- [ ] A `GET /api/v1/me` endpoint returns the authenticated user's profile and roles with `200`, or `401` if unauthenticated
- [ ] All authenticated API responses include a `X-Request-Id` correlation ID header
- [ ] Integration test: calling any protected endpoint without a token returns `401`
- [ ] Integration test: calling `GET /api/v1/me` with a valid Clerk JWT returns the user's profile

### User Story

As a user, I want to sign in with my email or social account so that I can access the platform securely.

### Key Decisions / Open Questions

- Clerk's `@clerk/clerk-sdk-node` used for backend JWT verification
- Clerk's `@clerk/clerk-react` used for frontend
- User sync happens lazily on first authenticated request (not via Clerk webhook) to keep infrastructure minimal for the demo
- The Backer role is automatically assigned to all newly created users

### Out of Scope

- Onboarding flow UI (feat-004)
- Role-specific UI routing
- MFA enforcement (theatre per L4-001 local demo scope)
- SSO / OAuth provider configuration beyond Clerk defaults
- Session management UI (theatre per L4-001 local demo scope)
