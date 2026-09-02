import { describe, expect, it } from "vitest";

import { compile } from "../../src/compile/compile.js";
import type { Target } from "../../src/compile/capabilities.js";
import { PORTABLE } from "../../src/compile/targets.js";
import type { Block, Document } from "../../src/document/types.js";

/**
 * Quantity pricing, and the per item layout it needs. FR-028 to FR-033.
 *
 * The layout is the risk here, not the field. Turning one table into a block
 * per item changes what everybody sees, so most of these tests are about when
 * it does NOT happen.
 *
 * The portable target writes a dollar sign as `&#36;`, which is why the
 * expectations below read that way. That is the escaping working, not a typo.
 */

function page(...blocks: Block[]): Document {
  return { schemaVersion: 1, target: "portable", blocks };
}

const md = (...blocks: Block[]): string => compile(page(...blocks), "portable").markdown;

const NO_TABLES: Target = {
  ...PORTABLE,
  id: "no-tables-test-host",
  name: "No Tables Test Host",
  capabilities: { ...PORTABLE.capabilities, tables: false },
};

/** A host that will not go deeper than the level a section heading uses. */
const SHALLOW: Target = {
  ...PORTABLE,
  id: "shallow-test-host",
  name: "Shallow Test Host",
  capabilities: { ...PORTABLE.capabilities, maxHeadingLevel: 3 },
};

const compileWith = (target: Target, ...blocks: Block[]): string =>
  compile({ schemaVersion: 1, target: target.id, blocks }, target).markdown;

describe("FR-030: a section with no quantities is untouched", () => {
  it("still emits one table for the whole section", () => {
    const out = md({
      id: "m",
      kind: "menu",
      heading: "Prices",
      tiers: [
        { id: "bust", name: "Bust", price: "45" },
        { id: "full-body", name: "Full body", price: "120" },
      ],
    });
    expect(out).toContain("| Item | Price |");
    expect(out).toContain("| Bust | 45 |");
    expect(out).not.toContain("####");
  });

  it("treats an empty quantities array as no quantities at all", () => {
    const out = md({
      id: "m",
      kind: "menu",
      tiers: [{ id: "bust", name: "Bust", price: "45", quantities: [] }],
    });
    expect(out).toContain("| Item | Price |");
    expect(out).not.toContain("####");
  });

  it("treats quantities that are all half filled as none", () => {
    // Otherwise adding a row and tabbing away would silently re-lay-out the
    // entire section, which is a large change to make on an empty row.
    const out = md({
      id: "m",
      kind: "menu",
      tiers: [
        { id: "bust", name: "Bust", price: "45", quantities: [{ amount: "5", price: "" }] },
        { id: "full-body", name: "Full body", price: "120" },
      ],
    });
    expect(out).toContain("| Item | Price |");
    expect(out).not.toContain("####");
  });
});

describe("FR-028 and FR-031: one item with quantities lays the section out per item", () => {
  const bananas: Block = {
    id: "m",
    kind: "menu",
    heading: "Produce",
    currency: "$",
    tiers: [
      {
        id: "bananas",
        name: "Bananas",
        price: "20",
        unit: "per lb",
        quantities: [
          { amount: "1 lb", price: "20" },
          { amount: "5 lb", price: "90" },
        ],
        details: [{ label: "Origin", value: "Ecuador" }],
      },
      { id: "apples", name: "Apples", price: "3", unit: "each" },
    ],
  };

  it("gives the item a heading carrying its name and price", () => {
    expect(md(bananas)).toContain("#### Bananas, &#36;20 per lb");
  });

  it("puts the quantities in a plain two column table under it", () => {
    const out = md(bananas);
    expect(out).toContain(
      "| Quantity | Price |\n| --- | --- |\n| 1 lb | &#36;20 |\n| 5 lb | &#36;90 |",
    );
  });

  it("keeps the section heading above the item headings", () => {
    const out = md(bananas);
    expect(out.indexOf("### Produce")).toBeLessThan(out.indexOf("#### Bananas"));
    expect(out).toContain("### Produce");
  });

  it("lays out the item that has no quantities the same way", () => {
    // FR-031. Two layouts inside one price list would read as a fault.
    const out = md(bananas);
    expect(out).toContain("#### Apples, &#36;3 each");
    expect(out).not.toContain("| Item | Price |");
  });

  it("gives an item with no quantities no quantity table", () => {
    const out = md(bananas);
    expect(out.match(/\| Quantity \| Price \|/g)).toHaveLength(1);
  });

  it("keeps the details under the item", () => {
    expect(md(bananas)).toContain("- Origin: Ecuador");
  });
});

describe("FR-033: the currency reaches a quantity price", () => {
  it("attaches the symbol to every price in the table", () => {
    const out = md({
      id: "m",
      kind: "menu",
      currency: "$",
      tiers: [
        {
          id: "prints",
          name: "Prints",
          price: "10",
          quantities: [
            { amount: "1", price: "10" },
            { amount: "3", price: "25" },
          ],
        },
      ],
    });
    expect(out).toContain("| 1 | &#36;10 |");
    expect(out).toContain("| 3 | &#36;25 |");
  });

  it("leaves a quantity price that is not a bare number alone", () => {
    // The same rule the item price has always followed. "USD ask" is worse
    // than no currency, because it reads as a mistake the seller made.
    const out = md({
      id: "m",
      kind: "menu",
      currency: "USD",
      tiers: [{ id: "bulk", name: "Bulk", price: "10", quantities: [{ amount: "100+", price: "ask" }] }],
    });
    expect(out).toContain("| 100+ | ask |");
    expect(out).not.toContain("USD ask");
  });
});

describe("FR-029: a half filled break does not reach the page", () => {
  it("drops a break with no price and keeps the rest", () => {
    const out = md({
      id: "m",
      kind: "menu",
      tiers: [
        {
          id: "prints",
          name: "Prints",
          price: "10",
          quantities: [
            { amount: "1", price: "10" },
            { amount: "3", price: "" },
            { amount: "   ", price: "25" },
            { amount: "10", price: "70" },
          ],
        },
      ],
    });
    expect(out).toContain("| 1 | 10 |");
    expect(out).toContain("| 10 | 70 |");
    expect(out).not.toContain("| 3 |");
    expect(out).not.toContain("| 25 |");
  });
});

describe("FR-032: a host without tables still reads correctly", () => {
  const out = (): string =>
    compileWith(NO_TABLES, {
      id: "m",
      kind: "menu",
      currency: "$",
      tiers: [
        {
          id: "bananas",
          name: "Bananas",
          price: "20",
          unit: "per lb",
          quantities: [
            { amount: "1 lb", price: "20" },
            { amount: "5 lb", price: "90" },
          ],
        },
      ],
    });

  it("keeps the item as a heading", () => {
    expect(out()).toContain("#### Bananas, &#36;20 per lb");
  });

  it("turns the quantities into a list", () => {
    expect(out()).toContain("- 1 lb: &#36;20");
    expect(out()).toContain("- 5 lb: &#36;90");
  });

  it("emits no table markup at all", () => {
    expect(out()).not.toContain("| --- |");
  });

  it("warns once that the layout changed", () => {
    const result = compile(
      {
        schemaVersion: 1,
        target: NO_TABLES.id,
        blocks: [
          {
            id: "m",
            kind: "menu",
            tiers: [{ id: "bananas", name: "Bananas", price: "20", quantities: [{ amount: "1 lb", price: "20" }] }],
          },
        ],
      },
      NO_TABLES,
    );
    const warnings = result.diagnostics.filter((d) => d.code === "table_unsupported");
    expect(warnings).toHaveLength(1);
  });
});

describe("the item heading never collides with the section heading", () => {
  it("uses bold instead of a heading when the host will not go deeper", () => {
    const out = compileWith(SHALLOW, {
      id: "m",
      kind: "menu",
      heading: "Produce",
      tiers: [{ id: "bananas", name: "Bananas", price: "20", quantities: [{ amount: "1 lb", price: "20" }] }],
    });
    expect(out).toContain("### Produce");
    expect(out).toContain("**Bananas, 20**");
    expect(out).not.toContain("#### ");
  });
});

describe("an item missing half of its title", () => {
  it("does not put a stray comma in the heading", () => {
    const out = md({
      id: "m",
      kind: "menu",
      tiers: [
        { id: "a", name: "", price: "DM me", quantities: [{ amount: "1", price: "10" }] },
        { id: "b", name: "Sketch", price: "" },
      ],
    });
    expect(out).toContain("#### DM me");
    expect(out).toContain("#### Sketch");
    expect(out).not.toContain("#### ,");
    expect(out).not.toMatch(/####\s*,/);
    expect(out).not.toMatch(/,\s*$/m);
  });
});

describe("nothing a seller types can break the quantity table", () => {
  it("escapes a pipe in an amount", () => {
    const out = md({
      id: "m",
      kind: "menu",
      tiers: [{ id: "odd", name: "Odd", price: "1", quantities: [{ amount: "a | b", price: "2" }] }],
    });
    const row = out.split("\n").find((l) => l.includes("a "));
    expect(row).toBeDefined();
    // The row still has exactly the two cells it is supposed to have.
    expect(row?.split(" | ")).toHaveLength(2);
  });

  it("does not let a newline in an amount start a new row", () => {
    const out = md({
      id: "m",
      kind: "menu",
      tiers: [{ id: "odd", name: "Odd", price: "1", quantities: [{ amount: "a\nb", price: "2" }] }],
    });
    const rows = out.split("\n").filter((l) => l.startsWith("|"));
    // Header, separator, and exactly one quantity row.
    expect(rows).toHaveLength(3);
  });
});
