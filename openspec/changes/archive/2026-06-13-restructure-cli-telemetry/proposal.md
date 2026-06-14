## Why

The CLI's PostHog taxonomy emits a `cli_<action>` start event plus a
`cli_<action>_completed` event for nearly every command — roughly two events per
invocation, with the "ran" signal scattered across ~20 distinct event names.
There is no single denominator for "the CLI was invoked," so basic questions
("how many runs of each command", "overall success rate") require stitching many
event names together. Following PostHog's own guidance, we want one top-level
`cli_run` event per invocation as the denominator, and to reserve named `cli_*`
events for concrete state transitions worth analyzing as funnels.

## What Changes

- **NEW `cli_run`** — emitted exactly once per invocation, centrally in the CLI
  runner, with properties `command`, `success`, `durationMs`, `anonymous`, and
  `loggedIn` (the CLI version rides on the standard `cliVersion` property already
  attached to every event — `cli_run` adds no second version field). This is the
  universal denominator; no command emits its own "started/ran" event anymore.
- **`cli_*` reserved for concrete state transitions** — replace the per-command
  start/`_completed` pairs with events that represent real outcomes:
  `cli_rule_created`, `cli_rule_improved`, `cli_rule_deleted`,
  `cli_authenticated`, `cli_logged_out`, `cli_installed`, `cli_onboarded`,
  `cli_check_completed` (error counts only — no rule content or matched code),
  and a unified `cli_error` (`command`, `code`).
- **`cli_help { topic }`** — replace `help_index` / `help_<topic>` / `help_unknown`
  with a single `cli_help` event carrying a `topic` field (parallel to
  `cli_run`'s `command`), so help intent is one event filtered by topic.
- **BREAKING (analytics only)** — the previous taxonomy is a hard cut, no
  dual-emit window. Dashboards/funnels built on the old names must be rebuilt.
- **No per-command enrichment context** — `cli_run` already carries the two
  cross-cutting dimensions we need: `loggedIn` (a valid token is present) and
  `anonymous` (no authenticated identity resolved). These are distinct from the
  `--anonymous` flag, which is an independent per-command invocation choice;
  commands do not thread extra run-context properties in this change.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `analytics`: Rewrite the CLI event taxonomy — introduce `cli_run` as the
  once-per-invocation denominator, replace start/`_completed` pairs with
  concrete-state `cli_*` events, collapse the `help_*` events into
  `cli_help { topic }`, and update the wrong-topic re-routing funnel to derive
  from the new events. Standard-property guarantees are unchanged.

## Impact

- **Centralized emission**: `packages/cli/src/index.ts` runner gains the
  `cli_run` emission (resolved command name + success + duration), so the event
  cannot be forgotten per command.
- **Per-command call sites** (`commands/{rules,auth,init,check,info,onboard}.ts`,
  `wizard/index.ts`): remove start/`_completed` captures; emit concrete-state
  events at the point the state actually changes.
- **Help** (`commands/help.ts`): `help_index`/`help_<topic>`/`help_unknown` →
  `cli_help { topic }`.
- **Telemetry module** (`telemetry.ts`): standard properties unchanged; the
  wrapper continues to attach `cli`, `cliVersion`, `scaffoldVersion`, and org
  group to every event.
- **Tests**: `test/telemetry.test.ts` and command tests that assert event names
  update to the new taxonomy.
- **Privacy**: concrete events carry counts/ids/booleans only — never rule
  content, prompts, or matched source.
- **No new dependencies**; no change to opt-out, identity, or silent-failure
  behavior.
