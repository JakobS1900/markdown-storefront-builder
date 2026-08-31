/**
 * Escaping only what needs escaping. Feature 013, FR-023.
 *
 * A storefront published to rentry on 2026-08-31 carried 74 backslashes and not
 * one of them was necessary: 59 full stops and 15 hyphens, all mid-sentence.
 * They are invisible on the published page, because the host consumes them, and
 * they are the whole content of the Copy screen, which is what the artist reads.
 *
 * The tests are in two halves and the second half is the important one. Making
 * the output prettier is easy; the property that must survive it is FR-010,
 * that nothing an artist writes can change the structure of the page around it.
 * So every character removed from the always-escape set is tested here in the
 * position where it could still do damage.
 */
import { describe, expect, it } from "vitest";

import { escapeText, escapeInline } from "../../src/compile/escape.js";

describe("what no longer gets a backslash", () => {
  it("leaves a full stop alone in ordinary prose", () => {
    expect(escapeText("Machined in Sheffield. Shipped worldwide.")).toBe(
      "Machined in Sheffield. Shipped worldwide.",
    );
  });

  it("leaves a hyphen alone inside a word", () => {
    expect(escapeText("Small-batch, USB-C, deep-carry")).toBe("Small-batch, USB-C, deep-carry");
  });

  it("leaves brackets of the round kind alone", () => {
    // They mean something only inside a link destination, and the compiler
    // writes those itself.
    expect(escapeText("Laser engraving (up to 20 characters)")).toBe(
      "Laser engraving (up to 20 characters)",
    );
  });

  it("leaves an exclamation mark alone", () => {
    expect(escapeText("Back in stock!")).toBe("Back in stock!");
  });

  it("produces a real sentence with no backslashes at all", () => {
    const line = "Small-batch everyday carry. Machined in Sheffield, shipped worldwide.";
    expect(escapeText(line)).toBe(line);
    expect(escapeText(line)).not.toContain("\\");
  });
});

describe("what still gets one, because it could still do damage", () => {
  it("escapes a hyphen that begins a line", () => {
    expect(escapeText("- not a list item")).toBe("\\- not a list item");
  });

  it("escapes a plus that begins a line", () => {
    expect(escapeText("+ not a list item")).toBe("\\+ not a list item");
  });

  it("escapes a hash that begins a line", () => {
    expect(escapeText("# not a heading")).toBe("\\# not a heading");
  });

  it("escapes a marker that begins any line, not only the first", () => {
    expect(escapeText("first\n- second\n# third")).toBe("first\n\\- second\n\\# third");
  });

  it("escapes a marker indented by spaces, which still starts a list", () => {
    expect(escapeText("   - indented")).toBe("   \\- indented");
  });

  it("escapes the full stop of an ordered list marker", () => {
    expect(escapeText("1. not a list")).toBe("1\\. not a list");
    expect(escapeText("12. not a list")).toBe("12\\. not a list");
  });

  it("escapes the other ordered list marker, which the spec first forgot", () => {
    // `1)` makes a numbered list too. The closing bracket was dropped from the
    // always-escape set, so this is the only thing standing between "1) First"
    // and a list the artist did not ask for.
    expect(escapeText("1) not a list")).toBe("1\\) not a list");
    expect(escapeText("costs 1) or 2) of those")).toBe("costs 1) or 2) of those");
  });

  it("does not escape a full stop after digits in the middle of a line", () => {
    expect(escapeText("costs 1. or 2. of those")).toBe("costs 1. or 2. of those");
  });

  it("treats the start of a fragment as the start of a line", () => {
    // A fragment is placed after a bullet marker or inside emphasis, so its
    // first character can land where a marker would be read. Escaping there is
    // sometimes unnecessary and never wrong, and it means no caller has to be
    // audited. "- - thing" is a nested list.
    expect(escapeText("- also this")).toBe("\\- also this");
    expect(escapeInline("- also this")).toBe("\\- also this");
  });

  it("still escapes everything that works anywhere on a line", () => {
    expect(escapeText("a\\b")).toBe("a\\\\b");
    expect(escapeText("a`b")).toBe("a\\`b");
    expect(escapeText("a*b")).toBe("a\\*b");
    expect(escapeText("a_b")).toBe("a\\_b");
    expect(escapeText("a[b]c")).toBe("a\\[b\\]c");
    expect(escapeText("a{b}c")).toBe("a\\{b\\}c");
    expect(escapeText("a|b")).toBe("a\\|b");
  });
});

describe("FR-010 still holds: no way out of the construct", () => {
  it("cannot open emphasis", () => {
    expect(escapeText("*not italic*")).not.toMatch(/(^|[^\\])\*/);
  });

  it("cannot open a code span", () => {
    expect(escapeText("`not code`")).not.toMatch(/(^|[^\\])`/);
  });

  it("cannot build a link", () => {
    const out = escapeText("[label](https://evil.example)");
    expect(out).not.toMatch(/(^|[^\\])\[/);
    expect(out).not.toMatch(/(^|[^\\])\]/);
  });

  it("cannot build an image, even though the exclamation mark is no longer escaped", () => {
    // This is the case that justifies dropping "!" entirely: an image needs
    // "![", and the bracket is escaped on every path, so the sequence cannot
    // survive whatever happens to the exclamation mark.
    const out = escapeText("![alt](https://evil.example/x.png)");
    expect(out).not.toContain("![");
    expect(out.startsWith("!\\[")).toBe(true);
  });

  it("cannot break out of a table cell", () => {
    expect(escapeInline("a | b | c")).toBe("a \\| b \\| c");
  });

  it("cannot start a heading on a line of its own", () => {
    expect(escapeText("intro\n\n### injected heading")).toContain("\\#");
  });

  it("cannot smuggle a marker in after a newline that the artist typed", () => {
    const out = escapeText("Prices below.\n- Free shipping\n- Gift wrap");
    expect(out).toBe("Prices below.\n\\- Free shipping\n\\- Gift wrap");
  });

  it("keeps the entity treatment untouched", () => {
    // FR-023b. The last change to this file broke the preview by reordering
    // these, so they are asserted here as well as in their own file.
    expect(escapeText("a & b < c > d")).toBe("a &amp; b &lt; c &gt; d");
    expect(escapeText("$45")).toBe("&#36;45");
    expect(escapeText("~x~ ^y^")).toBe("&#126;x&#126; &#94;y&#94;");
    expect(escapeText("a$b")).not.toContain("\\");
  });

  it("cannot double-escape its own entities", () => {
    expect(escapeText("50% off, $10")).toBe("50% off, &#36;10");
    // The artist typed the entity themselves. The ampersand is encoded so it
    // stays visible as text; the hash needs nothing, because a hash only makes
    // a heading at the start of a line and this one is not.
    expect(escapeText("&#36;")).toBe("&amp;#36;");
  });
});

describe("the storefront line that started this", () => {
  it("comes out clean", () => {
    const tagline = "Small-batch everyday carry. Machined in Sheffield, shipped worldwide.";
    const blurb = "Our flagship. Three-inch drop point, titanium frame lock, tumbled finish.";
    const spec = "CPM-S35VN blade, 59 HRC";
    for (const line of [tagline, blurb, spec]) {
      expect(escapeText(line)).toBe(line);
    }
  });
});
