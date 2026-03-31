---
"@taskless/cli": minor
---

Reorganize CLI internals into domain directories (`auth/`, `api/`, `rules/`, `filesystem/`, `install/`, `util/`), add a migration-based `.taskless/` bootstrap system, and upgrade from Zod 3 to Zod 4. The filesystem layer introduces numbered migrations with idempotent re-runs, version tracking in `taskless.json`, and automatic v0-to-v1 migration for existing installations. Zod 4 enables native `z.fromJSONSchema()` and `z.toJSONSchema()`, replacing the `zod-to-json-schema` dependency.
