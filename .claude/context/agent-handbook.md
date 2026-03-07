# Agent Handbook

> Shared operational protocols for all MMF agents. Keep this file under 100 lines.

## Ralph Loop Protocol

Every agent runs in a Ralph loop — an iterative cycle that continues until all completion criteria are met. The canonical pattern:

1. **Read** — Load all input files listed in your Inputs section. Understand the spec, the codebase, and the constraints before acting.
2. **Implement** — Do the work described in your Task section. Make concrete progress each iteration.
3. **Validate** — Run the relevant checks (tests, builds, linters, plan). Fix any failures before proceeding.
4. **Self-check** — Review every item in your Completion Criteria. Be honest — if something isn't done, it isn't done.
5. **Iterate or complete** — If any criterion is unmet, loop back to step 2. If all are met, signal completion to the orchestrator.

Each iteration should make measurable progress. If you're stuck on the same failure for two iterations, re-read the inputs and try a different approach.

## Spec Conflict Resolution

When authoritative sources disagree, apply this priority order:

1. **CLAUDE.md** — Architecture, security, quality gates (non-negotiable)
2. **L2 standards** (`specs/standards/*.md`) — Engineering and brand standards
3. **L3 tech specs** (`specs/tech/*.md`) — Architecture, security, frontend, data management
4. **L4 domain specs** (`specs/domain/*.md`) — Business rules, state machines, invariants
5. **Feature spec** (`feat-XXX-spec.md` / `feat-XXX-design.md`) — The contract for this feature
6. **Existing codebase patterns** (`.claude/context/patterns.md`)

**Resolution procedure:**

- Higher-layer spec always wins over lower-layer spec.
- When you find a conflict, implement per the higher-layer spec.
- Flag the deviation in the PR description or output report — never silently override.
- If two specs at the same layer disagree, flag as blocking and surface to the orchestrator.

See `.claude/context/glossary.md` for the full layer definitions and canonical terminology.

## Completion Criteria Common Checks

Most agents should verify these where applicable. Your agent-specific criteria take precedence — these are shared checkpoints to pull from, not a replacement.

**Build and quality:**
- `npm run build` succeeds with no TypeScript errors
- `npm test` passes
- No `any` types in new code
- No `console.log` in committed code
- Lint clean (Biome)

**Code standards:**
- Named exports only (except page-level React defaults)
- All props and function parameters typed
- Domain errors extend `DomainError` with unique `code`
- Parameterised SQL queries only (`$1`, `$2`) — never string interpolation

**Context maintenance:**
- Update `.claude/context/patterns.md` with new patterns established
- Update `.claude/context/gotchas.md` with pitfalls discovered
