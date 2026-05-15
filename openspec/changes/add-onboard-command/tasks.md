## 1. Manifest schema

- [x] 1.1 Extend `TasklessManifest['install']` in `packages/cli/src/filesystem/migrate.ts` with optional `onboarded?: boolean` field
- [x] 1.2 Verify round-trip read/write preserves the `onboarded` field (no migration needed; field is optional)
- [x] 1.3 Confirm `taskless init` does not write the field (no code change expected; add a unit test if a relevant test surface already exists)

## 2. Onboard recipe content

- [x] 2.1 Create `packages/cli/src/help/onboard.txt` following the canonical recipe template (`# Topic: onboard (CLI v{{CLI_VERSION}} / topic v1)`, `## Goal`, `## Preconditions`, `## Steps`, `## Errors`, `## See Also`)
- [x] 2.2 In `## Steps`, document the conversational flow: read manifest, present source menu (TODOs/FIXMEs, agent-memory files, PR comments via `gh`, issue tracker via MCP), invite user-suggested sources, probe tool availability, scan with high-signal filtering, output bullet list of `<kebab-name>: <description>`, offer `/tskl create rule` per item, ask for confirmation before `--mark-complete`
- [x] 2.3 Reference `taskless help rule create` in `## See Also`
- [x] 2.4 Confirm `import.meta.glob` picks up `onboard.txt` automatically (no glob pattern change expected; verify by inspecting the embedded map at runtime)

## 3. CLI subcommand

- [x] 3.1 Create `packages/cli/src/commands/onboard.ts` exporting an `onboardCommand` defined with `citty.defineCommand`
- [x] 3.2 Define args: `dir` (`-d`, string), `force` (boolean, default false), `mark-complete` (boolean, default false)
- [x] 3.3 Reject the combination `--force --mark-complete` with exit code 1 and a clear error message
- [x] 3.4 In default mode: bootstrap `.taskless/` via `ensureTasklessDirectory()`, read manifest, gate on `install.onboarded === true && !force`, print recipe from embedded `onboard.txt`
- [x] 3.5 In `--mark-complete` mode: bootstrap `.taskless/`, read manifest, set `install.onboarded = true`, write manifest preserving all other fields, print confirmation
- [x] 3.6 Wire `onboardCommand` into the root command in `packages/cli/src/index.ts`
- [x] 3.7 Emit telemetry events: `cli_onboard_recipe` (with `forced` property), `cli_onboard_already_done`, `cli_onboard_marked_complete`

## 3a. Recipe templating refactor (sprintf-js)

- [x] 3a.1 Add `sprintf-js` (and `@types/sprintf-js`) to `packages/cli` dependencies
- [x] 3a.2 Refactor `renderRecipe` in `packages/cli/src/commands/help.ts` to use `sprintf-js` named arguments. Provide `CLI_VERSION` always, `INPUT_SCHEMA` when the recipe contains the placeholder, and `PACKAGE_MANAGER_DLX` always (rendered as `<package-manager-dlx>` agent-fill marker)
- [x] 3a.3 Migrate every recipe under `packages/cli/src/help/*.txt` from `{{KEY}}` mustache syntax to `%(KEY)s` sprintf-js named-argument syntax
- [x] 3a.4 Smoke-test render output of a representative recipe (e.g. `taskless help ci`) to confirm `%(PACKAGE_MANAGER_DLX)s` resolves to `<package-manager-dlx>` and `%(CLI_VERSION)s` resolves to the build-time version

## 4. Help index registration

- [x] 4.1 Confirm `taskless help onboard` resolves and prints `onboard.txt` (no code change expected if the help command uses a glob — verify behavior)
- [x] 4.2 Update the `taskless help` (no-args) topic table in `packages/cli/src/commands/help.ts` (or wherever the index table is built) to include the `onboard` row with a one-line summary
- [x] 4.3 Confirm `help_onboard` PostHog event is emitted for `taskless help onboard` (no code change expected; verify the existing intent-telemetry generates it)

## 5. Init trailer

- [x] 5.1 Add a one-line onboarding trailer to the wizard's success path (after the install summary, before exit) in `packages/cli/src/wizard/`
- [x] 5.2 Add the same trailer to the `--no-interactive` success path in `packages/cli/src/commands/init.ts`
- [x] 5.3 Suppress the trailer when init exits non-zero or the install was a no-op
- [x] 5.4 Verify the trailer is printed regardless of the value of `install.onboarded`
- [x] 5.5 Branch the trailer wording on whether the install plan included commands: `/tskl onboard` form when at least one target received commands (Claude Code or Cursor); skill-via-natural-language form when no target received commands (OpenCode, Codex, `.agents/` fallback). Thread the flag through `runNonInteractive`'s return type and via `planTargets` in the wizard.

## 6. Skill description and body

- [x] 6.1 Update `skills/taskless/SKILL.md` `description` frontmatter to include the unspecified-tool clause with the four illustrative examples (eslint, ruff, biome, ast-grep) and remove the prior blanket "do NOT trigger on generic ESLint/linting" carve-out
- [x] 6.2 Verify the description fits within 1024 characters
- [x] 6.3 Add an `onboard` row to the skill body's topic disambiguation table mapped to `npx @taskless/cli help onboard`
- [x] 6.4 Add a `## Quiet suggestion` section to the skill body specifying single-line offer wording, in-conversation sticky decline, and no persistent decline state
- [x] 6.5 Verify the skill body is no more than 80 lines of markdown

## 7. Tests

- [x] 7.1 Unit test: `taskless onboard` with no manifest bootstraps `.taskless/` and prints the recipe
- [x] 7.2 Unit test: `taskless onboard` with `install.onboarded: true` prints the gate notice and exits 0 without printing recipe
- [x] 7.3 Unit test: `taskless onboard --force` with `install.onboarded: true` prints the recipe and exits 0
- [x] 7.4 Unit test: `taskless onboard --mark-complete` writes `install.onboarded: true` and preserves other manifest fields (including unknown top-level fields)
- [x] 7.5 Unit test: `taskless onboard --mark-complete` is idempotent (running twice leaves the file in the same state)
- [x] 7.6 Unit test: `taskless onboard --force --mark-complete` exits 1 with an error message
- [x] 7.7 Unit test: `taskless help onboard` returns the same content as `taskless onboard --force` (recipe path)
- [x] 7.8 Integration test or snapshot: init success paths include the onboarding trailer; cancelled and failed paths do not
- [x] 7.9 Update existing help-extensions tests to assert the new `%(KEY)s` sprintf-js syntax (and add a `%(PACKAGE_MANAGER_DLX)s` → `<package-manager-dlx>` rendering test)

## 8. Documentation and release prep

- [x] 8.1 Add a CHANGELOG entry under the appropriate next-version heading describing the new `onboard` command, the `onboarded` manifest field, the init trailer, and the skill trigger expansion (added as a changeset at `.changeset/onboard-command.md`; release tooling rolls it into the next `@taskless/cli` minor)
- [x] 8.2 Update `packages/cli/README.md` (if it documents subcommands) to include `taskless onboard`
- [x] 8.3 Run `pnpm typecheck` and `pnpm lint` and resolve any issues
