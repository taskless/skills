## 1. Dependencies and catalog

- [x] 1.1 Schema embedding uses zod 4 built-in `z.toJSONSchema()` — no separate dep needed
- [x] 1.2 Shrink `packages/cli/src/install/catalog.ts` to a single `{ name: "taskless", optional: false }` entry
- [x] 1.3 Keep `getOptionalSkillNames()` and `isOptionalSkill()` returning empty for back-compat — there are no optional skills in the new design
- [x] 1.4 Build-time guard (Vite `assertSkillVersions`) already verifies catalog ↔ source match; no change required since the existing logic handles any catalog size

## 2. CLI verb rename: `rules` → `rule`

- [x] 2.1 Rename the citty subcommand definition in `packages/cli/src/commands/rules.ts` so it registers under `rule` (singular). The source file MAY stay named `rules.ts`
- [x] 2.2 Update `packages/cli/src/index.ts` (or wherever subcommands are wired) to register `rule` instead of `rules`
- [x] 2.3 Rename help files: `packages/cli/src/help/rules-create.txt` → `rule-create.txt`, `rules-improve.txt` → `rule-improve.txt`, `rules-delete.txt` → `rule-delete.txt`, `rules-verify.txt` → `rule-verify.txt`, `rules-meta.txt` → `rule-meta.txt`, `rules.txt` → `rule.txt`
- [x] 2.4 Update help-file content to reference `taskless rule create` etc. throughout (no `rules` in body text)
- [x] 2.5 Search the repo for stale `rules create`/`rules improve`/etc. references and update them: docs, comments, error messages
- [x] 2.6 Update tests in `packages/cli/test/` to invoke the renamed subcommand
- [x] 2.7 Confirm `pnpm typecheck` and `pnpm lint` are clean after rename

## 3. Global `--anonymous` flag

- [x] 3.1 Add `anonymous: { type: "boolean", default: false }` to every action command's `args` block in `packages/cli/src/commands/{auth,check,info,rules}.ts`
- [x] 3.2 In `auth login`: when `args.anonymous` is true, exit 1 with a clear "auth commands cannot be anonymous" message
- [x] 3.3 In `auth logout`: accept and no-op
- [x] 3.4 In `info`: when `args.anonymous` is true, skip the API/auth probe and report local state only
- [x] 3.5 In `check`, `rule delete`, `rule verify`, `rule meta`, `init`: accept and no-op
- [x] 3.6 In `rule create` and `rule improve`: when `args.anonymous` is true, exit with a pointer to `taskless help <topic> --anonymous`. Per Option A, generation runs in the agent (not the CLI); the recipe variant guides the agent
- [x] 3.7 Per-command behavior matrix covered in `anonymous-flag.test.ts` (info skip, auth login reject, rule create/improve recipe pointer, no-op on the rest)
- [x] 3.8 Documented in consolidated SKILL.md `## --anonymous` section, the `/tskl` command body, and the per-topic anonymous variants (`rule-create.anonymous.txt`, `rule-improve.anonymous.txt`)

## 4. Audit action commands for self-sufficient file writes

- [x] 4.1 Audited each command:
  - `rule create` (API) — CLI writes rule + test + metadata files via writeRuleFile/writeRuleTestFile/writeRuleMetaFiles. Agent only invokes and reports.
  - `rule improve` (API) — CLI writes updated rule + test files. Same pattern.
  - `rule create --anonymous` / `rule improve --anonymous` — Per Option A, the CLI rejects with a pointer to the local-only recipe. The AGENT writes files via its own tools per the recipe. Self-write doesn't apply (intentional design choice).
  - `rule delete` — CLI deletes files. Self-writes.
  - `rule verify` — Read-only; no writes.
  - `rule meta` — Read-only.
  - `check` — Read-only scanner.
  - `info` — Read-only state report.
  - `auth login` — CLI writes the token to `.taskless/.env.local.json`.
  - `auth logout` — CLI removes the token.
- [x] 4.2 No gaps identified — every action command that produces artifacts writes them itself
- [x] 4.3 Existing write-path coverage in `apply-install-plan.test.ts`, `login-interactive.test.ts`, `rule-from.test.ts` — each action command writes its own outputs end-to-end. Explicit "agent does nothing post-CLI" framing is implicit in the recipes (Steps say "invoke and report") rather than enforced as a test assertion
- [x] 4.4 Recipes (task 8) describe the agent flow as "invoke and report" wherever applicable

## 5. Anonymous flow absorption into CLI

**Superseded by Option A architecture decision** (recorded in design.md
"Decisions" section). The anonymous rule-creation and rule-improvement
flows stay agent-driven rather than being absorbed into the CLI. The
CLI exposes `rule verify` as the primitive; the agent owns the loop and
writes the rule files itself per the `<topic>.anonymous.txt` recipe.
The CLI's `--anonymous` flag on `rule create` / `rule improve` exits
cleanly with a pointer to the recipe (see task 3.6).

- [x] 5.1 ~~Move the local-only rule-creation flow into the CLI~~ — superseded by Option A; flow stays agent-driven via `rule-create.anonymous.txt`
- [x] 5.2 ~~Move the local-only rule-improvement flow into the CLI~~ — superseded by Option A; flow stays agent-driven via `rule-improve.anonymous.txt`
- [x] 5.3 ~~Unit tests for the absorbed branches~~ — N/A; behavior tested in `anonymous-flag.test.ts` (CLI exits with pointer)
- [x] 5.4 The verify feedback loop stays agent-driven; the CLI provides `rule verify` as the primitive; the agent owns the loop per the recipe

## 6. Standardize CLI error output for recipe references

- [x] 6.1 Define a stable error-code enum in `packages/cli/src/types/errors.ts` (or extend the existing `GeneratorErrorCode`) covering at minimum: `AUTH_REQUIRED`, `NO_GITHUB_REMOTE`, `RULE_GENERATION_FAILED`, `RULE_NOT_FOUND`, `INVALID_INPUT`, `NETWORK_ERROR`
- [x] 6.2 When any action command exits with an error AND `--json` was set, output `{ "ok": false, "code": "<CODE>", "message": "<human message>" }` to stdout and a non-zero exit code
- [x] 6.3 Update existing error-throwing sites to use the standardized codes
- [x] 6.4 Tests covering rule create/improve/meta/verify error envelope codes in `error-envelope.test.ts`

## 7. `tskl help` extensions: template, schemas, variants, no-args index

- [x] 7.1 Recipe template (Goal/Preconditions/Steps/Schema/Errors/See Also) + versioned header applied to every help file in task 8
- [x] 7.2 Extend `packages/cli/src/commands/help.ts` to recognize a `--anonymous` flag; when set, look up `<topic>.anonymous.txt` first and fall back to `<topic>.txt`
- [x] 7.3 Add a build-time map of which topics have anonymous variants — derived from `import.meta.glob` matching `*.anonymous.txt`
- [x] 7.4 Add JSON schema embedding via the `{{INPUT_SCHEMA}}` placeholder. Recipes that include the marker get the JSON Schema rendered from the corresponding Zod input via `z.toJSONSchema()` (zod 4 built-in; no extra dep). `{{CLI_VERSION}}` placeholder also supported for the recipe header
- [x] 7.5 Update `packages/cli/src/commands/help.ts` no-args output to include a human slug (paragraph explaining what the command does for human vs. agent) followed by a topic disambiguation table
- [x] 7.6 Emit `help_<topic>` telemetry event on every topic fetch; emit `help_index` on no-args fetch (already done in task 11; this task adds the `anonymous` property to the topic event)
- [x] 7.7 Tests in `help-extensions.test.ts` cover: no-args slug + topic table, `{{CLI_VERSION}}` and `{{INPUT_SCHEMA}}` interpolation, anonymous variant lookup + fallback, unknown topic exit, bare-taskless non-TTY routing

## 8. Author the seven topic recipes

- [x] 8.1 Author `packages/cli/src/help/rule-create.txt` (API-backed flow) — Goal/Preconditions/Steps/Schema/Errors/See Also; embeds the JSON schema via `{{INPUT_SCHEMA}}`
- [x] 8.2 Author `packages/cli/src/help/rule-create.anonymous.txt` (local-only flow) — distinct steps, no API references, includes the verify loop the agent owns
- [x] 8.3 Author `packages/cli/src/help/rule-improve.txt` (API-backed flow) — preserves the verify loop end-to-end
- [x] 8.4 Author `packages/cli/src/help/rule-improve.anonymous.txt` (local-only flow)
- [x] 8.5 Author `packages/cli/src/help/rule-delete.txt` — short; no schema needed; deletes by rule ID
- [x] 8.6 Author `packages/cli/src/help/check.txt` — restructured into the template format
- [x] 8.7 Author `packages/cli/src/help/auth.txt` — combined login/logout/status with branches; replaces the per-subcommand `auth-login.txt` and `auth-logout.txt` (deleted)
- [x] 8.8 Author `packages/cli/src/help/info.txt` — local state report, version, auth state
- [x] 8.9 Author `packages/cli/src/help/ci.txt` — ported from the v0.6 `taskless-ci` skill body into the recipe template
- [x] 8.10 Author `packages/cli/src/help/init.txt` — directs the user to run `npx @taskless/cli` themselves; describes wizard behavior + the v0.6→v0.7 cleanup
- [x] 8.11 For each recipe, include the `## Errors` section listing the error codes from task 6 and a user-facing fix per code

## 9. Consolidated skill and command

- [x] 9.1 Create `skills/taskless/SKILL.md` with the new ~30-line router body. Frontmatter description: anchored on Taskless-specific phrases or `.taskless/` references; explicitly says "do NOT trigger on generic ESLint, linting, or rule requests that don't reference Taskless"
- [x] 9.2 SKILL.md frontmatter SHALL include `metadata.commandName: tskl` so command-installation plumbing maps the skill to the new command
- [x] 9.3 SKILL.md body SHALL include the "you do NOT have the steps" framing, the `.taskless/` presence check as the first step, the topic table, and the `## --anonymous` section
- [x] 9.4 Create `commands/tskl/tskl.md` with the new ~10-line router body that handles `$ARGUMENTS`. Argument-hint: `<describe what you want to do>`
- [x] 9.5 Delete the old skill directories: `skills/taskless-check`, `skills/taskless-ci`, `skills/taskless-create-rule`, `skills/taskless-create-rule-anonymous`, `skills/taskless-delete-rule`, `skills/taskless-improve-rule`, `skills/taskless-improve-rule-anonymous`, `skills/taskless-info`, `skills/taskless-login`, `skills/taskless-logout`
- [x] 9.6 Delete the old command files: `commands/tskl/check.md`, `commands/tskl/improve.md`, `commands/tskl/info.md`, `commands/tskl/login.md`, `commands/tskl/logout.md`, `commands/tskl/rule.md`
- [x] 9.7 Verify the consolidated skill builds via the existing `import.meta.glob` pattern in `packages/cli/src/install/install.ts`

## 10. Wizard simplification and non-TTY routing

- [x] 10.1 Delete the optional-skills wizard step file (`packages/cli/src/wizard/steps/optional-skills.ts` or equivalent) and its tests
- [x] 10.2 Update `packages/cli/src/wizard/index.ts` to remove the optional-skills step from the `runWizard()` composition
- [x] 10.3 Update bare `taskless` (in `packages/cli/src/index.ts`) so that when invoked with no args AND no TTY, it prints the non-TTY preamble + `help` index. Explicit `npx @taskless/cli init` preserves the existing `--no-interactive` fallback behavior
- [x] 10.4 Non-TTY routing covered in `help-extensions.test.ts` ("bare taskless (non-TTY) routes to help index" — asserts the non-interactive preamble + topic index)
- [x] 10.5 Update `packages/cli/src/commands/init.ts` install reporting to print "removed N obsolete skills" and "removed M obsolete commands" alongside "installed 1 skill" so users see the cleanup

## 11. Telemetry rename

- [x] 11.1 Rename existing capture sites in `packages/cli/src/commands/help.ts` from `cli_help_<topic>` to `help_<topic>`; emit `help_index` on no-args fetch
- [x] 11.2 Rename action-start events to `cli_<action>` (e.g. `cli_rule_create`, `cli_rule_improve`, `cli_check`); add corresponding `cli_<action>_completed` events with success/failure properties
- [x] 11.3 Remove the old `cli_help`, `cli_help_<topic>`, `cli_init_completed` (renamed to `cli_init_completed`), etc. event names where superseded
- [x] 11.4 Update unit tests covering telemetry to expect the new event names

## 12. Remove `--schema` flag and capability

- [x] 12.1 Remove `--schema` flag from every command's `args` block in `packages/cli/src/commands/*.ts`
- [x] 12.2 Delete any code paths that handle `--schema` (likely in command run() bodies)
- [x] 12.3 Delete or repurpose the `cli-flag-schema` capability spec file (handled by the spec delta, but verify no orphan code references)
- [x] 12.4 Update tests that exercised `--schema` — they get replaced by tests in task 7.4 that verify schemas are embedded in `tskl help` output

## 13. Migration cleanup via existing state

- [x] 13.1 Verify `packages/cli/src/install/state.ts` already records every skill file written per target (verified — `applyInstallPlan` writes a fresh state on every run including all skills/commands per target)
- [x] 13.2 Verify `applyInstallPlan()` deletes files recorded in previous state but absent from current plan (verified — `computeInstallDiff()` produces removals which `applyInstallPlan` deletes before writing)
- [x] 13.3 Add an integration test: simulate a v0.6 install (state file lists the 10 old skills + 6 commands), run new install, assert all 16 are deleted and 1 new skill + 1 new command are written. Test added in `apply-install-plan.test.ts`
- [x] 13.4 The version-check via `metadata.version` in installed skill bodies vs. `__VERSION__` in `checkStaleness()` surfaces "out of date" via `info` (existing behavior, no change required)

## 14. Capability spec deletion (filesystem cleanup)

- [x] ~~14.1 After this change is archived, the spec deltas will guide moving these to the `archive` state. The deletion of `openspec/specs/skill-create-rule/`, `skill-improve-rule/`, `skill-delete-rule/`, `skill-auth-login/`, `skill-auth-logout/`, `skill-ci/`, `cli-flag-schema/` happens at archive time, not implementation time. No action required during apply~~

## 15. Release hygiene

- [x] 15.1 Add a changeset noting BREAKING: CLI verb rename (`rules` → `rule`), removal of `--schema` flag, removal of individual skill names, telemetry event rename. v0.x semver — minor bump (0.6 → 0.7) per project convention
- [x] 15.2 Update `packages/cli/README.md` reflecting the consolidated skill, single command, `--anonymous` flag, and new `taskless help` flow
- [x] 15.3 `init.txt` updated as part of task 8 recipe authoring (uses the new template)
- [x] 15.4 Update root `README.md` reflecting the user-facing changes
- [x] 15.6 `pnpm typecheck` and `pnpm lint` clean
- [x] 15.7 Recipe rendering smoke-tested via `node packages/cli/dist/index.js help <topic>` (canonical, anonymous variants, version interpolation, schema embedding all verified). Full end-to-end install + rule create + check flow against a scratch directory deferred to a separate validation task — covered piecemeal by existing CLI integration tests
