# Autonomous Agent Infrastructure

Isolated Docker environment for running Claude Code with `--dangerously-skip-permissions`.
Container isolation replaces the permission model as the security boundary.

The agent uses a **digital twin GitHub account** (not personal credentials) with reduced privileges — it can create branches and PRs but cannot merge.

## Prerequisites

- Docker and Docker Compose
- A GitHub PAT for the digital twin account (scoped to `repo`)
- A Claude Code auth token (OAuth subscription or Anthropic API key)

## Quick Start

```bash
cd autonomous/

# 1. Create your credentials file
cp .env.agent.example .env.agent

# 2. Fill in real values (see Configuration below)
$EDITOR .env.agent

# 3. Build and run
docker compose build
docker compose up

# 4. Monitor
docker compose logs -f agent
```

## Configuration

Edit `.env.agent` with your credentials.
Choose **one** authentication method for Claude Code:

| Variable | Description |
|---|---|
| `CLAUDE_CODE_OAUTH_TOKEN` | Claude Code subscription token (Pro/Team/Enterprise) |
| `ANTHROPIC_API_KEY` | Anthropic API key (pay-as-you-go alternative) |

GitHub and git identity (use the digital twin account, never personal):

| Variable | Description | Example |
|---|---|---|
| `GITHUB_TOKEN` | PAT for the digital twin account | `ghp_xxxx` |
| `REPO_URL` | Repository to clone | `https://github.com/LeeCampbell/MarsMissionFund` |
| `BASE_BRANCH` | Branch to clone and base work from | `main` |
| `GIT_AUTHOR_NAME` | Commit author name | `mmf-agent` |
| `GIT_AUTHOR_EMAIL` | Commit author email | `mmf-agent@example.com` |
| `GIT_COMMITTER_NAME` | Commit committer name | `mmf-agent` |
| `GIT_COMMITTER_EMAIL` | Commit committer email | `mmf-agent@example.com` |

Runtime:

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | Postgres connection string | `postgres://mmf:mmf@postgres:5432/mmf?sslmode=disable` |
| `WEB_URL` | Vite dev server URL | `http://localhost:5173` |
| `MAX_RUNTIME` | Timeout in seconds before killing Claude Code | `43200` (12 hours) |

## What Happens When You Run It

The entrypoint (`scripts/agent-entrypoint.sh`) executes these steps in order:

1. **Clone** the target repo via `gh repo clone` (token never appears in URLs)
2. **Install dependencies** with `npm ci`
3. **Configure pre-commit hooks** via prek (merge conflict checks, secret detection, gitleaks, etc.)
4. **Configure Claude Code hooks** (biome lint/format on every file edit)
5. **Lock down the network** via iptables — only allowed destinations after this point
6. **Reset the database** — drop, recreate, run dbmate migrations
7. **Create a working branch** (`agent/<timestamp>`)
8. **Run Claude Code** with `--dangerously-skip-permissions --print`, piping in the prompt template

On exit (success, failure, or timeout), structured JSON is logged:

```json
{"event":"agent_exit","exit_code":0,"failed_step":"complete","duration_seconds":3600,"timestamp":"2026-03-05T12:00:00Z"}
```

## Network Firewall

After cloning and `npm ci` (which need unrestricted access), the firewall locks outbound traffic to:

- **Docker DNS** — `127.0.0.11:53` (required for all resolution)
- **GitHub** — `github.com`, `api.github.com`, `uploads.github.com` + official CIDR ranges
- **npm** — `registry.npmjs.org`
- **Anthropic** — `api.anthropic.com`, `statsig.anthropic.com`
- **Clerk** — `cdn.clerk.io`
- **PostHog** — `us.posthog.com`
- **Internal Docker network** — RFC1918 ranges (postgres, etc.)

Everything else is denied.

## Pre-commit Hooks (prek)

Every commit the agent makes is validated by these hooks:

- `check-merge-conflict` — blocks unresolved merge markers
- `detect-private-key` — blocks committed private keys
- `end-of-file-fixer` — ensures files end with a newline
- `trailing-whitespace` — strips trailing whitespace
- `check-json` / `check-yaml` — validates syntax
- `no-commit-to-branch` — prevents commits directly to `main`
- `gitleaks` — scans for secrets and credentials

## Claude Code Hooks

A `PostToolUse` hook runs `biome check --write` on TS/TSX/JS/JSX/JSON files after every Edit or Write operation, catching lint and formatting issues inline.

## Project Structure

```
autonomous/
├── README.md                  ← You are here
├── Dockerfile.agent           ← Agent image (Node 22, Claude Code, Playwright, gh, dbmate, biome, prek, gitleaks)
├── docker-compose.yml         ← Agent + ephemeral Postgres 16
├── .env.agent.example         ← Credential template (never commit .env.agent)
├── .dockerignore
└── scripts/
    ├── agent-entrypoint.sh    ← Container ENTRYPOINT — orchestrates the full run
    ├── init-firewall.sh       ← iptables/ipset network allowlist
    ├── reset-db.sh            ← Idempotent DB drop/recreate + dbmate up
    ├── prompt-template.md     ← Prompt piped to Claude Code
    ├── .pre-commit-config.yaml ← prek hook definitions
    └── claude-hooks/
        ├── settings.json      ← Claude Code PostToolUse hook config
        └── hooks/
            └── lint-ts-file.sh ← Biome lint on file edit
```

## Retrieving Artifacts

Test results and Playwright reports are persisted in the `agent-artifacts` volume:

```bash
# Copy artifacts out of the volume
docker compose cp agent:/workspace/test-results ./test-results

# Or inspect directly
docker run --rm -v autonomous_agent-artifacts:/data alpine ls -la /data
```

## Rebuilding

Pin tool versions via build args if needed:

```bash
docker compose build \
  --build-arg CLAUDE_CODE_VERSION=1.0.0 \
  --build-arg BIOME_VERSION=1.9.0 \
  --build-arg GH_VERSION=2.65.0 \
  --build-arg DBMATE_VERSION=2.22.0 \
  --build-arg GITLEAKS_VERSION=8.24.3 \
  --build-arg PREK_VERSION=0.5.0
```

## Teardown

```bash
docker compose down            # stop and remove containers
docker compose down -v         # also remove the artifacts volume
```
