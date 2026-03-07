## Re-review Note (quality_iterations=1)
Changes reviewed: vitest.config.ts (pool.ts coverage exclusion) and docker-compose.yml (version field removal).
No security implications. Previous verdict stands: PASS — 0 Critical, 0 High.

---

# feat-001: Security Review Report

**Date:** 2026-03-07
**Reviewer:** Security Agent
**Feature:** Monorepo Scaffold (feat-001)

## Verdict: PASS — 0 Critical / 0 High findings

## Summary

This feature establishes the monorepo scaffold with a minimal Express backend (single `/health` endpoint, no user input, no DB queries) and a React frontend (static placeholder page). The security surface is extremely limited — no authentication flows, no user data, no financial operations, and no database queries are implemented. All security controls that cannot yet be exercised are correctly deferred to future features. One medium finding (sourcemaps enabled in production build) and two low/informational findings are noted.

## Finding Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High     | 0 |
| Medium   | 1 |
| Low      | 2 |
| Info     | 1 |

---

## Findings

### [MEDIUM] Sourcemaps Enabled in Production Build

**File:** `/workspace/packages/frontend/vite.config.ts:18`
**Issue:** `build.sourcemap: true` is set unconditionally. In a production Vite build this generates `.js.map` files and embeds `//# sourceMappingURL` comments. If deployed to production without a CDN or server rule stripping sourcemap responses, they expose the full application source code to any user who opens DevTools.
**Impact:** An attacker could read the unminified React/TypeScript source, understand application logic, identify API endpoints, and locate potential vulnerabilities before they are discovered by defenders.
**Remediation:** Gate sourcemaps on the build environment:

```typescript
build: {
  outDir: 'dist',
  sourcemap: process.env.NODE_ENV !== 'production',
},
```

Or use `'hidden'` to generate sourcemaps for error tracking tools (e.g., Sentry) without serving them publicly: `sourcemap: 'hidden'`. Per L3-002 §11, sourcemaps must not be deployed to the public-facing production origin.

---

### [LOW] Docker Compose Contains Hardcoded Development Credentials

**File:** `/workspace/docker-compose.yml:8-9` and `:26`
**Issue:** The postgres service uses `POSTGRES_PASSWORD: mmf` and the migrate service uses `DATABASE_URL: postgres://mmf:mmf@postgres:5432/mmf?sslmode=disable`. These are plaintext credentials committed to version control.
**Note:** This is a local development scaffold only — the spec explicitly states this file is for human developers, uses the simplified postgres+migrate-only form, and will never reach production as-is. The credentials are trivially guessable dev defaults (matching `.env.example`). This is acceptable for a local dev scaffold.
**Recommendation:** Add an inline comment making this intent explicit (e.g., `# Local dev only — never use these credentials in staging or production`). Future infrastructure work should ensure docker-compose is not used as a template for production credential injection.

---

### [LOW] `sslmode=disable` in Development DATABASE_URL

**File:** `/workspace/docker-compose.yml:26` and `/workspace/.env.example:9`
**Issue:** Both the compose file and `.env.example` use `sslmode=disable` in the `DATABASE_URL`. The `pg` pool in `pool.ts` uses this connection string verbatim with no override or validation.
**Note:** Acceptable for local development (Docker Compose internal network, no sensitive data). This must not propagate to staging or production `DATABASE_URL` values.
**Recommendation:** Add a comment to `.env.example` noting that `sslmode=disable` is for local dev only and must be replaced with `sslmode=require` (or stronger) in all non-local environments.

---

### [INFO] Security Headers Not Yet Configured

**File:** `/workspace/packages/backend/src/server.ts`
**Issue:** The backend does not yet set the security headers required by L3-002 §7.2 (`Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`). CORS is also not yet configured.
**Note:** This is explicitly deferred — the scaffold has no API routes beyond `/health`, no auth, and no user-facing content served from the backend. The spec (feat-001) correctly lists security middleware as out-of-scope.
**Recommendation:** These headers must be added before any application API route is introduced. Recommend implementing them in feat-002 (auth) or a dedicated security-middleware task before any public endpoint ships.

---

## Passed Checks

### L2-002 Security Invariants

- **1.1 Encryption (TLS):** N/A for scaffold — no network calls beyond localhost. Deferred to infrastructure feature.
- **1.2 Data Access (Parameterised queries):** No queries exist yet. Pool is infrastructure-only with no query logic. PASS — no violations possible at this stage.
- **1.3 Secrets Management:** No secrets in code. `DATABASE_URL` read exclusively from `process.env`. `.env.example` contains only placeholder values (pk_test/sk_test/phc pattern examples) — no real secrets committed. `.env` is in `.gitignore` with `!.env.example` correctly allowing the example file. PASS.
- **1.4 Input Validation:** No user input exists. The `/health` endpoint takes no parameters. PASS — deferred to features that introduce user input.
- **1.5 Auth:** `/health` is correctly exempted from auth per L2-002 §5.4 and §6.3 with an explicit code comment. No other endpoints exist. PASS.
- **1.6 Dependency Security:** See Dependency Audit section below. No critical or high CVEs found.
- **1.7 Logging:** Pino used correctly via `pino` + `pino-http`. No `console.log` statements found anywhere in `packages/`. `pino-pretty` is gated on `NODE_ENV !== 'production'`. PASS.

### OWASP Top 10

- **Injection:** No SQL queries — no risk at this stage. Pool is a bare `new Pool({ connectionString })` — no query construction. PASS.
- **Broken Auth:** N/A for scaffold — no auth flows exist. `/health` is correctly public.
- **XSS:** React JSX used throughout — no `dangerouslySetInnerHTML` found anywhere in `packages/frontend/src/`. PASS.
- **Security Misconfiguration:** `docker-compose.yml` exposes only ports 5432 (postgres). The simplified form (postgres + migrate only) does not expose unnecessary application ports or privileged services. PASS (with LOW note on hardcoded creds above).
- **Sensitive Data Exposure:** No credentials in committed code. `.env` gitignored. PASS.

### Additional Checks

- **No `console.log` statements:** Confirmed — grep found zero matches in any `.ts` file under `packages/`. PASS.
- **TypeScript strict mode:** `tsconfig.base.json` sets `strict: true` — both packages inherit this. Backend overrides module resolution only, not strictness. PASS.
- **`DATABASE_URL` not hardcoded:** Confirmed — `pool.ts` reads from `process.env.DATABASE_URL` with a fast-fail guard. PASS.
- **`pg` pool graceful shutdown:** `SIGTERM` handler correctly calls `server.close()` then `pool.end()` before `process.exit(0)`. PASS.
- **No `dangerouslySetInnerHTML`:** Not present anywhere in the frontend. PASS.
- **React StrictMode enabled:** `main.tsx` wraps the app in `<StrictMode>` — helps surface double-render issues and deprecated API usage. PASS.
- **`.env` in `.gitignore`:** Confirmed — `.env` and `.env.*` are excluded, with `!.env.example` and `!.env.agent.example` correctly allowlisted. PASS.
- **Google Fonts loaded via HTTPS:** `global.css` imports from `https://fonts.googleapis.com` — no mixed content. PASS.

---

## Checklist Results

| Category              | Status | Critical | High | Medium | Low |
|-----------------------|--------|----------|------|--------|-----|
| Auth & Authz          | PASS   | 0        | 0    | 0      | 0   |
| Input Validation      | PASS   | 0        | 0    | 0      | 0   |
| SQL Injection         | PASS   | 0        | 0    | 0      | 0   |
| Financial Data Integrity | N/A | 0        | 0    | 0      | 0   |
| Data Exposure         | PASS   | 0        | 0    | 1      | 0   |
| Dependencies          | PASS   | 0        | 0    | 0      | 0   |
| Infrastructure        | PASS   | 0        | 0    | 0      | 2   |
| Rate Limiting         | N/A    | 0        | 0    | 0      | 0   |
| HTTP Security         | INFO   | 0        | 0    | 0      | 0   |

---

## Dependency Audit

**Note:** `npm audit` could not be executed directly by this agent in its review mode. The following is a manual assessment of declared dependencies in `packages/backend/package.json` and `packages/frontend/package.json`.

### Backend Dependencies (production)

| Package | Version Range | Notes |
|---------|--------------|-------|
| `@clerk/express` | `^1.0.0` | Clerk's official Express SDK — actively maintained, security-conscious vendor |
| `express` | `^5.0.0` | Express 5 — current major. No known critical CVEs at review date |
| `pg` | `^8.0.0` | Node-postgres — well-maintained. No known critical CVEs |
| `pino` | `^9.0.0` | Structured logging — actively maintained |
| `pino-http` | `^10.0.0` | HTTP logging middleware — actively maintained |
| `posthog-node` | `^4.0.0` | Feature flags / analytics — not yet wired in this feature |
| `zod` | `^3.0.0` | Validation — widely used, actively maintained |

### Frontend Dependencies (production)

| Package | Version Range | Notes |
|---------|--------------|-------|
| `@clerk/react` | `^5.0.0` | Clerk React SDK — matches backend Clerk version family |
| `@tanstack/react-query` | `^5.0.0` | Server state management — actively maintained |
| `posthog-js` | `^1.0.0` | Client-side analytics — not yet wired in this feature |
| `react` / `react-dom` | `^19.0.0` | React 19 — current major |
| `react-router` | `^7.0.0` | React Router v7 — current major |
| `zod` | `^3.0.0` | Shared with backend |

### Assessment

All packages are within current major versions as of the review date (2026-03-07). No packages are known abandoned. Version ranges use caret (`^`) pinning to the major version — this is acceptable for a development scaffold. **Recommendation:** Ensure a `package-lock.json` is committed and `npm audit` is integrated into the CI pipeline to catch transitive dependency vulnerabilities on every build, per L2-002 §1.6.

`@vitest/coverage-v8` in the backend `package.json` differs from the spec (`"latest"` in spec vs `"^3.0.0"` in implementation) — the implementation's pinned range is preferable over `"latest"` for reproducibility.
