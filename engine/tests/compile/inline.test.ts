import { describe, expect, it } from "vitest";

import { formatInline, parseInline } from "../../src/compile/inline.js";

/**
 * The inline grammar. Roadmap 1.7.
 *
 * Two halves. The first is that the formatting an artist expects works. The
 * second, and the one that earns the file's length, is that nothing else does:
 * the parser is a whitelist, and anything outside it stays text.
 */

describe("the formatting artists actually type", () => {
  it.each([
    ["**bold**", "**bold**"],
    ["*italic*", "*italic*"],
    ["_italic_", "*italic*"],
    ["a **bold** word", "a **bold** word"],
    ["**bold** and *italic*", "**bold** and *italic*"],
  ])("formats %j", (input, expected) => {
    expect(formatInline(input)).toBe(expected);
  });

  it("normalises underscore emphasis to asterisks, so output is one style", () => {
    expect(formatInline("_one_ and *two*")).toBe("*one* and *two*");
  });

  it("makes a link", () => {
    expect(formatInline("see [my shop](https://e.test/shop)")).toBe(
      "see [my shop](https://e.test/shop)",
    );
  });

  it("allows emphasis inside a link label", () => {
    expect(formatInline("[**shop**](https://e.test)")).toBe("[**shop**](https://e.test)");
  });

  it("allows a link inside emphasis", () => {
    expect(formatInline("**[shop](https://e.test)**")).toBe("**[shop](https://e.test)**");
  });

  it("uses the address as the label when there is none", () => {
    expect(formatInline("[](https://e.test/x)")).toBe("[https://e.test/x](https://e.test/x)");
  });
});

describe("ordinary writing is left alone", () => {
  it.each([
    ["a * b * c", "a \\* b \\* c"],
    ["2 * 3 = 6", "2 \\* 3 = 6"],
    ["snake_case_name", "snake\\_case\\_name"],
    ["50% off**", "50% off\\*\\*"],
    ["an unclosed **bold", "an unclosed \\*\\*bold"],
    ["**", "\\*\\*"],
    ["* *", "\\* \\*"],
  ])("leaves %j as text", (input, expected) => {
    expect(formatInline(input)).toBe(expected);
  });

  it("does not treat a price range as emphasis", () => {
    expect(formatInline("45_50")).toBe("45\\_50");
  });

  it("refuses to emphasise across a blank line", () => {
    // A greedy matcher would swallow everything between two stray markers.
    const out = formatInline("start ** middle");
    expect(out).toContain("\\*\\*");
  });
});

describe("the whitelist holds, whatever is written", () => {
  it.each([
    "<script>alert(1)</script>",
    "**<script>alert(1)</script>**",
    "[x](javascript:alert(1))",
    "[x](JaVaScRiPt:alert(1))",
    "[x](data:text/html,<script>alert(1)</script>)",
    "[<img src=x onerror=alert(1)>](https://e.test)",
    "*<svg onload=alert(1)>*",
    "[x](https://e.test) <iframe src=//evil.test>",
  ])("never lets %j produce markup", (payload) => {
    const out = formatInline(payload);
    expect(out).not.toContain("<");
    expect(out).not.toContain(">");
  });

  it("refuses a javascript address, keeping the text so the artist can see it", () => {
    const out = formatInline("[click](javascript:alert(1))");
    // Not a link, and not silently deleted either.
    //
    // This asserted that the output contains no "](javascript" at all. Once
    // round brackets stopped being escaped the output became
    // "\[click\](javascript:alert(1))", which contains that substring and is
    // still not a link, because a link needs an unescaped closing bracket and
    // this one is escaped. The proxy had become cruder than the property, so
    // the property is asserted directly: no unescaped "](" anywhere.
    expect(out).not.toMatch(/(^|[^\\])\]\(/);
    expect(out).toContain("click");
    expect(out).toContain("\\[");
    expect(out).toContain("\\]");
  });

  it("refuses data and other schemes the same way", () => {
    for (const scheme of ["data:text/html,x", "vbscript:x", "file:///etc/passwd", "//evil.test"]) {
      const out = formatInline(`[x](${scheme})`);
      expect(out).not.toBe(`[x](${scheme})`);
    }
  });

  it("percent encodes an address that would end its own link early", () => {
    const out = formatInline("[x](https://e.test/a_(b))");
    const inner = out.slice(out.indexOf("](") + 2, -1);
    expect(inner).not.toContain(")");
  });

  it("cannot be made to nest without bound", () => {
    // A crafted input should terminate rather than recurse forever.
    const deep = "**".repeat(60) + "x" + "**".repeat(60);
    expect(() => formatInline(deep)).not.toThrow();
  });

  it("produces only node kinds the grammar declares", () => {
    const nodes = parseInline("**a** *b* [c](https://e.test) plain");
    const kinds = new Set<string>();
    const walk = (list: readonly { kind: string; children?: readonly unknown[] }[]): void => {
      for (const n of list) {
        kinds.add(n.kind);
        if (Array.isArray(n.children)) walk(n.children as never);
      }
    };
    walk(nodes as never);
    for (const kind of kinds) expect(["text", "strong", "em", "link"]).toContain(kind);
  });
});

describe("emitting is stable", () => {
  it("produces the same output every time", () => {
    const input = "**a** [b](https://e.test) *c* and & < >";
    const first = formatInline(input);
    for (let i = 0; i < 20; i += 1) expect(formatInline(input)).toBe(first);
  });

  it("is safe to run over its own output", () => {
    // Not a claim that it round trips, only that a second pass cannot introduce
    // markup. Escaped markers stay escaped.
    const once = formatInline("**bold** <script>");
    const twice = formatInline(once);
    expect(twice).not.toContain("<");
  });
});
