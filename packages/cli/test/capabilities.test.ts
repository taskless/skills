import { describe, expect, it } from "vitest";
import {
  isValidSpecVersion,
  isScaffoldVersionSufficient,
  MIN_SCAFFOLD_VERSION,
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

describe("MIN_SCAFFOLD_VERSION", () => {
  it("has valid version strings for all entries", () => {
    for (const version of Object.values(MIN_SCAFFOLD_VERSION)) {
      expect(isValidSpecVersion(version)).toBe(true);
    }
  });

  it("contains expected subcommands", () => {
    expect(MIN_SCAFFOLD_VERSION["rules create"]).toBeDefined();
    expect(MIN_SCAFFOLD_VERSION["check"]).toBeDefined();
  });
});

describe("isScaffoldVersionSufficient", () => {
  it("returns true when version meets the minimum", () => {
    expect(isScaffoldVersionSufficient("rules create", "2026-03-02")).toBe(
      true
    );
    expect(isScaffoldVersionSufficient("check", "2026-02-18")).toBe(true);
  });

  it("returns true when version exceeds the minimum", () => {
    expect(isScaffoldVersionSufficient("rules create", "2026-04-01")).toBe(
      true
    );
    expect(isScaffoldVersionSufficient("check", "2026-03-01")).toBe(true);
  });

  it("returns false when version is below the minimum", () => {
    expect(isScaffoldVersionSufficient("rules create", "2026-03-01")).toBe(
      false
    );
    expect(isScaffoldVersionSufficient("check", "2026-02-17")).toBe(false);
  });

  it("returns true for subcommands without a minimum", () => {
    expect(isScaffoldVersionSufficient("init", "2025-01-01")).toBe(true);
    expect(isScaffoldVersionSufficient("unknown-cmd", "2025-01-01")).toBe(true);
  });
});
