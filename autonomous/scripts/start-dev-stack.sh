#!/usr/bin/env bash
set -euo pipefail
# Kills any existing dev processes, runs dbmate migrations, starts backend + frontend.
# Always operates from the main workspace root (not worktrees) since DB and ports are shared.

# Find the main workspace root (worktrees share the same .git, so use the main worktree)
MAIN_WORKTREE=$(git worktree list --porcelain 2>/dev/null | head -1 | sed 's/^worktree //')
WORKSPACE="${MAIN_WORKTREE:-/workspace}"

# Kill existing dev processes
pkill -f "tsx.*server" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
sleep 1

# Run migrations (idempotent)
if [ -d "${WORKSPACE}/db/migrations" ] && [ -n "$(ls -A "${WORKSPACE}/db/migrations" 2>/dev/null)" ]; then
    dbmate --url "${DATABASE_URL}" -d "${WORKSPACE}/db/migrations" up 2>&1 || echo "Warning: migrations failed"
fi

# Start backend if it exists
if [ -f "${WORKSPACE}/packages/backend/package.json" ]; then
    (cd "${WORKSPACE}/packages/backend" && npm run dev &)
fi

# Start frontend if it exists
if [ -f "${WORKSPACE}/packages/frontend/package.json" ]; then
    (cd "${WORKSPACE}/packages/frontend" && npm run dev &)
fi

# Wait for frontend
for i in $(seq 1 30); do
    curl -sf http://localhost:5173 > /dev/null 2>&1 && break
    sleep 2
done

if curl -sf http://localhost:5173 > /dev/null 2>&1; then
    echo "Dev stack ready."
else
    echo "Warning: dev stack not responding after 60s."
fi
