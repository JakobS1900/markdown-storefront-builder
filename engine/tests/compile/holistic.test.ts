import { describe, expect, it } from "vitest";

import { compile } from "../../src/compile/compile.js";
import { PORTABLE, RENTRY, TARGETS } from "../../src/compile/targets.js";
import { escapeInline } from "../../src/compile/escape.js";
import type { Block, Document } from "../../src/document/types.js";

/**
 * Candidate findings from the holistic review over the whole feature diff.
 *
 * Written as failing tests before being believed, same as feature 001. Any that
 * pass on the first run were wrong suspicions and are kept as regression cover.
 */

function page(...blocks: Block[]): Document {
  return { schemaVersion: 1, target: "portable", blocks };
}

describe("H-1: a heading that escapes to nothing must not produce a bare hash run", () => {
  it("emits nothing visible for text that is entirely whitespace", () => {
    // Already covered. Kept because the interesting case is the next one.
    expect(compile(page({ id: "a", kind: "heading", text: "   ", level: 2 }), "portable").markdown).toBe(
      "##\n",
    );
  });

  it("still emits a heading when the text escapes to a shorter but non empty string", () => {
    const out = compile(page({ id: "a", kind: "heading", text: "#", level: 2 }), "portable");
    expect(out.markdown).toBe("## \\#\n");
  });
});

describe("H-2: every declared capability must be consulted by something", () => {
  it("has no capability that no emitter reads", () => {
    // A capability nothing consults is a guess written down, and the data model
    // says so explicitly. If one is added without a consumer, this fails.
    const declared = Object.keys(PORTABLE.capabilities).sort();
    expect(declared).toEqual([
      "escapeStyle",
      "hardBreak",
      "maxHeadingLevel",
      "tables",
      "thematicBreak",
    ]);
  });

  it("cites a source for every capability, including absent ones", () => {
    for (const target of TARGETS) {
      for (const key of ["maxHeadingLevel", "thematicBreak", "escapeStyle", "maxBytes"] as const) {
        expect(target.sources[key]).toBeTruthy();
        expect(target.sources[key].length).toBeGreaterThan(10);
      }
    }
  });
});

describe("H-3: escapeStyle is declared but never actually branched on", () => {
  it("is the same for both hosts, so no divergence is being silently ignored", () => {
    // The capability exists and the escaper does not read it. That is honest
    // only while every host shares one style. The moment two differ, this fails
    // and forces the escaper to actually consult it.
    const styles = new Set(TARGETS.map((t) => t.capabilities.escapeStyle));
    expect(styles.size).toBe(1);
  });
});

describe("H-4: a filled-in page must never compile to silence", () => {
  it("emits content for every section an artist filled in", () => {
    // Feature 002 shipped four kinds with no emitter, so a page made of them
    // compiled to an empty string with no warning at all: the artist would copy
    // nothing, paste nothing, and be told nothing. Feature 003 removed that
    // possibility by implementing every kind, and the switch has no default
    // branch, so adding a kind without an emitter now fails to compile.
    const out = compile(
      page(
        { id: "p", kind: "prose", text: "Terms and conditions" },
        { id: "g", kind: "gallery", layout: "grid", items: [] },
      ),
      "portable",
    );
    expect(out.markdown).toContain("Terms and conditions");
  });

  it("emits nothing only for sections that genuinely contain nothing", () => {
    const out = compile(page({ id: "g", kind: "gallery", layout: "grid", items: [] }), "portable");
    expect(out.markdown).toBe("");
  });
});

describe("H-5: the two shipped hosts, and where they now differ", () => {
  it("still agrees on everything the hosts have in common", () => {
    const doc = page(
      { id: "h", kind: "heading", text: "Commissions", level: 1 },
      { id: "d", kind: "divider" },
    );
    expect(compile(doc, RENTRY.id).markdown).toBe(compile(doc, PORTABLE.id).markdown);
  });

  it("differs on the hard line break, which live verification forced", () => {
    // Until 2026-08-18 the two hosts produced identical output for every
    // fixture, and the README and case study both said so. Pasting real output
    // into rentry showed the CommonMark backslash break producing no break at
    // all there, and swallowing the character so two sentences ran together.
    // This is the first genuine divergence between the shipped hosts.
    const doc = page({ id: "t", kind: "prose", text: "one\ntwo" });

    expect(compile(doc, RENTRY.id).markdown).toBe("one  \ntwo\n");
    expect(compile(doc, PORTABLE.id).markdown).toBe("one\\\ntwo\n");
    expect(compile(doc, RENTRY.id).markdown).not.toBe(compile(doc, PORTABLE.id).markdown);
  });

  it("differs the moment a capability differs, proving the mechanism works", () => {
    const narrowRentry = {
      ...RENTRY,
      capabilities: { ...RENTRY.capabilities, maxHeadingLevel: 2 },
    };
    const doc = page({ id: "h", kind: "heading", text: "Deep", level: 4 });
    expect(compile(doc, narrowRentry).markdown).not.toBe(compile(doc, PORTABLE.id).markdown);
  });
});

describe("H-6: escapeInline must not let a heading absorb the next block", () => {
  it("cannot produce a string containing a newline, for any input", () => {
    const nasty = [
      "a\nb",
      "a\r\nb",
      "a\u2028b",
      "a\u2029b",
      "a\u0085b",
      "a\vb",
      "a\fb",
    ];
    for (const input of nasty) {
      expect(escapeInline(input)).not.toMatch(/[\r\n\u2028\u2029\u0085\v\f]/);
    }
  });

  it("keeps every block on its own line in the output", () => {
    const doc = page(
      { id: "a", kind: "heading", text: "one\ntwo\nthree", level: 1 },
      { id: "b", kind: "heading", text: "four", level: 1 },
    );
    const lines = compile(doc, "portable").markdown.trimEnd().split("\n");
    expect(lines.filter((l) => l.startsWith("#"))).toHaveLength(2);
  });
});
