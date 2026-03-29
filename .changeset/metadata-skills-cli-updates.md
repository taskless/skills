---
"@taskless/cli": patch
"@taskless/skills": patch
---

Add `rules meta` CLI subcommand to read sidecar metadata for a rule. Update create-rule skill to check for similar existing rules before creating, and improve-rule skill to use `ticketId` from metadata for the iterate API. Fix test directory references and skill-to-skill handoff in both skills.
