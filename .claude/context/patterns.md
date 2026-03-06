# Patterns

> Established implementation patterns confirmed during build cycles. Updated by all agents.

---

## Infrastructure (feat-001)

### npm workspaces monorepo structure

```
/workspace/
├── package.json          # root: workspaces: ["packages/*"], scripts delegate to workspaces
├── tsconfig.base.json    # shared: strict, noUncheckedIndexedAccess, moduleResolution: bundler
├── packages/
│   ├── backend/
│   │   ├── package.json  # type: module, scripts: dev/test/build/typecheck
│   │   ├── tsconfig.json # extends base, overrides moduleResolution: node16
│   │   └── vitest.config.ts  # environment: node
│   └── frontend/
│       ├── package.json  # scripts: dev/test/build/typecheck
│       ├── tsconfig.json # extends base, adds lib: DOM, jsx: react-jsx, types: [vitest/globals]
│       └── vitest.config.ts  # environment: jsdom
```

### Backend server pattern (Express 5 + Pino)

- Export `app` separately from `listen()` call — enables supertest imports without binding port
- Guard `listen()` with `if (process.env.NODE_ENV !== 'test')`
- Global error handler MUST have exactly 4 parameters: `(err, req, res, next)`
- Mount health router BEFORE auth middleware so `/health` is public
- Use `pino-http` for HTTP request logging, `pino-pretty` for dev only (devDependency)

### Health endpoint pattern

```typescript
// src/health/api/health-router.ts
import { Router } from 'express';
export const healthRouter: Router = Router();
healthRouter.get('/', (_req, res) => { res.json({ status: 'ok' }); });
```
Mounted at `/health` → responds at `GET /health` → `{"status":"ok"}`

### Frontend placeholder pattern (before real pages exist)

```tsx
export function App() {
  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center">
      <h1 className="text-4xl font-bold">Mars Mission Fund</h1>
    </main>
  );
}
```

### Tailwind v4 CSS setup

```css
/* src/index.css */
@import "tailwindcss";
```
No `@tailwind base/components/utilities` directives (v3 pattern).
Use `@tailwindcss/vite` plugin in `vite.config.ts`, NOT PostCSS.

### GitHub PR creation via REST (not gh CLI)

```bash
gh api repos/{owner}/{repo}/pulls --method POST \
  -f title="..." \
  -f head="branch-name" \
  -f base="main" \
  -f body="..."
```
Use REST API (`gh api`) not `gh pr create` — the latter fails with PATs via GraphQL.

### Commit message format

```
feat(context): description
test(context): description
chore: description
fix(context): description
```
Always include `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>` trailer.

### dbmate migration pattern (feat-002)

- Files in `db/migrations/YYYYMMDDHHMMSS_description.sql`
- Format: `-- migrate:up` / `-- migrate:down` sections (no BEGIN/COMMIT — dbmate wraps in its own transaction)
- `CREATE TABLE IF NOT EXISTS` for idempotency
- Apply `update_updated_at_column()` trigger to every table with `updated_at`
- Append-only tables (escrow_ledger): no `updated_at`, no trigger
- User_roles: no `updated_at` (revocation via deletion, not update)
- All FKs: explicit ON DELETE (RESTRICT for financial records, CASCADE for parent-child)
- All status/enum columns: CHECK constraint with exhaustive value list
- All monetary: BIGINT only — never FLOAT/NUMERIC/DECIMAL for money
- UUID PKs: `DEFAULT gen_random_uuid()` on id column
- Trigger name pattern: `set_{table_name}_updated_at`

### Auth middleware pattern (feat-003)

```typescript
// server.ts — order matters:
app.use(correlationIdMiddleware)      // sets X-Request-Id + req.correlationId
app.use('/health', healthRouter)      // PUBLIC — before Clerk
app.use(buildClerkMiddleware(IS_MOCK_AUTH))  // Clerk or mock
app.use(createMmfAuthMiddleware(authSyncService, IS_MOCK_AUTH))
app.use('/api/v1', apiRouter)         // all protected routes
```

- `IS_MOCK_AUTH = process.env.MOCK_AUTH === 'true'` at module scope (not per-request)
- Mock middleware ONLY injects mock user if `Authorization` header is present
- In mock mode, `createMmfAuthMiddleware` MUST NOT call `getAuth(req)` — real Clerk middleware not mounted
- Use the `isMockAuth` parameter to branch before calling `getAuth()`

### PostgreSQL repository integration test pattern (feat-003)

```typescript
const TEST_PREFIX = 'test_pg_repo_';
beforeEach(() => pool.query(`DELETE FROM users WHERE clerk_id LIKE $1`, [`${TEST_PREFIX}%`]));
afterEach(() => pool.query(`DELETE FROM users WHERE clerk_id LIKE $1`, [`${TEST_PREFIX}%`]));
// Use TEST_PREFIX on all test clerk_ids for isolation
```

### Biome lint suppressions (feat-003)

- JSX: `{/* biome-ignore lint/a11y/useSemanticElements: reason */}` on line before element
- CSS `!important` in `prefers-reduced-motion`: leave as warnings (not errors) — suppression not supported for CSS blocks
- Dot notation: always use `obj.property` not `obj['property']` for known keys
### TanStack Query + typed API client pattern (feat-004)

```typescript
// lib/api-client.ts — typed wrappers around fetchWithAuth hook
export function useTypedApiClient() {
  const { fetchWithAuth } = useApiClient();
  async function get<T>(path: string): Promise<T> { ... }
  async function put<T>(path: string, body: unknown): Promise<T> { ... }
  return { get, put, post, patch };
}

// hooks/use-current-user.ts
export function useCurrentUser() {
  const client = useTypedApiClient();
  return useQuery({ queryKey: ['me'], queryFn: () => client.get<MeResponse>('/api/v1/me'), staleTime: 30_000 });
}
```

- `invalidateQueries({ queryKey: ['me'] })` in mutation `onSuccess` refreshes user data
- Fire-and-forget mutations: call `mutate()` without awaiting/handling errors for best-effort updates

### Zod schema patterns (feat-004)

- Always add `.strict()` to object schemas for endpoint request bodies — rejects unknown fields with 400
- Exception: schemas where `display_name: null` means "clear" vs undefined means "keep" use
  `'display_name' in parsed.data` to distinguish between not-provided and explicitly-null
- Use `z.enum(['backer', 'creator'])` for role allowlists — type-safe and auto-documented
- Zod v4: error object uses `.issues` not `.errors` for validation error access

### DB CHECK constraint pattern (feat-004)

```sql
-- Always add CHECK constraints for enum-like string columns
ALTER TABLE user_roles
  ADD CONSTRAINT chk_user_roles_role
    CHECK (role IN ('backer', 'creator', 'admin', 'moderator'));

-- For range-constrained nullable integers
ALTER TABLE users
  ADD CONSTRAINT chk_users_onboarding_step
    CHECK (onboarding_step IS NULL OR (onboarding_step >= 1 AND onboarding_step <= 3));
```
