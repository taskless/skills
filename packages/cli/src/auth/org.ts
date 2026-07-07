import { listRemoteOwnerUrls } from "../util/git-remote";

/**
 * One organization from `GET /cli/api/whoami` (0.10.x contract). Hand-typed
 * here because the generated schema lags the server (the fields ship in
 * lockstep). `orgId` stays the numeric GitHub org id; `id` is the Taskless org
 * UUID — the value to send as the org subject on write calls.
 */
export interface WhoamiOrg {
  /** GitHub numeric org id (unchanged from 0.9.x). */
  orgId: number;
  /** Taskless org UUID — the org subject the CLI acts as. */
  id: string;
  /** Org name (GitHub owner login). */
  name: string;
  /** GitHub App installation id. */
  installationId: number;
  /** Provider discriminator, e.g. `"github"`. */
  source: string;
  /** Canonical OWNER url, e.g. `https://github.com/acme` (not per-repo). */
  url: string;
}

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
