## ADDED Requirements

### Requirement: Runtime rules are directories recognized by metadata

The CLI SHALL recognize a **runtime rule** as a directory under `.taskless/runtime-rules/<name>/`
containing one or more ast-grep capture `*.yml` (one per capture rule) and a single `check.ts`,
its capture rules declaring `metadata.taskless.kind: runtime`. The rule's check file SHALL be
the `check.ts` in the rule directory. The CLI SHALL read **each capture rule's**
`metadata.taskless.match` (`anchor` or `broad`) to select that capture rule's ast-grep
invocation mode; capture rules within one runtime rule MAY mix modes (each is independent).
Rule files under `.taskless/rules/` SHALL
continue to be treated as static ast-grep rules, not runtime rules.
`.taskless/runtime-rule-tests/<name>/` holds `valid/` and `invalid/` verification fixtures and
SHALL NOT be executed by `check`.

#### Scenario: A runtime-rules directory entry is a runtime rule

- **WHEN** `.taskless/runtime-rules/<name>/` contains capture `*.yml` with `metadata.taskless.kind: runtime` and a `check.ts`
- **THEN** the CLI SHALL treat it as a runtime rule with `check.ts` as its check file and route it to the runtime harness

#### Scenario: Rules under .taskless/rules remain static

- **WHEN** a rule file lives under `.taskless/rules/`
- **THEN** the CLI SHALL treat it as a static rule and SHALL NOT route it to the runtime harness

### Requirement: The harness narrows with one ast-grep scan and gates on matches

For a runtime rule the CLI SHALL assemble the rule's capture rules and run **one** `ast-grep`
scan as the narrow: `--inline-rules --json=stream` in `anchor` mode, and
`--files-with-matches` in `broad` mode (whole-language `kind: program` enumerators). When the
narrow produces **zero** matches the CLI SHALL NOT invoke `check.ts`.

#### Scenario: Zero matches skips the check

- **WHEN** a runtime rule's narrow scan produces no matches
- **THEN** the CLI SHALL NOT invoke that rule's `check.ts`
- **AND** the rule SHALL contribute no findings

#### Scenario: One scan per rule

- **WHEN** a runtime rule has multiple capture rules
- **THEN** the CLI SHALL run them as a single `ast-grep` scan, not one scan per capture rule

### Requirement: Matches are normalized and attributed to the model name

The CLI SHALL normalize every narrow match to
`{ rule, ruleId, file, line, column, text, captures }`, where `file` is root-relative, `line`
is 1-indexed, and `rule` is the capture rule's stable model-assigned `name`. The CLI SHALL map
the hashed capture-rule `id` used by the scan back to that `name` so `match.rule` is the value
the check branches on, never the hash. A `broad` (path-only, `--files-with-matches`) match
carries no location or captures: its `line` and `column` SHALL be `1`, and its `text` and
`captures` SHALL be empty.

#### Scenario: Hashed id maps to model name

- **WHEN** the scan emits a match whose rule id is the hashed `${ruleSlug}-${sha1}` identifier
- **THEN** the normalized match's `rule` SHALL be the capture rule's model-assigned `name`

### Requirement: The check is invoked as a function and its return value is used

The CLI SHALL invoke a runtime rule's `check.ts` by calling its **default export** as a
function with `(root, matches)`, where `root` is the repository root and `matches` are the
normalized matches. The CLI SHALL use the `Finding[]` value the function **returns** as the
rule's result; it SHALL NOT infer results from process exit codes or stdout. A `check.ts` that
throws SHALL be isolated to a single error-severity finding for that rule and SHALL NOT abort
the overall `check` run.

#### Scenario: Returned findings are the result

- **WHEN** a runtime rule's `check.ts` default export returns a `Finding[]`
- **THEN** the CLI SHALL treat exactly those findings as the rule's output

#### Scenario: A throwing check is isolated

- **WHEN** a runtime rule's `check.ts` throws during execution
- **THEN** the CLI SHALL record a single error-severity finding for that rule
- **AND** SHALL continue executing the remaining rules and produce output

### Requirement: check.ts execution is bounded by a timeout

The CLI SHALL bound each `check.ts` invocation with a wall-clock timeout and SHALL accept a
`--timeout <seconds>` flag on `check` to override the default. When a `check.ts` exceeds the
timeout the CLI SHALL terminate it, record a single error-severity finding for that rule, and
continue executing the remaining rules — a runaway check SHALL NOT wedge the overall `check`
run.

#### Scenario: A hanging check is terminated at the timeout

- **WHEN** a runtime rule's `check.ts` runs longer than the effective timeout
- **THEN** the CLI SHALL terminate it and record a single error-severity finding for that rule
- **AND** SHALL continue executing the remaining rules

#### Scenario: --timeout overrides the default

- **WHEN** a user runs `taskless check --timeout <seconds>`
- **THEN** the CLI SHALL use that value as the per-check wall-clock bound

### Requirement: check.ts runs via a bundled TypeScript loader

The CLI SHALL execute `check.ts` using a pinned TypeScript loader bundled with the CLI (e.g.
`tsx`) and SHALL NOT require the user's repository to provide a TypeScript toolchain,
`node_modules`, or a precompile step. The CLI MAY schedule invocations by any mechanism
(process-per-check, worker pool, or in-process import); the function contract does not
constrain the choice.

#### Scenario: No user toolchain required

- **WHEN** a repository with a runtime rule has no local TypeScript toolchain installed
- **THEN** the CLI SHALL still execute the rule's `check.ts` using its bundled loader

### Requirement: Findings map onto the scanner-agnostic result type

The CLI SHALL map each `Finding` returned by a `check.ts` onto the existing `CheckResult`
shape with a runtime `source`, so runtime findings are aggregated, formatted, and counted
toward the exit code identically to static findings. `Finding.severity` (`error` / `warning` /
`info`) SHALL map directly onto the corresponding `CheckResult` severity with no translation.

#### Scenario: Runtime findings gate the exit code like static findings

- **WHEN** a runtime rule returns a finding with `severity: "error"`
- **THEN** the CLI SHALL count it toward the error total that sets a non-zero exit code
- **AND** the finding SHALL appear in `--json` output under the same `results` shape as a static finding

### Requirement: Blessed runtime rules execute from the materialized run directory

When a runtime rule is executed on a validated path, the CLI SHALL execute it from the
ephemeral, gitignored `.taskless/.run/` materialization of the blessed bytes, not from the
live `.taskless/runtime-rules/` tree, so the bytes executed are the exact bytes reconciliation
blessed (read-hash-execute ordering).

#### Scenario: Execution uses the blessed bytes

- **WHEN** a runtime rule is blessed and executed
- **THEN** the CLI SHALL invoke the `check.ts` materialized under `.taskless/.run/`
- **AND** SHALL NOT execute a copy modified in `.taskless/runtime-rules/` after reconciliation
