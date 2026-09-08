/**
 * Saying how an item reaches a buyer.
 *
 * A price list could say what something cost and what the price bought, and
 * could not say the thing does not exist yet, or that it will be made after
 * somebody pays, or that they will wait three weeks for it. Sellers worked
 * around it with a details line reading "Made to order: 2 weeks", which is free
 * text the app cannot read, lay out consistently, or ask about.
 *
 * The assertion that governs this whole feature is the LAST one here: a row
 * with neither field compiles to exactly what it compiled to before. Every page
 * in existence is made of those rows, so if any of them moves by a byte, the
 * emitter is wrong rather than the page.
 */
import { describe, expect, it } from "vitest";

import { ALL_TARGETS, MENU_FILE, RENTRY, compile, PORTABLE } from "@mdsb/engine";
import type { Block, Document } from "@mdsb/engine";

function page(...tiers: Extract<Block, { kind: "menu" }>["tiers"]): Document {
  return {
    schemaVersion: 5,
    target: "rentry",
    blocks: [{ id: "m", kind: "menu", heading: "Prices", tiers }],
  };
}

function markdown(doc: Document, target = RENTRY): string {
  return compile(doc, target).markdown;
}

describe("a selling mode reaches the page", () => {
  it("says an item is made after it is bought", () => {
    const out = markdown(page({ id: "a", name: "Carved sign", price: "80", availability: "made-to-order" }));
    expect(out).toContain("Made to order");
  });

  it("says a preorder differently from made to order", () => {
    const pre = markdown(page({ id: "a", name: "Mug", price: "25", availability: "preorder" }));
    const made = markdown(page({ id: "a", name: "Mug", price: "25", availability: "made-to-order" }));
    expect(pre).toContain("Preorder");
    expect(pre).not.toBe(made);
  });

  it("says in stock, for the seller who wants to say it plainly", () => {
    expect(markdown(page({ id: "a", name: "Keyring", price: "18", availability: "in-stock" }))).toContain(
      "In stock",
    );
  });

  it("says sold out", () => {
    // Put back into the value set after being specified out, because sellers
    // use it constantly. See specs/026-selling-modes/research.md D2.
    expect(markdown(page({ id: "a", name: "Pin", price: "12", availability: "sold-out" }))).toContain(
      "Sold out",
    );
  });
});

describe("the wait", () => {
  it("reads as one statement with the mode, not as a second fact", () => {
    const out = markdown(
      page({ id: "a", name: "Sign", price: "80", availability: "made-to-order", leadTime: "about 2 weeks" }),
    );
    expect(out).toContain("Made to order, about 2 weeks");
  });

  it("is passed through as the seller typed it, not title cased", () => {
    const out = markdown(
      page({ id: "a", name: "Sign", price: "80", availability: "preorder", leadTime: "ships in March" }),
    );
    expect(out).toContain("ships in March");
    expect(out).not.toContain("Ships In March");
  });

  it("appears on its own when there is no mode", () => {
    // How long something takes is worth saying even when the reason is not.
    expect(markdown(page({ id: "a", name: "Repair", price: "40", leadTime: "3 to 5 days" }))).toContain(
      "3 to 5 days",
    );
  });

  it("is allowed beside sold out, because back in two weeks is useful", () => {
    const out = markdown(
      page({ id: "a", name: "Pin", price: "12", availability: "sold-out", leadTime: "back in a month" }),
    );
    expect(out).toContain("Sold out, back in a month");
  });
});

describe("it appears in every layout, not only the table", () => {
  /** Quantity breaks force the per item layout, which is a different code path. */
  const perItem = page({
    id: "a",
    name: "Oranges",
    price: "7",
    availability: "in-stock",
    leadTime: "picked to order",
    quantities: [{ amount: "5 lb", price: "30" }],
  });

  it("in the per item layout", () => {
    const out = markdown(perItem);
    expect(out).toContain("#### Oranges");
    expect(out).toContain("In stock, picked to order");
  });

  it("in the list fallback, for a host without tables", () => {
    // `itemBody` is shared by the per item layout and the no-tables fallback so
    // the two cannot drift. This is the half that proves the sharing works.
    const noTables = { ...PORTABLE, capabilities: { ...PORTABLE.capabilities, tables: false } };
    const out = compile(page({ id: "a", name: "Sign", price: "80", availability: "made-to-order" }), noTables)
      .markdown;
    expect(out).toContain("Made to order");
  });

  it("on every target the compiler can emit", () => {
    for (const target of ALL_TARGETS) {
      const out = markdown(page({ id: "a", name: "Sign", price: "80", availability: "sold-out" }), target);
      expect([target.id, out.includes("Sold out")]).toEqual([target.id, true]);
    }
  });
});

describe("the column earns its place", () => {
  it("is absent when no row in the section uses it", () => {
    const out = markdown(page({ id: "a", name: "Sign", price: "80" }, { id: "b", name: "Mug", price: "25" }));
    expect(out).not.toContain("Availability");
  });

  it("is present for the whole section when one row uses it", () => {
    const out = markdown(
      page({ id: "a", name: "Sign", price: "80", availability: "made-to-order" }, { id: "b", name: "Mug", price: "25" }),
    );
    expect(out).toContain("Availability");
  });
});

/**
 * The rule the feature turns on. FR-110, SC-001.
 *
 * Every page that exists has neither field. If one of them compiles differently
 * after this, the emitter is wrong.
 */
describe("a row that says nothing changes nothing", () => {
  const plain = page(
    { id: "a", name: "Sign", price: "80", unit: "each", blurb: "Oak.", includes: ["A hook"] },
    { id: "b", name: "Mug", price: "25", details: [{ label: "Colour", value: "Blue" }] },
  );

  it.each(ALL_TARGETS.map((t) => t.id))("%s output has no trace of the feature", (targetId) => {
    const target = ALL_TARGETS.find((t) => t.id === targetId);
    if (target === undefined) throw new Error(`no target ${targetId}`);
    const out = compile(plain, target).markdown;

    expect(out).not.toContain("Availability");
    expect(out).not.toContain("In stock");
    expect(out).not.toContain("Made to order");
    expect(out).not.toContain("Preorder");
    expect(out).not.toContain("Sold out");
    // Discriminating, so this cannot pass by compiling nothing at all.
    expect(out).toContain("Sign");
    expect(out.length).toBeGreaterThan(50);
  });

  it("puts nothing in the menu file either", () => {
    expect(compile(plain, MENU_FILE).markdown).not.toContain("Availability");
  });
});
