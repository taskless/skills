---
name: taskless-improve-rule
description: Improves existing Taskless rules by iterating with guidance. Use when the user wants to refine, fix, or improve existing rules. Trigger on "improve rule", "fix my rule", "iterate on rule", "refine taskless rule", or "my rule isn't working".
metadata:
  author: taskless
  version: 0.5.1
  commandName: tskl:improve
compatibility: Designed for Agents implementing the Agent Skills specification.
---

# Taskless Improve

When this skill is invoked, help the user improve an existing Taskless rule by determining the best approach and executing it.

This is a decision-making skill. You must evaluate the situation and choose the right strategy — not every improvement is a simple iteration.

## Instructions

**Package manager:** All commands below use `npx` as the default. If the project uses a different package manager (check for `pnpm-lock.yaml`, `yarn.lock`, or `bun.lockb`), prefer its equivalent: `pnpm dlx`, `yarn dlx`, or `bunx`.

1. **Check authentication status.** Run `npx @taskless/cli@latest info --json` and parse the JSON output. Check the `loggedIn` field:
   - If `loggedIn` is `true`: continue with step 2 below (API-backed flow).
   - If `loggedIn` is `false`: **stop here** and invoke the `taskless-improve-rule-anonymous` skill instead. Pass along any context the user has already provided about which rule to improve and what changes they want.

2. **Read current command documentation.** Run `npx @taskless/cli@latest help rules improve` and read the output. Use this to understand the improve command's `--from` JSON fields, options, and examples.

3. **Inventory existing rules.** If the user has already named a specific rule, skip to that rule directly. Otherwise, scan the `.taskless/rules/` directory for `.yml` files and present a summary. For each rule, note:
   - The rule ID (filename without `.yml`)
   - The language it targets
   - The pattern it detects (from the `message`, `note`, or `rule` fields)
   - Any associated test files in `.taskless/rule-tests/`

   Once a rule is selected, check for its sidecar metadata by running `npx @taskless/cli@latest rules meta <rule-id> --json`. If metadata exists, note the `ticketId` — this is required for the iterate API.

4. **Understand the improvement request.** Ask the user what they want to improve. Gather specifics:
   - Which rule(s) are problematic?
   - What is the rule doing wrong? (false positives, false negatives, wrong fix, missing edge cases, etc.)
   - Can they show an example of the incorrect behavior?
   - What would the correct behavior look like?

5. **Search for evidence in the codebase.** Proactively scan the codebase for instances where the rule is triggering (or failing to trigger). Show the user what you found:
   - "I found N places where this rule fires. Are any of these false positives?"
   - "I found N places where this pattern exists but the rule doesn't catch it. Should it?"

6. **Decide on approach.** Based on the user's feedback and your analysis, determine the best strategy:

   ### Option A — Iterate on a single rule (most common)

   Use this when the user wants to refine an existing rule that is fundamentally correct but needs adjustment. Examples:
   - The rule has false positives that need to be excluded
   - The rule misses certain variations of the pattern
   - The fix suggestion is incorrect or incomplete
   - The rule needs to handle edge cases better

   ### Option B — Replace an existing rule

   Use this when the rule is fundamentally wrong and needs a completely different approach. Examples:
   - The rule's pattern matching strategy is incorrect (e.g., using string matching when AST matching is better suited to the task)
   - The rule targets the wrong language construct entirely
   - The user's requirements have changed significantly from the original rule

   For this approach: create a new rule (via the rule create flow) and then delete the old one.

   ### Option C — Create additional rules

   Use this when the user's need has expanded beyond what a single rule can cover. Examples:
   - The user wants to detect the same pattern in multiple languages
   - The pattern has distinct variants that are better handled by separate rules
   - The user wants related but distinct checks

   For this approach: create new rules and optionally remove old ones that are being superseded.

   **Present your chosen approach to the user and get confirmation before proceeding.**

7. **Execute the chosen approach.**

   ### For Option A (iterate):

   a. **Build the JSON payload.** Create a JSON object with:
   - `ruleId`: The ticket ID from the rule's sidecar metadata. Retrieve it by running `npx @taskless/cli@latest rules meta <rule-id> --json` and reading the `ticketId` field. If no metadata file exists (rule was created before metadata support), fall back to using the rule filename as the identifier. Providing the ticket ID allows the API to understand the existing rule's logic and how to adjust it based on your guidance.
   - `guidance`: A clear, specific description of what should change. Include:
     - What the rule is doing wrong
     - What it should do instead
     - Specific examples of false positives/negatives
     - Any exclusions or edge cases to handle
   - `references` (optional): Include the current rule file and test file contents so the API has full context. Each reference is `{ "filename": "<path relative to .taskless/>", "content": "<file contents>" }`.

   Example payload (note: `ruleId` is the `ticketId` UUID from `rules meta --json`, not the rule filename):

   ```json
   {
     "ruleId": "d4f8e2a1-7b3c-4e9f-a5d6-1c2b3e4f5a6b",
     "guidance": "The rule currently flags console.log statements inside catch blocks, but these are intentional error logging. Exclude console.log/console.error/console.warn calls that appear inside catch blocks. Also exclude any console calls in files under src/scripts/ as those are CLI tools where console output is expected.",
     "references": [
       {
         "filename": "rules/no-console-log.yml",
         "content": "id: no-console-log\nlanguage: typescript\n..."
       },
       {
         "filename": "rule-tests/no-console-log-20260328-test.yml",
         "content": "id: no-console-log\n..."
       }
     ]
   }
   ```

   b. **Write the JSON to a temp file.** Write to `.taskless/.tmp-improve-request.json`.

   c. **Invoke the CLI.** Run `npx @taskless/cli@latest rules improve --from .taskless/.tmp-improve-request.json --json`. The command may take 30-60 seconds as it polls the API.

   d. **Clean up.** After the command completes (success or failure), delete `.taskless/.tmp-improve-request.json`.

   e. **Report results.** Show the updated file paths and suggest running `taskless-check` to test the changes. The CLI also updates the sidecar metadata in `.taskless/rule-metadata/`.

   ### For Option B (replace):

   a. Note the old rule ID for deletion.
   b. Invoke the `taskless-create-rule` skill (command name `tskl:rule`) to create the replacement rule. This ensures the full enrichment workflow (examples, exclusions, confirmation) is followed.
   c. After the new rule is generated, delete the old rule: `npx @taskless/cli@latest rules delete <old-rule-id>`.
   d. Report results.

   ### For Option C (expand):

   a. For each new rule needed, invoke the `taskless-create-rule` skill (command name `tskl:rule`).
   b. If any old rules are being superseded, delete them after the new rules are created: `npx @taskless/cli@latest rules delete <old-rule-id>`.
   c. Report all changes.

8. **Suggest testing.** After any approach, suggest running `taskless-check` to test the updated rules against the codebase.

9. **Handle errors.** If the CLI fails:
   - **Authentication required**: Suggest the `taskless-login` skill.
   - **Missing organization info**: Suggest running `npx @taskless/cli@latest auth login` to re-authenticate.
   - **Rule not found**: The ruleId may be incorrect. Check the rule's metadata or suggest creating a new rule instead.
   - **API errors**: Report the error message and suggest trying again.
