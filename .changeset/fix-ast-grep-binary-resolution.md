---
"@taskless/cli": patch
---

Fix ast-grep binary not found when CLI installed via pnpm dlx. The strict dependency isolation prevents @ast-grep/cli's postinstall from resolving platform-specific binary packages, leaving a placeholder text file instead of the real binary. Now resolves the platform binary directly from our own module context.
