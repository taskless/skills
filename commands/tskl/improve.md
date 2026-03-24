---
name: "Taskless: Improve"
description: Improves existing Taskless rules by iterating with guidance. Use when the user wants to refine, fix, or improve existing rules. Trigger on "improve rule", "fix my rule", "iterate on rule", "refine taskless rule", or "my rule isn't working".
category: Taskless
tags:
  - taskless
metadata:
  author: taskless
  version: 0.1.5
  commandName: tskl:improve
---

# Taskless Improve

When this skill is invoked, help the user improve an existing Taskless rule by determining the best approach and executing it.

This is a decision-making skill. You must evaluate the situation and choose the right strategy — not every improvement is a simple iteration.

## Instructions

1. **Read current command documentation.** Run `pnpm dlx @taskless/cli@latest help rules improve` and read the output. Use this to understand the improve command's `--from` JSON fields, options, and examples.

2. **Inventory existing rules.** Scan the `.taskless/rules/` directory for `.yml` files. Read each rule file to understand what rules exist. For each rule, note:
   - The rule ID (filename without `.yml`)
   - The language it targets
   - The pattern it detects (from the `message`, `note`, or `rule` fields)
   - Any associated test files in `.taskless/tests/`

   Present a summary of the existing rules to the user if they have not indicated a specific rule they want to improve.

3. **Understand the improvement request.** Ask the user what they want to improve. Gather specifics:
   - Which rule(s) are problematic?
   - What is the rule doing wrong? (false positives, false negatives, wrong fix, missing edge cases, etc.)
   - Can they show an example of the incorrect behavior?
   - What would the correct behavior look like?

4. **Search for evidence in the codebase.** Proactively scan the codebase for instances where the rule is triggering (or failing to trigger). Show the user what you found:
   - "I found N places where this rule fires. Are any of these false positives?"
   - "I found N places where this pattern exists but the rule doesn't catch it. Should it?"

5. **Decide on approach.** Based on the user's feedback and your analysis, determine the best strategy:

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

6. **Execute the chosen approach.**

   ### For Option A (iterate):

   a. **Build the JSON payload.** Create a JSON object with:
   - `ruleId`: The rule ID to iterate on (this is the internal request ID from when the rule was generated — check the rule's YAML metadata for this, or use the rule filename as a fallback identifier). Providing the rule ID allows the API to understand the existing rule's logic and how to adjust it based on your guidance.
   - `guidance`: A clear, specific description of what should change. Include:
     - What the rule is doing wrong
     - What it should do instead
     - Specific examples of false positives/negatives
     - Any exclusions or edge cases to handle
   - `references` (optional): Include the current rule file and test file contents so the API has full context. Each reference is `{ "filename": "<path relative to .taskless/>", "content": "<file contents>" }`.

   Example payload:

   ```json
   {
     "ruleId": "abc123-def456",
     "guidance": "The rule currently flags console.log statements inside catch blocks, but these are intentional error logging. Exclude console.log/console.error/console.warn calls that appear inside catch blocks. Also exclude any console calls in files under src/scripts/ as those are CLI tools where console output is expected.",
     "references": [
       {
         "filename": "rules/no-console-log.yml",
         "content": "id: no-console-log\nlanguage: typescript\n..."
       },
       {
         "filename": "tests/no-console-log-test.yml",
         "content": "id: no-console-log\n..."
       }
     ]
   }
   ```

   b. **Write the JSON to a temp file.** Write to `.taskless/.tmp-improve-request.json`.

   c. **Invoke the CLI.** Run `pnpm dlx @taskless/cli@latest rules improve --from .taskless/.tmp-improve-request.json --json`. The command may take 30-60 seconds as it polls the API.

   d. **Clean up.** After the command completes (success or failure), delete `.taskless/.tmp-improve-request.json`.

   e. **Report results.** Show the updated file paths.

   ### For Option B (replace):

   a. Note the old rule ID for deletion.
   b. Work with the user to create a new rule following the same process as the `taskless-create-rule` skill (gather prompt, examples, exclusions, etc.).
   c. Run the create command: `pnpm dlx @taskless/cli@latest rules create --from .taskless/.tmp-rule-request.json --json`.
   d. After the new rule is generated, delete the old rule: `pnpm dlx @taskless/cli@latest rules delete <old-rule-id>`.
   e. Clean up temp files and report results.

   ### For Option C (expand):

   a. For each new rule needed, follow the `taskless-create-rule` process.
   b. If any old rules are being superseded, delete them after the new rules are created.
   c. Report all changes.

7. **Suggest testing.** After any approach, suggest running `taskless-check` to test the updated rules against the codebase.

8. **Handle errors.** If the CLI fails:
   - **Authentication required**: Suggest the `taskless-login` skill.
   - **Missing config**: Suggest running `pnpm dlx @taskless/cli@latest init` to set up the project.
   - **Stale scaffold version**: Suggest the `taskless-update-engine` skill.
   - **Rule not found**: The ruleId may be incorrect. Check the rule's metadata or suggest creating a new rule instead.
   - **API errors**: Report the error message and suggest trying again.
