import { describe, expect, it } from "vitest";
import { decodeOrgId } from "../src/actions/jwt";

// Minimal unsigned JWTs for testing (header: {"alg":"none","typ":"JWT"})
const HEADER = "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0";

function makeJwt(payload: Record<string, unknown>): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${HEADER}.${encoded}.`;
}

describe("decodeOrgId", () => {
  it("returns numeric orgId from a valid JWT", () => {
    expect(decodeOrgId(makeJwt({ orgId: 123 }))).toBe(123);
  });

  it("returns undefined for a JWT missing orgId", () => {
    expect(decodeOrgId(makeJwt({ sub: "user-123" }))).toBeUndefined();
  });

  it("returns undefined for a JWT with non-numeric orgId", () => {
    expect(decodeOrgId(makeJwt({ orgId: "not-a-number" }))).toBeUndefined();
  });

  it("returns undefined for an invalid token string", () => {
    expect(decodeOrgId("not-a-jwt")).toBeUndefined();
  });

  it("returns undefined for an empty string", () => {
    expect(decodeOrgId("")).toBeUndefined();
  });
});
