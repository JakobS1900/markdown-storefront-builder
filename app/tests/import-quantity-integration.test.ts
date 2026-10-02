/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { compile, emptyDocument, parseDocument, serializeDocument } from "@mdsb/engine";
import * as store from "../src/store.js";
import { readPagePasteTable, readProposal } from "../src/page-text.js";
import { buildSurface } from "../src/ui/build.js";
import { exportSurface } from "../src/ui/export.js";
import { previewSurface } from "../src/ui/preview.js";
import { renderMarkdown } from "../src/ui/render-markdown.js";

it("saves the supplied menu as five named products and renders all sixteen quantity prices under their categories", async () => {
  globalThis.indexedDB = new IDBFactory();
  store.init(true, emptyDocument("rentry"));
  store.startPastingPage();
  store.setPagePasteText(readFileSync("app/tests/fixtures/quantity-menu.md", "utf8"));
  await store.confirmPagePaste();
  expect(store.getState().pastingPage).toBeUndefined();
  const doc = store.getState().doc;
  expect(parseDocument(serializeDocument(doc)).ok).toBe(true);
  const menus = doc.blocks.filter((block) => block.kind === "menu");
  expect(menus.map((menu) => menu.heading)).toEqual(["CATEGORY1", "CATEGORY2"]);
  expect(menus.map((menu) => menu.tiers.map((tier) => tier.name))).toEqual([
    ["ITEM", "ITEM2", "ITEM3"], ["ITEM1", "ITEM2"],
  ]);
  expect(menus.flatMap((menu) => menu.tiers.map((tier) => tier.quantities?.length))).toEqual([5, 2, 1, 3, 5]);
  const output = compile(doc, "rentry");
  expect(output.diagnostics).toEqual([]);
  const host = document.createElement("div");
  host.append(renderMarkdown(output.markdown));
  expect([...host.querySelectorAll("h3, h4")].map((node) => node.textContent)).toEqual([
    "CATEGORY1", "ITEM", "ITEM2", "ITEM3", "CATEGORY2", "ITEM1", "ITEM2",
  ]);
  expect([...host.querySelectorAll("tbody")].map((body) => [...body.rows].map((row) =>
    [...row.cells].map((cell) => cell.textContent),
  ))).toEqual([
    [["1qty", "$100"], ["2qty", "$200"], ["3qty", "$300"], ["4qty", "$400"], ["5qty", "$500"]],
    [["2qty", "$200"], ["3qty", "$400"]],
    [["1qty", "$100"]],
    [["100qty", "$100"], ["200qty", "$200"], ["300qty", "$300"]],
    [["1qty", "$100"], ["2qty", "$200"], ["3qty", "$300"], ["4qty", "$400"], ["5qty", "$500"]],
  ]);
  expect(host.textContent).toContain("!!!Danger MORE INFO");
  expect(host.querySelectorAll("strong")).toHaveLength(2);
});

it("keeps a moved offer before a retained note in Build, Preview and Copy", async () => {
  globalThis.indexedDB = new IDBFactory();
  store.init(true, emptyDocument("rentry"));
  store.startPastingPage();
  store.setPagePasteText([
    "# Figures", "", "| Item | Amount | Price |", "| --- | --- | --- |",
    "| Orb | 12 oz | $25 |", "| Orb | 16 oz | $32 |", "| Cup | 20 oz | $40 |",
    "", "A note between the offers", "", "# Prints", "", "| Item | Amount | Price |",
    "| --- | --- | --- |", "| Kite | 24 oz | $48 |", "| Wing | 28 oz | $56 |",
  ].join("\n"));
  store.setPagePasteTableMapping(0, { product: 0, size: 1, price: 2 });
  store.setPagePasteTableMapping(2, { product: 0, size: 1, price: 2 });
  store.togglePagePasteRowSelection("0:7:0", true);
  store.moveSelectedPagePasteRows("section:2");
  const reviewed = store.getPagePasteReview();
  expect(reviewed?.blocks.map((block) => block.kind)).toEqual(["menu", "menu", "prose", "menu"]);
  expect(reviewed?.blocks[1]).toMatchObject({ kind: "menu", heading: "Prints", tiers: [{ name: "Cup", unit: "20 oz", price: "$40" }] });
  await store.confirmPagePaste();
  const doc = store.getState().doc;
  expect(parseDocument(serializeDocument(doc)).ok).toBe(true);
  expect(doc.blocks).toMatchObject(reviewed?.blocks ?? []);
  expect(doc.blocks.filter((block) => block.kind === "menu").map((block) => block.kind === "menu"
    ? [block.heading, ...block.tiers.map((tier) => tier.name)] : [])).toEqual([
    ["Figures", "Orb"], ["Prints", "Cup"], ["Prints", "Kite", "Wing"],
  ]);

  const build = document.createElement("div");
  const buildValues: string[] = [];
  for (const block of doc.blocks.filter((item) => item.kind === "menu")) {
    store.selectBlock(block.id);
    buildSurface(build);
    buildValues.push(...[...build.querySelectorAll<HTMLInputElement>(".block-editor input")].map((input) => input.value));
  }
  expect(buildValues).toEqual(
    expect.arrayContaining(["Orb", "Cup", "Kite", "Wing"]),
  );
  const preview = document.createElement("div");
  previewSurface(preview);
  const visible = preview.querySelector(".rendered")?.textContent ?? "";
  for (const value of ["Orb", "Cup", "Kite", "Wing", "12 oz", "$25", "16 oz", "$32", "20 oz", "$40", "24 oz", "$48", "28 oz", "$56"])
    expect(visible).toContain(value);
  expect(visible.indexOf("Cup")).toBeLessThan(visible.indexOf("A note between the offers"));
  expect(visible.indexOf("A note between the offers")).toBeLessThan(visible.indexOf("Kite"));

  const copy = document.createElement("div");
  exportSurface(copy);
  const markdown = copy.querySelector<HTMLTextAreaElement>("#output")?.value ?? "";
  expect(markdown).toBe(compile(doc, "rentry").markdown);
  expect(markdown.indexOf("Cup")).toBeLessThan(markdown.indexOf("A note between the offers"));
  expect(markdown.indexOf("A note between the offers")).toBeLessThan(markdown.indexOf("Kite"));
});

it("saves four detached item names under two chosen categories with every amount and price", async () => {
  globalThis.indexedDB = new IDBFactory();
  store.init(true, emptyDocument("rentry"));
  const items = [
    { name: "Arrow Orb", category: "Figures", amounts: ["12 oz", "16 oz"], prices: ["$25", "$32"] },
    { name: "Arrow Vase", category: "Figures", amounts: ["20 oz", "24 oz"], prices: ["$40", "$48"] },
    { name: "Arrow Kite", category: "Prints", amounts: ["8 in", "12 in"], prices: ["$15", "$22"] },
    { name: "Arrow Wing", category: "Prints", amounts: ["16 in", "20 in"], prices: ["$30", "$36"] },
  ];
  const source = ["# Figures", "", ...items.flatMap((item, index) => [
    ...(index === 2 ? ["# Prints", ""] : []),
    item.name, "", "| Item | Amount | Price |", "| --- | --- | --- |",
    `| | ${item.amounts[0]} | ${item.prices[0]} |`, `| | ${item.amounts[1]} | ${item.prices[1]} |`, "",
  ])].join("\n");
  store.startPastingPage();
  store.setPagePasteText(source);
  const tables = readProposal(source).sections.flatMap((section, index) => readPagePasteTable(section) ? [index] : []);
  expect(tables).toHaveLength(4);
  for (const index of tables) store.setPagePasteTableMapping(index, { product: 0, size: 1, price: 2 });
  items.forEach((item, index) => {
    const section = store.getPagePasteReview()?.sections[tables[index] ?? -1];
    expect(section?.rows).toHaveLength(2);
    for (const row of section?.rows ?? []) store.togglePagePasteRowSelection(row.key, true);
    store.applyPagePasteSharedName(item.name);
    if (index === 0 || index === 2) store.createPagePasteCategoryForSelected(item.category);
    else store.moveSelectedPagePasteRows(index === 1 ? "new:0" : "new:1");
    store.clearPagePasteRowSelection();
  });
  const reviewed = store.getPagePasteReview();
  expect(reviewed?.canConfirm).toBe(true);
  expect(reviewed?.coverage.filter((line) => line.kind === "item")).toHaveLength(8);
  expect(reviewed?.coverage.filter((line) => line.kind === "text")).toHaveLength(4);
  await store.confirmPagePaste();
  const doc = store.getState().doc;
  const menus = doc.blocks.filter((block) => block.kind === "menu");
  expect(menus.map((menu) => menu.heading)).toEqual(["Figures", "Figures", "Prints", "Prints"]);
  expect(menus.map((menu) => menu.tiers[0]?.name)).toEqual(items.map((item) => item.name));
  expect(menus.map((menu) => menu.tiers[0]?.quantities)).toEqual(items.map((item) =>
    item.amounts.map((amount, index) => ({ amount, price: item.prices[index] }))));
  const build = document.createElement("div");
  const buildNames: string[] = [];
  for (const menu of menus) {
    store.selectBlock(menu.id);
    buildSurface(build);
    buildNames.push(...[...build.querySelectorAll<HTMLInputElement>(".block-editor input")].map((input) => input.value));
  }
  for (const item of items) expect(buildNames).toContain(item.name);
  const preview = document.createElement("div");
  previewSurface(preview);
  const rendered = preview.querySelector(".rendered")?.textContent ?? "";
  for (const item of items) {
    expect(rendered).toContain(item.name);
    for (const amount of item.amounts) expect(rendered).toContain(amount);
    for (const price of item.prices) expect(rendered).toContain(price);
  }
  const copy = document.createElement("div");
  exportSurface(copy);
  const markdown = copy.querySelector<HTMLTextAreaElement>("#output")?.value ?? "";
  expect(markdown).toBe(compile(doc, "rentry").markdown);
  const copied = document.createElement("div");
  copied.append(renderMarkdown(markdown));
  for (const item of items) {
    expect(copied.textContent).toContain(item.name);
    for (const amount of item.amounts) expect(copied.textContent).toContain(amount);
    for (const price of item.prices) expect(copied.textContent).toContain(price);
  }
});
