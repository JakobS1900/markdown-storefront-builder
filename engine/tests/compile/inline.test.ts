import { describe, expect, it } from "vitest";

import { DiagnosticSink } from "../../src/compile/diagnostics.js";
import { formatInline, parseInline } from "../../src/compile/inline.js";
import { PORTABLE, RENTRY } from "../../src/compile/targets.js";
import type { Target } from "../../src/compile/capabilities.js";

/**
 * The inline grammar. Roadmap 1.7, and the two marks feature 028 added.
 *
 * Two halves. The first is that the formatting an artist expects works. The
 * second, and the one that earns the file's length, is that nothing else does:
 * the parser is a whitelist, and anything outside it stays text.
 *
 * `formatInline` gained a target and a sink with feature 028, because
 * strikethrough and highlight are the first constructs whose OUTPUT depends on
 * the host. `rentry` is the default here because it supports both, so a test
 * that says nothing about hosts is testing the grammar rather than the
 * fallback. The fallback has its own describe block at the end.
 */
function fmt(input: string, target: Target = RENTRY): string {
  return formatInline(input, target, new DiagnosticSink(), "b1");
}

describe("the formatting artists actually type", () => {
  it.each([
    ["**bold**", "**bold**"],
    ["*italic*", "*italic*"],
    ["_italic_", "*italic*"],
    ["a **bold** word", "a **bold** word"],
    ["**bold** and *italic*", "**bold** and *italic*"],
  ])("formats %j", (input, expected) => {
    expect(fmt(input)).toBe(expected);
  });

  it("normalises underscore emphasis to asterisks, so output is one style", () => {
    expect(fmt("_one_ and *two*")).toBe("*one* and *two*");
  });

  it("makes a link", () => {
    expect(fmt("see [my shop](https://e.test/shop)")).toBe(
      "see [my shop](https://e.test/shop)",
    );
  });

  it("allows emphasis inside a link label", () => {
    expect(fmt("[**shop**](https://e.test)")).toBe("[**shop**](https://e.test)");
  });

  it("allows a link inside emphasis", () => {
    expect(fmt("**[shop](https://e.test)**")).toBe("**[shop](https://e.test)**");
  });

  it("uses the address as the label when there is none", () => {
    expect(fmt("[](https://e.test/x)")).toBe("[https://e.test/x](https://e.test/x)");
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
    expect(fmt(input)).toBe(expected);
  });

  it("does not treat a price range as emphasis", () => {
    expect(fmt("45_50")).toBe("45\\_50");
  });

  it("refuses to emphasise across a blank line", () => {
    // A greedy matcher would swallow everything between two stray markers.
    const out = fmt("start ** middle");
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
    // Constitution Principle IV: the corpus grows by one case per new
    // user-authored construct, and feature 028 added two.
    "~~<script>alert(1)</script>~~",
    "==<script>alert(1)</script>==",
    "==<img src=x onerror=alert(1)>==",
    "~~[x](javascript:alert(1))~~",
  ])("never lets %j produce markup", (payload) => {
    const out = fmt(payload);
    expect(out).not.toContain("<");
    expect(out).not.toContain(">");
  });

  it("refuses a javascript address, keeping the text so the artist can see it", () => {
    const out = fmt("[click](javascript:alert(1))");
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
      const out = fmt(`[x](${scheme})`);
      expect(out).not.toBe(`[x](${scheme})`);
    }
  });

  it("percent encodes an address that would end its own link early", () => {
    const out = fmt("[x](https://e.test/a_(b))");
    const inner = out.slice(out.indexOf("](") + 2, -1);
    expect(inner).not.toContain(")");
  });

  it("cannot be made to nest without bound", () => {
    // A crafted input should terminate rather than recurse forever.
    const deep = "**".repeat(60) + "x" + "**".repeat(60);
    expect(() => fmt(deep)).not.toThrow();
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
    for (const kind of kinds) {
      expect(["text", "strong", "em", "link", "strike", "highlight"]).toContain(kind);
    }
  });
});

/**
 * Feature 028. The two marks a text editor is expected to have and this one
 * did not.
 */
describe("strikethrough and highlight, on a host that renders them", () => {
  it.each([
    ["~~struck~~", "~~struck~~"],
    ["==marked==", "==marked=="],
    ["a ~~struck~~ word", "a ~~struck~~ word"],
    ["a ==marked== word", "a ==marked== word"],
    ["~~struck~~ and ==marked==", "~~struck~~ and ==marked=="],
    // Composes with what was already there, in both directions.
    ["**~~both~~**", "**~~both~~**"],
    ["==a **bold** word==", "==a **bold** word=="],
    ["[~~gone~~](https://e.test)", "[~~gone~~](https://e.test)"],
  ])("formats %j", (input, expected) => {
    expect(fmt(input)).toBe(expected);
  });

  it.each([
    // The same restraint the existing markers have. A stray marker must not
    // swallow the rest of somebody's writing looking for a partner.
    ["an unclosed ~~strike", "an unclosed &#126;&#126;strike"],
    ["an unclosed ==mark", "an unclosed \\=\\=mark"],
    ["~~", "&#126;&#126;"],
    ["==", "\\=\\="],
    ["~~ spaced ~~", "&#126;&#126; spaced &#126;&#126;"],
    ["== spaced ==", "\\=\\= spaced \\=\\="],
    // The single characters mean nothing on their own and must stay readable.
    ["50~60", "50&#126;60"],
    ["Bundle = 3 items", "Bundle = 3 items"],
  ])("leaves %j as text", (input, expected) => {
    expect(fmt(input)).toBe(expected);
  });

  it.each([
    // FOUND BY A GOLDEN DIFF, NOT BY FORESIGHT, and it destroyed a seller's
    // text. `=====` was matched as `==` plus `=` plus `==`, a highlight around
    // one equals sign. On rentry that published as `==\===`; on portable, where
    // the fallback drops the markers, five characters became `\=`. A marker is
    // the whole run or it is not a marker.
    ["=====", "\\=\\=\\=\\=\\="],
    ["===", "\\=\\=\\="],
    ["a ===three=== b", "a \\=\\=\\=three\\=\\=\\= b"],
    ["~~~~~", "&#126;&#126;&#126;&#126;&#126;"],
    ["a ~~~three~~~ b", "a &#126;&#126;&#126;three&#126;&#126;&#126; b"],
  ])("refuses %j, because a marker is the whole run or it is not one", (input, expected) => {
    expect(fmt(input)).toBe(expected);
  });

  it("loses not one character of a hand drawn underline, on any host", () => {
    // The fallback path is where the loss actually happened, so it is asserted
    // on the host that has no highlight rather than only on the one that does.
    for (const target of [RENTRY, PORTABLE]) {
      const out = fmt("=====", target);
      expect(out.replace(/\\/g, "")).toBe("=====");
    }
  });

  it("writes the markers itself rather than passing the seller's through", () => {
    // The whole security property in one assertion. A tilde in seller text
    // never survives as a tilde: `escapeText` turns it into `&#126;`, because
    // rentry consumes a backslash before it. So a REAL `~~` in the output can
    // only have been written by the emitter. Feature 028 gave `=` the same
    // property by escaping it, which is what makes `==` safe to write here.
    const out = fmt("~~struck~~ and a stray ~ and ==marked== and a stray =");
    expect(out).toBe("~~struck~~ and a stray &#126; and ==marked== and a stray =");
  });
});

describe("a host that cannot render a mark gets plain words and a warning", () => {
  it("drops the markers entirely rather than publishing them", () => {
    // Decision 2. Not bold, and not the literal markers: a seller who
    // highlights "limited run" must never show buyers `==limited run==`.
    expect(fmt("a ==marked== word", PORTABLE)).toBe("a marked word");
    expect(fmt("a ~~struck~~ word", PORTABLE)).toBe("a struck word");
  });

  it("names the section and the mark, without quoting the seller back", () => {
    const sink = new DiagnosticSink();
    formatInline("a ==marked== word", PORTABLE, sink, "about-me");
    const raised = sink.all.filter((d) => d.code === "mark_unsupported");
    expect(raised).toHaveLength(1);
    expect(raised[0]?.blockId).toBe("about-me");
    expect(raised[0]?.capability).toBe("highlight");
    expect(raised[0]?.severity).toBe("warning");
    expect(raised[0]?.message).toContain(PORTABLE.name);
    // FR-081. A warning is somewhere a seller might screenshot.
    expect(raised[0]?.message).not.toContain("marked");
  });

  it("warns once per mark per section, not once per word", () => {
    const sink = new DiagnosticSink();
    formatInline("==one== ==two== ==three== ~~four~~", PORTABLE, sink, "b");
    const raised = sink.all.filter((d) => d.code === "mark_unsupported");
    expect(raised).toHaveLength(2);
    expect(raised.map((d) => d.capability).sort()).toEqual(["highlight", "strikethrough"]);
  });

  it("says nothing at all when the host renders the mark", () => {
    const sink = new DiagnosticSink();
    formatInline("==marked== and ~~struck~~", RENTRY, sink, "b");
    expect(sink.all.filter((d) => d.code === "mark_unsupported")).toHaveLength(0);
  });

  it("keeps the formatting inside a mark it cannot render", () => {
    // The mark goes; the seller's bold does not go with it.
    expect(fmt("==a **bold** word==", PORTABLE)).toBe("a **bold** word");
  });
});

describe("emitting is stable", () => {
  it("produces the same output every time", () => {
    const input = "**a** [b](https://e.test) *c* and & < >";
    const first = fmt(input);
    for (let i = 0; i < 20; i += 1) expect(fmt(input)).toBe(first);
  });

  it("is safe to run over its own output", () => {
    // Not a claim that it round trips, only that a second pass cannot introduce
    // markup. Escaped markers stay escaped.
    const once = fmt("**bold** <script>");
    const twice = fmt(once);
    expect(twice).not.toContain("<");
  });
});
