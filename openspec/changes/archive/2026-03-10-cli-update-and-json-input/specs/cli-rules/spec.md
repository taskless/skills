## MODIFIED Requirements

### Requirement: Rules create reads request from stdin

The `taskless rules create` command SHALL read a JSON request payload from a file specified by the `--from <file>` argument. The payload SHALL conform to the shape `{ prompt: string, language?: string, successCase?: string, failureCase?: string }`. The `prompt` field is required. If `--from` is not provided, the CLI SHALL print an error message with usage examples and exit with a non-zero exit code. If the file does not exist or contains invalid JSON, the CLI SHALL print an appropriate error and exit with a non-zero exit code.

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

### Requirement: Rules create requires a minimum scaffold version

The `taskless rules create` command SHALL validate the scaffold version from `.taskless/taskless.json` against its entry in `MIN_SCAFFOLD_VERSION`. If below the minimum, the CLI SHALL fast-fail with a message showing the current version, required version, and directing the user to run `taskless update-engine`.

#### Scenario: Scaffold version too old

- **WHEN** `.taskless/taskless.json` has a version below the `'rules create'` entry in `MIN_SCAFFOLD_VERSION`
- **THEN** the CLI SHALL print: "Scaffold version <current> is below the minimum <required> required for 'taskless rules create'. Run 'taskless update-engine' to update."
- **AND** the CLI SHALL exit with a non-zero exit code

#### Scenario: Scaffold version is sufficient

- **WHEN** `.taskless/taskless.json` has a version at or above the `'rules create'` minimum
- **THEN** the CLI SHALL proceed normally
