## ADDED Requirements

### Requirement: Init prints a post-install onboarding trailer

After a successful install (both wizard and `--no-interactive` paths), `taskless init` SHALL print a single one-line trailer pointing the user at the new onboarding flow. The trailer SHALL be printed AFTER the install summary (the lines that report what was written and any obsolete files removed) and SHALL be the final line of output before the process exits. The trailer SHALL NOT be gated on the value of `install.onboarded` in the manifest — it is informational, printed every successful install. The trailer's wording SHALL adapt to the install plan: when at least one installed target received the `tskl` slash command (Claude Code or Cursor), the trailer SHALL mention `/tskl onboard`, the Taskless skill, AND `taskless onboard` (since command-receiving tools also get the skill, both AI-tool entry points are surfaced); when no installed target received commands (OpenCode, Codex, or the `.agents/` fallback), the trailer SHALL mention only the Taskless skill and `taskless onboard`, and SHALL NOT mention `/tskl onboard`. The trailer SHALL be suppressed when `taskless init` exits non-zero (cancelled wizard, install failure, etc.) or when the install was a no-op (no targets selected, no files to write).

#### Scenario: Wizard install with commands mentions slash command, skill, and CLI

- **WHEN** a user runs `taskless init` in an interactive terminal and the wizard completes successfully
- **AND** at least one selected target received the `tskl` slash command (Claude Code or Cursor)
- **THEN** the final line of output SHALL be a single-line trailer that mentions `/tskl onboard`, the Taskless skill, AND `taskless onboard`

#### Scenario: Wizard install without commands mentions skill and CLI only

- **WHEN** a user runs `taskless init` in an interactive terminal and the wizard completes successfully
- **AND** no selected target received commands (e.g. only OpenCode and/or Codex were chosen)
- **THEN** the final line of output SHALL be a single-line trailer instructing the user to invoke the Taskless skill via natural language and mentioning `taskless onboard` as a terminal fallback
- **AND** the trailer SHALL NOT mention `/tskl onboard`

#### Scenario: Non-interactive install with commands mentions slash command, skill, and CLI

- **WHEN** a user runs `taskless init --no-interactive` against a project where Claude Code or Cursor is detected
- **THEN** the final line of output SHALL mention `/tskl onboard`, the Taskless skill, AND `taskless onboard`

#### Scenario: Non-interactive install with no commands mentions skill and CLI only

- **WHEN** a user runs `taskless init --no-interactive` against a project where no command-receiving tool is detected (the install uses the `.agents/` fallback or only OpenCode/Codex)
- **THEN** the final line of output SHALL mention the Taskless skill and `taskless onboard`
- **AND** SHALL NOT mention `/tskl onboard`

#### Scenario: Cancelled wizard suppresses the trailer

- **WHEN** a user cancels the wizard (Ctrl-C or equivalent)
- **THEN** the trailer SHALL NOT be printed

#### Scenario: Failed install suppresses the trailer

- **WHEN** `taskless init` exits non-zero due to an install failure
- **THEN** the trailer SHALL NOT be printed

#### Scenario: Trailer is printed regardless of onboarded state

- **WHEN** a user re-runs `taskless init` and `install.onboarded` is already `true`
- **THEN** the trailer SHALL still be printed
- **AND** the trailer wording SHALL still adapt to whether commands were installed by the current run
