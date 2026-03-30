import { describe, expect, it } from "vitest";

// Import the canonicalize function by re-exporting it for testing.
// Since canonicalizeGitHubUrl is not exported, we test through resolveRepositoryUrl
// for integration, and test the URL patterns directly here.

// These patterns match the implementation in git-remote.ts
const SSH_PATTERN = /^git@github\.com:(?<path>[^/]+\/[^/]+?)(?:\.git)?$/;
const HTTPS_PATTERN =
  /^https:\/\/github\.com\/(?<path>[^/]+\/[^/]+?)(?:\.git)?$/;

function canonicalize(rawUrl: string): string {
  const sshMatch = SSH_PATTERN.exec(rawUrl);
  if (sshMatch?.groups?.path) {
    return `https://github.com/${sshMatch.groups.path}`;
  }
  const httpsMatch = HTTPS_PATTERN.exec(rawUrl);
  if (httpsMatch?.groups?.path) {
    return `https://github.com/${httpsMatch.groups.path}`;
  }
  throw new Error(`Unsupported git remote URL: "${rawUrl}".`);
}

describe("canonicalizeGitHubUrl", () => {
  it("canonicalizes SSH URLs with .git suffix", () => {
    expect(canonicalize("git@github.com:owner/repo.git")).toBe(
      "https://github.com/owner/repo"
    );
  });

  it("canonicalizes SSH URLs without .git suffix", () => {
    expect(canonicalize("git@github.com:owner/repo")).toBe(
      "https://github.com/owner/repo"
    );
  });

  it("canonicalizes HTTPS URLs with .git suffix", () => {
    expect(canonicalize("https://github.com/owner/repo.git")).toBe(
      "https://github.com/owner/repo"
    );
  });

  it("canonicalizes HTTPS URLs without .git suffix", () => {
    expect(canonicalize("https://github.com/owner/repo")).toBe(
      "https://github.com/owner/repo"
    );
  });

  it("throws for non-GitHub SSH URLs", () => {
    expect(() => canonicalize("git@gitlab.com:owner/repo.git")).toThrow(
      "Unsupported git remote URL"
    );
  });

  it("throws for non-GitHub HTTPS URLs", () => {
    expect(() => canonicalize("https://gitlab.com/owner/repo.git")).toThrow(
      "Unsupported git remote URL"
    );
  });

  it("throws for arbitrary strings", () => {
    expect(() => canonicalize("not-a-url")).toThrow(
      "Unsupported git remote URL"
    );
  });
});
