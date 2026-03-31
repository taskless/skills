## ADDED Requirements

### Requirement: Init installs anonymous skill variants

The `taskless init` subcommand SHALL install the `taskless-create-rule-anonymous` and `taskless-improve-rule-anonymous` skills alongside existing skills. These skills SHALL be bundled into the CLI at build time using the same `import.meta.glob` pattern as existing skills.

#### Scenario: Anonymous skills are installed for Claude Code

- **WHEN** a user runs `taskless init` in a repository with a `.claude/` directory
- **THEN** the CLI SHALL write `taskless-create-rule-anonymous/SKILL.md` and `taskless-improve-rule-anonymous/SKILL.md` to `.claude/skills/`

#### Scenario: Anonymous skills have no command files

- **WHEN** the CLI installs skills and commands
- **THEN** no command `.md` files SHALL be created for the anonymous skill variants

#### Scenario: Build includes anonymous skills

- **WHEN** `pnpm build` is run in `packages/cli/`
- **THEN** the `taskless-create-rule-anonymous` and `taskless-improve-rule-anonymous` SKILL.md files SHALL be embedded in the output bundle
