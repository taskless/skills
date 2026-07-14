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
- **Identify on the canonical id.** `decodeOrgId` now prefers the token's `id`
  claim over the legacy numeric `orgId`, and PostHog groups organizations on
  that canonical id. Tokens that don't yet carry an `id` claim fall back to the
  numeric claim, so grouping is unchanged until the server starts sending it.
- **Tolerate `number | string` on the legacy path.** The canonical `id` stays a
  UUID `string`, but `decodeOrgId` accepts either type since we can't promise
  what a legacy claim carries.
