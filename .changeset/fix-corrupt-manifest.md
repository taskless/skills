---
"@taskless/cli": patch
---

Fix crash during init when `.taskless/taskless.json` contains corrupt or unparseable JSON. The CLI now treats a corrupt manifest the same as a missing one, allowing migrations to re-run and rewrite it.
