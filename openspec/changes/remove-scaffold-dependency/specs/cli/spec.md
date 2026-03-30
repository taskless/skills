# CLI

## REMOVED Requirements

### Requirement: Per-subcommand minimum scaffold version map

**Reason**: Scaffold version gating is no longer needed. The CLI no longer depends on `taskless.json` for version validation. Feature availability is determined by the CLI version itself.

**Migration**: Remove `MIN_SCAFFOLD_VERSION` from `capabilities.ts`. Commands that previously checked scaffold versions now proceed without version validation.

### Requirement: Subcommand scaffold version validation is purely local

**Reason**: No scaffold version to validate. The CLI no longer reads `taskless.json` for version information.

**Migration**: Remove scaffold version checks from all subcommand entry points. The `isScaffoldVersionSufficient()` function is removed along with `MIN_SCAFFOLD_VERSION`.

### Requirement: COMPATIBILITY ranges and RULES_MIN_SPEC_VERSION are removed

**Reason**: Already removed in a prior change, but the replacement (`MIN_SCAFFOLD_VERSION`) is now also being removed. This requirement is no longer applicable.

**Migration**: No action needed — this was a transitional requirement.

### Requirement: validateRulesConfig uses per-subcommand version check

**Reason**: `validateRulesConfig()` is replaced by the new identity resolution system. Version checks and `taskless.json` reads are no longer part of the rules config validation path.

**Migration**: Replace `validateRulesConfig()` with `resolveIdentity()` which derives `orgId` from JWT and `repositoryUrl` from git remote.

### Requirement: taskless.json supports orgId and repositoryUrl

**Reason**: `taskless.json` is obsolete. `orgId` comes from the JWT claim, `repositoryUrl` is inferred from `git remote get-url origin`.

**Migration**: The `ProjectConfig` interface and `readProjectConfig()` function are removed. `orgId` MUST be supplied by the JWT claim; if the claim is missing, the token is treated as stale and the user MUST re-authenticate. `taskless.json` is no longer read as a fallback source for `orgId`.

## MODIFIED Requirements

### Requirement: CLI stub entry point

The CLI entry point SHALL use citty to define a main command with subcommand support and a global `-d` (alias `--dir`) argument that sets the working directory, a global `--json` boolean argument for machine-readable output, and a global `--schema` boolean argument for printing JSON Schema definitions. When invoked with no arguments, the CLI SHALL display help text listing available subcommands. The CLI SHALL externalize Node.js built-in modules and bundle all other dependencies. The `check` subcommand, the `auth` subcommand group, the `rules` subcommand group, and the `help` subcommand SHALL be registered alongside existing subcommands. The `update-engine` subcommand SHALL NOT be registered.

#### Scenario: Running the CLI with no arguments shows help

- **WHEN** the CLI is executed with no arguments
- **THEN** it SHALL print help text to stdout listing available subcommands including `help`
- **AND** the help text SHALL NOT list `update-engine`

#### Scenario: Running the CLI with an unknown subcommand shows help

- **WHEN** the CLI is executed with an unrecognized subcommand
- **THEN** it SHALL print help text to stdout

#### Scenario: Update-engine subcommand is not registered

- **WHEN** a user runs `taskless update-engine`
- **THEN** the CLI SHALL print help text (unrecognized subcommand)

#### Scenario: Init subcommand remains unchanged

- **WHEN** a user runs `taskless init`
- **THEN** the CLI SHALL route to the init subcommand handler
- **AND** the init handler SHALL NOT perform scaffold updates

#### Scenario: Update alias is removed

- **WHEN** a user runs `taskless update`
- **THEN** the CLI SHALL NOT route to the init handler
- **AND** SHALL show help text (unrecognized subcommand)

#### Scenario: Global -d flag is accepted

- **WHEN** the CLI is executed with `-d /some/path` or `--dir /some/path`
- **THEN** the specified path SHALL be available to all subcommands as the resolved working directory

#### Scenario: Working directory defaults to process.cwd()

- **WHEN** the CLI is executed without the `-d` flag
- **THEN** the working directory SHALL default to `process.cwd()`

#### Scenario: Global --json flag is accepted

- **WHEN** the CLI is executed with `--json`
- **THEN** the flag SHALL be available to all subcommands as `args.json`

#### Scenario: --json defaults to false

- **WHEN** a user runs a subcommand without `--json`
- **THEN** `args.json` SHALL be `false`

#### Scenario: Global --schema flag is accepted

- **WHEN** the CLI is executed with `--schema`
- **THEN** the flag SHALL be available to all subcommands as `args.schema`

#### Scenario: --schema defaults to false

- **WHEN** a user runs a subcommand without `--schema`
- **THEN** `args.schema` SHALL be `false`

#### Scenario: --schema is ignored by commands without --json support

- **WHEN** a user runs `taskless auth login --schema`
- **THEN** the CLI SHALL ignore the `--schema` flag and proceed normally

#### Scenario: Check subcommand is registered

- **WHEN** a user runs `taskless check`
- **THEN** the CLI SHALL route to the check subcommand handler

#### Scenario: Auth subcommand group is registered

- **WHEN** a user runs `taskless auth`
- **THEN** the CLI SHALL route to the auth subcommand group

#### Scenario: Rules subcommand group is registered

- **WHEN** a user runs `taskless rules`
- **THEN** the CLI SHALL route to the rules subcommand group

#### Scenario: Help subcommand is registered

- **WHEN** a user runs `taskless help`
- **THEN** the CLI SHALL route to the help subcommand handler

## ADDED Requirements

### Requirement: CLI manages .taskless/.gitignore

The CLI SHALL proactively create and maintain a `.taskless/.gitignore` file that ignores local-only files. The gitignore SHALL contain entries for `.env.local.json` and `sgconfig.yml`. Any CLI command that writes to `.taskless/` SHALL ensure the `.gitignore` file exists with these entries before writing.

#### Scenario: .gitignore is created when .taskless/ is first written to

- **WHEN** the CLI creates any file in `.taskless/` (e.g., during `auth login`, `rules create`, or `check`)
- **AND** `.taskless/.gitignore` does not exist
- **THEN** the CLI SHALL create `.taskless/.gitignore` containing `.env.local.json` and `sgconfig.yml`

#### Scenario: Existing .gitignore is preserved

- **WHEN** `.taskless/.gitignore` already exists with additional user entries
- **AND** the CLI needs to ensure its entries are present
- **THEN** the CLI SHALL append any missing entries without removing existing content

#### Scenario: .gitignore entries are idempotent

- **WHEN** `.taskless/.gitignore` already contains `.env.local.json` and `sgconfig.yml`
- **THEN** the CLI SHALL NOT duplicate the entries

### Requirement: CLI infers repositoryUrl from git remote

The CLI SHALL infer the repository URL by running `git remote get-url origin` and canonicalizing the result to `https://github.com/{owner}/{repo}` format. Both SSH (`git@github.com:owner/repo.git`) and HTTPS (`https://github.com/owner/repo.git`) URLs SHALL be supported.

#### Scenario: HTTPS remote URL is canonicalized

- **WHEN** `git remote get-url origin` returns `https://github.com/acme/widgets.git`
- **THEN** the CLI SHALL resolve `repositoryUrl` as `https://github.com/acme/widgets`

#### Scenario: SSH remote URL is canonicalized

- **WHEN** `git remote get-url origin` returns `git@github.com:acme/widgets.git`
- **THEN** the CLI SHALL resolve `repositoryUrl` as `https://github.com/acme/widgets`

#### Scenario: No origin remote

- **WHEN** `git remote get-url origin` fails (no remote named `origin`)
- **THEN** the CLI SHALL print an error: "Could not determine repository URL from git remote. Ensure your repository has an 'origin' remote pointing to GitHub."
- **AND** the CLI SHALL exit with a non-zero exit code

#### Scenario: Non-GitHub remote URL

- **WHEN** `git remote get-url origin` returns a URL that is not a GitHub URL
- **THEN** the CLI SHALL print an error indicating only GitHub repositories are supported
- **AND** the CLI SHALL exit with a non-zero exit code

### Requirement: CLI resolves orgId from JWT

The CLI SHALL extract the `orgId` claim from the stored JWT by decoding it with `jose`'s `decodeJwt()` function. No signature verification SHALL be performed. If the JWT does not contain an `orgId` claim, the token is stale and the CLI SHALL prompt the user to re-authenticate.

#### Scenario: JWT contains orgId claim

- **WHEN** the stored JWT contains an `orgId` claim
- **THEN** the CLI SHALL use the JWT's `orgId` value

#### Scenario: JWT lacks orgId claim (stale token)

- **WHEN** the stored JWT does not contain an `orgId` claim
- **THEN** the CLI SHALL print an error: "Your auth token is missing organization info. Run `taskless auth login` to re-authenticate."
- **AND** the CLI SHALL exit with a non-zero exit code

### Requirement: CLI identity resolution function

The CLI SHALL provide a `resolveIdentity(cwd: string)` function that returns `{ orgId: number, repositoryUrl: string }`. This function combines JWT-based `orgId` resolution with git remote-based `repositoryUrl` inference. All commands that previously read identity from `taskless.json` SHALL use this function instead.

#### Scenario: Full identity resolved from JWT and git remote

- **WHEN** the JWT contains an `orgId` claim and `git remote get-url origin` returns a valid GitHub URL
- **THEN** `resolveIdentity()` SHALL return both `orgId` and `repositoryUrl`

#### Scenario: Auth token not available

- **WHEN** no token is available (no env var, no `.env.local.json`, no global auth file)
- **THEN** `resolveIdentity()` SHALL throw an error indicating authentication is required
