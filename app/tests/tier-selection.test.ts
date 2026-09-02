/**
 * @vitest-environment jsdom
 *
 * Selecting rows in a price list, by identity rather than position.
 *
 * FR-055 and FR-055a. Task 1's schema change, a version bump and a migration
 * touching every saved page, was taken for exactly one reason: so a selection
 * can name "these forty of sixty" and survive the seller reordering a row.
 * "reordering a row leaves the selection unchanged" below is that requirement
 * proved, not a nice-to-have beside the others.
 *
 * Removal is handled differently on purpose and the tests below reflect it:
 * the selection is read through the live document rather than chased through
 * every path that can shrink a section, so a removed row's id simply stops
 * counting. That is checked through what the toolbar and the remaining
 * checkboxes actually show, which is what a seller sees, rather than through
 * the raw array, which by design still lists whatever it was last told.
 *
 * A first pass held the selection as a flat, document-wide array of ids.
 * Review caught that tier ids are unique only within their own menu block,
 * not across the document: `engine/src/document/migrate.ts` restarts
 * numbering at `t0` for every menu section it migrates, so two different
 * price lists on the same page can each hold a tier called `t0`. On the
 * app's own example page, three menu blocks migrate to `t0`, `t1`, `t2` (or a
 * subset of them) independently. "the selection is scoped to one price list"
 * below is that finding proved: it builds two blocks sharing an id and checks
 * that ticking one never lights up the other.
 */
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";

import { writePage } from "../src/db.js";
import {
  addBlock,
  adopt,
  getState,
  init,
  newPage,
  openPage,
  selectBlock,
  selectTiers,
  setBulkPricingInputs,
  setSurface,
  subscribe,
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

/** The tier ids currently selected, empty when nothing is. */
function selectedIds(): readonly string[] {
  return getState().selectedTiers?.tierIds ?? [];
}

/** A price list with three real, named rows. */
function shop(): void {
  live();
  addBlock(blankBlock("menu"));
  updateBlock(menuBlock().id, {
    ...menuBlock(),
    tiers: [
      { id: "bust", name: "Bust", price: "45" },
      { id: "half-body", name: "Half body", price: "80" },
      { id: "full-body", name: "Full body", price: "120" },
    ],
  });
  selectBlock(menuBlock().id);
}

function checkboxFor(name: string): HTMLInputElement {
  const box = [...document.querySelectorAll<HTMLInputElement>("#surface input[type=checkbox]")].find(
    (c) => (document.querySelector(`label[for="${c.id}"]`)?.textContent ?? "") === `Select ${name}`,
  );
  if (box === undefined) throw new Error(`no checkbox named "Select ${name}"`);
  return box;
}

function press(label: string): void {
  const found = [...document.querySelectorAll("#surface button")].find(
    (b) => (b.getAttribute("aria-label") ?? b.textContent ?? "").trim() === label,
  );
  if (!(found instanceof HTMLButtonElement)) {
    const seen = [...document.querySelectorAll("#surface button")]
      .map((b) => (b.getAttribute("aria-label") ?? b.textContent ?? "").trim())
      .join(" | ");
    throw new Error(`no button "${label}", saw: ${seen}`);
  }
  found.click();
}

function countLine(): string {
  return document.querySelector("#surface .bulk-toolbar .count")?.textContent ?? "";
}

function fieldsByLabel(text: string): (HTMLInputElement | HTMLTextAreaElement)[] {
  return [...document.querySelectorAll("#surface label")]
    .filter((l) => (l.textContent ?? "").trim() === text)
    .map((l) => {
      const control = document.getElementById(l.getAttribute("for") ?? "");
      if (!(control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement)) {
        throw new Error(`"${text}" is not typable`);
      }
      return control;
    });
}

function typeInto(control: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  control.value = value;
  control.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("ticking a row", () => {
  it("puts that row's id in the selection, scoped to its own block", () => {
    shop();
    checkboxFor("Bust").click();
    expect(getState().selectedTiers).toEqual({ blockId: menuBlock().id, tierIds: ["bust"] });
  });

  it("the count line reads how many are selected", () => {
    shop();
    expect(countLine()).toContain("0");
    checkboxFor("Bust").click();
    checkboxFor("Half body").click();
    expect(countLine()).toContain("2");
  });

  it("shows the tick and the count at once, even though a real browser focuses the checkbox it was clicked on", () => {
    // jsdom's own .click() does not run the focusing steps a real click does,
    // so every other test in this file leaves document.activeElement at BODY
    // and cannot exercise store.ts's typing() guard at all. Focusing by hand
    // first reproduces what a real tap on a checkbox does, and is what
    // catches typing() once having treated any focused HTMLInputElement,
    // checkbox included, as "still typing" and deferring the repaint for as
    // long as it held focus.
    //
    // The repaint this triggers rebuilds the tree, the same as any other
    // change, so the checkbox node itself is not the same object afterwards;
    // what is checked is the state and what is on screen, not node identity.
    shop();
    const box = checkboxFor("Bust");
    box.focus();
    box.click();

    expect(getState().selectedTiers).toEqual({ blockId: menuBlock().id, tierIds: ["bust"] });
    expect(countLine()).toContain("1");
  });
});

describe("select all and none", () => {
  it("select all selects every real row and not the blank placeholder row", () => {
    shop();
    // Three checkboxes for three real rows, nothing extra: there is no
    // placeholder to have a checkbox at all while real rows exist.
    expect(document.querySelectorAll("#surface fieldset.item input[type=checkbox]").length).toBe(3);
    press("Select all");
    expect([...selectedIds()].sort()).toEqual(["bust", "full-body", "half-body"]);
  });

  it("never offers a checkbox on the blank placeholder row, and offers no toolbar at all when only it remains", () => {
    // BLANK_ROW in forms.ts: once every real row is gone the section still
    // draws one empty row to type into, and rowTools already refuses it a
    // move or remove control. The checkbox this task adds must refuse it the
    // same way, or "select all" on an empty list would select a row that is
    // not in the document.
    //
    // The toolbar itself is now gone too, not merely inert (a whole-branch
    // review finding, `forms.ts`'s menuForm): "0 selected", "Select all" and
    // "Select none" ahead of an empty price list's one placeholder row read as
    // settings for something that does not exist yet. This test used to press
    // "Select all" here and assert it selected nothing; there is no longer a
    // "Select all" button to press once `block.tiers` is empty, which is a
    // stronger form of the same guarantee.
    shop();
    press("Remove item 1");
    press("Remove item 1");
    press("Remove item 1");
    expect(menuBlock().tiers).toHaveLength(0);
    expect(document.querySelectorAll("#surface fieldset.item input[type=checkbox]").length).toBe(0);

    expect(document.querySelector("#surface .bulk-toolbar")).toBeNull();
    expect(selectedIds()).toEqual([]);
  });

  it("none clears it", () => {
    shop();
    press("Select all");
    expect(selectedIds().length).toBe(3);
    press("Select none");
    expect(selectedIds()).toEqual([]);
  });
});

describe("the selection is scoped to one price list, never the whole document", () => {
  /**
   * Two menu blocks sharing a tier id, exactly as the migration produces:
   * `engine/src/document/migrate.ts` restarts numbering at `t0` for every
   * menu section, so two price lists on one page legitimately share ids. The
   * app's own `public/example.json`, still at schema version 1, migrates to
   * three menu blocks that do exactly this.
   */
  function twoShops(): void {
    live();
    addBlock(blankBlock("menu"));
    addBlock(blankBlock("menu"));
    const [first, second] = getState().doc.blocks;
    if (first === undefined || first.kind !== "menu" || second === undefined || second.kind !== "menu") {
      throw new Error("expected two menu blocks");
    }
    updateBlock(first.id, { ...first, tiers: [{ id: "t0", name: "Knife", price: "40" }] });
    updateBlock(second.id, { ...second, tiers: [{ id: "t0", name: "Lamp", price: "25" }] });
  }

  function blocks(): [ReturnType<typeof menuBlock>, ReturnType<typeof menuBlock>] {
    const [first, second] = getState().doc.blocks;
    if (first === undefined || first.kind !== "menu" || second === undefined || second.kind !== "menu") {
      throw new Error("expected two menu blocks");
    }
    return [first, second];
  }

  it("ticking the row in one block leaves the same id unticked in the other", () => {
    twoShops();
    const [first, second] = blocks();

    selectBlock(first.id);
    checkboxFor("Knife").click();

    // The first list's own checkbox is ticked and its count reads one.
    expect(checkboxFor("Knife").checked).toBe(true);
    expect(countLine()).toContain("1");

    // The second list shares the same tier id, "t0", but must read as
    // nothing selected: the selection names a block, not a bare id.
    selectBlock(second.id);
    expect(checkboxFor("Lamp").checked).toBe(false);
    expect(countLine()).toContain("0");
  });

  it("selecting all in the second block replaces the first block's selection rather than merging with it", () => {
    // The shape holds exactly one block's selection at a time, which is what
    // the store's comment on `selectedTiers` promises: selecting elsewhere
    // replaces rather than merges, because a selection naming two price
    // lists at once could not be told apart from one sharing an id by
    // accident. This is the deliberate replacement the brief allows for,
    // not the silent data loss the review warned against: it is visible on
    // screen as the first list's checkbox and count going back to unticked
    // and zero, never as a crash or a wrong row staying lit.
    twoShops();
    const [first, second] = blocks();

    selectTiers(first.id, ["t0"]);
    expect(getState().selectedTiers).toEqual({ blockId: first.id, tierIds: ["t0"] });

    selectTiers(second.id, ["t0"]);
    expect(getState().selectedTiers).toEqual({ blockId: second.id, tierIds: ["t0"] });

    // Provable through the document too: the first block's own tier id is no
    // longer read as selected anywhere.
    selectBlock(first.id);
    expect(checkboxFor("Knife").checked).toBe(false);
    expect(countLine()).toContain("0");
  });
});

describe("the selection survives everything but a row's own removal", () => {
  it("reordering a row leaves the selection unchanged", () => {
    shop();
    selectTiers(menuBlock().id, ["bust"]);

    // The real reorder path, not a simulated one: the same "Move item 1 down"
    // button row-tools.test.ts and cost-and-profit.test.ts drive, which runs
    // rowTools' `reorder` callback into `moved()` and back through
    // `onChange` -> `updateBlock` -> `store.update()`. Nothing here touches
    // `selectedTiers` directly.
    press("Move item 1 down");

    expect(menuBlock().tiers.map((t) => t.name)).toEqual(["Half body", "Bust", "Full body"]);
    // Bust is now the second row, not the first, and its id is still selected.
    expect(menuBlock().tiers[1]).toMatchObject({ id: "bust", name: "Bust" });
    expect(selectedIds()).toEqual(["bust"]);
  });

  it("removing a selected row drops only that row from the selection", () => {
    shop();
    selectTiers(menuBlock().id, ["bust", "half-body"]);

    press("Remove item 1");

    expect(menuBlock().tiers.map((t) => t.id)).toEqual(["half-body", "full-body"]);
    // What proves FR-055a is what the seller sees: the toolbar and the
    // remaining checkbox read the selection through the live document, so
    // Bust's id no longer counts even though nothing purged it on the way
    // out, and Half body is still ticked.
    expect(countLine()).toContain("1");
    expect(checkboxFor("Half body").checked).toBe(true);
  });

  it("removing an unselected row leaves the selection unchanged", () => {
    shop();
    selectTiers(menuBlock().id, ["half-body"]);

    press("Remove item 1");

    expect(menuBlock().tiers.map((t) => t.id)).toEqual(["half-body", "full-body"]);
    expect(countLine()).toContain("1");
    expect(checkboxFor("Half body").checked).toBe(true);
  });

  it("editing a row's name leaves the selection unchanged", () => {
    shop();
    selectTiers(menuBlock().id, ["bust"]);

    const [bustName] = fieldsByLabel("Item");
    if (bustName === undefined) throw new Error("no Item field");
    typeInto(bustName, "Bust (large)");

    expect(menuBlock().tiers[0]).toMatchObject({ id: "bust", name: "Bust (large)" });
    // update() clears undo on every edit; selection must not follow it.
    expect(selectedIds()).toEqual(["bust"]);
  });

  it("switching surface clears the selection", () => {
    shop();
    selectTiers(menuBlock().id, ["bust"]);

    setSurface("preview");

    expect(selectedIds()).toEqual([]);
  });
});

/**
 * A page change must clear the selection and the pricing panel's inputs, not
 * only `undo` and `selectedBlockId`. Starters and reopened backups keep the
 * block and tier ids from their file, so two pages made from the same
 * template can share a `blockId` such as "prices" and tier ids such as
 * "bust", and a selection left standing from the page just closed would go on
 * matching rows in a document nobody has ticked anything in on this page. The
 * spec calls repricing the wrong products the worst defect this feature could
 * ship.
 */
describe("a page change clears the selection and the pricing inputs", () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
  });

  it("newPage clears both", async () => {
    shop();
    selectTiers(menuBlock().id, ["bust"]);
    setBulkPricingInputs({ multiplier: "3", extra: "2", rounding: "none" });

    await newPage("rentry");

    expect(getState().selectedTiers).toBeUndefined();
    expect(getState().bulkPricingInputs).toBeUndefined();
  });

  it("adopt clears both", () => {
    shop();
    selectTiers(menuBlock().id, ["bust"]);
    setBulkPricingInputs({ multiplier: "3", extra: "2", rounding: "none" });

    adopt("second", { schemaVersion: 3, target: "rentry", blocks: [] });

    expect(getState().selectedTiers).toBeUndefined();
    expect(getState().bulkPricingInputs).toBeUndefined();
  });

  it("openPage clears both, even when the reopened page shares this exact block and tier id", async () => {
    shop();
    const blockId = menuBlock().id;
    selectTiers(blockId, ["bust"]);
    setBulkPricingInputs({ multiplier: "3", extra: "2", rounding: "none" });

    // A second, distinct page that happens to reuse this page's own block id
    // and tier id, exactly as two pages made from the same starter template
    // do. Without the fix, a selection surviving the switch would go on
    // matching this page's "bust" row too.
    await writePage({
      id: "second",
      json: JSON.stringify({
        schemaVersion: 3,
        target: "rentry",
        blocks: [{ id: blockId, kind: "menu", tiers: [{ id: "bust", name: "Bust", price: "45" }] }],
      }),
      title: "Second page",
      updatedAt: 1000,
    });

    await openPage("second");

    expect(getState().selectedTiers).toBeUndefined();
    expect(getState().bulkPricingInputs).toBeUndefined();
  });
});
