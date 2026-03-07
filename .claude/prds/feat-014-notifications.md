## feat-014: In-App Notifications

**Bounded Context(s):** Account, Campaign, Donor
**Priority:** P2
**Dependencies:** feat-002, feat-010, feat-012
**Estimated Complexity:** M

### Summary

Implement in-app notifications for key platform events: contribution confirmed, campaign status changes, milestone verified, KYC status change, campaign update posted. Email notifications are stubbed (mock AWS SES adapter). This covers the notification preferences model from L4-001 and in-app notification delivery from L4-003. Email delivery is theatre for the local demo.

### Acceptance Criteria

- [ ] Migration: `notifications` table: `id` (UUID PK), `user_id` (UUID FK → users), `type` (VARCHAR), `title` (VARCHAR), `body` (TEXT), `campaign_id` (UUID FK nullable), `read` (BOOLEAN default false), `created_at` (TIMESTAMPTZ). Indexes on `user_id`, `read`, `created_at`.
- [ ] `EmailDeliveryPort` interface with method `sendEmail(to, subject, body, templateId)`.
- [ ] `MockEmailAdapter` implements `EmailDeliveryPort`; logs email content to Pino logger at `info` level; does not send real email.
- [ ] `MOCK_EMAIL=true` env var controls which email adapter is used (documented in `.env.example`).
- [ ] Notification service creates `notifications` rows when triggered by domain events: contribution captured, campaign approved, campaign rejected, campaign launched, campaign funded, milestone verified, KYC status changed.
- [ ] `GET /v1/me/notifications` returns the authenticated user's notifications, most recent first, paginated (20/page). Supports `read=false` filter.
- [ ] `GET /v1/me/notifications/unread-count` returns `{ count: number }` for quick badge display.
- [ ] `POST /v1/me/notifications/:id/read` marks a notification as read.
- [ ] `POST /v1/me/notifications/read-all` marks all notifications as read.
- [ ] Notification creation is a side effect of application service actions — never within the domain layer.
- [ ] Security notifications (auth events from Clerk webhooks) are mandatory and cannot be filtered.
- [ ] Integration tests cover: notification created on contribution, notification created on campaign approval, unread count, mark as read, read-all.
- [ ] Frontend: Notification bell icon in the `NavigationBar` showing unread count badge; clicking opens a notification drawer/dropdown.
- [ ] Frontend: Notification drawer lists notifications with type icon, title, body, time-ago timestamp, and read/unread visual state.
- [ ] Frontend: Unread count badge uses `--color-status-active` per L2-001 design tokens.
- [ ] Frontend: Poll unread count every 30 seconds (TanStack Query background refetch) while user is authenticated.
- [ ] Frontend: Clicking a notification marks it as read and navigates to the relevant resource (campaign page, dashboard).

### User Story

As a user, I want to receive notifications about events relevant to my account and campaigns so that I can stay informed about my missions without constantly checking the platform.

### Key Decisions / Open Questions

- Email notifications are mocked for the local demo — the mock adapter logs to Pino, not stdout console.
- Push notifications (mobile/web push) are out of scope for the local demo.
- Notification preferences (per-category opt-in/out per L4-001 Section 4.2) are deferred to P3; all notifications are on by default.

### Out of Scope

- Real email delivery via AWS SES (P3 — feat-017).
- Push notifications (P3).
- Notification preference management UI (P3).
- Re-engagement notification automation (theatre per L4-003 local demo scope).
- Frequency caps for re-engagement (P3).
