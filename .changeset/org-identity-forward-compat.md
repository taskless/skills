---
"@taskless/cli": patch
---

Treat the Taskless organization UUID as the one canonical identity, and become
forward-compatible with the server's coming identity cleanup.

- **Stop consuming `installationId`.** It is dropped from the `WhoamiOrg` type
  and from the `taskless rule meta --json` output (it was already optional and
  absent for public repos). The CLI never used it and it should not round-trip
  through us.
- **Namespace the GitHub org id.** `WhoamiOrg.orgId` is now optional and a new
  `githubOrgId?: number` is added, so a consumer reads `githubOrgId ?? orgId`
  and keeps working across the server's rename. It is a convenience id, never an
  identity.
- **Identify on the canonical id.** `decodeOrgId` validates the token's `id`
  claim (a UUID string) and the legacy `orgId` claim (numeric, or a numeric
  string) independently: a valid `id` wins, an invalid `id` still lets a valid
  `orgId` through, and a non-numeric `orgId` is rejected rather than smuggled in
  as an identity. PostHog then groups organizations on that canonical id. Tokens
  that don't yet carry an `id` claim fall back to the numeric claim, so grouping
  is unchanged until the server starts sending it.
- **Always have a known org id.** When neither a matched org nor a token claim
  resolves, the canonical id falls back to the nil UUID
  (`00000000-0000-0000-0000-000000000000`) instead of being absent — so the org
  subject and telemetry group are always a stable, known value and unattributed
  usage lands in one bucket. As a result, a write from a token missing org info
  now sends the nil-UUID subject rather than failing with a re-authenticate
  error.
- **Tolerate `number | string` on the legacy path.** The canonical `id` stays a
  UUID `string`, but `decodeOrgId` accepts either type since we can't promise
  what a legacy claim carries.
