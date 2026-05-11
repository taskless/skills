# Skill: Improve Rule

## REMOVED Requirements

### Requirement: Skill inventories existing rules

**Reason**: The standalone `taskless-improve-rule` skill is replaced by the consolidated `taskless` skill plus the `tskl help rule improve` recipe.

**Migration**: The instruction to inventory existing rules under `.taskless/rules/` moves into `packages/cli/src/help/rule-improve.txt` (API-backed flow) and `packages/cli/src/help/rule-improve.anonymous.txt` (local-only flow).

### Requirement: Skill determines improvement approach

**Reason**: Same as above.

**Migration**: The decision tree (target a specific rule, broad refactor, or merge multiple rules) lives in `rule-improve.txt`'s Steps section.

### Requirement: Skill builds iterate payload with references

**Reason**: Same as above.

**Migration**: The payload shape is documented in the embedded JSON schema within `rule-improve.txt` (zod-to-json-schema output per the new recipe template).

### Requirement: Skill cross-references use skill names

**Reason**: There are no longer multiple skill names to cross-reference.

**Migration**: Recipes cross-reference each other via topic names (`tskl help rule create`, `tskl help check`, etc.) using the `## See Also` section in the recipe template.

### Requirement: Improve rule skill routes by authentication status

**Reason**: Auth-state branching no longer routes between two skills; it is handled inside the recipe via `--anonymous` variant lookup and the CLI's `rule improve --anonymous` flag.

**Migration**: When the user is logged out OR anonymous mode is requested, the agent fetches `tskl help rule improve --anonymous` and invokes the CLI with `--anonymous`.

### Requirement: Anonymous improve skill iterates on rules locally via agent

**Reason**: The `taskless-improve-rule-anonymous` skill is removed; the local-only flow moves into the CLI's `rule improve --anonymous` branch and the `rule-improve.anonymous.txt` recipe.

**Migration**: See `cli-rules` for the `--anonymous` branch; see `cli-help` for the variant lookup.

### Requirement: Anonymous improve skill writes updated files

**Reason**: File writes now happen in the CLI, not orchestrated by the agent.

**Migration**: The CLI's `rule improve --anonymous` branch SHALL write the updated rule file directly. The recipe documents this — the agent invokes and reports.

### Requirement: Anonymous improve skill uses verify feedback loop

**Reason**: The verify loop remains; only the skill file is removed.

**Migration**: The `rule-improve.anonymous.txt` recipe documents the verify loop step-by-step. The agent owns the iteration; the CLI provides the `rule verify` primitive.

### Requirement: Anonymous improve skill supports all improvement approaches

**Reason**: The branch logic for "specific rule", "broad refactor", "merge rules" moves into the recipe.

**Migration**: Documented in `rule-improve.anonymous.txt` Steps section.

### Requirement: Anonymous improve skill is not directly invocable

**Reason**: No standalone anonymous skill in the new design.

**Migration**: Anonymous mode is reached via the `--anonymous` flag.

### Requirement: Anonymous improve skill has correct frontmatter

**Reason**: There is no longer a skill file with frontmatter.

**Migration**: N/A.
