## MODIFIED Requirements

### Requirement: All capture calls include standard properties

Every `capture()` call SHALL include the `cli` property (anonymous UUID), the `cliVersion` property (the `@taskless/cli` package version read from `package.json`), and the `scaffoldVersion` property (the `version` field from `.taskless/taskless.json`, or `0` if the manifest is absent or unreadable). When authenticated, the `groups` parameter SHALL include `{ organization: String(orgId) }`. The `cliVersion` and `scaffoldVersion` values SHALL be resolved once at telemetry initialization and attached to every subsequent `capture()` call without re-reading the source files.

#### Scenario: Anonymous capture includes standard properties

- **WHEN** `capture("cli_check")` is called without authentication
- **THEN** the event SHALL include `{ cli: anonymousUuid, cliVersion: <string>, scaffoldVersion: <number> }`
- **AND** the event SHALL NOT include a `groups` parameter

#### Scenario: Authenticated capture includes standard properties and group

- **WHEN** `capture("cli_rule_create")` is called with authentication
- **THEN** the event SHALL include `{ cli: anonymousUuid, cliVersion: <string>, scaffoldVersion: <number> }`
- **AND** the `groups` parameter SHALL include `{ organization: String(orgId) }`

#### Scenario: Scaffold version falls back to 0 when manifest missing

- **WHEN** `getTelemetry(cwd)` is initialized in a directory with no `.taskless/taskless.json`
- **THEN** every `capture()` call from the returned client SHALL include `scaffoldVersion: 0`

#### Scenario: CLI version is resolved from package.json

- **WHEN** `getTelemetry()` is initialized
- **THEN** `cliVersion` SHALL be read from `packages/cli/package.json` (bundled at build time or read at runtime)
- **AND** SHALL be attached to every event emitted through the returned client

### Requirement: CLI events use cli\_ prefix

All CLI events SHALL use the `cli_` prefix and `snake_case` naming. The following events SHALL be emitted:

| Event                      | Command                                                    |
| -------------------------- | ---------------------------------------------------------- |
| `cli_help`                 | `help` (top-level)                                         |
| `cli_help_auth`            | `help auth [subcommand]`                                   |
| `cli_help_check`           | `help check`                                               |
| `cli_help_info`            | `help info`                                                |
| `cli_help_init`            | `help init`                                                |
| `cli_help_rule`            | `help rules [subcommand]`                                  |
| `cli_auth_login`           | `auth login` (initiated)                                   |
| `cli_auth_login_completed` | `auth login` (succeeded)                                   |
| `cli_auth_logout`          | `auth logout`                                              |
| `cli_check`                | `check`                                                    |
| `cli_init`                 | `init` (initiated)                                         |
| `cli_init_completed`       | `init` (completed successfully, wizard or non-interactive) |
| `cli_init_cancelled`       | `init` (wizard cancelled before completion)                |
| `cli_info`                 | `info`                                                     |
| `cli_rule_create`          | `rules create`                                             |
| `cli_rule_improve`         | `rules improve`                                            |
| `cli_rule_delete`          | `rules delete`                                             |
| `cli_rule_verify`          | `rules verify`                                             |
| `cli_rule_meta`            | `rules meta`                                               |

#### Scenario: Each command emits its event

- **WHEN** a user runs `taskless check`
- **THEN** the CLI SHALL emit a `cli_check` event before the command logic executes

#### Scenario: Help for specific topic emits scoped event

- **WHEN** a user runs `taskless help rules`
- **THEN** the CLI SHALL emit a `cli_help_rule` event

#### Scenario: Init completion event carries wizard selections

- **WHEN** an init run completes successfully
- **THEN** the CLI SHALL emit `cli_init_completed` with the properties `locations` (array of selected target paths), `optionalSkills` (array of optional skill names selected), `authPromptShown` (boolean), `authCompleted` (boolean), `nonInteractive` (boolean), and `durationMs` (number)

#### Scenario: Init cancellation event identifies the step

- **WHEN** the user cancels the wizard before completion
- **THEN** the CLI SHALL emit `cli_init_cancelled` with an `atStep` property whose value is one of `"intro"`, `"locations"`, `"optionalSkills"`, `"auth"`, or `"summary"`
