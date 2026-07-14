import { describe, expect, it } from "vitest";
import { decodeOrgId, NIL_ORG_ID } from "../src/auth/jwt";

// Minimal unsigned JWTs for testing (header: {"alg":"none","typ":"JWT"})
const HEADER = "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0";

function makeJwt(payload: Record<string, unknown>): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${HEADER}.${encoded}.`;
}

describe("decodeOrgId", () => {
  it("returns the legacy numeric orgId claim", () => {
    expect(decodeOrgId(makeJwt({ orgId: 123 }))).toBe(123);
  });

  it("coerces a numeric-string orgId claim", () => {
    expect(decodeOrgId(makeJwt({ orgId: "123" }))).toBe(123);
  });

  it("rejects a non-numeric orgId (never smuggled in as an identity)", () => {
    expect(decodeOrgId(makeJwt({ orgId: "not-a-number" }))).toBeUndefined();
  });

  it("prefers the canonical `id` claim over the legacy orgId", () => {
    expect(decodeOrgId(makeJwt({ id: "org-uuid", orgId: 123 }))).toBe(
      "org-uuid"
    );
  });

  it("accepts a string id (a UUID)", () => {
    expect(decodeOrgId(makeJwt({ id: "org-uuid" }))).toBe("org-uuid");
  });

  it("falls back to a valid orgId when the id claim is invalid (empty)", () => {
    // `??` would keep "" — independent validation lets the legacy orgId through.
    expect(decodeOrgId(makeJwt({ id: "", orgId: 123 }))).toBe(123);
  });

  it("ignores a non-string id claim and falls back to orgId", () => {
    expect(decodeOrgId(makeJwt({ id: 4242, orgId: 123 }))).toBe(123);
  });

  it("returns undefined for a JWT carrying neither id nor orgId", () => {
    expect(decodeOrgId(makeJwt({ sub: "user-123" }))).toBeUndefined();
  });

  it("returns undefined for an invalid token string", () => {
    expect(decodeOrgId("not-a-jwt")).toBeUndefined();
  });

  it("returns undefined for an empty string", () => {
    expect(decodeOrgId("")).toBeUndefined();
  });
});

describe("NIL_ORG_ID", () => {
  it("is the nil UUID", () => {
    expect(NIL_ORG_ID).toBe("00000000-0000-0000-0000-000000000000");
  });
});
