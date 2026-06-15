---
"@taskless/cli": patch
---

Drop the unused `installedAt` timestamp from the install manifest.

The timestamp was written into `.taskless/taskless.json` on every install but
never read, so it only produced spurious diffs in committed manifests (e.g.
after `pnpm build:self`). A new schema migration (v3) strips it from existing
manifests, and install output is now deterministic. No user-facing behavior
changes.
