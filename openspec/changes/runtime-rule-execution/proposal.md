## Why

Server-owned reconciliation (the stacked-under change) decides **which** rule files may run.
This change defines **how a runtime rule executes** — the deliberate follow-up that
reconciliation was built to enable.

Today every rule is a single ast-grep `*.yml` and `taskless check` has exactly one executor:
`sg scan`. A **runtime rule** is a new class (TSKL-243/245): a directory of one or more
ast-grep capture `*.yml` **plus a `check.ts`** that expresses constraints a single syntactic
pattern cannot — cross-file invariants, import/call graphs, config-vs-code consistency. Its
`check.ts` is **arbitrary code execution**, so the CLI cannot run it the way it runs a
declarative YAML rule.

The trust model follows from that. Static ast-grep rules are inert data and stay an
offline-linter posture: they **always run**. A runtime rule's `check.ts` executes **only when
a valid server signature says so** — reconciliation is the safe-harness gate. Runtime rules
therefore supersede the earlier "advisory vs. enforced / `--dangerously-run-scripts`" framing:
the default safety mechanism is a server-validated signature, not a local sandbox.

## What Changes

- Add a **`cli-runtime-rule-execution`** capability: recognize a runtime-rule directory
  (`metadata.taskless.kind: runtime`), run its capture rules as **one** `ast-grep` narrow
  (anchor `--inline-rules --json=stream`; broad `--files-with-matches` for `kind: program`
  enumerators), **gate on matches**, and only then invoke `check.ts`'s default export with
  `(root, matches)` via a CLI-bundled, pinned `tsx`. Zero matches ⇒ `check.ts` is never
  invoked. Normalize matches to `{ rule, ruleId, file, line, column, text, captures }`
  (hashed `ruleId` mapped back to the model `name`, surfaced as `match.rule`) and map the
  returned `Finding[]` (`severity ∈ error|warning|info`) onto the existing scanner-agnostic
  `CheckResult`.
- **Make `check.ts` execution conditional on a validated signature.** The harness SHALL invoke
  a runtime rule's `check.ts` only when reconciliation returned that rule's `check.ts` in
  `run`, or when `--dangerously-run-scripts` is set. On any unverified path (logged out,
  `--anonymous`, or a reconcile that cannot complete) runtime rules are **skipped with a
  notice** and never executed.
- **Scope reconciliation to each runtime rule's `check.ts`** (refines the stacked-under
  change): static ast-grep `*.yml` and runtime-rule capture `*.yml` are inert and are not
  gated — they always run/apply. Reconciliation reports and gates only the ACE-bearing
  `check.ts`. The stacked-under degrade path ("scan all local rules unverified") is narrowed
  so it **never executes runtime `check.ts`**.
- Add a **`--dangerously-run-scripts`** flag to `check`: assume every runtime rule's signature
  is valid and execute without server validation, behind a loud warning.
- **Materialize blessed runtime rules** into the ephemeral, gitignored `.taskless/.run/` and
  execute from there (read-hash-execute ordering), so the bytes executed are exactly the
  reconciled bytes.

## Capabilities

### New Capabilities

- `cli-runtime-rule-execution`: the runtime-rule on-disk shape the CLI recognizes, the
  narrow→gate→`check.ts` local harness, the pinned-`tsx` invocation contract, match
  normalization, and the `Finding` → `CheckResult` mapping.

### Modified Capabilities

- `cli-check`: static rules always run; runtime rules execute only on a signature-validated
  path; the five auth/flag modes (authed / logged-out / API-key / `--dangerously-run-scripts` /
  `--anonymous`); skipped-runtime reporting; the new `--dangerously-run-scripts` flag; and the
  narrowed degrade path.
- `cli-rule-reconciliation`: the reconciled corpus is scoped to each runtime rule's `check.ts`;
  static ast-grep rules and capture `*.yml` are inert and are not reported or gated. A runtime
  rule is eligible to execute only if its `check.ts` is returned in `run`.

## Impact

- **Code:** new `packages/cli/src/rules/runtime/` (directory recognition, narrow assembly,
  match normalization, `check.ts` invocation via bundled `tsx`, `Finding`→`CheckResult`);
  changes to `src/commands/check.ts` (static-vs-runtime dispatch, the mode table, the
  `--dangerously-run-scripts` and `--timeout` flags, skipped-runtime notices); extension of
  `src/rules/run-set.ts` (enumerate `.taskless/runtime-rules/`, sign each rule's `check.ts`,
  materialize blessed rules) and the reconcile report to carry those `check.ts`.
- **Dependencies:** a pinned `tsx` (or equivalent TypeScript loader) bundled with the CLI so
  `check.ts` runs without the user's toolchain.
- **Behavioral shift:** authenticated `check` gains a second executor for runtime rules;
  unauthenticated / `--anonymous` `check` skips runtime rules (static behavior unchanged);
  `--dangerously-run-scripts` is the explicit local escape hatch.
- **Tests:** runtime-harness unit tests (narrow, gate-on-zero-matches, normalization,
  `Finding` mapping, a throwing `check.ts` isolated to an error finding) and integration tests
  for each of the five modes against a mock reconcile server.
- **Docs:** `check.txt` gains a runtime-rule section (what runs per mode, the
  `--dangerously-run-scripts` warning); `ci.txt` notes the enforced backstop over runtime
  rules.
