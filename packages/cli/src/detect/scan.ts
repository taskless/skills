import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export interface DetectedLinter {
  name: string;
  configFiles: string[];
}

export interface RuleStyle {
  source: string;
  description: string;
}

export interface DetectResult {
  linters: DetectedLinter[];
  languages: string[];
  frameworks: string[];
  ruleStyles: RuleStyle[];
}

/**
 * A linter is evidenced by any of:
 * - a fixed config filename present on disk
 * - a `[tool.<x>]` table in pyproject.toml
 * - a dependency name in package.json (dev/prod/peer)
 *
 * The list is curated to well-known tools. New entries are deterministic
 * signal additions, not inference — detect never matches a request against a
 * catalog of packaged rules; that judgment lives in the `existing` recipe.
 */
interface LinterSignal {
  name: string;
  configFiles?: string[];
  pyprojectTables?: string[];
  packageDeps?: string[];
}

const LINTER_SIGNALS: readonly LinterSignal[] = [
  {
    name: "eslint",
    configFiles: [
      ".eslintrc",
      ".eslintrc.js",
      ".eslintrc.cjs",
      ".eslintrc.mjs",
      ".eslintrc.json",
      ".eslintrc.yml",
      ".eslintrc.yaml",
      "eslint.config.js",
      "eslint.config.mjs",
      "eslint.config.cjs",
      "eslint.config.ts",
    ],
    packageDeps: ["eslint"],
  },
  {
    name: "biome",
    configFiles: ["biome.json", "biome.jsonc"],
    packageDeps: ["@biomejs/biome"],
  },
  {
    name: "stylelint",
    configFiles: [
      ".stylelintrc",
      ".stylelintrc.js",
      ".stylelintrc.cjs",
      ".stylelintrc.json",
      ".stylelintrc.yml",
      ".stylelintrc.yaml",
      "stylelint.config.js",
      "stylelint.config.cjs",
      "stylelint.config.mjs",
    ],
    packageDeps: ["stylelint"],
  },
  {
    name: "prettier",
    configFiles: [
      ".prettierrc",
      ".prettierrc.js",
      ".prettierrc.cjs",
      ".prettierrc.json",
      ".prettierrc.yml",
      ".prettierrc.yaml",
      "prettier.config.js",
      "prettier.config.cjs",
      "prettier.config.mjs",
    ],
    packageDeps: ["prettier"],
  },
  {
    name: "ruff",
    configFiles: ["ruff.toml", ".ruff.toml"],
    pyprojectTables: ["ruff"],
  },
  { name: "flake8", configFiles: [".flake8"] },
  {
    name: "pylint",
    configFiles: [".pylintrc", "pylintrc"],
    pyprojectTables: ["pylint"],
  },
  { name: "black", pyprojectTables: ["black"] },
  { name: "rubocop", configFiles: [".rubocop.yml", ".rubocop.yaml"] },
  { name: "clang-tidy", configFiles: [".clang-tidy"] },
  { name: "swiftlint", configFiles: [".swiftlint.yml", ".swiftlint.yaml"] },
  { name: "checkstyle", configFiles: ["checkstyle.xml"] },
];

/** Languages inferred from the presence of a manifest or marker file. */
const LANGUAGE_MARKERS: ReadonlyArray<{ language: string; files: string[] }> = [
  {
    language: "Python",
    files: [
      "pyproject.toml",
      "requirements.txt",
      "setup.cfg",
      "setup.py",
      "Pipfile",
    ],
  },
  { language: "Ruby", files: ["Gemfile"] },
  { language: "Go", files: ["go.mod"] },
  { language: "Rust", files: ["Cargo.toml"] },
  { language: "PHP", files: ["composer.json"] },
  { language: "Java", files: ["pom.xml", "build.gradle", "build.gradle.kts"] },
  { language: "Swift", files: ["Package.swift"] },
];

/** Frameworks inferred from a package.json dependency name. */
const JS_FRAMEWORK_DEPS: ReadonlyArray<{ framework: string; dep: string }> = [
  { framework: "Next.js", dep: "next" },
  { framework: "React", dep: "react" },
  { framework: "Vue", dep: "vue" },
  { framework: "Nuxt", dep: "nuxt" },
  { framework: "Svelte", dep: "svelte" },
  { framework: "Angular", dep: "@angular/core" },
  { framework: "Express", dep: "express" },
  { framework: "Fastify", dep: "fastify" },
  { framework: "NestJS", dep: "@nestjs/core" },
];

/** Frameworks inferred from a Python dependency token. */
const PY_FRAMEWORK_TOKENS: ReadonlyArray<{ framework: string; token: string }> =
  [
    { framework: "Django", token: "django" },
    { framework: "Flask", token: "flask" },
    { framework: "FastAPI", token: "fastapi" },
  ];

async function readFileSafe(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return undefined;
  }
}

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  eslintConfig?: unknown;
}

/** Collect all declared dependency names from a parsed package.json. */
function allDependencyNames(packageJson: PackageJson): Set<string> {
  return new Set([
    ...Object.keys(packageJson.dependencies ?? {}),
    ...Object.keys(packageJson.devDependencies ?? {}),
    ...Object.keys(packageJson.peerDependencies ?? {}),
  ]);
}

/**
 * Deterministically scan `cwd` for linter configs, languages/frameworks, and
 * the repo's own rule styles. Pure filesystem reads — no network, no auth, no
 * LLM. Unreadable or malformed files are skipped rather than failing the scan.
 */
export async function detectRepository(cwd: string): Promise<DetectResult> {
  const root = resolve(cwd);
  const has = (name: string): boolean => existsSync(resolve(root, name));

  const packageRaw = await readFileSafe(resolve(root, "package.json"));
  let packageJson: PackageJson | undefined;
  if (packageRaw) {
    try {
      packageJson = JSON.parse(packageRaw) as PackageJson;
    } catch {
      packageJson = undefined;
    }
  }
  const deps = packageJson
    ? allDependencyNames(packageJson)
    : new Set<string>();

  const pyproject = (await readFileSafe(resolve(root, "pyproject.toml"))) ?? "";

  // Linters
  const linters: DetectedLinter[] = [];
  for (const signal of LINTER_SIGNALS) {
    const evidence: string[] = [];
    for (const file of signal.configFiles ?? []) {
      if (has(file)) evidence.push(file);
    }
    for (const table of signal.pyprojectTables ?? []) {
      if (pyproject.includes(`[tool.${table}`))
        evidence.push(`pyproject.toml [tool.${table}]`);
    }
    for (const dep of signal.packageDeps ?? []) {
      if (deps.has(dep)) evidence.push(`package.json (${dep})`);
    }
    // eslintConfig key in package.json is an additional eslint signal
    if (signal.name === "eslint" && packageJson?.eslintConfig !== undefined) {
      evidence.push("package.json (eslintConfig)");
    }
    if (evidence.length > 0) {
      linters.push({ name: signal.name, configFiles: evidence });
    }
  }

  // Languages
  const languages: string[] = [];
  if (packageJson || has("tsconfig.json")) languages.push("JavaScript");
  if (has("tsconfig.json") || deps.has("typescript"))
    languages.push("TypeScript");
  for (const marker of LANGUAGE_MARKERS) {
    if (marker.files.some((f) => has(f))) languages.push(marker.language);
  }

  // Frameworks
  const frameworks: string[] = [];
  for (const { framework, dep } of JS_FRAMEWORK_DEPS) {
    if (deps.has(dep)) frameworks.push(framework);
  }
  const pyText = (
    pyproject +
    "\n" +
    ((await readFileSafe(resolve(root, "requirements.txt"))) ?? "")
  ).toLowerCase();
  for (const { framework, token } of PY_FRAMEWORK_TOKENS) {
    if (pyText.includes(token)) frameworks.push(framework);
  }

  // Rule styles
  const ruleStyles: RuleStyle[] = [];
  if (existsSync(resolve(root, ".taskless", "rules"))) {
    ruleStyles.push({
      source: ".taskless/rules",
      description:
        "Existing Taskless ast-grep rules — match their structure and conventions.",
    });
  }
  for (const directory of [
    "eslint-rules",
    "eslint-local-rules",
    "tools/eslint-rules",
  ]) {
    if (existsSync(resolve(root, directory))) {
      ruleStyles.push({
        source: directory,
        description:
          "Custom ESLint rules — follow the house style when authoring new ones.",
      });
    }
  }
  if (deps.has("eslint-plugin-local") || deps.has("eslint-local-rules")) {
    ruleStyles.push({
      source: "package.json",
      description:
        "Local ESLint rule plugin in use — author new rules to match it.",
    });
  }

  return { linters, languages, frameworks, ruleStyles };
}
