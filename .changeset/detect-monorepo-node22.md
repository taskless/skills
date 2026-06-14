---
"@taskless/cli": minor
---

Require Node.js 22+ and make `taskless detect` monorepo-aware.

- **Node floor raised to 22+.** Node 20 reached end-of-life, and detect now uses
  the built-in `fs.glob` walker (Node 22+). This is a breaking engine change,
  which pre-1.0 is a minor bump.
- **`detect` is monorepo-aware.** A single bounded tree walk (curated ignore
  list + depth cap) finds linter configs and language manifests anywhere in the
  repo, not just the root, so a linter configured in a sub-package is detected
  with its path as evidence.
- **languages → linters flow.** A linter's dependency evidence is read only from
  its own language's manifest (`package.json` for node, `pyproject.toml` /
  `requirements.txt` for Python), parsed with real parsers (`smol-toml`,
  `yaml`), instead of conflating ecosystems. A malformed manifest drops only its
  own signal.
- **Dropped the `frameworks` field** from `detect` output. The routing recipe
  never consumed it; the contract now matches its sole consumer.
