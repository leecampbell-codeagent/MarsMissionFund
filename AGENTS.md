# Agent Learnings

> Accumulated insights from agent-driven development cycles. Updated after each pipeline run.

## Patterns Discovered

### Monorepo npm workspaces

- Root `package.json` uses `"workspaces": ["packages/*"]` to link backend and frontend.
- Root scripts delegate with `npm run <cmd> --workspaces --if-present`.
- Per-workspace commands: `npm run test --workspace=packages/backend`.

### TypeScript module resolution split

- Backend: `"module": "CommonJS"`, `"moduleResolution": "node10"` in its own tsconfig.
- Frontend: `"module": "ESNext"`, `"moduleResolution": "bundler"` via composite tsconfig.app.json.
- Never use the base `"bundler"` resolution for backend — it only works with Vite.

### Hexagonal architecture structure

- Every bounded context has: `domain/`, `ports/`, `adapters/`, `application/`, `api/` directories.
- Contexts: account, campaign, donor, payments, kyc, shared.
- Domain layer: zero infrastructure imports (no pg, no express, no fetch).

### CSS design token two-tier architecture

- Tier 1 identity tokens: raw values, declared in `:root` — never referenced in components.
- Tier 2 semantic tokens: purpose-named, reference Tier 1 via `var()` — only these in components.
- Opacity-derived tokens must resolve to `rgba()` values (CSS `var()` can't do runtime opacity math).

## Common Pitfalls

### GitHub token permissions

- The `GITHUB_TOKEN` in the agent container lacks `createPullRequest` permission.
- All PRs must be created manually (see MANUAL-003 pattern in `.claude/manual-tasks.md`).
- Branch push succeeds — only PR creation is blocked.

### gitleaks false positives in reports

- The gitleaks pre-commit hook matches pattern `whsec_` as a Stripe webhook secret.
- Do not include the literal string `whsec_placeholder` in committed report files.
- Use descriptive prose instead: "webhook secret placeholder value".

### Vite version hoisting

- npm workspaces hoist the newest Vite to root `node_modules`.
- Frontend `package.json` must specify the same major as the hoisted version.
- Check `ls node_modules/vite/package.json | xargs grep version` to see what's hoisted.

### Coverage thresholds

- Infrastructure adapters (pool.ts) must be excluded from coverage thresholds.
- These can't be unit-tested without a real DB connection.
- Add them explicitly to `coverage.exclude` in `vitest.config.ts`.

## Performance Notes

### feat-001 pipeline timing (approx)

- Product Strategist: ~7 min (17 features, full domain spec reads)
- Spec track (researcher + writer + design speccer + validator): ~9 min
- Implementation (backend + frontend + infra, parallel): ~10 min
- Quality track (4 agents, 2 iterations): ~10 min
- Total for feat-001: ~36 min

### Parallel agent strategy

- Backend, frontend, and infra engineers can run in parallel for scaffold features.
- For features with domain logic, backend must complete before frontend (API contract needed).
- Quality track agents run sequentially by design (each validates the previous).
