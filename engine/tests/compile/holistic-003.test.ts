import { describe, expect, it } from "vitest";

import { compile } from "../../src/compile/compile.js";
import { TARGETS } from "../../src/compile/targets.js";
import type { Block, Document } from "../../src/document/types.js";

/**
 * Holistic review across all four emitters.
 *
 * The four share an escaper, a heading convention, a link policy, and a
 * diagnostic vocabulary. That shared surface is where a defect hides, because
 * each emitter reviewed alone looks correct.
 *
 * Written as failing tests before being believed. Any that pass on the first
 * run were wrong suspicions, kept as regression cover.
 */

function page(...blocks: Block[]): Document {
  return { schemaVersion: 1, target: "portable", blocks };
}

const EVERY_KIND: Block[] = [
  { id: "prof", kind: "profile", displayName: "Ari", status: "open" },
  { id: "head", kind: "heading", text: "Menu", level: 2 },
  { id: "menu", kind: "menu", heading: "Prices", tiers: [{ name: "Bust", price: "45" }] },
  {
    id: "gal",
    kind: "gallery",
    heading: "Work",
    layout: "grid",
    items: [{ imageUrl: "https://e.test/a.png" }],
  },
  { id: "prose", kind: "prose", heading: "Terms", text: "Half up front." },
  { id: "div", kind: "divider" },
];

describe("HB-1: every section heading uses the same level", () => {
  it("emits section headings consistently, so the page reads as one document", () => {
    const out = compile(page(...EVERY_KIND), "portable").markdown;
    const sectionHeadings = out
      .split("\n")
      .filter((l) => /^#{1,6} /.test(l))
      .filter((l) => !l.startsWith("## Menu"));
    for (const line of sectionHeadings) {
      expect(line.startsWith("### ")).toBe(true);
    }
  });
});

describe("HB-2: no section can be adjacent to another without a blank line", () => {
  it("separates every pair of sections", () => {
    const out = compile(page(...EVERY_KIND), "portable").markdown;
    // A heading directly after a non-blank line would make that line a heading
    // on some renderers, or absorb it on others.
    const lines = out.split("\n");
    lines.forEach((line, i) => {
      if (/^#{1,6} /.test(line) && i > 0) {
        expect(lines[i - 1]).toBe("");
      }
    });
  });

  it("never produces two blank lines in a row", () => {
    const out = compile(page(...EVERY_KIND), "portable").markdown;
    expect(out).not.toContain("\n\n\n");
  });
});

describe("HB-3: a table is never left dangling", () => {
  it("never emits a table header with no rows", () => {
    const out = compile(
      page(
        { id: "m", kind: "menu", heading: "Prices", tiers: [] },
        { id: "g", kind: "gallery", heading: "Work", layout: "grid", items: [] },
      ),
      "portable",
    ).markdown;
    expect(out).not.toContain("| --- |");
  });

  it("keeps every table rectangular", () => {
    const out = compile(page(...EVERY_KIND), "portable").markdown;
    let expectedCells: number | undefined;
    for (const line of out.split("\n")) {
      if (!line.startsWith("|")) {
        expectedCells = undefined;
        continue;
      }
      const cells = line.match(/(?<!\\)\|/g)?.length ?? 0;
      if (expectedCells === undefined) expectedCells = cells;
      else expect(cells).toBe(expectedCells);
    }
  });
});

describe("HB-4: the whole page is safe, not just each section", () => {
  const payload = "<script>alert(1)</script>\n\n***\n\n| a | b |";

  it("never emits a raw angle bracket anywhere on a page of every kind", () => {
    const out = compile(
      page(
        { id: "p", kind: "profile", displayName: payload, tagline: payload, paymentMethods: [payload] },
        { id: "m", kind: "menu", heading: payload, tiers: [{ name: payload, price: payload }] },
        {
          id: "g",
          kind: "gallery",
          heading: payload,
          layout: "list",
          items: [{ imageUrl: "https://e.test/a.png", caption: payload }],
        },
        { id: "t", kind: "prose", heading: payload, text: payload },
      ),
      "portable",
    ).markdown;
    expect(out).not.toContain("<");
    expect(out).not.toContain(">");
  });

  it("never lets artist text produce an unescaped thematic break", () => {
    const out = compile(page({ id: "t", kind: "prose", text: "***" }), "portable").markdown;
    for (const line of out.split("\n")) {
      expect(line.trim()).not.toBe("***");
    }
  });
});

describe("HB-5: determinism survives the new emitters", () => {
  it.each(TARGETS.map((t) => t.id))("is stable for %s across many compiles", (id) => {
    const doc = page(...EVERY_KIND);
    const first = compile(doc, id).markdown;
    for (let i = 0; i < 25; i += 1) expect(compile(doc, id).markdown).toBe(first);
  });

  it("does not mutate the page", () => {
    const doc = page(...EVERY_KIND);
    const before = JSON.stringify(doc);
    for (const t of TARGETS) compile(doc, t.id);
    expect(JSON.stringify(doc)).toBe(before);
  });

  it("does not accumulate diagnostics between compiles", () => {
    const doc = page({
      id: "p",
      kind: "profile",
      displayName: "Ari",
      links: [{ label: "bad", url: "javascript:alert(1)" }],
    });
    const first = compile(doc, "portable").diagnostics.length;
    for (let i = 0; i < 10; i += 1) {
      expect(compile(doc, "portable").diagnostics.length).toBe(first);
    }
  });
});

describe("HB-6: a refused link is refused everywhere, identically", () => {
  it.each([
    ["profile link", { id: "p", kind: "profile", displayName: "A", links: [{ label: "x", url: "javascript:alert(1)" }] } as Block],
    ["gallery image", { id: "g", kind: "gallery", layout: "list", items: [{ imageUrl: "javascript:alert(1)" }] } as Block],
    ["gallery item link", { id: "g", kind: "gallery", layout: "list", items: [{ imageUrl: "https://e.test/a.png", linkUrl: "javascript:alert(1)" }] } as Block],
    ["profile avatar", { id: "p", kind: "profile", displayName: "A", avatarUrl: "javascript:alert(1)" } as Block],
  ])("%s never reaches the output", (_label, block) => {
    const out = compile(page(block), "portable").markdown;
    expect(out).not.toContain("javascript");
  });

  it("warns for every refusal except the avatar, which is silent", () => {
    // The avatar is dropped without a warning. Every other refusal produces
    // one. That inconsistency is the finding.
    const avatar = compile(
      page({ id: "p", kind: "profile", displayName: "A", avatarUrl: "javascript:alert(1)" }),
      "portable",
    );
    expect(avatar.diagnostics.some((d) => d.code === "link_scheme_refused")).toBe(true);
  });
});
