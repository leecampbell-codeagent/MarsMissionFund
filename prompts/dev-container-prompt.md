# Autonomous Agent Infrastructure: Docker Compose for MarsMissionFund

## Context

An autonomous coding agent ("Ralph Wiggum") runs overnight to pick up GitHub issues and submit PRs.
The current setup:

- A bash script spins up a Docker Compose stack
- Passes environment variables and a prompt document
- Clones the repo, pulls a GitHub issue, and autonomously creates a PR
- Uses a digital twin / reduced-privilege GitHub account (not personal credentials)
- Uses PAT tokens scoped to the minimum required permissions (can create PRs but cannot merge)
- Runs one issue at a time (single-agent, not a fleet)

This prompt describes how to extend the setup for the **MarsMissionFund** full-stack application: TypeScript/Node.js, Postgres, Vite dev server, Vitest unit tests, Playwright e2e tests, and Biome linting.

## Architecture Requirements

### 1. DevContainer Configuration

Create a `.devcontainer/devcontainer.json` and supporting Docker infrastructure that:

- Runs Claude Code with `--dangerously-skip-permissions` inside the container (this is safe because Docker provides the isolation boundary)
- Uses Docker Compose to orchestrate the agent container and Postgres
- The agent container is the primary devContainer
- Postgres runs as a **persistent companion container** — it is NOT started and stopped per test run
- The agent runs the Vite dev server as a background process inside its own container (no separate web container)

### 2. Docker Compose Services

Define a `docker-compose.yml` with the following services:

#### Agent Container (primary devContainer)

- Based on `node:22-bookworm` (or similar Debian-based Node.js 22.x image)
- Toolchain installed: `node 22.x`, `npm`, `git`, `dbmate`, Playwright browsers (`npx playwright install --with-deps`), Biome
- Has network access to Postgres via Docker Compose DNS (e.g. `postgres:5432`)
- The agent clones the repo inside the container (not volume-mounted), since this runs autonomously overnight
- Environment variables for:
  - `GITHUB_TOKEN` — PAT token for the digital twin account (reduced privileges, can create PRs but not merge)
  - `GIT_AUTHOR_NAME` / `GIT_AUTHOR_EMAIL` — digital twin identity (not personal git identity)
  - `GIT_COMMITTER_NAME` / `GIT_COMMITTER_EMAIL` — same digital twin identity
  - `CLAUDE_CODE_OAUTH_TOKEN` — Claude Code plan token
  - `DATABASE_URL` — connection string pointing to the Postgres service (e.g. `postgres://mmf:mmf@postgres:5432/mmf?sslmode=disable`)
  - `WEB_URL` — base URL for the Vite dev server (default `http://localhost:5173`)
  - `REPO_URL` — the GitHub repo to clone (e.g. `https://github.com/LeeCampbell/MarsMissionFund`)
  - `ISSUE_NUMBER` — the GitHub issue number to work on

#### Postgres Service

- Standard `postgres:16` image
- Ephemeral (no persistent volume — reset between runs)
- Health check so the agent knows when it's ready
- Default credentials suitable for local dev (not production secrets)
- Exposes port `5432` on the Docker network

### 3. Database Reset Strategy

The agent does NOT spin up and tear down services.
Instead:

- Services run persistently
- Before each test run, the agent executes a reset script that:
  1. Drops all tables (or drops and recreates the database)
  2. Runs `dbmate up` to apply all migrations from scratch
  3. Optionally seeds test data
- This script must be **idempotent** — safe to run repeatedly
- Create a `scripts/reset-db.sh` that the agent can invoke

### 4. Credential Isolation & Security

- **Git identity**: All commits must use the digital twin account, never personal identity.
  Configure this via environment variables, NOT global git config.
- **GitHub PAT**: Scoped to `repo` (or minimum required).
  The digital twin account should have:
  - Read access to the repo
  - Write access to create branches and PRs
  - NO merge permissions
- **Host filesystem protection**: No volumes mounted from the host beyond what Docker Compose needs.
  The agent cannot access or modify anything outside the container.

### 5. Network Firewall (Future Hardening)

For now, Docker Compose network isolation is sufficient.
The agent container and Postgres share a Compose network; Postgres is not exposed to the host.

As a future hardening step, consider restricting outbound traffic from the agent container to an allowlist:

- `github.com`, `api.github.com`, `uploads.github.com` — git operations and PR creation
- `registry.npmjs.org` — npm package installs
- `cdn.clerk.io` — Clerk authentication (if used at runtime)
- `us.posthog.com` — PostHog analytics (if used at runtime)
- `api.anthropic.com`, `statsig.anthropic.com` - For checking Claude docs?
- `sentry.io` - Sentry for security?
- Internal Docker Compose services by service name

This can be done via iptables rules or a network proxy, but is not required for the initial setup.

### 6. Agent Entrypoint Script

Create a `scripts/agent-entrypoint.sh` that:

1. Waits for Postgres to be healthy
2. Clones the target repo using the digital twin's PAT token
3. Runs `npm install`
4. Checks out a new branch named after the issue (e.g. `agent/issue-42`)
5. Pulls the assigned GitHub issue details (number passed as env var `ISSUE_NUMBER`)
6. Runs the database reset script
7. Invokes Claude Code with `--dangerously-skip-permissions` and passes the prompt template with:
   - The issue title and body
   - Instructions to read `CLAUDE.md` first (which points to `specs/README.md`)
   - Instructions to implement the change
   - Instructions to run `npx biome check` before committing
   - Instructions to run `npx vitest run` (unit/integration tests) before e2e tests
   - Instructions to start the Vite dev server (`npm run dev &`) before Playwright tests
   - Instructions to run the database reset before testing
   - Instructions to run end-to-end tests with Playwright
   - Instructions to create a PR against the main branch when done
8. On completion (success or failure), logs the outcome to stdout and optionally comments on the GitHub issue

### 7. Project Structure

```
.devcontainer/
  devcontainer.json
  docker-compose.yml
  Dockerfile.agent          # Agent container with Node.js 22, Playwright, dbmate, Biome
scripts/
  agent-entrypoint.sh       # Per-issue agent runner
  reset-db.sh               # Idempotent database reset
  prompt-template.md        # Prompt template for Claude Code
db/
  migrations/               # dbmate migrations
.env.agent.example          # Example env file (never commit real credentials)
```

### 8. Prompt Template

Create a `scripts/prompt-template.md` that will be passed to Claude Code.
It should instruct the agent to:

1. **Read `CLAUDE.md`** at the repo root — this is the entry point to all project conventions and specifications (it references `specs/README.md`)
2. Read and understand the GitHub issue
3. Read the governing specs identified via `specs/README.md` for the relevant domain
4. Explore the codebase to understand the architecture
5. Implement the required changes
6. Run `npx biome check --write .` to fix formatting and lint issues
7. Run `npx vitest run` to verify unit and integration tests pass
8. Reset the database using `scripts/reset-db.sh`
9. Start the Vite dev server: `npm run dev &` (wait for it to be ready)
10. Run the end-to-end test suite: `npx playwright test`
11. If tests fail, iterate on the fix (up to 3 attempts)
12. Commit changes with a descriptive message referencing the issue
13. Push the branch and create a PR with:
    - Title referencing the issue
    - Description explaining what was changed and why
    - Test results summary
14. If unable to complete the task, create a PR anyway with a `needs-review` label and explanation of what's blocking
15. On completion or failure, comment on the GitHub issue with the outcome

## Constraints

- Do NOT use Docker socket mounting — services run persistently via Compose, not orchestrated by the agent at runtime
- Do NOT rely on Claude Code's permission model for security — Docker is the security boundary
- All git operations must use the digital twin identity, never the host user's identity
- The setup must work on both Linux and macOS hosts (and Windows via WSL2)
- Keep it simple — this is infrastructure for an autonomous agent, not a production deployment
- Single-agent only — no fleet orchestration needed at this stage
