---
"@taskless/cli": patch
---

Fix crash during init when `.taskless/taskless.json` contains corrupt or unparseable JSON. The CLI now treats a corrupt manifest the same as a missing one, allowing migrations to re-run and rewrite it.

Add `module` and `exports` fields to package.json to ensure ESM resolution works correctly on older Node versions or when package.json resolution is incomplete.
