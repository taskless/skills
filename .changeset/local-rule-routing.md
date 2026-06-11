---
"@taskless/skills": minor
---

Add a local-first rule-routing layer. A new deterministic `taskless detect`
command plus `route`/`existing`/`static`/`remote` recipes let the agent author
rules in an existing linter or as a local ast-grep rule on-device, only
escalating to the login-gated service (with confirmation) when a rule cannot be
built locally. The skill now engages this routing flow when a user names a
linter instead of suppressing itself.
