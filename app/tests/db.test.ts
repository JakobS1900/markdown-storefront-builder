/**
 * @vitest-environment node
 *
 * Local persistence, which had no tests at all.
 *
 * This is the module the constitution cares most about. Principle V says no
 * failure path may delete or overwrite a saved page, and FR-018 says a page the
 * current version cannot read MUST still be retrievable as the exact bytes that
 * were saved. Both were verified only by hand, on one phone, by me.
 *
 * jsdom has no IndexedDB, so these run against fake-indexeddb, which implements
 * the real specification including transactions, key paths and upgrade events.
 * A hand written stub would have tested the stub. It is a devDependency with no
 * dependencies of its own; the runtime dependency count is still zero.
 *
 * Every test gets a fresh IDBFactory, so none of them can pass because of
 * something an earlier one left behind.
 */
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  deletePage,
  listPages,
  readPage,
  storageAvailable,
  writePage,
  type StoredPage,
} from "../src/db.js";

function page(over: Partial<StoredPage> = {}): StoredPage {
  return {
    id: "p1",
    json: '{"schemaVersion":1,"target":"rentry","blocks":[]}',
    title: "Untitled page",
    updatedAt: 1000,
    ...over,
  };
}

beforeEach(() => {
  // A brand new database for every test.
  globalThis.indexedDB = new IDBFactory();
});

describe("saving and reading back", () => {
  it("returns exactly what was written", async () => {
    const saved = page();
    await writePage(saved);
    expect(await readPage("p1")).toEqual(saved);
  });

  it("preserves the stored text byte for byte", async () => {
    // Whitespace, quotes, newlines, emoji, and characters outside the basic
    // plane. The record is text on purpose, so none of it may be normalised.
    const json = '{\n  "a": "line\\nbreak \\"quoted\\" \\\\ back",\n  "b": "é é 🎨 \\u0000 end"\n}';
    await writePage(page({ json }));

    const back = await readPage("p1");
    expect(back?.json).toBe(json);
    expect(back?.json.length).toBe(json.length);
  });

  it("survives closing the database and opening it again", async () => {
    await writePage(page({ json: '{"kept":true}' }));
    // Each call opens and closes its own connection, so this is the reload.
    expect((await readPage("p1"))?.json).toBe('{"kept":true}');
    expect(await listPages()).toHaveLength(1);
  });

  it("hands back nothing, rather than throwing, for a page that is not there", async () => {
    expect(await readPage("never-existed")).toBeUndefined();
  });

  it("starts empty rather than failing on a database that has never been used", async () => {
    expect(await listPages()).toEqual([]);
  });
});

describe("FR-018, the escape hatch", () => {
  /**
   * The reason records are text and not objects. A page written by a newer
   * version, or one damaged by something outside this app, still has to come
   * back exactly as stored so the artist can be handed their own work.
   */
  it("reads back content this version could never parse as a document", async () => {
    const nonsense = "this is not JSON at all { [ ÿ";
    await writePage(page({ json: nonsense }));

    const back = await readPage("p1");
    expect(back?.json).toBe(nonsense);
  });

  it("reads back a page from a future schema version", async () => {
    const future = '{"schemaVersion":99,"target":"unknown-host","blocks":[{"kind":"something-new"}]}';
    await writePage(page({ json: future }));

    expect((await readPage("p1"))?.json).toBe(future);
    expect(await listPages()).toHaveLength(1);
  });
});

describe("keeping one page does not disturb another", () => {
  it("lists the most recently changed page first", async () => {
    await writePage(page({ id: "old", updatedAt: 100 }));
    await writePage(page({ id: "newest", updatedAt: 300 }));
    await writePage(page({ id: "middle", updatedAt: 200 }));

    expect((await listPages()).map((p) => p.id)).toEqual(["newest", "middle", "old"]);
  });

  it("updates a page in place rather than storing it twice", async () => {
    await writePage(page({ json: '{"v":1}', updatedAt: 1 }));
    await writePage(page({ json: '{"v":2}', updatedAt: 2 }));

    const all = await listPages();
    expect(all).toHaveLength(1);
    expect(all[0]?.json).toBe('{"v":2}');
  });

  it("writing one page leaves every other page untouched", async () => {
    await writePage(page({ id: "a", json: '{"a":true}' }));
    await writePage(page({ id: "b", json: '{"b":true}' }));
    await writePage(page({ id: "a", json: '{"a":"changed"}' }));

    expect((await readPage("b"))?.json).toBe('{"b":true}');
  });

  it("deletes only the page it was asked to delete", async () => {
    await writePage(page({ id: "keep" }));
    await writePage(page({ id: "remove" }));

    await deletePage("remove");

    expect(await readPage("remove")).toBeUndefined();
    expect(await readPage("keep")).toBeDefined();
  });

  it("deleting something that is not there is not an error, and removes nothing", async () => {
    await writePage(page({ id: "keep" }));
    await deletePage("never-existed");
    expect(await listPages()).toHaveLength(1);
  });
});

describe("when the browser refuses storage", () => {
  it("reports storage as available when it works", async () => {
    expect(await storageAvailable()).toBe(true);
  });

  it("reports storage as unavailable rather than throwing when opening fails", async () => {
    vi.spyOn(globalThis.indexedDB, "open").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });

    expect(await storageAvailable()).toBe(false);
  });

  it("reports storage as unavailable when the open request errors", async () => {
    vi.spyOn(globalThis.indexedDB, "open").mockImplementation(() => {
      const request = { onsuccess: null, onerror: null, onblocked: null, error: new Error("no") } as unknown as
        IDBOpenDBRequest & { onerror: ((this: IDBRequest, ev: Event) => unknown) | null };
      setTimeout(() => request.onerror?.call(request as unknown as IDBRequest, new Event("error")), 0);
      return request;
    });

    expect(await storageAvailable()).toBe(false);
  });

  it("leaves a saved page alone when a later read fails", async () => {
    await writePage(page({ json: '{"precious":true}' }));

    const real = globalThis.indexedDB.open.bind(globalThis.indexedDB);
    const spy = vi.spyOn(globalThis.indexedDB, "open").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    await expect(readPage("p1")).rejects.toBeDefined();
    spy.mockRestore();
    void real;

    // Nothing in this module deletes to recover, so the page is still there.
    expect((await readPage("p1"))?.json).toBe('{"precious":true}');
  });
});
