import { expect, it } from "vitest";

import { buildPagePasteReview } from "../src/page-paste-review.js";

it.each([
  ["Item", "Amount", "Price"], ["Item", "Price", "Amount"],
  ["Amount", "Item", "Price"], ["Amount", "Price", "Item"],
  ["Price", "Item", "Amount"], ["Price", "Amount", "Item"],
])("reviews corrected fields in %s, %s, %s column order", (...headers) => {
  const values: Record<string, string> = { Item: "Mug", Amount: "12 oz", Price: "from $25" };
  const text = `| ${headers.join(" | ")} | Notes |\n| --- | --- | --- | --- |\n| ${headers.map((header) => values[header]).join(" | ")} | Blue |`;
  const mapping = { product: headers.indexOf("Item"), size: headers.indexOf("Amount"), price: headers.indexOf("Price") };
  const baseline = buildPagePasteReview({ text, dropped: [], swapped: [], mappings: { 0: mapping } });
  expect(baseline.rows[0]).toMatchObject({ name: "Mug", amount: "12 oz", price: "from $25", details: "Notes: Blue" });
  expect(baseline.blocks[0]).toMatchObject({ kind: "menu", tiers: [{ name: "Mug", unit: "12 oz", price: "from $25", blurb: "Notes: Blue" }] });
  const review = buildPagePasteReview({ text, dropped: [], swapped: [], mappings: { 0: mapping }, corrections: {
    "0:3:0": { name: "Large mug", amount: "16 oz", price: "Ask me", details: "Glazed" },
  } });
  expect(review.rows[0]).toMatchObject({ sourceLine: 3, name: "Large mug", amount: "16 oz", price: "Ask me", details: "Glazed", included: true });
  expect(review.blocks).toEqual([{ kind: "menu", tiers: [{ name: "Large mug", unit: "16 oz", price: "Ask me", blurb: "Glazed" }] }]);
  expect(review.canConfirm).toBe(true);
});

it("keeps exact free-text and zero prices, repeated headers, and unassigned cells", () => {
  const text = "| Item | Amount | Price | Notes |\n| --- | --- | --- | --- |\n| Mug | 12 oz | $0 | Blue |\n| Item | Amount | Price | Notes |\n| --- | --- | --- | --- |\n| Bowl | 16 oz | from $25 | Red |";
  const review = buildPagePasteReview({ text, dropped: [], swapped: [], mappings: { 0: { product: 0, size: 1, price: 2 } } });
  expect(review.rows.map((row) => row.price)).toEqual(["$0", "from $25"]);
  expect(review.rows.map((row) => row.details)).toEqual(["Notes: Blue", "Notes: Red"]);
  expect(review.blocks[0]).toMatchObject({ kind: "menu", tiers: [{ name: "Mug", price: "$0" }, { name: "Bowl", price: "from $25" }] });
});

it("requires a decision for missing and numeric names while allowing an intentional blank price", () => {
  const text = "| Item | Amount | Price |\n| --- | --- | --- |\n| | 12 oz | $25 |\n| 42 | 16 oz | |";
  const base = { text, dropped: [], swapped: [], mappings: { 0: { product: 0, size: 1, price: 2 } } };
  const unresolved = buildPagePasteReview(base);
  expect(unresolved.canConfirm).toBe(false);
  expect(unresolved.rows[0]?.issue).toMatch(/name/i);
  expect(unresolved.rows[1]?.issue).toMatch(/numeric/i);
  const resolved = buildPagePasteReview({ ...base, corrections: { "0:3:0": { name: "Mug" }, "0:4:0": { acceptedNumericName: true } } });
  expect(resolved.canConfirm).toBe(true);
  expect(resolved.sections[0]?.issue).toBeUndefined();
  expect(resolved.rows[1]?.price).toBe("");
  expect(resolved.rows[1]?.warning).toMatch(/No price is set/);
  expect(resolved.blocks[0]).toMatchObject({ kind: "menu", tiers: [{ name: "Mug", unit: "12 oz", price: "$25" }, { name: "42", unit: "16 oz" }] });
});

it("excludes one reviewed row without changing its neighbour", () => {
  const text = "| Item | Amount | Price |\n| --- | --- | --- |\n| Mug | 12 oz | $25 |\n| Bowl | 16 oz | $32 |";
  const review = buildPagePasteReview({ text, dropped: [], swapped: [], mappings: { 0: { product: 0, size: 1, price: 2 } }, corrections: { "0:3:0": { included: false } } });
  expect(review.rows.map((row) => row.included)).toEqual([false, true]);
  expect(review.blocks[0]).toMatchObject({ kind: "menu", tiers: [{ name: "Bowl", price: "$32" }] });
  expect(review.coverage.find((line) => line.sourceLine === 3)?.kind).toBe("excluded");
});

it("manually selects one ambiguous Text line and retains its neighbours in order", () => {
  const text = "Product,Price\nMug,$25\nA note";
  const review = buildPagePasteReview({ text, dropped: [], swapped: [], manualSections: [0], corrections: {
    "0:2:0": { included: true, name: "Mug", price: "$25" },
  } });
  expect(review.blocks).toEqual([
    { kind: "prose", text: "Product,Price" },
    { kind: "menu", tiers: [{ name: "Mug", price: "$25" }] },
    { kind: "prose", text: "A note" },
  ]);
  expect(review.coverage.map((line) => line.kind)).toEqual(["text", "item", "text"]);
  expect(review.sections[0]?.issue).toMatch(/Unselected.*Text/);
  expect(review.canConfirm).toBe(true);
});

it("keeps the other quantity offer when one amount-price pair is edited", () => {
  const text = "| Mug | Price |\n| --- | --- |\n| 12 oz | $28 |\n| 16 oz | $32 |";
  const review = buildPagePasteReview({ text, dropped: [], swapped: [], corrections: { "0:4:0": { price: "$35" } } });
  expect(review.canConfirm).toBe(true);
  expect(review.blocks[0]).toMatchObject({ kind: "menu", tiers: [{ name: "Mug", quantities: [{ amount: "12 oz", price: "$28" }, { amount: "16 oz", price: "$35" }] }] });
  expect(review.rows.map((row) => row.price)).toEqual(["$28", "$35"]);
});

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
    { key: "0:1:0", sectionIndex: 0, sourceLine: 1, destinationId: "section:0", name: "Mug", amount: "", price: "$28", details: "", included: true },
    { key: "0:2:0", sectionIndex: 0, sourceLine: 2, destinationId: "section:0", name: "Bowl", amount: "", price: "$32", details: "", included: true },
  ]);
});

it("gives quantity offers their own source keys under the shared item name", () => {
  const result = buildPagePasteReview({
    text: "| Mug | Price |\n| --- | --- |\n| 12 oz | $28 |\n| 16 oz | $32 |", dropped: [], swapped: [],
  });
  expect(result.rows).toEqual([
    { key: "0:3:0", sectionIndex: 0, sourceLine: 3, destinationId: "section:0", name: "Mug", amount: "12 oz", price: "$28", details: "", included: true },
    { key: "0:4:0", sectionIndex: 0, sourceLine: 4, destinationId: "section:0", name: "Mug", amount: "16 oz", price: "$32", details: "", included: true },
  ]);
});

it("covers a saved divider as furniture rather than retained Text", () => {
  const result = buildPagePasteReview({ text: "---", dropped: [], swapped: [] });
  expect(result.blocks).toEqual([{ kind: "divider" }]);
  expect(result.coverage).toEqual([{ sectionIndex: 0, sourceLine: 1, kind: "furniture" }]);
});

it("connects detached names to selected amount and price rows without consuming the names", () => {
  const text = "Arrow Orb\n\n| Item | Amount | Price |\n| --- | --- | --- |\n| | 12 oz | $25 |\n| | 16 oz | $32 |";
  const review = buildPagePasteReview({ text, dropped: [], swapped: [], mappings: {
    1: { product: 0, size: 1, price: 2 },
  }, corrections: {
    "1:5:0": { name: "Arrow Orb" }, "1:6:0": { name: "Arrow Orb" },
  } });
  expect(review.canConfirm).toBe(true);
  expect(review.blocks).toEqual([
    { kind: "prose", text: "Arrow Orb" },
    { kind: "menu", tiers: [{ name: "Arrow Orb", price: "", quantities: [
      { amount: "12 oz", price: "$25" }, { amount: "16 oz", price: "$32" },
    ] }] },
  ]);
  expect(review.coverage.find((line) => line.sourceLine === 1)?.kind).toBe("text");
  expect(review.coverage.filter((line) => line.kind === "item").map((line) => line.sourceLine)).toEqual([5, 6]);
});

it("moves offers to distinct destinations with the same visible name and retains intervening notes", () => {
  const text = "# Ceramics\n\n| Item | Amount | Price |\n| --- | --- | --- |\n| Mug | 12 oz | $25 |\n| Bowl | 16 oz | $32 |\n\nRemember the glaze\n\n# Ceramics\n\n| Item | Amount | Price |\n| --- | --- | --- |\n| Vase | 20 oz | $40 |";
  const review = buildPagePasteReview({ text, dropped: [], swapped: [], mappings: {
    0: { product: 0, size: 1, price: 2 }, 2: { product: 0, size: 1, price: 2 },
  }, categories: [{ id: "new:0", name: "Ceramics" }], corrections: {
    "0:6:0": { destinationId: "new:0" },
  } });
  expect(review.categories.map((category) => category.id)).toEqual(["section:0", "section:2", "new:0"]);
  expect(review.categories.map((category) => category.name)).toEqual(["Ceramics", "Ceramics", "Ceramics"]);
  expect(review.rows.find((row) => row.sourceLine === 6)?.destinationId).toBe("new:0");
  expect(review.blocks.map((block) => block.kind)).toEqual(["menu", "menu", "prose", "menu"]);
  expect(review.blocks[1]).toMatchObject({ kind: "menu", heading: "Ceramics", tiers: [{ name: "Bowl" }] });
  expect(review.blocks[2]).toMatchObject({ kind: "prose" });
  expect(review.blocks[2]?.kind === "prose" ? review.blocks[2].text : "").toContain("Remember the glaze");
  expect(review.blocks[3]).toMatchObject({ kind: "menu", heading: "Ceramics", tiers: [{ name: "Vase" }] });
});

it("keeps offers with different details separate while grouping compatible adjacent offers", () => {
  const text = "| Item | Amount | Price | Notes |\n| --- | --- | --- | --- |\n| Figure | 12 oz | $25 | Blue |\n| Figure | 16 oz | $32 | Blue |\n| Figure | 20 oz | $40 | Red |";
  const review = buildPagePasteReview({ text, dropped: [], swapped: [], mappings: { 0: { product: 0, size: 1, price: 2 } } });
  expect(review.blocks).toEqual([{ kind: "menu", tiers: [
    { name: "Figure", price: "", blurb: "Notes: Blue", quantities: [
      { amount: "12 oz", price: "$25" }, { amount: "16 oz", price: "$32" },
    ] },
    { name: "Figure", unit: "20 oz", price: "$40", blurb: "Notes: Red" },
  ] }]);
});

it("does not publish an untouched blank selling price when another row is corrected", () => {
  const text = "| Item | Amount | Price |\n| --- | --- | --- |\n| Mug | 12 oz | $25 |\n| Bowl | 16 oz | |";
  const base = { text, dropped: [], swapped: [], mappings: { 0: { product: 0, size: 1, price: 2 } } };
  const oneEdit = buildPagePasteReview({ ...base, corrections: { "0:3:0": { name: "Large mug" } } });
  expect(oneEdit.blocks).toEqual([{ kind: "prose", text }]);
  expect(oneEdit.canConfirm).toBe(false);
  const bothEdited = buildPagePasteReview({ ...base, corrections: {
    "0:3:0": { name: "Large mug" }, "0:4:0": { price: "Ask me" },
  } });
  expect(bothEdited.canConfirm).toBe(true);
  expect(bothEdited.blocks).toMatchObject([{ kind: "menu", tiers: [
    { name: "Large mug", price: "$25" }, { name: "Bowl", price: "Ask me" },
  ] }]);
  const intentionallyBlank = buildPagePasteReview({ ...base, corrections: {
    "0:3:0": { name: "Large mug" }, "0:4:0": { price: "" },
  } });
  expect(intentionallyBlank.canConfirm).toBe(true);
  expect(intentionallyBlank.blocks[0]).toMatchObject({ kind: "menu", tiers: [
    { name: "Large mug", price: "$25" }, { name: "Bowl", price: "" },
  ] });
});

it("requires a choice for a heading after every offer is excluded", () => {
  const draft = { text: "# Ceramics\n\n| Item | Amount | Price |\n| --- | --- | --- |\n| Mug | 12 oz | $25 |",
    dropped: [], swapped: [], mappings: { 0: { product: 0, size: 1, price: 2 } },
    corrections: { "0:5:0": { included: false } } };
  const unresolved = buildPagePasteReview(draft);
  expect(unresolved.sections[0]?.rows[0]?.included).toBe(false);
  expect(unresolved.canConfirm).toBe(false);
  expect(unresolved.blocks).toEqual([{ kind: "heading", text: "Ceramics", level: 1 }]);
  const kept = buildPagePasteReview({ ...draft, emptyHeadingChoices: { 0: "keep" } });
  expect(kept.canConfirm).toBe(true);
  expect(kept.coverage.find((line) => line.sourceLine === 1)?.kind).toBe("heading");
  const removed = buildPagePasteReview({ ...draft, emptyHeadingChoices: { 0: "remove" } });
  expect(removed.canConfirm).toBe(true);
  expect(removed.blocks).toEqual([]);
  expect(removed.coverage.find((line) => line.sourceLine === 1)?.kind).toBe("excluded");
});
