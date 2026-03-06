#!/usr/bin/env bash
# =============================================================================
# Convenience script to stop  the autonomous agent stack.
#
# Usage:
#   ./autonomous/stop.sh
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
docker compose down -v
