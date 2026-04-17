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

- [ ] 8.1 Create `packages/cli/src/wizard/index.ts` exposing `runWizard({ cwd }): Promise<WizardResult>`
- [ ] 8.2 Create `packages/cli/src/wizard/ask.ts` — thin wrapper around clack prompts that throws `WizardCancelled` on `isCancel()` Symbols
- [ ] 8.3 Create `packages/cli/src/wizard/intro.ts` — `renderIntro()` returns an ASCII banner string with picocolors; respects `NO_COLOR`
- [ ] 8.4 Add a top-level try/catch in `runWizard()` that handles `WizardCancelled`, emits `cli_init_cancelled`, and exits non-zero

## 9. Wizard steps

- [ ] 9.1 `wizard/steps/locations.ts` — multi-select showing all four known locations (detected pre-checked); re-prompt on zero selections
- [ ] 9.2 `wizard/steps/optional-skills.ts` — multi-select reading from the catalog; all unchecked by default; zero selections is permitted
- [ ] 9.3 `wizard/steps/auth.ts` — skip if token exists; otherwise show tradeoff text, prompt to log in, call `loginInteractive()` on accept, print hint on decline
- [ ] 9.4 `wizard/steps/summary.ts` — render `computeInstallDiff()` result grouped by target; require confirm only when removals are present
- [ ] 9.5 Unit tests per step: mock clack, verify the step's return value for representative inputs

## 10. Rewire `init` command

- [ ] 10.1 Add `--no-interactive` boolean flag to `init` in `packages/cli/src/commands/init.ts`
- [ ] 10.2 When the flag is absent AND stdout is a TTY AND `CI` env var is not set: call `runWizard()` and dispatch to installer with the wizard's results
- [ ] 10.3 When the flag is present or we detect non-interactive context: install every mandatory skill (from catalog) to every detected tool location (or `.agents/` fallback), skipping optional skills and auth
- [ ] 10.4 Detect non-interactive context: print a stderr notice explaining the auto-switch
- [ ] 10.5 Emit `cli_init` on entry and `cli_init_completed` on successful completion with the rich properties described in the analytics spec

## 11. Bare `taskless` delegates to `init`

- [ ] 11.1 Update `packages/cli/src/index.ts` so that when `rawArgs` contains no subcommand AND stdout is a TTY, `init` is invoked
- [ ] 11.2 Non-TTY bare `taskless` continues to show top-level help (no behavior change)
- [ ] 11.3 `taskless help` continues to show help regardless of TTY

## 12. Non-interactive fallback path

- [ ] 12.1 Confirm `--no-interactive` matches pre-change behavior exactly for at least two integration tests (detected tools → installs; no tools → `.agents/` fallback)
- [ ] 12.2 Confirm optional skills (`taskless-ci`) are NOT installed in `--no-interactive` path
- [ ] 12.3 Confirm no auth prompt in `--no-interactive` path

## 13. Integration tests

- [ ] 13.1 End-to-end test: fresh repo → wizard with mocked prompts selects `.claude/` and `taskless-ci` → files on disk match expectations and manifest records the install
- [ ] 13.2 End-to-end test: re-run wizard deselecting `taskless-ci` → summary lists `taskless-ci` as removal → on confirm, files deleted and manifest updated
- [ ] 13.3 End-to-end test: cancel at each step → no filesystem changes, no manifest changes, `cli_init_cancelled` event emitted with correct `atStep`
- [ ] 13.4 End-to-end test: non-interactive install matches the pre-change behavior byte-for-byte
- [ ] 13.5 Telemetry test: every `capture()` in a fixture contains `cliVersion` and `scaffoldVersion`

## 14. Release hygiene

- [ ] 14.1 Add a changeset (or equivalent) noting the breaking change to bare `taskless`
- [ ] 14.2 Update `packages/cli/README.md` with the new wizard flow and `--no-interactive` documentation
- [ ] 14.3 Update `packages/cli/src/help/init.txt` to reflect the new default behavior and the flag
- [ ] 14.4 Run `pnpm typecheck` and `pnpm lint` until clean
