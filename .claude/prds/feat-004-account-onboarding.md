## feat-004: Account Onboarding and Profile Management

**Bounded Context(s):** Account
**Priority:** P0
**Dependencies:** feat-003
**Estimated Complexity:** M

### Summary

Delivers the first-run onboarding flow that guides newly registered users through role selection and optional profile setup. Also provides the profile management page where users can update their display name, bio, and avatar, and view their KYC status and notification preferences. This completes the Account bounded context for the local demo scope.

### Acceptance Criteria

- [ ] A newly verified Clerk user who has never completed onboarding is redirected to `/onboarding` on first login
- [ ] The onboarding flow has three steps: (1) welcome screen with brand-appropriate copy, (2) role selection (Backer, Creator, or both), (3) optional profile fields (display name, bio)
- [ ] Selecting the Creator role on the onboarding screen displays a prompt explaining KYC is required, with options to "Start KYC now" (links to KYC flow, feat-005) or "Skip for now"
- [ ] Completing onboarding sets `users.onboarding_completed = true` and redirects the user to the home page
- [ ] A user who abandons onboarding mid-flow resumes from the same step on next login (progress persisted server-side)
- [ ] `PUT /api/v1/me` endpoint accepts `{ display_name, bio }` and updates the authenticated user's profile; returns the updated profile with `200`
- [ ] The profile page at `/profile` displays the user's display name, bio, email (read-only), roles, and KYC status
- [ ] Notification preferences section on the profile page renders all categories (campaign updates, milestone completions, contribution confirmations, new recommendations, platform announcements) as toggleable opt-in/out; security alerts are displayed as always-on and cannot be toggled
- [ ] `PUT /api/v1/me/notification-preferences` persists notification preference changes; returns `200`
- [ ] Integration test: `PUT /api/v1/me` with valid fields returns `200` with updated profile
- [ ] Integration test: `PUT /api/v1/me` with an empty display name (whitespace only) returns `400`

### User Story

As a new user, I want to be guided through setting up my account so that I can start discovering and backing Mars missions.

### Key Decisions / Open Questions

- Notification preferences stored as a JSONB column on the `users` table (add via migration)
- Avatar upload is out of scope for this feature — profile page shows avatar from Clerk or a default placeholder
- Role selection during onboarding does not prevent the user from changing their role later via profile settings

### Out of Scope

- Avatar file upload (requires separate file storage infrastructure)
- Email change workflow (requires re-verification — theatre for demo)
- Account deactivation and GDPR erasure flows (theatre per L4-001 local demo scope)
- Data portability export (theatre per L4-001 local demo scope)
- Session management UI (theatre)
