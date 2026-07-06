---
"@taskless/cli": minor
---

Add server-owned rule reconciliation and runtime rules to `taskless check`. Authenticated runs reconcile the repo's rules against the Taskless service and execute only the server-blessed set. A new class of **runtime rules** (`.taskless/runtime-rules/` — one or more ast-grep capture rules plus a `check.ts` assertion) runs through a local harness: the capture rules narrow with ast-grep, and only on a match is `check.ts` invoked via a bundled `tsx`. Because `check.ts` is arbitrary code, it runs only when its signature is validated by the server; otherwise it is skipped and reported. Adds the `--dangerously-run-scripts` (run runtime rules unverified) and `--timeout` flags.

(Backfills the changeset that was missed when this work landed across #47, #49, and #50.)
