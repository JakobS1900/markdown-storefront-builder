/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { expect, it } from "vitest";
import { TARGETS, compile, emptyDocument, parseDocument, serializeDocument } from "@mdsb/engine";
import * as store from "../src/store.js";
import { buildSurface } from "../src/ui/build.js";
import { exportSurface } from "../src/ui/export.js";
import { previewSurface } from "../src/ui/preview.js";
import { renderMarkdown } from "../src/ui/render-markdown.js";

it("saves creator and service price expressions unchanged through Build, Preview and Copy", async () => {
  globalThis.indexedDB = new IDBFactory();
  store.init(true, emptyDocument("rentry"));
  store.startPastingPage();
  store.setPagePasteText([
    "# Creative services", "", "Portrait from $45", "Logo $100 - $200",
    "Lesson $60 / 30 min", "Consultation $90 per 60 min", "Candle, €12,50",
    "Small, woven basket $24",
  ].join("\n"));
  await store.confirmPagePaste();
  expect(store.getState().pastingPage).toBeUndefined();
  const doc = store.getState().doc;
  expect(parseDocument(serializeDocument(doc)).ok).toBe(true);
  const expected = [
    { name: "Portrait", price: "from $45" }, { name: "Logo", price: "$100 - $200" },
    { name: "Lesson", price: "$60 / 30 min" }, { name: "Consultation", price: "$90 per 60 min" },
    { name: "Candle", price: "€12,50" }, { name: "Small, woven basket", price: "$24" },
  ];
  expect(doc.blocks).toMatchObject([{ kind: "heading", text: "Creative services" }, { kind: "menu", tiers: expected }]);
  const menu = doc.blocks[1];
  if (menu === undefined) throw new Error("Imported menu is missing");
  store.selectBlock(menu.id);
  const build = document.createElement("div");
  buildSurface(build);
  const fields = [...build.querySelectorAll<HTMLInputElement>("input")].map((input) => input.value);
  expect(fields).toEqual(expect.arrayContaining(expected.flatMap(({ name, price }) => [name, price])));
  const preview = document.createElement("div");
  previewSurface(preview);
  const visible = preview.querySelector(".rendered")?.textContent ?? "";
  for (const { name, price } of expected) {
    expect(visible).toContain(name);
    expect(visible).toContain(price);
  }
  const copy = document.createElement("div");
  exportSurface(copy);
  expect(copy.querySelector<HTMLTextAreaElement>("#output")?.value).toBe(compile(doc, "rentry").markdown);
  for (const target of TARGETS) {
    const output = compile(doc, target.id);
    expect(output.diagnostics).toEqual([]);
    const rendered = document.createElement("div");
    rendered.append(renderMarkdown(output.markdown));
    for (const { name, price } of expected) {
      expect(rendered.textContent).toContain(name);
      expect(rendered.textContent).toContain(price);
    }
  }
});

it("offers reversed two-column assignment in the real form and saves the chosen fields", async () => {
  globalThis.indexedDB = new IDBFactory();
  store.init(true, emptyDocument("rentry"));
  store.startPastingPage();
  store.setPagePasteText("| Price | Item |\n| --- | --- |\n| $25 | Portrait |\n| $40 | Landscape |");
  const host = document.createElement("div");
  buildSurface(host);
  const selects = [...host.querySelectorAll<HTMLSelectElement>(".page-paste-table select")];
  expect(selects.find((select) => select.labels?.[0]?.textContent === "Product column")?.value).toBe("1");
  expect(selects.find((select) => select.labels?.[0]?.textContent === "Price column")?.value).toBe("0");
  const review = [...host.querySelectorAll("button")].find((button) => button.textContent === "Review these columns as Prices");
  if (review === undefined) throw new Error("Column review action is missing");
  review.click();
  expect(store.getPagePasteReview()?.rows.map(({ name, price }) => ({ name, price }))).toEqual([
    { name: "Portrait", price: "$25" }, { name: "Landscape", price: "$40" },
  ]);
  await store.confirmPagePaste();
  expect(store.getState().pastingPage).toBeUndefined();
  expect(store.getState().doc.blocks).toMatchObject([{ kind: "menu", tiers: [
    { name: "Portrait", price: "$25" }, { name: "Landscape", price: "$40" },
  ] }]);
});

it("reviews CSV in the existing form, retains corrections through undo, and saves notes in order", async () => {
  globalThis.indexedDB = new IDBFactory();
  store.init(true, emptyDocument("rentry"));
  store.startPastingPage();
  const text = '# Ceramics\nPrice,Item,Amount,Notes\n"$1,200","Mug, blue",12 oz,"Say ""hello"""\nAsk me,Bowl,16 oz,Red\nCollect after 5';
  store.setPagePasteText(text);
  const host = document.createElement("div");
  buildSurface(host);
  const selectors = [...host.querySelectorAll<HTMLSelectElement>(".page-paste-table select")];
  expect(selectors.find((select) => select.labels?.[0]?.textContent === "Product column")?.value).toBe("1");
  expect(selectors.find((select) => select.labels?.[0]?.textContent === "Price column")?.value).toBe("0");
  const reviewButton = [...host.querySelectorAll("button")].find((button) => button.textContent === "Review these columns as Prices");
  if (reviewButton === undefined) throw new Error("CSV mapping control missing");
  reviewButton.click();
  expect(store.getPagePasteReview()?.rows[0]).toMatchObject({ key: "0:3:0", name: "Mug, blue", price: "$1,200", amount: "12 oz", details: 'Notes: Say "hello"' });
  store.correctPagePasteRow("0:3:0", { price: "from $25" });
  store.setPagePasteTableMapping(0, { product: 0, price: 1, size: 2 });
  store.resolvePagePasteMapping("keep");
  store.undoPagePasteTableMapping();
  expect(store.getPagePasteReview()?.rows[0]).toMatchObject({ name: "Mug, blue", price: "from $25" });
  store.startPagePasteSourceEdit("Replacement");
  expect(store.applyPagePasteSourceEdit()).toBe(false);
  store.cancelPagePasteSourceEdit();
  expect(store.getState().pastingPage?.text).toBe(text);
  const expected = store.getPagePasteReview()?.blocks;
  await store.confirmPagePaste();
  expect(store.getState().doc.blocks).toMatchObject(expected ?? []);
  expect(store.getState().doc.blocks.map((block) => block.kind)).toEqual(["menu", "prose"]);
  expect(compile(store.getState().doc, "rentry").markdown).toContain("Collect after 5");
  expect(parseDocument(serializeDocument(store.getState().doc)).ok).toBe(true);
});

it("suggests the recognized Service and Rate headers in the existing selectors", () => {
  store.init(true, emptyDocument("rentry"));
  store.startPastingPage();
  store.setPagePasteText("Rate,Service,Notes\n$25,Coaching,Online\n$40,Portrait,Studio");
  const host = document.createElement("div");
  buildSurface(host);
  const selects = [...host.querySelectorAll<HTMLSelectElement>(".page-paste-table select")];
  expect(selects.find((select) => select.labels?.[0]?.textContent === "Product column")?.value).toBe("1");
  expect(selects.find((select) => select.labels?.[0]?.textContent === "Price column")?.value).toBe("0");
});
