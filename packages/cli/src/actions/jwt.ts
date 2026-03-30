import { decodeJwt } from "jose";

/**
 * Decode the `orgId` claim from a JWT.
 * Returns `undefined` if the token is not a valid JWT or lacks the claim.
 * No signature verification is performed — the server validates on API calls.
 */
export function decodeOrgId(token: string): number | undefined {
  try {
    const claims = decodeJwt(token);
    const orgId = claims.orgId;
    if (typeof orgId === "number" && Number.isFinite(orgId)) {
      return orgId;
    }
    return undefined;
  } catch {
    return undefined;
  }
}
