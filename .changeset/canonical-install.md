---
"@taskless/cli": minor
---

Install a single canonical skill/command store with thin per-tool reference stubs.

- **Canonical store**: `taskless init`/`update` now writes the skill and command content exactly once, to `.taskless/skills/<name>/SKILL.md` and `.taskless/commands/tskl/<name>.md`. This Taskless-owned directory is never a tool install target, so no install or cleanup step can ever delete it.
- **Reference stubs**: each enabled tool directory (`.claude/`, `.cursor/`, `.opencode/`, `.agents/`) receives a thin reference stub instead of a full copy — an ordinary file (never a symlink) carrying `name`/`description` frontmatter, a `metadata.type: shim` marker, and a body that delegates to the canonical file. This ends the N-identical-copies drift of the previous per-tool full-copy model. `.claude/` and `.cursor/` also receive a `tskl` command stub; `.opencode/` and `.agents/` receive skills only.
- **Per-target install mode**: `.taskless/taskless.json` records a `mode` (`canonical` | `reference`) per target. The field is additive and backward-compatible — a manifest written before this change reads its entries as `canonical`, so no schema migration is needed.
- **Self-healing convergence**: `applyInstallPlan` rewrites a reference file unless it is already a current, non-drifted shim stub. Full per-tool copies left by older installs, manually-created symlinks, and stubs whose frontmatter has drifted are all converged into stubs on the next `init`/`update`. The destructive `rm -rf` glob cleanup is removed; cleanup is now driven solely by the recorded-manifest diff and scoped to each target's own directory.
- **Wizard tool selection**: the wizard's location step is reframed as "which tools do you want to enable Taskless for?" — a fixed multiselect of `.claude/`, `.cursor/`, `.opencode/`, `.agents/`, with detected entries pre-checked and `.agents/` the default when nothing is detected. The canonical `.taskless/` store is always written and is not a selectable entry.
- **No symlinks**: the CLI never creates symlinks for skills or commands. Symlink-based skill discovery is unreliable across Cursor, OpenCode, and Codex, and breaks on Windows checkout.
