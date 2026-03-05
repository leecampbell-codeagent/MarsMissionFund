## feat-001: Account Registration and Authentication

**Bounded Context(s):** Account (L4-001)
**Priority:** P0
**Dependencies:** None
**Estimated Complexity:** M

### Summary

This feature implements the full account lifecycle foundation: user registration via Clerk, email verification, role assignment on activation (Backer by default), and profile management (display name, avatar, bio, notification preferences).
It is the identity layer that every other feature depends on — no authenticated feature can be built until this exists.

### Acceptance Criteria

- [ ] A new user can register with email and password via Clerk; account enters `Pending Verification` state and a verification email is sent.
- [ ] Clicking a valid, non-expired verification link transitions the account to `Active` state.
- [ ] An account in `Active` state is automatically assigned the `Backer` role.
- [ ] A user can register via Google or Microsoft SSO (Clerk OIDC); account enters `Active` state immediately (email pre-verified by provider).
- [ ] Registration with a duplicate email returns an error that does not reveal whether the existing account uses SSO or password.
- [ ] An authenticated user can update their display name, bio, and avatar; changes are persisted and reflected in subsequent profile reads.
- [ ] An authenticated user can read their own profile, including KYC status (sourced from feat-002) and roles.
- [ ] An authenticated user can view and update notification preferences (all categories); security notifications cannot be disabled.
- [ ] All account mutations are logged: timestamp, actor, action, affected resource.
- [ ] Every API endpoint except `/health` rejects unauthenticated requests with HTTP 401.
- [ ] The `GET /me` endpoint returns the authenticated user's profile, roles, and KYC status.

### User Story

As a person interested in Mars funding, I want to register an account and log in so that I can back missions and, if I choose, create campaigns.

### Key Decisions / Open Questions

- Clerk is the auth provider (defined in tech stack L3-008); the backend validates Clerk JWTs via middleware — no custom auth implementation.
- Session management (token lifetime, refresh, revocation) is delegated entirely to Clerk for the local demo.
- Avatar uploads must be served from a separate domain per engineering standard; clarify whether an S3 bucket or Clerk's CDN is used for the workshop demo.
- The `user_id` stored in the platform DB is Clerk's user ID (`clerk_id`) used as the FK across all tables.

### Out of Scope

- MFA enrollment/enforcement (theatre for local demo — Clerk handles MFA; platform does not build its own TOTP/WebAuthn flows).
- Session elevation for sensitive operations (theatre).
- Account deactivation, GDPR erasure, and data portability (theatre).
- Password reset flow (delegated entirely to Clerk-hosted UI).
- SSO provider management beyond Google and Microsoft.




























