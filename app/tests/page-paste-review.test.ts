import { expect, it } from "vitest";

import { buildPagePasteReview, findPagePasteSourceCandidates } from "../src/page-paste-review.js";

it.each(["Amount", "Quantity", "Size", "Unit", "Price", "Cost", "Notes", "**Amount**", "_Quantity_"])(
  "keeps a quantity table headed %s as Text instead of creating a product", (label) => {
    const text = `> **Blue Bowl**\n| ${label} | Price |\n| --- | --- |\n| 1 pcs | $20 |\n| 2 pcs | $35 |`;
    const review = buildPagePasteReview({ text, dropped: [], swapped: [] });
    expect(review.rows).toEqual([]);
    expect(review.blocks.some((block) => block.kind === "menu")).toBe(false);
    expect(review.blocks.map((block) => block.kind === "prose" ? block.text : "").join("\n")).toContain(`| ${label} | Price |`);
  },
);

it("reuses a recognized quoted heading with its clean category name", () => {
  const text = "> **Ceramics**\n| Blue Bowl | Price |\n| --- | --- |\n| 1 pcs | $20 |\n| 2 pcs | $35 |";
  expect(findPagePasteSourceCandidates(text, 0).category).toEqual({ sourceLine: 1, sectionIndex: 0, value: "Ceramics" });
  const review = buildPagePasteReview({ text, dropped: [], swapped: [],
    sourceUses: { 1: { role: "category", rowKeys: ["0:4:0", "0:5:0"] } },
    corrections: { "0:4:0": { destinationId: "source:1" }, "0:5:0": { destinationId: "source:1" } },
  });
  expect(review.blocks).toEqual([{ kind: "menu", heading: "Ceramics", tiers: [
    { name: "Blue Bowl", price: "", quantities: [{ amount: "1 pcs", price: "$20" }, { amount: "2 pcs", price: "$35" }] },
  ] }]);
});

it("keeps a quoted source heading clean when its offers move away", () => {
  const text = "> **Ceramics**\n| Blue Bowl | Price |\n| --- | --- |\n| 1 pcs | $20 |\n| 2 pcs | $35 |";
  const review = buildPagePasteReview({ text, dropped: [], swapped: [],
    categories: [{ id: "new:Prints", name: "Prints" }], emptyHeadingChoices: { 0: "keep" },
    corrections: { "0:4:0": { destinationId: "new:Prints" }, "0:5:0": { destinationId: "new:Prints" } },
  });
  expect(review.blocks.find((block) => block.kind === "heading")).toMatchObject({ kind: "heading", text: "Ceramics" });
});

it.each(["**Prints**", "__Prints__", "**Prints 2026**", "**Fine *art***"])("retains standalone label %s as Text in a dense price list", (label) => {
  const text = `${label}\nA3 print - $30\nA4 print - $20\n**Stickers**\nMoon - $5\nStar - $4`;
  const review = buildPagePasteReview({ text, dropped: [], swapped: [] });
  expect(review.rows.map((row) => row.name)).toEqual(["A3 print", "A4 print", "Moon", "Star"]);
  expect(review.blocks.filter((block) => block.kind === "prose").map((block) => block.text)).toEqual([label, "**Stickers**"]);
  expect(review.blocks.filter((block) => block.kind === "menu").flatMap((block) => block.tiers.map((tier) => tier.name)))
    .toEqual(["A3 print", "A4 print", "Moon", "Star"]);
});

it("keeps an explicitly priced bold item", () => {
  const review = buildPagePasteReview({ text: "**Blue Bowl** - $20\nRed Bowl - $25", dropped: [], swapped: [] });
  expect(review.rows.map(({ name, price }) => ({ name, price }))).toEqual([
    { name: "**Blue Bowl**", price: "$20" }, { name: "Red Bowl", price: "$25" },
  ]);
});

it("allows a seller to select a real blank-price item explicitly", () => {
  const text = "**Blue Bowl**\nA3 print - $30\nA4 print - $20";
  const review = buildPagePasteReview({ text, dropped: [], swapped: [0], manualSections: [0],
    corrections: { "0:1:0": { included: true, name: "Blue Bowl" } } });
  expect(review.rows[0]).toMatchObject({ name: "Blue Bowl", price: "", included: true });
  expect(review.blocks.some((block) => block.kind === "menu" && block.tiers.some((tier) => tier.name === "Blue Bowl" && tier.price === ""))).toBe(true);
});

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

it("offers exact preceding source lines and never consumes a matching typed value", () => {
  const text = "# Figures\n\nArrow Orb\n\n| Item | Amount | Price |\n| --- | --- | --- |\n| | 12 oz | $25 |\n| | 16 oz | $32 |";
  expect(findPagePasteSourceCandidates(text, 2)).toEqual({
    name: { sourceLine: 3, sectionIndex: 1, value: "Arrow Orb" },
    category: { sourceLine: 1, sectionIndex: 0, value: "Figures" },
  });
  const base = { text, dropped: [], swapped: [], mappings: { 2: { product: 0, size: 1, price: 2 } },
    corrections: { "2:7:0": { name: "Arrow Orb" }, "2:8:0": { name: "Arrow Orb" } } };
  const typed = buildPagePasteReview(base);
  expect(typed.blocks.map((block) => block.kind)).toEqual(["heading", "prose", "menu"]);
  expect(typed.coverage.find((line) => line.sourceLine === 3)?.kind).toBe("text");
  const chosen = buildPagePasteReview({ ...base, sourceUses: {
    1: { role: "category" as const, rowKeys: ["2:7:0", "2:8:0"] },
    3: { role: "name" as const, rowKeys: ["2:7:0", "2:8:0"] },
  }, corrections: { "2:7:0": { name: "Arrow Orb", destinationId: "source:1" },
    "2:8:0": { name: "Arrow Orb", destinationId: "source:1" } } });
  expect(chosen.blocks).toEqual([{ kind: "menu", heading: "Figures", tiers: [
    { name: "Arrow Orb", price: "", quantities: [
      { amount: "12 oz", price: "$25" }, { amount: "16 oz", price: "$32" },
    ] },
  ] }]);
  expect(chosen.coverage.find((line) => line.sourceLine === 1)?.kind).toBe("usedCategory");
  expect(chosen.coverage.find((line) => line.sourceLine === 3)?.kind).toBe("usedName");
  expect(chosen.coverage.map((line) => line.sourceLine)).toEqual([1, 3, 5, 6, 7, 8]);
});

it("uses the last line of a prose section as a name while retaining an earlier note", () => {
  const text = "# Figures\n\nMaker note\nArrow Orb\n\n| Item | Amount | Price |\n| --- | --- | --- |\n| | 12 oz | $25 |\n| | 16 oz | $32 |";
  expect(findPagePasteSourceCandidates(text, 2)).toEqual({
    name: { sourceLine: 4, sectionIndex: 1, value: "Arrow Orb" },
    category: { sourceLine: 1, sectionIndex: 0, value: "Figures" },
  });
  const base = { text, dropped: [], swapped: [], mappings: { 2: { product: 0, size: 1, price: 2 } } };
  const chosen = buildPagePasteReview({ ...base, sourceUses: {
    1: { role: "category" as const, rowKeys: ["2:8:0", "2:9:0"] },
    4: { role: "name" as const, rowKeys: ["2:8:0", "2:9:0"] },
  }, corrections: {
    "2:8:0": { name: "Arrow Orb", destinationId: "source:1" },
    "2:9:0": { name: "Arrow Orb", destinationId: "source:1" },
  } });
  expect(chosen.blocks.map((block) => block.kind)).toEqual(["prose", "menu"]);
  expect(chosen.blocks[0]?.kind === "prose" ? chosen.blocks[0].text : "").toContain("Maker note");
  expect(chosen.blocks[0]?.kind === "prose" ? chosen.blocks[0].text : "").not.toContain("Arrow Orb");
  expect(chosen.coverage.find((line) => line.sourceLine === 3)?.kind).toBe("text");
  expect(chosen.coverage.find((line) => line.sourceLine === 4)?.kind).toBe("usedName");
  const undone = buildPagePasteReview({ ...base });
  expect(undone.blocks[1]?.kind === "prose" ? undone.blocks[1].text : "").toContain("Maker note\nArrow Orb");
});

it("restores source output after excluding or editing every linked offer and keeps notes", () => {
  const text = "# Figures\n\nArrow Orb\n\n| Item | Amount | Price |\n| --- | --- | --- |\n| | 12 oz | $25 |\n| | 16 oz | $32 |\n\nRemember the glaze";
  const base = { text, dropped: [], swapped: [], mappings: { 2: { product: 0, size: 1, price: 2 } },
    sourceUses: { 1: { role: "category" as const, rowKeys: ["2:7:0", "2:8:0"] },
      3: { role: "name" as const, rowKeys: ["2:7:0", "2:8:0"] } } };
  const active = buildPagePasteReview({ ...base, corrections: {
    "2:7:0": { name: "Arrow Orb", destinationId: "source:1" },
    "2:8:0": { name: "Arrow Orb", destinationId: "source:1" },
  } });
  expect(active.blocks.map((block) => block.kind)).toEqual(["menu", "prose"]);
  expect(active.blocks[1]?.kind === "prose" ? active.blocks[1].text : "").toContain("Remember the glaze");
  const changed = buildPagePasteReview({ ...base, corrections: {
    "2:7:0": { name: "Other", destinationId: "section:2" },
    "2:8:0": { included: false, destinationId: "section:2" },
  } });
  expect(changed.blocks.map((block) => block.kind)).toEqual(["heading", "prose", "menu", "prose"]);
  expect(changed.coverage.find((line) => line.sourceLine === 1)?.kind).toBe("heading");
  expect(changed.coverage.find((line) => line.sourceLine === 3)?.kind).toBe("text");
});

it("rejects a text name across an intervening heading or table", () => {
  const table = "| Item | Amount | Price |\n| --- | --- | --- |\n| | 12 oz | $25 |";
  const afterHeading = `Arrow Orb\n\n# Figures\n\n${table}`;
  expect(findPagePasteSourceCandidates(afterHeading, 2).name).toBeUndefined();
  const afterTable = `Arrow Orb\n\n${table}\n\n${table}`;
  expect(findPagePasteSourceCandidates(afterTable, 2).name).toBeUndefined();
});

it("uses the heading attached to the current table instead of an older heading or name", () => {
  const text = "# Old\n\nArrow\n\n| Item | Amount | Price |\n| --- | --- | --- |\n| | 12 oz | $25 |\n\n# New\n\n| Item | Amount | Price |\n| --- | --- | --- |\n| Vase | 16 oz | $32 |";
  expect(findPagePasteSourceCandidates(text, 3)).toEqual({
    category: { sourceLine: 9, sectionIndex: 3, value: "New" },
  });
});

it("recognizes detached source above a two-column quantity table", () => {
  const text = "# Figures\n\nHandmade\n\n| Arrow Orb | Price |\n| --- | --- |\n| 12 oz | $25 |";
  expect(findPagePasteSourceCandidates(text, 2)).toEqual({
    name: { sourceLine: 3, sectionIndex: 1, value: "Handmade" },
    category: { sourceLine: 1, sectionIndex: 0, value: "Figures" },
  });
  const review = buildPagePasteReview({ text, dropped: [], swapped: [], sourceUses: {
    1: { role: "category", rowKeys: ["2:7:0"] }, 3: { role: "name", rowKeys: ["2:7:0"] },
  }, corrections: { "2:7:0": { name: "Handmade", destinationId: "source:1" } } });
  expect(review.blocks).toEqual([{ kind: "menu", heading: "Figures", tiers: [
    { name: "Handmade", price: "", quantities: [{ amount: "12 oz", price: "$25" }] },
  ] }]);
});

it("suppresses a used Setext heading while retaining its underline as furniture", () => {
  const text = "Figures\n=======\n\nArrow Orb\n\n| Item | Amount | Price |\n| --- | --- | --- |\n| | 12 oz | $25 |";
  const review = buildPagePasteReview({ text, dropped: [], swapped: [],
    mappings: { 2: { product: 0, size: 1, price: 2 } }, sourceUses: {
      1: { role: "category", rowKeys: ["2:8:0"] }, 4: { role: "name", rowKeys: ["2:8:0"] },
    }, corrections: { "2:8:0": { name: "Arrow Orb", destinationId: "source:1" } } });
  expect(review.blocks).toEqual([{ kind: "menu", heading: "Figures", tiers: [
    { name: "Arrow Orb", unit: "12 oz", price: "$25" },
  ] }]);
  expect(review.coverage.find((line) => line.sourceLine === 1)?.kind).toBe("usedCategory");
  expect(review.coverage.find((line) => line.sourceLine === 2)?.kind).toBe("furniture");
});

it("keeps a heading consumed while another included row uses its destination", () => {
  const text = "# Figures\n\nArrow Orb\n\n| Item | Amount | Price |\n| --- | --- | --- |\n| | 12 oz | $25 |\n\nRemember\n\n| Item | Amount | Price |\n| --- | --- | --- |\n| Vase | 16 oz | $32 |";
  const review = buildPagePasteReview({ text, dropped: [], swapped: [], mappings: {
    2: { product: 0, size: 1, price: 2 }, 4: { product: 0, size: 1, price: 2 },
  }, sourceUses: { 1: { role: "category", rowKeys: ["2:7:0"] } }, corrections: {
    "2:7:0": { included: false, destinationId: "source:1" },
    "4:13:0": { destinationId: "source:1" },
  } });
  expect(review.blocks.map((block) => block.kind)).toEqual(["prose", "prose", "menu"]);
  expect(review.blocks.at(-1)).toMatchObject({ kind: "menu", heading: "Figures", tiers: [{ name: "Vase" }] });
  expect(review.coverage.find((line) => line.sourceLine === 1)?.kind).toBe("usedCategory");
});

it("uses four exact names under two headings once and merges only across used lines", () => {
  const table = (first: string, second: string) => ["| Item | Amount | Price |", "| --- | --- | --- |",
    `| | 12 oz | ${first} |`, `| | 16 oz | ${second} |`].join("\n");
  const text = ["# Figures", "", "Arrow Orb", "", table("$25", "$32"), "", "Comet", "",
    table("$28", "$35"), "", "# Ceramics", "", "Blue Bowl", "", table("$40", "$45"),
    "", "Red Bowl", "", table("$50", "$55")].join("\n");
  const cases = [
    { tableIndex: 2, nameLine: 3, headingLine: 1, rowLines: [7, 8], name: "Arrow Orb", heading: "Figures" },
    { tableIndex: 4, nameLine: 10, headingLine: 1, rowLines: [14, 15], name: "Comet", heading: "Figures" },
    { tableIndex: 7, nameLine: 19, headingLine: 17, rowLines: [23, 24], name: "Blue Bowl", heading: "Ceramics" },
    { tableIndex: 9, nameLine: 26, headingLine: 17, rowLines: [30, 31], name: "Red Bowl", heading: "Ceramics" },
  ];
  const mappings: Record<number, { product: number; size: number; price: number }> = {};
  const corrections: Record<string, { name: string; destinationId: string }> = {};
  const sourceUses: Record<number, { role: "name" | "category"; rowKeys: string[] }> = {};
  for (const item of cases) {
    const candidate = findPagePasteSourceCandidates(text, item.tableIndex);
    expect(candidate.name).toMatchObject({ sourceLine: item.nameLine, value: item.name });
    expect(candidate.category).toMatchObject({ sourceLine: item.headingLine, value: item.heading });
    mappings[item.tableIndex] = { product: 0, size: 1, price: 2 };
    const rowKeys = item.rowLines.map((line) => `${String(item.tableIndex)}:${String(line)}:0`);
    for (const key of rowKeys) corrections[key] = { name: item.name, destinationId: `source:${String(item.headingLine)}` };
    sourceUses[item.nameLine] = { role: "name", rowKeys };
    const category = sourceUses[item.headingLine];
    sourceUses[item.headingLine] = { role: "category", rowKeys: [...(category?.rowKeys ?? []), ...rowKeys] };
  }
  const review = buildPagePasteReview({ text, dropped: [], swapped: [], mappings, corrections, sourceUses });
  expect(review.canConfirm).toBe(true);
  expect(review.blocks).toHaveLength(2);
  expect(review.blocks.map((block) => block.kind === "menu" ? [block.heading, block.tiers.map((tier) => tier.name)] : [])).toEqual([
    ["Figures", ["Arrow Orb", "Comet"]], ["Ceramics", ["Blue Bowl", "Red Bowl"]],
  ]);
  expect(review.coverage.filter((line) => line.kind === "usedName")).toHaveLength(4);
  expect(review.coverage.filter((line) => line.kind === "usedCategory")).toHaveLength(2);
  expect(review.coverage.filter((line) => line.kind === "item")).toHaveLength(8);
  expect(review.coverage.map((line) => line.sourceLine)).toEqual(text.split("\n").flatMap((line, index) =>
    line.trim() === "" ? [] : [index + 1]));
});

it("reuses a heading embedded in a prior menu without dropping its offers", () => {
  const text = "# Figures\n\n| Item | Amount | Price |\n| --- | --- | --- |\n| Comet | 12 oz | $25 |\n\nArrow Orb\n\n| Item | Amount | Price |\n| --- | --- | --- |\n| | 16 oz | $32 |";
  expect(findPagePasteSourceCandidates(text, 2)).toEqual({
    name: { sourceLine: 7, sectionIndex: 1, value: "Arrow Orb" },
    category: { sourceLine: 1, sectionIndex: 0, value: "Figures" },
  });
  const review = buildPagePasteReview({ text, dropped: [], swapped: [],
    mappings: { 0: { product: 0, size: 1, price: 2 }, 2: { product: 0, size: 1, price: 2 } },
    sourceUses: { 1: { role: "category", rowKeys: ["2:11:0"] },
      7: { role: "name", rowKeys: ["2:11:0"] } },
    corrections: { "2:11:0": { name: "Arrow Orb", destinationId: "source:1" } },
  });
  expect(review.blocks).toEqual([{ kind: "menu", heading: "Figures", tiers: [
    { name: "Comet", unit: "12 oz", price: "$25" },
    { name: "Arrow Orb", unit: "16 oz", price: "$32" },
  ] }]);
  expect(review.coverage.find((line) => line.sourceLine === 1)?.kind).toBe("usedCategory");
  expect(review.coverage.find((line) => line.sourceLine === 5)?.kind).toBe("item");
});

it("keeps a retained note between menus in the same reused category", () => {
  const text = "# Figures\n\nArrow Orb\n\n| Item | Amount | Price |\n| --- | --- | --- |\n| | 12 oz | $25 |\n\nRemember the glaze\n\nComet\n\n| Item | Amount | Price |\n| --- | --- | --- |\n| | 16 oz | $32 |";
  const review = buildPagePasteReview({ text, dropped: [], swapped: [],
    mappings: { 2: { product: 0, size: 1, price: 2 }, 5: { product: 0, size: 1, price: 2 } },
    sourceUses: { 1: { role: "category", rowKeys: ["2:7:0", "5:15:0"] },
      3: { role: "name", rowKeys: ["2:7:0"] }, 11: { role: "name", rowKeys: ["5:15:0"] } },
    corrections: { "2:7:0": { name: "Arrow Orb", destinationId: "source:1" },
      "5:15:0": { name: "Comet", destinationId: "source:1" } },
  });
  expect(review.blocks.map((block) => block.kind)).toEqual(["menu", "prose", "menu"]);
  expect(review.blocks.filter((block) => block.kind === "menu" && block.heading === "Figures")).toHaveLength(1);
  expect(review.blocks[0]).toMatchObject({ kind: "menu", heading: "Figures", tiers: [
    { name: "Arrow Orb", unit: "12 oz", price: "$25" },
  ] });
  expect(review.blocks[2]).toEqual({ kind: "menu", tiers: [
    { name: "Comet", unit: "16 oz", price: "$32" },
  ] });
  expect(review.blocks[1]?.kind === "prose" ? review.blocks[1].text : "").toContain("Remember the glaze");
  expect(review.coverage.find((line) => line.sourceLine === 9)?.kind).toBe("text");
});

it("emits a reused source heading once when one section contains menu, note, menu", () => {
  const text = "# Figures\n\n| Item | Amount | Price |\n| --- | --- | --- |\n| Vase | 12 oz | $20 |\n\nMug - $25\nA note\nBowl - $32";
  const review = buildPagePasteReview({ text, dropped: [], swapped: [1],
    mappings: { 0: { product: 0, size: 1, price: 2 } }, manualSections: [1],
    sourceUses: { 1: { role: "category", rowKeys: ["0:5:0", "1:7:0", "1:9:0"] } },
    corrections: { "0:5:0": { destinationId: "source:1" },
      "1:7:0": { included: true, name: "Mug", price: "$25", destinationId: "source:1" },
      "1:9:0": { included: true, name: "Bowl", price: "$32", destinationId: "source:1" } },
  });
  expect(review.canConfirm).toBe(true);
  expect(review.blocks.map((block) => block.kind)).toEqual(["menu", "menu", "prose", "menu"]);
  expect(review.blocks.filter((block) => block.kind === "menu" && block.heading === "Figures")).toHaveLength(1);
  expect(review.blocks[0]).toMatchObject({ kind: "menu", heading: "Figures", tiers: [{ name: "Vase", unit: "12 oz", price: "$20" }] });
  expect(review.blocks[1]).toEqual({ kind: "menu", tiers: [{ name: "Mug", price: "$25" }] });
  expect(review.blocks[2]).toEqual({ kind: "prose", text: "A note" });
  expect(review.blocks[3]).toEqual({ kind: "menu", tiers: [{ name: "Bowl", price: "$32" }] });
  expect(review.coverage.find((line) => line.sourceLine === 1)?.kind).toBe("usedCategory");
});

it("repeats a source heading after a different category takes over", () => {
  const text = "# Figures\n\n| Item | Amount | Price |\n| --- | --- | --- |\n| Vase | 12 oz | $20 |\n\n# Ceramics\n\n| Item | Amount | Price |\n| --- | --- | --- |\n| Mug | 16 oz | $25 |\n\n| Item | Amount | Price |\n| --- | --- | --- |\n| Bowl | 20 oz | $32 |";
  const review = buildPagePasteReview({ text, dropped: [], swapped: [],
    mappings: { 0: { product: 0, size: 1, price: 2 }, 1: { product: 0, size: 1, price: 2 },
      2: { product: 0, size: 1, price: 2 } },
    sourceUses: { 1: { role: "category", rowKeys: ["0:5:0", "2:15:0"] } },
    corrections: { "0:5:0": { destinationId: "source:1" },
      "2:15:0": { destinationId: "source:1" } },
  });
  expect(review.canConfirm).toBe(true);
  expect(review.blocks.map((block) => block.kind === "menu" ? block.heading : block.kind)).toEqual([
    "Figures", "Ceramics", "Figures",
  ]);
  expect(review.blocks.filter((block) => block.kind === "menu").flatMap((block) => block.tiers.map((tier) => tier.name)))
    .toEqual(["Vase", "Mug", "Bowl"]);
});

it("repeats a source heading after an unheaded menu in another destination", () => {
  const text = "# Figures\n\n| Item | Amount | Price |\n| --- | --- | --- |\n| Vase | 12 oz | $20 |\n\n| Item | Amount | Price |\n| --- | --- | --- |\n| Mug | 16 oz | $25 |\n\n| Item | Amount | Price |\n| --- | --- | --- |\n| Bowl | 20 oz | $32 |";
  const review = buildPagePasteReview({ text, dropped: [], swapped: [],
    mappings: { 0: { product: 0, size: 1, price: 2 }, 1: { product: 0, size: 1, price: 2 },
      2: { product: 0, size: 1, price: 2 } },
    sourceUses: { 1: { role: "category", rowKeys: ["0:5:0", "2:13:0"] } },
    corrections: { "0:5:0": { destinationId: "source:1" },
      "2:13:0": { destinationId: "source:1" } },
  });
  expect(review.canConfirm).toBe(true);
  expect(review.blocks.map((block) => block.kind === "menu" ? block.heading : block.kind)).toEqual([
    "Figures", undefined, "Figures",
  ]);
  expect(review.blocks.filter((block) => block.kind === "menu").flatMap((block) => block.tiers.map((tier) => tier.name)))
    .toEqual(["Vase", "Mug", "Bowl"]);
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
