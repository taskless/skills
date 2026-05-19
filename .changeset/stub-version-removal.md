---
"@taskless/cli": patch
---

Stop stamping a version into reference stubs to keep the footprint outside `.taskless/` stable across releases.

- **Version-free stubs**: `buildSkillStub` / `buildCommandStub` no longer write `metadata.version` into the reference stubs installed into tool directories. Previously every release that bumped the bundled version counted as drift, so `update` rewrote every stub even when its `name`/`description` were unchanged — pure churn in projects that consume Taskless.
- **Drift is name/description only, going forward**: `stubFrontmatterDrifted` regenerates a stub when its discoverable `name`/`description` changes — not on every version bump. The canonical version still lives in `.taskless/` (the skill `SKILL.md` frontmatter), which is where staleness checks already read it from.
- **One-time migration**: `stubFrontmatterDrifted` also treats the presence of a `metadata.version` field as drift, so the next `init` / `update` rewrites each already-installed stub once to strip the obsolete line. After that pass the stub footprint is byte-stable across releases and only changes when the shim's `name`/`description` does.
- **Command shim cleanup**: removed the stale `metadata.version` from the `/tskl` command source. It had been pinned at `0.6.0` while its body last changed in `0.7.0`; the field was only ever consumed to stamp stubs, so it is now dead.

No functional change between 0.8.0 and this release — stub frontmatter was never a documented public API. Expect a single one-time rewrite of existing stubs (to drop the version line); thereafter installs and `update` runs no longer report or rewrite stubs purely because of a version bump.
