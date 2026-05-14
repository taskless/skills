## ADDED Requirements

### Requirement: Init prints a post-install onboarding trailer

After a successful install (both wizard and `--no-interactive` paths), `taskless init` SHALL print a single one-line trailer pointing the user at the new onboarding flow. The trailer SHALL be printed AFTER the install summary (the lines that report what was written and any obsolete files removed) and SHALL be the final line of output before the process exits. The trailer SHALL recommend `/tskl onboard` (the slash command form for AI-tool users) and SHALL also mention `taskless onboard` (the bare CLI form). The trailer SHALL NOT be gated on the value of `install.onboarded` in the manifest — it is informational, printed every successful install.

The trailer SHALL be suppressed when:

- `taskless init` exits non-zero (cancelled wizard, install failure, etc.).
- The install was a no-op (no targets selected, no files to write).

#### Scenario: Wizard install prints the trailer

- **WHEN** a user runs `taskless init` in an interactive terminal and the wizard completes successfully
- **THEN** the final line of output SHALL be a single-line trailer recommending `/tskl onboard` (and mentioning `taskless onboard` as an alternative)

#### Scenario: Non-interactive install prints the trailer

- **WHEN** a user runs `taskless init --no-interactive` and the install succeeds
- **THEN** the final line of output SHALL be the same one-line onboarding trailer

#### Scenario: Cancelled wizard suppresses the trailer

- **WHEN** a user cancels the wizard (Ctrl-C or equivalent)
- **THEN** the trailer SHALL NOT be printed

#### Scenario: Failed install suppresses the trailer

- **WHEN** `taskless init` exits non-zero due to an install failure
- **THEN** the trailer SHALL NOT be printed

#### Scenario: Trailer is printed regardless of onboarded state

- **WHEN** a user re-runs `taskless init` and `install.onboarded` is already `true`
- **THEN** the trailer SHALL still be printed
