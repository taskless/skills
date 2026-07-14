import { decodeJwt } from "jose";

/**
 * Known fallback for the canonical org id — the nil UUID. Used when a token
 * carries no resolvable org so the canonical id is never missing; downstream
 * (the API org subject, PostHog grouping) always has a stable, known value
 * rather than `undefined`, and "unattributed" usage lands in one known bucket.
 */
export const NIL_ORG_ID = "00000000-0000-0000-0000-000000000000";

/**
 * Decode the canonical organization id from a JWT.
 *
 * `id` is the canonical, stable Taskless org id — a UUID string. The legacy
 * numeric `orgId` claim is the fallback for tokens minted before the server
 * namespaced its claims. The two are validated INDEPENDENTLY:
 * - a valid `id` (a non-empty string) wins;
 * - otherwise a valid `orgId` (a finite number, or a numeric string, which is
 *   coerced) is used — a non-numeric `orgId` is rejected, never smuggled in as
 *   an identity, and an invalid `id` (e.g. `""`) does not block this fallback.
 *
 * Returns `undefined` when neither claim is usable (or the token is not a JWT);
 * callers apply `?? NIL_ORG_ID` for the known fallback. No signature
 * verification is performed — the server validates on API calls.
 */
export function decodeOrgId(token: string): string | number | undefined {
  let claims: { id?: unknown; orgId?: unknown };
  try {
    claims = decodeJwt(token) as { id?: unknown; orgId?: unknown };
  } catch {
    return undefined;
  }
  // Canonical id — a non-empty UUID string.
  if (typeof claims.id === "string" && claims.id.length > 0) {
    return claims.id;
  }
  // Legacy GitHub org id — numeric only (a numeric string is coerced).
  if (typeof claims.orgId === "number" && Number.isFinite(claims.orgId)) {
    return claims.orgId;
  }
  if (typeof claims.orgId === "string" && /^\d+$/.test(claims.orgId)) {
    return Number(claims.orgId);
  }
  return undefined;
}
