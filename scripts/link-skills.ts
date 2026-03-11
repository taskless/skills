import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readlinkSync,
  symlinkSync,
} from "node:fs";
import { relative, resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");

const links: Array<{ source: string; destination: string }> = [
  {
    source: resolve(repoRoot, "skills"),
    destination: resolve(repoRoot, ".claude/skills"),
  },
  {
    source: resolve(repoRoot, "commands"),
    destination: resolve(repoRoot, ".claude/commands"),
  },
];

for (const { source, destination } of links) {
  if (!existsSync(source)) {
    console.error(`Error: source directory not found at ${source}`);
    // eslint-disable-next-line unicorn/no-process-exit
    process.exit(1);
  }

  mkdirSync(destination, { recursive: true });

  for (const entry of readdirSync(source, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;

    const name = entry.name;
    const entrySource = resolve(source, name);
    const relativeSource = relative(destination, entrySource);
    const target = resolve(destination, name);

    if (lstatSync(target, { throwIfNoEntry: false })?.isSymbolicLink()) {
      const existing = readlinkSync(target);
      if (
        resolve(destination, existing) === entrySource ||
        existing === entrySource
      ) {
        console.log(`ok: ${name} (already linked)`);
      } else {
        console.error(
          `CONFLICT: ${name} -> symlink exists pointing to ${existing} (expected ${relativeSource})`
        );
        // eslint-disable-next-line unicorn/no-process-exit
        process.exit(1);
      }
    } else if (existsSync(target)) {
      console.error(
        `CONFLICT: ${name} -> ${target} already exists and is not a symlink`
      );
      // eslint-disable-next-line unicorn/no-process-exit
      process.exit(1);
    } else {
      symlinkSync(relativeSource, target);
      console.log(`linked: ${name} -> ${relativeSource}`);
    }
  }
}
