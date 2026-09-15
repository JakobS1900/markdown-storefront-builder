import { expect, it } from "vitest";

import { buildProposedBlock, readProposal, swapProposalKind } from "../src/page-text.js";

const table = (name: string, rows: string) => `| ${name} | price |\n| :--- | ----: |\n${rows}`;

it.each(["\n", "\n\n"])("keeps product headers and quantity prices under quoted categories with separator %j", (separator) => {
  const source = [
    "> **CATEGORY1**", "",
    table("ITEM", "| 1qty | $100 |\n| 2qty | $200 |"),
    table("ITEM2", "| 2qty | $200 |\n| 3qty | $400 |"),
  ].join(separator) + "\n\n> **CATEGORY2**\n\n" + table("ITEM1", "| 100qty | $100 |\n| 200qty | $200 |");
  const proposal = readProposal(source);
  expect(proposal.sections.map(buildProposedBlock)).toEqual([
    { kind: "menu", heading: "CATEGORY1", tiers: [
      { name: "ITEM", price: "", quantities: [{ amount: "1qty", price: "$100" }, { amount: "2qty", price: "$200" }] },
      { name: "ITEM2", price: "", quantities: [{ amount: "2qty", price: "$200" }, { amount: "3qty", price: "$400" }] },
    ] },
    { kind: "menu", heading: "CATEGORY2", tiers: [
      { name: "ITEM1", price: "", quantities: [{ amount: "100qty", price: "$100" }, { amount: "200qty", price: "$200" }] },
    ] },
  ]);
  expect(proposal.sections.map((section) => section.source).join("\n")).toBe(source);
  for (const section of proposal.sections) {
    expect(buildProposedBlock(swapProposalKind(section))).toEqual({ kind: "prose", text: section.source });
    expect(buildProposedBlock(swapProposalKind(swapProposalKind(section)))).toEqual(buildProposedBlock(section));
  }
});

it("leaves ordinary blockquotes as text and generic product rows as products", () => {
  expect(readProposal("> Please read carefully").sections.map(buildProposedBlock)).toEqual([{ kind: "prose", text: "> Please read carefully" }]);
  expect(readProposal(table("Item", "| Figure | $100 |\n| Badge | $5 |")).sections.map(buildProposedBlock)).toEqual([
    { kind: "menu", tiers: [{ name: "Figure", price: "$100" }, { name: "Badge", price: "$5" }] },
  ]);
});

it.each(["> **Please read carefully**", "> **Please read carefully**\n\nThis is a warning."])("keeps bold quoted prose as swappable Text: %s", (source) => {
  const sections = readProposal(source).sections;
  expect(sections.every((section) => section.kind === "prose" && section.swappable)).toBe(true);
  expect(sections.map((section) => section.source).join("\n")).toBe(source);
});

it.each([
  "| 1qty | $100 |\n| 2qty | |",
  "| 1qty | $100 |\nAsk before ordering",
  "| 1qty | $100 |\n| 2qty | $200 | limited edition |",
])("keeps uncertain quantity tables as Text without dropping their header or note: %s", (rows) => {
  const source = table("Star Wars figure", rows);
  expect(readProposal(source).sections.map(buildProposedBlock)).toEqual([{ kind: "prose", text: source }]);
});

it("keeps a separate note after a category's price tables", () => {
  const source = "> **Figures**\n\n" + table("Trooper", "| 100g | $10 |") + "\n\nAsk before ordering";
  expect(readProposal(source).sections.map(buildProposedBlock)).toEqual([
    { kind: "menu", heading: "Figures", tiers: [{ name: "Trooper", price: "", quantities: [{ amount: "100g", price: "$10" }] }] },
    { kind: "prose", text: "\nAsk before ordering" },
  ]);
});
