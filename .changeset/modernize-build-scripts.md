---
"@taskless/cli": patch
---

chore: Modernize build tooling and version syncing

- Replaced link-skills.sh with TypeScript for consistency across all build scripts
- Refactored package.json scripts to use npm-run-all2 (run-s) for cross-platform sequential execution, removing all && chains
- Simplified turbo.json by removing root tasks in favor of explicit run-s orchestration via namespaced sub-scripts (build:_, bump:_)
- Fixed link-skills to also symlink commands/ into .claude/commands/ (was a broken symlink)
- Version syncing (bump:sync) now also updates .claude-plugin/plugin.json and root package.json to stay in sync with CLI version
- Disabled unicorn/no-null eslint rule globally, removing inline overrides
