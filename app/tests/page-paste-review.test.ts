import { expect, it } from "vitest";

import { buildPagePasteReview } from "../src/page-paste-review.js";

it("keeps mapped source rows stable and covers each nonempty line once", () => {
  const source = [
    "# Ceramics",
    "",
    "| Product | Size | Price | Notes |",
    "| --- | --- | --- | --- |",
    ...Array.from({ length: 21 }, (_, i) => `| Item ${String(i + 1)} | 12 oz | $${String(i + 1)} | Note ${String(i + 1)} |`),
    "",
    "A note between offers",
    "",
    "| Product | Size | Price |",
    "| --- | --- | --- |",
    "| Final item | 16 oz | $32 |",
  ].join("\n");
  const choices = { text: source, dropped: [], swapped: [], mappings: { 0: { product: 0, size: 1, price: 2 }, 2: { product: 0, size: 1, price: 2 } } };
  const first = buildPagePasteReview(choices);
  expect(buildPagePasteReview(choices)).toEqual(first);
  expect(first.rows.find((row) => row.sourceLine === 25)).toMatchObject({
    key: "0:25:0", sectionIndex: 0, name: "Item 21", amount: "12 oz", price: "$21", details: "Notes: Note 21",
  });
  expect(first.coverage.map((entry) => entry.sourceLine)).toEqual(
    source.split("\n").flatMap((line, index) => line.trim() === "" ? [] : [index + 1]),
  );
  expect(first.coverage.find((entry) => entry.sourceLine === 27)?.kind).toBe("text");
  expect(first.blocks.map((block) => block.kind)).toEqual(["menu", "prose", "menu"]);
  expect(first.blocks[0]).toMatchObject({ kind: "menu", tiers: expect.arrayContaining([{ name: "Item 1", price: "$1", unit: "12 oz", blurb: "Notes: Note 1" }]) });
  expect(first.blocks[2]).toMatchObject({ kind: "menu", tiers: [{ name: "Final item", price: "$32" }] });
});

it("keeps a section beyond one hundred and counts the same blocks it returns", () => {
  const text = Array.from({ length: 102 }, (_, index) => `Section ${String(index + 1)}`).join("\n\n");
  const result = buildPagePasteReview({ text, dropped: [1], swapped: [] });
  expect(result.sections).toHaveLength(102);
  expect(result.sections[101]?.block).toMatchObject({ kind: "prose", text: "\nSection 102" });
  expect(result.blocks).toHaveLength(101);
  expect(result.blocks).toEqual(result.sections.flatMap((section) => section.included ? [section.block] : []));
});

it("retains an unparsed nonempty line between recognized offers in source order", () => {
  const result = buildPagePasteReview({ text: "Mug - $28\n* \nBowl - $32", dropped: [], swapped: [] });
  expect(result.blocks.map((block) => block.kind)).toEqual(["menu", "prose", "menu"]);
  expect(result.blocks[0]).toMatchObject({ kind: "menu", tiers: [{ name: "Mug", price: "$28" }] });
  expect(result.blocks[1]).toMatchObject({ kind: "prose", text: "* " });
  expect(result.blocks[2]).toMatchObject({ kind: "menu", tiers: [{ name: "Bowl", price: "$32" }] });
  expect(result.coverage.map((entry) => entry.kind)).toEqual(["item", "text", "item"]);
});

it("keeps a category heading before retained Text that precedes the first offer", () => {
  const result = buildPagePasteReview({ text: "# Ceramics\n* \nMug - $28\nBowl - $32", dropped: [], swapped: [] });
  expect(result.blocks.map((block) => block.kind)).toEqual(["heading", "prose", "menu"]);
  expect(result.blocks[0]).toMatchObject({ kind: "heading", text: "Ceramics", level: 1 });
  expect(result.blocks[1]).toMatchObject({ kind: "prose", text: "* " });
  expect(result.blocks[2]).toMatchObject({ kind: "menu", heading: "Ceramics" });
  expect(result.coverage.map((entry) => entry.kind)).toEqual(["heading", "text", "item", "item"]);
});

it("gives automatic Prices rows stable source keys and the fields Add will use", () => {
  const result = buildPagePasteReview({ text: "Mug - $28\nBowl - $32", dropped: [], swapped: [] });
  expect(result.rows).toEqual([
    { key: "0:1:0", sectionIndex: 0, sourceLine: 1, name: "Mug", amount: "", price: "$28", details: "" },
    { key: "0:2:0", sectionIndex: 0, sourceLine: 2, name: "Bowl", amount: "", price: "$32", details: "" },
  ]);
});

it("gives quantity offers their own source keys under the shared item name", () => {
  const result = buildPagePasteReview({
    text: "| Mug | Price |\n| --- | --- |\n| 12 oz | $28 |\n| 16 oz | $32 |", dropped: [], swapped: [],
  });
  expect(result.rows).toEqual([
    { key: "0:3:0", sectionIndex: 0, sourceLine: 3, name: "Mug", amount: "12 oz", price: "$28", details: "" },
    { key: "0:4:0", sectionIndex: 0, sourceLine: 4, name: "Mug", amount: "16 oz", price: "$32", details: "" },
  ]);
});

it("covers a saved divider as furniture rather than retained Text", () => {
  const result = buildPagePasteReview({ text: "---", dropped: [], swapped: [] });
  expect(result.blocks).toEqual([{ kind: "divider" }]);
  expect(result.coverage).toEqual([{ sectionIndex: 0, sourceLine: 1, kind: "furniture" }]);
});
