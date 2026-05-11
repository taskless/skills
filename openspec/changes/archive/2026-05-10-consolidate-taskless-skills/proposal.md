## Why

Taskless ships ten separate skills today (`taskless-check`, `taskless-create-rule`, `taskless-create-rule-anonymous`, `taskless-improve-rule`, `taskless-improve-rule-anonymous`, `taskless-delete-rule`, `taskless-info`, `taskless-login`, `taskless-logout`, `taskless-ci`) plus six near-duplicate slash commands under `commands/tskl/`. Each skill loads a `description` field into the agent's system prompt for trigger matching, and each invocation loads the full skill body. We have a confirmed customer report of installing Taskless causing the Claude harness to evict other skills from working set, and we know Codex behaves similarly. The current layout costs context whether or not the user is doing anything Taskless-related.

Beyond the eviction issue, the per-skill triggers are inconsistent: the rule-create/improve/delete descriptions list trigger phrases that never mention Taskless ("create a rule", "add a lint rule", "detect this pattern"), so they over-fire in repos that use ESLint or any other rule-based tooling. We have a chance to fix the trigger taxonomy at the same time we fix the bloat.

The CLI's `help` subcommand already exists and is the natural place to relocate skill bodies. Skills become tiny routers that fetch the canonical recipe on demand via `npx @taskless/cli help <topic>` instead of carrying inline instructions. Recipes are fetched only when needed, agents always read the current version (no skill-vs-CLI version drift), and the always-loaded surface shrinks from ten descriptions to one.

## What Changes

- **Replace ten skills with one consolidated `taskless` skill.** New skill body is a ~30-line router that explains how to fetch recipes via `npx @taskless/cli help <topic>` and lists the available topics. The skill description anchors triggers on Taskless-specific phrases or `.taskless/` directory references; generic "rule"/"lint"/"check" verbs without a Taskless anchor SHALL NOT trigger.
- **Replace six slash commands with one `tskl` command.** New command file (`commands/tskl/tskl.md`) routes via `$ARGUMENTS`: if a topic can be inferred, fetch its recipe and proceed; otherwise ask the user what they want to do.
- **Remove the anonymous-variant skills (`taskless-create-rule-anonymous`, `taskless-improve-rule-anonymous`).** Their flows merge into the consolidated skill via a top-level `--anonymous` CLI flag. Per-topic recipes have an optional `<topic>.anonymous.txt` variant that the help command serves when `--anonymous` is passed.
- **Add `--anonymous` as a top-level CLI flag.** Behavior matrix: `rule create`/`rule improve` switch to local-only flow; `rule delete`/`rule verify`/`check`/`auth logout`/`init` no-op; `info` skips the API probe and reports local state only; `auth login` errors with "auth commands cannot be anonymous".
- **Rename CLI `rules` subcommand to `rule` (singular).** Affects every recipe and help filename: `taskless rule create`, `taskless rule improve`, `taskless rule delete`, `taskless rule verify`, `taskless rule meta`. Internal source filename (`packages/cli/src/commands/rules.ts`) MAY stay; the user-facing surface is what changes.
- **Extend `tskl help <topic>` output with a fixed recipe template.** Each recipe SHALL contain a header line (`# Topic: <name> (CLI v<x.y.z> / topic v<n>)`), a Goal, Preconditions, Steps, an embedded JSON schema (zod-to-json-schema, code-fenced) for any `--from` input the recipe writes, an Errors catalog mapping CLI error codes to user-facing fixes, and a See Also section. `tskl help` (no args) returns a topic disambiguation table and a one-paragraph human slug.
- **Wire anonymous variant lookup at compile time.** Build-time map keyed by topic name records which topics have a `.anonymous.txt` variant; runtime lookup is O(1).
- **`npx @taskless/cli` (no args) in non-TTY context routes to `help` instead of attempting interactive install.** TTY context preserves today's wizard behavior.
- **Simplify the install wizard.** With one skill, the optional-skill selection step disappears entirely. The wizard reduces to tool selection + auth.
- **Remove the `--schema` flag and the `cli-flag-schema` capability.** Schemas are now embedded inline in `tskl help <topic>` output, so a separate flag is redundant. Zod schemas remain as the single source of truth and are converted to JSON Schema via `zod-to-json-schema`.
- **Standardize CLI error output.** Every action recipe references error codes (e.g. `AUTH_REQUIRED`, `NO_GITHUB_REMOTE`, `RULE_GENERATION_FAILED`); the CLI SHALL emit these codes with a stable shape when `--json` is set. Recipes can then say "expect this error shape" and agents can branch on it.
- **Audit action commands for self-sufficient file writes.** Recipes return markdown only — no JSON output for action commands. Any work the agent currently does post-CLI (parsing JSON to write files, copying outputs around) moves into the CLI itself so action commands are agent-trivial.
- **Rename telemetry events.** `help_<topic>` (intent), `cli_<action>` (action started), `cli_<action>_completed` (action finished). Existing `cli_help_<topic>` event names are removed; the new taxonomy ships as a hard rename. `help_index` fires when an agent fetches the topic list (probable confusion signal).
- **Hard cut at v0.7.0.** No deprecation period. The existing version-check pattern in installed skills surfaces "out of date" prominently for v0.6 users; running `init` is idempotent and removes the obsolete skill files using state recorded by `state.ts`.

## Capabilities

### New Capabilities

- `skill-taskless`: A single consolidated skill that triggers on any Taskless task. The skill body is a router that defers to `tskl help <topic>` for the canonical recipe. Replaces all per-task skill capabilities.

### Modified Capabilities

- `skills`: Repo layout changes from one-directory-per-task to one consolidated skill. The catalog shrinks from ten entries to one. The per-skill `commandName` metadata convention is replaced by a single `tskl` command. Skill body convention shifts from inline recipes to a router that fetches recipes on demand.
- `cli-help`: Help recipes adopt a fixed template (Goal/Preconditions/Steps/Schema/Errors/See Also) with a versioned header. Anonymous variants are looked up via filesystem convention (`<topic>.anonymous.txt`) with O(1) compile-time map. JSON schemas for `--from` inputs are embedded inline via `zod-to-json-schema`. The `tskl help` (no args) output gains a human slug + topic disambiguation table.
- `cli-rules`: User-facing subcommand renames from `rules` to `rule`. Every subcommand (`create`, `improve`, `delete`, `verify`, `meta`) follows. Help filenames rename to match.
- `cli-init`: Non-TTY context auto-routes to `help` instead of running the wizard. The wizard's optional-skill selection step is removed (only one skill exists). Idempotent reinstall removes obsolete v0.6 skill files using existing state tracking.
- `cli`: A new top-level `--anonymous` flag is recognized on every command with per-command behavior (force local-only on rule/improve, no-op elsewhere, error on `auth login`).
- `cli-check`: Accepts but no-ops `--anonymous`.
- `cli-auth`: `auth login --anonymous` errors with "auth commands cannot be anonymous"; `auth logout --anonymous` is a no-op.
- `analytics`: Telemetry events are renamed to `help_<topic>` (intent), `cli_<action>` (action started), `cli_<action>_completed` (action finished). Hard rename — no dual-emit window. Adds `help_index` for "agent fetched topic list" as a wrong-topic signal.

### Removed Capabilities

- `skill-create-rule`: Folded into `skill-taskless` and `tskl help rule create` (with `--anonymous` variant for local-only flow).
- `skill-improve-rule`: Folded into `skill-taskless` and `tskl help rule improve` (with `--anonymous` variant).
- `skill-delete-rule`: Folded into `skill-taskless` and `tskl help rule delete`.
- `skill-auth-login`: Folded into `skill-taskless` and `tskl help auth` (login branch).
- `skill-auth-logout`: Folded into `skill-taskless` and `tskl help auth` (logout branch).
- `skill-ci`: Folded into `skill-taskless` and `tskl help ci`. The skill is no longer optional — it's a topic anyone can discover via `tskl help`.
- `cli-flag-schema`: Removed entirely. Schemas are embedded inline in `tskl help <topic>` output via `zod-to-json-schema`. The Zod schemas themselves remain as the source of truth; only the user-facing `--schema` flag and its associated requirements go away.

## Impact

- **Code**: 10 `skills/<name>/SKILL.md` files removed, 1 `skills/taskless/SKILL.md` added; 6 `commands/tskl/*.md` files removed, 1 `commands/tskl/tskl.md` added; `packages/cli/src/install/catalog.ts` shrinks to one skill entry; `packages/cli/src/commands/rules.ts` exports rename to `rule` (subcommand registration); `packages/cli/src/commands/help.ts` extended for anonymous variant lookup, recipe template, schema embedding, and the no-args index format; new help files under `packages/cli/src/help/` for each topic (with `.anonymous.txt` variants for `rule-create` and `rule-improve`); `packages/cli/src/wizard/steps/` loses the optional-skills step; CLI error paths standardized to emit JSON with stable `code` field when `--json` is set.
- **Dependencies**: add `zod-to-json-schema` to `packages/cli/package.json`.
- **Skill bundle**: from 10 skills + 6 commands to 1 skill + 1 command.
- **CLI UX (BREAKING)**: `taskless rules create` etc. no longer work — users must use `taskless rule create`. The `--schema` flag is gone. The `--anonymous` flag is new and accepted on every command. `npx @taskless/cli` in non-TTY context now prints help instead of trying to install.
- **Skill installation (BREAKING)**: existing v0.6 installs have ten skills written to each tool location. Running `init` after upgrade removes those files (using state recorded by `state.ts`) and writes the single new skill. The version-check in installed skills surfaces "out of date" so users are prompted to reinit.
- **Analytics**: PostHog dashboards relying on `cli_help_<topic>` event names will break — those names are renamed in a single cut. The new `help_<topic>` / `cli_<action>` / `cli_<action>_completed` taxonomy gives a clean intent → action → completion funnel and exposes wrong-topic re-routing as a measurable signal via `help_index`.
- **Out of scope**: Cursor and Codex formal skill+command support (later); soft deprecation of v0.6 skill names; JSON-only `tskl help` output mode; sandboxed-agent fallback via static `references/` (documented limitation, not addressed); a wider CLI error catalog refactor beyond what recipes need.
