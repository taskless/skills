import { spawn } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createInterface } from "node:readline";
import { join } from "node:path";

import { stringify } from "yaml";

import { buildPath, findSgBinary } from "../scan";
import type { Match } from "../../types/runtime-rule";
import type { LoadedCaptureRule, RuntimeRule } from "./discover";

/**
 * The subset of an ast-grep `--json=stream` match this harness reads. ast-grep
 * reports `range.start` 0-indexed; the harness normalizes to 1-indexed `Match`.
 */
interface AstGrepStreamMatch {
  text: string;
  file: string;
  ruleId: string;
  range: { start: { line: number; column: number } };
  metaVariables?: {
    single?: Record<string, { text?: string }>;
  };
}

/** Spawn `sg scan` with a temp config and stream stdout lines to `onLine`. */
function runSg(
  root: string,
  configPath: string,
  extraArguments: string[],
  paths: string[],
  onLine: (line: string) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const argv = [
      "scan",
      "--config",
      configPath,
      ...extraArguments,
      ...(paths.length > 0 ? ["--", ...paths] : []),
    ];
    const child = spawn(findSgBinary(), argv, {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, PATH: buildPath() },
    });
    const stderrChunks: string[] = [];
    const rl = createInterface({ input: child.stdout });
    rl.on("line", onLine);
    child.stderr.on("data", (chunk: Buffer) =>
      stderrChunks.push(chunk.toString())
    );
    child.on("error", reject);
    child.on("close", (code) => {
      // ast-grep exits 1 when matches are found — expected. >1 is a real failure.
      if (code !== null && code > 1) {
        reject(
          new Error(
            `ast-grep narrow failed (exit ${String(code)})${
              stderrChunks.length > 0 ? `: ${stderrChunks.join("").trim()}` : ""
            }`
          )
        );
        return;
      }
      resolve();
    });
  });
}

/** Write the given capture rules into `<directory>/rules/` and a config pointing at them. */
async function writeRuleConfig(
  directory: string,
  captureRules: LoadedCaptureRule[]
): Promise<string> {
  const rulesDirectory = join(directory, "rules");
  await mkdir(rulesDirectory, { recursive: true });
  await Promise.all(
    captureRules.map((c) =>
      writeFile(join(rulesDirectory, `${c.id}.yml`), stringify(c.rule))
    )
  );
  const configPath = join(directory, "sgconfig.yml");
  await writeFile(configPath, stringify({ ruleDirs: ["rules"] }));
  return configPath;
}

/**
 * Run a runtime rule's capture rules as the ast-grep narrow and return the
 * normalized matches. Anchor captures produce full matches with `captures`;
 * broad (`kind: program`) captures are path-only enumerators. `ruleId` is mapped
 * back to the stable model `name` surfaced as `match.rule`.
 */
export async function runNarrow(
  root: string,
  rule: RuntimeRule,
  paths: string[] = []
): Promise<Match[]> {
  const nameById = new Map(rule.captureRules.map((c) => [c.id, c.name]));
  const anchor = rule.captureRules.filter((c) => c.match !== "broad");
  const broad = rule.captureRules.filter((c) => c.match === "broad");

  const workDirectory = await mkdtemp(join(tmpdir(), "tskl-narrow-"));
  const matches: Match[] = [];
  try {
    if (anchor.length > 0) {
      const config = await writeRuleConfig(
        join(workDirectory, "anchor"),
        anchor
      );
      await runSg(root, config, ["--json=stream"], paths, (line) => {
        const trimmed = line.trim();
        if (trimmed === "") return;
        let parsed: AstGrepStreamMatch;
        try {
          parsed = JSON.parse(trimmed) as AstGrepStreamMatch;
        } catch {
          return; // non-JSON status line
        }
        const captures: Record<string, string> = {};
        for (const [key, value] of Object.entries(
          parsed.metaVariables?.single ?? {}
        )) {
          if (typeof value.text === "string") captures[key] = value.text;
        }
        matches.push({
          rule: nameById.get(parsed.ruleId) ?? parsed.ruleId,
          ruleId: parsed.ruleId,
          file: parsed.file,
          line: parsed.range.start.line + 1,
          column: parsed.range.start.column + 1,
          text: parsed.text,
          captures,
        });
      });
    }

    if (broad.length > 0) {
      const config = await writeRuleConfig(join(workDirectory, "broad"), broad);
      // A single ruleId can't be recovered from --files-with-matches; attribute
      // broad matches to the (usually sole) broad capture rule.
      const broadRule = broad[0]!;
      const seen = new Set<string>();
      await runSg(root, config, ["--files-with-matches"], paths, (line) => {
        const file = line.trim();
        if (file === "" || seen.has(file)) return;
        seen.add(file);
        matches.push({
          rule: broadRule.name,
          ruleId: broadRule.id,
          file,
          line: 1,
          column: 1,
          text: "",
          captures: {},
        });
      });
    }
  } finally {
    await rm(workDirectory, { recursive: true, force: true });
  }
  return matches;
}
