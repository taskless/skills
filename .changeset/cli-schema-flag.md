---
"@taskless/cli": minor
---

Add `--schema` flag to CLI commands with `--json` support. When passed, prints Input Schema, Output Schema, and Error Schema as JSON Schema objects and exits. Introduces Zod as the single source of truth for CLI I/O validation and schema generation.
