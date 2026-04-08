---
"@taskless/cli": patch
---

Add multi-tool detection for `taskless init`. The CLI now detects and installs skills for OpenCode (`.opencode/`, `opencode.jsonc`, `opencode.json`), Cursor (`.cursor/`, `.cursorrules`), and Claude Code (now also via `CLAUDE.md`). When no tools are detected, skills are installed to `.agents/skills/` as a fallback.
