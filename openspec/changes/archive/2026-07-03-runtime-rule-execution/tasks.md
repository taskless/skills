## 1. Runtime-rule recognition

- [x] 1.1 Add `packages/cli/src/rules/runtime/discover.ts`: enumerate `.taskless/runtime-rules/` for rule directories, parse each capture `*.yml`'s `metadata.taskless` (`kind`, `name`, `check`, `match`), and confirm the class via `kind: runtime`. Return a typed `RuntimeRule` (`{ dir, captureFiles, checkFile, match }`). `.taskless/runtime-rule-tests/` is not enumerated for execution. (Also mirrored the harness↔check contract types into `src/types/runtime-rule.ts`.)
- [x] 1.2 Static rules stay sourced from `.taskless/rules/`; runtime rules from `.taskless/runtime-rules/` — location is the class split.

## 2. Narrow → gate → check harness

- [x] 2.1 Add `packages/cli/src/rules/runtime/narrow.ts`: assemble a rule's capture rules and run ONE `ast-grep` scan per mode — anchor `--json=stream`, broad `--files-with-matches` (`kind: program`). (Used a temp `--config` rules dir rather than `--inline-rules` — a runtime rule has multiple capture rules + full ast-grep config, which `--inline-rules` can't carry; **copies the original capture `*.yml` bytes** to avoid a YAML round-trip. Grouped by mode: all-anchor = 1 scan, mixed = 1 per mode to avoid broad's whole-file streaming. Reuses `findSgBinary`/`buildPath`.)
- [x] 2.2 Add match normalization to `{ rule, ruleId, file (root-relative), line (1-indexed), column, text, captures }`, mapping the hashed capture `id` back to the model `name` surfaced as `match.rule`. (ast-grep 0-indexed → 1-indexed; captures from `metaVariables.single`.)
- [x] 2.3 Gate on matches: when the narrow yields zero matches, do NOT invoke `check.ts`.
- [x] 2.4 Add `packages/cli/src/rules/runtime/invoke.ts`: call `check.ts`'s default export with `(root, matches)` via a CLI-bundled, pinned `tsx`; use the returned `Finding[]`. Isolate a throwing check to a single error-severity finding for that rule. (Runs an embedded ESM runner under `tsx`; findings via an out-file so the check's stdout can't pollute the channel.)
- [x] 2.5 Decide and implement scheduling: process-per-check (each invoke spawns a `tsx` process), rules run sequentially; bound each check with a default wall-clock timeout (`DEFAULT_CHECK_TIMEOUT_MS`, overridable via `--timeout`) that SIGKILLs the check and records a single error-severity finding.
- [x] 2.6 Map each `Finding` (`severity ∈ error|warning|info`, omitted → warning) onto `CheckResult` with `source: taskless-runtime` (`src/rules/runtime/harness.ts`); feeds the existing aggregation and exit-code logic.

## 3. tsx bundling

- [x] 3.1 Add a pinned `tsx` to the CLI `dependencies` and resolve its bin at runtime via `createRequire`/`tsx/package.json` (no repo-local toolchain assumed); externalized from the Vite bundle (spawned as a subprocess).
- [x] 3.2 Verify `check.ts` executes with no `node_modules` and no precompile — smoke-tested against a temp-dir fixture (discovery → narrow → `tsx` invoke → finding); automated coverage lands in Group 7.

## 4. Reconcile scoping & materialization

- [x] 4.1 Add `src/rules/runtime/run-set.ts` (runtime-cohesive rather than bloating the static `run-set.ts`): enumerate via `discoverRuntimeRules`, `signRuntimeChecks` signs each rule's `check.ts` only, `reportRuntimeChecks` maps to `{ file, signature }` (capture `*.yml` and static rules are inert — not reported).
- [x] 4.2 `selectBlessedRuntimeRules(signed, run)` computes per-rule eligibility by content-join: a rule is blessed iff its `check.ts` signature is in `run`; the rest are `withheld` (advisory).
- [x] 4.3 `materializeRuntimeRules` copies blessed rule dirs into `.taskless/.run/runtime-rules/<name>/` and re-discovers them (via `discoverRuntimeRulesIn`) so the narrow + `check.ts` execute the blessed bytes; `addToGitignore` keeps `.run/` ignored.

## 5. check dispatch & modes

- [x] 5.1 Rewrote `src/commands/check.ts`: static rules under `.taskless/rules/` always scan; runtime rules route through the harness only on a validated path. **Cutover** — removed the stacked-under static-reconcile gating (deleted `src/rules/run-set.ts`).
- [x] 5.2 `planRuntime` implements the mode table: authed → reconcile & run blessed rules, withhold the rest (advisory); logged-out/`--anonymous`/no-remote/reconcile-unavailable → skip runtime + report skipped; `--dangerously-run-scripts` → run all runtime rules (no network).
- [x] 5.3 Added `--dangerously-run-scripts` (skips reconciliation, runs all runtime rules, prominent stderr warning suppressed under `--json`) and `--timeout <seconds>` (→ `parseTimeoutMs`).
- [x] 5.4 The former degrade path now scans static rules but **never executes runtime `check.ts`** unverified — skip-with-notice instead.
- [x] 5.5 Skipped-runtime notices are human-output; under `--json` an additive optional `skipped: [{ rule, reason }]` field is added (schema updated) leaving `success`/`results` unchanged. Fixed a `Finding`→`CheckResult` off-by-one (findings are 1-indexed; `CheckResult.range` is 0-indexed). Exit code stays governed solely by error-severity findings. Removed the now-obsolete `test/reconcile-check.test.ts` + `test/run-set.test.ts` (Group 7 adds runtime-dispatch tests).

## 6. Help & docs

- [x] 6.1 Updated `check.txt` (topic v2): the two rule kinds, what runs per mode, the `--dangerously-run-scripts` warning, `--timeout`, and the `--json` `skipped` array.
- [x] 6.2 Updated `ci.txt` step 7: static rules always run unauthenticated; the `TASKLESS_TOKEN` backstop is the authoritative enforcement point for runtime `check.ts`.

## 7. Tests & verification

- [x] 7.1 `test/runtime-harness.test.ts` (imports src, real ast-grep + tsx): discovery, gate-on-zero-matches (check never invoked), match normalization + `Finding`→`CheckResult` indexing, throwing-check isolation, timeout → error finding.
- [x] 7.2 `test/runtime-check.test.ts` (subprocess against `dist/`, temp fixtures + mock reconcile server + git origin): authed runs blessed rules; empty-run withholds; logged-out and `--anonymous` skip + report; reconcile-unavailable (503) skips; `--dangerously-run-scripts` runs offline with a warning.
- [x] 7.3 Static-always-run asserted in every mode; reconcile receives ONLY the runtime `check.ts` (never the static YAML).
- [x] 7.4 `--json` shape: warnings/notices suppressed; runtime findings share the `results` shape; the optional `skipped` array present when runtime rules don't run.
- [x] 7.5 `pnpm --filter @taskless/cli typecheck`, `pnpm lint`, and full `pnpm test` (338 tests) — all green. Also fixed a real timeout bug (SIGKILL the tsx process _group_, not just the wrapper, so a runaway check is actually terminated).
