/** @vitest-environment node */
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { emptyDocument, parseDocument, serializeDocument } from "@mdsb/engine";
import * as db from "../src/db.js";
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
  expect(store.getState().pastingPage).toEqual({ text: "Replacement", dropped: [], swapped: [] });
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
