import { describe, expect, it } from "vitest";

import { compile } from "../../src/compile/compile.js";
import { RENTRY, TARGETS, TEXT_IS } from "../../src/compile/targets.js";
import type { Block, Document } from "../../src/document/types.js";

/**
 * text.is, and the one thing that must never reach it.
 *
 * Verified against the host's own renderer on 2026-09-01, recorded in
 * `docs/research/2026-09-01-textis-verification.md`.
 *
 * The failure this file exists to prevent is silent and specific. A trailing
 * backslash on this host does not merely fail to break the line: it consumes
 * the newline AND the space that would have joined the two lines, so "each."
 * and "Refunds" publish as "each.Refunds". The golden file catches it for one
 * fixture. These catch it as a property.
 */

function page(...blocks: Block[]): Document {
  return { schemaVersion: 1, target: TEXT_IS.id, blocks };
}

const md = (...blocks: Block[]): string => compile(page(...blocks), TEXT_IS).markdown;

describe("the destructive backslash never reaches this host", () => {
  const twoLines: Block = {
    id: "t",
    kind: "prose",
    text: "Half up front.\nRefunds before lining.",
  };

  it("breaks the line with two trailing spaces", () => {
    expect(md(twoLines)).toContain("Half up front.  \nRefunds before lining.");
  });

  it("emits no line ending in a backslash anywhere", () => {
    // The property, not the one fixture. Any emitter that starts using the
    // CommonMark form fails here rather than on somebody's published page.
    const out = md(
      { id: "p", kind: "profile", displayName: "Ari", tagline: "Open now" },
      { id: "h", kind: "heading", text: "Prices", level: 2 },
      twoLines,
      {
        id: "m",
        kind: "menu",
        currency: "$",
        tiers: [{ name: "Bust", price: "45", blurb: "Head and shoulders.\nInk only." }],
      },
      { id: "d", kind: "divider" },
    );
    const offenders = out.split("\n").filter((line) => line.endsWith("\\"));
    expect(offenders).toEqual([]);
  });

  it("keeps the two sentences separated, which is what the bug destroyed", () => {
    const out = md(twoLines);
    expect(out).not.toContain("up front.Refunds");
  });
});

describe("what the host does support", () => {
  it("uses tables for a price list", () => {
    const out = md({
      id: "m",
      kind: "menu",
      tiers: [
        { name: "Bust", price: "45" },
        { name: "Full body", price: "120" },
      ],
    });
    expect(out).toContain("| Item | Price |");
  });

  it("raises no capability warning for a page it can render", () => {
    const result = compile(
      page(
        { id: "h", kind: "heading", text: "Prices", level: 2 },
        { id: "m", kind: "menu", tiers: [{ name: "Bust", price: "45" }] },
      ),
      TEXT_IS,
    );
    expect(result.diagnostics).toEqual([]);
  });

  it("goes to six heading levels", () => {
    expect(TEXT_IS.capabilities.maxHeadingLevel).toBe(6);
  });
});

describe("the characters a backslash cannot protect here", () => {
  // Observed: the backslash is consumed for every character probed except the
  // tilde, which is narrower than rentry. The compiler emits entities for all
  // three regardless, and those were confirmed to render as the character.
  const cases: [string, string, string][] = [
    ["tilde", "~", "&#126;"],
    ["dollar", "$", "&#36;"],
    ["caret", "^", "&#94;"],
  ];

  for (const [name, char, entity] of cases) {
    it(`emits an entity rather than a backslash for the ${name}`, () => {
      const out = md({ id: "t", kind: "prose", text: `a${char}b` });
      expect(out).toContain(`a${entity}b`);
      expect(out).not.toContain(`\\${char}`);
    });
  }
});

describe("this host is recorded honestly", () => {
  it("is offered to the artist alongside the others", () => {
    expect(TARGETS.map((t) => t.id)).toContain(TEXT_IS.id);
  });

  it("cites a source for every capability it claims", () => {
    for (const key of Object.keys(TEXT_IS.capabilities)) {
      const source = (TEXT_IS.sources as Record<string, string | undefined>)[key];
      expect(source, `no source recorded for ${key}`).toBeTruthy();
    }
  });

  it("does not silently inherit rentry's size limit", () => {
    // The two hosts were nearly copied from one another. This is the value
    // that proves they were not, and it is the one with a real consumer.
    expect(TEXT_IS.capabilities.maxBytes).toBe(200000);
    expect(RENTRY.capabilities.maxBytes).toBeUndefined();
  });

  it("warns rather than truncating when a page is too long for it", () => {
    const huge = "x".repeat(200_001);
    const result = compile(page({ id: "t", kind: "prose", text: huge }), TEXT_IS);
    const limit = result.diagnostics.filter((d) => d.capability === "maxBytes");
    expect(limit.length).toBeGreaterThan(0);
    expect(result.markdown).toContain("x".repeat(1000));
  });
});
