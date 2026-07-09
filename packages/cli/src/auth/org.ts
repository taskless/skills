import type { paths } from "../generated/api";
import { decodeOrgId } from "./jwt";
import { fetchWhoami } from "./whoami";
import { listRemoteOwnerUrls } from "../util/git-remote";

type WhoamiData =
  paths["/cli/api/whoami"]["get"]["responses"]["200"]["content"]["application/json"];

/**
 * One organization from `GET /cli/api/whoami`, derived from the generated
 * OpenAPI schema. `orgId` is the numeric GitHub org id; `id` is the Taskless
 * org UUID — the subject the CLI acts as on write calls; `url` is the canonical
 * OWNER url (e.g. `https://github.com/acme`) matched against the repo's remotes.
 */
export type WhoamiOrg = WhoamiData["orgs"][number];

/**
 * Pick the acting org from a whoami org list given the repo's owner urls (in
 * `origin` → `upstream` → rest precedence). Exact `url` equality against
 * GitHub-sourced orgs; the first remote that matches an org wins. Returns
 * `undefined` when nothing matches (no current-org context).
 */
export function selectOrgForOwners(
  ownerUrls: string[],
  orgs: WhoamiOrg[]
): WhoamiOrg | undefined {
  const byUrl = new Map(
    orgs.filter((org) => org.source === "github").map((org) => [org.url, org])
  );
  for (const ownerUrl of ownerUrls) {
    const org = byUrl.get(ownerUrl);
    if (org) return org;
  }
  return undefined;
}

/**
 * Resolve which org the CLI acts as for the repo at `cwd`: match the repo's
 * local git remotes against `orgs[].url`. Returns `undefined` when there is no
 * GitHub remote or no org owns it — the caller then has no current-org context
 * (and any write it attempts is authorized, and may be denied, server-side).
 */
export async function resolveCurrentOrg(
  cwd: string,
  orgs: WhoamiOrg[]
): Promise<WhoamiOrg | undefined> {
  const ownerUrls = await listRemoteOwnerUrls(cwd);
  return selectOrgForOwners(ownerUrls, orgs);
}

/**
 * The org subject to send on write calls. Prefers the current org's Taskless
 * UUID (`id`), resolved by matching the repo's remotes against `whoami`; falls
 * back to the deprecated numeric `orgId` claim in the token when whoami is
 * unavailable or no org owns the repo. A new client thus routes multi-org users
 * correctly, while older single-org behaviour is preserved via the claim.
 *
 * Returns `undefined` only when there is neither a matched org nor a claim
 * (a broken or pre-org token) — the caller has no subject to send.
 */
export async function resolveOrgSubject(
  cwd: string,
  token: string
): Promise<string | number | undefined> {
  const whoami = await fetchWhoami(token);
  if (whoami && whoami.orgs.length > 0) {
    const org = await resolveCurrentOrg(cwd, whoami.orgs);
    if (org) return org.id;
  }
  return decodeOrgId(token);
}
