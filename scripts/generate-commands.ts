import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { parse, stringify } from "yaml";

const ROOT = resolve(import.meta.dirname, "..");
const SKILLS_DIR = join(ROOT, "skills");
const COMMANDS_DIR = join(ROOT, "commands");
const PREFIX = "taskless-";

interface Frontmatter {
  data: Record<string, unknown>;
  content: string;
}

const FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;

function parseFrontmatter(source: string): Frontmatter {
  const match = FRONTMATTER_REGEX.exec(source);
  if (!match) return { data: {}, content: source };
  return {
    data: (parse(match[1] ?? "") ?? {}) as Record<string, unknown>,
    content: match[2] ?? "",
  };
}

function stringifyFrontmatter(
  body: string,
  data: Record<string, unknown>
): string {
  return `---\n${stringify(data, { lineWidth: 0 })}---\n${body}`;
}

function titleCase(value: string): string {
  return value
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// Read all skill directories
const skillDirectories = readdirSync(SKILLS_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name.startsWith(PREFIX))
  .map((d) => d.name);

if (skillDirectories.length === 0) {
  console.log("No skills found.");
  throw new Error("No skills found matching prefix");
}

// Clean commands directory (remove generated subdirectories)
rmSync(join(COMMANDS_DIR, "taskless"), { recursive: true, force: true });

let generated = 0;

for (const directory of skillDirectories) {
  const skillPath = join(SKILLS_DIR, directory, "SKILL.md");

  let raw: string;
  try {
    raw = readFileSync(skillPath, "utf8");
  } catch {
    console.warn(`Warning: Could not read ${skillPath}, skipping.`);
    continue;
  }

  const parsed = parseFrontmatter(raw);
  const data = parsed.data as {
    name?: string;
    description?: string;
    metadata?: Record<string, string>;
  };

  const commandName = data.metadata?.commandName;

  // Skip skills without a command (commandName is "-" or missing)
  if (!commandName || commandName === "-") {
    console.log(`  ${directory}: skipped (no command)`);
    continue;
  }

  // commandName is "namespace:name" (e.g. "taskless:info") → commands/taskless/info.md
  const parts = commandName.split(":");
  const displayName = parts.at(-1) ?? commandName;
  const commandPath = join(
    COMMANDS_DIR,
    ...parts.slice(0, -1),
    `${displayName}.md`
  );

  // Build command frontmatter
  const commandData: Record<string, unknown> = {
    name: `Taskless: ${titleCase(displayName)}`,
    description: data.description ?? "",
    category: "Taskless",
    tags: ["taskless"],
  };

  if (data.metadata) {
    commandData.metadata = data.metadata;
  }

  const commandContent = stringifyFrontmatter(parsed.content, commandData);
  mkdirSync(join(COMMANDS_DIR, ...parts.slice(0, -1)), { recursive: true });
  writeFileSync(commandPath, commandContent, "utf8");
  generated++;
  console.log(`  ${commandPath}`);
}

console.log(`\nGenerated ${String(generated)} command(s).`);
