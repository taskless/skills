---
"@taskless/cli": minor
---

Add `rules improve` CLI subcommand and `taskless-improve-rule` skill for iterating on existing rules via the new `/cli/api/rule/{ruleId}/iterate` endpoint. The skill guides agents through a decision tree: iterate on a single rule, replace it entirely, or expand into multiple rules. Also updates `rules create` to accept `successCases`/`failureCases` as arrays (matching the updated API schema).
