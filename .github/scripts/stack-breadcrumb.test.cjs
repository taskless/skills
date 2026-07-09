// SPDX-License-Identifier: MIT
// Adapted from the taskless/taskless stack-breadcrumb implementation
// (@taskless/stack-breadcrumb) and brought into this repository under its MIT
// license, with permission.
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  parseStackComment,
  gatherRecordedParents,
  getRegion,
  spliceRegion,
  renderRegion,
  findRoot,
  buildTree,
  resolveTree,
  resolveAffectedRoots,
  findAllRoots,
  planUpdate,
  reconcile,
  hasFailedStackJob,
} = require("./stack-breadcrumb.cjs");

const DEFAULT_BRANCH = "main";

function pr(number, head, base, body = "") {
  return {
    number,
    title: `PR ${number}`,
    headRefName: head,
    baseRefName: base,
    body,
  };
}

const REGION = [
  "<!-- stack root=10 pr=10,11:10,12:11 -->",
  "**Stack** (root → tip):",
  "",
  "- #10",
  "  - ➡️ #11 (you are here)",
  "    - #12",
  "<!-- /stack -->",
].join("\n");

test("parseStackComment: parses root, membership, and recorded topology", () => {
  assert.deepEqual(parseStackComment(`intro\n\n${REGION}`), {
    root: 10,
    members: [10, 11, 12],
    parents: new Map([
      [11, 10],
      [12, 11],
    ]),
  });
});

test("parseStackComment: a legacy flat marker yields no recorded parents", () => {
  assert.deepEqual(
    parseStackComment("<!-- stack root=10 pr=10,11,12 -->\nx\n<!-- /stack -->"),
    { root: 10, members: [10, 11, 12], parents: new Map() }
  );
});

test("parseStackComment: parses an empty membership list", () => {
  assert.deepEqual(
    parseStackComment("<!-- stack root=10 pr= -->\nx\n<!-- /stack -->"),
    { root: 10, members: [], parents: new Map() }
  );
});

test("gatherRecordedParents: consolidates topology across bodies", () => {
  const region = "<!-- stack root=10 pr=10,11:10,12:11 -->\nx\n<!-- /stack -->";
  const prs = [
    pr(11, "b", "main", region),
    pr(12, "c", "b", region),
    pr(20, "x", "main", "no marker here"),
  ];
  assert.deepEqual(
    [...gatherRecordedParents(prs)],
    [
      [11, 10],
      [12, 11],
    ]
  );
});

test("parseStackComment: undefined when no marker", () => {
  assert.equal(parseStackComment("just a normal PR body"), undefined);
});

test("parseStackComment: undefined for a bare opening marker without a closing tag", () => {
  // A pasted/stray opening marker must not be treated as a managed region.
  assert.equal(
    parseStackComment("intro\n<!-- stack root=10 pr=10,11 -->\nno closing tag"),
    undefined
  );
});

test("getRegion: extracts the full region", () => {
  assert.equal(getRegion(`before\n${REGION}\nafter`), REGION);
});

test("getRegion: undefined when absent", () => {
  assert.equal(getRegion("no region here"), undefined);
});

test("spliceRegion: appends to a body with none", () => {
  assert.equal(
    spliceRegion("Original body.", REGION),
    `Original body.\n\n${REGION}`
  );
});

test("spliceRegion: returns just the region for an empty body", () => {
  assert.equal(spliceRegion("", REGION), REGION);
});

test("spliceRegion: replaces an existing region in place", () => {
  const oldRegion = "<!-- stack root=10 pr=10,11 -->\nold\n<!-- /stack -->";
  const body = `top\n\n${oldRegion}\n\nbottom`;
  assert.equal(spliceRegion(body, REGION), `top\n\n${REGION}\n\nbottom`);
});

test("spliceRegion: removes the region when given an empty region", () => {
  assert.equal(spliceRegion(`keep this\n\n${REGION}`, ""), "keep this");
});

test("spliceRegion: no-op removing when no region exists", () => {
  assert.equal(spliceRegion("nothing to remove", ""), "nothing to remove");
});

test("spliceRegion: removing preserves unrelated blank runs elsewhere", () => {
  // A 3+ newline run unrelated to the region must survive removal.
  const body = `line1\n\n\n\nline2\n\n${REGION}`;
  assert.equal(spliceRegion(body, ""), "line1\n\n\n\nline2");
});

test("spliceRegion: removing a middle region rejoins with one blank line", () => {
  assert.equal(spliceRegion(`top\n\n${REGION}\n\nbottom`, ""), "top\n\nbottom");
});

test("spliceRegion: skip-when-equal is a no-op", () => {
  const body = `intro\n\n${REGION}\n\noutro`;
  assert.equal(spliceRegion(body, REGION), body);
});

test("spliceRegion: does not treat $ sequences as replacement patterns", () => {
  const dollarRegion =
    "<!-- stack root=10 pr=10,11 -->\ncost is $1 and $& too\n<!-- /stack -->";
  const body = "<!-- stack root=10 pr=10 -->\nold\n<!-- /stack -->";
  assert.equal(spliceRegion(body, dollarRegion), dollarRegion);
});

const chain = [pr(10, "a", DEFAULT_BRANCH), pr(11, "b", "a"), pr(12, "c", "b")];
const branching = [
  pr(10, "a", DEFAULT_BRANCH),
  pr(11, "b", "a"),
  pr(12, "c", "a"),
  pr(13, "d", "b"),
];

test("renderRegion: nested list with current PR marked", () => {
  assert.equal(renderRegion(buildTree(10, chain), 11), REGION);
});

test("renderRegion: empty for a non-stacked single-member tree", () => {
  assert.equal(renderRegion(buildTree(10, [pr(10, "a", "main")]), 10), "");
});

test("findRoot: walks a chain up to the root", () => {
  assert.equal(findRoot(12, chain, DEFAULT_BRANCH), 10);
  assert.equal(findRoot(11, chain, DEFAULT_BRANCH), 10);
  assert.equal(findRoot(10, chain, DEFAULT_BRANCH), 10);
});

test("findRoot: resolves from any branch of a branching tree", () => {
  assert.equal(findRoot(13, branching, DEFAULT_BRANCH), 10);
  assert.equal(findRoot(12, branching, DEFAULT_BRANCH), 10);
});

test("findRoot: a PR whose base has no open PR is its own root", () => {
  assert.equal(
    findRoot(11, [pr(11, "b", "deleted-parent")], DEFAULT_BRANCH),
    11
  );
});

test("findRoot: undefined for a PR that is not open", () => {
  assert.equal(findRoot(99, chain, DEFAULT_BRANCH), undefined);
});

test("buildTree: DFS pre-order for a chain", () => {
  assert.deepEqual(buildTree(10, chain).members, [10, 11, 12]);
});

test("buildTree: DFS pre-order with sorted children for a branching tree", () => {
  assert.deepEqual(buildTree(10, branching).members, [10, 11, 13, 12]);
});

test("buildTree: records sorted children per node", () => {
  const tree = buildTree(10, branching);
  assert.deepEqual(tree.childrenOf.get(10), [11, 12]);
  assert.deepEqual(tree.childrenOf.get(11), [13]);
  assert.deepEqual(tree.childrenOf.get(13), []);
});

test("buildTree: terminates on a base/head cycle, visiting each once", () => {
  const cycle = [pr(10, "a", "b"), pr(11, "b", "a")];
  assert.deepEqual(buildTree(10, cycle).members, [10, 11]);
});

test("resolveTree: finds root and builds tree in one step", () => {
  const tree = resolveTree(12, chain, DEFAULT_BRANCH);
  assert.equal(tree.root, 10);
  assert.deepEqual(tree.members, [10, 11, 12]);
});

test("resolveTree: undefined when the trigger is not open", () => {
  assert.equal(resolveTree(99, chain, DEFAULT_BRANCH), undefined);
});

test("findAllRoots: each distinct root once, ascending", () => {
  const twoStacks = [...chain, pr(20, "x", DEFAULT_BRANCH), pr(21, "y", "x")];
  assert.deepEqual(findAllRoots(twoStacks, DEFAULT_BRANCH), [10, 20]);
});

test("findAllRoots: empty when there are no open PRs", () => {
  assert.deepEqual(findAllRoots([], DEFAULT_BRANCH), []);
});

test("resolveAffectedRoots: open trigger returns its own root", () => {
  assert.deepEqual(
    resolveAffectedRoots(
      { number: 12, baseRefName: "b" },
      chain,
      DEFAULT_BRANCH
    ),
    [10]
  );
});

test("resolveAffectedRoots: parent route when a leaf closes", () => {
  const open = [pr(10, "a", DEFAULT_BRANCH), pr(11, "b", "a")];
  assert.deepEqual(
    resolveAffectedRoots(
      { number: 12, baseRefName: "b" },
      open,
      DEFAULT_BRANCH
    ),
    [10]
  );
});

test("resolveAffectedRoots: marker route when the root merges and children retarget", () => {
  const marker = "<!-- stack root=10 pr=10,11,12 -->\nx\n<!-- /stack -->";
  const open = [pr(11, "b", DEFAULT_BRANCH, marker), pr(12, "c", "b", marker)];
  assert.deepEqual(
    resolveAffectedRoots(
      { number: 10, baseRefName: DEFAULT_BRANCH },
      open,
      DEFAULT_BRANCH
    ),
    [11]
  );
});

test("resolveAffectedRoots: nothing when a closed PR affects no open stack", () => {
  assert.deepEqual(
    resolveAffectedRoots(
      { number: 99, baseRefName: "gone" },
      [pr(10, "a", DEFAULT_BRANCH)],
      DEFAULT_BRANCH
    ),
    []
  );
});

test("planUpdate: appends the region and flags a change", () => {
  const plan = planUpdate(pr(10, "a", "main", "intro"), REGION);
  assert.equal(plan.changed, true);
  assert.ok(plan.body.includes(REGION));
});

test("planUpdate: skips when the body already has the region", () => {
  const plan = planUpdate(pr(10, "a", "main", `intro\n\n${REGION}`), REGION);
  assert.equal(plan.changed, false);
});

test("planUpdate: removes the region when the desired region is empty", () => {
  const plan = planUpdate(pr(10, "a", "main", `x\n\n${REGION}`), "");
  assert.equal(plan.changed, true);
  assert.ok(!plan.body.includes("<!-- stack"));
});

test("reconcile: writes only changed bodies and reports updated/skipped", async () => {
  const twoChain = [pr(10, "a", "main"), pr(11, "b", "a")];
  const calls = [];
  const result = await reconcile(10, {
    pullRequests: twoChain,
    writeBody: (number_, body) => calls.push([number_, body]),
  });
  assert.equal(result.root, 10);
  assert.deepEqual(result.updated, [10, 11]);
  assert.deepEqual(result.skipped, []);
  assert.equal(calls.length, 2);
});

test("reconcile: skips a PR whose body already matches", async () => {
  const twoChain = [pr(10, "a", "main"), pr(11, "b", "a")];
  const tree = buildTree(10, twoChain);
  const seeded = twoChain.map((p) =>
    p.number === 10 ? { ...p, body: renderRegion(tree, 10) } : p
  );
  const result = await reconcile(10, { pullRequests: seeded, writeBody() {} });
  assert.ok(result.skipped.includes(10));
  assert.ok(result.updated.includes(11));
});

test("reconcile: records a failed write and continues", async () => {
  const twoChain = [pr(10, "a", "main"), pr(11, "b", "a")];
  const result = await reconcile(10, {
    pullRequests: twoChain,
    writeBody(number_) {
      if (number_ === 10) throw new Error("forbidden");
    },
  });
  assert.deepEqual(result.failed, [10]);
  assert.deepEqual(result.updated, [11]);
});

test("reconcile: freezes a merged member but keeps it in the open PR's breadcrumb", async () => {
  // #10 open (root), #11 merged (tip). #11 stays in the tree so #10 keeps
  // listing it, but its own body is never rewritten.
  const prs = [
    { ...pr(10, "a", "main"), state: "open" },
    { ...pr(11, "b", "a"), state: "closed" },
  ];
  const calls = [];
  const result = await reconcile(10, {
    pullRequests: prs,
    writeBody: (number_, body) => calls.push([number_, body]),
  });
  assert.deepEqual(result.updated, [10]);
  assert.deepEqual(result.frozen, [11]);
  assert.equal(calls.length, 1);
  // #10's breadcrumb still lists the merged #11 and the marker keeps full membership.
  assert.match(calls[0][1], /#11/);
  assert.match(calls[0][1], /pr=10,11/);
});

test("reconcile: a lone open root with only merged descendants still renders", async () => {
  // The whole stack has merged except the root — the breadcrumb must NOT clear,
  // and the merged descendants stay listed with a merged marker.
  const prs = [
    { ...pr(10, "a", "main"), state: "open" },
    { ...pr(11, "b", "a"), state: "closed", merged: true },
    { ...pr(12, "c", "b"), state: "closed", merged: true },
  ];
  const calls = [];
  const result = await reconcile(10, {
    pullRequests: prs,
    writeBody: (number_, body) => calls.push([number_, body]),
  });
  assert.deepEqual(result.updated, [10]);
  assert.deepEqual(result.frozen, [11, 12]);
  assert.match(calls[0][1], /pr=10,11:10,12:11/);
  assert.match(calls[0][1], /#11 ✅ merged/);
  assert.match(calls[0][1], /#12 ✅ merged/);
});

test("renderRegion: annotates merged/closed members and encodes topology", () => {
  const stateOf = (number_) =>
    number_ === 11 ? "merged" : number_ === 12 ? "closed" : "open";
  const region = renderRegion(buildTree(10, chain), 10, stateOf);
  assert.match(region, /pr=10,11:10,12:11/);
  assert.match(region, /#11 ✅ merged/);
  assert.match(region, /#12 ⛔ closed/);
});

test("buildTree: keeps a merged root after its child was retargeted", () => {
  // #10 merged (root, branch a); #11 open but GitHub retargeted its base to
  // main when #10 merged — the live base/head edge #10→#11 is gone. The
  // recorded topology (member:parent) restores it, so #10 stays the root.
  const marker = "<!-- stack root=10 pr=10,11:10,12:11 -->\nx\n<!-- /stack -->";
  const prs = [
    { ...pr(10, "a", DEFAULT_BRANCH, marker), state: "closed", merged: true },
    { ...pr(11, "b", DEFAULT_BRANCH, marker), state: "open" }, // retargeted to main
    { ...pr(12, "c", "b", marker), state: "open" },
  ];
  // The dispatched root is the live root #11; buildTree climbs to #10.
  const tree = buildTree(11, prs);
  assert.equal(tree.root, 10);
  assert.deepEqual(tree.members, [10, 11, 12]);
  assert.equal(tree.parentOf.get(11), 10);
  assert.equal(tree.parentOf.get(12), 11);
});

test("buildTree: a crafted marker cannot re-parent a PR under an open one", () => {
  // A hand-edited body claims open #50 is a child of open #99. #50 has no live
  // parent (base=main), but the recorded parent is OPEN, so it is NOT honored —
  // #50 stays its own root instead of being hijacked into #99's tree.
  const crafted = "<!-- stack root=99 pr=99,50:99 -->\nx\n<!-- /stack -->";
  const prs = [
    { ...pr(99, "x", DEFAULT_BRANCH, crafted), state: "open" },
    { ...pr(50, "y", DEFAULT_BRANCH, crafted), state: "open" },
  ];
  const tree = buildTree(50, prs);
  assert.equal(tree.root, 50);
  assert.deepEqual(tree.members, [50]);
});

test("buildTree: a recorded parent never overrides a live edge", () => {
  // #11 has a live parent (#10 via base "a"); a body claiming a different
  // recorded parent must not win over the authoritative live edge.
  const lie = "<!-- stack root=99 pr=11:99 -->\nx\n<!-- /stack -->";
  const prs = [
    { ...pr(10, "a", DEFAULT_BRANCH), state: "open" },
    { ...pr(11, "b", "a", lie), state: "open" },
  ];
  const tree = buildTree(10, prs);
  assert.equal(tree.root, 10);
  assert.equal(tree.parentOf.get(11), 10);
});

test("renderRegion: terminates on a malformed cyclic childrenOf", () => {
  // Defensive: a hand-built cyclic tree must not spin forever.
  const cyclic = {
    root: 1,
    members: [1, 2],
    parentOf: new Map([[2, 1]]),
    childrenOf: new Map([
      [1, [2]],
      [2, [1]], // cycle back to the root
    ]),
  };
  const region = renderRegion(cyclic, 1);
  assert.match(region, /#1/);
  assert.match(region, /#2/);
});

test("reconcile: keeps a merged, retargeted-away root in the open breadcrumbs", async () => {
  const marker = "<!-- stack root=10 pr=10,11:10,12:11 -->\nx\n<!-- /stack -->";
  const prs = [
    { ...pr(10, "a", DEFAULT_BRANCH, marker), state: "closed", merged: true },
    { ...pr(11, "b", DEFAULT_BRANCH, marker), state: "open" },
    { ...pr(12, "c", "b", marker), state: "open" },
  ];
  const calls = [];
  const result = await reconcile(11, {
    pullRequests: prs,
    writeBody: (number_, body) => calls.push([number_, body]),
  });
  assert.deepEqual(result.frozen, [10]); // merged root never rewritten
  assert.deepEqual(
    result.updated.toSorted((a, b) => a - b),
    [11, 12]
  );
  const body11 = calls.find(([number_]) => number_ === 11)[1];
  assert.match(body11, /#10 ✅ merged/); // provenance kept
  assert.match(body11, /pr=10,11:10,12:11/); // topology recorded forward
});

test("hasFailedStackJob: true when a stack-prefixed job failed", () => {
  assert.equal(
    hasFailedStackJob([
      { name: "stack: position", conclusion: "success" },
      { name: "stack: openspec-archived", conclusion: "failure" },
    ]),
    true
  );
});

test("hasFailedStackJob: false when the only failure is not a stack job", () => {
  assert.equal(
    hasFailedStackJob([
      { name: "stack: position", conclusion: "success" },
      { name: "Validate", conclusion: "failure" },
    ]),
    false
  );
});

test("hasFailedStackJob: false for a skipped stack job (not a failure)", () => {
  assert.equal(
    hasFailedStackJob([
      { name: "stack: openspec-archived", conclusion: "skipped" },
    ]),
    false
  );
});

test("hasFailedStackJob: 'stack' must be a name prefix, not merely contained", () => {
  assert.equal(
    hasFailedStackJob([
      { name: "Reconcile breadcrumb across the stack", conclusion: "failure" },
    ]),
    false
  );
});

test("hasFailedStackJob: false for empty/missing jobs", () => {
  assert.equal(hasFailedStackJob([]), false);
  assert.equal(hasFailedStackJob(undefined), false);
});
