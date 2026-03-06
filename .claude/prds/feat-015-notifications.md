## feat-015: In-App Notifications

**Bounded Context(s):** Account, Campaign, Donor
**Priority:** P2
**Dependencies:** feat-007, feat-012, feat-013
**Estimated Complexity:** S

### Summary

Delivers a persistent in-app notification system that surfaces key lifecycle events to users: campaign review outcomes, contribution confirmations, milestone updates, and campaign status changes. Notifications are stored in the database and surfaced via a notification bell in the navigation. This completes the transparency and engagement loop across the Campaign and Donor bounded contexts.

### Acceptance Criteria

- [ ] `GET /api/v1/me/notifications` returns paginated unread and read notifications for the authenticated user (default 20, newest first); each notification has: `id`, `type`, `title`, `body`, `read`, `createdAt`, `actionUrl` (nullable link for deeplink)
- [ ] `POST /api/v1/me/notifications/:id/read` marks a single notification as read; returns `200`; returns `403` if notification belongs to a different user
- [ ] `POST /api/v1/me/notifications/read-all` marks all of the authenticated user's notifications as read; returns `200`
- [ ] `GET /api/v1/me/notifications/unread-count` returns `{ count: number }`; used for the nav badge
- [ ] The following events create notification records in the `notifications` table (defined in feat-007 migration): campaign proposal approved (to creator), campaign proposal rejected (to creator), campaign funded target reached (to creator), campaign failed (to creator and all donors), milestone verified (to creator and all donors of that campaign), milestone evidence returned (to creator), campaign completed (to creator and all donors)
- [ ] The navigation bar displays a bell icon with an unread count badge; clicking it opens a dropdown or navigates to `/notifications`
- [ ] The notifications page at `/notifications` lists all notifications with read/unread styling; a "Mark all as read" button is visible when there are unread notifications
- [ ] Unread notifications use a distinct visual indicator (dot or bold styling using `--color-status-warning` or accent token)
- [ ] Each notification with an `actionUrl` is clickable and navigates to the relevant page (e.g., campaign page, milestone detail)
- [ ] Integration test: approving a campaign via `POST /api/v1/review/:id/approve` creates a notification record for the campaign's creator with type `campaign_approved`
- [ ] Integration test: `GET /api/v1/me/notifications/unread-count` returns `0` after `POST /api/v1/me/notifications/read-all`

### User Story

As a platform user, I want to be notified about important events on campaigns I'm involved with so that I can stay informed without constantly checking the platform.

### Key Decisions / Open Questions

- Notifications are created synchronously within the same request that triggers the event (no message queue for the demo)
- `notifications` table was introduced in feat-007 migration; this feature adds the read API on top
- Email notifications are theatre for the demo — only in-app notification records are created

### Out of Scope

- Email notification delivery (theatre — AWS SES integration is theatre per specs/README.md)
- Push notifications
- Notification preference filtering (notifications are always created regardless of preferences for MVP — preferences UI exists per feat-004 but enforcement is theatre)
- Frequency caps for re-engagement notifications (theatre)
