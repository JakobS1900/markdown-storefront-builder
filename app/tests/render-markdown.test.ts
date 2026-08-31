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

const DANGEROUS = /^\s*(javascript|data|vbscript|file):/i;

function urls(host: HTMLElement): string[] {
  return [
    ...[...host.querySelectorAll("a")].map((a) => a.getAttribute("href") ?? ""),
    ...[...host.querySelectorAll("img")].map((i) => i.getAttribute("src") ?? ""),
  ];
}

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
      { id: "m", kind: "menu", tiers: [{ name: hostile, price: hostile }] },
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
    const host = renderCompiled({ id: "m", kind: "menu", tiers: [{ name: "Bust", price: "$45" }] });
    expect(host.textContent).toContain("$45");
    expect(host.textContent, "the artist is being shown the plumbing").not.toContain("&#36;");
  });

  it("shows a tilde and a caret as themselves", () => {
    const host = renderCompiled({ id: "p", kind: "prose", text: "range 50~60 caret a^b" });
    expect(host.textContent).toContain("50~60");
    expect(host.textContent).toContain("a^b");
    expect(host.textContent).not.toContain("&#");
  });

  it("shows a doubled tilde as text, matching what the host will do", () => {
    const host = renderCompiled({ id: "p", kind: "prose", text: "~~not struck~~" });
    expect(host.textContent).toContain("~~not struck~~");
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
});
