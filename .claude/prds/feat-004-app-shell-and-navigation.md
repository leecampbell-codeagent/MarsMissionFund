## feat-004: Application Shell and Navigation

**Bounded Context(s):** Frontend / Account
**Priority:** P0
**Dependencies:** feat-001, feat-002, feat-003
**Estimated Complexity:** S

### Summary

Implement the application shell: global navigation bar, footer, route layout, loading/error boundaries, and the authenticated route guard. This is the structural wrapper every page lives inside. It establishes route-level code splitting, the centralised API client with correlation ID injection and auth token attachment, and the core React Router route definitions.

### Acceptance Criteria

- [ ] React Router v7 is configured with route-level code splitting (each route is a lazy import).
- [ ] A `NavigationBar` component renders the MMF coin icon mark (32px) on the left and the authenticated user's display name / avatar on the right, per L2-001 Section 6.1.
- [ ] A `Footer` component renders the MMF horizontal lockup per L2-001 Section 6.1.
- [ ] An `AuthGuard` route wrapper redirects unauthenticated users to Clerk's sign-in page.
- [ ] A centralised HTTP client (`packages/frontend/src/lib/apiClient.ts`) is implemented that:
  - Attaches `Authorization: Bearer <clerk-jwt>` to every request.
  - Generates and attaches a `X-Correlation-ID` header (UUID v4) to every request.
  - Transforms API error responses (`{ error: { code, message } }`) into typed `ApiError` objects.
  - Never logs sensitive data (JWT token values, personal data).
- [ ] TanStack Query (`QueryClient`) is configured at the app root with `staleTime: 0` for financial data queries.
- [ ] A global `ErrorBoundary` component catches render errors and displays a brand-appropriate error state with retry option.
- [ ] A `LoadingScreen` component displays during route lazy-load transitions.
- [ ] Route definitions include at minimum: `/` (landing/home), `/campaigns` (discovery), `/campaigns/:id` (detail), `/dashboard` (donor dashboard, auth-gated), `/account` (profile, auth-gated), `/admin` (admin, auth + role gated).
- [ ] Page title updates on every route change (via `document.title` or React Router meta).
- [ ] Skip-to-content link is present on every page per L3-005 Section 4.3.
- [ ] `<noscript>` fallback is present per L3-005 Section 7.2 with brand-appropriate dark background.
- [ ] Unit tests cover: `AuthGuard` redirects unauthenticated users, `NavigationBar` renders user display name, `apiClient` attaches correlation ID, `apiClient` throws `ApiError` on non-2xx responses.

### User Story

As a user, I want a consistent navigation experience so that I can move between sections of the platform and always know where I am.

### Key Decisions / Open Questions

- The landing page (`/`) is a public route; all other routes within the app require authentication.
- The `apiClient` uses native `fetch` — no Axios.
- Clerk's `<SignIn />` component is hosted on Clerk's domain; the app redirects to it rather than rendering an embedded form.

### Out of Scope

- Landing page content (feat-005).
- Admin dashboard content (added in admin-specific features).
- Mobile navigation pattern (hamburger / bottom nav) — responsive nav is added in this feature as a basic collapse, detailed mobile nav is a P2 enhancement.
