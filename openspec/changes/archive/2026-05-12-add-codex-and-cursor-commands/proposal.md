## Why

OpenAI Codex is the next AI coding tool we want Taskless skills to flow into. Per the official Codex docs, Codex auto-discovers skills from `.agents/skills/` — the exact path we already use as our "no tools detected" fallback. So we're already shipping into Codex's canonical location by accident, but the CLI never tells the user "Codex was detected" and never adapts the install summary accordingly.

While we're touching the multi-tool registry, Cursor 1.6 added official support for `.cursor/commands/<name>.md` slash commands. We currently install skills for Cursor but skip commands — meaning Cursor users miss the `tskl` slash-command UX that Claude users get. Since the harness already supports a per-tool commands path, this is a near-free expansion.

## What Changes

- **Add Codex to the tool registry** — detect via `.codex/` directory or `.codex/config.toml` file at the repo root. Install skills to `.agents/skills/<name>/SKILL.md` (Codex's documented read path). Codex receives no commands (Codex's custom slash commands are deprecated; skills are the official replacement).
- **Expand Cursor to install commands** — Cursor's tool descriptor gains `commands: { path: "commands/tskl" }`. Our embedded `tskl` command files are now also written to `.cursor/commands/tskl/<name>.md`, in addition to the skills already shipped.
- **Disambiguate the `.agents/` lookup** — Codex's `installDir` (`.agents`) collides with `AGENTS_FALLBACK.installDir` (`.agents`). The state-based cleanup helper that finds a tool by `installDir` must prefer the registered tool entry over the fallback so previous-state lookups resolve to "Codex" rather than the generic fallback.
- **Update install summary messaging** — when `.codex/` is present, the wizard summary names "Codex" as the target rather than the generic fallback, so users understand why files are landing in `.agents/`.
- **Tests** — new unit scenarios for Codex detection signals, Codex install-path correctness, Cursor command writes, and the Codex-vs-fallback lookup behavior.

Out of scope (call out for the implementer):

- Codex subagents (`.codex/agents/*.toml`) — different format, separate surface
- Codex plugins packaging (`.codex-plugin/plugin.json`) — distribution layer above skills
- Cursor rules (`.cursor/rules/`) — we don't ship rules content
- Global install paths (`~/.codex/skills/`, `~/.cursor/skills/`) — repo-local only
- Resurrecting deprecated `~/.codex/prompts/`

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `cli-init`: Adds Codex to the tool registry with new detection signals and the `.agents/skills/` install path; expands the Cursor descriptor to include the commands path; disambiguates the `installDir`-keyed lookup so Codex wins over the fallback when both share `.agents`.

## Impact

- **Code**: `packages/cli/src/install/install.ts` — `TOOLS` registry (Codex entry + Cursor `commands` field), `findToolByInstallDirectory` (collision handling).
- **Tests**: `packages/cli/test/install.test.ts` — new detection scenarios for Codex, install scenarios verifying writes to `.agents/skills/` for Codex and `.cursor/commands/tskl/` for Cursor, lookup behavior when Codex and fallback both target `.agents/`.
- **Specs**: `openspec/specs/cli-init/spec.md` — new requirements for Codex detection signals + install path, Cursor commands path, and the Codex/fallback disambiguation rule.
- **User-facing**: `taskless init` output now lists "Codex" as a detected tool when `.codex/` is present; Cursor users see commands installed alongside skills.
- **No breaking changes**: existing detection and install paths for Claude Code, OpenCode, and Cursor skills are unchanged. The fallback continues to write to `.agents/skills/` for users with no detected tools.
