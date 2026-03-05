#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# Agent Entrypoint
# =============================================================================
# Bootstraps the workspace, locks down the network, and runs Claude Code.
# Structured JSON is logged on exit for automation.
# =============================================================================

STEP="init"
START_TIME=$(date +%s)

cleanup() {
    local exit_code=$?
    local end_time
    end_time=$(date +%s)
    local duration=$(( end_time - START_TIME ))

    # Kill background dev stack processes
    if [ -n "${DEV_PID:-}" ]; then
        kill "${DEV_PID}" 2>/dev/null || true
    fi

    echo "{\"event\":\"agent_exit\",\"exit_code\":${exit_code},\"failed_step\":\"${STEP}\",\"duration_seconds\":${duration},\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}"
    exit "${exit_code}"
}
trap cleanup EXIT

# ---------------------------------------------------------------------------
# Liveness loop — touch /tmp/agent-alive every 5 minutes
# ---------------------------------------------------------------------------
(while true; do touch /tmp/agent-alive; sleep 300; done) &

# ---------------------------------------------------------------------------
# Step 1: Clone the repo
# ---------------------------------------------------------------------------
STEP="clone"
# Clean workspace so clone succeeds on container restart (idempotent)
rm -rf /workspace/{*,.[!.]*}
echo "Cloning ${REPO_URL} (branch: ${BASE_BRANCH:-main})..."
gh repo clone "${REPO_URL}" . -- --branch "${BASE_BRANCH:-main}"

# Configure git to use gh for HTTPS authentication (enables git push)
gh auth setup-git

# ---------------------------------------------------------------------------
# Step 1b: Configure remotes
# ---------------------------------------------------------------------------
STEP="remotes"
UPSTREAM_REPO="${UPSTREAM_REPO:-}"
if [ -n "${UPSTREAM_REPO}" ]; then
    echo "Adding upstream remote: ${UPSTREAM_REPO}..."
    if git remote get-url upstream &>/dev/null; then
        git remote set-url upstream "https://github.com/${UPSTREAM_REPO}.git"
    else
        git remote add upstream "https://github.com/${UPSTREAM_REPO}.git"
    fi
    git fetch upstream main
    echo "Resetting local main to upstream/main..."
    git reset --hard upstream/main
fi

# ---------------------------------------------------------------------------
# Step 2: Install dependencies
# ---------------------------------------------------------------------------
STEP="npm_install"
if [ -f package.json ]; then
    echo "Installing dependencies..."
    if [ -f package-lock.json ]; then
        npm ci
    else
        npm install
    fi
else
    echo "No package.json found, skipping npm install."
fi

# ---------------------------------------------------------------------------
# Step 2b: Configure prek pre-commit hooks
# ---------------------------------------------------------------------------
STEP="prek"
echo "Installing prek pre-commit hooks..."
cp /opt/agent/scripts/.pre-commit-config.yaml /workspace/.pre-commit-config.yaml
prek install

# ---------------------------------------------------------------------------
# Step 2c: Configure Claude Code hooks (biome lint on Edit/Write)
# ---------------------------------------------------------------------------
STEP="claude_hooks"
echo "Installing Claude Code hooks..."
mkdir -p /workspace/.claude/hooks
cp /opt/agent/scripts/claude-hooks/settings.json /workspace/.claude/settings.json
cp /opt/agent/scripts/claude-hooks/hooks/lint-ts-file.sh /workspace/.claude/hooks/lint-ts-file.sh
chmod +x /workspace/.claude/hooks/lint-ts-file.sh

# ---------------------------------------------------------------------------
# Step 3: Lock down outbound network
# ---------------------------------------------------------------------------
STEP="firewall"
echo "Initialising firewall..."
sudo /opt/agent/scripts/init-firewall.sh

# ---------------------------------------------------------------------------
# Step 4: Reset database
# ---------------------------------------------------------------------------
STEP="db_reset"
if [ -d db/migrations ]; then
    echo "Resetting database..."
    /opt/agent/scripts/reset-db.sh
else
    echo "No migrations found, skipping database reset."
fi

# ---------------------------------------------------------------------------
# Step 4b: Start dev stack in background (for Playwright/E2E)
# ---------------------------------------------------------------------------
STEP="dev_stack"
DEV_PID=""
if [ -f package.json ] && node -e "process.exit(require('./package.json').scripts?.dev ? 0 : 1)" 2>/dev/null; then
    echo "Starting dev stack in background..."
    npm run dev &
    DEV_PID=$!
    # Wait for frontend to be ready (vite dev server)
    for i in $(seq 1 30); do
        curl -sf http://localhost:5173 > /dev/null 2>&1 && break
        sleep 2
    done
    if curl -sf http://localhost:5173 > /dev/null 2>&1; then
        echo "Dev stack ready."
    else
        echo "Warning: dev stack not responding after 60s, continuing anyway."
    fi
else
    echo "No dev script found, skipping dev stack."
fi

# ---------------------------------------------------------------------------
# Step 5: Create working branch
# ---------------------------------------------------------------------------
STEP="branch"
BRANCH_NAME="agent/$(date +%Y%m%d-%H%M%S)"
git checkout -b "${BRANCH_NAME}"
git push -u origin "${BRANCH_NAME}"
echo "Working on branch: ${BRANCH_NAME}"

# ---------------------------------------------------------------------------
# Step 6: Run Claude Code
# ---------------------------------------------------------------------------
STEP="claude"
MAX_RUNTIME="${MAX_RUNTIME:-43200}"
echo "Starting Claude Code (timeout: ${MAX_RUNTIME}s)..."

PROMPT=$(cat /opt/agent/scripts/prompt-template.md)

timeout --signal=SIGINT --kill-after=60 "${MAX_RUNTIME}" \
    claude --dangerously-skip-permissions --print \
    --output-format stream-json --verbose \
    "$PROMPT"

STEP="complete"
echo "Agent run finished successfully."
