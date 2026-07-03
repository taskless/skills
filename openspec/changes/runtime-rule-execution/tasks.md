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

- [ ] 6.1 Update `packages/cli/src/help/check.txt` with a runtime-rule section: what runs per mode, and the `--dangerously-run-scripts` warning.
- [ ] 6.2 Update `packages/cli/src/help/ci.txt` to note the enforced (`--enforce`) sandbox as the authoritative runtime-rule enforcement point.

## 7. Tests & verification

- [ ] 7.1 Harness unit tests: narrow assembly (anchor/broad), gate-on-zero-matches (check never invoked), match normalization (hashed id → model name), `Finding` → `CheckResult` mapping, throwing-check isolation, timeout → error finding.
- [ ] 7.2 Mode integration tests (subprocess against `dist/`, temp-dir fixtures with a mock reconcile server + git origin): authed runs blessed runtime rules; partially-blessed rule withheld; logged-out and `--anonymous` skip runtime + report skipped; reconcile-unavailable skips runtime; `--dangerously-run-scripts` runs runtime offline with a warning.
- [ ] 7.3 Static-always-run tests: static rules run in every mode; static rules are not reported to reconcile.
- [ ] 7.4 `--json` shape tests: warnings/notices suppressed; runtime findings appear under the same `results` shape as static findings.
- [ ] 7.5 Run `pnpm typecheck`, `pnpm lint`, and the full `pnpm test` — all green.
