/**
 * @vitest-environment jsdom
 *
 * Pictures held on the seller's own device. Feature 024, Phase 4.
 *
 * The store is the first thing this app has ever kept that is not text, and it
 * is the part of the feature Constitution Principle V cares about most: no
 * failure path may delete a seller's picture to recover, storage filling up has
 * to produce a sentence somebody can act on, and a page pointing at a picture
 * that is gone must still open.
 *
 * jsdom has no IndexedDB, so this runs against fake-indexeddb, which implements
 * the real specification including upgrade events. Every test gets a fresh
 * IDBFactory, so none of them can pass because of something an earlier one left
 * behind. That is the same arrangement `app/tests/db.test.ts` uses and the same
 * reason.
 *
 * WHAT THE CANVAS STUB BELOW DOES AND DOES NOT PROVE, stated here rather than
 * discovered later.
 *
 * `normalise()` re-encodes through a canvas, and jsdom has neither
 * `createImageBitmap` nor a working `toBlob`. So both are stubbed. That means
 * this file CANNOT prove that a browser's JPEG encoder discards an EXIF block:
 * that is a property of the encoder, not of our code, and asserting it here
 * would be asserting the stub.
 *
 * What it does prove is the thing that can actually regress, which is what
 * T036a is about: that `addAsset` stores the re-encoded bytes rather than the
 * file it was handed. The stub re-encodes to bytes carrying no EXIF, so an
 * `addAsset` that shortcut `normalise()` and put the original file in the store
 * would fail the assertion immediately. The privacy property is a side effect
 * of a code path, and this is the test that the code path is still taken.
 */
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ACCEPTED_PICTURE_TYPES,
  addAsset,
  assetCosts,
  heldAsset,
  holdAssets,
  removeAsset,
  totalAssetBytes,
} from "../src/assets.js";
import { listAssets, listPages, readAsset } from "../src/db.js";
import { getState, init } from "../src/store.js";

/** A JPEG carrying an APP1 EXIF block, which is what a phone camera writes. */
const EXIF_JPEG = new Uint8Array([
  0xff, 0xd8, // SOI
  0xff, 0xe1, 0x00, 0x16, // APP1, 22 bytes including these two
  0x45, 0x78, 0x69, 0x66, 0x00, 0x00, // "Exif\0\0"
  0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08, // a TIFF header
  0x00, 0x01, 0x88, 0x25, 0x00, 0x04, // one made up entry
  0xff, 0xd9, // EOI
]);

/** What the stubbed canvas hands back. A JPEG, and deliberately not that one. */
const REENCODED = new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x10, 0xff, 0xd9]);

/** Searches for the six bytes that open every EXIF block. */
function carriesExif(bytes: Uint8Array): boolean {
  const marker = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00];
  return bytes.some((_, at) => marker.every((byte, k) => bytes[at + k] === byte));
}

async function bytesOf(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer());
}

function picture(type = "image/jpeg", bytes: Uint8Array = EXIF_JPEG): File {
  return new File([bytes as unknown as BlobPart], "photo.jpg", { type });
}

/**
 * The module, imported dynamically, so a test can ask for a fresh copy.
 *
 * The return type is inferred rather than written, because writing it means an
 * `import()` type annotation and the lint rule on type imports forbids those.
 */
const loadAssets = () => import("../src/assets.js");

/** Says how much room the browser is offering, or that it will not say. */
function room(estimate: { usage: number; quota: number } | undefined): void {
  Object.defineProperty(globalThis.navigator, "storage", {
    configurable: true,
    value:
      estimate === undefined
        ? undefined
        : { estimate: () => Promise.resolve(estimate), persist: () => Promise.resolve(false) },
  });
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();

  // The canvas, stubbed. See the note at the top of this file for exactly what
  // that costs and what it still buys.
  vi.stubGlobal("createImageBitmap", () =>
    Promise.resolve({ width: 2400, height: 1200, close: () => undefined }),
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage: () => undefined,
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (
    this: HTMLCanvasElement,
    callback: BlobCallback,
    type?: string,
  ) {
    callback(new Blob([REENCODED as unknown as BlobPart], { type: type ?? "image/jpeg" }));
  });

  room({ usage: 1_000_000, quota: 500_000_000 });
});

describe("storing a picture", () => {
  it("stores it and hands back an identifier the document can carry", async () => {
    const outcome = await addAsset(picture());

    expect(outcome.ok, outcome.message).toBe(true);
    expect(typeof outcome.id).toBe("string");
    expect(outcome.id).not.toBe("");
  });

  it("keeps the record the storage view needs, without reading every blob", async () => {
    const { id } = await addAsset(picture());
    if (id === undefined) throw new Error("nothing was stored");

    const record = await readAsset(id);
    expect(record?.id).toBe(id);
    expect(record?.mime).toBe("image/jpeg");
    expect(record?.bytes).toBe(record?.data.byteLength);
    expect(typeof record?.createdAt).toBe("number");
  });

  it("makes the picture readable synchronously once it has been held", async () => {
    const { id } = await addAsset(picture());
    if (id === undefined) throw new Error("nothing was stored");

    // Stored means held: the seller who just chose it sees it at once.
    expect(heldAsset(id)?.startsWith("data:image/jpeg;base64,")).toBe(true);
  });

  it("reads a stored picture back into memory for a synchronous render", async () => {
    // Written straight to the store, which is what a page saved in an earlier
    // session looks like: the picture exists and nothing is holding it yet.
    const { writeAsset } = await import("../src/db.js");
    await writeAsset({
      id: "from-an-earlier-session",
      data: REENCODED.slice().buffer,
      mime: "image/jpeg",
      bytes: REENCODED.length,
      createdAt: 1,
    });

    expect(heldAsset("from-an-earlier-session")).toBeUndefined();
    await holdAssets(["from-an-earlier-session"]);
    expect(heldAsset("from-an-earlier-session")?.startsWith("data:image/jpeg;base64,")).toBe(true);
  });

  it("totals what the pictures cost without opening any of them", async () => {
    await addAsset(picture());
    await addAsset(picture());

    const costs = await assetCosts();
    expect(costs).toHaveLength(2);
    expect(await totalAssetBytes()).toBe(costs.reduce((sum, c) => sum + c.bytes, 0));
    expect(await totalAssetBytes()).toBe(REENCODED.length * 2);
  });
});

describe("FR-083, what a photograph carries besides the picture", () => {
  it("the fixture really does carry an EXIF block, or this proves nothing", async () => {
    expect(carriesExif(await bytesOf(picture()))).toBe(true);
  });

  it("stores the re-encoded picture, not the file, so the EXIF block is gone", async () => {
    const { id } = await addAsset(picture());
    if (id === undefined) throw new Error("nothing was stored");

    const record = await readAsset(id);
    if (record === undefined) throw new Error("nothing came back");

    const stored = new Uint8Array(record.data);
    expect(carriesExif(stored)).toBe(false);
    expect([...stored]).toEqual([...REENCODED]);
  });
});

describe("FR-079 and Principle IV, the allow list", () => {
  it("names exactly the four types the data model allows", () => {
    expect([...ACCEPTED_PICTURE_TYPES]).toEqual(["image/png", "image/jpeg", "image/webp", "image/gif"]);
  });

  it.each(["image/png", "image/jpeg", "image/webp", "image/gif"])("accepts %s", async (type) => {
    expect((await addAsset(picture(type))).ok).toBe(true);
  });

  it("refuses an SVG, and says so rather than failing later", async () => {
    const outcome = await addAsset(picture("image/svg+xml", new Uint8Array([0x3c, 0x73, 0x76, 0x67])));

    expect(outcome.ok).toBe(false);
    expect(outcome.message ?? "").toMatch(/PNG|JPEG/i);
    expect(await listAssets()).toHaveLength(0);
  });

  it("refuses anything that is not a picture at all", async () => {
    expect((await addAsset(picture("application/pdf"))).ok).toBe(false);
    expect(await listAssets()).toHaveLength(0);
  });
});

describe("FR-084, there has to be room before a picture is accepted", () => {
  it("refuses with a message naming what is in use and what to do", async () => {
    room({ usage: 4_800_000, quota: 4_800_000 });

    const outcome = await addAsset(picture());

    expect(outcome.ok).toBe(false);
    const message = outcome.message ?? "";
    // Principle V: a generic failure message is a defect, and so is a raw one.
    expect(message).not.toMatch(/QuotaExceededError|DOMException|\[object/);
    // What is in use, in units a seller reads.
    expect(message).toContain("4.6 MB");
    // What they can do about it.
    expect(message.toLowerCase()).toContain("remove");
  });

  it("stores nothing when it refuses", async () => {
    room({ usage: 4_800_000, quota: 4_800_000 });
    await addAsset(picture());
    expect(await listAssets()).toHaveLength(0);
  });

  it("keeps every picture already stored when it refuses a new one", async () => {
    // D6 and FR-087. Reclaiming space by deleting something is the one recovery
    // this project forbids itself.
    const first = await addAsset(picture());
    room({ usage: 4_800_000, quota: 4_800_000 });
    await addAsset(picture());

    expect(await listAssets()).toHaveLength(1);
    expect(first.id === undefined ? undefined : await readAsset(first.id)).toBeDefined();
  });

  it("carries on when the browser will not say how much room there is", async () => {
    // Firefox in private browsing, and every browser old enough. Refusing every
    // picture because the estimate is unavailable would be worse than trying.
    room(undefined);
    expect((await addAsset(picture())).ok).toBe(true);
  });
});

describe("FR-085, storage filling up while a page is being saved", () => {
  it("says what failed and that the page is not lost, rather than the raw error", async () => {
    init(true);

    const write = vi
      .spyOn(globalThis.indexedDB, "open")
      .mockImplementation(() => {
        throw new DOMException("the quota has been exceeded", "QuotaExceededError");
      });

    // Any edit saves. The failure has to reach the seller as a sentence.
    const { addBlock } = await import("../src/store.js");
    addBlock({ id: "h", kind: "heading", text: "Prices", level: 2 });
    for (let i = 0; i < 10; i += 1) await new Promise((r) => setTimeout(r, 0));
    write.mockRestore();

    const status = getState().status;
    expect(status.kind).toBe("error");
    const message = status.message ?? "";
    expect(message).not.toContain("QuotaExceededError");
    expect(message.toLowerCase()).toContain("full");
    expect(message.toLowerCase()).toContain("not been lost");
  });

  it("leaves every saved page exactly where it was", async () => {
    // Principle V. The failure path must not touch anything already stored.
    const { writePage } = await import("../src/db.js");
    await writePage({ id: "kept", json: '{"precious":true}', title: "Kept", updatedAt: 1 });

    init(true, undefined, "other");
    const write = vi.spyOn(globalThis.indexedDB, "open").mockImplementation(() => {
      throw new DOMException("the quota has been exceeded", "QuotaExceededError");
    });
    const { addBlock } = await import("../src/store.js");
    addBlock({ id: "h2", kind: "heading", text: "Prices", level: 2 });
    for (let i = 0; i < 10; i += 1) await new Promise((r) => setTimeout(r, 0));
    write.mockRestore();

    expect((await listPages()).map((p) => p.id)).toEqual(["kept"]);
  });
});

describe("FR-086, asking for the storage to be kept", () => {
  /**
   * A fresh copy of the module, because "asks once" is remembered in module
   * state and the app has already asked by the time this file gets here.
   */
  async function freshAssets(): ReturnType<typeof loadAssets> {
    vi.resetModules();
    return loadAssets();
  }

  it("asks once and carries on when the browser says no", async () => {
    const persist = vi.fn(() => Promise.resolve(false));
    Object.defineProperty(globalThis.navigator, "storage", {
      configurable: true,
      value: { estimate: () => Promise.resolve({ usage: 0, quota: 1_000_000 }), persist },
    });

    const assets = await freshAssets();
    await assets.askToKeepStorage();
    await assets.askToKeepStorage();

    expect(persist).toHaveBeenCalledTimes(1);
    // And a picture still stores, because a refusal is not a failure.
    expect((await assets.addAsset(picture())).ok).toBe(true);
  });

  it("does not throw when the browser has no such thing", async () => {
    room(undefined);
    const assets = await freshAssets();
    await expect(assets.askToKeepStorage()).resolves.toBeUndefined();
  });
});

describe("FR-087 and D6, removing a picture is the seller's decision", () => {
  it("removes only the picture it was asked to remove", async () => {
    const keep = await addAsset(picture());
    const drop = await addAsset(picture());
    if (keep.id === undefined || drop.id === undefined) throw new Error("nothing was stored");

    await removeAsset(drop.id);

    expect(await readAsset(drop.id)).toBeUndefined();
    expect(await readAsset(keep.id)).toBeDefined();
    // And it stops being held, or the storage view would go on showing it.
    expect(heldAsset(drop.id)).toBeUndefined();
    expect(heldAsset(keep.id)).toBeDefined();
  });

  it("removing something that is not there is not an error and removes nothing", async () => {
    await addAsset(picture());
    await removeAsset("never-existed");
    expect(await listAssets()).toHaveLength(1);
  });
});

describe("FR-088, a picture that is no longer stored", () => {
  it("hands back nothing rather than throwing", async () => {
    await holdAssets(["gone", "also-gone"]);
    expect(heldAsset("gone")).toBeUndefined();
  });

  it("holds the ones that are there and skips the ones that are not", async () => {
    const { id } = await addAsset(picture());
    if (id === undefined) throw new Error("nothing was stored");

    await holdAssets([id, "gone"]);
    expect(heldAsset(id)).toBeDefined();
    expect(heldAsset("gone")).toBeUndefined();
  });
});

describe("the database going from version 1 to version 2", () => {
  /** Opens the database exactly as version 1 left it, with only `pages`. */
  function openVersionOne(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = globalThis.indexedDB.open("markdown-storefront", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("pages", { keyPath: "id" });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("could not open"));
    });
  }

  it("preserves every existing page, byte for byte", async () => {
    const old = await openVersionOne();
    const written = [
      { id: "a", json: '{"schemaVersion":1,"target":"rentry","blocks":[]}', title: "A", updatedAt: 2 },
      { id: "b", json: "this is not JSON at all { [ ÿ", title: "B", updatedAt: 1 },
    ];
    await new Promise<void>((resolve, reject) => {
      const tx = old.transaction("pages", "readwrite");
      for (const page of written) tx.objectStore("pages").put(page);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("could not write"));
    });
    old.close();

    // Opening at version 2 runs the upgrade. FR-018's escape hatch has to
    // survive it: the damaged record above is exactly what it exists for.
    expect(await listPages()).toEqual([written[0], written[1]]);
  });

  it("adds the picture store without disturbing the page store", async () => {
    const old = await openVersionOne();
    old.close();

    await addAsset(picture());
    expect(await listAssets()).toHaveLength(1);
    expect(await listPages()).toEqual([]);
  });
});
