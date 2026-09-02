/**
 * @vitest-environment jsdom
 *
 * Every row the app creates carries an identifier.
 *
 * Typing into the blank row at the bottom of a price list is how a row is
 * added, so that path mints the id rather than any explicit "add" button. A row
 * without one cannot be saved at all under version 3, so this is the difference
 * between the editor working and not.
 */
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";

import { addBlock, getState, init } from "../src/store.js";
import { blankBlock } from "../src/ui/forms.js";

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  init(true);
});

describe("a price list row", () => {
  it("gets an identifier when a blank section is created", () => {
    const block = blankBlock("menu");
    if (block.kind !== "menu") throw new Error("expected a menu");
    for (const tier of block.tiers) expect(tier.id).not.toBe("");
  });

  it("gets a distinct identifier per row", () => {
    addBlock(blankBlock("menu"));
    const block = getState().doc.blocks[0];
    if (block === undefined || block.kind !== "menu") throw new Error("expected a menu");
    const ids = block.tiers.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
