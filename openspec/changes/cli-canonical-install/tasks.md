## 1. Manifest schema: per-target mode

- [x] 1.1 Add a `mode: "canonical" | "reference"` field to the per-target install-state type in `install/state.ts`
- [x] 1.2 When reading a legacy manifest with no `mode`, default each target entry to `canonical`
- [x] 1.3 Update `computeInstallDiff` so removals carry enough info to respect each entry's `mode`
- [x] 1.4 Unit test: legacy manifest reads as `canonical`; round-trip of a manifest with both modes

## 2. Canonical store and stub generation

- [x] 2.1 Add a canonical-write helper that writes embedded skill content to `.taskless/skills/<name>/SKILL.md` and command content to `.taskless/commands/tskl/<name>.md`
- [x] 2.2 Add a stub-generation helper that builds a `SKILL.md`/command file with `name`+`description` frontmatter copied from the canonical content and a body delegating to the canonical path
- [x] 2.3 Add a helper to detect frontmatter drift between an existing stub and the canonical content
- [x] 2.4 Unit test: canonical content matches embedded source verbatim
- [x] 2.5 Unit test: generated stub has valid frontmatter, a delegating body, no inlined canonical content, and is a regular file
- [x] 2.6 Unit test: drift detection flags a changed `description` and ignores an unchanged stub

## 3. Install-plan model and tool selection

- [x] 3.1 Define a resolved install-plan target type `{ dir, mode, label, skills, commands }` decoupled from `ToolDescriptor`; keep `ToolDescriptor` for detection only
- [x] 3.2 Build the plan so the `.taskless/` canonical target (`mode: canonical`) is always present when the plan contains a skill or command
- [x] 3.3 Build a `reference`-mode stub target for each selected tool directory: skill stub for all; command stub for `.claude/` and `.cursor/` only
- [x] 3.4 Reframe the wizard location step as a fixed tool-selection multiselect (`.claude/.cursor/.opencode/.agents`), detected pre-checked, `.agents/` default when nothing detected
- [x] 3.5 Update non-interactive `init`/`update` plan construction to the same canonical + per-tool-stub model
- [x] 3.6 Update the install summary to report the canonical `.taskless/` write and each selected stub target

## 4. Apply install plan: mode-aware writes

- [x] 4.1 In `applyInstallPlan`, write full content only to the `canonical` `.taskless/` target
- [x] 4.2 For `reference` targets, write a stub only when absent or when frontmatter has drifted; never overwrite a stub with full content
- [x] 4.3 Remove the destructive `rm -rf` glob in `removeOwnedSkills`/`removeOwnedCommands`; rely solely on manifest-diff-driven removal
- [x] 4.4 Guarantee no target's cleanup deletes the canonical `.taskless/skills/` or `.taskless/commands/` store
- [x] 4.5 Ensure no code path creates a symlink for skills or commands
- [x] 4.6 Persist per-target `mode` into `taskless.json` on write

## 5. Convergence: self-healing applyInstallPlan

- [x] 5.1 Mark reference stubs with frontmatter `metadata.type: shim`; add an `isShimStub` helper
- [x] 5.2 In `applyInstallPlan`, rewrite a reference file unless it is a current, non-drifted shim stub — converging full copies, symlinks, and drifted stubs on the next init/update
- [x] 5.3 Unit test: a full per-tool copy is converted to a shim stub on apply
- [x] 5.4 Unit test: a symlinked tool entry is replaced with a real shim stub
- [x] 5.5 Unit test: migration version matrix — seed `.taskless/` at v0/v1/v2 and assert each forward-migrates to the latest schema

## 6. Update behavior

- [x] 6.1 Verify `taskless update` rewrites canonical `.taskless/` content and leaves reference stubs intact
- [x] 6.2 Verify update reports written and converted files per target in the install summary
- [x] 6.3 Unit test: update against a stub install does not clobber the stub
- [x] 6.4 Unit test: update never deletes the canonical store while cleaning another target

## 7. Verification and docs

- [ ] 7.1 Run `pnpm typecheck` and `pnpm lint`; fix any issues
- [ ] 7.2 Run the CLI test suite; update existing install/update tests for the canonical-store-plus-stub model
- [ ] 7.3 Add a changeset describing the new install model and the BREAKING removal of `.cursor`/`.opencode` skill copies
- [ ] 7.4 Update CLI README / `help` text for `init`/`update` to describe the canonical `.taskless/` layout
- [ ] 7.5 Update the `.taskless/README.md` "Files" section to document `skills/` and `commands/`
