# Skill: Auth Logout

## Purpose

Defines the `taskless-auth-logout` skill that informs users how to remove saved authentication.

## ADDED Requirements

### Requirement: Auth logout skill is informational

The `taskless-auth-logout` skill SHALL exist at `skills/taskless-auth-logout/SKILL.md`. When invoked, the agent SHALL provide the CLI command to remove saved authentication. The agent SHALL NOT attempt to execute the logout command itself.

#### Scenario: Skill provides logout command for pnpm projects

- **WHEN** the auth logout skill is invoked in a project with a `pnpm-lock.yaml` file
- **THEN** the agent SHALL display the command `pnpm dlx @taskless/cli@latest auth logout`

#### Scenario: Skill provides logout command for npm projects

- **WHEN** the auth logout skill is invoked in a project without a `pnpm-lock.yaml` file
- **THEN** the agent SHALL display the command `npx @taskless/cli@latest auth logout`

#### Scenario: Skill explains what logout does

- **WHEN** the auth logout skill is invoked
- **THEN** the agent SHALL explain that the command removes the locally saved authentication token

### Requirement: Auth logout skill has correct frontmatter

The skill's YAML frontmatter SHALL include `name: taskless-auth-logout`, a description mentioning logout or removing authentication, and `metadata` with `author: taskless` and `version` matching the CLI version.

#### Scenario: Frontmatter is valid

- **WHEN** inspecting `skills/taskless-auth-logout/SKILL.md`
- **THEN** the frontmatter SHALL have `name: taskless-auth-logout`
- **AND** `metadata.author` SHALL be `taskless`
- **AND** `metadata.version` SHALL match the CLI package version
