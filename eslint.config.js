import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import unicorn from "eslint-plugin-unicorn";
import prettierConfig from "eslint-config-prettier";

export default tseslint.config(
  {
    ignores: [
      "node_modules/",
      "**/dist/",
      "**/*.config.js",
      "**/*.config.ts",
      ".lintstagedrc.js",
      "plugins/",
      "openspec/",
      "**/test/fixtures/",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  unicorn.configs["flat/recommended"],
  prettierConfig,
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  // Ban /// <reference /> directives in source files — use `import type` instead.
  // Excludes .d.ts files where triple-slash references are the idiomatic pattern.
  {
    files: ["**/*.ts", "**/*.tsx"],
    ignores: ["**/*.d.ts"],
    rules: {
      "@typescript-eslint/triple-slash-reference": [
        "error",
        { path: "never", types: "never", lib: "never" },
      ],
    },
  },
  // TypeScript-specific rules
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      // Allow unused parameters prefixed with underscore
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "unicorn/prevent-abbreviations": [
        "error",
        {
          allowList: {
            env: true,
            args: true,
            utils: true,
          },
        },
      ],
    },
  },
  // File naming conventions - enforce kebab-case for all TS/TSX files
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "unicorn/filename-case": [
        "error",
        {
          case: "kebabCase",
        },
      ],
      // Disable forced numeric separators - 5000 is more readable than 5_000
      "unicorn/numeric-separators-style": "off",
      // Allow null - needed for standard APIs like JSON.stringify
      "unicorn/no-null": "off",
      // Allow destructured imports for node:path module (e.g., import { resolve } from 'node:path')
      "unicorn/import-style": [
        "error",
        {
          styles: {
            "node:path": {
              default: false, // Don't enforce default import, allow named imports
            },
          },
        },
      ],
    },
  }
);
