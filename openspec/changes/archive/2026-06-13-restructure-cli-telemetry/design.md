## Context

This design is intentionally lean — the taxonomy was decided before writing the
proposal. It records the model and the one non-trivial implementation decision
(centralizing `cli_run`); there is no open architecture to resolve.

Today each command emits `cli_<action>` at start and `cli_<action>_completed` at
end. The telemetry wrapper already attaches standard properties (`cli`,
`cliVersion`, `scaffoldVersion`, org group) and fails silently. Those guarantees
are unchanged; only the event taxonomy changes.

## Goals / Non-Goals

**Goals:**

- One `cli_run` per invocation as the denominator, emitted centrally.
- Named `cli_*` events only for concrete state transitions.
- `cli_help { topic }` replacing the `help_*` trio.
- A hard cut — no dual-emit window.

**Non-Goals:**

- Changing identity, opt-out, standard properties, or silent-failure behavior.
- Per-command run-context enrichment (auth state on `cli_run` already implies
  anonymous vs. authenticated).
- Capturing rule content, prompts, or matched source in any event.

## Decisions

### D1 — `cli_run` is emitted once, centrally, in the runner

The CLI's top-level runner (`index.ts`, around `runCommand`) wraps execution: it
resolves the matched subcommand name, runs the command, and emits a single
`cli_run` with `{ command, success, durationMs, anonymous, loggedIn }` — on both
success and failure (in a `finally`). The CLI version is not added here; it rides
on the standard `cliVersion` property already attached to every event.

_Why:_ Centralizing makes the denominator impossible to forget and removes ~20
per-command start/`_completed` captures. The command name comes from the
resolved citty command; `success` is derived from whether the command threw (or
set a non-zero `process.exitCode`); `durationMs` from a start timestamp.

_Alternative considered:_ keep per-command emission. Rejected — it's what we have
now, and it's the source of the scatter.

### D2 — Concrete-state events fire at the state change, not command boundaries

Each meaningful outcome emits its own event where the state actually changes:

```
rule create success  → cli_rule_created   { mode: "remote"|"static", ruleCount }
rule improve success → cli_rule_improved  { ruleCount }
rule delete success  → cli_rule_deleted   { }
auth login success   → cli_authenticated  { }
auth logout success  → cli_logged_out     { }
init/install success → cli_installed      { targets? }
onboard complete     → cli_onboarded      { }
check finishes       → cli_check_completed{ errorCount, warningCount, findings }
any command fails    → cli_error          { command, code }
help served          → cli_help           { topic }   (topic = "(index)" for no-arg,
                                                        the attempted topic otherwise)
```

Properties are counts/ids/booleans only.

_Why:_ These are the funnel-worthy moments. "Ran info/status/detect/verify/meta"
carries no concrete state beyond the invocation, so those are covered by
`cli_run` alone with no bespoke event.

### D3 — `cli_error` is the single failure event

Instead of `success:false` spread across each `_completed` event, failures emit
one `cli_error { command, code }` (code from the stable `CLIErrorCode` set), and
`cli_run` also records `success:false`. The runner emits `cli_error` from its
catch path so no command has to remember to.

### D4 — Hard cut, no dual-emit

Old event names are removed in the same release; nothing emits both taxonomies.
Dashboards are rebuilt against the new names (the proposal calls this out).

## Risks / Trade-offs

- **[Dashboards/funnels on old names break]** → Accepted and documented; this is
  a deliberate hard cut. The new taxonomy is simpler to rebuild against.
- **[Centralized `cli_run` can't see command-specific context]** → By design
  (D-non-goal). `loggedIn` covers the only cross-cutting dimension we need now.
- **[`success` detection in the runner is imperfect]** → Derive from thrown
  error and `process.exitCode`; commands already use `CLIError` + exit codes
  consistently, so this is reliable.

## Open Questions

- None. (`cli_check_completed` property names — `errorCount`/`warningCount` — are
  a naming detail finalized during implementation against the check result shape.)
