import { describe, expect, it } from "vitest";

import { compile } from "../../src/compile/compile.js";
import { isSafeLinkUrl, isSafeUrl } from "../../src/compile/link.js";
import type { Block, Document } from "../../src/document/types.js";

/**
 * Contact links, and the difference between a link and an image.
 *
 * Found by building a real shop rather than by reading the compiler. An email
 * went into a profile link, the address was refused for not being http, and the
 * LABEL survived: the page published a bullet reading "Email" that did nothing
 * at all. That is worse than omitting it, because it reads as a mistake the
 * seller made rather than a rule the tool applied.
 *
 * The old rule's comment said mailto was refused because nothing produced one.
 * The first person to use the thing produced one.
 */

function page(...blocks: Block[]): Document {
  return { schemaVersion: 1, target: "portable", blocks };
}

const md = (...blocks: Block[]): string => compile(page(...blocks), "portable").markdown;

const profile = (url: string): Block => ({
  id: "p",
  kind: "profile",
  displayName: "Ari",
  links: [{ label: "Email", url }],
});

describe("an email address is a link now", () => {
  it("makes a mailto address clickable in a profile", () => {
    expect(md(profile("mailto:ari@example.com"))).toContain(
      "[Email](mailto:ari@example.com)",
    );
  });

  it("raises no warning for one", () => {
    const out = compile(page(profile("mailto:ari@example.com")), "portable");
    expect(out.diagnostics).toEqual([]);
  });

  it("makes a tel address clickable", () => {
    expect(md(profile("tel:+441134960000"))).toContain("[Email](tel:+441134960000)");
  });

  it("works inside prose as well as in a profile", () => {
    const out = md({
      id: "t",
      kind: "prose",
      text: "Questions to [my email](mailto:ari@example.com).",
    });
    expect(out).toContain("[my email](mailto:ari@example.com)");
  });
});

describe("what is still refused", () => {
  const dangerous = [
    "javascript:alert(1)",
    "data:text/html;base64,PHNjcmlwdD4=",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
    // The scheme is right and the address is not one.
    "mailto:",
    "mailto:not-an-address",
    "mailto:two@at@signs.com",
    "mailto:has space@example.com",
    "tel:",
    "tel:abcdef",
  ];

  for (const url of dangerous) {
    it(`refuses ${url}`, () => {
      expect(isSafeLinkUrl(url)).toBe(false);
    });
  }

  it("refuses a javascript address dressed up with a control character", () => {
    // Browsers strip these before reading the scheme, so the check has to too.
    expect(isSafeLinkUrl("java\tscript:alert(1)")).toBe(false);
    expect(isSafeLinkUrl("java\u0000script:alert(1)")).toBe(false);
  });

  it("leaves the label as plain text and says why", () => {
    const out = compile(page(profile("javascript:alert(1)")), "portable");
    expect(out.markdown).toContain("Email");
    expect(out.markdown).not.toMatch(/(^|[^\\])\]\(/);
    expect(out.diagnostics.map((d) => d.code)).toContain("link_scheme_refused");
  });

  it("tells the seller which kinds of address do work", () => {
    const out = compile(page(profile("javascript:alert(1)")), "portable");
    const message = out.diagnostics[0]?.message ?? "";
    for (const scheme of ["http://", "https://", "mailto:", "tel:"]) {
      expect(message).toContain(scheme);
    }
  });
});

describe("an image is not a link", () => {
  it("still refuses mailto for an avatar, because it is not an image", () => {
    expect(isSafeUrl("mailto:ari@example.com")).toBe(false);
  });

  it("drops a mailto avatar and warns rather than emitting a broken image", () => {
    const out = compile(
      page({ id: "p", kind: "profile", displayName: "Ari", avatarUrl: "mailto:ari@example.com" }),
      "portable",
    );
    expect(out.markdown).not.toContain("mailto:");
    expect(out.diagnostics.length).toBeGreaterThan(0);
  });

  it("still refuses mailto for a price list example image", () => {
    const out = compile(
      page({
        id: "m",
        kind: "menu",
        tiers: [{ id: "bust", name: "Bust", price: "45", imageUrls: ["mailto:ari@example.com"] }],
      }),
      "portable",
    );
    expect(out.markdown).not.toContain("mailto:");
    expect(out.diagnostics.map((d) => d.code)).toContain("link_scheme_refused");
  });
});

describe("the avatar can be described", () => {
  it("uses the seller's name as the alt text", () => {
    const out = md({
      id: "p",
      kind: "profile",
      displayName: "Ari",
      avatarUrl: "https://e.test/me.png",
    });
    expect(out).toContain("![Ari](https://e.test/me.png)");
  });

  it("collapses a name containing a newline, so the image cannot end early", () => {
    // Alt text is delimited by a bracket on one line. A newline inside it ends
    // the image and spills the rest of the name into the page as text.
    const out = md({
      id: "p",
      kind: "profile",
      displayName: "Ari\nAlderly",
      avatarUrl: "https://e.test/me.png",
    });
    const imageLine = out.split("\n").find((l) => l.includes("e.test/me.png")) ?? "";
    expect(imageLine).toContain("![Ari Alderly]");
  });

  it("escapes a name that would otherwise close the alt text", () => {
    const out = md({
      id: "p",
      kind: "profile",
      displayName: "Ari] (evil)",
      avatarUrl: "https://e.test/me.png",
    });
    expect(out).toContain("\\]");
  });
});
