import { writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(
  __dirname,
  "..",
  "test",
  "fixtures",
  "rule-hash.vectors.json"
);

/**
 * Serialize as pure ASCII: every non-ASCII code unit becomes a `\uXXXX` escape
 * so the committed fixture matches the cross-repo source-of-truth format and
 * stays byte-stable in git regardless of the platform's console encoding.
 * Iterating code units (not code points) makes a surrogate pair escape as two
 * `\uXXXX`, exactly like the reference file.
 */
function toAsciiJson(value: unknown): string {
  const json = JSON.stringify(value, null, 2);
  let out = "";
  for (let index = 0; index < json.length; index++) {
    // eslint-disable-next-line unicorn/prefer-code-point -- need per-UTF-16-unit escaping so surrogate pairs become two \uXXXX
    const code = json.charCodeAt(index);
    out +=
      code > 0x7f
        ? String.raw`\u` + code.toString(16).padStart(4, "0")
        : json[index];
  }
  return out + "\n";
}

// Resolve the API origin the same way the runtime client does: honor
// TASKLESS_API_URL, else the production default. The vectors endpoint is
// unauthenticated and lives under /cli/api/.
const baseUrl = (
  process.env.TASKLESS_API_URL ?? "https://app.taskless.io/cli"
).replace(/\/cli\/?$/, "");
const sourceUrl = `${baseUrl}/cli/api/rule-hash-vectors`;

console.log(`Fetching rule-hash conformance vectors...`);
console.log(`  URL: ${sourceUrl}`);

/**
 * Refresh is best-effort: always try the network, but fall back to the
 * committed cache when the endpoint is unreachable or unhealthy so offline and
 * CI-without-network builds still succeed. Only a missing cache is fatal.
 */
function fallBackToCache(reason: string): never | void {
  if (existsSync(OUTPUT_PATH)) {
    console.warn(`  ${reason}`);
    console.warn(`  Falling back to committed vectors cache.`);
    return;
  }
  throw new Error(`${reason} and no committed vectors cache exists.`);
}

let response: Response | undefined;
try {
  response = await fetch(sourceUrl);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  fallBackToCache(`Could not reach the vectors endpoint (${message})`);
}

if (response?.ok) {
  // The endpoint wraps the source-of-truth array as { vectors: [...] }; the
  // committed cache stores the bare array to match the server reference file.
  const body = (await response.json()) as {
    vectors?: { name: string; input: string; signature: string }[];
  };
  if (Array.isArray(body.vectors) && body.vectors.length > 0) {
    writeFileSync(OUTPUT_PATH, toAsciiJson(body.vectors), "utf8");
    console.log(
      `  Wrote ${String(body.vectors.length)} vectors to: ${OUTPUT_PATH}`
    );
  } else {
    fallBackToCache(`Response did not contain a non-empty "vectors" array`);
  }
} else if (response) {
  fallBackToCache(`HTTP ${String(response.status)} fetching ${sourceUrl}`);
}
