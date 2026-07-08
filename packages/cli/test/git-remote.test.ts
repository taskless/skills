import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  canonicalizeGitHubUrl,
  canonicalOwnerUrl,
  listRemoteOwnerUrls,
} from "../src/util/git-remote";

const execFileAsync = promisify(execFile);

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

describe("canonicalOwnerUrl", () => {
  // Parity fixtures with the server's @taskless/shared/github canonicalOwnerUrl.
  // The dashboard builds whoami's per-org `url` with the same function and the
  // two are compared with `===`, so every form here MUST reduce identically —
  // including the ssh://, git://, and port forms the old regex version threw on.
  it.each([
    "git@github.com:Acme/Widgets.git", // scp-like SSH
    "https://github.com/acme/widgets", // https
    "https://github.com/ACME/widgets.git", // .git suffix
    "https://www.github.com/acme/widgets/", // www. + trailing slash
    "git@github.com:acme/widgets", // scp-like, no .git
    "ssh://git@github.com/acme/widgets.git", // ssh:// URL form
    "git://github.com/acme/widgets.git", // git:// URL form
    "https://github.com:443/acme/widgets", // explicit port
    "https://x-access-token@GitHub.com/Acme/Widgets", // userinfo + mixed case
    "acme", // bare owner login (the form the server canonicalizes)
  ])("reduces %s to the canonical owner url", (input) => {
    expect(canonicalOwnerUrl(input)).toBe("https://github.com/acme");
  });

  it("keeps the host for non-GitHub remotes (dropped later by listRemoteOwnerUrls)", () => {
    // Mirrors the server: host-agnostic and never throws. A gitlab owner url
    // just won't match a github-sourced org.
    expect(canonicalOwnerUrl("git@gitlab.com:acme/widgets.git")).toBe(
      "https://gitlab.com/acme"
    );
  });
});

describe("listRemoteOwnerUrls", () => {
  let directory: string;
  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "tskl-remotes-"));
    await execFileAsync("git", ["init"], { cwd: directory });
  });
  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it("orders origin before upstream before other remotes, deduped", async () => {
    await execFileAsync(
      "git",
      ["remote", "add", "fork", "git@github.com:me/widgets.git"],
      { cwd: directory }
    );
    await execFileAsync(
      "git",
      ["remote", "add", "upstream", "https://github.com/acme/widgets.git"],
      { cwd: directory }
    );
    await execFileAsync(
      "git",
      ["remote", "add", "origin", "git@github.com:Origin-Org/widgets.git"],
      { cwd: directory }
    );
    expect(await listRemoteOwnerUrls(directory)).toEqual([
      "https://github.com/origin-org",
      "https://github.com/acme",
      "https://github.com/me",
    ]);
  });

  it("skips non-GitHub remotes and returns [] with no remotes", async () => {
    expect(await listRemoteOwnerUrls(directory)).toEqual([]);
    await execFileAsync(
      "git",
      ["remote", "add", "origin", "git@gitlab.com:acme/widgets.git"],
      { cwd: directory }
    );
    expect(await listRemoteOwnerUrls(directory)).toEqual([]);
  });

  it("matches a github remote given in ssh:// url form", async () => {
    // Regression guard: the old regex canonicalizer threw on ssh:// remotes, so
    // this repo would have resolved to no current-org context.
    await execFileAsync(
      "git",
      ["remote", "add", "origin", "ssh://git@github.com/Acme/Widgets.git"],
      { cwd: directory }
    );
    expect(await listRemoteOwnerUrls(directory)).toEqual([
      "https://github.com/acme",
    ]);
  });
});
