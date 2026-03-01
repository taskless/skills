## MODIFIED Requirements

### Requirement: Info skill confirms Taskless is working

The `/taskless:info` skill SHALL exist at `plugins/taskless/skills/info/SKILL.md`. When invoked, it SHALL detect the project's package manager by checking for lock files, invoke the CLI via `pnpm dlx @taskless/cli@latest info` or `npx @taskless/cli@latest info`, parse the JSON response, and report the CLI version. The skill SHALL confirm that Taskless is operational by displaying the version received from the CLI.

#### Scenario: Info skill detects pnpm and invokes CLI

- **WHEN** the info skill is invoked in a project with a `pnpm-lock.yaml` file
- **THEN** the agent SHALL run `pnpm dlx @taskless/cli@latest info`
- **AND** parse the JSON stdout to extract the `version` field
- **AND** report the version to the user

#### Scenario: Info skill falls back to npx

- **WHEN** the info skill is invoked in a project without a `pnpm-lock.yaml` file
- **THEN** the agent SHALL run `npx @taskless/cli@latest info`
- **AND** parse the JSON stdout to extract the `version` field
- **AND** report the version to the user

#### Scenario: Info skill handles CLI failure

- **WHEN** the CLI invocation fails (non-zero exit code or unparseable output)
- **THEN** the agent SHALL report that it could not reach the Taskless CLI and suggest troubleshooting steps
