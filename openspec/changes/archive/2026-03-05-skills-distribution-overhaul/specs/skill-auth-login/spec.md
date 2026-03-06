# Skill: Auth Login

## Purpose

Defines the `taskless-auth-login` skill that informs users how to authenticate with Taskless via the CLI.

## ADDED Requirements

### Requirement: Auth login skill is informational

The `taskless-auth-login` skill SHALL exist at `skills/taskless-auth-login/SKILL.md`. When invoked, the agent SHALL explain the authentication process and provide the CLI command to run. The agent SHALL NOT attempt to execute the login command itself, as the device flow requires interactive terminal input.

#### Scenario: Skill provides login command for pnpm projects

- **WHEN** the auth login skill is invoked in a project with a `pnpm-lock.yaml` file
- **THEN** the agent SHALL display the command `pnpm dlx @taskless/cli@latest auth login`
- **AND** explain that the command will display a URL and code for browser-based authentication

#### Scenario: Skill provides login command for npm projects

- **WHEN** the auth login skill is invoked in a project without a `pnpm-lock.yaml` file
- **THEN** the agent SHALL display the command `npx @taskless/cli@latest auth login`

#### Scenario: Skill explains the device flow

- **WHEN** the auth login skill is invoked
- **THEN** the agent SHALL explain that the user needs to open the displayed URL in a browser, enter the code, and authorize the CLI

### Requirement: Auth login skill has correct frontmatter

The skill's YAML frontmatter SHALL include `name: taskless-auth-login`, a description mentioning authentication and login, and `metadata` with `author: taskless` and `version` matching the CLI version.

#### Scenario: Frontmatter is valid

- **WHEN** inspecting `skills/taskless-auth-login/SKILL.md`
- **THEN** the frontmatter SHALL have `name: taskless-auth-login`
- **AND** `metadata.author` SHALL be `taskless`
- **AND** `metadata.version` SHALL match the CLI package version
