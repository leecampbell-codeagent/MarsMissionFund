#!/usr/bin/env bash
# =============================================================================
# Convenience script to build and start the autonomous agent stack.
#
# Usage:
#   ./autonomous/start.sh              # build + start (interactive)
#   ./autonomous/start.sh --build      # force rebuild before starting
#   ./autonomous/start.sh --detach     # run in background
#   ./autonomous/start.sh --logs       # start detached then tail agent logs
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env.agent"
ENV_EXAMPLE="${SCRIPT_DIR}/.env.agent.example"

# --- Preflight checks --------------------------------------------------------

if ! command -v docker &>/dev/null; then
  echo "Error: docker is not installed or not in PATH." >&2
  exit 1
fi

if ! docker compose version &>/dev/null; then
  echo "Error: docker compose plugin is not available." >&2
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "No .env.agent found. Creating from template..."
  cp "$ENV_EXAMPLE" "$ENV_FILE"
  echo "Created: ${ENV_FILE}"
  echo "Fill in your credentials, then re-run this script."
  exit 1
fi

# Check that at least one auth token is set (non-empty)
has_oauth=$(grep -E '^CLAUDE_CODE_OAUTH_TOKEN=.+' "$ENV_FILE" || true)
has_api_key=$(grep -E '^ANTHROPIC_API_KEY=.+' "$ENV_FILE" || true)
if [ -z "$has_oauth" ] && [ -z "$has_api_key" ]; then
  echo "Error: Set CLAUDE_CODE_OAUTH_TOKEN or ANTHROPIC_API_KEY in .env.agent" >&2
  exit 1
fi

has_github=$(grep -E '^GITHUB_TOKEN=.+' "$ENV_FILE" | grep -v 'ghp_xxxx' || true)
if [ -z "$has_github" ]; then
  echo "Error: Set a real GITHUB_TOKEN in .env.agent (not the placeholder)" >&2
  exit 1
fi

# --- Parse flags --------------------------------------------------------------

BUILD=false
DETACH=false
LOGS=false

for arg in "$@"; do
  case "$arg" in
    --build)  BUILD=true ;;
    --detach) DETACH=true ;;
    --logs)   DETACH=true; LOGS=true ;;
    *)
      echo "Unknown flag: $arg" >&2
      echo "Usage: $0 [--build] [--detach] [--logs]" >&2
      exit 1
      ;;
  esac
done

# --- Build & Start ------------------------------------------------------------

cd "$SCRIPT_DIR"

# Always build on first run (no image yet) or when --build is passed
if [ "$BUILD" = true ] || ! docker compose images agent --quiet 2>/dev/null | grep -q .; then
  echo "Building agent image..."
  docker compose build
fi

COMPOSE_ARGS=()
if [ "$DETACH" = true ]; then
  COMPOSE_ARGS+=(--detach)
fi

echo "Starting autonomous agent stack..."
docker compose up ${COMPOSE_ARGS[@]+"${COMPOSE_ARGS[@]}"}

if [ "$LOGS" = true ]; then
  docker compose logs -f agent
fi
