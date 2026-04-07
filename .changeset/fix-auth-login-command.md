---
"@taskless/cli": patch
"@taskless/skills": patch
---

Fix "auth login" to use the correct CLI command

Replaced bare `taskless auth login` references with the proper `npx @taskless/cli@latest auth login` invocation across all skills, commands, CLI error messages, and help text. CLI error messages now dynamically detect the invoking package manager (pnpm, yarn, bun, or npx) via `npm_config_user_agent`. Skills default to `npx` with a note to prefer the project's package manager.
