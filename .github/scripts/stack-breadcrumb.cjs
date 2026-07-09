// SPDX-License-Identifier: MIT
// Adapted from the taskless/taskless stack-breadcrumb implementation
// (@taskless/stack-breadcrumb) and brought into this repository under its MIT
// license, with permission.
"use strict";

/**
 * Stack breadcrumb — pure, zero-dependency logic.
 *
 * A portable port of the `@taskless/stack-breadcrumb` package's core: it derives
 * a stacked-PR forest from `base`/`head` relationships, renders a breadcrumb
 * region, and plans the minimal body edits to keep every PR in a stack pointing
 * at its siblings. There is NO GitHub I/O here — the workflow supplies the PR
 * list (via `actions/github-script`'s octokit) and a `writeBody` callback, so
 * this file needs no npm install, no build step, and stays unit-testable with
 * `node --test`.
 *
 * The two-stage workflow keeps reconciliation serialized per stack root:
 *   stage 1 (dispatch)  — on PR shape events, resolve the affected root(s) and
 *                         fire a `repository_dispatch`.
 *   stage 2 (reconcile) — on that dispatch, render and propagate the breadcrumb.
 */

// ---------------------------------------------------------------------------
// Marker-region surgery
//
// Each managed PR body carries at most one region delimited by
// `<!-- stack root=N pr=… -->` … `<!-- /stack -->`. Replacing a region in place
// leaves every other byte untouched, so a git-town breadcrumb or any other
// content is never disturbed. Appending trims the body's trailing whitespace
// before adding the region after a blank line; removing collapses the blank
// lines the region left behind and trims trailing whitespace.
// ---------------------------------------------------------------------------

/** Matches the whole region, opening marker through `<!-- /stack -->`. */
const REGION_PATTERN = /<!-- stack [^>]*-->[\S\s]*?<!-- \/stack -->/;

/**
 * Matches just the opening marker, capturing `root` and the `pr=` list. Each
 * `pr=` entry is either `member` or `member:parent`, so the character class
 * admits `:` — old flat markers (`pr=82,83,84`) still match and parse as
 * members with no recorded parent (structure then comes from the live graph).
 */
const OPEN_MARKER_PATTERN = /<!-- stack root=(\d+) pr=([\d,:]*) -->/;

/**
 * Parse the opening marker's `root`, ordered `pr=` membership list, and any
 * recorded `member:parent` topology — but only inside a COMPLETE region (both
 * markers present), so a stray or pasted opening marker without its closing tag
 * is not mistaken for a managed region.
 *
 * Returns `{ root, members, parents }` where `parents` is a Map of member →
 * recorded parent for entries that carried a `:parent` suffix. A legacy flat
 * marker yields an empty `parents` map — fully backward compatible.
 */
function parseStackComment(body) {
  const region = getRegion(body);
  if (region === undefined) {
    return undefined;
  }
  const match = OPEN_MARKER_PATTERN.exec(region);
  if (!match) {
    return undefined;
  }
  const root = Number(match[1]);
  const members = [];
  const parents = new Map();
  for (const part of match[2].split(",")) {
    if (part.length === 0) {
      continue;
    }
    const [memberText, parentText] = part.split(":");
    const member = Number(memberText);
    if (!Number.isInteger(member)) {
      continue;
    }
    members.push(member);
    if (parentText !== undefined) {
      const parent = Number(parentText);
      if (Number.isInteger(parent)) {
        parents.set(member, parent);
      }
    }
  }
  return { root, members, parents };
}

/**
 * Consolidate the recorded `member → parent` topology across every PR body in
 * the list. All PRs in a stack carry the same marker, so the union is
 * consistent; on the rare disagreement, last-write wins. Legacy flat markers
 * contribute nothing, so a stack only gains durable topology once it has been
 * reconciled at least once under this format.
 */
function gatherRecordedParents(pullRequests) {
  const parents = new Map();
  for (const pullRequest of pullRequests) {
    const marker = parseStackComment(pullRequest.body);
    if (!marker) {
      continue;
    }
    for (const [member, parent] of marker.parents) {
      parents.set(member, parent);
    }
  }
  return parents;
}

/** Return the existing region (including both markers), or `undefined` if absent. */
function getRegion(body) {
  const match = REGION_PATTERN.exec(body);
  return match ? match[0] : undefined;
}

/**
 * Splice `region` into `body`:
 * - an empty `region` removes an existing region (non-stacked PR);
 * - an existing region is replaced in place;
 * - otherwise the region is appended after a blank line.
 * Content outside the markers is preserved.
 */
function spliceRegion(body, region) {
  const existing = getRegion(body);

  if (region.length === 0) {
    if (!existing) {
      return body;
    }
    // Remove the region and only the blank lines hugging it, rejoining the
    // surrounding text with a single blank line. Spacing elsewhere in the body
    // is left exactly as-is.
    const start = body.indexOf(existing);
    const before = body.slice(0, start).replace(/\n+$/, "");
    const after = body.slice(start + existing.length).replace(/^\n+/, "");
    if (before.length === 0) {
      return after.trimEnd();
    }
    if (after.length === 0) {
      return before.trimEnd();
    }
    return `${before}\n\n${after}`;
  }

  if (existing) {
    // Function replacer so `$` sequences in a PR title are not treated as
    // `String.replace` special patterns ($&, $1, …).
    return body.replace(REGION_PATTERN, () => region);
  }

  const trimmed = body.trimEnd();
  return trimmed.length === 0 ? region : `${trimmed}\n\n${region}`;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

const HERE_PREFIX = "➡️ "; // ➡️
const HERE_SUFFIX = " (you are here)";
const MERGED_SUFFIX = " ✅ merged";
const CLOSED_SUFFIX = " ⛔ closed";
const STACK_HEADING = "**Stack** (root → tip):"; // root → tip

/**
 * Render the full `<!-- stack … -->` … `<!-- /stack -->` region, or `''` for a
 * non-stacked PR.
 *
 * `stateOf(number)` returns `'merged' | 'closed' | 'open'` (default `'open'`),
 * so merged/closed ancestors stay in the tree with a status marker instead of
 * being pruned. The `pr=` list encodes topology as `member:parent` (the root
 * has no `:parent`), so the structure is recorded and survives retargeting.
 */
function renderRegion(tree, currentNumber, stateOf = () => "open") {
  if (tree.members.length <= 1) {
    return "";
  }

  const encodeMember = (number_) => {
    const parent = tree.parentOf.get(number_);
    return parent === undefined ? String(number_) : `${number_}:${parent}`;
  };
  const open = `<!-- stack root=${tree.root} pr=${tree.members
    .map(encodeMember)
    .join(",")} -->`;
  const lines = [open, STACK_HEADING, ""];

  const stateSuffix = (number_) => {
    switch (stateOf(number_)) {
      case "merged":
        return MERGED_SUFFIX;
      case "closed":
        return CLOSED_SUFFIX;
      default:
        return "";
    }
  };

  // `buildTree` yields an acyclic tree, but guard the recursion defensively so a
  // hand-built or malformed `childrenOf` can never spin the workflow forever.
  const rendered = new Set();
  const renderNode = (number_, depth) => {
    if (rendered.has(number_)) {
      return;
    }
    rendered.add(number_);
    const indent = "  ".repeat(depth);
    const label =
      number_ === currentNumber
        ? `${HERE_PREFIX}#${number_}${HERE_SUFFIX}`
        : `#${number_}${stateSuffix(number_)}`;
    lines.push(`${indent}- ${label}`);
    for (const child of tree.childrenOf.get(number_) ?? []) {
      renderNode(child, depth + 1);
    }
  };

  renderNode(tree.root, 0);
  lines.push("<!-- /stack -->");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Tree derivation — additive topology (live edges + recorded parents)
//
// The tree is ADDITIVE: once a PR joins a stack it stays in the breadcrumb, even
// after it merges. Two facts feed the shape, and the first that answers wins:
//
//   1. RECORDED parent — the marker encodes topology as `member:parent`
//      (`pr=82,83:82,84:83`). This is durable: it does not change when a branch
//      is deleted or a PR is retargeted.
//   2. LIVE parent — the PR whose head branch is this PR's base. This reflects
//      the current GitHub graph and seeds the topology for a brand-new member
//      that no marker has recorded yet.
//
// Why recorded must win: when a parent merges, GitHub deletes its branch and
// retargets the child onto the default branch — which SEVERS the live edge
// (child.base becomes `main`, so `findRoot` would call the child its own root
// and the merged parent would vanish). The recorded parent survives that, so
// `buildTree` climbs it back to the true root and keeps the merged ancestor in
// the tree (rendered `✅ merged`). Because the marker is written while the edges
// are still live, the topology is captured BEFORE any retarget can sever it.
//
// A legacy flat marker (`pr=82,83,84`) records no parents, so such a stack
// derives purely from the live graph — identical to the pre-topology behavior —
// and self-migrates to the recorded form on its next reconcile.
// ---------------------------------------------------------------------------

function indexPullRequests(pullRequests) {
  const byNumber = new Map();
  const byHead = new Map();
  for (const pullRequest of pullRequests) {
    byNumber.set(pullRequest.number, pullRequest);
    byHead.set(pullRequest.headRefName, pullRequest);
  }
  return { byNumber, byHead };
}

function parentOf(pullRequest, byHead, defaultBranch) {
  if (pullRequest.baseRefName === defaultBranch) {
    return undefined;
  }
  return byHead.get(pullRequest.baseRefName);
}

/** Walk `base` pointers up from `startNumber` to the root of its stack. */
function findRoot(startNumber, pullRequests, defaultBranch) {
  const { byNumber, byHead } = indexPullRequests(pullRequests);
  let current = byNumber.get(startNumber);
  if (!current) {
    return undefined;
  }
  const seen = new Set();
  let parent = parentOf(current, byHead, defaultBranch);
  while (parent && !seen.has(current.number)) {
    seen.add(current.number);
    current = parent;
    parent = parentOf(current, byHead, defaultBranch);
  }
  return current.number;
}

/**
 * Build the provenance tree for `rootNumber`'s stack.
 *
 * Each member's parent is its RECORDED parent (from the marker topology) when
 * one exists, else its LIVE parent (the PR whose head branch is this PR's base).
 * Recorded parents win so the structure survives a merged parent whose child
 * GitHub retargeted onto the default branch — which severs the live base/head
 * edge but not the recorded one. From `rootNumber` we climb to the true (top)
 * root, then DFS down the combined child map, so merged/closed ancestors stay
 * in the tree instead of being pruned.
 *
 * Legacy flat markers record no parents, so a not-yet-migrated stack derives
 * purely from the live graph (unchanged behavior); the first reconcile writes
 * the topology while the edges are still live, making it durable thereafter.
 *
 * Returns `{ root, members, childrenOf, parentOf }` — members in DFS pre-order,
 * `parentOf` a Map of member → parent (the root is absent).
 */
function buildTree(rootNumber, pullRequests) {
  const { byNumber, byHead } = indexPullRequests(pullRequests);
  const recordedParents = gatherRecordedParents(pullRequests);

  const liveParentOf = (number_) => {
    const node = byNumber.get(number_);
    const parent = node ? byHead.get(node.baseRefName) : undefined;
    return parent ? parent.number : undefined;
  };
  // The LIVE edge wins — it is authoritative and not user-editable. A RECORDED
  // parent only fills a SEVERED edge (a PR with no live parent), and only when
  // it points at a KNOWN merged/closed ancestor — the sole legitimate case (a
  // parent that merged and had its child retargeted onto the default branch).
  // PR bodies are user-editable, so this containment stops a crafted marker from
  // re-parenting an unrelated PR: it can neither override a live edge nor attach
  // a PR under an open one.
  const parentOf = (number_) => {
    const live = liveParentOf(number_);
    if (live !== undefined) {
      return live;
    }
    const recorded = recordedParents.get(number_);
    if (recorded === undefined) {
      return undefined;
    }
    const recordedParent = byNumber.get(recorded);
    const parentIsMergedOrClosed =
      recordedParent !== undefined &&
      recordedParent.state !== undefined &&
      recordedParent.state !== "open";
    return parentIsMergedOrClosed ? recorded : undefined;
  };

  // Climb to the true root (recorded topology may point above `rootNumber`
  // once an ancestor has merged and its child was retargeted).
  let trueRoot = rootNumber;
  const climbed = new Set();
  for (
    let parent = parentOf(trueRoot);
    parent !== undefined && !climbed.has(trueRoot);
    parent = parentOf(trueRoot)
  ) {
    climbed.add(trueRoot);
    trueRoot = parent;
  }

  // Every number we know of — live PRs plus any named only by recorded topology
  // (e.g. a merged root that has dropped out of the open-PR list).
  const known = new Set(byNumber.keys());
  for (const [member, parent] of recordedParents) {
    known.add(member);
    known.add(parent);
  }

  // Invert parent → child, then DFS pre-order from the true root.
  const childrenOf = new Map();
  for (const number_ of known) {
    const parent = parentOf(number_);
    if (parent !== undefined && parent !== number_) {
      childrenOf.set(parent, [...(childrenOf.get(parent) ?? []), number_]);
    }
  }
  for (const [parent, children] of childrenOf) {
    childrenOf.set(
      parent,
      children.toSorted((a, b) => a - b)
    );
  }

  const members = [];
  const parentMap = new Map();
  const visited = new Set();
  const visit = (number_, parent) => {
    // Guard against a topology cycle: never visit a number twice.
    if (visited.has(number_)) {
      return;
    }
    visited.add(number_);
    members.push(number_);
    if (parent !== undefined) {
      parentMap.set(number_, parent);
    }
    for (const child of childrenOf.get(number_) ?? []) {
      visit(child, number_);
    }
  };
  visit(trueRoot, undefined);

  // Scope the child map to this tree's members, guaranteeing an entry (possibly
  // empty) for every member — including leaves.
  const scopedChildren = new Map();
  for (const number_ of members) {
    scopedChildren.set(number_, childrenOf.get(number_) ?? []);
  }

  return {
    root: trueRoot,
    members,
    childrenOf: scopedChildren,
    parentOf: parentMap,
  };
}

/** Find the root of `triggerNumber`'s stack, then build the tree. */
function resolveTree(triggerNumber, pullRequests, defaultBranch) {
  const root = findRoot(triggerNumber, pullRequests, defaultBranch);
  if (root === undefined) {
    return undefined;
  }
  return buildTree(root, pullRequests);
}

/**
 * Resolve the root(s) of the stack(s) a PR event affects.
 * - An OPEN trigger affects exactly its own root.
 * - A CLOSED/merged trigger's stack still needs a redraw: union the survivors
 *   found via the parent route (open PR headed at the closed PR's base) and the
 *   marker route (open PRs whose last breadcrumb listed the closed PR), then map
 *   each surviving member to its (possibly new) root.
 */
function resolveAffectedRoots(trigger, pullRequests, defaultBranch) {
  const isOpen = pullRequests.some(
    (pullRequest) => pullRequest.number === trigger.number
  );
  if (isOpen) {
    const root = findRoot(trigger.number, pullRequests, defaultBranch);
    return root === undefined ? [] : [root];
  }

  const affected = new Set();
  for (const candidate of pullRequests) {
    const isParentOfClosed = candidate.headRefName === trigger.baseRefName;
    const marker = parseStackComment(candidate.body);
    const markerNamedClosed =
      marker !== undefined &&
      (marker.root === trigger.number ||
        marker.members.includes(trigger.number));
    if (isParentOfClosed || markerNamedClosed) {
      affected.add(candidate.number);
    }
  }

  const roots = new Set();
  for (const number_ of affected) {
    const root = findRoot(number_, pullRequests, defaultBranch);
    if (root !== undefined) {
      roots.add(root);
    }
  }
  return [...roots].toSorted((a, b) => a - b);
}

/** Every distinct stack root among the open PRs (deduped, ascending). */
function findAllRoots(pullRequests, defaultBranch) {
  const roots = new Set();
  for (const pullRequest of pullRequests) {
    const root = findRoot(pullRequest.number, pullRequests, defaultBranch);
    if (root !== undefined) {
      roots.add(root);
    }
  }
  return [...roots].toSorted((a, b) => a - b);
}

// ---------------------------------------------------------------------------
// Reconcile orchestration
// ---------------------------------------------------------------------------

/** Compute the new body for one PR given its desired region (`''` removes it). */
function planUpdate(pullRequest, region) {
  const body = spliceRegion(pullRequest.body, region);
  return {
    number: pullRequest.number,
    changed: body !== pullRequest.body,
    body,
  };
}

/**
 * Reconcile the tree rooted at `root`: render the breadcrumb for each member and
 * write only changed bodies via `deps.writeBody`. A write that throws is logged
 * and the PR is recorded as failed; the rest of the tree still reconciles.
 */
async function reconcile(root, deps) {
  const { pullRequests, writeBody } = deps;
  const byNumber = new Map(
    pullRequests.map((pullRequest) => [pullRequest.number, pullRequest])
  );
  const tree = buildTree(root, pullRequests);

  // Per-member status for rendering: a member with no PR object (named only by
  // recorded topology) or an open one is unannotated; a closed one is shown as
  // merged vs. plain-closed via its `merged` flag.
  const stateOf = (number_) => {
    const pullRequest = byNumber.get(number_);
    if (!pullRequest || pullRequest.state === undefined) {
      return "open";
    }
    if (pullRequest.state === "open") {
      return "open";
    }
    return pullRequest.merged ? "merged" : "closed";
  };

  const updated = [];
  const skipped = [];
  const frozen = [];
  const failed = [];

  for (const number_ of tree.members) {
    const pullRequest = byNumber.get(number_);
    if (!pullRequest) {
      continue;
    }
    // A merged/closed member stays in the tree — so open PRs keep listing it and
    // the last open PR captures the full construction history — but its own body
    // is frozen (never rewritten). Members without a `state` are treated as open
    // (open-PR list and unit fixtures both omit or set it to "open").
    if (pullRequest.state !== undefined && pullRequest.state !== "open") {
      frozen.push(number_);
      continue;
    }
    const region = renderRegion(tree, number_, stateOf);
    const plan = planUpdate(pullRequest, region);
    if (!plan.changed) {
      skipped.push(number_);
      continue;
    }
    try {
      await writeBody(number_, plan.body);
      updated.push(number_);
    } catch (error) {
      console.error(
        `stack-breadcrumb: could not update PR #${number_}: ${String(error)}`
      );
      failed.push(number_);
    }
  }

  return { root, updated, skipped, frozen, failed };
}

// ---------------------------------------------------------------------------
// Stale stack-check detection (for re-running "trued" checks)
// ---------------------------------------------------------------------------

/**
 * Given a workflow run's `jobs`, decide whether that run is a stale
 * stack-dependent check to re-run: it qualifies when one of its jobs FAILED and
 * that job's name is `stack`-prefixed (the convention for stack-position-
 * dependent gates, e.g. `stack: openspec-archived`). Passing/skipped stack jobs
 * and non-stack failures (tests) do NOT qualify — so nothing is re-run when the
 * stack is mid-flight and its checks are green or appropriately skipped.
 */
function hasFailedStackJob(jobs) {
  return (jobs ?? []).some(
    (job) =>
      job.conclusion === "failure" && /^stack\b/i.test(String(job.name ?? ""))
  );
}

module.exports = {
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
  HERE_PREFIX,
  HERE_SUFFIX,
  MERGED_SUFFIX,
  CLOSED_SUFFIX,
  STACK_HEADING,
};
