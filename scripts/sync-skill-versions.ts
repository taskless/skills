import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse, stringify } from "yaml";

const ROOT = resolve(import.meta.dirname, "..");
const CLI_PACKAGE_JSON = join(ROOT, "packages", "cli", "package.json");
const SKILLS_DIR = join(ROOT, "skills");
const ROOT_PACKAGE_JSON = join(ROOT, "package.json");
const PLUGIN_JSON = join(ROOT, ".claude-plugin", "plugin.json");

const FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;

// Read CLI version
const cliPackage = JSON.parse(readFileSync(CLI_PACKAGE_JSON, "utf8")) as {
  version: string;
};
const targetVersion = cliPackage.version;

console.log(`CLI version: ${targetVersion}`);

// Find all SKILL.md files
const skillDirectories = readdirSync(SKILLS_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

let updated = 0;
let skipped = 0;

for (const directory of skillDirectories) {
  const skillPath = join(SKILLS_DIR, directory, "SKILL.md");

  let raw: string;
  try {
    raw = readFileSync(skillPath, "utf8");
  } catch {
    continue;
  }

  const match = FRONTMATTER_REGEX.exec(raw);
  if (!match) {
    console.warn(`Warning: No frontmatter in ${skillPath}, skipping.`);
    continue;
  }

  const data = (parse(match[1] ?? "") ?? {}) as Record<string, unknown>;
  const body = match[2] ?? "";
  const metadata = (data.metadata ?? {}) as Record<string, string>;

  if (metadata.version === targetVersion) {
    skipped++;
    continue;
  }

  const oldVersion = metadata.version ?? "(none)";
  metadata.version = targetVersion;
  data.metadata = metadata;

  const newContent = `---\n${stringify(data, { lineWidth: 0 })}---\n${body}`;
  writeFileSync(skillPath, newContent, "utf8");
  updated++;
  console.log(`  ${directory}: ${oldVersion} → ${targetVersion}`);
}

// Update root package.json version
const rootPackageRaw = JSON.parse(
  readFileSync(ROOT_PACKAGE_JSON, "utf8")
) as Record<string, unknown>;
if (rootPackageRaw.version === targetVersion) {
  skipped++;
} else {
  const oldRootVersion =
    (rootPackageRaw.version as string | undefined) ?? "(none)";
  rootPackageRaw.version = targetVersion;
  writeFileSync(
    ROOT_PACKAGE_JSON,
    JSON.stringify(rootPackageRaw, null, 2) + "\n",
    "utf8"
  );
  console.log(`  package.json: ${oldRootVersion} → ${targetVersion}`);
  updated++;
}

// Update plugin.json version
const pluginRaw = JSON.parse(readFileSync(PLUGIN_JSON, "utf8")) as Record<
  string,
  unknown
>;
if (pluginRaw.version === targetVersion) {
  skipped++;
} else {
  const oldPluginVersion =
    (pluginRaw.version as string | undefined) ?? "(none)";
  pluginRaw.version = targetVersion;
  writeFileSync(PLUGIN_JSON, JSON.stringify(pluginRaw, null, 2) + "\n", "utf8");
  console.log(`  plugin.json: ${oldPluginVersion} → ${targetVersion}`);
  updated++;
}

if (updated === 0) {
  console.log(`\nAll ${String(skipped)} file(s) already at ${targetVersion}.`);
} else {
  console.log(
    `\nUpdated ${String(updated)} file(s), ${String(skipped)} already current.`
  );
}
