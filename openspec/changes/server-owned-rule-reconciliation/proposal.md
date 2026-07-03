## Why

The backend is moving to **server-owned rule reconciliation** (TSKL-270): the server, not
the CLI, decides which rule files may run. This is the CLI-side enabler for a new class of
server-blessed rules (including runtime rules) — instead of executing whatever YAML happens
to sit in `.taskless/rules/`, the CLI must report the rule files it holds and execute only
the subset the server returns as `run`. Today `taskless check` runs every `.yml` in the
rules directory with no notion of authenticity or drift; the frozen `POST /cli/api/reconcile`
contract lets us close that gap now, ahead of the endpoint going live in every environment.

## What Changes

- Add a canonical **rule-signature** module (`normalize()` + `canonicalHash()` +
  `parseSignature()`, algoVersion `1`, `1;h=sha-256;d=<hex>`) built on web-standard
  `crypto.subtle` + `TextEncoder`, byte-for-byte matching the server reference.
- Add a **conformance test** that fetches `GET /cli/api/rule-hash-vectors`, commits the
  fixture, and asserts the local hasher reproduces every vector's signature exactly (a
  mismatch is a release blocker).
- Add a **reconcile API client** for `POST /cli/api/reconcile` that reports every rule file
  under `.taskless/rules/` as `{ file, signature }` and parses the `run` / `unsafe` /
  `unknown` / `missing` response.
- **Make `taskless check` behavior depend on auth state** (it still requires no auth):
  - **No token** → run all local rules, no network (today's offline linter posture).
  - **Authenticated** → reconcile, execute **exactly** the server's `run` set (matched back
    to local files by signature), and **warn on mismatches** (`unsafe` / `unknown` /
    `missing`) without changing the exit code.
  - **`--anonymous`** → force the logged-out path (run local, no reconcile call).
- Add a **degrade path**: when an authenticated reconciliation cannot complete (no git
  remote, or the endpoint is unreachable / not yet deployed), `check` warns that verification
  could not be performed and falls back to a local scan without failing — so the not-yet-live
  endpoint never bricks `check`.
- Add a stable `RECONCILE_FAILED` error code to the CLI error enum for `--json` callers.

Out of scope (deliberately, by team decision): how a server-owned rule (including a runtime
rule) _executes_. The reconciliation contract is rule-type-agnostic — it decides which files
run, not how a runtime rule is evaluated. Rule execution is a **separate proposal, landed as a
stacked PR on top of this work**; this change only makes such rules gate-able.

## Capabilities

### New Capabilities

- `cli-rule-reconciliation`: the rule-signature envelope and `normalize()` procedure, the
  conformance-vector contract, the `POST /cli/api/reconcile` client, the four response
  buckets and their required CLI actions, and the run-set-only execution rule.

### Modified Capabilities

- `cli-check`: `check` chooses its behavior from auth state — unauthenticated/`--anonymous`
  runs all local rules; authenticated reconciles and executes only the `run` set, warning on
  `unsafe` / `unknown` / `missing`, and degrading to a local scan if reconciliation can't complete.

## Impact

- **Code:** new `packages/cli/src/rules/rule-hash.ts` and reconcile client under
  `packages/cli/src/api/`; changes to `src/commands/check.ts` (reconcile-then-gate flow) and
  `src/filesystem/sgconfig.ts` / rule enumeration (scan only the blessed set); new error code
  in `src/types/errors.ts`.
- **APIs consumed:** `POST /cli/api/reconcile` (Bearer `<cli-token>`, `repositoryUrl` +
  reported files) and `GET /cli/api/rule-hash-vectors` (unauthenticated, for conformance).
- **Behavioral shift:** `check` gains an auth-state-dependent path — authenticated runs get a
  server-owned allow-list and mismatch warnings; unauthenticated/`--anonymous` runs are
  unchanged (all local rules, no network).
- **Tests:** new conformance-vector test and reconcile/gating tests (vitest, subprocess
  against `dist/`, temp-dir fixtures per existing conventions).
- **Docs:** `check.txt` / `ci.txt` help updated to explain the run-set gate and the CI backstop.
