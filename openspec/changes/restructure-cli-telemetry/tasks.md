# Tasks

## Phasing — stacked PRs

This change is cut into commitable phases, each of which leaves the build and
tests green and maps to one stacked PR (Git Town). Tests travel with the phase
that introduces the behavior — there is no trailing "tests" phase. Phases are
ordered so the stack reads bottom → top:

```
main
└── docs            openspec change contract (proposal/design/specs/tasks)
    └── phase 1     cli_run denominator + cli_error (runner)
        └── phase 2 rule events (created/improved/deleted)
            └── phase 3 auth + lifecycle events (auth/install/onboard/check)
                └── phase 4 cli_help { topic } + drop info/detect bespoke events
                    └── phase 5 finalize: sweep, gate, archive   ← tip
```

Transitional note: while the stack is mid-flight, a command may briefly emit
both `cli_run` and a soon-to-be-removed legacy event (e.g. after phase 1 but
before phase 2). That dual signal exists only within the unmerged stack; the
hard cut (no dual-emit) holds for the released, fully-merged state. Each phase
keeps the suite green on its own.

## 1. Phase 1 — cli_run denominator + cli_error (PR 1)

- [x] 1.1 In `packages/cli/src/index.ts`, wrap command execution so exactly one `cli_run` is emitted per invocation from a `finally`-equivalent path, with `{ command, cli_version, success, durationMs, anonymous, loggedIn }`
- [x] 1.2 Resolve `command` from the matched citty subcommand (e.g. `"rule create"`, `"help"`); derive `success` from a thrown error / non-zero `process.exitCode`; measure `durationMs` from a start timestamp — extracted to a testable `telemetry-run.ts` (resolveCommandName/resolveCwd/emitRunEvents) so the entry module's side-effecting top level stays untested
- [x] 1.3 Emit `cli_error { command, code }` from the runner's catch path when the failure carries a stable `CliErrorCode` — added an optional `code` to `CliError`; falls back to `INTERNAL_ERROR`
- [x] 1.4 Tests: one `cli_run` per invocation (success and failure), and `cli_error` on a known-code failure — `test/cli-run.test.ts`
- [x] 1.5 typecheck + lint + suite green; commit; open PR 1

## 2. Phase 2 — rule concrete-state events (PR 2, on PR 1)

- [x] 2.1 `commands/rules.ts`: remove `cli_rule_create(_completed)`, `cli_rule_improve(_completed)`, `cli_rule_delete(_completed)`, `cli_rule_meta(_completed)`, `cli_rule_verify(_completed)`
- [x] 2.2 Emit `cli_rule_created`, `cli_rule_improved`, `cli_rule_deleted` at the point each state changes (counts/ids/booleans only); `verify`/`meta` are covered by `cli_run` alone (their command-level telemetry was removed entirely)
- [x] 2.3 Update rule command tests to the new events; assert no `cli_rule_*_completed` — only `telemetry.test.ts` referenced an old rule name (a sample), updated to `cli_rule_created`; rule-from/verify tests assert behavior, not events
- [x] 2.4 typecheck + lint + suite green; commit; open PR 2

## 3. Phase 3 — auth + lifecycle events (PR 3, on PR 2)

- [x] 3.1 `commands/auth.ts`: remove `cli_auth_login(_completed)`, `cli_auth_logout(_completed)`, `cli_auth_status(_completed)`; emit `cli_authenticated` (fresh login only) and `cli_logged_out` (token actually removed); status → `cli_run` only
- [x] 3.2 `commands/init.ts` + `wizard/index.ts`: remove `cli_init(_completed)`, `cli_init_cancelled`, `cli_update(_completed)`; emit `cli_installed` on a successful install (interactive + non-interactive + update)
- [x] 3.3 `commands/onboard.ts`: remove `cli_onboard_recipe` / `cli_onboard_already_done`; emit `cli_onboarded` when onboarding is marked complete
- [x] 3.4 `commands/check.ts`: remove `cli_check(_completed)`; emit `cli_check_completed { errorCount, warningCount, findings }` only when a scan actually runs (counts only — no matched code; `findings` replaces the unavailable `filesScanned`)
- [x] 3.5 Update auth/init/onboard/check tests to the new events — wizard-integration assertions updated to `cli_installed` / no-event-on-cancel; telemetry.test sample names → `cli_run`
- [x] 3.6 typecheck + lint + suite green; commit; open PR 3

## 4. Phase 4 — cli_help { topic } + drop bespoke info/detect events (PR 4, on PR 3)

- [ ] 4.1 `commands/help.ts`: replace `help_index`, `help_<topic>`, `help_unknown` with one `cli_help { topic }` (served topic, an index marker for no-arg, the attempted topic for unknown)
- [ ] 4.2 `commands/info.ts`, `commands/detect.ts`: remove their bespoke `cli_info(_completed)` / `cli_detect` events — covered by `cli_run`
- [ ] 4.3 Update `test/help-extensions.test.ts` / `test/help-routing-telemetry.test.ts` and info/detect tests; assert `cli_help` carries `topic` and no `help_*` event is emitted
- [ ] 4.4 typecheck + lint + suite green; commit; open PR 4

## 5. Phase 5 — finalize (PR 5, tip)

- [ ] 5.1 Grep the CLI for any remaining old event names (`_completed`, `help_index`, `help_<topic>`, `help_unknown`, legacy `cli_<action>` starts); remove any stragglers
- [ ] 5.2 Run `pnpm openspec validate restructure-cli-telemetry`; `pnpm typecheck`; `pnpm lint`; full suite green
- [ ] 5.3 Manual smoke: run a couple of commands with telemetry mocked/inspected — confirm one `cli_run` per invocation plus the expected concrete event, and no legacy names
- [ ] 5.4 Archive the change (`openspec archive restructure-cli-telemetry`) so the tip carries the spec sync + dated archive; commit; open PR 5
