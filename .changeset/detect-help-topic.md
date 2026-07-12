---
"@taskless/cli": patch
---

Add a help recipe for the `detect` command.

`detect` is a registered subcommand, so it appeared in the `taskless help`
topic index — but `taskless help detect` had no backing `detect.txt` and fell
through to "Unknown command", exiting 1. Every other registered command already
had a matching help file; `detect` was the lone gap. The new recipe documents
the `--json` output shape (linters, languages, ruleStyles) and cross-links to
the `route`/`existing` authoring flow that consumes it.
