# Autonomous Agent Infrastructure: Docker Compose for MarsMissionFund

## Context

An autonomous coding agent runs long-running agentic loops inside a Docker container for the **MarsMissionFund** full-stack application (TypeScript/Node.js, Postgres, Vite dev server, Vitest unit tests, Playwright e2e tests, Biome linting).

The goal is to create an isolated environment that is safe to run Claude Code with `--dangerously-skip-permissions`. Container isolation replaces the permission model as the security boundary. The agent uses a digital twin / reduced-privilege GitHub account (not personal credentials) with PAT tokens scoped to minimum required permissions (can create PRs but cannot merge).

This is **not** a devcontainer (no host volume mounts, no IDE attachment). It is a standalone Docker Compose stack that runs autonomously. Monitor via `docker compose logs -f`.

## Architecture Requirements

### 1. Docker Compose Services

Define a `docker-compose.yml` with the following services:

#### Agent Container

- Based on `node:22-bookworm` (or similar Debian-based Node.js 22.x image)
- Toolchain installed in the Dockerfile:
  - `node 22.x`, `npm`, `git`
  - `gh` (GitHub CLI) — for creating PRs and interacting with GitHub
  - `iptables` — required for the network firewall (Debian 12 uses `iptables-nft` backend; install the `iptables` package explicitly)
  - `dbmate` — database migrations
  - `@anthropic-ai/claude-code` (installed globally via npm) — the autonomous agent
  - Playwright browsers (`npx playwright install --with-deps chromium`) — Chromium only to reduce image size by ~1GB; add Firefox/WebKit later if needed
  - Biome (installed globally via npm)
  - [prek](https://prek.j178.dev/) (installed globally via npm) — pre-commit hooks for linting TS/JS/JSON/markdown, fixing line endings, protecting main branch, detecting merge conflicts, blocking private keys and large files. Note: prek requires a `.pre-commit-config.yaml` in the target repo to define which hooks to run.
- **Pin all tool versions** in the Dockerfile for reproducible builds:
  - `gh` — pin to a specific release (e.g. `gh_2.x.x_linux_amd64.deb`)
  - `dbmate` — pin to a specific release
  - `@anthropic-ai/claude-code` — use `ARG CLAUDE_CODE_VERSION=latest` so the version is parameterisable at build time
  - `@biomejs/biome` — pin version
  - `prek` — pin version
- Requires `cap_add: NET_ADMIN` in docker-compose.yml for iptables firewall rules
- Has network access to Postgres via Docker Compose DNS (e.g. `postgres:5432`)
- The agent clones the repo inside the container (not volume-mounted) — this runs autonomously, no host filesystem involvement
- Environment variables for:
  - `GITHUB_TOKEN` — PAT token for the digital twin account (reduced privileges, can create PRs but not merge)
  - `GIT_AUTHOR_NAME` / `GIT_AUTHOR_EMAIL` — digital twin identity (not personal git identity)
  - `GIT_COMMITTER_NAME` / `GIT_COMMITTER_EMAIL` — same digital twin identity
  - `CLAUDE_CODE_OAUTH_TOKEN` — Claude Code plan token
  - `DATABASE_URL` — connection string pointing to the Postgres service (e.g. `postgres://mmf:mmf@postgres:5432/mmf?sslmode=disable`)
  - `WEB_URL` — base URL for the Vite dev server (default `http://localhost:5173`)
  - `REPO_URL` — the GitHub repo to clone (e.g. `https://github.com/LeeCampbell/MarsMissionFund`)
  - `BASE_BRANCH` — the branch to clone and base work from (default `main`)
  - `MAX_RUNTIME` — maximum runtime in seconds before the entrypoint kills the Claude Code process (default `14400` / 4 hours). Prevents runaway sessions burning API credits.
- **Health check**: The entrypoint runs a background loop that touches `/tmp/agent-alive` every 5 minutes. The Compose health check tests file freshness (e.g. `test $(( $(date +%s) - $(stat -c %Y /tmp/agent-alive) )) -lt 360`). This lets `docker compose ps` show if the agent is stuck.
- **Writable paths**: The following paths must remain writable for the toolchain to function — document these so that adding `read_only: true` later doesn't break the build: `/tmp`, `/workspace`, `/home/agent/.cache` (Playwright browser cache), `/home/agent/.npm`
- **Artifact volume** (optional): A named volume `agent-artifacts` mounted at `/workspace/test-results`. The prompt template should instruct Claude to copy Playwright reports and test output here. This survives container teardown for debugging failed runs.
- `depends_on: postgres: condition: service_healthy` — Docker handles startup ordering

#### Postgres Service

- Standard `postgres:16` image
- Configured with: `POSTGRES_USER=mmf`, `POSTGRES_PASSWORD=mmf`, `POSTGRES_DB=mmf` (must match `DATABASE_URL`)
- Ephemeral (no persistent volume — clean state each time the stack starts)
- Health check: `pg_isready -U mmf -d mmf` with interval/timeout/retries
- Accessible on port `5432` within the Docker Compose network (not exposed to host)

### 2. Database Reset Strategy

The agent does NOT spin up and tear down services.
Instead:

- Services run persistently for the duration of the agent session
- Before each test run, the agent executes a reset script that:
  1. Drops all tables (or drops and recreates the database)
  2. Runs `dbmate up` to apply all migrations from scratch
  3. Optionally seeds test data
- This script must be **idempotent** — safe to run repeatedly
- The `scripts/reset-db.sh` is `COPY`'d into the Docker image at `/opt/agent/scripts/reset-db.sh`

### 3. Security

- **Git identity**: All commits must use the digital twin account, never personal identity.
  Configure this via environment variables, NOT global git config.
- **GitHub PAT**: Scoped to `repo` (or minimum required).
  The digital twin account should have:
  - Read access to the repo
  - Write access to create branches and PRs
  - NO merge permissions
- **Clone authentication**: Use `gh repo clone` instead of embedding tokens in URLs. The `gh` CLI natively reads the `GITHUB_TOKEN` env var for authentication — no token appears in URLs, `/proc/*/cmdline`, `ps` output, or shell history. All subsequent git push and PR operations also use `gh` (which reads `GITHUB_TOKEN` automatically).
- **Host filesystem protection**: No volumes mounted from the host.
  The agent cannot access or modify anything outside the container.
- **Network firewall**: `scripts/init-firewall.sh` (baked into the image at `/opt/agent/scripts/init-firewall.sh`) restricts outbound traffic using iptables rules. The container requires `cap_add: NET_ADMIN` for this. The entrypoint script must run this **after** `git clone` and `npm ci` (which need unrestricted DNS/network access) but **before** handing control to Claude Code. Allowed destinations once the firewall is active:
  - Docker embedded DNS resolver (`127.0.0.11` on port 53 UDP/TCP) — required for all domain resolution to work
  - `github.com`, `api.github.com`, `uploads.github.com` — git push and PR creation
  - `registry.npmjs.org` — npm package installs (Claude Code may add dependencies)
  - `api.anthropic.com`, `statsig.anthropic.com` — Claude Code API
  - `cdn.clerk.io` — Clerk authentication (if used at runtime)
  - `us.posthog.com` — PostHog analytics (if used at runtime)
  - Internal Docker Compose services by service name (e.g. `postgres`)
  - All other outbound traffic is denied by default
  - **DNS resolution strategy**: The firewall script runs once at init (before lockdown) and must resolve allowed domains to IPs:
    - Use `ipset` (type `hash:ip` with a timeout) for efficient iptables matching
    - Resolve each allowed domain with `dig +short <domain> | grep -E '^[0-9]'` (filter for A records only)
    - Add resolved IPs to the ipset
    - For GitHub, also fetch official CIDR ranges from `https://api.github.com/meta` (the `web`, `api`, and `git` arrays) and add them to the ipset as a fallback for CDN rotation
    - Use `iptables --match-set <setname> dst -j ACCEPT` instead of individual IP rules
    - IPs are resolved once at firewall init; if a domain rotates IPs mid-session, the GitHub CIDR fallback covers the most critical case

### 4. Agent Entrypoint Script

`scripts/agent-entrypoint.sh` is `COPY`'d into the image at `/opt/agent/scripts/agent-entrypoint.sh` and set as the container's `ENTRYPOINT`.

The script must begin with `set -euo pipefail` and include a `trap` handler on `EXIT` that logs a structured JSON object on any exit (success, failure, or signal):
```json
{"event": "agent_exit", "exit_code": N, "failed_step": "...", "timestamp": "..."}
```

It also starts a background liveness loop: `while true; do touch /tmp/agent-alive; sleep 300; done &`

Steps:

1. Clones the target repo: `gh repo clone ${REPO_URL} /workspace -- --branch ${BASE_BRANCH}` (the `gh` CLI reads `GITHUB_TOKEN` from the environment — no token in URLs)
2. `cd /workspace` and runs `npm ci` (strict lockfile for reproducibility)
3. Runs `/opt/agent/scripts/init-firewall.sh` to lock down outbound network access
4. Runs `/opt/agent/scripts/reset-db.sh`
5. Creates a working branch (e.g. `agent/<timestamp>` or `agent/<session-id>`)
6. Invokes `timeout --signal=SIGINT --kill-after=60 ${MAX_RUNTIME} claude --dangerously-skip-permissions --print` with the prompt template piped from `/opt/agent/scripts/prompt-template.md`. The `--signal=SIGINT` gives Claude Code a chance to clean up gracefully; `--kill-after=60` force-kills if it doesn't exit within 60 seconds of the signal.
7. On completion (success, failure, or timeout), logs a structured JSON object to stdout: `{"event": "agent_complete", "exit_code": N, "duration_seconds": N, "branch": "...", "pr_url": "..."}`. This makes results parseable for future automation.

Note: Postgres readiness is handled by `depends_on: condition: service_healthy` in docker-compose.yml, so the entrypoint does not need to poll.

### 5. Project Structure

All scripts are `COPY`'d into the Docker image at `/opt/agent/scripts/`. They are part of this infrastructure repo, not the target repo.

```text
docker-compose.yml
Dockerfile.agent              # Agent container with Node.js 22, Claude Code, Playwright, gh, dbmate, Biome, prek, iptables
.dockerignore                 # Excludes .git, node_modules, .env* (except .env.agent.example), prompts/
scripts/
  agent-entrypoint.sh         # Agent bootstrap and launcher (ENTRYPOINT)
  init-firewall.sh            # iptables allowlist for outbound traffic
  reset-db.sh                 # Idempotent database reset
  prompt-template.md          # Prompt template for Claude Code (placeholder — see below)
.env.agent.example            # Example env file documenting both auth options:
                              #   CLAUDE_CODE_OAUTH_TOKEN — subscription credits (Pro/Team/Enterprise)
                              #   ANTHROPIC_API_KEY — API pay-as-you-go (alternative)
                              # Never commit real credentials
```

**Note:** `.env.agent` (the real credentials file) must be listed in `.gitignore`.

### 6. Prompt Template (Placeholder)

`scripts/prompt-template.md` is baked into the image and passed to Claude Code by the entrypoint. This is a **placeholder** — the actual prompt content for the planning and implementation loops will be defined separately. For now, it should contain a minimal working template that instructs the agent to:

1. **Read `CLAUDE.md`** at the repo root — this is the entry point to all project conventions and specifications (it references `specs/README.md`). Note: `CLAUDE.md` and `specs/` exist in the **target repo** (MarsMissionFund), not this infrastructure repo.
2. Read the governing specs identified via `specs/README.md` for the relevant domain
3. Explore the codebase to understand the architecture
4. Implement the required changes
5. Run `npx biome check --write .` to fix formatting and lint issues
6. Run `npx vitest run` to verify unit and integration tests pass
7. Reset the database using `/opt/agent/scripts/reset-db.sh`
8. Start the Vite dev server: `npm run dev &`, capture the PID (`DEV_PID=$!`), and poll `http://localhost:5173` until ready (e.g. `curl --retry 10 --retry-delay 2 --retry-connrefused http://localhost:5173`)
9. Run the end-to-end test suite: `npx playwright test`. Copy Playwright reports and test output to `/workspace/test-results` for artifact extraction.
10. Kill the dev server: `kill $DEV_PID` — this prevents port conflicts if retrying. If tests fail, iterate on the fix (up to 3 attempts), restarting the dev server each time.
11. Commit changes with a descriptive message
12. Push the branch and create a PR with:
    - Description explaining what was changed and why
    - Test results summary
13. If unable to complete the task, create a PR anyway with a `needs-review` label and explanation of what's blocking

## Constraints

- Do NOT use Docker socket mounting — services run persistently via Compose, not orchestrated by the agent at runtime
- Do NOT rely on Claude Code's permission model for security — Docker is the security boundary
- All git operations must use the digital twin identity, never the host user's identity
- No host volume mounts — the agent clones the repo inside the container
- The setup must work on both Linux and macOS hosts (and Windows via WSL2)
- Keep it simple — this is infrastructure for an autonomous agent, not a production deployment
- Single-agent only — no fleet orchestration needed at this stage
- Monitor the agent via `docker compose logs -f agent`
