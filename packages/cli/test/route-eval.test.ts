import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// The route decision is made by an agent following help/route.txt, so this
// dataset is not run against a code classifier. The test guards the dataset
// itself: it must stay structurally valid and balanced across every route and
// both failure directions, so it remains a usable calibration set.

interface EvalCase {
  request: string;
  expected: string;
  trap: string | null;
  reason: string;
}

interface EvalFixtures {
  routes: string[];
  traps: string[];
  cases: EvalCase[];
}

const fixtures = JSON.parse(
  readFileSync(resolve(import.meta.dirname, "fixtures/route-eval.json"), "utf8")
) as EvalFixtures;

describe("route honesty eval fixtures", () => {
  it("declares the three routes and both failure-direction traps", () => {
    expect(fixtures.routes).toEqual(["existing", "static", "remote"]);
    // Over-claim = Taskless grabbing a packaged/formatter job; over-escalate =
    // sending a locally-solvable request to the login-gated service.
    expect(fixtures.traps).toEqual(
      expect.arrayContaining(["over-claim", "over-escalate", "under-engage"])
    );
  });

  it("every case is well-formed and uses a declared route/trap", () => {
    expect(fixtures.cases.length).toBeGreaterThanOrEqual(10);
    for (const c of fixtures.cases) {
      expect(c.request.length).toBeGreaterThan(0);
      expect(c.reason.length).toBeGreaterThan(0);
      expect(fixtures.routes).toContain(c.expected);
      if (c.trap !== null) {
        expect(fixtures.traps).toContain(c.trap);
      }
    }
  });

  it("covers every route at least twice", () => {
    for (const route of fixtures.routes) {
      const count = fixtures.cases.filter((c) => c.expected === route).length;
      expect(count, `route ${route} needs >= 2 cases`).toBeGreaterThanOrEqual(
        2
      );
    }
  });

  it("guards both failure directions: over-claim and over-escalate", () => {
    const overClaim = fixtures.cases.filter((c) => c.trap === "over-claim");
    const overEscalate = fixtures.cases.filter(
      (c) => c.trap === "over-escalate"
    );
    // Over-claim cases must expect a non-`static` local route (Taskless should
    // not have grabbed them); over-escalate cases must expect a local route
    // (they should not have gone to remote).
    expect(overClaim.length).toBeGreaterThan(0);
    expect(overEscalate.length).toBeGreaterThan(0);
    for (const c of overClaim) expect(c.expected).toBe("existing");
    for (const c of overEscalate) expect(c.expected).toBe("static");
  });

  it("includes genuine remote cases that are not locally solvable", () => {
    const remote = fixtures.cases.filter((c) => c.expected === "remote");
    expect(remote.length).toBeGreaterThanOrEqual(2);
    // Genuine remote cases are clean (no trap) — they legitimately need the
    // service, not a misroute being corrected.
    expect(remote.every((c) => c.trap === null)).toBe(true);
  });
});
