import { describe, expect, it } from "vitest";

import {
  canonicalHash,
  normalize,
  parseSignature,
} from "../src/rules/rule-hash";
import vectorsFixture from "./fixtures/rule-hash.vectors.json";

interface Vector {
  name: string;
  input: string;
  signature: string;
}

// The committed fixture is the cross-repo source-of-truth format: a bare array
// of { name, input, signature }, refreshed via `pnpm generate:rule-hash-vectors`.
const vectors = vectorsFixture as Vector[];

// Non-ASCII is built from code points so this source file stays pure ASCII.
const BOM = String.fromCodePoint(0xfeff);

describe("rule-hash conformance vectors", () => {
  it("has a non-empty committed vectors fixture", () => {
    expect(vectors.length).toBeGreaterThan(0);
  });

  // A mismatch here is a cross-repo release blocker: our normalize()+hash must
  // reproduce the server reference for every vector, exactly.
  it.each(vectors.map((v) => [v.name, v] as const))(
    "reproduces vector %s",
    async (_name, vector) => {
      // JSON.parse already decoded any \uXXXX escapes into real code points.
      expect(await canonicalHash(vector.input)).toBe(vector.signature);
    }
  );
});

describe("normalize invariants", () => {
  it("treats CRLF the same as LF", async () => {
    expect(await canonicalHash("a\r\nb")).toBe(await canonicalHash("a\nb"));
  });

  it("treats a lone CR the same as LF", async () => {
    expect(await canonicalHash("a\rb")).toBe(await canonicalHash("a\nb"));
  });

  it("collapses any number of trailing newlines to one", async () => {
    const base = await canonicalHash("a\nb");
    expect(await canonicalHash("a\nb\n")).toBe(base);
    expect(await canonicalHash("a\nb\n\n\n")).toBe(base);
    expect(await canonicalHash("a\nb")).toBe(base);
  });

  it("normalizes empty input to a single LF", () => {
    expect(normalize("")).toBe("\n");
  });

  it("strips a single leading BOM", async () => {
    expect(await canonicalHash(BOM + "abc")).toBe(await canonicalHash("abc"));
  });

  it("strips only one leading BOM and preserves the rest", async () => {
    // Two leading BOMs collapse to one remaining BOM, distinct from none.
    expect(await canonicalHash(BOM + BOM + "abc")).not.toBe(
      await canonicalHash("abc")
    );
  });

  it("preserves an interior BOM", async () => {
    expect(await canonicalHash("a" + BOM + "b")).not.toBe(
      await canonicalHash("ab")
    );
  });

  it("differs on a meaningful content change", async () => {
    expect(await canonicalHash("abc")).not.toBe(await canonicalHash("abd"));
  });

  it("hashes multibyte UTF-8 stably", async () => {
    // e+acute, CJK, and an astral emoji (party popper, U+1F389).
    const text =
      "caf" +
      String.fromCodePoint(0xe9) +
      " " +
      String.fromCodePoint(0x65e5, 0x672c, 0x8a9e) +
      " " +
      String.fromCodePoint(0x1f389) +
      "\n";
    const sig = await canonicalHash(text);
    expect(sig).toMatch(/^1;h=sha-256;d=[0-9a-f]{64}$/);
  });

  it("does not NFC-fold combining marks", async () => {
    const precomposed = "caf" + String.fromCodePoint(0xe9); // e-acute U+00E9
    const decomposed = "cafe" + String.fromCodePoint(0x301); // e + U+0301
    expect(precomposed).not.toBe(decomposed);
    expect(await canonicalHash(precomposed)).not.toBe(
      await canonicalHash(decomposed)
    );
  });
});

describe("parseSignature", () => {
  it("round-trips a computed signature", async () => {
    const sig = await canonicalHash("abc");
    const parsed = parseSignature(sig);
    expect(parsed).toEqual({
      algoVersion: 1,
      algo: "sha-256",
      digest: sig.slice(sig.indexOf("d=") + 2),
    });
  });

  it("reads the algoVersion before parameters", () => {
    // Unknown future version: parsed, not rejected, and params still read.
    expect(parseSignature("2;h=sha-512;d=deadbeef").algoVersion).toBe(2);
  });

  it("rejects a malformed envelope", () => {
    expect(() => parseSignature("nope")).toThrow();
    expect(() => parseSignature("1;hsha256")).toThrow();
    expect(() => parseSignature("1;h=sha-256;d=xyz")).toThrow();
  });
});
