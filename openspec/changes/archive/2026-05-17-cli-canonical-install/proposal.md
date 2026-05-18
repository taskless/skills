## Why

`taskless init`/`update` writes a full copy of every skill into each detected tool's directory (`.claude/skills/`, `.cursor/skills/`, `.opencode/skills/`, `.agents/skills/`), producing N identical copies that drift and churn PR diffs. A customer standardizing on a single shared skill surfaced the deeper flaw: the install model has no separation between _where content lives_ and _where tools read it_. Because Codex's install directory **is** `.agents`, the Codex target's `rm -rf` cleanup destroys the very directory other targets point into — so symlinks break `update`, and wrapper files get clobbered with full copies.

The fix is to give canonical content its own home that no tool ever installs into or cleans up: `.taskless/`, Taskless's owned namespace. Every tool location then holds only a thin reference stub. This makes the canonical-destruction bug structurally impossible, keeps content single-sourced, and hedges the still-young `.agents/skills/` standard.

## What Changes

- Canonical skill content moves to `.taskless/skills/<name>/SKILL.md`; canonical command content to `.taskless/commands/tskl/<name>.md`. Written **once** and always maintained, in Taskless's owned namespace — no tool target ever cleans it up.
- Every selected tool directory receives its own thin **reference stub**: an ordinary file with valid frontmatter and a body that delegates to the canonical file. No symlinks anywhere (symlink discovery is broken/unreliable across Cursor, OpenCode, Codex and fragile on Windows checkout).
- Stubs are uniform: `.claude/`, `.cursor/`, `.opencode/`, and `.agents/` are peer targets. Each selected one gets a skill stub; `.claude/` and `.cursor/` additionally get a command stub. `.agents/` is an ordinary selectable target, not a special shared location.
- Per-tool full skill copies are replaced by per-tool stubs. No target is dropped — the installed file shape changes from a full `SKILL.md` to a delegating stub, which is what kills the N-identical-copies drift.
- The install manifest (`.taskless/taskless.json`) gains a per-target **mode**: `canonical` (`.taskless/`) vs `reference` (each tool directory). `update` rewrites canonical content only, regenerates a stub only when its frontmatter has drifted, and **never** overwrites a stub with full content.
- The interactive wizard reframes its location step as "which tools do you want to enable Taskless for?" — a fixed multiselect of `.claude/.cursor/.opencode/.agents`, detected entries pre-checked.
- Cleanup becomes strictly manifest-driven — no `rm -rf` of a path another target sources from.
- Existing installs converge without a migration. Stubs carry `metadata` with a `type: shim` marker and the canonical `version`, and `applyInstallPlan` self-heals: it rewrites any reference file that is not a current shim stub — a full copy from an older install, a symlink, or a drifted stub — on the next `init`/`update`.

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `cli-init`: The install/update model changes from per-tool full copies to a single canonical `.taskless/` store plus mode-aware reference stubs in each selected tool directory. Canonical content location, the uniform stub model, the manifest schema (per-target `mode`), update behavior (rewrite canonical only, preserve stubs), the wizard's reframed tool-selection step, and extension of the model to commands are all requirement-level changes.

## Impact

- **Code**: `packages/cli/src/install/install.ts` (canonical store + stub writes, the install-plan model, `applyInstallPlan`, removal of `rm -rf` glob cleanup), `install/canonical.ts` (canonical write + stub helpers), `install/state.ts` (manifest `mode` field), `commands/init.ts` + `wizard/` (plan construction, reframed tool-selection step, summary).
- **Filesystem**: new `.taskless/skills/` and `.taskless/commands/` canonical directories; `.taskless/README.md` "Files" section updated.
- **Manifest**: `.taskless/taskless.json` install-state schema gains per-target `mode` (backward-compatible — a missing `mode` reads as `canonical`).
- **Tests**: install/update unit tests covering canonical write, stub generation, mode preservation across `update`, symlink-to-stub conversion, and full-copy-to-stub conversion.
- **Tools affected**: Claude Code and Cursor (skill + command stubs); OpenCode and Codex/`.agents` (skill stub, no commands).
