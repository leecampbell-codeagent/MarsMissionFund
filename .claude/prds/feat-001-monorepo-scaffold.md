## feat-001: Monorepo Scaffold & Dev Environment

**Bounded Context(s):** Cross-cutting (all)
**Priority:** P0
**Dependencies:** None
**Estimated Complexity:** M

### Summary

Set up the monorepo structure with `packages/frontend` and `packages/backend`, shared TypeScript configuration, Docker Compose for local development (PostgreSQL, app services), linting/formatting toolchain, and CI pipeline skeleton. This is the foundation every other feature builds on.

### Acceptance Criteria

- [ ] Repository has `packages/frontend/` (Vite + React 19 + TailwindCSS v4 + TypeScript) and `packages/backend/` (Express 5 + TypeScript) directories with independent `package.json` files
- [ ] Root `package.json` with npm workspaces configured for both packages
- [ ] TypeScript strict mode enabled in both packages with shared base `tsconfig.json`
- [ ] ESLint flat config and Prettier configured at root, enforced in both packages
- [ ] `docker-compose.yml` at repo root runs PostgreSQL (Aurora-compatible), backend, and frontend with hot reload
- [ ] `Dockerfile` for backend service (multi-stage build, Node 22 LTS base)
- [ ] `.env.example` at repo root with all required environment variables documented
- [ ] `npm run dev` starts the full local stack via Docker Compose
- [ ] `npm run lint`, `npm run format`, and `npm run typecheck` work from root
- [ ] Vitest configured in both packages with initial passing test
- [ ] GitHub Actions CI workflow runs lint, typecheck, and tests on PR
- [ ] `db/migrations/` directory exists with dbmate configured
- [ ] Health check endpoint (`GET /health`) returns 200 on backend — unauthenticated per engineering standard
- [ ] Pino logger configured with pino-http middleware and pino-pretty for development
- [ ] `.gitignore` excludes `node_modules`, `.env`, `dist/`, and build artifacts

### User Story

As a developer, I want a working monorepo with local dev environment so that I can begin implementing features with confidence that the toolchain, database, and CI are functional.

### Key Decisions / Open Questions

- npm workspaces (not Turborepo or Nx) — keep it simple per "Don't Reinvent" value
- Single Docker Compose stack per architecture spec (local demo scope)
- dbmate for migrations per infra rules

### Out of Scope

- Terraform / AWS infrastructure (that is deployment, not local dev)
- Application business logic
- Authentication integration (feat-003)
- Frontend design system tokens (handled when first UI feature lands)
