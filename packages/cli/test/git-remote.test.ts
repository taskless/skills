import { describe, expect, it } from "vitest";
import { canonicalizeGitHubUrl } from "../src/actions/git-remote";

describe("canonicalizeGitHubUrl", () => {
  it("canonicalizes SSH URLs with .git suffix", () => {
    expect(canonicalizeGitHubUrl("git@github.com:owner/repo.git")).toBe(
      "https://github.com/owner/repo"
    );
  });

  it("canonicalizes SSH URLs without .git suffix", () => {
    expect(canonicalizeGitHubUrl("git@github.com:owner/repo")).toBe(
      "https://github.com/owner/repo"
    );
  });

  it("canonicalizes HTTPS URLs with .git suffix", () => {
    expect(canonicalizeGitHubUrl("https://github.com/owner/repo.git")).toBe(
      "https://github.com/owner/repo"
    );
  });

  it("canonicalizes HTTPS URLs without .git suffix", () => {
    expect(canonicalizeGitHubUrl("https://github.com/owner/repo")).toBe(
      "https://github.com/owner/repo"
    );
  });

  it("throws for non-GitHub SSH URLs", () => {
    expect(() =>
      canonicalizeGitHubUrl("git@gitlab.com:owner/repo.git")
    ).toThrow("Unsupported git remote URL");
  });

  it("throws for non-GitHub HTTPS URLs", () => {
    expect(() =>
      canonicalizeGitHubUrl("https://gitlab.com/owner/repo.git")
    ).toThrow("Unsupported git remote URL");
  });

  it("throws for arbitrary strings", () => {
    expect(() => canonicalizeGitHubUrl("not-a-url")).toThrow(
      "Unsupported git remote URL"
    );
  });
});
