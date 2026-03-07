# feat-002: Validation Report

**Verdict:** PASS

---

## Summary

The feat-002 technical spec and design spec are well-constructed and consistent with the PRD, research file, and all referenced authoritative specs (L2-002, L3-002, L3-008, L4-001). The hexagonal architecture is correctly applied, security invariants from L2-002 and L3-002 are honoured, and the design spec handles the Clerk appearance token-mapping exception correctly and explicitly. One minor gap and two warnings are noted but none are blocking.

---

## Checks Passed

### Technical Spec

- `clerk_id` never returned in API responses — Section 7.3 explicitly states: "`clerk_id` is NEVER returned in any API response. It is an internal join key only." The `UserProfile` response shape omits it.
- Parameterised queries in all SQL — Section 5.3 `UserRepositoryPg` specifies `$1, $2` parameterised queries throughout, and Section 5.3 "Constraints" explicitly prohibits string interpolation. Migration SQL uses no dynamic construction.
- Auth context extracted from middleware, never from request body — Controller logic in Section 7.2 extracts `clerkUserId` from `authPort.getAuthContext(req)` (which calls `getAuth(req)` from Clerk middleware). No controller reads `user_id` from `req.body`.
- `MOCK_AUTH=true` pattern allows tests without real Clerk — `MockAuthAdapter` is fully specified (Section 5.2), selected in `server.ts` via `process.env.MOCK_AUTH === 'true'` (Section 8), and the integration test suite uses it (Section 10.2).
- JWT validated by Clerk middleware before any route handler — `clerkMiddleware()` runs globally before all routes; `requireAuth()` is applied to the entire `/v1` router group (Section 8). Health check is mounted before auth-protected routes.
- User roles stored in local DB (not in Clerk JWT) — Sections 1, 3.1, and the research file all explicitly state roles live in the local `users.roles` column (TEXT[]). The research file Section RBAC Design states: "Clerk JWT does NOT carry MMF roles".
- `GET /v1/me` creates user on first call (lazy upsert pattern) — `GetOrCreateUserService` (Section 6.1) implements the upsert-on-first-call pattern. The upsert SQL uses `ON CONFLICT (clerk_id) DO UPDATE` (Section 5.3).
- Database migration has both `-- migrate:up` and `-- migrate:down` — Section 2 migration has both sections. Down migration is `DROP TABLE IF EXISTS users`.
- Migration uses `update_updated_at_column()` (already exists) — Section 2 includes a comment: "update_updated_at_column() is defined in 20260305120000_add_updated_at_trigger.sql — Do NOT redefine it here."
- No string interpolation in SQL queries — Section 5.3 explicitly: "Parameterised queries only — no string interpolation in query construction."
- Monetary values (N/A for this feature) — No monetary values in scope for feat-002.
- Acceptance criteria are testable — Section 12 lists 21 discrete, binary-testable acceptance criteria covering authentication, CRUD endpoints, role guards, forbidden actions, and frontend behaviour.
- Error responses use format `{ error: { code, message } }` — Section 7.3 shows error format including `code`, `message`, and `correlation_id`. Section 12 AC confirms this. Consistent with L2-002 Section 5.3 requirement.

### Design Spec

- Clerk appearance uses raw values (not CSS vars) — Section 2.1 uses raw hex/rgba throughout. Section 2.2 explicitly explains: "Clerk's `appearance` prop does not consume CSS custom properties — it injects inline styles. This is the only place in the codebase where Tier 1 identity token values are used directly." The exception is documented with a full mapping table.
- All page backgrounds use `--color-bg-page` or approved gradient — Sign In/Sign Up pages use `--gradient-hero`; Loading screen uses `--color-bg-page` (`#060A14`). Both are approved tokens per the colour summary in Section 8.
- Loading state uses `prefers-reduced-motion` safe pattern — Section 5.2 includes `@media (prefers-reduced-motion: reduce)` that disables animation and sets static opacity. Correctly referenced against L2-001 Section 5.2.
- Semantic HTML for loading state (`<output>` not `<div role="status">`) — Section 5.3 specifies `<output aria-busy="true" aria-label="Loading Mars Mission Fund">`. The spec notes that `<output>` has implicit `role="status"` and avoids the Biome `useSemanticElements` lint violation. The `ProtectedRoute` (tech spec Section 9.4) uses `<div aria-busy="true" aria-label="Loading..." />` — see Warnings below.
- One primary CTA per viewport — Auth pages contain a single Clerk `<SignIn>` or `<SignUp>` component with one primary submit button. No competing primary CTAs in the wrapper layout.

### Security Checks

- No user role can be set from user-supplied request body — `AssignRolesService` (Section 6.3) requires the actor to hold `Role.Administrator` before proceeding. The actor identity comes from the auth context (Clerk JWT), not the request body. The `assignRolesSchema` (Section 7.1) validates the roles array but the actor identity is always sourced from the authenticated session.
- `PATCH /v1/me` schema doesn't allow role changes — `patchMeSchema` (Section 7.1) accepts only `display_name`, `bio`, and `avatar_url`. Roles are not in the schema.
- `clerk_id` is internal only (never surfaced to frontend) — Confirmed: the `UserProfile` interface on the frontend (Section 9.3) has no `clerkId` field. The API response shape (Section 7.3) also omits `clerk_id`.
- Auth port interface allows real/mock swap without changing app code — `AuthPort` interface (Section 4.2) is implemented by both `ClerkAuthAdapter` and `MockAuthAdapter`. `server.ts` selects the implementation at startup via env var (Section 8). Application services depend only on the `AuthPort` interface.

### Cross-spec Compliance

- Hex architecture maintained — Domain layer (`User`, `Role`, `KycStatus`, domain errors) imports nothing from infrastructure. Ports are interfaces only. Adapters (`UserRepositoryPg`, `ClerkAuthAdapter`, `MockAuthAdapter`) implement port interfaces and are the only layer touching `pg` or `@clerk/express`. Application services inject port interfaces only.
- Domain errors extend DomainError — All five domain errors (`UserNotFoundError`, `UserAlreadyExistsError`, `RoleAssignmentForbiddenError`, `InvalidRoleError`, `SuperAdminAssignmentRestrictedError`, `UserValidationError`) extend `DomainError` with unique `code` values (Section 3.4). Matches L4-001 requirement and CLAUDE.md backend rules.
- Frontend API client injects JWT from Clerk — `createApiClient` (Section 9.2) accepts a `getToken` function and injects it as `Authorization: Bearer <token>`. `useCurrentUser` (Section 9.3) passes `getToken` from Clerk's `useAuth()`.

---

## Failures (Must Fix)

None. No hard failures were identified.

---

## Warnings

**[WARN]** `ProtectedRoute` loading state uses `<div aria-busy="true">` (tech spec Section 9.4), but the design spec (Section 5.3) specifies `<output aria-busy="true">` for `AuthLoadingScreen.tsx`. These are different components — `ProtectedRoute` renders an inline `<div>` placeholder while `AuthLoadingScreen` is the dedicated full-page loading screen. The inline `<div aria-busy="true">` in `ProtectedRoute` is unlikely to trigger a Biome `useSemanticElements` violation since it does not set `role="status"` explicitly. However, the implementation agent should verify that Biome does not flag this and, if it does, use `<output>` or an `aria-live` region instead. No change required to the spec, but the implementation agent needs to be aware.

**[WARN]** `AssignRolesService` (Section 6.3) checks only `Role.Administrator` for the actor guard: `if (!actorUser.hasRole(Role.Administrator))`. Per L3-002 Section 5.2 and L4-001 Section 3.1, the `super_administrator` role also has the capability to assign roles. An actor who is `super_administrator` but not `administrator` will be incorrectly rejected. The spec should check `actorUser.hasRole(Role.Administrator) || actorUser.hasRole(Role.SuperAdministrator)` — or equivalently use `actorUser.isAdmin()` (which already returns true for all three admin-tier roles including `super_administrator`). Using `actorUser.isAdmin()` would resolve this more cleanly.

---

## Notes for Implementation

1. **`AssignRolesService` actor guard**: Use `actorUser.isAdmin()` instead of `actorUser.hasRole(Role.Administrator)` to correctly permit Super Administrators to assign roles. This aligns with L4-001 Section 3.1 and L3-002 Section 5.1 which give Administrator capabilities to Super Administrators. Alternatively, check both roles explicitly.

2. **`ProtectedRoute` vs `AuthLoadingScreen`**: The design spec separates these into two distinct components — `ProtectedRoute` renders the inline loading state (the `<div aria-busy="true">` stub in the tech spec), and `AuthLoadingScreen` is the full-page branded loading screen that should replace the bare `<div>`. The implementation agent should render `<AuthLoadingScreen />` inside `ProtectedRoute` when `!isLoaded`, not a raw `<div>`. The design spec Section 4.3 explicitly states: "While Clerk is initialising, render the full-page loading state (see Section 5)."

3. **`updateProfile` dynamic SET clause**: The spec notes that `updateProfile()` builds a "dynamic SET clause from provided fields using parameterised values." This is the one place in the repository where a query is partially dynamic. The implementation must use an array-accumulation pattern (push field names and values, build the SET string from the names, pass the values as params array) — never concatenate user-supplied field values into the SQL string. Only field names (which are developer-controlled constants, not user input) are interpolated.

4. **`getAuth(req).sessionClaims?.email` type cast**: The controller logic (Section 7.2) notes casting to `string` with a fallback to empty string. Clerk guarantees email is present for verified accounts, but the cast is necessary because `sessionClaims` is typed as `Record<string, unknown>`. A missing email should result in a `UserValidationError` (via `User.create()`), not a silent empty-string user — the fallback to empty string in the controller means `User.create()` will return `Result.fail` due to invalid email format, which is the correct behaviour.

5. **Migration timestamp**: The spec uses `20260307120000_create_users.sql`. The implementation agent must confirm this is later than all existing migrations (the latest known is `20260305120000`) before applying.

6. **`VITE_API_BASE_URL` addition to `.env.example`**: The spec notes this variable needs to be added to `.env.example`. The implementation agent should verify it is not already present before adding.

7. **Test coverage gate**: The spec requires unit test coverage ≥ 90% on the `User` entity and application services. The `User.create()` method body is left as a comment block in the spec — the implementation agent must implement the actual validation logic (non-empty `clerkId`, basic email format check) and ensure the six test cases listed in Section 10.1 achieve this threshold.
