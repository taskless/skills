import { copyFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

import { addToGitignore } from "../filesystem/gitignore";
import type { RunEntry } from "../api/reconcile";
import { signRuleFile } from "./rule-hash";

/** A local rule file paired with its canonical signature. */
export interface SignedRuleFile {
  /** Delivered file name as it exists under `.taskless/rules/`. */
  file: string;
  /** Absolute path to the file on disk. */
  path: string;
  /** Canonical signature envelope for the file's bytes. */
  signature: string;
}

/** Directory (relative to `.taskless/`) holding the materialized run set. */
export const RUN_RULES_DIR = ".run/rules";

/** Sign each rule file, returning its delivered name, path, and signature. */
export async function signRuleFiles(
  cwd: string,
  fileNames: string[]
): Promise<SignedRuleFile[]> {
  const rulesDirectory = join(cwd, ".taskless", "rules");
  return Promise.all(
    fileNames.map(async (file) => {
      const path = join(rulesDirectory, file);
      return { file, path, signature: await signRuleFile(path) };
    })
  );
}

/**
 * Resolve the server's `run` entries back to local files by signature
 * (content-based join, so a moved-but-unchanged file still resolves). Entries
 * whose signature is not held locally are dropped.
 */
export function selectRunFiles(
  signed: SignedRuleFile[],
  run: RunEntry[]
): SignedRuleFile[] {
  const bySignature = new Map(signed.map((s) => [s.signature, s]));
  const selected: SignedRuleFile[] = [];
  const seen = new Set<string>();
  for (const entry of run) {
    const match = bySignature.get(entry.signature);
    if (match && !seen.has(match.path)) {
      seen.add(match.path);
      selected.push(match);
    }
  }
  return selected;
}

/**
 * Materialize the blessed run set into a fresh, gitignored
 * `.taskless/.run/rules/` so ast-grep evaluates only those files. The directory
 * is rebuilt on every call to avoid stale rules leaking into a scan.
 */
export async function materializeRunDirectory(
  cwd: string,
  files: SignedRuleFile[]
): Promise<void> {
  const runRoot = join(cwd, ".taskless", ".run");
  const runRules = join(runRoot, "rules");
  await rm(runRoot, { recursive: true, force: true });
  await mkdir(runRules, { recursive: true });
  await Promise.all(files.map((f) => copyFile(f.path, join(runRules, f.file))));
  await addToGitignore(cwd, [".run/"]);
}
