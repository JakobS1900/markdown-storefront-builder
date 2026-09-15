/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { compile, emptyDocument, parseDocument, serializeDocument } from "@mdsb/engine";
import * as store from "../src/store.js";
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
