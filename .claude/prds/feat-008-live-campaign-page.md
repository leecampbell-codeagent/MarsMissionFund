## feat-008: Live Campaign Public Page

**Bounded Context(s):** Campaign, Donor
**Priority:** P1
**Dependencies:** feat-006, feat-007
**Estimated Complexity:** M

### Summary

Renders the public campaign page for live and funded campaigns, displaying all campaign details, real-time funding progress, milestone plan, and creator updates. Provides the "Back This Mission" CTA that initiates the contribution flow. Anonymous users can view the page; authentication is required to contribute.

### Acceptance Criteria

- [ ] `GET /api/v1/campaigns/:id/public` returns full campaign detail for any campaign in `live`, `funded`, `settlement`, `complete`, or `failed` state; accessible to anonymous requests (no auth required); returns `404` for campaigns in `draft`, `submitted`, `under_review`, `approved` states
- [ ] `GET /api/v1/campaigns/:id/public` response includes: title, summary, description, category, status, funding_goal_cents (as string), funding_cap_cents (as string), amount_raised_cents (as string), contributor_count, deadline, launched_at, milestones array, creator display name, campaign updates array
- [ ] `POST /api/v1/campaigns/:id/updates` allows the campaign creator to post a text update to their live or funded campaign; returns `201`; returns `403` for non-owners or `409` if campaign is not live/funded
- [ ] `GET /api/v1/campaigns/:id/updates` returns paginated campaign updates (newest first)
- [ ] The campaign page at `/campaigns/:id` renders: hero image (or placeholder), title, creator name, category badge, funding progress bar showing percentage of goal and absolute amount raised (formatted as USD), contributor count, time remaining (days/hours), full description, milestone timeline, creator updates feed
- [ ] Monetary amounts on the campaign page are displayed using `Intl.NumberFormat` — never manual string formatting
- [ ] The funding progress bar uses the `--color-status-success` token when >= 100% funded, the standard `--gradient-action-primary` otherwise
- [ ] A "Back This Mission" CTA button is visible to authenticated users; unauthenticated users see "Sign in to Back This Mission" which redirects to `/sign-in`
- [ ] A `failed` campaign renders with a "Campaign Failed" status badge and a message informing visitors that contributions were refunded
- [ ] A `complete` campaign renders with a "Mission Complete" status badge and the final funded amount
- [ ] The campaign page title is `<campaign title> | Mars Mission Fund` (for SEO/Open Graph)
- [ ] Integration test: `GET /api/v1/campaigns/:id/public` for a `draft` campaign returns `404`
- [ ] Integration test: `GET /api/v1/campaigns/:id/public` for a `live` campaign returns `200` without requiring auth header

### User Story

As a mission backer, I want to view a campaign's full details and funding progress so that I can decide whether to contribute.

### Key Decisions / Open Questions

- `contributor_count` is a denormalised count on the campaigns table, incremented when a contribution is captured (feat-010/011)
- Campaign updates are stored in the `campaign_updates` table (add migration): `id`, `campaign_id`, `author_id`, `content` (text), `created_at`
- Open Graph meta tags (`og:title`, `og:description`, `og:image`) should be rendered in the page `<head>` for shareability (feat-012 social sharing builds on this)

### Out of Scope

- Stretch goals display (optional feature, not in core MVP path)
- Deadline extension UI
- Milestone change request UI
- Contributor identity display (donors are anonymous on the public page)
