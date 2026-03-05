# /pm:pipeline-start

## Usage
```
/pm:pipeline-start --vision specs/product-vision-and-mission.md --max-features 5
```

## Description
Main entry point for the autonomous overnight pipeline. Launches the continuous spec → build → test → merge loop.

## Steps

You are the **Pipeline Orchestrator**. Your job is to run the continuous production pipeline. Follow these steps exactly.

## CRITICAL: For every agent step, spawn it as a subagent using the Task tool. Do not do the agent's work in this context — delegate it. This prevents context window exhaustion.

### Phase 1: Initialisation

1. **Read the constitution:**
   - Read `CLAUDE.md` — understand all rules and constraints
   - Read `specs/product-vision-and-mission.md` — understand what we're building
   - Read `specs/standards/brand.md` — understand how it should look
   - Read `.claude/backlog.md` — understand current state

2. **Verify git state:**
   - Confirm no uncommitted changes
   - Sync main with upstream:
     ```bash
     git fetch upstream main
     git checkout main
     git reset --hard upstream/main
     ```

3. **Check safety limits:**
   - Read `.ralphrc` for `MAX_FEATURES_PER_RUN` (default: 5)
   - Initialise feature counter: `features_shipped = 0`
   - Read `MAX_ITERATIONS` (default: 30) for per-agent loop cap
   - Initialise dependency tracking: `PREVIOUS_FEATURE_BRANCH = ""`

### Phase 2: Spec Track — Populate the Backlog

4. **Run the Product Strategist:**
   - Read `.claude/agents/product-strategist.md` for instructions
   - Decompose the product vision into prioritised feature briefs
   - Write feature briefs to `.claude/prds/feat-XXX-[name].md`
   - Write prioritised backlog to `.claude/backlog.md`
   - Continue until backlog is populated with all MVP features

5. **For the top-priority feature that needs a spec:**
   - Run the **Spec Researcher** (read `.claude/agents/spec-researcher.md`)
     - Input: feature brief
     - Output: `.claude/prds/feat-XXX-research.md`
   - Run the **Spec Writer** (read `.claude/agents/spec-writer.md`)
     - Input: feature brief + research
     - Output: `.claude/prds/feat-XXX-spec.md`
   - Run the **Design Speccer** (read `.claude/agents/design-speccer.md`)
     - Input: feature spec + design system
     - Output: `.claude/prds/feat-XXX-design.md`
   - Run the **Spec Validator** (read `.claude/agents/spec-validator.md`)
     - Input: spec + design spec + research
     - Output: `.claude/prds/feat-XXX-validation.md`
     - If FAIL: re-run the failing agent with revision instructions, then re-validate
     - If PASS: update backlog status to "✅ SPECCED"

### Phase 3: Implementation Track — Build the Feature

6. **Resolve base branch and create feature branch:**
   - Read this feature's dependencies from `.claude/backlog.md`
   - For each dependency:
     - If status is "SHIPPED" → already in upstream/main, skip
     - If it was built in this pipeline run and has an unmerged branch → candidate
   - **If all dependencies are SHIPPED (or feature has none):**
     - Base = `upstream/main`
     - `PR_TARGET = "main"`
   - **If any dependency has an unmerged branch from this run:**
     - Base = `PREVIOUS_FEATURE_BRANCH` (the last-built feature's branch, which contains all stacked work)
     - `PR_TARGET` = that branch name
   - Create the branch:
     ```bash
     git checkout -b ralph/feat-XXX-[name] <resolved-base>
     ```

7. **Run Implementation agents in parallel (or sequential if dependencies exist):**
   - **Backend Engineer** (read `.claude/agents/backend-engineer.md`)
     - Implement: migrations, domain, ports, adapters, application services, API endpoints
     - Run `npm test` and `npm run build` after each significant change
   - **Frontend Engineer** (read `.claude/agents/frontend-engineer.md`)
     - Implement: components, pages, hooks, API client, routes
     - Run `npm test` and `npm run build` after each significant change
   - **Infrastructure Engineer** (read `.claude/agents/infra-engineer.md`)
     - Implement: migrations, terraform modules, environment config
     - Document manual tasks in `.claude/manual-tasks.md`
     - Update `.claude/mock-status.md`

8. **After implementation, commit and push:**
   ```bash
   npm test
   npm run build
   git add .
   git commit -m "feat([context]): [description]"
   git push -u origin ralph/feat-XXX-[name]
   ```

### Phase 4: Quality Track — Validate the Feature

**QUALITY LOOP:** Initialise `quality_iterations = 0` when you first reach this phase. Every time a fix is dispatched and code is changed, `quality_iterations` increments and the loop **restarts from step 9a**. All quality agents must pass on the same version of the codebase. Do not advance to the next agent until the current one passes.

**SAFETY VALVE:** If `quality_iterations >= MAX_ITERATIONS`, stop. Write a blocking report to `.claude/reports/feat-XXX-blocked.md` describing every open failure, mark the feature as `⛔ BLOCKED` in `.claude/backlog.md`, and proceed to the next feature without merging.

9. **Run the full Quality Track (one complete pass — all four agents must pass):**

   **a. Playwright Tester** (read `.claude/agents/playwright-tester.md`)
   - Exploratory verification using playwright-cli against the running stack
   - Walks through every acceptance criterion in the feature spec
   - Output: `.claude/reports/feat-XXX-exploratory.md`
   - **If verdict is FAIL or ISSUES FOUND with any critical/major issue:**
     - Re-dispatch the relevant engineer with the exact issue descriptions from the report
     - After the fix: run `npm test && npm run build`, commit the fix
     - Increment `quality_iterations`
     - **⟳ RESTART the Quality Loop from step 9a** — do NOT proceed to Security or Auditor with open Playwright issues
   - If verdict is PASS (or minor issues only) → continue to **9b**

   **b. Security Reviewer** (read `.claude/agents/security-reviewer.md`)
   - Review all code changes for vulnerabilities
   - Output: `.claude/reports/feat-XXX-security.md`
   - **If any CRITICAL or HIGH findings remain unresolved:**
     - Re-dispatch the relevant engineer with the exact finding IDs and fix instructions from the report
     - After the fix: run `npm test && npm run build`, commit the fix
     - Increment `quality_iterations`
     - **⟳ RESTART the Quality Loop from step 9a** — fixes may affect Playwright-verified behaviour; re-verify from the top
   - If 0 critical/high findings → continue to **9c**

   **c. Auditor** (read `.claude/agents/auditor.md`)
   - Final quality gate: architecture, coverage, spec compliance
   - Output: `.claude/reports/feat-XXX-audit.md`
   - **If verdict is FAIL:**
     - Re-dispatch the relevant agent(s) with the exact failures listed in the `## Failures (Must Fix)` section of the audit report
     - After the fix: run `npm test && npm run build`, commit the fix
     - Increment `quality_iterations`
     - **⟳ RESTART the Quality Loop from step 9a** — audit fixes may introduce new Playwright or security issues; re-verify from the top
   - If verdict is PASS → continue to **9d**

   **d. CI/CD DevOps** (read `.claude/agents/cicd-devops.md`)
   - Verify pipeline configuration supports this feature
   - Ensure all checks pass
   - **If any blocking issues found:**
     - Re-dispatch the relevant engineer with the exact failure details
     - After the fix: commit the fix
     - Increment `quality_iterations`
     - **⟳ RESTART the Quality Loop from step 9a**
   - If all checks pass → Quality Track complete, proceed to step 10

10. **Commit and push quality artifacts (only after all four quality agents pass in the same loop iteration):**
    ```bash
    git add .
    git commit -m "test([context]): add quality reports for feat-XXX"
    git push origin ralph/feat-XXX-[name]
    ```

### Phase 4b: Screenshot Capture (after quality gate, before PR)

**Skip if:** the feature spec (`feat-XXX-spec.md`) has no frontend section (Section 7) or no new/modified routes.

**If the feature has frontend changes:**

Screenshots are uploaded to GitHub's CDN (not committed to the repo) to avoid bloating git history with binary files.

1. Identify affected routes from the feature spec's frontend section
2. Ensure the app stack is running (it should be from the Playwright tester step)
3. Open browser once: `playwright-cli open http://localhost:5173`
4. Resize once: `playwright-cli resize 1280 800`
5. Resolve the upstream repo from git remotes (for the GitHub API calls):
   ```bash
   UPSTREAM_REPO=$(git remote get-url upstream | sed 's|.*github.com[:/]||;s|\.git$||')
   ```
6. For each affected route, capture to a temp file and upload to GitHub:
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

**Edge cases:**
- **App won't start:** Skip screenshots, note in PR body: "Screenshots: app stack failed to start"
- **Auth-gated pages:** Use `playwright-cli state-load` with saved auth state from Playwright tester
- **No frontend changes:** Omit screenshots section from PR body entirely
- **Upload fails:** Fall back to noting "Screenshots: upload failed" in PR body — never commit PNGs to the repo

### Phase 5: PR Gate

11. **Check merge criteria — ALL must pass:**
    - [ ] All unit tests pass (`npm test`)
    - [ ] Exploratory review passed (`.claude/reports/feat-XXX-exploratory.md` — no critical/major issues)
    - [ ] Test coverage ≥ 80%
    - [ ] 0 critical security findings
    - [ ] Hex architecture compliance verified
    - [ ] No TODO/FIXME in new code
    - [ ] Build succeeds (`npm run build`)

12. **If ALL pass — create a PR to upstream:**

    **Resolve repo identifiers from git remotes** (do NOT hardcode repo or owner names):
    ```bash
    UPSTREAM_REPO=$(git remote get-url upstream | sed 's|.*github.com[:/]||;s|\.git$||')
    ORIGIN_OWNER=$(git remote get-url origin | sed 's|.*github.com[:/]||;s|/.*||')
    ```
    - `UPSTREAM_REPO` = the `owner/repo` that PRs target (e.g. `LeeCampbell/MarsMissionFund`)
    - `ORIGIN_OWNER` = the fork owner for the `--head` flag (e.g. `leecampbell-codeagent`)

    ```bash
    git push origin ralph/feat-XXX-[name]
    gh pr create \
      --repo "${UPSTREAM_REPO}" \
      --head "${ORIGIN_OWNER}:ralph/feat-XXX-[name]" \
      --base <PR_TARGET> \
      --title "feat-XXX: [name]" \
      --body "## Summary
    - [2-3 bullet points of what was built]
    - **Stacked on:** <PR_TARGET> (if not main — merge parent PR first)

    ## Screenshots
    ![route-name](<SCREENSHOT_URL from Phase 4b>)
    [Repeat for each captured route using the GitHub CDN URLs from Phase 4b. If no frontend changes, omit this section entirely.]

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
    - After PR creation, update tracking: `PREVIOUS_FEATURE_BRANCH = "ralph/feat-XXX-[name]"`
    - Clean up screenshot temp files: `rm -f /tmp/feat-XXX-*.png`

13. **If ANY fail — return to the Quality Track:**
    - Identify which criterion failed
    - Re-dispatch the relevant engineer with the exact failure details
    - After the fix: run `npm test && npm run build`, commit and push the fix
    - Increment `quality_iterations`
    - **⟳ Return to step 9a** — run the entire Quality Track again (Playwright → Security → Auditor → CI/CD) before re-checking merge criteria
    - If `quality_iterations >= MAX_ITERATIONS`: write blocking report, mark feature `⛔ BLOCKED`, move to next feature

14. **Write merge report and push:**
    - Create `.claude/reports/feat-XXX-merge.md` with:
      - Test results summary
      - Coverage stats
      - Security audit summary
      - Changelog entry
      - Manual tasks created (if any)
    - Commit and push to the feature branch:
      ```bash
      git add .claude/reports/feat-XXX-merge.md
      git commit -m "chore: add merge report for feat-XXX"
      git push origin ralph/feat-XXX-[name]
      ```

15. **Update backlog:**
    - Mark feature as "✅ SHIPPED" in `.claude/backlog.md`
    - Increment `features_shipped`

### Phase 6: Loop

16. **Check continue conditions:**
    - If `features_shipped >= MAX_FEATURES_PER_RUN` → STOP
    - If backlog is empty → STOP
    - If safety limits hit → STOP
    - Otherwise → go to Step 5 (spec the next feature) or Step 6 (if next feature is already specced)

17. **Before starting next feature:**
    - Update `.claude/context/patterns.md` with any new patterns established
    - Update `.claude/context/gotchas.md` with any pitfalls discovered
    - Update `AGENTS.md` with learnings from this cycle
    - Commit and push knowledge updates to the current feature branch:
      ```bash
      git add .claude/context/ AGENTS.md
      git commit -m "chore: update knowledge base after feat-XXX"
      git push origin ralph/feat-XXX-[name]
      ```

### On Completion

When the pipeline stops (max features, empty backlog, or safety limit):

1. Ensure all changes are committed and pushed to their feature branches
2. Write a pipeline summary to `.claude/reports/pipeline-run-[date].md`:
   - Features shipped (list with links to PRs and merge reports)
   - Features specced but not yet built
   - Manual tasks waiting for human
   - Total test count and coverage
   - Any issues or blockers encountered
   - **PR merge order:** List stacked PRs in the order they must be merged (parent first). When a parent PR merges, GitHub auto-retargets the child PR to its new base.
3. Commit the summary to a chore branch and push:
   ```bash
   git checkout -b ralph/chore/pipeline-summary-[date] upstream/main
   git add .claude/reports/pipeline-run-[date].md
   git commit -m "chore: pipeline run complete — [N] features shipped"
   git push -u origin ralph/chore/pipeline-summary-[date]
   ```
