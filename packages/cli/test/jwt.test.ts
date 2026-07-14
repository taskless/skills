import { describe, expect, it } from "vitest";
import { decodeOrgId } from "../src/auth/jwt";

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

  it("prefers the canonical `id` claim over the legacy orgId", () => {
    expect(decodeOrgId(makeJwt({ id: "org-uuid", orgId: 123 }))).toBe(
      "org-uuid"
    );
  });

  it("accepts a string id (we can't promise number vs. string)", () => {
    expect(decodeOrgId(makeJwt({ id: "org-uuid" }))).toBe("org-uuid");
  });

  it("accepts a numeric id", () => {
    expect(decodeOrgId(makeJwt({ id: 4242 }))).toBe(4242);
  });

  it("returns undefined for a JWT carrying neither id nor orgId", () => {
    expect(decodeOrgId(makeJwt({ sub: "user-123" }))).toBeUndefined();
  });

  it("returns undefined for an empty-string id claim", () => {
    expect(decodeOrgId(makeJwt({ id: "" }))).toBeUndefined();
  });

  it("returns undefined for an invalid token string", () => {
    expect(decodeOrgId("not-a-jwt")).toBeUndefined();
  });

  it("returns undefined for an empty string", () => {
    expect(decodeOrgId("")).toBeUndefined();
  });
});
