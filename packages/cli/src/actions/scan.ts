import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

import type { AstGrepMatch } from "../types/check";
import { toCheckResult, type CheckResult } from "../types/check";

export interface ScanResult {
  results: CheckResult[];
  exitCode: number;
}

/** Build PATH that includes this package's node_modules/.bin */
function buildPath(): string {
  const thisDirectory = dirname(fileURLToPath(import.meta.url));
  const binDirectory = resolve(thisDirectory, "..", "node_modules", ".bin");
  const separator = process.platform === "win32" ? ";" : ":";
  return `${binDirectory}${separator}${process.env.PATH ?? ""}`;
}

/** Run ast-grep scan and return parsed results */
export async function runAstGrepScan(cwd: string): Promise<ScanResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "sg",
      ["scan", "--config", ".taskless/sgconfig.yml", "--json=stream"],
      {
        shell: true,
        cwd,
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, PATH: buildPath() },
      },
    );

    const results: CheckResult[] = [];
    const stderrChunks: string[] = [];

    const rl = createInterface({ input: child.stdout });
    rl.on("line", (line) => {
      const trimmed = line.trim();
      if (trimmed === "") return;
      try {
        const match = JSON.parse(trimmed) as AstGrepMatch;
        results.push(toCheckResult(match));
      } catch {
        // Skip non-JSON lines (e.g. ast-grep status messages)
      }
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderrChunks.push(chunk.toString());
    });

    child.on("error", (error) => {
      if ("code" in error && error.code === "ENOENT") {
        reject(new Error("ast-grep (sg) binary not found. Is @ast-grep/cli installed?"));
      } else {
        reject(error);
      }
    });

    child.on("close", (code) => {
      // ast-grep exits 1 when error-severity matches found — that's expected
      // Only treat spawn/binary failures (exit > 1) as errors
      if (code !== null && code > 1) {
        const stderr = stderrChunks.join("");
        reject(
          new Error(
            `ast-grep scan failed with exit code ${String(code)}${stderr ? `: ${stderr.trim()}` : ""}`,
          ),
        );
        return;
      }
      resolve({ results, exitCode: code ?? 0 });
    });
  });
}
