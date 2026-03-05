# /pm:manual-task-done

## Usage
```
/pm:manual-task-done 3
/pm:manual-task-done 3 --verify-only
```

## Description
Called after a human completes a manual task (API key provisioned, domain verified, OAuth app created, etc.). Triggers the Integration Engineer to swap the mock adapter for the real one, write integration tests, and merge to main. Use `--verify-only` to check prerequisites without starting the swap.

## Steps

### 1. Load the Task

1. Read `.claude/manual-tasks.md`
2. Find task #N
3. Verify the task exists and has status "⬜ TODO" or "🔄 IN PROGRESS"
4. If task is already "✅ DONE": report "Task already completed" and exit
5. If task doesn't exist: report "Task #N not found" and exit

### 2. Verify Prerequisites

Read the task's "Config Required" section and verify each item:

```bash
# For each required environment variable:
# Check it exists in .env and has a non-empty, non-placeholder value
```

**Check each config value:**
- [ ] Variable exists in `.env`
- [ ] Value is not empty
- [ ] Value is not a placeholder (not `xxx`, `sk_test_xxx`, `your-key-here`, etc.)
- [ ] Value format looks correct (API keys have expected prefix, URLs are valid, etc.)

**If any prerequisite fails:**
- Report exactly which config values are missing or invalid
- Show the expected format from the manual task instructions
- Do NOT proceed with the swap
- Exit

**If `--verify-only`:**
- Report prerequisite status (pass/fail for each config value)
- Exit without starting the swap

### 3. Pre-Swap State

1. Read `.claude/mock-status.md` — confirm this service is currently "🎭 Mocked"
2. Identify the mock adapter file path
3. Identify the real adapter file path (or confirm it needs to be created)
4. Identify where the adapter is wired up in bootstrap (scan `packages/backend/src/app.ts` or similar)
5. Read the port interface — this is the contract both adapters must satisfy

### 4. Run Integration Engineer

Read `.claude/agents/integration-engineer.md` and execute the swap:

1. **Resolve base branch and create feature branch:**
   - Identify the parent feature that introduced the mock adapter for this service (from the manual task's "Blocked Feature" or context)
   - Check if the parent feature's branch exists on origin:
     ```bash
     git ls-remote --heads origin "ralph/feat-XXX-*"
     ```
   - **If parent feature is SHIPPED or has no remote branch:** `BASE_BRANCH = upstream/main`, `PR_TARGET = main`
   - **If parent feature has an unmerged branch on origin:** `BASE_BRANCH` = that branch, `PR_TARGET` = that branch. Fetch it first.
   - Create the branch:
     ```bash
     git fetch upstream main
     git checkout -b ralph/integrate-[service-name] <BASE_BRANCH>
     ```

2. **Implement real adapter** (if not already scaffolded):
   - Create `packages/backend/src/[context]/adapters/[service]/[service]-adapter.ts`
   - Must implement the same port interface as the mock
   - Read config from environment variables using `requireEnv()` pattern
   - Include error handling for service-specific failures
   - Include retry logic for transient failures

3. **Swap the adapter in bootstrap:**
   - Update the import from mock to real adapter
   - Or update the feature flag: `MOCK_[SERVICE]=false`
   - The mock adapter stays in the codebase for tests

4. **Update environment config:**
   - Verify `.env.example` documents the new variables
   - Add any missing variable documentation

5. **Write integration tests:**
   - Create `tests/integration/adapters/[service]-adapter.test.ts`
   - Test real connectivity
   - Test the primary operation
   - Test error handling
   - Tests skip gracefully when credentials are absent (`describe.skip` pattern)

6. **Run the full test suite:**
   ```bash
   # All existing tests must still pass
   npm test

   # Integration tests against real service
   npm test -- --grep "Real Integration"

   # E2E tests — should work identically
   npx playwright test

   # Build must succeed
   npm run build
   ```

7. **If any tests fail:**
   - Fix the real adapter (not the tests or upstream code)
   - Re-run tests
   - Repeat up to 3 times
   - If still failing: report the failure and leave the branch unmerged

### 5. Update Status Files

1. **Update `.claude/manual-tasks.md`:**
   - Change task status from "⬜ TODO" to "✅ DONE"
   - Add completion timestamp
   - Add note: "Integrated by Integration Engineer on [date]"

2. **Update `.claude/mock-status.md`:**
   - Change service status from "🎭 Mocked" to "✅ Real"
   - Fill in the real adapter file path
   - Reference the completed manual task

### 6. Commit and Create PR

1. **Commit:**
   ```bash
   git add .
   git commit -m "feat([context]): integrate real [service] adapter

   - Swaps mock-[service]-adapter for [service]-adapter
   - Integration tests verify real connectivity
   - Mock adapter retained for test suite
   - Closes manual task #N"
   git push -u origin ralph/integrate-[service-name]
   ```

2. **Write integration report:**
   Create `.claude/reports/integrate-[service]-report.md`:
   ```markdown
   # Integration Report: [Service Name]

   ## Completed: [timestamp]
   ## Manual Task: #N
   ## Service: [service name]

   ## What Changed
   - Mock adapter: `packages/backend/src/[context]/adapters/mock/mock-[service]-adapter.ts` (retained for tests)
   - Real adapter: `packages/backend/src/[context]/adapters/[service]/[service]-adapter.ts` (now active)
   - Bootstrap: updated adapter wiring in `packages/backend/src/app.ts`

   ## Integration Tests
   - Connectivity: ✅
   - Primary operation: ✅
   - Error handling: ✅

   ## Existing Tests
   - Unit tests: all passing
   - E2E tests: all passing
   - Build: green

   ## Config Required
   - `[VAR_NAME]` — configured ✅
   ```

3. **Commit report and push:**
   ```bash
   git add .claude/reports/
   git commit -m "chore: integration report for [service]"
   git push origin ralph/integrate-[service-name]
   ```

4. **Create PR to upstream** (using `PR_TARGET` resolved in step 4.1):
   ```bash
   UPSTREAM_REPO=$(git remote get-url upstream | sed 's|.*github.com[:/]||;s|\.git$||')
   ORIGIN_OWNER=$(git remote get-url origin | sed 's|.*github.com[:/]||;s|/.*||')
   gh pr create \
     --repo "${UPSTREAM_REPO}" \
     --head "${ORIGIN_OWNER}:ralph/integrate-[service-name]" \
     --base <PR_TARGET> \
     --title "integrate: real [service] adapter" \
     --body "## Summary
   - Swaps mock-[service]-adapter for real [service]-adapter
   - Integration tests verify real connectivity
   - Mock adapter retained for test suite
   - Closes manual task #N
   - **Stacked on:** <PR_TARGET> (if not main — merge parent PR first)

   ## Reports
   - Integration: .claude/reports/integrate-[service]-report.md"
   ```
   - If `PR_TARGET` is `main`, omit the "Stacked on" line from the body.

### 7. Report

Print summary:
- Service integrated: [name]
- Manual task #N: completed
- Tests: all passing
- Adapter swap: confirmed
- Any follow-up actions needed

## Error Handling

**If credentials are invalid (service rejects them):**
- Report: "Credentials for [service] are invalid. Please check the values in `.env` and re-run."
- Do NOT merge
- Leave the branch for debugging
- Update manual task: "🔄 IN PROGRESS — credentials invalid"

**If the real service is unreachable:**
- Report: "Cannot reach [service] at [URL]. Check network configuration and service status."
- Do NOT merge
- Update manual task: "🔄 IN PROGRESS — service unreachable"

**If the port interface doesn't match the real service's capabilities:**
- Report: "Real [service] response shape doesn't match the port interface. The spec may need revision."
- Do NOT merge
- Flag for human review
- Log details in `.claude/reports/integrate-[service]-blocked.md`
