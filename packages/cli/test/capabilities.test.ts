import { describe, expect, it } from "vitest";
import { isValidSpecVersion } from "../src/capabilities";

describe("isValidSpecVersion", () => {
  it("accepts valid YYYY-MM-DD dates", () => {
    expect(isValidSpecVersion("2026-03-01")).toBe(true);
    expect(isValidSpecVersion("2025-12-15")).toBe(true);
    expect(isValidSpecVersion("2026-01-01")).toBe(true);
  });

  it("accepts patch versions (YYYY-MM-DD.N)", () => {
    expect(isValidSpecVersion("2026-03-01.1")).toBe(true);
    expect(isValidSpecVersion("2026-03-01.42")).toBe(true);
  });

  it("rejects invalid formats", () => {
    expect(isValidSpecVersion("not-a-date")).toBe(false);
    expect(isValidSpecVersion("2026-13-01")).toBe(false);
    expect(isValidSpecVersion("2026-00-01")).toBe(false);
    expect(isValidSpecVersion("2026-01-32")).toBe(false);
    expect(isValidSpecVersion("")).toBe(false);
    expect(isValidSpecVersion("2026")).toBe(false);
    expect(isValidSpecVersion("2026-3-1")).toBe(false);
  });
});
