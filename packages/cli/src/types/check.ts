/** Scanner-agnostic result type for check findings */
export interface CheckResult {
  source: string;
  ruleId: string;
  severity: "error" | "warning" | "info" | "hint";
  message: string;
  note?: string;
  file: string;
  range: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
  matchedText: string;
  fix?: string;
}

/** ast-grep JSONL output schema for a single match */
export interface AstGrepMatch {
  ruleId: string;
  severity: "error" | "warning" | "info" | "hint";
  message: string;
  note?: string;
  text: string;
  file: string;
  range: {
    byteOffset: { start: number; end: number };
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
  lines: string;
  replacement?: string;
}

/** Map an ast-grep match to a scanner-agnostic CheckResult */
export function toCheckResult(match: AstGrepMatch): CheckResult {
  return {
    source: "ast-grep",
    ruleId: match.ruleId,
    severity: match.severity,
    message: match.message,
    note: match.note,
    file: match.file,
    range: {
      start: match.range.start,
      end: match.range.end,
    },
    matchedText: match.text,
    fix: match.replacement,
  };
}
