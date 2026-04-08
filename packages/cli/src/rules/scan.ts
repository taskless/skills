import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

import type { AstGrepMatch } from "../types/check";
import { toCheckResult, type CheckResult } from "../types/check";

interface ScanResult {
  results: CheckResult[];
  exitCode: number;
}

/** Build PATH that includes this package's node_modules/.bin */
export function buildPath(): string {
  const thisDirectory = dirname(fileURLToPath(import.meta.url));
  const binDirectory = resolve(thisDirectory, "..", "node_modules", ".bin");
  const separator = process.platform === "win32" ? ";" : ":";
  return `${binDirectory}${separator}${process.env.PATH ?? ""}`;
}

/**
 * Resolve the ast-grep binary path.
 *
 * The @ast-grep/cli package relies on a postinstall script that uses
 * require.resolve() to find platform-specific binary packages and hardlink
 * them into place. Under pnpm dlx, the strict dependency isolation can
 * prevent that resolution from working, leaving a placeholder text file
 * instead of the real binary.
 *
 * To work around this, we resolve the platform-specific package ourselves
 * (from our own module context where optionalDependencies are accessible)
 * and return the full path to the binary. Falls back to "sg" via PATH
 * for environments where the normal .bin shim works fine.
 */
export function findSgBinary(): string {
  const parts: string[] = [process.platform, process.arch];
  if (process.platform === "linux") {
    parts.push("gnu");
  } else if (process.platform === "win32") {
    parts.push("msvc");
  }

  const platformPackage = `@ast-grep/cli-${parts.join("-")}`;
  const binary = process.platform === "win32" ? "ast-grep.exe" : "ast-grep";

  try {
    const require = createRequire(import.meta.url);
    const packageJsonPath = require.resolve(`${platformPackage}/package.json`);
    const binaryPath = resolve(dirname(packageJsonPath), binary);
    if (existsSync(binaryPath)) {
      return binaryPath;
    }
  } catch {
    // Platform package not resolvable — fall through to PATH-based lookup
  }

  return "sg";
}

/** Run ast-grep scan and return parsed results */
export async function runAstGrepScan(cwd: string): Promise<ScanResult> {
  return new Promise((resolve, reject) => {
    const sgBinary = findSgBinary();
    const child = spawn(
      sgBinary,
      ["scan", "--config", ".taskless/sgconfig.yml", "--json=stream"],
      {
        cwd,
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, PATH: buildPath() },
      }
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
        reject(
          new Error(
            "ast-grep (sg) binary not found. Is @ast-grep/cli installed?"
          )
        );
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
            `ast-grep scan failed with exit code ${String(code)}${stderr ? `: ${stderr.trim()}` : ""}`
          )
        );
        return;
      }
      resolve({ results, exitCode: code ?? 0 });
    });
  });
}
