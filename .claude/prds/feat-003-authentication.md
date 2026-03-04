## feat-003: Authentication with Clerk

**Bounded Context(s):** Account
**Priority:** P0
**Dependencies:** feat-001
**Estimated Complexity:** M

### Summary

Integrate Clerk for authentication on both frontend and backend. Set up Clerk provider in React, JWT verification middleware in Express, and establish the auth context pattern that all authenticated endpoints will use. This feature gates every subsequent feature that requires user identity.

### Acceptance Criteria

- [ ] Clerk React SDK (`@clerk/clerk-react`) installed and `ClerkProvider` wraps the app in `packages/frontend`
- [ ] Clerk Express middleware (`@clerk/express`) installed in `packages/backend`
- [ ] Backend middleware extracts and verifies Clerk JWT on every request (except `GET /health`)
- [ ] Auth context object available in request handlers with `userId` (Clerk user ID) — never from request body
- [ ] Frontend API client automatically injects Clerk session token in `Authorization: Bearer` header
- [ ] Unauthenticated requests to protected endpoints return `401` with standard error format: `{ error: { code: "UNAUTHENTICATED", message, correlation_id } }`
- [ ] Sign-in and sign-up pages render using Clerk's `<SignIn />` and `<SignUp />` components
- [ ] After sign-in, user is redirected to the app home page
- [ ] After sign-up, user is redirected to onboarding (placeholder route for feat-004)
- [ ] Clerk environment variables documented in `.env.example`: `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`
- [ ] Frontend routing: unauthenticated users redirected to sign-in page for protected routes
- [ ] Integration test: authenticated request returns 200; unauthenticated returns 401

### User Story

As a user, I want to sign up and sign in so that I can access the platform securely.

### Key Decisions / Open Questions

- Clerk handles password policies, email verification, SSO, and MFA — we do not reimplement these
- Session management delegated to Clerk (per local demo scope in account spec)
- Clerk's `userId` is the external identity; our `accounts.clerk_user_id` maps to our internal `accounts.id`

### Out of Scope

- Account profile management (feat-004)
- Role-based access control enforcement beyond basic auth (feat-004)
- MFA enforcement (Clerk handles this; we rely on their configuration)
- SSO provider configuration (Google, Microsoft) — configured in Clerk dashboard, not in code
