import { builtinModules } from "node:module";
import { chmodSync, readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { parse } from "yaml";
import type { Plugin } from "vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

import { SKILL_CATALOG } from "./src/install/catalog";

const pkg = JSON.parse(
  readFileSync(resolve(import.meta.dirname, "package.json"), "utf8")
) as { version: string };

const FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;

function assertSkillVersions(): Plugin {
  return {
    name: "assert-skill-versions",
    buildStart() {
      const skillsDir = resolve(import.meta.dirname, "../../skills");
      const dirs = readdirSync(skillsDir, { withFileTypes: true }).filter((d) =>
        d.isDirectory()
      );
      const mismatched: string[] = [];
      const sourceNames = new Set<string>();

      for (const dir of dirs) {
        sourceNames.add(dir.name);
        const skillPath = join(skillsDir, dir.name, "SKILL.md");
        let content: string;
        try {
          content = readFileSync(skillPath, "utf8");
        } catch {
          continue;
        }
        const match = FRONTMATTER_REGEX.exec(content);
        if (!match) continue;
        const data = (parse(match[1] ?? "") ?? {}) as Record<string, unknown>;
        const metadata = (data.metadata ?? {}) as Record<string, string>;
        if (metadata.version !== pkg.version) {
          mismatched.push(
            `${dir.name}: ${metadata.version ?? "(none)"} (expected ${pkg.version})`
          );
        }
      }

      if (mismatched.length > 0) {
        throw new Error(
          `Skill version mismatch! Run "tsx scripts/sync-skill-versions.ts" to fix.\n${mismatched.join("\n")}`
        );
      }

      const catalogNames = new Set(SKILL_CATALOG.map((s) => s.name));
      const missingFromCatalog = [...sourceNames].filter(
        (n) => !catalogNames.has(n)
      );
      const missingFromSource = [...catalogNames].filter(
        (n) => !sourceNames.has(n)
      );

      if (missingFromCatalog.length > 0 || missingFromSource.length > 0) {
        const lines: string[] = [];
        if (missingFromCatalog.length > 0) {
          lines.push(
            `Skills present under skills/ but missing from SKILL_CATALOG in src/install/catalog.ts:`
          );
          for (const name of missingFromCatalog) lines.push(`  - ${name}`);
        }
        if (missingFromSource.length > 0) {
          lines.push(
            `Skills declared in SKILL_CATALOG but missing a source directory under skills/:`
          );
          for (const name of missingFromSource) lines.push(`  - ${name}`);
        }
        throw new Error(lines.join("\n"));
      }
    },
  };
}

function shebang(): Plugin {
  return {
    name: "shebang",
    generateBundle(_options, bundle) {
      for (const chunk of Object.values(bundle)) {
        if (chunk.type === "chunk" && chunk.isEntry) {
          chunk.code = "#!/usr/bin/env node\n" + chunk.code;
        }
      }
    },
    writeBundle(options, bundle) {
      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (chunk.type === "chunk" && chunk.isEntry) {
          const outPath = resolve(options.dir ?? "dist", fileName);
          chmodSync(outPath, 0o755);
        }
      }
    },
  };
}

export default defineConfig({
  define: {
    __VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [tsconfigPaths(), assertSkillVersions(), shebang()],
  build: {
    lib: {
      entry: resolve(import.meta.dirname, "src/index.ts"),
      formats: ["es"],
      fileName: "index",
    },
    rollupOptions: {
      external: [/^node:/, ...builtinModules],
    },
  },
});
