import { describe, expect, it } from "vitest";

import type { Block, Document } from "../../src/document/types.js";

/**
 * Compile-time assertions on the DERIVED types.
 *
 * Review finding R-1: the types come from the descriptor, so most of what could
 * go wrong is impossible by construction. What these assertions prove is that
 * the derivation itself works: required stays required, optional stays optional,
 * enums narrow to their literals, and the union discriminates on `kind`.
 *
 * If the derivation silently degraded to `any` or `unknown`, everything would
 * still compile and nothing would catch it. These do.
 *
 * The runtime assertions are trivial on purpose. The real work here is done by
 * `tsc`, and by the `@ts-expect-error` markers, each of which fails the build if
 * the error it expects stops happening.
 */

// A fully populated document must satisfy the derived type.
const full: Document = {
  schemaVersion: 1,
  target: "rentry",
  title: "Commissions",
  blocks: [
    { id: "b1", kind: "heading", text: "Prices", level: 2 },
    { id: "b2", kind: "divider" },
    { id: "b3", kind: "prose", heading: "Terms", text: "Half up front." },
    {
      id: "b4",
      kind: "menu",
      heading: "Menu",
      currency: "USD",
      tiers: [
        { name: "Bust", price: "from 45", blurb: "Head and shoulders", includes: ["1 revision"], imageUrl: "https://example.test/a.png" },
      ],
      addOns: [{ name: "Extra character", price: "20" }],
    },
    {
      id: "b5",
      kind: "gallery",
      heading: "Work",
      layout: "grid",
      items: [{ imageUrl: "https://example.test/b.png", caption: "Recent", linkUrl: "https://example.test/post" }],
    },
    {
      id: "b6",
      kind: "profile",
      displayName: "Ari",
      avatarUrl: "https://example.test/me.png",
      tagline: "Character artist",
      status: "open",
      links: [{ label: "Bluesky", url: "https://example.test/ari" }],
      paymentMethods: ["PayPal"],
    },
  ],
};

// Only the required fields. Every optional one is absent, not null, not
// undefined. Research D4.
const minimal: Document = {
  schemaVersion: 1,
  target: "portable",
  blocks: [],
};

// The union discriminates on `kind`: narrowing must expose that variant's
// fields and nothing else.
function narrows(block: Block): string {
  switch (block.kind) {
    case "heading":
      return `${block.text}${block.level}`;
    case "divider":
      return "divider";
    case "prose":
      return block.text;
    case "menu":
      return block.tiers.map((t) => t.name).join();
    case "gallery":
      return block.items.map((i) => i.imageUrl).join();
    case "profile":
      return block.displayName;
  }
}

describe("derived types", () => {
  it("accept a fully populated document", () => {
    expect(full.blocks).toHaveLength(6);
  });

  it("accept a document with every optional field absent", () => {
    expect(minimal.blocks).toEqual([]);
  });

  it("discriminate the block union on kind", () => {
    expect(full.blocks.map(narrows)).toHaveLength(6);
  });

  it("reject the shapes below at compile time", () => {
    // Each @ts-expect-error is an assertion. If the error stops occurring,
    // `tsc` fails on the unused directive, which is the point.

    // @ts-expect-error missing the required `target`
    const noTarget: Document = { schemaVersion: 1, blocks: [] };

    // @ts-expect-error `level` must be a number, not a string
    const badLevel: Block = { id: "x", kind: "heading", text: "t", level: "2" };

    // @ts-expect-error `layout` is narrowed to its literals, "carousel" is not one
    const badEnum: Block = { id: "x", kind: "gallery", layout: "carousel", items: [] };

    // @ts-expect-error `null` is never valid, optional means absent or a value
    const nullTitle: Document = { schemaVersion: 1, target: "rentry", title: null, blocks: [] };

    // @ts-expect-error a kind the descriptor does not declare
    const badKind: Block = { id: "x", kind: "video" };

    // @ts-expect-error `prose` has no `level`, so fields do not leak across variants
    const leaked: Block = { id: "x", kind: "prose", text: "t", level: 2 };

    expect([noTarget, badLevel, badEnum, nullTitle, badKind, leaked]).toHaveLength(6);
  });
});
