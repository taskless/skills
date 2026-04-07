---
name: taskless-improve-rule-anonymous
description: Improves existing Taskless rules locally without API access. Uses the agent to modify ast-grep rules and validates changes with the verify feedback loop.
metadata:
  author: taskless
  version: 0.5.1
compatibility: Designed for Agents implementing the Agent Skills specification.
---

# Taskless Improve Rule (Anonymous)

This skill improves existing ast-grep rules locally without requiring Taskless authentication. You will modify the rule yourself using the ast-grep schema as a guide, then validate changes using the verify command.

## Instructions

**Package manager:** All commands below use `npx` as the default. If the project uses a different package manager (check for `pnpm-lock.yaml`, `yarn.lock`, or `bun.lockb`), prefer its equivalent: `pnpm dlx`, `yarn dlx` (Yarn Berry/2+ only), or `bunx`.

1. **Learn the ast-grep rule format.** Run `npx @taskless/cli@latest rules verify --schema --json` and read the output. Study the `astGrepSchema`, `tasklessRequirements`, and `examples` to understand valid rule structure and patterns.

2. **Inventory existing rules.** If the user has named a specific rule, go directly to it. Otherwise, scan `.taskless/rules/` for `.yml` files and present a summary:
   - Rule ID (filename without `.yml`)
   - Language it targets
   - What pattern it detects (from `message`, `note`, or `rule` fields)
   - Any associated test files in `.taskless/rule-tests/`

3. **Read the rule and its tests.** Read the full content of `.taskless/rules/<id>.yml` and any matching test file in `.taskless/rule-tests/`. Understand the current rule logic before making changes.

4. **Understand the improvement request.** Ask the user what they want to improve:
   - What is the rule doing wrong? (false positives, false negatives, wrong fix, missing edge cases)
   - Can they show an example of the incorrect behavior?
   - What would the correct behavior look like?

5. **Search for evidence in the codebase.** Scan for instances where the rule fires (or fails to fire):
   - "I found N places where this rule triggers. Are any of these false positives?"
   - "I found N places where this pattern exists but the rule misses it. Should it catch these?"

6. **Decide on approach.** Based on the user's feedback, choose one of three strategies:

   ### Option A — Iterate on the existing rule (most common)

   Use when the rule is fundamentally correct but needs refinement (false positives, missed edge cases, fix adjustments).
   - Modify `.taskless/rules/<id>.yml` in place
   - Write a new test file at `.taskless/rule-tests/<id>-<YYYYMMDD>-test.yml` with updated cases

   ### Option B — Replace the rule

   Use when the rule is fundamentally wrong and needs a different approach.
   - Invoke the `taskless-create-rule-anonymous` skill to create the replacement
   - Delete the old rule: `npx @taskless/cli@latest rules delete <old-id>`

   ### Option C — Expand with additional rules

   Use when the user's need has grown beyond a single rule.
   - Invoke `taskless-create-rule-anonymous` for each new rule
   - Optionally delete superseded rules

   **Present your chosen approach to the user and get confirmation before proceeding.**

7. **For Option A — modify the rule.** Using the ast-grep schema and the user's feedback:
   - Edit the rule YAML to address the issues
   - Ensure all Taskless-required fields remain present (`id`, `language`, `severity`, `message`, `rule`)
   - Write updated test cases that exercise the improved behavior
   - Include test cases for the specific issues the user reported

8. **Verify the changes.** Run `npx @taskless/cli@latest rules verify <id> --json` and check the result:
   - If `success` is `true`: report success to the user.
   - If `success` is `false`: read the error details, fix the issues, and re-run verify. Repeat until it passes or you've made 3 attempts.

9. **Report results.** Show the user:
   - What changed in the rule
   - The updated file paths
   - Suggest running `taskless-check` to test the changes

## Important Notes

- Do NOT write files to `.taskless/rule-metadata/`. Anonymous rules have no metadata sidecar.
- Do NOT make any API calls to taskless.io.
- The verify feedback loop is your quality gate — always run it before reporting success.
- When delegating to `taskless-create-rule-anonymous` (Options B/C), that skill handles its own verify loop.
