---
"@taskless/cli": minor
---

Add interactive `init` wizard. Running `taskless` in a terminal (or `taskless init`) now launches a `@clack/prompts` wizard that lets you pick install locations, choose optional skills (currently `taskless-ci`), and walks through the auth tradeoff before writing anything.

**Breaking:** bare `taskless` (no subcommand) now delegates to `init` when stdout is a TTY. Non-TTY invocations still print top-level help. For scripted installs, pass `--no-interactive` to `taskless init` to preserve the previous behavior (install mandatory skills to every detected tool location, no prompts).

Also adds:

- `install` field in `.taskless/taskless.json` (migration 2) tracking per-target skills and commands, used by the wizard to compute a diff and surgically remove files on re-run
- `taskless-ci` skill in the bundle as an optional opt-in, with agent-facing instructions that cover CI discovery, full-scan/diff-scan patterns, and non-destructive config generation for any CI system the agent recognizes
- `taskless check <paths...>` for diff-only scanning in CI (silently filters missing paths so `git diff` output can be piped in directly)
- `cliVersion` and `scaffoldVersion` attached to every PostHog telemetry event, for deprecation tracking
