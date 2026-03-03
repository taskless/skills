# CLI Auth

## Purpose

Defines the `auth login` and `auth logout` subcommands, the Device Flow orchestration, and the token persistence layer for the `@taskless/cli` package.

## Requirements

### Requirement: Auth subcommand group exists

The CLI SHALL register an `auth` subcommand group with `login` and `logout` as nested subcommands. Running `taskless auth` with no subcommand SHALL display help text listing the available auth subcommands.

#### Scenario: Auth help is displayed

- **WHEN** a user runs `taskless auth`
- **THEN** the CLI SHALL print help text listing `login` and `logout` subcommands

### Requirement: Auth login initiates Device Flow

The `taskless auth login` command SHALL initiate an OAuth Device Flow (RFC 8628). It SHALL display a verification URI and user code to stdout, then poll for authorization until the user completes the flow, the code expires, or the user cancels with Ctrl+C.

#### Scenario: Successful login

- **WHEN** a user runs `taskless auth login`
- **THEN** the CLI SHALL display a verification URI and user code
- **AND** the CLI SHALL poll for authorization at the server-specified interval
- **AND** when authorization succeeds, the CLI SHALL save the access token and print a success message

#### Scenario: Login when already authenticated

- **WHEN** a user runs `taskless auth login` and a valid token already exists
- **THEN** the CLI SHALL inform the user they are already logged in
- **AND** the CLI SHALL suggest running `taskless auth logout` first to re-authenticate

#### Scenario: User cancels login

- **WHEN** a user presses Ctrl+C during the polling loop
- **THEN** the CLI SHALL exit cleanly without saving any token

#### Scenario: Device code expires

- **WHEN** the device code expires before the user completes authorization
- **THEN** the CLI SHALL print an error message indicating the code has expired
- **AND** the CLI SHALL exit with a non-zero exit code

### Requirement: Auth logout removes saved token

The `taskless auth logout` command SHALL remove the saved authentication token from disk. If no token exists, it SHALL inform the user they are not logged in.

#### Scenario: Successful logout

- **WHEN** a user runs `taskless auth logout` and a token file exists
- **THEN** the CLI SHALL delete the token file
- **AND** the CLI SHALL print a confirmation message

#### Scenario: Logout when not logged in

- **WHEN** a user runs `taskless auth logout` and no token file exists
- **THEN** the CLI SHALL print a message indicating the user is not logged in

### Requirement: Token is stored in XDG config directory

The CLI SHALL store the authentication token at `$XDG_CONFIG_HOME/taskless/auth.json`. If `$XDG_CONFIG_HOME` is not set, it SHALL default to `~/.config/taskless/auth.json`. The file SHALL be created with permissions `0600` (owner read/write only).

#### Scenario: Token file is created in default location

- **WHEN** `$XDG_CONFIG_HOME` is not set and a user logs in
- **THEN** the token SHALL be written to `~/.config/taskless/auth.json`
- **AND** the file permissions SHALL be `0600`

#### Scenario: Token file respects XDG_CONFIG_HOME

- **WHEN** `$XDG_CONFIG_HOME` is set to `/custom/config`
- **THEN** the token SHALL be written to `/custom/config/taskless/auth.json`

#### Scenario: Config directory is created if missing

- **WHEN** the `taskless/` directory does not exist under the config home
- **THEN** the CLI SHALL create it before writing the token file

### Requirement: Token file format

The token file (`auth.json`) SHALL be a JSON object containing at minimum an `access_token` field. It MAY contain additional fields returned by the OAuth token response (`token_type`, `expires_in`, `refresh_token`).

#### Scenario: Minimal token file

- **WHEN** the OAuth response contains only an access token
- **THEN** `auth.json` SHALL contain `{ "access_token": "<token>" }`

#### Scenario: Full token file

- **WHEN** the OAuth response contains access token, token type, and refresh token
- **THEN** `auth.json` SHALL contain all provided fields

### Requirement: TASKLESS_TOKEN environment variable overrides file

When resolving the current authentication token, the CLI SHALL check `TASKLESS_TOKEN` environment variable first. If set, it SHALL be used as the access token and no file read SHALL occur. If not set, the CLI SHALL read from the token file.

#### Scenario: Env var takes precedence over file

- **WHEN** `TASKLESS_TOKEN` is set and a token file also exists
- **THEN** the CLI SHALL use the value of `TASKLESS_TOKEN` as the access token

#### Scenario: Env var used when no file exists

- **WHEN** `TASKLESS_TOKEN` is set and no token file exists
- **THEN** the CLI SHALL use the value of `TASKLESS_TOKEN` as the access token

#### Scenario: File used when env var is not set

- **WHEN** `TASKLESS_TOKEN` is not set and a token file exists
- **THEN** the CLI SHALL read the access token from the token file

#### Scenario: No token available

- **WHEN** `TASKLESS_TOKEN` is not set and no token file exists
- **THEN** the token resolution SHALL return null

### Requirement: Token resolution is a shared utility

A `getToken()` function SHALL exist that encapsulates the token resolution logic (env var check, then file read). All commands that need the current token SHALL use this function rather than reading the file directly.

#### Scenario: getToken returns env var value

- **WHEN** `TASKLESS_TOKEN` is set to `"test-token"`
- **THEN** `getToken()` SHALL return `"test-token"`

#### Scenario: getToken returns file token

- **WHEN** `TASKLESS_TOKEN` is not set and `auth.json` contains `{ "access_token": "file-token" }`
- **THEN** `getToken()` SHALL return `"file-token"`

#### Scenario: getToken returns null

- **WHEN** `TASKLESS_TOKEN` is not set and no token file exists
- **THEN** `getToken()` SHALL return `null`

### Requirement: Network layer is behind an interface

The Device Flow HTTP calls (device authorization and token polling) SHALL be defined as a TypeScript interface. The implementation SHALL use `fetch` to call the real API endpoints at `POST /cli/auth/device` (device authorization) and `POST /cli/auth/token` (token polling). The API base URL SHALL default to `https://app.taskless.io/cli` and SHALL be overridable via the `TASKLESS_API_URL` environment variable.

#### Scenario: Real implementation calls device endpoint

- **WHEN** `auth login` initiates the device flow
- **THEN** the provider SHALL send a POST to `{baseUrl}/auth/device` with `{ client_id: "taskless-cli" }`
- **AND** the provider SHALL return the `device_code`, `user_code`, `verification_uri`, `verification_uri_complete`, `expires_in`, and `interval` from the response

#### Scenario: Real implementation polls token endpoint

- **WHEN** the CLI polls for authorization
- **THEN** the provider SHALL send a POST to `{baseUrl}/auth/token` with `{ grant_type: "urn:ietf:params:oauth:grant-type:device_code", device_code, client_id: "taskless-cli" }`
- **AND** the provider SHALL return the appropriate status (`pending`, `slow_down`, `success`, `expired`, or `denied`) based on the response

#### Scenario: Successful token response

- **WHEN** the token endpoint returns an `access_token`
- **THEN** the provider SHALL return a success result with the `access_token`, `token_type`, and `expires_in`

#### Scenario: Interface is swappable

- **WHEN** a different provider implementation is needed (e.g., for testing)
- **THEN** the provider SHALL be replaceable without changing the command logic

#### Scenario: API base URL is configurable

- **WHEN** `TASKLESS_API_URL` is set to `http://localhost:8787/cli`
- **THEN** the provider SHALL use that URL as the base for all auth endpoints

#### Scenario: API base URL defaults to production

- **WHEN** `TASKLESS_API_URL` is not set
- **THEN** the provider SHALL use `https://app.taskless.io/cli` as the base URL

#### Scenario: Network error during device flow

- **WHEN** the `fetch` call fails due to a network error (DNS, timeout, connection refused)
- **THEN** the provider SHALL throw an error with a descriptive message

#### Scenario: Non-200 response from device endpoint

- **WHEN** the device endpoint returns a non-200 status code
- **THEN** the provider SHALL throw an error indicating the request failed
