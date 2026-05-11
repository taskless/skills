---
"@taskless/cli": minor
---

Consolidate the 10 per-task Taskless skills into one. The `taskless` skill is now a small router whose body tells the agent to fetch the canonical recipe via `npx @taskless/cli help <topic>` rather than carrying full per-task instructions inline. Recipes live in the CLI bundle so the agent always reads the version current to the installed CLI. This addresses customer reports of the Taskless plugin causing other skills to be evicted from the working set.

**Breaking changes:**

- **Skill names removed.** `taskless-check`, `taskless-ci`, `taskless-create-rule`, `taskless-create-rule-anonymous`, `taskless-delete-rule`, `taskless-improve-rule`, `taskless-improve-rule-anonymous`, `taskless-info`, `taskless-login`, `taskless-logout` no longer exist. The single `taskless` skill replaces them. Existing v0.6 installs auto-migrate when the user runs `npx @taskless/cli` (the install plumbing reads the manifest, deletes obsolete files, writes the consolidated skill).
- **Slash commands collapsed.** The 6 commands under `commands/tskl/` are replaced by a single `/tskl` router that accepts a free-form `$ARGUMENTS` ask.
- **CLI verb renamed: `rules` → `rule` (singular).** `taskless rule create`, `taskless rule improve`, `taskless rule delete`, `taskless rule verify`, `taskless rule meta`. The plural form is no longer recognized — there is no compatibility alias. Pipelines and scripts must update.
- **`--schema` flag removed.** Schemas are now embedded inline in `taskless help <topic>` output via `z.toJSONSchema()` (zod 4 built-in). Agents that previously parsed `--schema` output should fetch the relevant `help` topic and read the embedded code-fenced JSON Schema block.
- **Telemetry rename (hard cut, no dual-emit).** `cli_help_*` events are renamed to `help_<topic>` (intent), `help_index` (no-args fetch), and `help_unknown` (unrecognized topic). Action commands now emit `cli_<action>` (start) and `cli_<action>_completed` (with `success`, `durationMs`, `errorCode?` properties). PostHog dashboards keyed on the old names will need updates.

**New features:**

- **Global `--anonymous` flag.** Recognized on every command. Per-command behavior: `info` skips the API/auth probe; `auth login` errors with "auth commands cannot be anonymous"; `rule create`/`rule improve` exit with a pointer to `taskless help <topic> --anonymous` (the local-only flow runs in the agent per the architecture decision in the OpenSpec change).
- **`taskless help <topic> --anonymous`.** Variant lookup serves `<topic>.anonymous.txt` when present and falls back to the canonical recipe otherwise. Build-time map keeps lookup O(1).
- **Standardized JSON error envelope.** When `--json` is set, failures emit `{ ok: false, code: "<CODE>", message: "<...>" }` with stable codes (`AUTH_REQUIRED`, `NO_GITHUB_REMOTE`, `RULE_GENERATION_FAILED`, `RULE_NOT_FOUND`, `INVALID_INPUT`, `NETWORK_ERROR`, `SCAN_FAILED`, `INTERNAL_ERROR`). Recipes reference these codes by name in their `## Errors` sections.
- **Recipe template.** Every help text follows the same shape: Goal / Preconditions / Steps / Input schema (where applicable) / Errors / See Also. Header line includes the CLI version and a topic version. `{{INPUT_SCHEMA}}` and `{{CLI_VERSION}}` placeholders are interpolated at runtime.
- **Bare `taskless` non-TTY routing.** Without a TTY, bare `taskless` now prints a short context preamble followed by the topic index (instead of citty's default usage screen). TTY behavior unchanged — still launches the wizard.

**Migration:**

Run `npx @taskless/cli` after upgrading. The wizard reads your existing manifest, computes the diff (10 obsolete skills + 6 obsolete commands removed, 1 new skill + 1 new command added), confirms with you, then applies.
