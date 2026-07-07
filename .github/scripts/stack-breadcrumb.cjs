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

/** Matches just the opening marker, capturing `root` and the `pr=` list. */
const OPEN_MARKER_PATTERN = /<!-- stack root=(\d+) pr=([\d,]*) -->/;

/**
 * Parse the opening marker's `root` and ordered `pr=` membership list — but only
 * inside a COMPLETE region (both markers present), so a stray or pasted opening
 * marker without its closing tag is not mistaken for a managed region.
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
  const members = match[2]
    .split(",")
    .filter((part) => part.length > 0)
    .map(Number);
  return { root, members };
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
const STACK_HEADING = "**Stack** (root → tip):"; // root → tip

/** Render the full `<!-- stack … -->` … `<!-- /stack -->` region, or `''` for a non-stacked PR. */
function renderRegion(tree, currentNumber) {
  if (tree.members.length <= 1) {
    return "";
  }

  const open = `<!-- stack root=${tree.root} pr=${tree.members.join(",")} -->`;
  const lines = [open, STACK_HEADING, ""];

  const renderNode = (number_, depth) => {
    const indent = "  ".repeat(depth);
    lines.push(
      number_ === currentNumber
        ? `${indent}- ${HERE_PREFIX}#${number_}${HERE_SUFFIX}`
        : `${indent}- #${number_}`
    );
    for (const child of tree.childrenOf.get(number_) ?? []) {
      renderNode(child, depth + 1);
    }
  };

  renderNode(tree.root, 0);
  lines.push("<!-- /stack -->");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Tree derivation (pure, from the open-PR list)
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

/** Build the tree rooted at `rootNumber`: DFS pre-order members + sorted child map. */
function buildTree(rootNumber, pullRequests) {
  const { byNumber } = indexPullRequests(pullRequests);

  const childrenByHead = new Map();
  for (const pullRequest of pullRequests) {
    const siblings = childrenByHead.get(pullRequest.baseRefName) ?? [];
    siblings.push(pullRequest.number);
    childrenByHead.set(pullRequest.baseRefName, siblings);
  }

  const childrenOf = new Map();
  const members = [];
  const visited = new Set();

  const visit = (number_) => {
    const node = byNumber.get(number_);
    // Guard against a base/head cycle (A←B and B←A): never visit a PR twice.
    if (!node || visited.has(number_)) {
      return;
    }
    visited.add(number_);
    members.push(number_);
    const childNumbers = (childrenByHead.get(node.headRefName) ?? [])
      .filter((candidate) => candidate !== number_)
      .toSorted((a, b) => a - b);
    childrenOf.set(number_, childNumbers);
    for (const child of childNumbers) {
      visit(child);
    }
  };

  visit(rootNumber);
  return { root: rootNumber, members, childrenOf };
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
    const region = renderRegion(tree, number_);
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
 * Whether a workflow run is a stale stack-dependent check that should be
 * re-run. A run qualifies when it has a job that FAILED and whose name is
 * `stack`-prefixed (the convention for stack-position-dependent gates, e.g.
 * `stack: openspec-archived`). Passing/skipped stack jobs and non-stack
 * failures (tests) do NOT qualify — so nothing is re-run when the stack is
 * mid-flight and its checks are green or appropriately skipped.
 */
function hasFailedStackJob(jobs) {
  return (jobs ?? []).some(
    (job) =>
      job.conclusion === "failure" && /^stack\b/i.test(String(job.name ?? ""))
  );
}

module.exports = {
  parseStackComment,
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
  STACK_HEADING,
};
