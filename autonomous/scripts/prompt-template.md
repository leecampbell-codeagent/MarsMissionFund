## Runtime Environment — READ THIS FIRST

You are running inside an isolated Docker container (Debian/Node 22). Before you started, the entrypoint already: cloned the repo to `/workspace`, ran `npm ci`, generated `.env` from `.env.example`, configured pre-commit hooks (prek), reset the database with all migrations applied, started the dev stack, and created a working branch.

### What is already running

- **PostgreSQL** at `postgres:5432` (user: `mmf`, password: `mmf`, db: `mmf`). All migrations applied. `DATABASE_URL` is set. Do NOT provision or start a database — just use it.
- **Dev stack** — backend at `localhost:3000`, frontend at `localhost:5173`. Restart with `make dev-stack` after migrations or code changes.
- **Pre-installed tools:** `node`, `npm`, `dbmate`, `psql`, `gh`, `playwright` (Chromium), `biome`, `prek`, `gitleaks`, `curl`, `jq`

### What is NOT available

- **No Docker daemon** — you are INSIDE a container. Never create `docker-compose.yml`, Dockerfiles, or Docker-based dev setup. The dev environment is this container.
- **No outbound HTTPS** except allowlisted domains (GitHub, npm, Anthropic, Clerk, PostHog). Use WebSearch instead of WebFetch for docs.
- **No sudo / no package installs** — work with what's pre-installed.

Feature briefs and specs should describe application features, not infrastructure setup. The local infrastructure is already solved.

### Escalation — when to alert a human

If you are stuck on the same problem for 3+ attempts, you are fighting the environment. Stop retrying and escalate:

1. Write a report to `.claude/reports/agent-blocked-[timestamp].md` (what failed, what you tried, likely cause)
2. Commit and push to your current branch
3. Create a GitHub issue:
   ```bash
   gh issue create \
     --title "Agent blocked: [brief description]" \
     --label "agent-blocked" \
     --body "## Problem
   [What went wrong]

   ## What I tried
   [List of attempts]

   ## Likely cause
   [Environment config / missing tool / firewall rule / etc.]

   ## Report
   See .claude/reports/agent-blocked-[timestamp].md on branch [current-branch]"
   ```
4. Move on to the next feature or stop gracefully

---

study @specs/README.md
/pm:pipeline-start
