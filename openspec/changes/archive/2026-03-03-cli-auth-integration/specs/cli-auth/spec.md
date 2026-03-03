## MODIFIED Requirements

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

## REMOVED Requirements

### Requirement: API not yet available

**Reason**: The real API endpoints are now available. The stub is replaced with a real HTTP implementation.
**Migration**: No migration needed. The stub was a placeholder; the real provider is a drop-in replacement.
