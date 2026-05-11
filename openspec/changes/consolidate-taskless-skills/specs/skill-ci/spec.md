# Skill: CI

## REMOVED Requirements

### Requirement: Taskless CI skill is bundled in the CLI

**Reason**: The standalone `taskless-ci` skill is replaced by the consolidated `taskless` skill plus the `tskl help ci` recipe.

**Migration**: CI integration instructions move into `packages/cli/src/help/ci.txt`. The recipe content preserves the existing skill body's full-scan and diff-scan patterns.

### Requirement: Taskless CI skill is marked optional in the skill catalog

**Reason**: The catalog reduces to a single mandatory skill (`taskless`); there are no optional skills in the new design.

**Migration**: CI is now a topic discoverable via `tskl help` rather than an optional installation. Anyone with the consolidated skill installed can fetch the CI recipe; nothing to opt into separately.

### Requirement: Taskless CI skill teaches full-scan and diff-scan patterns

**Reason**: The pattern teaching moves into the recipe text.

**Migration**: `ci.txt` preserves the full-scan / diff-scan pattern descriptions, the per-CI diff-target variable table, the GitHub Actions reference template, and the translation guidance for other CI systems.

### Requirement: Taskless CI skill generates non-destructive configuration

**Reason**: The non-destructive constraint moves into the recipe's Steps section.

**Migration**: `ci.txt` Steps SHALL include "generate standalone config files; never edit the user's existing CI config" and reference canonical paths per CI system.

### Requirement: Taskless CI skill requires no authentication

**Reason**: This remains true — the `ci` topic recipe does not invoke any authenticated CLI commands.

**Migration**: Documented in `ci.txt` Preconditions section.

### Requirement: Taskless CI skill gates CI setup on rule presence

**Reason**: The gate moves into the recipe's Preconditions and first Step.

**Migration**: `ci.txt` SHALL gate setup on `npx @taskless/cli check` returning a non-empty rule set; if no rules exist, the recipe SHALL instruct the agent to invoke the rule-create flow first by recommending the user say "create a taskless rule for X".
