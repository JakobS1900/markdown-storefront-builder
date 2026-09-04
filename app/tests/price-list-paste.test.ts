/**
 * @vitest-environment jsdom
 *
 * Holding a pasted price list, and turning the ticked lines into products.
 *
 * The spec settled one question ahead of everything else here: the ticks live
 * on this screen, not as draft rows in the document. The cheaper design was to
 * drop the paste straight into a menu section and reuse feature 022's row
 * selection unchanged, and it was rejected because a draft row is not a draft.
 * It is a real product: it saves to IndexedDB, it compiles, and it publishes.
 * A seller pasting sixty lines to keep twenty five would have had thirty five
 * lines they never agreed to sitting on their live page.
 *
 * "nothing pasted ever reaches the document" below is that decision proved. It
 * is the load-bearing test in this file and the reason the rest of the feature
 * is allowed to guess at all.
 *
 * Combined with the conversion tests rather than split into two files as the
 * plan said, because a test file costs about a minute of jsdom environment
 * setup on this machine and these two share every fixture.
 */
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";

import { compile, TARGETS } from "@mdsb/engine";

import {
  addBlock,
  convertPaste,
  getState,
  init,
  newPage,
  selectBlock,
  setPasteText,
  setSurface,
  startPasting,
  stopPasting,
  subscribe,
  tickAllPasteLines,
  togglePasteLine,
  undoLast,
  untickAllPasteLines,
  updateBlock,
} from "../src/store.js";
import { blankBlock } from "../src/ui/forms.js";
import { renderShell } from "../src/ui/shell.js";

let stop: (() => void) | undefined;

function live(): HTMLElement {
  document.body.innerHTML =
    '<a class="skip" href="#surface">Skip</a><div id="app"></div>' +
    '<div id="live-region" class="sr-only" role="status" aria-live="polite"></div>';
  const root = document.getElementById("app");
  if (root === null) throw new Error("missing #app");
  init(false);
  stop = subscribe(() => renderShell(root));
  renderShell(root);
  return root;
}

beforeEach(() => {
  stop?.();
  stop = undefined;
});

function menuBlock(): Extract<ReturnType<typeof getState>["doc"]["blocks"][number], { kind: "menu" }> {
  const block = getState().doc.blocks[0];
  if (block === undefined || block.kind !== "menu") throw new Error("not a menu");
  return block;
}

/** A price list holding two real rows, so appending is visible as appending. */
function shop(): string {
  live();
  addBlock(blankBlock("menu"));
  const id = menuBlock().id;
  updateBlock(id, {
    ...menuBlock(),
    tiers: [
      { id: "bust", name: "Bust", price: "45" },
      { id: "half-body", name: "Half body", price: "80" },
    ],
  });
  selectBlock(id);
  return id;
}

/** A price list exactly as `blankBlock` makes it: one empty placeholder row. */
function freshList(): string {
  live();
  addBlock(blankBlock("menu"));
  const id = menuBlock().id;
  selectBlock(id);
  return id;
}

const LIST = "Sketch, 30\nFull colour, 80\nCustom, DM me";

describe("holding a paste", () => {
  it("pre-ticks the lines that look like items", () => {
    startPasting(shop());
    setPasteText("COMMISSIONS\nSketch, 30\nFull colour, 80");
    expect(getState().pasting?.ticked).toEqual([1, 2]);
  });

  it("nothing pasted ever reaches the document", () => {
    // The load-bearing guarantee. Everything else in this feature is allowed
    // to guess precisely because being wrong cannot reach the page.
    const id = shop();
    const before = JSON.stringify(getState().doc);

    startPasting(id);
    setPasteText(LIST);
    togglePasteLine(0);
    tickAllPasteLines();

    expect(JSON.stringify(getState().doc)).toBe(before);
  });

  it("unticks a ticked line and leaves the others alone", () => {
    startPasting(shop());
    setPasteText(LIST);
    togglePasteLine(1);
    expect(getState().pasting?.ticked).toEqual([0, 2]);
  });

  it("ticks a line the reader did not suggest", () => {
    startPasting(shop());
    setPasteText("COMMISSIONS\nSketch, 30");
    togglePasteLine(0);
    expect(getState().pasting?.ticked).toEqual([0, 1]);
  });

  it("ticks all and unticks all in one action", () => {
    startPasting(shop());
    setPasteText("COMMISSIONS\nSketch, 30\nFull colour, 80");

    tickAllPasteLines();
    expect(getState().pasting?.ticked).toEqual([0, 1, 2]);

    untickAllPasteLines();
    expect(getState().pasting?.ticked).toEqual([]);
  });

  it("does not tick a blank line even when ticking all, since it is not a product", () => {
    startPasting(shop());
    setPasteText("Sketch, 30\n\nFull colour, 80");
    tickAllPasteLines();
    expect(getState().pasting?.ticked).toEqual([0, 2]);
  });

  it("re-reads the ticks when the text changes, rather than keeping stale ones", () => {
    startPasting(shop());
    setPasteText("Sketch, 30\nFull colour, 80\nInk, 20");
    expect(getState().pasting?.ticked).toEqual([0, 1, 2]);

    setPasteText("COMMISSIONS");
    expect(getState().pasting?.ticked).toEqual([]);
  });

  it("clears the paste when the screen is left", () => {
    startPasting(shop());
    setPasteText(LIST);
    stopPasting();
    expect(getState().pasting).toBeUndefined();
  });
});

describe("converting the ticked lines", () => {
  it("appends the ticked lines in the order they were pasted", () => {
    const id = shop();
    startPasting(id);
    setPasteText(LIST);
    convertPaste();

    expect(menuBlock().tiers.map((t) => t.name)).toEqual(["Bust", "Half body", "Sketch", "Full colour", "Custom"]);
  });

  it("carries a price no parser can read across intact", () => {
    const id = shop();
    startPasting(id);
    setPasteText(LIST);
    convertPaste();

    expect(menuBlock().tiers.at(-1)?.price).toBe("DM me");
  });

  it("gives every new row a distinct id, so 022's selection works on them", () => {
    const id = shop();
    startPasting(id);
    setPasteText(LIST);
    convertPaste();

    const ids = menuBlock().tiers.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((tierId) => tierId !== "")).toBe(true);
  });

  it("fills a section's blank placeholder row rather than leaving it above the products", () => {
    // `blankBlock` gives every new price list one empty tier, so this is the
    // common path into this feature, not an edge case. Appending after it
    // would leave a blank first product in every list built by pasting.
    const id = freshList();
    startPasting(id);
    setPasteText(LIST);
    convertPaste();

    expect(menuBlock().tiers.map((t) => t.name)).toEqual(["Sketch", "Full colour", "Custom"]);
  });

  it("does not skip a line it could not split, since a product with no price is still a product", () => {
    const id = shop();
    startPasting(id);
    setPasteText("Sketch, 30\nSomething with no price at all");
    tickAllPasteLines();
    convertPaste();

    expect(menuBlock().tiers.map((t) => t.name)).toContain("Something with no price at all");
  });

  it("reads a cost column into cost, which is the field that never publishes", () => {
    const id = shop();
    startPasting(id);
    setPasteText("Sketch, 30, each, 10");
    convertPaste();

    const added = menuBlock().tiers.at(-1);
    expect(added?.cost).toBe("10");
    expect(added?.unit).toBe("each");
  });

  it("does nothing at all when nothing is ticked", () => {
    const id = shop();
    const before = JSON.stringify(getState().doc);

    startPasting(id);
    setPasteText(LIST);
    untickAllPasteLines();
    convertPaste();

    expect(JSON.stringify(getState().doc)).toBe(before);
  });

  it("appends again when converted twice, because only the seller decides what is done", () => {
    const id = shop();
    startPasting(id);
    setPasteText("Sketch, 30");
    convertPaste();
    convertPaste();

    expect(menuBlock().tiers.filter((t) => t.name === "Sketch")).toHaveLength(2);
  });
});

describe("a paste never escapes the page it was pasted into", () => {
  it("is cleared when another page is opened", async () => {
    // Starters and reopened backups keep the block ids from their file, so two
    // pages made from one starting point share a menu block id. A paste left
    // standing across a page switch would reappear under a price list in a
    // document the seller never pasted into, and Add would write it there.
    // This is the guard `openPage` already documents for `selectedTiers`, which
    // feature 023 did not join until review caught it.
    const id = shop();
    startPasting(id);
    setPasteText(LIST);

    await newPage(getState().doc.target);

    expect(getState().pasting).toBeUndefined();
  });

  it("is cleared when the surface changes", () => {
    const id = shop();
    startPasting(id);
    setPasteText(LIST);

    setSurface("preview");

    expect(getState().pasting).toBeUndefined();
  });
});

describe("the count never promises more than the conversion delivers", () => {
  it("does not count a ticked blank line, which cannot become a product", () => {
    const id = shop();
    startPasting(id);
    setPasteText("Sketch, 30\n\nFull colour, 80");
    // Ticked by hand: `tickAllPasteLines` already refuses blanks, so only a
    // deliberate toggle can reach this state.
    togglePasteLine(1);

    const before = menuBlock().tiers.length;
    convertPaste();
    expect(menuBlock().tiers.length - before).toBe(2);
  });

  it("adds nothing when only unconvertible lines are ticked", () => {
    const id = shop();
    const before = JSON.stringify(getState().doc);

    startPasting(id);
    setPasteText("Sketch, 30\n\n");
    untickAllPasteLines();
    togglePasteLine(1);
    convertPaste();

    expect(JSON.stringify(getState().doc)).toBe(before);
  });
});

describe("reopening the panel", () => {
  it("keeps a paste already in progress, since pressing twice is not a decision", () => {
    const id = shop();
    startPasting(id);
    setPasteText(LIST);

    startPasting(id);

    expect(getState().pasting?.text).toBe(LIST);
  });
});

describe("what a converted row publishes", () => {
  it("never publishes the cost, for any target", () => {
    // The plan asked for this and the first pass only asserted that `cost` was
    // populated, which proves nothing about publication. `cost` is stored and
    // never compiled, and this compiles a real converted row to check it.
    // A distinctive cost, so the assertion cannot pass by coincidence against
    // a price or a row count that happens to share the digits.
    const id = shop();
    startPasting(id);
    setPasteText("Sketch, 30, each, 1337");
    convertPaste();

    const added = menuBlock().tiers.at(-1);
    expect(added?.cost).toBe("1337");

    for (const target of TARGETS) {
      expect([target.id, compile(getState().doc, target).markdown.includes("1337")]).toEqual([target.id, false]);
    }
  });
});

describe("a paste larger than the screen draws", () => {
  it("converts every ticked line, including the ones never drawn", () => {
    // The panel draws at most five hundred lines so an enormous paste cannot
    // freeze a phone. The cap is on drawing only, and this is the assertion
    // that says so. Deliberately headless: nothing is subscribed, so the store
    // does the work without rendering five hundred price list forms, which is
    // what made the same assertion time out when it lived in the screen test.
    document.body.innerHTML = '<div id="app"></div>';
    init(false);
    addBlock(blankBlock("menu"));
    const id = menuBlock().id;

    startPasting(id);
    setPasteText(Array.from({ length: 620 }, (_, i) => `Item ${String(i)}, ${String(i)}`).join("\n"));
    convertPaste();

    expect(menuBlock().tiers).toHaveLength(620);
  });
});

describe("undoing a conversion", () => {
  it("puts the price list back exactly as it was", () => {
    const id = shop();
    const before = JSON.stringify(getState().doc);

    startPasting(id);
    setPasteText(LIST);
    convertPaste();
    expect(JSON.stringify(getState().doc)).not.toBe(before);

    undoLast();
    expect(JSON.stringify(getState().doc)).toBe(before);
  });

  it("leaves the text and the ticks on screen, so the selection can be corrected", () => {
    // FR-064a. Undo that also threw away the paste would mean starting over,
    // which is the opposite of what an undo is for.
    const id = shop();
    startPasting(id);
    setPasteText(LIST);
    convertPaste();
    undoLast();

    expect(getState().pasting?.text).toBe(LIST);
    expect(getState().pasting?.ticked).toEqual([0, 1, 2]);
  });

  it("offers one undo, not a stack, which is all State.undo can hold", () => {
    // Recorded because the request that opened this feature assumed a stack.
    // `State.undo` is one slot and `update()` clears it on the next write, so
    // a second conversion replaces the offer rather than stacking on it.
    const id = shop();
    startPasting(id);
    setPasteText("Sketch, 30");
    convertPaste();
    convertPaste();

    undoLast();
    undoLast();

    expect(menuBlock().tiers.filter((t) => t.name === "Sketch")).toHaveLength(1);
  });
});
