import { describe, expect, it } from "vitest";
import {
  isValidSpecVersion,
  isSupportedSpecVersion,
  COMPATIBILITY,
} from "../src/capabilities";

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

describe("isSupportedSpecVersion", () => {
  it("supports the start of each range", () => {
    for (const range of COMPATIBILITY) {
      expect(isSupportedSpecVersion(range.start)).toBe(true);
    }
  });

  it("supports dates between range boundaries", () => {
    expect(isSupportedSpecVersion("2026-02-25")).toBe(true);
  });

  it("supports dates in the open-ended latest range", () => {
    expect(isSupportedSpecVersion("2026-06-15")).toBe(true);
    expect(isSupportedSpecVersion("2027-01-01")).toBe(true);
  });

  it("supports patch versions within a range", () => {
    expect(isSupportedSpecVersion("2026-03-01.1")).toBe(true);
    expect(isSupportedSpecVersion("2026-02-18.1")).toBe(true);
  });

  it("rejects dates before the earliest range", () => {
    expect(isSupportedSpecVersion("2026-02-17")).toBe(false);
    expect(isSupportedSpecVersion("2025-01-01")).toBe(false);
  });

  it("rejects invalid version strings", () => {
    expect(isSupportedSpecVersion("not-a-date")).toBe(false);
  });
});

describe("COMPATIBILITY", () => {
  it("has valid start dates in all ranges", () => {
    for (const range of COMPATIBILITY) {
      expect(isValidSpecVersion(range.start)).toBe(true);
    }
  });

  it("has valid end dates where specified", () => {
    for (const range of COMPATIBILITY) {
      if (range.end !== undefined) {
        expect(isValidSpecVersion(range.end)).toBe(true);
      }
    }
  });

  it("has exactly one open-ended range (the latest)", () => {
    const openEnded = COMPATIBILITY.filter((r) => r.end === undefined);
    expect(openEnded).toHaveLength(1);
  });
});
