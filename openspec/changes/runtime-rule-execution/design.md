## Context

`taskless check` (`packages/cli/src/commands/check.ts`) has a single executor. The
stacked-under change added reconciliation: enumerate `.taskless/rules/*.yml`, sign each file
(`src/rules/rule-hash.ts`, envelope `1;h=sha-256;d=<hex>` over normalized bytes), call
`POST /cli/api/reconcile`, materialize the blessed `run` set into a gitignored
`.taskless/.run/rules/`, and `sg scan` it (`src/rules/run-set.ts`, `src/filesystem/sgconfig.ts`,
`src/rules/scan.ts`). Findings surface through the scanner-agnostic `CheckResult`
(`src/types/check.ts`, `source: "ast-grep"` today).

A **runtime rule** is a different on-disk shape (TSKL-243, resolved): a **directory** under
`.taskless/runtime-rules/` (with fixtures under `.taskless/runtime-rule-tests/`) holding one or
more ast-grep capture `*.yml` and exactly one `check.ts`. Each capture rule carries
`metadata.taskless`: `version`, `kind: runtime`, `name`, `check`, and `match: anchor|broad`
(broad = whole-language `kind: program` enumerator). A capture rule has two identifiers — a
hashed, globally-unique `id` (`${ruleSlug}-${sha1(ruleBody).slice(0,8)}`) for scan→rule
attribution, and a stable model-assigned `name` the check branches on. Capture rules may carry
full ast-grep config (`constraints`/`utils`/`transform` as **siblings** of `rule`).

The local harness is resolved in TSKL-245: assemble a rule's capture rules → **one**
`ast-grep scan` (anchor `--inline-rules --json=stream`; broad `--files-with-matches`) → gate
on matches → invoke `check.ts`'s **default export** with `(root, matches)` via a bundled,
pinned `tsx`; use the **returned** `Finding[]`. `Finding.severity ∈ error|warning|info` maps
onto static-rule gating with no translation. Measured cost is `tsx` per-worker startup
(~590ms), not per-import (~9–14ms warm), so scheduling (process / `worker_threads` pool /
`import()`) is left to the harness.

The one thing that shape does not carry is trust: `check.ts` is arbitrary code execution. This
change makes the server signature the gate for running it, and reuses reconciliation (already
built, already authenticated) as that gate rather than inventing a local sandbox.

## Goals / Non-Goals

**Goals:**

- Recognize a runtime-rule directory and execute it with the TSKL-245 harness
  (narrow → gate → `check.ts`), producing `CheckResult`s indistinguishable downstream from
  static findings.
- Run `check.ts` **only** on a signature-validated path; skip (never run) on every unverified
  path; provide `--dangerously-run-scripts` as the sole local override.
- Keep static ast-grep rules exactly as they are (always run, no gating, offline linter).
- Bundle a pinned TypeScript loader so `check.ts` runs without the user's toolchain.

**Non-Goals:**

- The **hardened, sandboxed** enforced runner (network/credential-isolated substrate) and its
  commit-bound integrity report. That is the Taskless-hosted `--enforce` runtime, owned
  server-side (TSKL-237/262). This change is the **local** harness (eslint-equivalent trust,
  gated by signature), not the sandbox.
- **Generating** runtime rules or classifying static-vs-runtime — owned by the service
  (`classifyStep`, TSKL-241/244).
- Redefining the signature envelope or `normalize()` — reused unchanged from the stacked-under
  change.

## Decisions

### Decision: Runtime rules live in their own tree; location is the primary classifier

Runtime rules live under `.taskless/runtime-rules/` — each rule a directory holding its capture
`*.yml` and `check.ts` — with fixtures under `.taskless/runtime-rule-tests/`. Static ast-grep
rules stay under `.taskless/rules/`. **Location is the primary rule-class split**: `check`
scans `.taskless/rules/` for static rules and `.taskless/runtime-rules/` for runtime rules,
and `metadata.taskless.kind: runtime` confirms the class. The check file is always `check.ts`
in the rule directory; the CLI reads `metadata.taskless.match` to pick the ast-grep invocation
mode, and never parses rule intent beyond this metadata envelope and the ast-grep config it
already understands. `.taskless/runtime-rule-tests/<name>/` holds `valid/`/`invalid/` fixtures
and is not executed by `check`.

This layout is confirmed against the Taskless internal generator — in the sibling
`taskless/taskless` repo, not this one — at `workers/generator/src/actions/add-runtime-rule.ts`,
which writes
`.taskless/runtime-rules/<slug>-<suffix>/` with `<capture-name>.yml` per capture rule and a
`check.ts`, and hashes `check.ts` with the same `canonicalHash` envelope reconcile uses.

_Alternative rejected:_ co-locating runtime rules under `.taskless/rules/` and splitting on
directory-vs-file. The separate tree is what the generator writes, and a distinct path removes
any ambiguity about which executor owns a given entry.

### Decision: The gate is the rule's `check.ts`; capture `*.yml` are inert and ungated

The signature gate is the one artifact that carries arbitrary code execution: `check.ts`.
`src/rules/run-set.ts` grows to enumerate runtime-rule directories and sign each rule's
`check.ts` (only) with the existing envelope, reporting it as `{ file, signature }`. A runtime
rule is **eligible to execute only if its `check.ts` is returned in `run`**; a `check.ts` in
`unsafe`/`unknown`/`missing` withholds the rule and surfaces it as advisory. Capture `*.yml`
are inert ast-grep patterns — they cannot execute code, so they are not signed or gated; the
worst a tampered capture can do is change which matches feed an already-authentic, already-
blessed `check.ts`, which the enforced runner remains the authority over.

_Alternative rejected:_ sign every file of the rule (each capture `*.yml` plus `check.ts`) and
require all in `run`. It adds withholding churn over inert data for no ACE benefit; the YAML
is harmless.

### Decision: Static rules are not gated; reconciliation is scoped to runtime rules

Static ast-grep `*.yml` are inert data — they always run, with no network, exactly as before
the stacked-under change. Only runtime rules are reported to and gated by reconciliation. This
refines the stacked-under `cli-rule-reconciliation` requirement ("report every rule file"):
the reported corpus is the runtime rules. Concretely, the stacked-under degrade path — which
scans "all local rules unverified" — is narrowed so it scans static rules but **never executes
runtime `check.ts`** without a validated signature.

_Alternative rejected:_ keep gating everything and rely on the server to always bless static
files. That leaves a not-deployed / offline `check` unable to run harmless static rules, a
regression against today's linter posture for zero security benefit.

### Decision: Execution is driven by a single question — "is this runtime rule's signature validated?"

`check` resolves a runtime-execution disposition from auth state and flags:

| State                                                | Runtime rules                                                                                         |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Authenticated (token)                                | reconcile; execute every rule fully in `run`; report the rest as advisory                             |
| API key                                              | same as authenticated                                                                                 |
| Logged out / `--anonymous`                           | skip; report that runtime rules exist and were not run                                                |
| Reconcile cannot complete (no remote, endpoint down) | skip; notice that runtime rules could not be verified                                                 |
| `--dangerously-run-scripts` (any auth state)         | execute **all** runtime rules, trusting local signatures, no server validation, behind a loud warning |

Skipping is never an error and never changes the exit code. This mirrors the stacked-under
degrade philosophy (a not-live endpoint never bricks `check`) while inverting it for ACE:
where static rules degrade to _run-unverified_, runtime rules degrade to _skip_.

_Alternative rejected:_ run runtime rules on locally-cached signatures when the endpoint is
down. That is exactly what `--dangerously-run-scripts` makes explicit; doing it implicitly
would run unverified code the user never opted into.

### Decision: The narrow → gate → `check.ts` harness, per TSKL-245

For each executable runtime rule: collect its capture rules and run **one** `ast-grep` scan —
`--inline-rules --json=stream` in anchor mode, `--files-with-matches` in broad mode
(`kind: program` enumerators). Normalize each match to
`{ rule, ruleId, file (root-relative), line (1-indexed), column, text, captures }`, mapping the
hashed `ruleId` back to the model `name` as `match.rule`. If there are **zero** matches,
`check.ts` is not invoked. Otherwise invoke its **default export** as a function with
`(root, matches)` and use the **returned** `Finding[]`; map each `Finding` onto `CheckResult`
with a runtime `source` and feed it into the existing aggregation and error-severity exit-code
logic. A `check.ts` that throws is isolated to a single error-severity finding for that rule —
it never aborts the whole `check` run. Scheduling (process-per-check vs. worker pool vs.
`import()`) is an implementation choice; the function contract leaves it open.

### Decision: Bundle a pinned `tsx`; execute from the materialized run directory

Ship a pinned `tsx` (or equivalent loader) with the CLI so `check.ts` runs without any
`node_modules`/toolchain in the user's repo. Execute blessed runtime rules from the ephemeral,
gitignored `.taskless/.run/` (extending the stacked-under materialize step), so the bytes
executed are exactly the reconciled-and-blessed bytes (read-hash-execute ordering), not
whatever is live in `.taskless/runtime-rules/` at exec time.

_Alternative rejected:_ require the user to have `tsx`/`ts-node`. Non-hermetic, version-drift
prone, and breaks the "no toolchain assumptions" posture the rest of the CLI keeps.

### Decision: Bound `check.ts` with a timeout; `--timeout` overrides

Each `check.ts` invocation runs under a default wall-clock timeout; a `--timeout <seconds>`
flag on `check` overrides it. A check that exceeds the bound is terminated and recorded as a
single error-severity finding for that rule, and the run continues — a runaway or hanging
check never wedges the overall `check`. This is a robustness requirement, not a tuning knob:
runtime rules are third-party code and must be time-bounded by default.

_Alternative rejected:_ no timeout / rely on the OS. A hung check would block CI indefinitely
with no attributable finding.

## Risks / Trade-offs

- **[Running unverified ACE]** → `check.ts` never runs without either a server-validated
  signature or an explicit `--dangerously-run-scripts`; the degrade path skips runtime rules
  rather than running them.
- **[Capture-file tampering around an authentic `check.ts`]** → accepted: capture `*.yml` are
  inert ast-grep patterns and cannot execute code, so they are ungated; a tampered capture can
  only change which matches feed an already-blessed `check.ts`, and the enforced runner remains
  the authority over rule behavior.
- **[`tsx` startup cost on large corpora]** → the narrow gates first (zero matches ⇒ no
  invoke), and startup amortizes across a worker pool; measured ~590ms per worker, ~9–14ms
  warm per import.
- **[A slow or hanging `check.ts`]** → the harness owns scheduling and SHOULD bound execution
  (timeout → error finding); a runaway check must not wedge `check`.
- **[Silent skips read as "passed"]** → the skipped-runtime notice names the rules skipped and
  points at `--dangerously-run-scripts` / authenticated `check` as the way to run them.
- **[Divergence from the enforced runner]** → local findings are advisory-equivalent; the
  Taskless `--enforce` sandbox remains the authoritative enforcement point and is out of scope
  here.

## Resolved Questions

- **`--json` shape for skipped runtime rules:** resolved — add an additive, optional `skipped`
  array of `{ rule, reason }` to `--json` output, leaving `success`/`results` unchanged, so CI
  can detect that runtime rules did not run.
- **Timeout policy for `check.ts`:** resolved — a default wall-clock bound with a `--timeout`
  override; a timeout terminates the check and records an error-severity finding (see the
  timeout Decision).
- **`--dangerously-run-scripts` with a resolvable token:** resolved — skip the network
  entirely (no reconcile) and execute every present runtime rule, matching how `--anonymous`
  forces the no-network path.
