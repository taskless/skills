## Why

`taskless init`/`update` writes a full copy of every skill into each detected tool's directory (`.claude/skills/`, `.cursor/skills/`, `.opencode/skills/`, `.agents/skills/`), producing N identical copies that drift and churn PR diffs. A customer standardizing on a single shared skill surfaced the deeper flaw: the install model has no separation between _where content lives_ and _where tools read it_. Because Codex's install directory **is** `.agents`, the Codex target's `rm -rf` cleanup destroys the very directory other targets point into — so symlinks break `update`, and wrapper files get clobbered with full copies.

The fix is to give canonical content its own home that no tool ever installs into or cleans up: `.taskless/`, Taskless's owned namespace. Every tool location then holds only a thin reference stub. This makes the canonical-destruction bug structurally impossible, keeps content single-sourced, and hedges the still-young `.agents/skills/` standard.

## What Changes

- Canonical skill content moves to `.taskless/skills/<name>/SKILL.md`; canonical command content to `.taskless/commands/tskl/<name>.md`. Written **once**, in Taskless's owned namespace — no tool target ever cleans it up.
- Every tool location receives a thin **reference stub**: an ordinary file with valid frontmatter and a body that delegates to the canonical file. No symlinks anywhere (symlink discovery is broken/unreliable across Cursor, OpenCode, Codex and fragile on Windows checkout).
- `.agents/skills/<name>/SKILL.md` is a stub — it serves OpenCode, Cursor, and Codex, which read `.agents/skills/` natively. `.claude/skills/<name>/SKILL.md` is a stub for Claude Code. Command stubs go to `.claude/commands/tskl/` and `.cursor/commands/tskl/`.
- **BREAKING**: Drop the separate `.cursor/skills/` and `.opencode/skills/` skill-install targets — Cursor and OpenCode read `.agents/skills/` natively, so those copies are removed, not written.
- The install manifest (`.taskless/taskless.json`) gains a per-target **mode**: `canonical` (`.taskless/`) vs `reference` (every tool location). `update` rewrites canonical content only, creates stubs only when missing, and **never** overwrites a stub with full content.
- Cleanup becomes strictly manifest-driven — no `rm -rf` of a path another target sources from.
- A `.taskless/` migration converges existing installs (removes obsolete full copies, replaces any symlinked tool entries with real stubs, writes the canonical store).

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `cli-init`: The install/update model changes from per-tool full copies to a single canonical `.taskless/` store plus mode-aware reference stubs in every tool location. Canonical content location, the stub model, the manifest schema (per-target `mode`), update behavior (rewrite canonical only, preserve stubs), removal of the `.cursor`/`.opencode` skill copy targets, and extension of the model to commands are all requirement-level changes.

## Impact

- **Code**: `packages/cli/src/install/install.ts` (canonical store + stub writes, `installForTool`/`applyInstallPlan`, removal of `rm -rf` glob cleanup), `install/catalog.ts` / `TOOLS[]` (drop `.cursor`/`.opencode` skill targets), `install/state.ts` (manifest `mode` field), `install/frontmatter.ts` (stub generation).
- **Filesystem**: new `.taskless/skills/` and `.taskless/commands/` canonical directories; `.taskless/README.md` "Files" section updated.
- **Migration**: a new `.taskless/` migration removes obsolete `.cursor/skills/`/`.opencode/skills/` copies, replaces symlinked tool entries with real stubs, and seeds per-target `mode` (`filesystem/migrations/`).
- **Manifest**: `.taskless/taskless.json` install-state schema gains per-target `mode`.
- **Tests**: install/update unit tests covering canonical write, stub generation, mode preservation across `update`, symlink-to-stub conversion, and obsolete-copy cleanup.
- **Tools affected**: Claude Code (skill + command stubs), Cursor (command stub; skills via `.agents/` stub), OpenCode / Codex (skills via `.agents/` stub, no separate files).
