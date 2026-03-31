---
"@taskless/cli": patch
---

Harden CLI security: remove `shell: true` from `spawn` calls to eliminate shell injection surface, add rule ID validation (`/^[a-z0-9][a-z0-9-]*$/`) to prevent path traversal in file operations, escape regex metacharacters in `sg test --filter` arguments, and replace fragile string-based error parsing with structured return types.
