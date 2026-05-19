---
"@taskless/cli": patch
---

Make the wizard's tool-selection step manifest-aware so unchecking a location removes Taskless from it.

- **Manifest-driven pre-check**: the `taskless init` tool-selection multiselect now pre-checks the union of directories recorded in the install manifest and detected tool directories — previously it pre-checked detected tools only. A location Taskless already installed into (notably `.agents/`, which has no detection signal of its own) now shows checked, so it can be unchecked to remove the stubs. The install engine already performed manifest-diffed, target-scoped removal; this only surfaces it in the UI.
- **Three-state hint**: each entry is hinted by origin — `installed` (recorded in the manifest, takes precedence), `detected` (tool present), or `not detected`.
- **Itemized removal confirmation**: when unchecking a location triggers removals, the confirm prompt now names each target and its stub count (e.g. `Remove Taskless from .claude/ (2 stubs)?`) instead of a generic message.

The non-interactive `init --no-interactive` / `update` paths are unchanged, and the canonical `.taskless/` store is never removed.
