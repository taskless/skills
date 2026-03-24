---
"@taskless/cli": patch
---

Fix `init` to clean up stale skills and commands from previous naming conventions before installing. Removes all `taskless-*` and `use-taskless-*` skill directories and both `taskless/` and `tskl/` command directories, then installs a fresh set. Also fixes the embedded command glob and tool registry to use the current `tskl` path.
