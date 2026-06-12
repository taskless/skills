## ADDED Requirements

### Requirement: Route is the local authoring classifier

The CLI SHALL provide a `route` help recipe that instructs the agent to classify
a rule-authoring request into one of three destinations — `existing`, `static`,
or `remote` — using `taskless detect --json` signals plus the user's intent. The
`route` recipe SHALL be biased to stay local: it SHALL prefer `existing` or
`static` and SHALL treat `remote` as the escalation of last resort.

#### Scenario: Route fetches detection before classifying

- **WHEN** the agent fetches the `route` recipe to author a rule
- **THEN** the recipe SHALL direct the agent to run `taskless detect --json` and
  use its signals as input to the classification

#### Scenario: Route classifies into one of three destinations

- **WHEN** the agent follows `route`
- **THEN** it SHALL select exactly one of `existing`, `static`, or `remote`
- **AND** it SHALL fetch the corresponding recipe to perform the authoring

### Requirement: Route states reasoning before naming a destination

The `route` recipe SHALL require the agent to write an explicit rationale before
naming a destination. The rationale SHALL cover what the `detect` signals show,
whether an existing linter plausibly already covers the request, whether the
pattern is expressible as a simple static ast-grep rule, and the resulting
confidence that the request is locally solvable. The destination SHALL be emitted
only after this rationale, and SHALL follow from it.

#### Scenario: Rationale precedes the route decision

- **WHEN** the agent follows `route` to classify a request
- **THEN** it SHALL produce a written rationale covering the detection signals,
  existing-linter coverage, ast-grep expressibility, and local-solvability
  confidence
- **AND** it SHALL name the destination (`existing`, `static`, or `remote`) only
  after that rationale

#### Scenario: Route is not named before reasoning

- **WHEN** the agent has not yet articulated its reasoning
- **THEN** the recipe SHALL NOT permit committing to a destination
- **AND** the destination SHALL be a conclusion of the rationale, not asserted
  ahead of it

### Requirement: Route commits to the believed-correct path on reasonable confidence

The `route` recipe SHALL determine the destination upfront from `detect` signals
and the user's intent, committing to the path it believes is correct. The bar to
commit to a local path SHALL be **reasonable confidence**, not certainty. Routing
distinguishes three states: reasonable confidence the request IS locally solvable
selects a local path; reasonable belief the request is NOT locally solvable selects
`remote` directly, without first attempting a local rule; genuine inability to
judge either way is uncertainty, which SHALL be resolved by asking the user (see
the clarifying-question scenario) and SHALL NOT by itself select `remote`. The
recipe SHALL NOT use a deliberate local attempt-and-fail with no genuine belief of
success as the mechanism for choosing `remote`.

#### Scenario: Reasonably-confident-local commits locally without a justification probe

- **WHEN** `route` is reasonably confident the request fits an existing linter or
  a simple static ast-grep pattern
- **THEN** it SHALL select `existing` or `static` and proceed locally
- **AND** it SHALL NOT run a throwaway local attempt whose only purpose is to
  justify the choice

#### Scenario: Believed-not-local routes remote upfront

- **WHEN** `route` reasonably believes the request cannot be solved locally — a
  positive judgment, not mere inability to tell
- **THEN** it SHALL select `remote` directly
- **AND** it SHALL NOT manufacture a deliberate local failure to reach that
  decision

#### Scenario: Uncertainty biases toward asking, not toward login

- **WHEN** `route` cannot reasonably place a request as local or remote
- **THEN** it SHALL prefer clarifying with the user over defaulting to `remote`
- **AND** uncertainty alone SHALL NOT be treated as a reason to consume a
  generation via `remote`

### Requirement: A believed-local path that fails escalates only after confirmation

The `route` recipe SHALL treat try-verify-escalate as a legitimate failure
fallback: when it committed to a local path on reasonable confidence and the
authored rule then fails verification against the user's success/failure cases, it
SHALL surface the failure and SHALL obtain explicit user confirmation before
calling the Taskless service. The recipe SHALL NOT silently fall through from a
failed local attempt to a service call.

#### Scenario: Failed local attempt prompts before spending a generation

- **WHEN** a `static` rule the agent committed to fails verification
- **THEN** the recipe SHALL inform the user the local rule could not capture the
  cases
- **AND** SHALL state that generating via the Taskless service uses a generation
  and requires login
- **AND** SHALL call the service only after the user confirms

#### Scenario: No silent fall-through to the service

- **WHEN** a believed-local attempt fails
- **THEN** the recipe SHALL NOT invoke `remote` / the service without an explicit
  user confirmation step

### Requirement: Route asks the user when multiple paths fit

The `route` recipe SHALL present the viable options to the user with their
trade-offs, rather than silently selecting one, whenever more than one destination
genuinely fits a request (most commonly both `existing` and `static`). The
trade-off framing SHALL note that `remote` consumes a generation and requires
login, so it is appropriate when a request cannot be solved locally rather than as
a default.

#### Scenario: Both local paths viable surfaces a choice

- **WHEN** the repository has a detected linter that fits AND the pattern is a
  clean local static ast-grep rule
- **THEN** `route` SHALL present both `existing` and `static` with their
  trade-offs and let the user choose

#### Scenario: Trade-off framing names the generation cost of remote

- **WHEN** `route` presents options that include `remote`
- **THEN** it SHALL state that `remote` consumes a generation and requires login
- **AND** SHALL frame `remote` as the path for what cannot be solved locally

### Requirement: Existing recipe authors in the detected linter's dialect

The CLI SHALL provide an `existing` help recipe that instructs the agent to
author a rule in a linter already detected in the repository, expressed in that
tool's own dialect. The recipe SHALL direct the agent to source authoring
knowledge first from the repository's own existing rules and only then from the
agent's own web research. The recipe SHALL NOT embed or rely on a Taskless-
maintained catalog of linter rules.

#### Scenario: Repo-first knowledge sourcing

- **WHEN** the agent follows `existing` for a detected linter
- **THEN** it SHALL first mine the repository's existing rules of that kind for
  house style
- **AND** SHALL fall back to web research (WebFetch/WebSearch) only when the
  repository signal is insufficient

#### Scenario: Existing path is author-only

- **WHEN** the agent authors a rule via `existing`
- **THEN** the recipe SHALL make clear the user's own toolchain runs the rule and
  that `taskless check` does not execute the external linter

### Requirement: Static recipe authors a verified local ast-grep rule

The CLI SHALL provide a `static` help recipe that instructs the agent to author a
local ast-grep rule on-device, without calling the Taskless service, and to
verify it against the user's success and failure cases before reporting success.
The recipe SHALL produce the canonical on-disk rule shape and paths used by remote
generation so that `check`, `improve`, and `verify` see a single dialect.

#### Scenario: Local authoring without the service

- **WHEN** the agent follows `static`
- **THEN** it SHALL write the rule on-device without requiring login or the
  Taskless API

#### Scenario: Verification gates success

- **WHEN** the agent authors a static rule
- **THEN** it SHALL verify the rule against the provided success/failure cases
  before reporting the rule as complete

#### Scenario: Canonical output shape

- **WHEN** the agent writes a static rule to disk
- **THEN** the files, paths, and shape SHALL match those produced by remote
  generation

### Requirement: Remote recipe collects inputs and delegates to the service

The CLI SHALL provide a `remote` help recipe that instructs the agent to gather
the inputs required to call the Taskless service and to invoke the existing rule
generation backend, which runs the service-side classifier and returns either a
static or a runtime rule. The `remote` recipe SHALL require authentication and
SHALL NOT itself decide static versus runtime.

#### Scenario: Remote requires authentication

- **WHEN** the agent follows `remote` while logged out
- **THEN** the recipe SHALL direct the agent to the authentication flow before
  submitting the request

#### Scenario: Static-versus-runtime is decided by the service

- **WHEN** the agent submits an authored request via `remote`
- **THEN** the recipe SHALL rely on the service to classify static versus runtime
- **AND** SHALL NOT make that determination locally

#### Scenario: Remote output matches local on-disk shape

- **WHEN** the service returns a generated rule via `remote`
- **THEN** the written files and paths SHALL match the shape produced by the
  local `static` path
