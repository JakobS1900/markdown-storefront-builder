import { expect, it } from "vitest";
import { spawnSync } from "node:child_process";

import { buildProposedBlock, readPagePasteTable, readProposal, readRuns, swapProposalKind } from "../src/page-text.js";
import { buildPagePasteReview, findPagePasteSourceCandidates } from "../src/page-paste-review.js";

it("maps quoted CSV through existing rows while preserving physical source lines and notes", () => {
  const text = 'Collect after 5\n# Ceramics\nItem,Amount,Price,Notes\n"Mug, blue",12 oz,"$1,200","Say ""hello"""\nBowl,16 oz,Ask me,Red\nDelivery takes 2 days';
  const proposal = readProposal(text);
  expect(proposal.sections).toHaveLength(3);
  const section = proposal.sections[1];
  expect(section && readPagePasteTable(section)?.rows.map((row) => row.line)).toEqual([4, 5]);
  const review = buildPagePasteReview({ text, dropped: [], swapped: [], mappings: { 1: { product: 0, size: 1, price: 2 } } });
  expect(review.blocks).toEqual([
    { kind: "prose", text: "Collect after 5" },
    { kind: "menu", heading: "Ceramics", tiers: [
      { name: "Mug, blue", unit: "12 oz", price: "$1,200", blurb: 'Notes: Say "hello"' },
      { name: "Bowl", unit: "16 oz", price: "Ask me", blurb: "Notes: Red" },
    ] },
    { kind: "prose", text: "Delivery takes 2 days" },
  ]);
  expect(review.rows.map((row) => row.key)).toEqual(["1:4:0", "1:5:0"]);
  expect(review.coverage.map((line) => line.kind)).toEqual(["text", "heading", "furniture", "item", "item", "text"]);
});

it.each(["Item\tAmount\tPrice\n", ""])("maps TSV with header %j without dropping empty columns or the first item", (header) => {
  const text = `${header}Mug\t\t$0\nBowl\t16 oz\tAsk me`;
  const section = readProposal(text).sections[0];
  expect(section && readPagePasteTable(section)?.headers).toEqual(header === "" ? ["Column 1", "Column 2", "Column 3"] : ["Item", "Amount", "Price"]);
  const review = buildPagePasteReview({ text, dropped: [], swapped: [], mappings: { 0: { product: 0, price: 2, size: 1 } } });
  expect(review.rows.map(({ name, amount, price }) => ({ name, amount, price }))).toEqual([
    { name: "Mug", amount: "", price: "$0" }, { name: "Bowl", amount: "16 oz", price: "Ask me" },
  ]);
  expect(review.blocks).toHaveLength(1);
});

it.each([",", "\t"])("consumes repeated %j headers only after mapping succeeds", (delimiter) => {
  const text = ["Item,Price,Notes", "Mug,$0,Blue", "Item,Price,Notes", "Bowl,Ask me,Red"].join("\n").replaceAll(",", delimiter);
  const retained = buildPagePasteReview({ text, dropped: [], swapped: [] });
  expect(retained.blocks).toEqual([{ kind: "prose", text }]);
  expect(retained.coverage.every((line) => line.kind === "text")).toBe(true);
  const mapped = buildPagePasteReview({ text, dropped: [], swapped: [], mappings: { 0: { product: 0, price: 1 } } });
  expect(mapped.blocks).toHaveLength(1);
  expect(mapped.rows.map((row) => row.sourceLine)).toEqual([2, 4]);
  expect(mapped.coverage.map((line) => line.kind)).toEqual(["furniture", "item", "furniture", "item"]);
});

it.each([",", "\t"])("assigns adjacent %j tables independently when their recognized headers change", (delimiter) => {
  const text = "Item,Price\nMug,$20\nPrice,Item\n$25,Bowl".replaceAll(",", delimiter);
  const review = buildPagePasteReview({ text, dropped: [], swapped: [], mappings: {
    0: { product: 0, price: 1 }, 1: { product: 1, price: 0 },
  } });
  expect(review.rows.map(({ name, price, sourceLine }) => ({ name, price, sourceLine }))).toEqual([
    { name: "Mug", price: "$20", sourceLine: 2 }, { name: "Bowl", price: "$25", sourceLine: 4 },
  ]);
  expect(review.coverage.map((line) => line.kind)).toEqual(["furniture", "item", "furniture", "item"]);
});

it("separates Markdown tables and nearby notes without changing public runs", () => {
  const table = "| Item | Price | Notes |\n| --- | --- | --- |\n| Mug | $20 | Blue |";
  const text = `Before 5\n${table}\nWait 2 days\n${table}\nAfter 6`;
  expect(readRuns(text)).toHaveLength(1);
  const review = buildPagePasteReview({ text, dropped: [], swapped: [], mappings: {
    1: { product: 0, price: 1 }, 3: { product: 0, price: 1 },
  } });
  expect(review.blocks.map((block) => block.kind)).toEqual(["prose", "menu", "prose", "menu", "prose"]);
  expect(review.rows.map((row) => row.sourceLine)).toEqual([4, 8]);
  expect(review.coverage.map((line) => line.sourceLine)).toEqual(Array.from({ length: 9 }, (_, index) => index + 1));
});

it("maps escaped Markdown pipes without phantom columns or repeated-header text", () => {
  const text = "| Item | Price |\n| --- | --- |\n| Mug \\| blue | $20 |\n| Item | Price |\n| Bowl | $25 |";
  const section = readProposal(text).sections[0];
  expect(section && readPagePasteTable(section)?.rows.map((row) => row.cells)).toEqual([["Mug | blue", "$20"], ["Bowl", "$25"]]);
  const mapped = buildPagePasteReview({ text, dropped: [], swapped: [], mappings: { 0: { product: 0, price: 1 } } });
  expect(mapped.blocks).toEqual([{ kind: "menu", tiers: [{ name: "Mug | blue", price: "$20" }, { name: "Bowl", price: "$25" }] }]);
  expect(mapped.coverage.map((line) => line.kind)).toEqual(["furniture", "furniture", "item", "furniture", "item"]);
  expect(buildPagePasteReview({ text, dropped: [], swapped: [] }).blocks).toEqual([{ kind: "prose", text }]);
});

it.each([
  'Item,Price,Notes\nMug,$20,Blue\nBowl,$25',
  'Item,Price,Notes\nMug,$20,"bad"tail\nBowl,$25,Red',
  'Item,Price,Notes\nMug,$20,"first\n\n# quoted heading\nlast"\nBowl,$25,Red',
  'Item,Price,Notes\nMug,$20,"first\n\n# quoted heading\nBowl,$25,Red',
  'Item,Price,Notes\nMug,$20, "first\n\n# quoted heading\nA - $10\nB - $20\nlast"',
  'Item,Price\nMug,$20\n"Blue\n# Bowl\n",$30',
  'Item\tPrice\tNotes\nMug\t$20\tBlue\nBowl\t$25',
])("keeps malformed or multiline tables intact, including after swapping to Prices: %s", (text) => {
  const proposal = readProposal(text);
  expect(proposal.sections).toHaveLength(1);
  const section = proposal.sections[0];
  if (section === undefined) throw new Error("missing source");
  expect(readPagePasteTable(section)).toBeUndefined();
  expect(buildProposedBlock(swapProposalKind(section))).toEqual({ kind: "prose", text });
  const review = buildPagePasteReview({ text, dropped: [], swapped: [] });
  expect(review.blocks).toEqual([{ kind: "prose", text }]);
  expect(review.coverage.map((line) => line.sourceLine)).toEqual(text.split("\n").flatMap((line, index) => line.trim() === "" ? [] : [index + 1]));
});

it("finishes scanning tab-only blank lines instead of retrying the same source position", () => {
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", `
    import { readFileSync } from 'node:fs';
    import ts from 'typescript';
    const source = readFileSync('app/src/page-tables.ts', 'utf8');
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
    const { scanPageTables } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
    console.log(JSON.stringify(scanPageTables(['\\t'])));
  `], { timeout: 5000, encoding: "utf8", windowsHide: true });
  expect(result.error?.message).toBeUndefined();
  expect(result.status).toBe(0);
  expect(result.stdout.trim()).toBe("[]");
  // Only exercise the in-process review after the isolated progress check passes.
  const text = "Item,Price\nMug,$20\n \t \nItem,Price\nBowl,$25";
  const review = buildPagePasteReview({ text, dropped: [], swapped: [], mappings: {
    0: { product: 0, price: 1 }, 1: { product: 0, price: 1 },
  } });
  expect(review.rows.map((row) => row.sourceLine)).toEqual([2, 5]);
  expect(review.sections.map((section) => section.source.source).join("\n")).toBe(text);
}, 10000);

it.each([",", "\t"])("does not interpret a mapped %j item name as a Markdown heading", (delimiter) => {
  const text = "Item,Price\n# Blue bowl,$20\nRed bowl,$25".replaceAll(",", delimiter);
  const review = buildPagePasteReview({ text, dropped: [], swapped: [], mappings: { 0: { product: 0, price: 1 } } });
  expect(review.blocks).toEqual([{ kind: "menu", tiers: [{ name: "# Blue bowl", price: "$20" }, { name: "Red bowl", price: "$25" }] }]);
  expect(review.coverage.map((line) => line.kind)).toEqual(["furniture", "item", "item"]);
  expect(findPagePasteSourceCandidates(text, 0).category).toBeUndefined();
});

it("keeps ordinary comma prose and simple price lists on their existing path", () => {
  const prose = "Hello, collectors";
  expect(buildPagePasteReview({ text: prose, dropped: [], swapped: [] }).blocks).toEqual([{ kind: "prose", text: prose }]);
  const text = "Mug,$20\nBowl,$25";
  expect(buildPagePasteReview({ text, dropped: [], swapped: [] }).rows.map((row) => row.name)).toEqual(["Mug", "Bowl"]);
});

it("keeps ordinary headerless two-column TSV automatic while allowing explicit assignment", () => {
  const text = "Mug\t$20\nBowl\tAsk me";
  const review = buildPagePasteReview({ text, dropped: [], swapped: [] });
  expect(review.blocks).toEqual([{ kind: "menu", tiers: [{ name: "Mug", price: "$20" }, { name: "Bowl", price: "Ask me" }] }]);
  const section = readProposal(text).sections[0];
  expect(section && readPagePasteTable(section)?.rows).toHaveLength(2);
  const sizes = "Mug\t12 oz\nBowl\t16 oz";
  expect(buildPagePasteReview({ text: sizes, dropped: [], swapped: [] }).blocks).toEqual([{ kind: "prose", text: sizes }]);
});
