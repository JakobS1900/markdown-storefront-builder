/** @vitest-environment node */
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { compile, emptyDocument, parseDocument, serializeDocument } from "@mdsb/engine";
import * as db from "../src/db.js";
import { openBackup } from "../src/import.js";
import { buildPagePasteReview } from "../src/page-paste-review.js";
import * as reader from "../src/page-text.js";
import * as store from "../src/store.js";

beforeEach(async () => {
  globalThis.indexedDB = new IDBFactory();
  const doc = emptyDocument("pastebin");
  store.init(true, doc, "original");
  for (const id of ["original", "another"]) {
    await db.writePage({ id, json: serializeDocument(doc), title: id, updatedAt: 1 });
  }
});
afterEach(() => vi.restoreAllMocks());

it("keeps row corrections in the draft and saves the frozen reviewed values", async () => {
  const source = "| Amount | Price | Item | Notes |\n| --- | --- | --- | --- |\n| 12 oz | $25 | Mug | Blue |\n| 16 oz | $32 | Bowl | Red |";
  store.startPastingPage();
  store.setPagePasteText(source);
  store.setPagePasteTableMapping(0, { product: 2, size: 0, price: 1 });
  store.correctPagePasteRow("0:3:0", { name: "Large mug", amount: "20 oz", price: "Ask me", details: "Glazed" });
  store.correctPagePasteRow("0:4:0", { included: false });
  expect(store.getState().pastingPage?.corrections).toMatchObject({ "0:3:0": { price: "Ask me" }, "0:4:0": { included: false } });
  const proposed = buildPagePasteReview(store.getState().pastingPage ?? { text: "", dropped: [], swapped: [] });
  expect(proposed.canConfirm).toBe(true);
  expect(proposed.blocks[0]).toMatchObject({ kind: "menu", tiers: [{ name: "Large mug", unit: "20 oz", price: "Ask me", blurb: "Glazed" }] });
  await store.confirmPagePaste();
  expect(store.getState().doc.blocks[0]).toMatchObject(proposed.blocks[0] ?? {});
  expect(compile(store.getState().doc, "pastebin").markdown).toContain("Ask me");
});

it("assigns a shared name and new category to selected rows before saving", async () => {
  store.startPastingPage();
  store.setPagePasteText("# Figures\n\n| Item | Amount | Price |\n| --- | --- | --- |\n| | 12 oz | $25 |\n| | 16 oz | $32 |");
  store.setPagePasteTableMapping(0, { product: 0, size: 1, price: 2 });
  store.togglePagePasteRowSelection("0:5:0", true);
  store.togglePagePasteRowSelection("0:6:0", true);
  store.applyPagePasteSharedName("Arrow Orb");
  store.createPagePasteCategoryForSelected("Limited figures");
  store.setPagePasteEmptyHeadingChoice(0, "keep");
  const review = store.getPagePasteReview();
  expect(review?.rows.map((row) => [row.name, row.destinationId])).toEqual([
    ["Arrow Orb", "new:0"], ["Arrow Orb", "new:0"],
  ]);
  expect(review?.blocks).toContainEqual(expect.objectContaining({ kind: "menu", heading: "Limited figures", tiers: [
    expect.objectContaining({ name: "Arrow Orb", quantities: [
      { amount: "12 oz", price: "$25" }, { amount: "16 oz", price: "$32" },
    ] }),
  ] }));
  await store.confirmPagePaste();
  expect(store.getState().doc.blocks).toMatchObject(review?.blocks ?? []);
  const output = compile(store.getState().doc, "pastebin").markdown;
  expect(output).toContain("Limited figures");
  expect(output).toContain("Arrow Orb");
});

it("waits for an untouched blank price before saving corrected mapped rows", async () => {
  const before = await db.listPages();
  const original = store.getState().doc;
  store.startPastingPage();
  store.setPagePasteText("| Item | Amount | Price |\n| --- | --- | --- |\n| Mug | 12 oz | $25 |\n| Bowl | 16 oz | |");
  store.setPagePasteTableMapping(0, { product: 0, size: 1, price: 2 });
  store.correctPagePasteRow("0:3:0", { name: "Large mug" });
  expect(store.getPagePasteReview()?.canConfirm).toBe(false);
  await store.confirmPagePaste();
  expect(await db.listPages()).toEqual(before);
  expect(store.getState().doc).toBe(original);
  expect(store.getState().pastingPage?.corrections?.["0:3:0"]?.name).toBe("Large mug");
  store.correctPagePasteRow("0:4:0", { price: "" });
  expect(store.getPagePasteReview()?.canConfirm).toBe(true);
  await store.confirmPagePaste();
  expect(store.getState().doc.blocks).toMatchObject([{ kind: "menu", tiers: [
    { name: "Large mug", price: "$25" }, { name: "Bowl", price: "" },
  ] }]);
});

it("clears selections across review pages after one shared-name action", () => {
  store.startPastingPage();
  store.setPagePasteText(["| Item | Amount | Price |", "| --- | --- | --- |",
    ...Array.from({ length: 7 }, (_, index) => `| Item ${String(index + 1)} | 12 oz | $25 |`)].join("\n"));
  store.setPagePasteTableMapping(0, { product: 0, size: 1, price: 2 });
  store.togglePagePasteRowSelection("0:3:0", true);
  store.togglePagePasteRowSelection("0:9:0", true);
  store.applyPagePasteSharedName("Shared figure");
  expect(store.getPagePasteReview()?.rows.filter((row) => row.selected)).toHaveLength(2);
  store.clearPagePasteRowSelection();
  expect(store.getPagePasteReview()?.rows.filter((row) => row.selected)).toHaveLength(0);
  store.togglePagePasteRowSelection("0:4:0", true);
  store.applyPagePasteSharedName("Separate figure");
  expect(store.getPagePasteReview()?.rows.map((row) => row.name)).toEqual([
    "Shared figure", "Separate figure", "Item 3", "Item 4", "Item 5", "Item 6", "Shared figure",
  ]);
});

it("blocks an unnamed included price row until named or excluded", async () => {
  store.startPastingPage();
  store.setPagePasteText("| Item | Amount | Price |\n| --- | --- | --- |\n| | 12 oz | $25 |");
  store.setPagePasteTableMapping(0, { product: 0, size: 1, price: 2 });
  const before = await db.listPages();
  await store.confirmPagePaste();
  expect(await db.listPages()).toEqual(before);
  expect(store.getState().pastingPage).toBeDefined();
  store.correctPagePasteRow("0:3:0", { name: "Mug" });
  await store.confirmPagePaste();
  expect(store.getState().doc.blocks[0]).toMatchObject({ kind: "menu", tiers: [{ name: "Mug", price: "$25" }] });
});

it("keeps a corrected source fixed until the separate source editor exists", () => {
  store.startPastingPage();
  store.setPagePasteText("Mug - $25\nBowl - $32");
  store.correctPagePasteRow("0:1:0", { price: "$0" });
  store.setPagePasteText("Replacement");
  expect(store.getState().pastingPage?.text).toBe("Mug - $25\nBowl - $32");
  expect(store.getState().pastingPage?.corrections?.["0:1:0"]?.price).toBe("$0");
});

it("lets another table choose columns after the first table has corrections", async () => {
  const table = (name: string, price: string): string => `| Item | Amount | Price |\n| --- | --- | --- |\n| ${name} | 12 oz | ${price} |`;
  store.startPastingPage();
  store.setPagePasteText(`${table("Mug", "$25")}\n\n${table("Bowl", "$32")}`);
  store.setPagePasteTableMapping(0, { product: 0, size: 1, price: 2 });
  store.correctPagePasteRow("0:3:0", { price: "Ask me" });
  store.setPagePasteTableMapping(1, { product: 0, size: 1, price: 2 });
  expect(store.getState().pastingPage?.mappings?.[1]).toEqual({ product: 0, size: 1, price: 2 });
  store.setPagePasteTableMapping(0, { product: 2, size: 1, price: 0 });
  expect(store.getState().pastingPage?.mappings?.[0]).toEqual({ product: 0, size: 1, price: 2 });
  store.resolvePagePasteMapping("cancel");
  await store.confirmPagePaste();
  expect(store.getState().doc.blocks).toEqual([
    expect.objectContaining({ kind: "menu", tiers: [expect.objectContaining({ name: "Mug", price: "Ask me" })] }),
    expect.objectContaining({ kind: "menu", tiers: [expect.objectContaining({ name: "Bowl", price: "$32" })] }),
  ]);
});

it("reuses one review for an unchanged draft and refreshes it after an edit", () => {
  store.startPastingPage();
  store.setPagePasteText("Mug - $25\nBowl - $32");
  const before = store.getPagePasteReview();
  expect(before).toBeDefined();
  expect(store.getPagePasteReview()).toBe(before);
  store.correctPagePasteRow("0:1:0", { price: "Ask me" });
  const after = store.getPagePasteReview();
  expect(after).not.toBe(before);
  expect(after?.rows[0]?.price).toBe("Ask me");
  expect(store.getPagePasteReview()).toBe(after);
});

it("keeps all paste decisions in memory until confirm, including cancellation", async () => {
  const before = await db.listPages();
  const doc = store.getState().doc;
  const writes = vi.spyOn(db, "writePage");
  store.startPastingPage();
  store.setPagePasteText("# Shop\n\nHello there");
  store.dropPagePasteSection(1);
  expect(store.getState().pastingPage?.dropped).toEqual([1]);
  store.restorePagePasteSection(1);
  expect(store.getState().pastingPage?.dropped).toEqual([]);
  store.swapPagePasteSection(1);
  expect(store.getState().pastingPage?.swapped).toEqual([1]);
  store.setPagePasteText("Replacement");
  expect(store.getState().pastingPage?.text).toContain("Hello there");
  store.startPagePasteSourceEdit("Replacement");
  expect(store.applyPagePasteSourceEdit(true)).toBe(true);
  expect(store.getState().pastingPage).toMatchObject({ text: "Replacement", dropped: [], swapped: [], reviewStart: 0 });
  store.stopPastingPage();
  expect(store.getState().pastingPage).toBeUndefined();
  expect(writes).not.toHaveBeenCalled();
  expect(store.getState().doc).toBe(doc);
  expect(await db.listPages()).toEqual(before);
});

it("adds exactly one valid page, preserving every stored byte and the current target", async () => {
  const before = await db.listPages();
  store.startPastingPage();
  store.setPagePasteText("# Shop\n\nPortrait $20\nIcon $10\n\n---\n\nLeave this out");
  const proposal = reader.readProposal(store.getState().pastingPage?.text ?? "");
  store.dropPagePasteSection(proposal.sections.length - 1);
  await store.confirmPagePaste();
  const after = await db.listPages();
  expect(after).toHaveLength(before.length + 1);
  for (const page of before) expect(after.find((item) => item.id === page.id)).toEqual(page);
  const doc = store.getState().doc;
  expect(doc.target).toBe("pastebin");
  expect(doc.title).toBe("Shop");
  expect(JSON.stringify(doc)).not.toContain("Leave this out");
  expect(parseDocument(after.find((page) => page.id === store.getState().pageId)?.json ?? "").ok).toBe(true);
  const ids = doc.blocks.flatMap((block) => [block.id, ...(block.kind === "menu" ? block.tiers.map((tier) => tier.id) : [])]);
  expect(ids.every((id) => id.length > 0)).toBe(true);
  expect(new Set(ids).size).toBe(ids.length);
  expect(store.getState().pastingPage).toBeUndefined();
  expect(store.getState().status.message).toMatch(/new page.*previous page.*Your pages/i);
});

it("keeps a public second numeric column in the confirmed page", async () => {
  store.startPastingPage();
  store.setPagePasteText("Sketch, 30, 10 slots\nIcon, 12, 2 slots");
  await store.confirmPagePaste();
  expect(store.getState().doc.blocks).toEqual([
    expect.objectContaining({
      kind: "prose",
      text: "Sketch, 30, 10 slots\nIcon, 12, 2 slots",
    }),
  ]);
});

it("holds a mapping only for its source and saves the reviewed values", async () => {
  const source = "| Price | Product | Size | Notes |\n| --- | --- | --- | --- |\n| from $28 | Mug | 12 oz | Blue |";
  store.startPastingPage();
  store.setPagePasteText(source);
  store.setPagePasteTableMapping(0, { product: 1, price: 0, size: 2 });
  expect(store.getState().pastingPage?.mappings?.[0]).toEqual({ product: 1, price: 0, size: 2 });
  await store.confirmPagePaste();
  expect(store.getState().doc.blocks[0]).toMatchObject({ kind: "menu", tiers: [{ name: "Mug", price: "from $28", unit: "12 oz", blurb: "Notes: Blue" }] });
  store.startPastingPage();
  store.setPagePasteText(source);
  store.setPagePasteTableMapping(0, { product: 1, price: 0, size: 2 });
  store.setPagePasteText("replacement");
  expect(store.getState().pastingPage?.mappings?.[0]).toEqual({ product: 1, price: 0, size: 2 });
  store.startPagePasteSourceEdit("replacement");
  expect(store.applyPagePasteSourceEdit(true)).toBe(true);
  expect(store.getState().pastingPage?.mappings).toBeUndefined();
  store.stopPastingPage();
  expect(store.getState().pastingPage).toBeUndefined();
});

it("saves the same ordered blocks and title shown by the pure review", async () => {
  const source = "# Ceramics\n\n| Product | Size | Price |\n| --- | --- | --- |\n| Mug | 12 oz | $28 |\n\nA note between offers\n\n| Product | Size | Price |\n| --- | --- | --- |\n| Bowl | 16 oz | $32 |";
  store.startPastingPage();
  store.setPagePasteText(source);
  store.setPagePasteTableMapping(0, { product: 0, size: 1, price: 2 });
  store.setPagePasteTableMapping(2, { product: 0, size: 1, price: 2 });
  const review = buildPagePasteReview(store.getState().pastingPage ?? { text: "", dropped: [], swapped: [] });
  await store.confirmPagePaste();
  const saved = store.getState().doc;
  expect(saved.title).toBe(review.title);
  expect(saved.blocks).toHaveLength(review.blocks.length);
  expect(saved.blocks.map((block) => block.kind)).toEqual(review.blocks.map((block) => block.kind));
  review.blocks.forEach((block, index) => expect(saved.blocks[index]).toMatchObject(block));
});

it("saves an unparsed line between offers as Text rather than losing it", async () => {
  store.startPastingPage();
  store.setPagePasteText("Mug - $28\n* \nBowl - $32");
  await store.confirmPagePaste();
  expect(store.getState().doc.blocks.map((block) => block.kind)).toEqual(["menu", "prose", "menu"]);
  expect(store.getState().doc.blocks[1]).toMatchObject({ kind: "prose", text: "* " });
});

it("saves a category heading before retained Text and its later offers", async () => {
  store.startPastingPage();
  store.setPagePasteText("# Ceramics\n* \nMug - $28\nBowl - $32");
  await store.confirmPagePaste();
  expect(store.getState().doc.blocks.map((block) => block.kind)).toEqual(["heading", "prose", "menu"]);
  expect(store.getState().doc.blocks[0]).toMatchObject({ kind: "heading", text: "Ceramics" });
  expect(store.getState().doc.blocks[1]).toMatchObject({ kind: "prose", text: "* " });
  expect(store.getState().doc.blocks[2]).toMatchObject({ kind: "menu", heading: "Ceramics" });
});

it("freezes source and cancel while confirmation is writing", async () => {
  store.startPastingPage();
  store.setPagePasteText("Hello");
  let release: () => void = () => {};
  const pending = new Promise<void>((resolve) => { release = resolve; });
  const write = db.writePage;
  vi.spyOn(db, "writePage").mockImplementation(async (page) => { await pending; await write(page); });
  const confirmation = store.confirmPagePaste();
  expect(store.getState().pastingPage?.confirming).toBe(true);
  store.setPagePasteText("New words");
  store.stopPastingPage();
  expect(store.getState().pastingPage?.text).toBe("Hello");
  release();
  await confirmation;
  expect(store.getState().doc.blocks[0]).toMatchObject({ kind: "prose", text: "Hello" });
});

it("binds the draft to its starting page and pauses Add after a page switch", async () => {
  store.startPastingPage();
  store.setPagePasteText("Original page offer");
  expect(store.getState().pastingPage).toMatchObject({ originPageId: "original", target: "pastebin" });
  await store.openPage("another");
  const writes = vi.spyOn(db, "writePage");
  await store.confirmPagePaste();
  expect(writes).not.toHaveBeenCalled();
  expect(store.getState().pastingPage?.text).toBe("Original page offer");
  expect(store.getState().pageId).toBe("another");
  await store.openPage("original");
  await store.confirmPagePaste();
  expect(store.getState().doc.blocks[0]).toMatchObject({ kind: "prose", text: "Original page offer" });
});

it("holds a page switch already in flight until confirmation has adopted its page", async () => {
  store.startPastingPage();
  store.setPagePasteText("Confirmed page offer");
  let releaseRead: () => void = () => {};
  const pendingRead = new Promise<void>((resolve) => { releaseRead = resolve; });
  const read = db.readPage;
  const reading = vi.spyOn(db, "readPage").mockImplementation(async (id) => { await pendingRead; return read(id); });
  const switchPage = store.openPage("another");
  for (let i = 0; i < 50 && reading.mock.calls.length === 0; i += 1) await new Promise((resolve) => setTimeout(resolve, 10));
  expect(reading).toHaveBeenCalled();
  const confirmation = store.confirmPagePaste();
  releaseRead();
  await Promise.all([switchPage, confirmation]);
  expect(store.getState().doc.blocks[0]).toMatchObject({ kind: "prose", text: "Confirmed page offer" });
  expect(store.getState().pageId).not.toBe("another");
});

it("rejects other page switches while the confirmed page is being written", async () => {
  store.startPastingPage();
  store.setPagePasteText("Confirmed offer");
  let releaseWrite: () => void = () => {};
  const pendingWrite = new Promise<void>((resolve) => { releaseWrite = resolve; });
  const write = db.writePage;
  vi.spyOn(db, "writePage").mockImplementation(async (page) => { await pendingWrite; await write(page); });
  const confirmation = store.confirmPagePaste();
  await store.openPage("another");
  await store.newPage("rentry");
  store.adopt("another", emptyDocument("rentry"));
  expect(store.getState().pageId).toBe("original");
  releaseWrite();
  await confirmation;
  expect(store.getState().doc.blocks[0]).toMatchObject({ kind: "prose", text: "Confirmed offer" });
  expect(store.getState().doc.target).toBe("pastebin");
});

it("refuses a competing backup before it writes during paste confirmation", async () => {
  store.startPastingPage();
  store.setPagePasteText("Confirmed offer");
  let releaseWrite: () => void = () => {};
  const pendingWrite = new Promise<void>((resolve) => { releaseWrite = resolve; });
  const write = db.writePage;
  const writes = vi.spyOn(db, "writePage").mockImplementation(async (page) => { await pendingWrite; await write(page); });
  const confirmation = store.confirmPagePaste();
  const competing = openBackup(serializeDocument(emptyDocument("pastebin")));
  const attemptedWrites = writes.mock.calls.length;
  releaseWrite();
  const result = await competing;
  await confirmation;
  expect(attemptedWrites).toBe(1);
  expect(result.ok).toBe(false);
  expect(await db.listPages()).toHaveLength(3);
});

it("lets a backup already being written finish before paste confirmation starts", async () => {
  store.startPastingPage();
  store.setPagePasteText("Still in the draft");
  let releaseWrite: () => void = () => {};
  const pendingWrite = new Promise<void>((resolve) => { releaseWrite = resolve; });
  const write = db.writePage;
  const writes = vi.spyOn(db, "writePage").mockImplementation(async (page) => { await pendingWrite; await write(page); });
  const opening = openBackup(serializeDocument(emptyDocument("pastebin")));
  const confirmation = store.confirmPagePaste();
  const writesBeforeRelease = writes.mock.calls.length;
  releaseWrite();
  const result = await opening;
  await confirmation;
  expect(writesBeforeRelease).toBe(1);
  expect(result.ok).toBe(true);
  expect(store.getState().pageId).not.toBe("original");
  expect(store.getState().pastingPage?.text).toBe("Still in the draft");
  expect(await db.listPages()).toHaveLength(3);
});

it("keeps a wide public price table intact in the saved page and Copy result", async () => {
  const source = "| Product | Size | Price |\n| --- | --- | --- |\n| Mug | 12 oz | $28 |\n| Bowl | 16 oz | $32 |";
  store.startPastingPage();
  store.setPagePasteText(source);
  store.swapPagePasteSection(0);
  await store.confirmPagePaste();
  expect(store.getState().doc.blocks).toEqual([expect.objectContaining({ kind: "prose", text: source })]);
  const copied = compile(store.getState().doc, "pastebin").markdown;
  expect(copied).toContain("Mug \\| 12 oz \\| &#36;28");
  expect(copied).toContain("Bowl \\| 16 oz \\| &#36;32");
});

it("asks before remapping a corrected table, keeps edits by source row, and undoes the mapping", () => {
  store.startPastingPage();
  store.setPagePasteText("| Item | Amount | Price |\n| --- | --- | --- |\n| Mug | 12 oz | $25 |");
  store.setPagePasteTableMapping(0, { product: 0, size: 1, price: 2 });
  store.correctPagePasteRow("0:3:0", { price: "Ask me" });
  store.setPagePasteTableMapping(0, { product: 2, size: 1, price: 0 });
  expect(store.getState().pastingPage?.mappings?.[0]).toEqual({ product: 0, size: 1, price: 2 });
  expect(store.getState().pastingPage?.pendingMapping).toMatchObject({ index: 0 });
  store.resolvePagePasteMapping("cancel");
  expect(store.getState().pastingPage?.corrections?.["0:3:0"]?.price).toBe("Ask me");
  store.setPagePasteTableMapping(0, { product: 2, size: 1, price: 0 });
  store.resolvePagePasteMapping("keep");
  expect(store.getPagePasteReview()?.rows[0]).toMatchObject({ key: "0:3:0", name: "$25", price: "Ask me" });
  store.undoPagePasteTableMapping();
  expect(store.getPagePasteReview()?.rows[0]).toMatchObject({ key: "0:3:0", name: "Mug", price: "Ask me" });
});

it("can discard edited values for one remap and undo that discard", () => {
  store.startPastingPage();
  store.setPagePasteText("| Item | Amount | Price |\n| --- | --- | --- |\n| Mug | 12 oz | $25 |");
  store.setPagePasteTableMapping(0, { product: 0, size: 1, price: 2 });
  store.correctPagePasteRow("0:3:0", { price: "Ask me" });
  store.setPagePasteTableMapping(0, { product: 2, size: 1, price: 0 });
  store.resolvePagePasteMapping("discard");
  expect(store.getPagePasteReview()?.rows[0]).toMatchObject({ name: "$25", price: "Mug" });
  store.undoPagePasteTableMapping();
  expect(store.getPagePasteReview()?.rows[0]).toMatchObject({ name: "Mug", price: "Ask me" });
});

it("expires mapping undo before a later category edit can be lost", () => {
  store.startPastingPage();
  store.setPagePasteText("| Item | Amount | Price |\n| --- | --- | --- |\n| Mug | 12 oz | $25 |");
  store.setPagePasteTableMapping(0, { product: 0, size: 1, price: 2 });
  store.correctPagePasteRow("0:3:0", { price: "Ask me" });
  store.setPagePasteTableMapping(0, { product: 2, size: 1, price: 0 });
  store.resolvePagePasteMapping("keep");
  store.togglePagePasteRowSelection("0:3:0", true);
  store.createPagePasteCategoryForSelected("Gifts");
  expect(store.getState().pastingPage?.mappingUndo).toBeUndefined();
  store.undoPagePasteTableMapping();
  expect(store.getPagePasteReview()?.rows[0]?.destinationId).toBe("new:0");
});

it("buffers source replacement and cancels without losing review choices", () => {
  store.startPastingPage();
  store.setPagePasteText("| Item | Price |\n| --- | --- |\n| Mug | $25 |");
  store.setPagePasteTableMapping(0, { product: 0, price: 1 });
  store.correctPagePasteRow("0:3:0", { price: "Ask me" });
  store.startPagePasteSourceEdit();
  store.setPagePasteSourceBuffer("Bowl - $32");
  expect(store.getState().pastingPage?.text).toContain("Mug | $25");
  expect(store.applyPagePasteSourceEdit()).toBe(false);
  store.cancelPagePasteSourceEdit();
  expect(store.getState().pastingPage?.corrections?.["0:3:0"]?.price).toBe("Ask me");
  store.startPagePasteSourceEdit("Bowl - $32");
  expect(store.applyPagePasteSourceEdit(true)).toBe(true);
  expect(store.getState().pastingPage).toMatchObject({ text: "Bowl - $32", dropped: [], swapped: [] });
  expect(store.getState().pastingPage?.corrections).toBeUndefined();
});

it("closes an unchanged source buffer without asking to discard corrections", () => {
  store.startPastingPage();
  store.setPagePasteText("| Item | Amount | Price |\n| --- | --- | --- |\n| Mug | 12 oz | $25 |");
  store.setPagePasteTableMapping(0, { product: 0, size: 1, price: 2 });
  store.correctPagePasteRow("0:3:0", { price: "Ask me" });
  const revision = store.getState().pastingPage?.sourceRevision;
  store.startPagePasteSourceEdit();
  expect(store.applyPagePasteSourceEdit()).toBe(true);
  expect(store.getState().pastingPage?.sourceBuffer).toBeUndefined();
  expect(store.getState().pastingPage?.sourceRevision).toBe(revision);
  expect(store.getState().pastingPage?.corrections?.["0:3:0"]?.price).toBe("Ask me");
});

it("protects column assignments and excluded sections from source replacement", () => {
  store.startPastingPage();
  store.setPagePasteText("| Item | Amount | Price |\n| --- | --- | --- |\n| Mug | 12 oz | $25 |\n\nKeep me");
  store.setPagePasteTableMapping(0, { product: 0, size: 1, price: 2 });
  store.dropPagePasteSection(1);
  store.setPagePasteText("Replacement");
  expect(store.getState().pastingPage?.text).toContain("Keep me");
  store.startPagePasteSourceEdit("Replacement");
  expect(store.applyPagePasteSourceEdit()).toBe(false);
  store.cancelPagePasteSourceEdit();
  expect(store.getState().pastingPage?.mappings?.[0]).toEqual({ product: 0, size: 1, price: 2 });
  expect(store.getState().pastingPage?.dropped).toEqual([1]);
});

it("protects an unfinished row selection and an open source buffer", () => {
  store.startPastingPage();
  store.setPagePasteText("Mug - $25\nBowl - $32");
  store.togglePagePasteRowSelection("0:1:0", true);
  expect(store.getState().pastingPage?.selectedRowKeys).toEqual(["0:1:0"]);
  store.setPagePasteText("Replacement");
  expect(store.getState().pastingPage?.text).toContain("Bowl - $32");
  store.clearPagePasteRowSelection();
  store.startPagePasteSourceEdit("Buffered replacement");
  store.setPagePasteText("Direct replacement");
  expect(store.getState().pastingPage?.text).toContain("Bowl - $32");
});

it("does not confirm while a source or mapping decision is unfinished", async () => {
  const before = await db.listPages();
  store.startPastingPage();
  store.setPagePasteText("| Item | Amount | Price |\n| --- | --- | --- |\n| Mug | 12 oz | $25 |");
  store.setPagePasteTableMapping(0, { product: 0, size: 1, price: 2 });
  store.correctPagePasteRow("0:3:0", { price: "Ask me" });
  store.startPagePasteSourceEdit("Bowl - $32");
  await store.confirmPagePaste();
  expect(await db.listPages()).toEqual(before);
  store.cancelPagePasteSourceEdit();
  store.setPagePasteTableMapping(0, { product: 2, size: 1, price: 0 });
  await store.confirmPagePaste();
  expect(await db.listPages()).toEqual(before);
  expect(store.getState().pastingPage?.pendingMapping).toMatchObject({ index: 0 });
});

it("requires a keep or remove choice for a headed section whose offers all move away", () => {
  store.startPastingPage();
  store.setPagePasteText("# Ceramics\n| Item | Amount | Price |\n| --- | --- | --- |\n| Mug | 12 oz | $25 |");
  store.setPagePasteTableMapping(0, { product: 0, size: 1, price: 2 });
  store.togglePagePasteRowSelection("0:4:0", true);
  store.createPagePasteCategoryForSelected("Gifts");
  expect(store.getPagePasteReview()?.canConfirm).toBe(false);
  store.setPagePasteEmptyHeadingChoice(0, "keep");
  expect(store.getPagePasteReview()?.blocks.map((block) => block.kind)).toEqual(["heading", "menu"]);
  store.setPagePasteEmptyHeadingChoice(0, "remove");
  expect(store.getPagePasteReview()?.blocks.map((block) => block.kind)).toEqual(["menu"]);
  expect(store.getPagePasteReview()?.coverage.find((entry) => entry.sourceLine === 1)?.kind).toBe("excluded");
});

it("requires a heading choice when every mapped offer is excluded", () => {
  store.startPastingPage();
  store.setPagePasteText("# Ceramics\n| Item | Amount | Price |\n| --- | --- | --- |\n| Mug | 12 oz | $25 |\n\n# About\nHandmade goods");
  store.setPagePasteTableMapping(0, { product: 0, size: 1, price: 2 });
  store.correctPagePasteRow("0:4:0", { included: false });
  expect(store.getPagePasteReview()?.sections[0]?.headingRecovery).toBe(true);
  expect(store.getPagePasteReview()?.canConfirm).toBe(false);
  store.setPagePasteEmptyHeadingChoice(0, "keep");
  expect(store.getPagePasteReview()?.canConfirm).toBe(true);
  expect(store.getPagePasteReview()?.blocks.map((block) => block.kind)).toContain("heading");
  expect(store.getPagePasteReview()?.coverage.find((entry) => entry.sourceLine === 1)?.kind).toBe("heading");
  store.setPagePasteEmptyHeadingChoice(0, "remove");
  expect(store.getPagePasteReview()?.canConfirm).toBe(true);
  expect(store.getPagePasteReview()?.sections[0]?.blocks).toEqual([]);
  expect(store.getPagePasteReview()?.coverage.find((entry) => entry.sourceLine === 1)?.kind).toBe("excluded");
});

it("keeps a header-only table public while a seller enters a new priced item", () => {
  const source = "| Item | Amount | Price |\n| --- | --- | --- |";
  store.startPastingPage();
  store.setPagePasteText(source);
  store.setPagePasteAddedItem(0, { name: "Mug", amount: "12 oz", price: "$25" });
  const review = store.getPagePasteReview();
  expect(review?.blocks).toEqual([
    expect.objectContaining({ kind: "prose", text: source }),
    expect.objectContaining({ kind: "menu", tiers: [expect.objectContaining({ name: "Mug", unit: "12 oz", price: "$25" })] }),
  ]);
  expect(review?.coverage.every((entry) => entry.kind === "text")).toBe(true);
});

it("requires an explicit choice before adding a new amount without a price", () => {
  store.startPastingPage();
  store.setPagePasteText("| Item | Amount | Price |\n| --- | --- | --- |");
  store.setPagePasteAddedItem(0, { name: "Mug", amount: "12 oz", price: "" });
  expect(store.getPagePasteReview()?.canConfirm).toBe(false);
  expect(store.getPagePasteReview()?.sections[0]?.issue).toMatch(/price/i);
  store.setPagePasteAddedItem(0, { name: "Mug", amount: "12 oz", price: "", allowBlankPrice: true });
  expect(store.getPagePasteReview()?.canConfirm).toBe(true);
  expect(store.getPagePasteReview()?.blocks.at(-1)).toEqual(expect.objectContaining({ kind: "menu",
    tiers: [expect.objectContaining({ name: "Mug", unit: "12 oz", price: "" })] }));
});

it.each([
  { source: "Product|Size|Price\nMug|12 oz|$28\nBowl|16 oz|$32", swap: true },
  { source: "Product,Size,Price,Notes\nMug,12 oz,$28,Blue\nBowl,16 oz,$32,Red", swap: false },
])("keeps every cell in a nonstandard public table on confirmation: $source", async ({ source, swap }) => {
  store.startPastingPage();
  store.setPagePasteText(source);
  if (swap) store.swapPagePasteSection(0);
  await store.confirmPagePaste();
  expect(store.getState().doc.blocks).toEqual([expect.objectContaining({ kind: "prose", text: source })]);
  const copied = compile(store.getState().doc, "pastebin").markdown;
  expect(copied).toContain("Mug");
  expect(copied).toContain("Bowl");
  expect(copied).toContain("28");
  expect(copied).toContain("32");
  expect(copied).toContain("12 oz");
  expect(copied).toContain("16 oz");
});

it.each([
  "| Product | Size |\n| --- | --- |\n| Mug | 12 oz |\n| Bowl | 16 oz |",
  "Product,Notes\nMug,Blue\nBowl,Red",
  "Product|Price\nMug|$28\nBowl|$32",
])("keeps a two column header and its rows intact on confirmation: %s", async (source) => {
  store.startPastingPage();
  store.setPagePasteText(source);
  store.swapPagePasteSection(0);
  expect(store.getState().pastingPage?.swapped).toEqual([]);
  await store.confirmPagePaste();
  expect(store.getState().doc.blocks).toEqual([expect.objectContaining({ kind: "prose", text: source })]);
});

it("refuses an invalid builder result without writing or replacing the open page", async () => {
  const before = await db.listPages();
  const doc = store.getState().doc;
  store.startPastingPage();
  store.setPagePasteText("Hello");
  vi.spyOn(reader, "buildProposedBlock").mockReturnValue({ kind: "prose", text: "Hello", ...{ id: "" } });
  const writes = vi.spyOn(db, "writePage");
  await store.confirmPagePaste();
  expect(writes).not.toHaveBeenCalled();
  expect(await db.listPages()).toEqual(before);
  expect(store.getState().doc).toBe(doc);
  expect(store.getState().pastingPage?.text).toBe("Hello");
  expect(store.getState().status).toMatchObject({ kind: "error", message: expect.stringMatching(/Nothing has been changed/) });
});

it("does nothing for an empty or fully dropped proposal", async () => {
  const writes = vi.spyOn(db, "writePage");
  await store.confirmPagePaste();
  store.startPastingPage();
  await store.confirmPagePaste();
  store.setPagePasteText("Hello");
  store.dropPagePasteSection(0);
  await store.confirmPagePaste();
  expect(writes).not.toHaveBeenCalled();
});

it("swaps from source and back, ignores invalid indices, and preserves a reopened draft", async () => {
  store.startPastingPage();
  store.setPagePasteText("# Shop\n\nHello there");
  store.swapPagePasteSection(0);
  store.swapPagePasteSection(-1);
  store.dropPagePasteSection(9);
  expect(store.getState().pastingPage?.swapped).toEqual([]);
  expect(store.getState().pastingPage?.dropped).toEqual([]);
  store.swapPagePasteSection(1);
  store.swapPagePasteSection(1);
  store.startPastingPage();
  expect(store.getState().pastingPage?.text).toContain("Hello there");
  await store.confirmPagePaste();
  expect(store.getState().doc.blocks[1]).toMatchObject({ kind: "prose", text: "\nHello there" });
  store.startPastingPage();
  store.setPagePasteText("Hello there");
  store.swapPagePasteSection(0);
  await store.confirmPagePaste();
  expect(store.getState().doc.title).toBeUndefined();
  expect(store.getState().doc.blocks[0]).toMatchObject({ kind: "menu", tiers: [{ name: "Hello there" }] });
});

it("keeps the draft and existing page after storage refuses the write", async () => {
  const before = await db.listPages();
  const doc = store.getState().doc;
  store.startPastingPage();
  store.setPagePasteText("Hello");
  const writes = vi.spyOn(db, "writePage").mockRejectedValue(new DOMException("Full", "QuotaExceededError"));
  await store.confirmPagePaste();
  expect(await db.listPages()).toEqual(before);
  expect(store.getState().doc).toBe(doc);
  expect(store.getState().pastingPage?.text).toBe("Hello");
  expect(store.getState().status.kind).toBe("error");
  writes.mockRestore();
  await store.confirmPagePaste();
  expect(await db.listPages()).toHaveLength(3);
  expect(store.getState().pastingPage).toBeUndefined();
});

it("confirms only once while the storage write is pending", async () => {
  store.startPastingPage();
  store.setPagePasteText("Hello");
  let release: () => void = () => {};
  const pending = new Promise<void>((resolve) => { release = resolve; });
  const write = db.writePage;
  const writes = vi.spyOn(db, "writePage").mockImplementation(async (page) => {
    await pending;
    await write(page);
  });
  const first = store.confirmPagePaste();
  const second = store.confirmPagePaste();
  release();
  await Promise.all([first, second]);
  expect(writes).toHaveBeenCalledTimes(1);
  expect(await db.listPages()).toHaveLength(3);
});

it("finishes a committed paste even if refreshing the page list fails", async () => {
  store.startPastingPage();
  store.setPagePasteText("Hello");
  const list = vi.spyOn(db, "listPages").mockRejectedValue(new Error("Read failed"));
  await store.confirmPagePaste();
  expect(store.getState().status.kind).toBe("saved");
  expect(store.getState().pastingPage).toBeUndefined();
  list.mockRestore();
  expect(await db.listPages()).toHaveLength(3);
  await store.confirmPagePaste();
  expect(await db.listPages()).toHaveLength(3);
});

it("does not replace a paste session while its confirmation is finishing", async () => {
  store.startPastingPage();
  store.setPagePasteText("First page");
  let release: () => void = () => {};
  const waiting = new Promise<void>((resolve) => { release = resolve; });
  const list = db.listPages;
  const read = vi.spyOn(db, "listPages").mockImplementation(async () => {
    await waiting;
    return list();
  });
  const first = store.confirmPagePaste();
  for (let i = 0; i < 50 && store.getState().doc.blocks.length === 0; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  expect(store.getState().doc.blocks).toHaveLength(1);
  store.stopPastingPage();
  store.startPastingPage();
  store.setPagePasteText("Second paste");
  expect(store.getState().pastingPage?.text).toBe("First page");
  expect(store.getState().pastingPage?.confirming).toBe(true);
  release();
  await first;
  read.mockRestore();
  store.startPastingPage();
  store.setPagePasteText("Second paste");
  expect(store.getState().pastingPage?.text).toBe("Second paste");
});
