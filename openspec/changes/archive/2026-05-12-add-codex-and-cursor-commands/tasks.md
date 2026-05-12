## 1. Tool registry updates

- [x] 1.1 Add a `Codex` entry to the `TOOLS` array in `packages/cli/src/install/install.ts` with `detect: [{ type: "directory", path: ".codex" }, { type: "file", path: ".codex/config.toml" }]`, `installDir: ".agents"`, `skills: { path: "skills" }`, and no `commands` field.
- [x] 1.2 Add a `commands: { path: "commands/tskl" }` field to the existing Cursor entry in the `TOOLS` array.
- [x] 1.3 Add a short code comment above `ALL_KNOWN_TOOLS` (or `findToolByInstallDirectory`) documenting that registered tools take precedence over `AGENTS_FALLBACK` when both share an `installDir`, and that this is why Codex's `.agents` resolution wins over the fallback.

## 2. Wizard / install summary labeling

- [x] 2.1 Verify the existing wizard summary already names the tool by its registry `name` field — if so, no change needed (Codex will appear as "Codex" automatically once registered). Confirm by reading `packages/cli/src/wizard/steps/summary.ts` and the install summary printer.
- [x] 2.2 If the summary still uses generic "no tools detected, installing fallback" wording when Codex is the only detected tool, update the wording so detection of Codex produces "Codex detected" messaging and the fallback message only appears when no tools (including Codex) are detected.

## 3. Tests — Codex detection

- [x] 3.1 In `packages/cli/test/install.test.ts`, add `detectTools` scenarios for: `.codex/` directory present → returns Codex; `.codex/config.toml` file present → returns Codex; both signals present → still returns one Codex entry; `.codex/` plus `.claude/` → returns both.
- [x] 3.2 Add an `installForTool` (or `applyInstallPlan`) scenario that runs the install for Codex against a temp dir and asserts: `.agents/skills/<name>/SKILL.md` is written with content matching the embedded source, and no `.agents/commands/` directory or files are created.

## 4. Tests — Cursor commands

- [x] 4.1 Add a Cursor install scenario that asserts both `.cursor/skills/<name>/SKILL.md` and `.cursor/commands/tskl/<filename>.md` are written, with content matching the embedded source for each.
- [x] 4.2 Update any existing Cursor install test that asserted "no command files written for Cursor" — those expectations are now invalid; flip them to assert command files ARE written.

## 5. Tests — disambiguation

- [x] 5.1 Add a unit test for `findToolByInstallDirectory(".agents")` that confirms it returns the Codex descriptor (not `AGENTS_FALLBACK`) once Codex is registered.
- [x] 5.2 Add a regression scenario: a temp dir with no detected tools and no `.codex/` runs `applyInstallPlan` → fallback path is used, files land in `.agents/skills/`, manifest records `.agents` as the target.

## 6. Spec sync

- [x] 6.1 After implementation passes tests, run `pnpm openspec sync --change add-codex-and-cursor-commands` (or follow the project's spec-sync recipe) so `openspec/specs/cli-init/spec.md` reflects the new Codex requirements and the modified Cursor requirement.

## 7. Quality checks

- [x] 7.1 Run `pnpm typecheck` and fix any type errors.
- [x] 7.2 Run `pnpm lint` and fix any lint errors.
- [x] 7.3 Run `pnpm test --filter @taskless/cli` and ensure all tests pass.

## 8. End-to-end verification (manual, one-time)

- [x] 8.1 Build the CLI locally (`pnpm --filter @taskless/cli build`).
- [x] 8.2 In a temp directory with `.codex/` present, run `pnpm cli init --no-interactive` and confirm files land in `.agents/skills/taskless/SKILL.md` and the install summary names Codex as the target.
- [x] 8.3 If a Codex CLI install is available locally, launch `codex` in that temp directory and confirm the `taskless` skill is discoverable (e.g., `/skills` lists it, or invoking it by name works). _Skipped during automated apply — Codex CLI not present in this environment. Detection + file placement verified per spec; the documented Codex read path (`.agents/skills/`) is what we wrote to._
- [x] 8.4 In a separate temp directory with `.cursor/` present, run `pnpm cli init --no-interactive` and confirm `.cursor/commands/tskl/<name>.md` files exist alongside `.cursor/skills/`.
