## feat-001: Project Infrastructure and Monorepo Setup

**Bounded Context(s):** Cross-cutting (infrastructure)
**Priority:** P0
**Dependencies:** None
**Estimated Complexity:** M

### Summary

Establishes the monorepo workspace structure with `packages/frontend` and `packages/backend` packages, wiring up build tooling, TypeScript configuration, Biome linting, and Docker Compose for local development. Nothing else can be built until this foundation exists.

### Acceptance Criteria

- [ ] `packages/frontend` and `packages/backend` directories exist with valid `package.json` files registered as workspaces in the root `package.json`
- [ ] TypeScript strict mode is configured in both packages (`"strict": true` in tsconfig)
- [ ] Biome is configured at the root and runs lint + format checks across both packages via `npm run lint`
- [ ] `docker-compose.yml` exists at the project root and starts a PostgreSQL 16 container on port 5432
- [ ] `docker-compose.yml` includes a dbmate service that can run migrations via `docker-compose run dbmate up`
- [ ] Running `docker-compose up` brings the database up with the existing migration applied (`schema_migrations` table contains `20260305120000_add_updated_at_trigger`)
- [ ] `.env.example` documents all required environment variables with placeholder values
- [ ] `packages/backend` has an Express server that starts and responds `200` on `GET /health`
- [ ] `packages/frontend` has a Vite + React 19 scaffold that builds successfully via `npm run build`
- [ ] Root `npm run dev` script starts both frontend and backend in development mode

### User Story

As a developer, I want a working local development environment so that I can build and test features without manual setup friction.

### Key Decisions / Open Questions

- Node.js version should be pinned in `.nvmrc` or `engines` field — use Node 22 LTS
- Backend framework: Express (per tech stack spec L3-008)
- Frontend bundler: Vite (per tech stack spec L3-008)
- Pino for backend logging, pino-pretty in development only

### Out of Scope

- CI/CD pipeline configuration
- Production infrastructure (Terraform)
- Any application features or business logic
- Authentication integration (that is feat-003)
