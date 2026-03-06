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
