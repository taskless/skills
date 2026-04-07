---
"@taskless/skills": patch
---

Add explicit `commandName: "-"` to anonymous skill frontmatter

The anonymous skills (`taskless-create-rule-anonymous` and `taskless-improve-rule-anonymous`) were missing the `metadata.commandName` field. Added `commandName: "-"` for consistency with all other skills that don't expose a slash command.
