## 1. Manifest schema

- [x] 1.1 Extend `TasklessManifest['install']` in `packages/cli/src/filesystem/migrate.ts` with optional `onboarded?: boolean` field
- [x] 1.2 Verify round-trip read/write preserves the `onboarded` field (no migration needed; field is optional)
- [x] 1.3 Confirm `taskless init` does not write the field (no code change expected; add a unit test if a relevant test surface already exists)

## 2. Onboard recipe content

- [ ] 2.1 Create `packages/cli/src/help/onboard.txt` following the canonical recipe template (`# Topic: onboard (CLI v{{CLI_VERSION}} / topic v1)`, `## Goal`, `## Preconditions`, `## Steps`, `## Errors`, `## See Also`)
- [ ] 2.2 In `## Steps`, document the conversational flow: read manifest, present source menu (TODOs/FIXMEs, agent-memory files, PR comments via `gh`, issue tracker via MCP), invite user-suggested sources, probe tool availability, scan with high-signal filtering, output bullet list of `<kebab-name>: <description>`, offer `/tskl create rule` per item, ask for confirmation before `--mark-complete`
- [ ] 2.3 Reference `taskless help rule create` in `## See Also`
- [ ] 2.4 Confirm `import.meta.glob` picks up `onboard.txt` automatically (no glob pattern change expected; verify by inspecting the embedded map at runtime)

## 3. CLI subcommand

- [ ] 3.1 Create `packages/cli/src/commands/onboard.ts` exporting an `onboardCommand` defined with `citty.defineCommand`
- [ ] 3.2 Define args: `dir` (`-d`, string), `force` (boolean, default false), `mark-complete` (boolean, default false)
- [ ] 3.3 Reject the combination `--force --mark-complete` with exit code 1 and a clear error message
- [ ] 3.4 In default mode: bootstrap `.taskless/` via `ensureTasklessDirectory()`, read manifest, gate on `install.onboarded === true && !force`, print recipe from embedded `onboard.txt`
- [ ] 3.5 In `--mark-complete` mode: bootstrap `.taskless/`, read manifest, set `install.onboarded = true`, write manifest preserving all other fields, print confirmation
- [ ] 3.6 Wire `onboardCommand` into the root command in `packages/cli/src/index.ts`
- [ ] 3.7 Emit telemetry events: `cli_onboard_recipe` (with `forced` property), `cli_onboard_already_done`, `cli_onboard_marked_complete`

## 4. Help index registration

- [ ] 4.1 Confirm `taskless help onboard` resolves and prints `onboard.txt` (no code change expected if the help command uses a glob — verify behavior)
- [ ] 4.2 Update the `taskless help` (no-args) topic table in `packages/cli/src/commands/help.ts` (or wherever the index table is built) to include the `onboard` row with a one-line summary
- [ ] 4.3 Confirm `help_onboard` PostHog event is emitted for `taskless help onboard` (no code change expected; verify the existing intent-telemetry generates it)

## 5. Init trailer

- [ ] 5.1 Add a one-line onboarding trailer to the wizard's success path (after the install summary, before exit) in `packages/cli/src/wizard/`
- [ ] 5.2 Add the same trailer to the `--no-interactive` success path in `packages/cli/src/commands/init.ts`
- [ ] 5.3 Suppress the trailer when init exits non-zero or the install was a no-op
- [ ] 5.4 Verify the trailer is printed regardless of the value of `install.onboarded`

## 6. Skill description and body

- [ ] 6.1 Update `skills/taskless/SKILL.md` `description` frontmatter to include the unspecified-tool clause with the four illustrative examples (eslint, ruff, biome, ast-grep) and remove the prior blanket "do NOT trigger on generic ESLint/linting" carve-out
- [ ] 6.2 Verify the description fits within 1024 characters
- [ ] 6.3 Add an `onboard` row to the skill body's topic disambiguation table mapped to `npx @taskless/cli help onboard`
- [ ] 6.4 Add a `## Quiet suggestion` section to the skill body specifying single-line offer wording, in-conversation sticky decline, and no persistent decline state
- [ ] 6.5 Verify the skill body is no more than 80 lines of markdown

## 7. Tests

- [ ] 7.1 Unit test: `taskless onboard` with no manifest bootstraps `.taskless/` and prints the recipe
- [ ] 7.2 Unit test: `taskless onboard` with `install.onboarded: true` prints the gate notice and exits 0 without printing recipe
- [ ] 7.3 Unit test: `taskless onboard --force` with `install.onboarded: true` prints the recipe and exits 0
- [ ] 7.4 Unit test: `taskless onboard --mark-complete` writes `install.onboarded: true` and preserves other manifest fields (including unknown top-level fields)
- [ ] 7.5 Unit test: `taskless onboard --mark-complete` is idempotent (running twice leaves the file in the same state)
- [ ] 7.6 Unit test: `taskless onboard --force --mark-complete` exits 1 with an error message
- [ ] 7.7 Unit test: `taskless help onboard` returns the same content as `taskless onboard --force` (recipe path)
- [ ] 7.8 Integration test or snapshot: init success paths include the onboarding trailer; cancelled and failed paths do not

## 8. Documentation and release prep

- [ ] 8.1 Add a CHANGELOG entry under the appropriate next-version heading describing the new `onboard` command, the `onboarded` manifest field, the init trailer, and the skill trigger expansion
- [ ] 8.2 Update `packages/cli/README.md` (if it documents subcommands) to include `taskless onboard`
- [ ] 8.3 Run `pnpm typecheck` and `pnpm lint` and resolve any issues
