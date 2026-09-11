/**
 * @vitest-environment jsdom
 *
 * The preview renderer, which had no tests at all.
 *
 * This is the only place in the application that builds an `href` or a `src`
 * out of text, so it is the only place an artist's words could become something
 * a browser acts on. Its own comment said "the XSS corpus test asserts exactly
 * that". There was no such test, in this file or any other: nothing anywhere
 * imported `renderMarkdown`. The engine's escaping is well covered, but nothing
 * checked what the preview did with the escaped result.
 *
 * The design does hold, and the reason is worth writing down because it is not
 * obvious. The renderer's link pattern needs `](` adjacent. The compiler escapes
 * an artist's parentheses as well as their brackets, so a refused link arrives
 * as `\[click\]\(javascript:...\)`, where the `\` between `]` and `(` stops the
 * pattern matching. The safety comes from the escaper, one module away, and
 * that coupling is exactly the kind that rots silently. Hence these.
 */
import { describe, expect, it } from "vitest";

import { compile } from "@mdsb/engine";
import type { Block, Document } from "@mdsb/engine";

import { renderMarkdown } from "../src/ui/render-markdown.js";

function render(markdown: string): HTMLElement {
  const host = document.createElement("div");
  host.append(renderMarkdown(markdown));
  return host;
}

function page(...blocks: Block[]): Document {
  return { schemaVersion: 1, target: "portable", blocks };
}

/** Renders the way the app does: compile first, then draw the result. */
function renderCompiled(...blocks: Block[]): HTMLElement {
  return render(compile(page(...blocks), "portable").markdown);
}

/**
 * The same, for a host that renders the marks feature 028 added.
 *
 * `portable` declares neither, so compiling there drops them and would make a
 * test of `del` and `mark` assert against output no emitter produces for a host
 * that has them. Still compiled rather than hand written: the point of this
 * whole file is that the renderer draws what the compiler emits.
 */
function renderCompiledFor(target: string, ...blocks: Block[]): HTMLElement {
  return render(compile(page(...blocks), target).markdown);
}

const DANGEROUS = /^\s*(javascript|data|vbscript|file):/i;

function urls(host: HTMLElement): string[] {
  return [
    ...[...host.querySelectorAll("a")].map((a) => a.getAttribute("href") ?? ""),
    ...[...host.querySelectorAll("img")].map((i) => i.getAttribute("src") ?? ""),
  ];
}

/**
 * A seller's own words cannot become an address.
 *
 * The header of this file states the design as: the renderer's link pattern
 * needs `](` adjacent, and the compiler escapes an artist's parentheses as well
 * as their brackets, so a refused link arrives as `\[click\]\(javascript:...\)`
 * with a backslash between `]` and `(` that stops the pattern matching.
 *
 * **That was documentation of a defence that did not exist.** `ESCAPABLE` did
 * not contain parentheses. Everything the corpus above covers was safe anyway,
 * but only because `safeAddress` refuses `javascript:` and its friends, which
 * is the second line and not the one the comment describes. An address the
 * checker ALLOWS had nothing standing in front of it at all.
 *
 * So a product named `Keyring](https://tracker.example/pixel.png)` compiled to
 * `![Keyring\](https://tracker.example/pixel.png)](https://real.png)`, the
 * pattern's `[^\]]*` alt stopped inside the `\]` escape, and the renderer built
 * an image pointing at an address the seller never entered in any image field.
 * A tracking pixel in a product name, reaching the preview, the saved menu file
 * and the published page on every host.
 *
 * It arrives by hand or through an imported backup, which is somebody else's
 * file. Found 2026-09-06 while reviewing the menu file exporter, which had the
 * same hole one layer up.
 *
 * **The bug was ours alone, and that is the part worth keeping.** A real
 * Markdown parser treats `\]` in a label as a literal bracket, so rentry and
 * text.is always resolved that image to the address the seller actually chose.
 * Only this renderer was fooled, because it finds a label with a regular
 * expression and the expression stopped inside the escape sequence.
 *
 * So the fix is here rather than in the escaper. Making the compiler escape
 * parentheses also stops it, and was tried and reverted: it overturns feature
 * 013 for every seller and puts `Laser engraving \(up to 20 characters\)` on
 * the Copy screen, to work around a defect in one regular expression.
 *
 * The header above still describes paren escaping as the defence. It is left
 * standing as a warning: that comment was wrong for as long as it existed, and
 * nothing failed, because every payload in the corpus below uses a scheme
 * `safeAddress` refuses anyway. An address it ALLOWS had nothing in front of it
 * but the pattern, and the pattern was the thing that was broken.
 */
describe("a seller's own words cannot forge an address", () => {
  const forged = "Keyring](https://tracker.example/pixel.png)";

  it("builds no image from an address hidden in an item name", () => {
    const host = renderCompiled({
      id: "m",
      kind: "menu",
      heading: "Prices",
      tiers: [{ id: "t1", name: forged, price: "18", imageUrls: ["https://real.test/a.png"] }],
    });

    expect(urls(host)).not.toContain("https://tracker.example/pixel.png");
  });

  it("still shows the picture the seller actually chose", () => {
    // The half that stops the fix being "delete the image". The real address is
    // in an image field and must survive.
    const host = renderCompiled({
      id: "m",
      kind: "menu",
      heading: "Prices",
      tiers: [{ id: "t1", name: forged, price: "18", imageUrls: ["https://real.test/a.png"] }],
    });

    expect(urls(host)).toContain("https://real.test/a.png");
  });

  it("still shows the seller the name they typed", () => {
    const host = renderCompiled({
      id: "m",
      kind: "menu",
      heading: "Prices",
      tiers: [{ id: "t1", name: forged, price: "18" }],
    });

    expect(host.textContent).toContain(forged);
  });

  it("forges nothing from a caption either", () => {
    const host = renderCompiled({
      id: "g",
      kind: "gallery",
      heading: "Work",
      layout: "list",
      items: [{ imageUrl: "https://real.test/b.png", caption: forged }],
    });

    expect(urls(host)).not.toContain("https://tracker.example/pixel.png");
    expect(urls(host)).toContain("https://real.test/b.png");
  });
});

describe("what an artist writes never becomes a live address", () => {
  const payloads = [
    "[click](javascript:alert(1))",
    "[click](JaVaScRiPt:alert(1))",
    "![img](javascript:alert(1))",
    "[click](data:text/html,<script>alert(1)</script>)",
    "[click](vbscript:msgbox(1))",
    "[click](file:///etc/passwd)",
    "[a](javascript:alert(1)) and [b](https://ok.test)",
    "[click](java\tscript:alert(1))",
    "<script>alert(1)</script>",
    "<img src=x onerror=alert(1)>",
    "[click]\\(javascript:alert(1))",
  ];

  for (const payload of payloads) {
    it(`refuses to build an address from ${JSON.stringify(payload)}`, () => {
      const host = renderCompiled({ id: "p", kind: "prose", text: payload });
      for (const url of urls(host)) {
        expect(url, `rendered a dangerous address from ${payload}`).not.toMatch(DANGEROUS);
      }
      // The words survive even when the link does not.
      expect(host.textContent ?? "").not.toBe("");
    });
  }

  it("never parses markup, whatever the payload", () => {
    const host = renderCompiled({ id: "p", kind: "prose", text: "<script>alert(1)</script>" });
    expect(host.querySelector("script")).toBeNull();
    expect(host.textContent).toContain("<script>");
  });

  it("keeps an address the artist is allowed to have", () => {
    const host = renderCompiled({ id: "p", kind: "prose", text: "[shop](https://example.test/a)" });
    const link = host.querySelector("a");
    expect(link?.getAttribute("href")).toBe("https://example.test/a");
    expect(link?.getAttribute("rel")).toContain("noopener");
  });

  it("carries the whole hostile fixture through compile and render without a live address", () => {
    const hostile = "|<>&\"'`\\*_{}[]()#+-.!~^$\n<script>alert(1)</script>\njavascript:alert(1)";
    const host = renderCompiled(
      { id: "h", kind: "heading", text: hostile, level: 2 },
      { id: "p", kind: "prose", text: hostile },
      { id: "m", kind: "menu", tiers: [{ id: "t", name: hostile, price: hostile }] },
      { id: "g", kind: "gallery", layout: "list", items: [{ imageUrl: "https://e.test/a.png", caption: hostile }] },
      { id: "u", kind: "profile", displayName: hostile, links: [{ label: hostile, url: "https://e.test" }] },
    );
    for (const url of urls(host)) expect(url).not.toMatch(DANGEROUS);
    expect(host.querySelector("script")).toBeNull();
  });
});

describe("the entities the escaper produces are shown as their characters", () => {
  /**
   * The preview renders the compiled output, so it has to undo what the
   * compiler did for the host's benefit, or it shows the artist plumbing.
   *
   * This was a live regression rather than a hypothetical. When three
   * characters moved from backslash escapes to numeric references, so that
   * rentry would stop publishing "\$45", the preview began showing "&#36;45"
   * because it only knew how to decode the three named entities.
   */
  it("shows a price of $45 as $45, not as its entity", () => {
    const host = renderCompiled({ id: "m", kind: "menu", tiers: [{ id: "bust", name: "Bust", price: "$45" }] });
    expect(host.textContent).toContain("$45");
    expect(host.textContent, "the artist is being shown the plumbing").not.toContain("&#36;");
  });

  it("shows a tilde and a caret as themselves", () => {
    const host = renderCompiled({ id: "p", kind: "prose", text: "range 50~60 caret a^b" });
    expect(host.textContent).toContain("50~60");
    expect(host.textContent).toContain("a^b");
    expect(host.textContent).not.toContain("&#");
  });

  it("shows a tilde the grammar did not claim as text, matching what the host will do", () => {
    // AMENDED BY FEATURE 028. This compiled `~~not struck~~` and asserted the
    // preview showed those characters literally, which was right while
    // strikethrough was not a construct: a doubled tilde could only be an
    // accident. It is now something a seller can ask for, and `renderCompiled`
    // compiles for `portable`, which does not render it, so the markers are
    // dropped and the words stay. That is the fallback, seen exactly where
    // Principle VII promises the seller will see it.
    //
    // The property underneath is unchanged and is what is asserted: a tilde the
    // grammar did not claim is still inert.
    const host = renderCompiled({ id: "p", kind: "prose", text: "~~ spaced ~~ and 50~60" });
    expect(host.textContent).toContain("~~ spaced ~~");
    expect(host.textContent).toContain("50~60");
    expect(host.querySelector("del, s, strike")).toBeNull();
  });

  it("shows an entity the artist typed themselves, rather than decoding it twice", () => {
    const host = renderCompiled({ id: "p", kind: "prose", text: "literally &#36;45" });
    expect(host.textContent).toContain("&#36;45");
  });

  it("decoding a reference still cannot produce markup", () => {
    // The dangerous direction: if a numeric reference for "<" were decoded into
    // something the renderer then parsed, the whole no-markup design would be
    // undone. Every node here is built from text, so it stays text.
    const host = render("a &#60;script&#62;alert(1)&#60;/script&#62; b");
    expect(host.querySelector("script")).toBeNull();
    expect(host.textContent).toContain("<script>");
  });
});

describe("it draws what the compiler emits", () => {
  it("renders headings at their level", () => {
    expect(render("## Prices").querySelector("h2")?.textContent).toBe("Prices");
  });

  it("renders a table with a header row", () => {
    const host = render("| Item | Price |\n| --- | --- |\n| Bust | 45 |");
    expect(host.querySelectorAll("thead th")).toHaveLength(2);
    expect(host.querySelector("tbody td")?.textContent).toBe("Bust");
  });

  it("puts a table in its own scroll container", () => {
    // The table and the box that scrolls it have to be two elements. One box
    // cannot be both no wider than the phone and as wide as its own columns,
    // and when it was asked to be both it chose narrow: a price table came out
    // 316 pixels wide with cells 590 pixels tall, one word per line. jsdom lays
    // nothing out, so this asserts the structure the fix depends on, and the
    // widths are measured in a real browser.
    const host = render("| Item | Price |\n| --- | --- |\n| Bust | 45 |");
    const table = host.querySelector("table");

    expect(table?.parentElement?.className).toBe("table-scroll");
  });

  it("renders a list", () => {
    expect(render("- one\n- two").querySelectorAll("li")).toHaveLength(2);
  });

  it("renders bold and italic", () => {
    const host = render("**bold** and *italic*");
    expect(host.querySelector("strong")?.textContent).toBe("bold");
    expect(host.querySelector("em")?.textContent).toBe("italic");
  });

  it("renders an image with its caption as alt text", () => {
    const host = render("![a cat](https://e.test/cat.png)");
    expect(host.querySelector("img")?.getAttribute("alt")).toBe("a cat");
  });

  it("shows an escaped pipe as a pipe, not as a backslash", () => {
    expect(render("a \\| b").textContent).toBe("a | b");
  });

  it("makes a rule from a divider", () => {
    expect(render("---").querySelector("hr")).not.toBeNull();
  });

  it("shows escaped equals signs as equals signs, not as backslashes", () => {
    // Compiled, not hand written, because the point is that this renderer and
    // the escaper agree. Feature 028 made the escaper backslash every equals
    // sign in a run of two or more, so a seller's own writing cannot become a
    // setext heading or a highlight on a paste host. If `=` were missing from
    // this renderer's strip list the seller would read `A \=\=highlight\=\=`
    // in the preview while the Copy tab showed the truth.
    // Written with the SPACED form on purpose. `==highlight==` is a mark a
    // seller asked for, and `renderCompiled` compiles for `portable`, which
    // drops it. `a == b` is the form the grammar refuses on every host, so it
    // is escaped everywhere and is the case that actually exercises this strip
    // list rather than the fallback.
    const host = renderCompiled({
      id: "t",
      kind: "prose",
      text: "a == b and Bundle = 3 items",
    });
    expect(host.textContent).toContain("a == b and Bundle = 3 items");
    expect(host.textContent).not.toContain("\\=");
    // Still text rather than a mark, because the grammar refused it.
    expect(host.querySelector("mark")).toBeNull();
  });

  it("draws a strikethrough and a highlight on a host that renders them", () => {
    const host = renderCompiledFor("rentry", {
      id: "t",
      kind: "prose",
      text: "~~Sold out~~ and ==limited run==",
    });
    expect(host.querySelector("del")?.textContent).toBe("Sold out");
    expect(host.querySelector("mark")?.textContent).toBe("limited run");
  });

  it("draws neither on a host that cannot, which is Principle VII on screen", () => {
    // The seller sees the words flat, here, before publishing. The compiler
    // raised a warning at the same moment; this is the other half of it.
    const host = renderCompiledFor("portable", {
      id: "t",
      kind: "prose",
      text: "~~Sold out~~ and ==limited run==",
    });
    expect(host.querySelector("del")).toBeNull();
    expect(host.querySelector("mark")).toBeNull();
    expect(host.textContent).toContain("Sold out and limited run");
  });

  it("keeps formatting inside a mark", () => {
    const host = renderCompiledFor("rentry", {
      id: "t",
      kind: "prose",
      text: "==a **bold** word==",
    });
    expect(host.querySelector("mark strong")?.textContent).toBe("bold");
  });

  it("draws bold and italic together", () => {
    const host = renderCompiledFor("rentry", {
      id: "t",
      kind: "prose",
      text: "***word***",
    });
    expect(host.querySelector("strong em")?.textContent).toBe("word");
    // Not the seller's own asterisks. Before the `***` branch was added ahead of
    // the `**` one, this fell through to plain text, because `**`'s content
    // class cannot begin with an asterisk.
    expect(host.textContent).not.toContain("*");
  });

  it("draws a link inside bold, which it used to lose", () => {
    // A PRE-EXISTING GAP, closed as a consequence of this feature rather than
    // as its own fix, and recorded so it is not mistaken for new behaviour.
    // The compiler has emitted `**[shop](url)**` since feature 008 and
    // `inline.test.ts` asserts it. This renderer set the inner text with
    // `unescape` rather than recursing, so the seller's link arrived in the
    // preview as the literal characters of a link. Feature 028 needed
    // recursion for `==a **bold** word==` and the four branches now share it.
    const host = renderCompiledFor("rentry", {
      id: "t",
      kind: "prose",
      text: "**[my shop](https://e.test/shop)**",
    });
    expect(host.querySelector("strong a")?.getAttribute("href")).toBe("https://e.test/shop");
    expect(host.querySelector("strong a")?.textContent).toBe("my shop");
  });

  it("cannot be made to draw a mark out of a seller's own words", () => {
    // The forgery class, one construct along. An item name carrying the markers
    // must not become a mark, on any host, because the grammar never claimed
    // it: the spaced form is refused and the escaper backslashes the equals
    // signs and entity encodes the tildes.
    const host = renderCompiledFor("rentry", {
      id: "t",
      kind: "prose",
      text: "a == b and 50~60 and == spaced ==",
    });
    expect(host.querySelector("mark")).toBeNull();
    expect(host.querySelector("del")).toBeNull();
    expect(host.textContent).toContain("a == b and 50~60 and == spaced ==");
  });

  it("does not turn a seller's underline into a heading", () => {
    // The defect feature 028 closed, measured where a seller would see it.
    const host = renderCompiled({ id: "t", kind: "prose", text: "My shop\n=" });
    expect(host.querySelector("h1")).toBeNull();
    expect(host.textContent).toContain("=");
  });
});
