# Manual Tasks

> Tasks that require human action outside the automated pipeline.
> Agents document these here. Humans complete them.

---

## Task #1 -- Docker Desktop Installation

**Service:** Docker / Docker Compose
**Blocked feature:** feat-001 (Monorepo Scaffold & Dev Environment)
**Status:** Required prerequisite
**Priority:** High

### What This Enables
Running `npm run dev` to start the full local development stack (PostgreSQL, backend, frontend).

### Steps
1. Install Docker Desktop from https://www.docker.com/products/docker-desktop/
2. Ensure Docker Compose v2 is included (it is bundled with Docker Desktop by default)
3. Verify installation: `docker compose version` should show v2.x

### Verification
Run `docker compose version` and expect output like `Docker Compose version v2.x.x`
