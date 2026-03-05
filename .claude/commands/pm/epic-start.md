# /pm:epic-start

## Usage
```
/pm:epic-start feat-001
/pm:epic-start feat-001 --skip-spec
/pm:epic-start --next
```

## Description
Builds a single feature end-to-end: spec → implement → test → merge. Use `feat-XXX` to target a specific feature. Use `--next` to pick the highest-priority specced feature. Use `--skip-spec` if the feature is already specced (status "✅ SPECCED" in backlog).

## Steps

### 1. Resolve Target Feature

**If `feat-XXX` specified:**
- Read `.claude/backlog.md` — find `feat-XXX`
- Verify it exists
- Check status:
  - "✅ SPECCED" → skip to Step 3 (implementation)
  - "🔲 TODO" → start at Step 2 (spec) unless `--skip-spec`
  - "🔨 BUILDING" → resume at Step 3
  - "✅ SHIPPED" → report "Already shipped" and exit

**If `--next` specified:**
- Read `.claude/backlog.md`
- Find highest-priority feature with status "✅ SPECCED"
- If none specced: find highest-priority "🔲 TODO" and spec it first
- If backlog empty: report "No features to build" and exit

#### 1b. Resolve Base Branch

- Read this feature's dependencies from `.claude/backlog.md`
- For each dependency:
  - If "SHIPPED" → already in upstream/main, skip
  - Otherwise → check if a branch `ralph/feat-XXX-*` exists on origin:
    ```bash
    git ls-remote --heads origin "ralph/feat-XXX-*"
    ```
  - If branch exists on origin → candidate base
- **If all dependencies are SHIPPED or have no remote branch:** `BASE_BRANCH = upstream/main`, `PR_TARGET = main`
- **If one unmerged dependency branch exists:** `BASE_BRANCH` = that branch (fetch it first), `PR_TARGET` = that branch
- **If multiple unmerged dependency branches exist:** `BASE_BRANCH` = the one with the highest feat number (likely the tip of the stack), `PR_TARGET` = that branch. Fetch it first:
  ```bash
  git fetch origin <branch-name>
  ```

### 2. Spec Track (if needed)

Only runs if the feature is not yet specced.

1. Update backlog status to "📐 SPECCING"
2. Read `.claude/agents/spec-researcher.md` → run Spec Researcher
   - Output: `.claude/prds/feat-XXX-research.md`
3. Read `.claude/agents/spec-writer.md` → run Spec Writer
   - Output: `.claude/prds/feat-XXX-spec.md`
4. Read `.claude/agents/design-speccer.md` → run Design Speccer
   - Output: `.claude/prds/feat-XXX-design.md`
5. Read `.claude/agents/spec-validator.md` → run Spec Validator
   - Output: `.claude/prds/feat-XXX-validation.md`
   - If FAIL: re-run failing agent with revision instructions, re-validate
   - Loop until PASS or 3 validation attempts exhausted
6. If still failing after 3 attempts:
   - Log the validation failures
   - Update backlog with "❌ BLOCKED — spec validation failed"
   - Exit with report
7. Update backlog to "✅ SPECCED"
8. Create feature branch and commit spec artifacts (using `BASE_BRANCH` resolved in step 1b):
   ```bash
   git checkout -b ralph/feat-XXX-[name] <BASE_BRANCH>
   git add .claude/prds/feat-XXX-* .claude/backlog.md
   git commit -m "chore: spec feat-XXX [name]"
   git push -u origin ralph/feat-XXX-[name]
   ```

### 3. Pre-Implementation Setup

1. **Read all spec documents:**
   - `.claude/prds/feat-XXX-spec.md` — the implementation blueprint
   - `.claude/prds/feat-XXX-design.md` — the visual specification
   - `.claude/prds/feat-XXX-research.md` — domain context and edge cases
   - `.claude/prds/feat-XXX-validation.md` — what was approved

2. **Read shared context:**
   - `CLAUDE.md` — architecture and coding rules
   - `.claude/context/patterns.md` — established code patterns to follow
   - `.claude/context/gotchas.md` — known pitfalls to avoid

3. **Verify feature branch** (already created in step 2.8, or handle `--skip-spec`):
   - If coming from step 2.8: branch `ralph/feat-XXX-[name]` already exists and is checked out
   - If `--skip-spec` was used (skipped step 2): create the branch now:
     ```bash
     git fetch upstream main
     git checkout -b ralph/feat-XXX-[name] <BASE_BRANCH>
     ```

4. **Update backlog:**
   - Mark feature as "🔨 BUILDING" in `.claude/backlog.md`

### 4. Implementation

Run implementation agents. Each agent reads its skill file first, then the feature spec.

**Backend Engineer** (read `.claude/agents/backend-engineer.md`):
1. Create database migrations
2. Implement domain layer (entities, value objects, domain services, errors)
3. Define port interfaces
4. Implement PostgreSQL adapters (real) and mock adapters
5. Implement application services
6. Implement API controllers and routes
7. Create shared Zod schemas
8. Wire dependencies in bootstrap
9. Write unit tests (domain) and integration tests (API)
10. Verify: `npm test` passes, `npm run build` succeeds

**Frontend Engineer** (read `.claude/agents/frontend-engineer.md`):
1. Implement React components per design spec
2. Implement pages with correct layouts
3. Create TanStack Query hooks for data fetching
4. Implement API client functions
5. Implement form validation with Zod
6. Add routes to router
7. Handle all component states (default, empty, loading, error)
8. Write component tests
9. Verify: `npm test` passes, `npm run build` succeeds

**Infrastructure Engineer** (read `.claude/agents/infra-engineer.md`):
1. Verify migrations are correct and apply cleanly
2. Create Terraform modules for any new AWS resources
3. Update `.env.example` with new environment variables
4. Document manual tasks in `.claude/manual-tasks.md`
5. Update `.claude/mock-status.md`
6. Verify: `terraform validate` passes, `terraform fmt` clean

**After all implementation:**
```bash
npm test
npm run build
git add .
git commit -m "feat([context]): implement feat-XXX [name]

- [Summary of backend changes]
- [Summary of frontend changes]
- [Summary of infra changes]"
git push -u origin ralph/feat-XXX-[name]
```

### 5. Quality Gate

Run quality agents against the implementation.

**Playwright Tester** (read `.claude/agents/playwright-tester.md`):
1. Create page objects for new pages
2. Write E2E tests for every acceptance criterion
3. Write edge case tests from the spec
4. Write empty state, error state, and responsive tests
5. Verify: `npx playwright test` passes

**Security Reviewer** (read `.claude/agents/security-reviewer.md`):
1. Review all code changes against security checklists
2. Verify tenant isolation on every query
3. Verify auth on every endpoint
4. Verify input validation on every request
5. Run `npm audit`
6. Output: `.claude/reports/feat-XXX-security.md`
7. Required: 0 critical findings, 0 high findings

**Auditor** (read `.claude/agents/auditor.md`):
1. Verify architecture compliance (hex layers, bounded contexts)
2. Verify coding standards (naming, types, error handling)
3. Verify test coverage ≥ 80% overall, ≥ 90% domain
4. Verify spec compliance (implementation matches spec)
5. Verify financial data compliance (integer cents, no floating point for money)
6. Verify documentation completeness
7. Confirm security review is clean
8. Run full build verification
9. Output: `.claude/reports/feat-XXX-audit.md`
10. Required: PASS verdict

**CI/CD DevOps** (read `.claude/agents/cicd-devops.md`):
1. Verify CI pipeline supports any new test suites
2. Verify new environment variables are documented
3. Verify deployment config handles new resources

**After quality gate:**
```bash
git add .
git commit -m "test([context]): quality gate for feat-XXX [name]"
git push origin ralph/feat-XXX-[name]
```

### 5b. Screenshot Capture (after quality gate, before PR)

**Skip if:** the feature spec (`feat-XXX-spec.md`) has no frontend section (Section 7) or no new/modified routes.

**If the feature has frontend changes:**

Screenshots are uploaded to GitHub's CDN (not committed to the repo) to avoid bloating git history with binary files.

1. Identify affected routes from the feature spec's frontend section
2. Ensure the app stack is running (it should be from the Playwright tester step)
3. Open browser once: `playwright-cli open http://localhost:5173`
4. Resize once: `playwright-cli resize 1280 800`
5. For each affected route, capture to a temp file and upload to GitHub:
   ```bash
   playwright-cli goto /<route>
   # If auth required: playwright-cli state-load (use saved auth state from Playwright tester)
   playwright-cli screenshot --filename=/tmp/feat-XXX-{route-slug}.png

   # Upload to GitHub CDN — returns a markdown image URL
   SCREENSHOT_URL=$(gh api \
     --method POST \
     -H "Accept: application/json" \
     "repos/${UPSTREAM_REPO}/issues/1/comments" \
     -f body="![{route-slug}](placeholder)" \
     --jq '.body' 2>/dev/null || true)
   # Alternative: use the repository's upload mechanism
   SCREENSHOT_URL=$(gh api \
     --method POST \
     "repos/${UPSTREAM_REPO}/git/blobs" \
     -f content="$(base64 < /tmp/feat-XXX-{route-slug}.png)" \
     -f encoding=base64 \
     --jq '.url' 2>/dev/null || true)
   ```
   Store each URL for use in the PR body.
6. Close browser: `playwright-cli close`
7. Clean up temp files: `rm -f /tmp/feat-XXX-*.png`

**Edge cases:**
- **App won't start:** Skip screenshots, note in PR body: "Screenshots: app stack failed to start"
- **Auth-gated pages:** Use `playwright-cli state-load` with saved auth state from Playwright tester
- **No frontend changes:** Omit screenshots section from PR body entirely
- **Upload fails:** Fall back to noting "Screenshots: upload failed" in PR body — never commit PNGs to the repo

### 6. Fix Loop (if quality gate fails)

If any quality agent reports failures:

1. Read the failure report (audit, security, or test failure output)
2. Identify which implementation agent needs to fix the issue
3. Re-run that agent with the specific failure context:
   - "The Auditor found: [failure]. Fix this in [file] by [instruction]."
4. Re-run the quality gate
5. Repeat up to 3 times
6. If still failing after 3 fix loops:
   - Document the failures in `.claude/reports/feat-XXX-blocked.md`
   - Update backlog: "❌ BLOCKED — [reason]"
   - Leave the branch as-is (don't merge)
   - Exit with report

### 7. Create PR to Upstream

All quality checks passed. Create a PR for review.

1. **Final verification:**
   ```bash
   npm test
   npm run build
   npx playwright test
   ```

2. **Push and create PR** (using `PR_TARGET` resolved in step 1b):
   ```bash
   git push origin ralph/feat-XXX-[name]
   gh pr create \
     --repo "${UPSTREAM_REPO}" \
     --head "leecampbell-codeagent:ralph/feat-XXX-[name]" \
     --base <PR_TARGET> \
     --title "feat-XXX: [name]" \
     --body "## Summary
   - [2-3 bullet points of what was built]
   - **Stacked on:** <PR_TARGET> (if not main — merge parent PR first)

   ## Screenshots
   ![route-name](<SCREENSHOT_URL from step 5b>)
   [Repeat for each captured route using the GitHub CDN URLs from step 5b. If no frontend changes, omit this section entirely.]

   ## Quality Gate
   - Tests: all passing
   - Coverage: XX%
   - Security: 0 critical/high findings
   - Audit: PASS
   - E2E: PASS

   ## Reports
   - Exploratory: .claude/reports/feat-XXX-exploratory.md
   - Security: .claude/reports/feat-XXX-security.md
   - Audit: .claude/reports/feat-XXX-audit.md"
   ```
   - If `PR_TARGET` is `main`, omit the "Stacked on" line from the body.
   - If the feature has **no frontend changes**, omit the `## Screenshots` section entirely.

### 8. Post-PR

1. **Update backlog:**
   - Mark feature as "✅ SHIPPED" in `.claude/backlog.md`

2. **Write merge report:**
   Create `.claude/reports/feat-XXX-merge.md`:
   ```markdown
   # Merge Report: feat-XXX — [Name]

   ## Shipped: [timestamp]
   ## Branch: ralph/feat-XXX-[name] → PR to upstream/main

   ## Summary
   [2-3 sentences: what was built]

   ## Changes
   - **Backend:** [migrations, entities, endpoints added]
   - **Frontend:** [pages, components added]
   - **Infrastructure:** [terraform, config changes]

   ## Test Results
   - Unit tests: XX passed, 0 failed
   - Integration tests: XX passed, 0 failed
   - E2E tests: XX passed, 0 failed
   - Coverage: XX%

   ## Security
   - 0 critical, 0 high, X medium, X low

   ## Manual Tasks Created
   - [ ] Task #N — [description] — [blocked feature]

   ## Changelog
   - feat([context]): [description]
   ```

3. **Update knowledge base:**
   - Add any new patterns to `.claude/context/patterns.md`
   - Add any pitfalls discovered to `.claude/context/gotchas.md`
   - Add agent learnings to `AGENTS.md`

4. **Commit and push knowledge updates to the feature branch:**
   ```bash
   git add .claude/ AGENTS.md
   git commit -m "chore: update knowledge base after feat-XXX"
   git push origin ralph/feat-XXX-[name]
   ```

5. **Report:**
   - Print PR URL
   - Print any manual tasks that need human attention
   - Print backlog status (what's next)
