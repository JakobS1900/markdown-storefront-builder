/**
 * A cost must never reach a compiled page.
 *
 * The app exists to publish this document to a paste host. A supplier cost in
 * that output is a disclosure the seller never agreed to, on a page they
 * published themselves, and it cannot be taken back once it is on the internet.
 * This is the test that makes `cost` safe to store at all.
 */
import { describe, expect, it } from "vitest";

import { compile, TARGETS, type Document } from "@mdsb/engine";

const COST = "SUPPLIER-COST-9179";

const doc: Document = {
  schemaVersion: 3,
  target: "rentry",
  blocks: [
    {
      id: "prices",
      kind: "menu",
      heading: "Prices",
      tiers: [
        { id: "a", name: "Widget", price: "12.99", cost: COST },
        { id: "b", name: "Gadget", price: "24.99", cost: COST, unit: "each" },
      ],
    },
  ],
};

describe("a cost", () => {
  it("appears in no target's output", () => {
    for (const target of TARGETS) {
      const result = compile(doc, target);
      expect([target.id, result.markdown.includes(COST)]).toEqual([target.id, false]);
    }
  });

  it("survives a tier carrying every other optional field", () => {
    // The synthetic case above has plain tiers. An emitter that walked a tier's
    // fields generically would leak only on a richer shape, so this one carries
    // every optional field the descriptor allows alongside the cost.
    const rich: Document = {
      schemaVersion: 3,
      target: "rentry",
      blocks: [
        {
          id: "prices",
          kind: "menu",
          heading: "Prices",
          currency: "USD",
          tiers: [
            {
              id: "a",
              name: "Widget",
              price: "12.99",
              unit: "each",
              blurb: "A widget",
              includes: ["One thing"],
              details: [{ label: "Colour", value: "Black" }],
              quantities: [{ amount: "5", price: "50" }],
              imageUrls: ["https://example.com/a.jpg"],
              cost: COST,
            },
          ],
          addOns: [{ name: "Extra", price: "5" }],
        },
      ],
    };

    for (const target of TARGETS) {
      expect([target.id, compile(rich, target).markdown.includes(COST)]).toEqual([target.id, false]);
    }
  });

  it("does not become a diagnostic either", () => {
    // A warning naming the cost would publish it into the app's own interface,
    // which is not the page but is still somewhere the seller might screenshot.
    for (const target of TARGETS) {
      const messages = compile(doc, target).diagnostics.map((d) => d.message).join(" ");
      expect(messages.includes(COST)).toBe(false);
    }
  });
});
