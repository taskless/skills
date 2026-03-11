## 1. Refactor Version Compatibility to Per-Subcommand Minimums

- [x] 1.1 Replace `COMPATIBILITY` array, `RULES_MIN_SPEC_VERSION`, `isRulesCompatibleVersion()`, and `isSupportedSpecVersion()` in `packages/cli/src/capabilities.ts` with `MIN_SCAFFOLD_VERSION` map (e.g., `{ 'rules create': '2026-03-03', 'check': '2026-02-18' }`)
- [x] 1.2 Retain `isValidSpecVersion()` for YYYY-MM-DD format validation
- [x] 1.3 Update `validateRulesConfig()` in `packages/cli/src/actions/project-config.ts` to use `MIN_SCAFFOLD_VERSION` and produce error: "Scaffold version <current> is below the minimum <required> required for 'taskless rules create'. Run 'taskless update-engine' to update."
- [x] 1.4 Update `readProjectConfig()` to use `MIN_SCAFFOLD_VERSION` instead of `isSupportedSpecVersion()`
- [x] 1.5 Update any other callers of the removed functions

## 2. Replace Stdin with `--from` File Input on Rules Create

- [x] 2.1 Add `from` argument (type: string, required) to the `createCommand` args in `packages/cli/src/commands/rules.ts`
- [x] 2.2 Replace `readStdin()` with file reading logic: read file from `--from` path, handle file-not-found and invalid JSON errors; remove `readStdin()` function entirely
- [x] 2.3 Update the `createCommand` meta description to reflect `--from` input
- [x] 2.4 Update help text examples to show `--from` usage
- [x] 2.5 Write tests for `--from` file input: valid JSON file, missing file, invalid JSON file, missing `--from` flag

## 3. Update-Engine API Types and Provider (stub until backend deploys)

- [x] 3.1 Create `packages/cli/src/actions/update-api.ts` with `UpdateApiProvider` interface, request/response types (`UpdateRequest`, `UpdateSubmitResponse`, `UpdateStatusResponse`), and discriminated union for request statuses — POST returns `current` | `exists` (with `requestId`, `prUrl`) | `accepted` (with `requestId`); GET returns `pending` | `open` (with `prUrl`) | `merged` (with `prUrl`) | `closed` (with `prUrl`)
- [x] 3.2 Implement `HttpUpdateApiProvider` class: `submitUpdate()` POSTs to `/cli/api/update-engine`, `pollStatus()` GETs `/cli/api/update-engine/:requestId`, with error handling matching the rule API pattern
- [x] 3.3 Implement `StubUpdateApiProvider` class that throws a clear "not yet available" error
- [x] 3.4 Export `updateApiProvider` instance selected by `getApiBaseUrl()` availability (same pattern as `ruleApiProvider`)
- [x] 3.5 Verify types against deployed backend using `x-explain` schema introspection (backend PR #18 finalizes the API)

## 4. Create Update-Engine Command

- [x] 4.1 Create `packages/cli/src/commands/update-engine.ts` with `updateEngineCommand` using citty `defineCommand`
- [x] 4.2 Implement command logic: read project config, validate auth, call `updateApiProvider.submitUpdate()`, handle immediate responses (`current`, `exists`)
- [x] 4.3 Implement polling loop for `accepted` status: poll `updateApiProvider.pollStatus()` until terminal state (`open`, `merged`, `closed`), print `pending` progress to stderr
- [x] 4.4 Implement JSON output mode: structured `{ status, prUrl?, requestId? }` output
- [x] 4.5 Implement text output mode: human-readable status messages and PR URL
- [x] 4.6 Register `updateEngineCommand` in `packages/cli/src/index.ts` as `"update-engine"`, remove `update: initCommand` alias

## 5. Create Update-Engine Skill

- [x] 5.1 Create `skills/taskless-update-engine/SKILL.md` with frontmatter (name, description, metadata with author and version)
- [x] 5.2 Write skill instructions: detect package manager, run `taskless update-engine --json`, parse output, report status and PR URL to user
- [x] 5.3 Add corresponding command file at `commands/taskless/update-engine.md` for Claude Code

## 6. Update Rules Create Skill

- [x] 6.1 Modify `skills/taskless-rule-create/SKILL.md` to instruct the agent to write JSON to `.taskless/.tmp-rule-request.json` and use `--from` flag instead of stdin piping
- [x] 6.2 Update error handling instructions to suggest `taskless update-engine` for stale config errors

## 7. Testing and Validation

- [x] 7.1 Run `pnpm typecheck` and fix any type errors
- [x] 7.2 Run `pnpm lint` and fix any lint issues
- [x] 7.3 Verify the CLI builds successfully with `pnpm build` in `packages/cli/`
