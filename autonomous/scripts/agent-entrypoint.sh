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
echo "Cloning ${REPO_URL} (branch: ${BASE_BRANCH:-main})..."
gh repo clone "${REPO_URL}" /workspace -- --branch "${BASE_BRANCH:-main}"
cd /workspace

# ---------------------------------------------------------------------------
# Step 2: Install dependencies
# ---------------------------------------------------------------------------
STEP="npm_ci"
echo "Installing dependencies..."
npm ci

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
echo "Resetting database..."
/opt/agent/scripts/reset-db.sh

# ---------------------------------------------------------------------------
# Step 5: Create working branch
# ---------------------------------------------------------------------------
STEP="branch"
BRANCH_NAME="agent/$(date +%Y%m%d-%H%M%S)"
git checkout -b "${BRANCH_NAME}"
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
