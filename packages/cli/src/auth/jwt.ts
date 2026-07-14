import { decodeJwt } from "jose";

/**
 * Decode the canonical organization id from a JWT.
 *
 * `id` is the canonical, stable Taskless org id — the field we always act on.
 * We fall back to the legacy numeric `orgId` claim so a token minted before the
 * server namespaces its claims still resolves. The id may be a string (UUID) or
 * a number — we can't promise which — so both are accepted and returned as-is.
 * Returns `undefined` if the token is not a valid JWT or carries neither claim.
 * No signature verification is performed — the server validates on API calls.
 */
export function decodeOrgId(token: string): string | number | undefined {
  try {
    const claims = decodeJwt(token) as { id?: unknown; orgId?: unknown };
    const canonical = claims.id ?? claims.orgId;
    if (typeof canonical === "string" && canonical.length > 0) {
      return canonical;
    }
    if (typeof canonical === "number" && Number.isFinite(canonical)) {
      return canonical;
    }
    return undefined;
  } catch {
    return undefined;
  }
}
