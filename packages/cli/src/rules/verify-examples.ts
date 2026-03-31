/**
 * Curated annotated examples for `rules verify --schema` output.
 * These teach agents how to write valid ast-grep rules.
 */
export const RULE_EXAMPLES = [
  {
    description:
      "Simple pattern match — detect eval() usage. Uses `any` to match multiple call forms. `$$$` is the wildcard for any number of arguments.",
    rule: {
      id: "no-eval",
      language: "typescript",
      severity: "error",
      message: "Do not use eval() or Function() to evaluate strings as code.",
      note: "Use safer alternatives like JSON.parse() for data.",
      rule: {
        any: [
          { pattern: "eval($$$)" },
          { pattern: "Function($$$)" },
          { pattern: "new Function($$$)" },
        ],
      },
    },
  },
  {
    description:
      "Regex with required kind — detect console.log calls. When using `regex`, you MUST also specify `kind` at the same level. `kind` constrains which AST node type the regex applies to.",
    rule: {
      id: "no-console-log",
      language: "typescript",
      severity: "warning",
      message: "Avoid console.log in production code.",
      note: "Use a proper logging library instead.",
      rule: {
        kind: "call_expression",
        regex: String.raw`^console\.log$`,
      },
    },
  },
  {
    description:
      "Composite rule with any/all — detect unsafe innerHTML assignment. `all` requires every sub-rule to match. `has` checks for a child node matching a pattern. Combine `pattern` with `has`/`inside` for precise matching.",
    rule: {
      id: "no-inner-html",
      language: "typescript",
      severity: "error",
      message: "Do not assign to innerHTML. This can lead to XSS attacks.",
      note: "Use textContent for text or a sanitization library for HTML.",
      rule: {
        pattern: "$EL.innerHTML = $VALUE",
      },
    },
  },
];
