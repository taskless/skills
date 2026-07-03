## ADDED Requirements

### Requirement: Canonical rule signature envelope

The CLI SHALL represent a rule file's canonical signature as a single self-describing
string of the form `<algoVersion>;h=<algo>;d=<digest>`. For algoVersion `1` this is
`1;h=sha-256;d=<hex>`, where `<hex>` is the digest as lowercase hexadecimal. The token
before the **first** `;` is the algoVersion and SHALL be read up to that one delimiter to
detect the version (and therefore the normalization procedure and hash algorithm) before
any `key=value` parameters are parsed. Signatures SHALL be compared as whole strings.

#### Scenario: Envelope is emitted for algoVersion 1

- **WHEN** the CLI computes a signature for a rule file's bytes using algoVersion 1
- **THEN** the result SHALL be a string `1;h=sha-256;d=<hex>` with `<hex>` lowercase

#### Scenario: Version is read before parameters

- **WHEN** the CLI parses a signature string
- **THEN** it SHALL read the algoVersion as the substring before the first `;`
- **AND** SHALL NOT rely on the `key=value` parameter syntax to determine the version

#### Scenario: Signatures compare as whole strings

- **WHEN** the CLI compares two signatures for equality
- **THEN** it SHALL compare the full envelope strings, not the bare digests

### Requirement: Signature normalization procedure (algoVersion 1)

The CLI SHALL compute an algoVersion-1 digest as `SHA-256( normalize(fileText) )`,
hex-encoded lowercase, wrapped in the envelope. `normalize()` SHALL operate on raw decoded
text only and SHALL NOT parse or re-serialize YAML. In order, `normalize()` SHALL:

1. Decode the file as UTF-8.
2. Strip a single leading UTF-8 byte-order mark if present (decoded as `U+FEFF`).
3. Convert every CRLF and lone CR to LF.
4. Strip all trailing newlines, then append exactly one LF.
5. Re-encode as UTF-8 and SHA-256, hex lowercase.

The CLI SHALL NOT apply Unicode normalization (NFC/NFD): canonically-equivalent strings in
different composition forms SHALL hash differently. A change to `normalize()` SHALL ship as
a new algoVersion, never as a redefinition of an existing one.

#### Scenario: CRLF and LF hash identically

- **WHEN** two files differ only in CRLF versus LF line endings
- **THEN** their algoVersion-1 signatures SHALL be equal

#### Scenario: Trailing newlines are collapsed to one

- **WHEN** two files differ only in the number of trailing newlines (including none)
- **THEN** their algoVersion-1 signatures SHALL be equal

#### Scenario: Leading BOM is stripped

- **WHEN** a file has a leading UTF-8 BOM and an otherwise identical file does not
- **THEN** their algoVersion-1 signatures SHALL be equal

#### Scenario: Meaningful content change differs

- **WHEN** two files differ in any non-newline, non-BOM byte
- **THEN** their algoVersion-1 signatures SHALL differ

#### Scenario: Combining marks are not NFC-folded

- **WHEN** one file contains a precomposed character and another the decomposed form
- **THEN** their algoVersion-1 signatures SHALL differ

### Requirement: Signature hashing uses web-standard APIs only

The signature implementation SHALL use only web-standard APIs (`crypto.subtle.digest('SHA-256', …)`
and `TextEncoder`) and SHALL NOT depend on a Node-specific crypto module, so the CLI
reproduces the server's reference implementation byte-for-byte.

#### Scenario: No node-specific crypto dependency

- **WHEN** the signature module hashes a file's normalized bytes
- **THEN** it SHALL use `crypto.subtle` and `TextEncoder`
- **AND** SHALL NOT import `node:crypto`

### Requirement: Conformance vectors are fetched and asserted

The CLI SHALL consume the cross-repo conformance vectors served at
`GET /cli/api/rule-hash-vectors` (unauthenticated) as `{ vectors: [{ name, input, signature }] }`,
commit a copy as a fixture, and assert in its test suite that its independent
`normalize()`-plus-hash reproduces every vector's `signature` exactly. Non-ASCII `input`
SHALL be parsed as JSON (decoding `\uXXXX` escapes) before hashing. A vector mismatch SHALL
be a release blocker (the test SHALL fail the build).

#### Scenario: Local hasher reproduces every vector

- **WHEN** the conformance test runs against the committed vectors
- **THEN** the CLI SHALL compute the exact `signature` for every vector entry

#### Scenario: A mismatch blocks release

- **WHEN** any vector's computed signature does not match its expected `signature`
- **THEN** the test SHALL fail
- **AND** the build SHALL NOT pass

### Requirement: Reconcile reports every held rule file

The CLI SHALL reconcile by sending `POST /cli/api/reconcile` with an
`Authorization: Bearer <cli-token>` header and a JSON body `{ repositoryUrl, files }`, where
`repositoryUrl` is the full repository URL and `files` is an array of
`{ file, signature }` covering **every** rule file the CLI would otherwise run under
`.taskless/rules/`. `file` SHALL be the rule file's delivered name as it exists on disk and
`signature` SHALL be the full envelope computed for that file's bytes. The CLI SHALL send the
whole signature envelope, not a bare digest.

#### Scenario: All rule files are reported

- **WHEN** the CLI reconciles with rule files present under `.taskless/rules/`
- **THEN** the request body SHALL include one `{ file, signature }` entry per rule file

#### Scenario: Full envelope is sent

- **WHEN** the CLI reports a file's signature
- **THEN** it SHALL send the complete `1;h=sha-256;d=<hex>` envelope, not only the digest

### Requirement: Reconcile response buckets drive execution

The reconcile response SHALL be interpreted as four buckets — `run`, `unsafe`, `unknown`,
and `missing` — and each SHALL drive a specific CLI action:

- `run`: the file's content matches a rule the server blessed. The CLI SHALL execute it. This
  is the complete allow-list.
- `unsafe`: a rule held by delivered name whose content differs from what the server blessed
  (`expected` vs `got`). The CLI SHALL NOT run it and SHALL surface it as tamper/drift.
- `unknown`: a reported file the server never issued. The CLI SHALL NOT run it and SHALL
  surface it as advisory.
- `missing`: a rule the server expected that the CLI did not report. It is not actionable for
  execution and SHALL be treated as advisory/audit only.

The CLI SHALL match each `run` entry back to a local file by its `signature` (content-based
join), so a file that was moved but not changed still resolves.

#### Scenario: Run entries are matched by signature

- **WHEN** the CLI processes a `run` entry
- **THEN** it SHALL locate the corresponding local file by matching the `signature`, not the path

#### Scenario: Unsafe is surfaced and not run

- **WHEN** a reported file lands in `unsafe`
- **THEN** the CLI SHALL NOT execute it
- **AND** SHALL surface it as tamper/drift

#### Scenario: Unknown is surfaced and not run

- **WHEN** a reported file lands in `unknown`
- **THEN** the CLI SHALL NOT execute it
- **AND** SHALL surface it as an advisory notice

#### Scenario: Missing is advisory only

- **WHEN** the response includes `missing` entries
- **THEN** the CLI SHALL treat them as advisory/audit only and SHALL NOT fail execution on them

### Requirement: The CLI executes only the server run set

When reconciliation succeeds, the CLI SHALL execute exactly the files in the server's `run`
set and no other file. The CLI SHALL NOT run a file on the basis of its own local comparison
of signatures. This replaces any local classification of rules.

#### Scenario: Only run-set files execute

- **WHEN** reconciliation returns a `run` set that is a strict subset of the reported files
- **THEN** the CLI SHALL execute only the files in `run`
- **AND** SHALL NOT execute any reported file absent from `run`

#### Scenario: No local self-classification

- **WHEN** the CLI holds a local signature or sidecar for a file
- **THEN** it SHALL NOT treat that local value as authorization to run the file

### Requirement: Reconcile is scoped to the token's organization

The reconcile endpoint SHALL be authorized by the same bearer-token / `orgId`-claim scheme as
all `/cli/api/*` endpoints and SHALL be scoped to the organization the token owns. The CLI
SHALL handle the documented edges: a `401` with `{ error: "unauthorized" }` for a missing or
invalid token; an empty corpus (empty `run`/`missing`, every reported file in `unknown`,
nothing runs); and an empty report (empty `run`/`unsafe`/`unknown`, the full corpus in
`missing`).

#### Scenario: Unauthorized token

- **WHEN** the CLI calls reconcile without a valid bearer token
- **THEN** the server SHALL return `401` with `{ error: "unauthorized" }`
- **AND** the CLI SHALL NOT execute any rule from a `run` set

#### Scenario: Empty corpus runs nothing

- **WHEN** the repository has no blessed rules and the CLI reports files
- **THEN** every reported file SHALL be returned in `unknown`
- **AND** the CLI SHALL execute nothing

### Requirement: Local signatures are advisory only

Any signature the CLI persists into the repository (for example as sidecar metadata) SHALL be
treated as an offline-fallback convenience only and SHALL NOT be treated as an authorization
signal. The server-side record is authoritative and the server decides what runs.

#### Scenario: Sidecar signature is not authorization

- **WHEN** a rule file has a locally stored signature that matches its content
- **THEN** the CLI SHALL NOT run the file on that basis alone
- **AND** SHALL rely on the server's `run` set for authorization
