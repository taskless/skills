# Skill: Rules Delete

## REMOVED Requirements

### Requirement: Rules delete skill identifies rules conversationally

**Reason**: The standalone `taskless-delete-rule` skill is replaced by the consolidated `taskless` skill plus the `tskl help rule delete` recipe.

**Migration**: The conversational rule-identification flow moves into `packages/cli/src/help/rule-delete.txt`.

### Requirement: Rules delete skill invokes CLI with rule ID

**Reason**: Same as above.

**Migration**: The CLI invocation `npx @taskless/cli rule delete <id>` (note verb rename `rules` → `rule`) is documented in `rule-delete.txt`.

### Requirement: Rules delete skill has correct frontmatter

**Reason**: There is no longer a `taskless-delete-rule` skill file.

**Migration**: N/A. The consolidated `taskless` skill's frontmatter is governed by `skill-taskless`.
