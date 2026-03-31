---
"@taskless/cli": patch
---

Add `rules verify` command with three-layer validation: Layer 1 validates rule YAML against the official ast-grep JSON schema (fetched at build time via codegen), Layer 2 checks Taskless-specific requirements (required fields, regex-requires-kind, test file existence), and Layer 3 runs `sg test` for the specified rule. Includes `--schema --json` mode that outputs the ast-grep schema, Taskless requirements, and curated examples for agent consumption.
