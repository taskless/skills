## MODIFIED Requirements

### Requirement: Rules subcommand group exists

The CLI SHALL register a `rules` subcommand group with `create`, `improve`, and `delete` as nested subcommands. Running `taskless rules` with no subcommand SHALL display help text listing the available rules subcommands.

#### Scenario: Rules help is displayed

- **WHEN** a user runs `taskless rules`
- **THEN** the CLI SHALL print help text listing `create`, `improve`, and `delete` subcommands

### Requirement: Rules create reads request from stdin

The `taskless rules create` command SHALL read a JSON request payload from a file specified by the `--from <file>` argument. The payload SHALL conform to the shape `{ prompt: string, successCases?: string[], failureCases?: string[] }`. The `prompt` field is required. If `--from` is not provided, the CLI SHALL print an error message with usage examples and exit with a non-zero exit code. If the file does not exist or contains invalid JSON, the CLI SHALL print an appropriate error and exit with a non-zero exit code.

#### Scenario: Valid JSON from file

- **WHEN** a user runs `taskless rules create --from request.json` and `request.json` contains valid JSON with a `prompt` field
- **THEN** the CLI SHALL read the file, parse the JSON, and proceed to submit it to the API

#### Scenario: Missing --from flag

- **WHEN** a user runs `taskless rules create` without the `--from` flag
- **THEN** the CLI SHALL print an error indicating `--from <file>` is required with a usage example
- **AND** the CLI SHALL exit with a non-zero exit code

#### Scenario: File not found

- **WHEN** a user runs `taskless rules create --from missing.json` and the file does not exist
- **THEN** the CLI SHALL print an error indicating the file was not found
- **AND** the CLI SHALL exit with a non-zero exit code

#### Scenario: Invalid JSON in file

- **WHEN** a user runs `taskless rules create --from bad.json` and the file contains invalid JSON
- **THEN** the CLI SHALL print an error indicating the file is not valid JSON
- **AND** the CLI SHALL exit with a non-zero exit code

#### Scenario: Missing required fields

- **WHEN** a user provides a file missing the `prompt` field
- **THEN** the CLI SHALL print an error indicating the missing field
- **AND** the CLI SHALL exit with a non-zero exit code
