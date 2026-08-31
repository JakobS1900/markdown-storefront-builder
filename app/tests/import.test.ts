/**
 * @vitest-environment node
 *
 * Opening a backup, which the app promised and could not do.
 *
 * The Copy screen offers "Save a backup you can reopen here". Checked on the
 * phone across all three surfaces: zero file inputs anywhere, and nothing in
 * the source that reads a file except the image picker. There was no way to
 * reopen anything. `docs/ROADMAP.md` item 2.1 lists "export and import" and is
 * ticked.
 *
 * A backup you cannot restore is not a backup, it is a file. For a project
 * whose constitution calls losing someone's page the one unforgivable failure,
 * that is the wrong promise to leave unkept.
 *
 * The rule these tests hold to: opening a backup never destroys the page
 * already open. It arrives as a new page, so a mistaken import costs nothing.
 */
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";

import { serializeDocument } from "@mdsb/engine";

import { openBackup } from "../src/import.js";
import { getState, init } from "../src/store.js";
import { listPages, writePage } from "../src/db.js";

const A_PAGE = {
  schemaVersion: 1 as const,
  target: "rentry",
  blocks: [{ id: "h", kind: "heading" as const, text: "From the backup", level: 2 }],
};

beforeEach(async () => {
  globalThis.indexedDB = new IDBFactory();
  init(true);
  // A page already open and already saved, so we can prove it survives.
  await writePage({
    id: "already-here",
    json: serializeDocument({
      schemaVersion: 1,
      target: "rentry",
      blocks: [{ id: "k", kind: "heading", text: "Do not lose me", level: 2 }],
    }),
    title: "Untitled page",
    updatedAt: 1,
  });
});

describe("opening a backup file", () => {
  it("opens the page the file contains", async () => {
    const result = await openBackup(serializeDocument(A_PAGE));

    expect(result.ok).toBe(true);
    expect(getState().doc.blocks[0]).toMatchObject({ kind: "heading", text: "From the backup" });
  });

  it("arrives as a new page, so nothing that was already saved is overwritten", async () => {
    await openBackup(serializeDocument(A_PAGE));

    const ids = (await listPages()).map((p) => p.id);
    expect(ids, "the page that was already saved is gone").toContain("already-here");
    expect(getState().pageId).not.toBe("already-here");
  });

  it("refuses a file that is not a page, and changes nothing", async () => {
    const before = getState().doc;

    const result = await openBackup("this is not a page at all {");

    expect(result.ok).toBe(false);
    expect(result.message).toBeTruthy();
    expect(getState().doc).toBe(before);
  });

  it("refuses a page from a newer version rather than guessing at it", async () => {
    const future = JSON.stringify({ schemaVersion: 99, target: "rentry", blocks: [] });

    const result = await openBackup(future);

    expect(result.ok).toBe(false);
    expect(result.message.toLowerCase()).toContain("version");
  });

  it("leaves storage untouched when the file is refused", async () => {
    const before = (await listPages()).map((p) => p.id);

    await openBackup("nonsense");

    expect((await listPages()).map((p) => p.id)).toEqual(before);
  });

  it("saves the opened backup, so it survives a reload", async () => {
    await openBackup(serializeDocument(A_PAGE));
    const opened = getState().pageId;

    const stored = (await listPages()).find((p) => p.id === opened);
    expect(stored).toBeDefined();
    expect(stored?.json).toContain("From the backup");
  });
});
