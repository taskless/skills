---
"@taskless/cli": minor
---

Add Codex support and expand Cursor with slash commands.

- **Codex detection**: `taskless init` now detects OpenAI Codex via `.codex/` directory or `.codex/config.toml` and labels the install as Codex in the summary. Skills are written to `.agents/skills/<name>/SKILL.md` — Codex's documented read path, which happens to match our existing fallback location, so users with `.codex/` previously fell into the generic fallback path silently. Codex receives no command files: custom slash commands are deprecated upstream and skills are the official replacement.
- **Cursor commands**: the Cursor descriptor now ships our `tskl` slash commands to `.cursor/commands/tskl/<name>.md`, mirroring what Claude Code receives. Cursor 1.6 added commands as a real authored surface; previously Cursor users only got skills.
- **Wizard label**: detected-tool hints in the install location prompt now name the tool (e.g. `detected (Codex)`) instead of just "detected".
