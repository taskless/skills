## Why

The CLI currently only detects Claude Code (via `.claude/` directory). As AI coding tools proliferate — OpenCode, Cursor, and generic agent frameworks — users expect `taskless init` to install skills wherever their tools are configured. Expanding detection also provides a fallback (`.agents/skills/`) so that projects without a recognized tool still get skills installed.

## What Changes

- **Expand Claude Code detection** to also trigger on a `CLAUDE.md` file in the project root (not just the `.claude/` directory).
- **Add OpenCode detection** via `.opencode/` directory, `opencode.jsonc`, or `opencode.json` in the project root. Skills install to `.opencode/skills/<name>/SKILL.md`.
- **Add Cursor detection** via `.cursor/` directory or `.cursorrules` file in the project root. Skills install to `.cursor/skills/<name>/SKILL.md`.
- **Add `.agents/` fallback** — if no recognized tools were detected (zero installs made), install skills to `.agents/skills/<name>/SKILL.md`.
- **Split detection signals from install paths** in `ToolDescriptor` — detection can now be triggered by files or directories, while the install root is a separate field.
- Commands remain Claude Code-only; all other tools receive skills only.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `cli-init`: The init command's detection and install flow changes to support multiple tools, file-based detection signals, and the `.agents/` fallback.

## Impact

- **Code**: `packages/cli/src/install/install.ts` — `ToolDescriptor` type, `TOOLS` registry, `detectTools()` function. `packages/cli/src/commands/init.ts` — fallback logic after install loop.
- **Tests**: Existing detection tests need updating; new tests for each tool's detection signals and the fallback behavior.
- **User-facing**: `taskless init` output changes to list multiple tools when detected; fallback message changes from "no tools found" to installing into `.agents/`.
