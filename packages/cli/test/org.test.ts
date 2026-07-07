import { describe, expect, it } from "vitest";
import { selectOrgForOwners, type WhoamiOrg } from "../src/auth/org";

const org = (id: string, url: string, source = "github"): WhoamiOrg => ({
  orgId: 1,
  id,
  name: url.split("/").pop() ?? "",
  installationId: 1,
  source,
  url,
});

describe("selectOrgForOwners", () => {
  const orgs = [
    org("uuid-acme", "https://github.com/acme"),
    org("uuid-me", "https://github.com/me"),
  ];

  it("returns the first owner (origin precedence) that matches an org", () => {
    // origin=me, upstream=acme → me wins (it comes first in the owner list).
    expect(
      selectOrgForOwners(
        ["https://github.com/me", "https://github.com/acme"],
        orgs
      )?.id
    ).toBe("uuid-me");
  });

  it("falls through to a later remote when the first has no matching org", () => {
    expect(
      selectOrgForOwners(
        ["https://github.com/stranger", "https://github.com/acme"],
        orgs
      )?.id
    ).toBe("uuid-acme");
  });

  it("returns undefined when no owner matches", () => {
    expect(
      selectOrgForOwners(["https://github.com/stranger"], orgs)
    ).toBeUndefined();
  });

  it("ignores non-github-sourced orgs", () => {
    const gitlab = [org("uuid-x", "https://github.com/acme", "gitlab")];
    expect(
      selectOrgForOwners(["https://github.com/acme"], gitlab)
    ).toBeUndefined();
  });
});
