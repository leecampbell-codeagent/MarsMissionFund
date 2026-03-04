## feat-004: Account Registration & Onboarding

**Bounded Context(s):** Account
**Priority:** P0
**Dependencies:** feat-002, feat-003
**Estimated Complexity:** M

### Summary

Implement the account lifecycle from Clerk sign-up through internal account creation, role assignment, onboarding flow (role selection, optional profile, notification preferences), and profile management. Establishes the account record that all other bounded contexts reference.

### Acceptance Criteria

- [ ] On first authenticated request, if no `accounts` row exists for the Clerk user ID, one is created automatically with status `active` and default role `backer`
- [ ] Onboarding flow presented on first login: welcome screen, role selection (Backer, Creator, or both), optional profile fields (display name, avatar, bio), notification preferences
- [ ] Role selection persists to `accounts.roles` array — selecting Creator adds `creator` to roles
- [ ] Selecting Creator role during onboarding displays a message that KYC verification will be required (links to KYC flow when feat-013 is built)
- [ ] Onboarding progress tracked — users who abandon mid-flow resume where they left off
- [ ] Onboarding considered complete when role is selected and user reaches home surface
- [ ] Profile management page: edit display name, avatar upload (validated for type/size), bio
- [ ] Email change triggers re-verification (handled by Clerk; we display Clerk's UI)
- [ ] Notification preferences page with toggleable categories: campaign updates, milestone completions, contribution confirmations, new campaign recommendations, platform announcements. Security alerts always on (not toggleable)
- [ ] `GET /v1/accounts/me` returns the authenticated user's account with roles, profile, onboarding status
- [ ] `PATCH /v1/accounts/me` updates profile fields; Zod validation on request body
- [ ] `PATCH /v1/accounts/me/preferences` updates notification preferences
- [ ] All account mutations emit events to the event store
- [ ] All account mutations logged with Pino structured logging (no PII in logs)
- [ ] Backend enforces that `user_id` comes from auth context, never from request body
- [ ] Integration tests: account creation, profile update, preference update, onboarding flow

### User Story

As a new user, I want to complete onboarding and set up my profile so that the platform knows my role and preferences.

### Key Decisions / Open Questions

- Account created on first authenticated request (lazy creation), not via a separate registration API
- Clerk handles email verification, password reset, and session management
- Backer role assigned by default; Creator role is additive

### Out of Scope

- KYC verification flow (feat-013)
- Admin role assignment (feat-015)
- Account deactivation, deletion, GDPR erasure (Phase 2 per local demo scope)
- Session management UI (Clerk handles this)
- Data export / portability (Phase 2)
