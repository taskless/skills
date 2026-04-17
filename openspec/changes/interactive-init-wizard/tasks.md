## 1. Dependencies and skill catalog

- [x] 1.1 Add `@clack/prompts` and `picocolors` to `packages/cli/package.json`; run `pnpm install`
- [x] 1.2 Create `packages/cli/src/install/catalog.ts` exporting a typed array of skill descriptors `{ name: string; optional: boolean }` covering every bundled skill
- [x] 1.3 Mark `taskless-ci` as `optional: true`; every other skill as `optional: false`
- [x] 1.4 Add a build-time guard in `packages/cli/vite.config.ts` (or a separate script run before build) that fails if any `SKILL.md` under `skills/` is missing from the catalog

## 2. New `taskless-ci` skill (placeholder)

- [x] 2.1 Create `skills/taskless-ci/SKILL.md` with valid Agent Skills frontmatter (`name: taskless-ci`, description, version, author)
- [x] 2.2 Body is a one-paragraph placeholder stating the skill's full behavior is pending (real body lands in OSS-3)
- [x] 2.3 Verify the skill is picked up by the existing `import.meta.glob` bundling pattern

## 3. Manifest migration 2

- [x] 3.1 Extend the `TasklessManifest` interface in `packages/cli/src/filesystem/migrate.ts` with the optional `install` field described in the design
- [x] 3.2 Update `readManifest()` / `writeManifest()` to preserve unknown top-level fields on round-trip
- [x] 3.3 Create `packages/cli/src/filesystem/migrations/0002-install.ts` that adds `install: {}` if absent, leaves it untouched if present (idempotent)
- [x] 3.4 Register migration `"2"` in the migrations record in `migrate.ts`
- [x] 3.5 Add unit tests: fresh project reaches `{ version: 2, install: {} }`; v1 project forward-migrates; existing `install` object is preserved
- [x] 3.6 Add a test proving an unknown top-level field survives a migrate + write cycle

## 4. Install manifest read/write helpers

- [x] 4.1 Add `readInstallState(cwd)` in `packages/cli/src/install/` that returns the current `install` object (or an empty default)
- [x] 4.2 Add `writeInstallState(cwd, state)` that merges the new install state into `taskless.json`, preserves other fields, and writes atomically
- [x] 4.3 Add `computeInstallDiff(previous, next)` returning `{ additions, removals, unchanged }` grouped by target
- [x] 4.4 Unit tests for diff logic: brand-new target, removed target, added skill within existing target, removed skill within existing target, zero-diff re-run

## 5. Refactor installer to accept explicit targets

- [x] 5.1 Change `installForTool()` (or its replacement) to accept an explicit target + skill list instead of inferring from detection
- [x] 5.2 Before writing, read previous install state; compute files to delete (removals) and delete them first
- [x] 5.3 Write selected skills/commands to selected targets
- [x] 5.4 After writing, call `writeInstallState()` with the current run's manifest reflecting exactly what was written
- [x] 5.5 Ensure deletion only touches files recorded in the previous manifest — never glob-delete

## 6. Shared interactive login

- [x] 6.1 Extract the device-code login routine from `packages/cli/src/commands/auth.ts` into `packages/cli/src/auth/login-interactive.ts`
- [x] 6.2 Export `loginInteractive({ cwd }): Promise<{ status: "ok" | "cancelled" }>`
- [x] 6.3 Update `auth login` subcommand to call `loginInteractive()` and map the result to exit code
- [x] 6.4 Unit test the extraction — auth login behavior is unchanged

## 7. Telemetry: cliVersion and scaffoldVersion

- [x] 7.1 Bundle `packages/cli/package.json` version at build time (Vite `define` or a generated `version.ts`) — expose as a constant
- [x] 7.2 In `getTelemetry()`, resolve `scaffoldVersion` by reading `.taskless/taskless.json` (reuse `readManifest()`); fall back to `0` on missing/unreadable
- [x] 7.3 Store `cliVersion` and `scaffoldVersion` in the closure; merge them into every `capture()` property payload
- [x] 7.4 Unit tests: anonymous capture includes both properties; authed capture includes both properties and groups; missing manifest yields `scaffoldVersion: 0`

## 8. Wizard scaffolding

- [x] 8.1 Create `packages/cli/src/wizard/index.ts` exposing `runWizard({ cwd }): Promise<WizardResult>`
- [x] 8.2 Create `packages/cli/src/wizard/ask.ts` — thin wrapper around clack prompts that throws `WizardCancelled` on `isCancel()` Symbols
- [x] 8.3 Create `packages/cli/src/wizard/intro.ts` — `renderIntro()` returns an ASCII banner string with picocolors; respects `NO_COLOR`
- [x] 8.4 Add a top-level try/catch in `runWizard()` that handles `WizardCancelled`, emits `cli_init_cancelled`, and exits non-zero

## 9. Wizard steps

- [x] 9.1 `wizard/steps/locations.ts` — multi-select showing all four known locations (detected pre-checked); re-prompt on zero selections
- [x] 9.2 `wizard/steps/optional-skills.ts` — multi-select reading from the catalog; all unchecked by default; zero selections is permitted
- [x] 9.3 `wizard/steps/auth.ts` — skip if token exists; otherwise show tradeoff text, prompt to log in, call `loginInteractive()` on accept, print hint on decline
- [x] 9.4 `wizard/steps/summary.ts` — render `computeInstallDiff()` result grouped by target; require confirm only when removals are present
- [x] 9.5 Unit tests per step: mock clack, verify the step's return value for representative inputs

## 10. Rewire `init` command

- [x] 10.1 Add `--no-interactive` boolean flag to `init` in `packages/cli/src/commands/init.ts`
- [x] 10.2 When the flag is absent AND stdout is a TTY AND `CI` env var is not set: call `runWizard()` and dispatch to installer with the wizard's results
- [x] 10.3 When the flag is present or we detect non-interactive context: install every mandatory skill (from catalog) to every detected tool location (or `.agents/` fallback), skipping optional skills and auth
- [x] 10.4 Detect non-interactive context: print a stderr notice explaining the auto-switch
- [x] 10.5 Emit `cli_init` on entry and `cli_init_completed` on successful completion with the rich properties described in the analytics spec

## 11. Bare `taskless` delegates to `init`

- [x] 11.1 Update `packages/cli/src/index.ts` so that when `rawArgs` contains no subcommand AND stdout is a TTY, `init` is invoked
- [x] 11.2 Non-TTY bare `taskless` continues to show top-level help (no behavior change)
- [x] 11.3 `taskless help` continues to show help regardless of TTY

## 12. Non-interactive fallback path

- [x] 12.1 Confirm `--no-interactive` matches pre-change behavior exactly for at least two integration tests (detected tools → installs; no tools → `.agents/` fallback)
- [x] 12.2 Confirm optional skills (`taskless-ci`) are NOT installed in `--no-interactive` path
- [x] 12.3 Confirm no auth prompt in `--no-interactive` path

## 13. Integration tests

- [x] 13.1 End-to-end test: fresh repo → wizard with mocked prompts selects `.claude/` and `taskless-ci` → files on disk match expectations and manifest records the install
- [x] 13.2 End-to-end test: re-run wizard deselecting `taskless-ci` → summary lists `taskless-ci` as removal → on confirm, files deleted and manifest updated
- [x] 13.3 End-to-end test: cancel at each step → no filesystem changes, no manifest changes, `cli_init_cancelled` event emitted with correct `atStep`
- [x] 13.4 End-to-end test: non-interactive install matches the pre-change behavior byte-for-byte
- [x] 13.5 Telemetry test: every `capture()` in a fixture contains `cliVersion` and `scaffoldVersion`

## 14. Release hygiene

- [x] 14.1 Add a changeset (or equivalent) noting the breaking change to bare `taskless`
- [x] 14.2 Update `packages/cli/README.md` with the new wizard flow and `--no-interactive` documentation
- [x] 14.3 Update `packages/cli/src/help/init.txt` to reflect the new default behavior and the flag
- [x] 14.4 Run `pnpm typecheck` and `pnpm lint` until clean

## 15. `taskless check` positional path arguments

- [x] 15.1 Extend `runAstGrepScan()` in `packages/cli/src/rules/scan.ts` to accept an optional `paths: string[]` parameter and append it to the `sg scan` argv
- [x] 15.2 Update `checkCommand` in `packages/cli/src/commands/check.ts` to extract positional paths from `rawArgs` (filter out flags)
- [x] 15.3 Resolve each positional path against the working directory and filter out paths that do not exist via `fs.stat`
- [x] 15.4 When the original argument list was non-empty but every path was filtered out, exit 0 with empty results (skip the scan entirely) instead of falling back to full-project scan
- [x] 15.5 Unit tests: zero paths → full scan, explicit paths → forwarded, missing paths filtered, all-missing → empty results, directory paths accepted
- [x] 15.6 Update `packages/cli/src/help/check.txt` with the new path-argument syntax and a CI example
- [x] 15.7 Update `packages/cli/README.md` `taskless check` section to mention path arguments

## 16. `taskless-ci` skill body

- [x] 16.1 Replace the placeholder body in `skills/taskless-ci/SKILL.md` with agent-facing instructions covering CI discovery, scan-mode agreement, local-check gating, non-destructive config generation, and error handling
- [x] 16.2 List common CI systems (GitHub Actions, GitLab CI, CircleCI, Jenkins, Azure Pipelines, Bitbucket Pipelines, Buildkite, Drone, Travis CI) as detection hints without making the skill an exhaustive enumeration — instruct agents to apply the same patterns to recognized-but-unlisted systems
- [x] 16.3 Document the full-scan vs. diff-scan patterns and the per-CI diff-target variables (`github.base_ref`, `CI_MERGE_REQUEST_TARGET_BRANCH_NAME`, `CIRCLE_BRANCH`, `env.CHANGE_TARGET`, `System.PullRequest.TargetBranch`, `BITBUCKET_PR_DESTINATION_BRANCH`)
- [x] 16.4 Include a complete GitHub Actions template as the primary reference; describe the equivalent structure for other CI systems as translation guidance rather than exhaustive templates
- [x] 16.5 Require the skill to gate CI setup on a clean local `taskless check` (no rules → invoke `taskless-create-rule` instead)
- [x] 16.6 Require standalone file generation (never edit existing CI files) with canonical paths per CI system and include/reference instructions for systems that need them
- [x] 16.7 Confirm the skill frontmatter does not include `commandName` (no slash command for `taskless-ci`)
- [x] 16.8 Verify the skill builds (vite `assertSkillVersions` passes: name, version, and catalog entry all consistent)
