---
"@taskless/cli": patch
---

Add anonymous rule creation and improvement skills that work without API authentication. The existing `/tskl:rule` and `/tskl:improve` commands now check auth status via `taskless info --json` and transparently delegate to anonymous variants when not logged in. Anonymous skills use the `rules verify` feedback loop to iteratively validate agent-generated rules against the ast-grep schema.
