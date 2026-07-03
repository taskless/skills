import { execFile } from "node:child_process";
import { createServer, type Server } from "node:http";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const binPath = resolve(import.meta.dirname, "../dist/index.js");

interface ReportedFile {
  file: string;
  signature: string;
}
interface ReconcileRequestBody {
  repositoryUrl: string;
  files: ReportedFile[];
}
interface MockResponse {
  statusCode: number;
  body?: unknown;
}
type Responder = (request: ReconcileRequestBody) => MockResponse;

interface MockServer {
  apiUrl: string;
  requests: ReconcileRequestBody[];
  close: () => Promise<void>;
}

/** Start a mock reconcile endpoint on a random port. */
function startMockServer(responder: Responder): Promise<MockServer> {
  const requests: ReconcileRequestBody[] = [];
  const server: Server = createServer((request, response) => {
    if (request.method !== "POST" || request.url !== "/cli/api/reconcile") {
      response.writeHead(404).end("{}");
      return;
    }
    let raw = "";
    request.on("data", (chunk: Buffer) => (raw += chunk.toString()));
    request.on("end", () => {
      const parsed = JSON.parse(raw) as ReconcileRequestBody;
      requests.push(parsed);
      const { statusCode, body } = responder(parsed);
      response.writeHead(statusCode, { "content-type": "application/json" });
      response.end(JSON.stringify(body ?? {}));
    });
  });
  return new Promise((resolvePromise) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      resolvePromise({
        apiUrl: `http://127.0.0.1:${String(port)}/cli`,
        requests,
        close: () =>
          new Promise((done) => {
            server.close(() => done());
          }),
      });
    });
  });
}

/** Look up a reported file's signature so the mock can echo it back. */
function sig(request: ReconcileRequestBody, file: string): string {
  return request.files.find((f) => f.file === file)?.signature ?? "";
}

async function runCli(
  args: string[],
  env: Record<string, string> = {}
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const { stdout, stderr } = await execFileAsync("node", [binPath, ...args], {
      env: { ...process.env, ...env },
    });
    return { stdout, stderr, exitCode: 0 };
  } catch (error) {
    const execError = error as { stdout: string; stderr: string; code: number };
    return {
      stdout: execError.stdout ?? "",
      stderr: execError.stderr ?? "",
      exitCode: execError.code,
    };
  }
}

const RULE_NO_EVAL = [
  "id: no-eval",
  "language: javascript",
  "severity: error",
  "rule:",
  "  pattern: eval($$$)",
  "message: Avoid eval",
].join("\n");

const RULE_NO_CONSOLE = [
  "id: no-console",
  "language: javascript",
  "severity: error",
  "rule:",
  "  pattern: console.log($$$)",
  "message: Avoid console.log",
].join("\n");

describe("check reconciliation", () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "taskless-reconcile-"));
    const rules = join(directory, ".taskless", "rules");
    await mkdir(rules, { recursive: true });
    await writeFile(join(rules, "no-eval.yml"), RULE_NO_EVAL, "utf8");
    await writeFile(join(rules, "no-console.yml"), RULE_NO_CONSOLE, "utf8");
    await writeFile(
      join(directory, "app.js"),
      'eval("x");\nconsole.log("y");\n',
      "utf8"
    );
    // A GitHub origin is required for reconciliation to run.
    await execFileAsync("git", ["init"], { cwd: directory });
    await execFileAsync(
      "git",
      ["remote", "add", "origin", "https://github.com/acme/widgets.git"],
      { cwd: directory }
    );
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it("runs ONLY the blessed run set, excluding non-run rules", async () => {
    const server = await startMockServer((request) => ({
      statusCode: 200,
      body: {
        run: [
          {
            ruleId: "no-eval",
            file: "no-eval.yml",
            signature: sig(request, "no-eval.yml"),
          },
        ],
        unsafe: [],
        unknown: [],
        missing: [],
      },
    }));
    try {
      const { stdout, exitCode } = await runCli(
        ["check", "-d", directory, "--json"],
        { TASKLESS_TOKEN: "fake.token.value", TASKLESS_API_URL: server.apiUrl }
      );
      expect(server.requests).toHaveLength(1);
      expect(exitCode).toBe(1); // no-eval is an error and matches
      const parsed = JSON.parse(stdout.trim()) as {
        results: { ruleId: string }[];
      };
      const ruleIds = new Set(parsed.results.map((r) => r.ruleId));
      expect(ruleIds.has("no-eval")).toBe(true);
      expect(ruleIds.has("no-console")).toBe(false); // not in run set
    } finally {
      await server.close();
    }
  });

  it("warns on unsafe/unknown/missing and exits 0 on an empty run set", async () => {
    const server = await startMockServer((request) => ({
      statusCode: 200,
      body: {
        run: [],
        unsafe: [
          {
            file: "no-console.yml",
            expected: "1;h=sha-256;d=" + "0".repeat(64),
            got: sig(request, "no-console.yml"),
          },
        ],
        unknown: [{ file: "no-eval.yml" }],
        missing: [{ ruleId: "no-var", file: "no-var-abc.yml" }],
      },
    }));
    try {
      const { stdout, stderr, exitCode } = await runCli(
        ["check", "-d", directory],
        {
          TASKLESS_TOKEN: "fake.token.value",
          TASKLESS_API_URL: server.apiUrl,
        }
      );
      expect(exitCode).toBe(0); // empty run set → nothing scanned
      expect(stdout).toContain("No issues found");
      expect(stderr).toContain("no-console.yml"); // unsafe drift
      expect(stderr).toContain("no-eval.yml"); // unknown
      expect(stderr).toContain("no-var"); // missing
    } finally {
      await server.close();
    }
  });

  it("suppresses mismatch warnings under --json", async () => {
    const server = await startMockServer((request) => ({
      statusCode: 200,
      body: {
        run: [],
        unsafe: [
          {
            file: "no-console.yml",
            expected: "1;h=sha-256;d=" + "0".repeat(64),
            got: sig(request, "no-console.yml"),
          },
        ],
        unknown: [],
        missing: [],
      },
    }));
    try {
      const { stdout, stderr, exitCode } = await runCli(
        ["check", "-d", directory, "--json"],
        { TASKLESS_TOKEN: "fake.token.value", TASKLESS_API_URL: server.apiUrl }
      );
      expect(exitCode).toBe(0);
      expect(stderr).not.toContain("tamper");
      expect(stderr).not.toContain("no-console.yml");
      const parsed = JSON.parse(stdout.trim()) as {
        success: boolean;
        results: unknown[];
      };
      expect(parsed).toEqual({ success: true, results: [] });
    } finally {
      await server.close();
    }
  });

  it("degrades to a local scan when reconciliation is unavailable", async () => {
    const server = await startMockServer(() => ({ statusCode: 503 }));
    try {
      const { stdout, stderr, exitCode } = await runCli(
        ["check", "-d", directory],
        {
          TASKLESS_TOKEN: "fake.token.value",
          TASKLESS_API_URL: server.apiUrl,
        }
      );
      expect(server.requests).toHaveLength(1);
      expect(exitCode).toBe(1); // fell back to a full local scan; no-eval matches
      expect(stdout).toContain("no-eval");
      expect(stdout).toContain("no-console"); // ALL local rules ran
      expect(stderr).toContain("Scanning all local rules unverified");
    } finally {
      await server.close();
    }
  });

  it("does not warn under --json when degrading", async () => {
    const server = await startMockServer(() => ({ statusCode: 503 }));
    try {
      const { stdout, stderr } = await runCli(
        ["check", "-d", directory, "--json"],
        {
          TASKLESS_TOKEN: "fake.token.value",
          TASKLESS_API_URL: server.apiUrl,
        }
      );
      expect(stderr).not.toContain("Scanning all local rules unverified");
      const parsed = JSON.parse(stdout.trim()) as { results: unknown[] };
      expect(parsed.results.length).toBeGreaterThan(0);
    } finally {
      await server.close();
    }
  });

  it("scans all local rules silently when logged out (no reconcile)", async () => {
    const server = await startMockServer(() => ({ statusCode: 200, body: {} }));
    try {
      const { stdout, stderr, exitCode } = await runCli(
        ["check", "-d", directory],
        {
          TASKLESS_TOKEN: "",
          TASKLESS_API_URL: server.apiUrl,
        }
      );
      expect(server.requests).toHaveLength(0); // never reconciled
      expect(exitCode).toBe(1);
      expect(stdout).toContain("no-eval");
      expect(stdout).toContain("no-console");
      expect(stderr).not.toContain("unverified");
    } finally {
      await server.close();
    }
  });

  it("forces the logged-out path under --anonymous even with a token", async () => {
    const server = await startMockServer(() => ({ statusCode: 200, body: {} }));
    try {
      const { stdout, exitCode } = await runCli(
        ["check", "-d", directory, "--anonymous"],
        { TASKLESS_TOKEN: "fake.token.value", TASKLESS_API_URL: server.apiUrl }
      );
      expect(server.requests).toHaveLength(0); // --anonymous skips reconcile
      expect(exitCode).toBe(1);
      expect(stdout).toContain("no-eval");
      expect(stdout).toContain("no-console");
    } finally {
      await server.close();
    }
  });
});
