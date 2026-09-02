/**
 * @vitest-environment jsdom
 *
 * Applying pricing to many rows at once: the preview, the write-back, and the
 * one undo that reverses it.
 *
 * FR-056 through FR-058. What a naive per-row loop would get wrong, and what
 * this checks instead:
 *
 *   - one apply is one save. `update()` at `store.ts` fires a full document
 *     IndexedDB write on every call, so forty separate writes would be forty
 *     writes and forty "Saved" flickers for what a seller experiences as one
 *     button press.
 *   - a row that cannot be priced (FR-056a: cost missing or unparseable) is
 *     named as skipped and comes out completely untouched, never guessed at.
 *   - one undo restores every row at once, the same wholesale-restore
 *     mechanism a removed row already uses.
 */
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { addBlock, getState, init, selectBlock, selectTiers, subscribe, updateBlock } from "../src/store.js";
import { BLANK_BULK_PRICING_INPUTS, computeBulkPreview } from "../src/ui/bulk-pricing.js";
import { blankBlock } from "../src/ui/forms.js";
import { renderShell } from "../src/ui/shell.js";

let stop: (() => void) | undefined;

/**
 * `storageOk` defaults to false, matching `tier-selection.test.ts` and
 * `cost-and-profit.test.ts`: with storage disabled, `save()` returns at once
 * (`store.ts`) rather than opening IndexedDB, so most of these tests never
 * touch it and cannot be affected by another test's write still settling.
 * Only "writes exactly once" needs storage on, and it is the only test that
 * passes `true`.
 */
function live(storageOk = false): HTMLElement {
  document.body.innerHTML =
    '<a class="skip" href="#surface">Skip</a><div id="app"></div>' +
    '<div id="live-region" class="sr-only" role="status" aria-live="polite"></div>';
  const root = document.getElementById("app");
  if (root === null) throw new Error("missing #app");
  init(storageOk);
  stop = subscribe(() => renderShell(root));
  renderShell(root);
  return root;
}

beforeEach(() => {
  stop?.();
  stop = undefined;
  globalThis.indexedDB = new IDBFactory();
});

async function settle(): Promise<void> {
  for (let i = 0; i < 10; i += 1) await new Promise((r) => setTimeout(r, 0));
}

function menuBlock(): Extract<ReturnType<typeof getState>["doc"]["blocks"][number], { kind: "menu" }> {
  const block = getState().doc.blocks[0];
  if (block === undefined || block.kind !== "menu") throw new Error("not a menu");
  return block;
}

function tierRecords(): Record<string, unknown>[] {
  return menuBlock().tiers as unknown as Record<string, unknown>[];
}

/**
 * A price list with four rows: two that can be priced ("Widget", whose price
 * carries a "from " surround, and "Gadget", which does not), one with no cost
 * at all ("Mystery"), and one whose cost cannot be read ("Puzzle"). All four
 * are selected.
 */
function shop(storageOk = false): HTMLElement {
  const root = live(storageOk);
  addBlock(blankBlock("menu"));
  updateBlock(menuBlock().id, {
    ...menuBlock(),
    tiers: [
      { id: "a", name: "Widget", price: "from 12", cost: "12" },
      { id: "b", name: "Gadget", price: "20", cost: "10" },
      { id: "c", name: "Mystery", price: "9.99" },
      { id: "d", name: "Puzzle", price: "15", cost: "who knows" },
    ],
  });
  selectBlock(menuBlock().id);
  selectTiers(menuBlock().id, ["a", "b", "c", "d"]);
  renderShell(root);
  return root;
}

function fieldByLabel(text: string): HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement {
  const label = [...document.querySelectorAll("#surface label")].find((l) => (l.textContent ?? "").trim() === text);
  if (label === undefined) {
    const seen = [...document.querySelectorAll("#surface label")].map((l) => (l.textContent ?? "").trim()).join(" | ");
    throw new Error(`no field labelled "${text}", saw: ${seen}`);
  }
  const control = document.getElementById(label.getAttribute("for") ?? "");
  if (
    !(control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement || control instanceof HTMLSelectElement)
  ) {
    throw new Error(`"${text}" is not a control`);
  }
  return control;
}

function typeInto(control: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  control.value = value;
  control.dispatchEvent(new Event("input", { bubbles: true }));
}

function chooseOption(control: HTMLSelectElement, value: string): void {
  control.value = value;
  control.dispatchEvent(new Event("change", { bubbles: true }));
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

function previewText(): string {
  return document.querySelector("#surface .bulk-preview")?.textContent ?? "";
}

function skippedText(): string {
  return document.querySelector("#surface .bulk-skipped")?.textContent ?? "";
}

/**
 * Types a multiplier, an addition and a rounding choice into the panel.
 *
 * Each control is looked up fresh, immediately before it is used, rather than
 * all three up front. Typing into any one of them updates `bulkPricingInputs`
 * and (nobody has focus in this test, unlike a real browser) repaints at
 * once, which rebuilds the whole tree and makes every previously grabbed
 * element stale. Reading the next control only after that repaint is what a
 * real seller gets for free from focus deferring it; here it has to be done
 * by hand.
 */
function fillPanel(root: HTMLElement, multiplier: string, extra: string, rounding: string): void {
  const multiplierField = fieldByLabel("Multiply cost by");
  if (!(multiplierField instanceof HTMLInputElement)) throw new Error("expected a text input");
  typeInto(multiplierField, multiplier);
  renderShell(root);

  const extraField = fieldByLabel("Add");
  if (!(extraField instanceof HTMLInputElement)) throw new Error("expected a text input");
  typeInto(extraField, extra);
  renderShell(root);

  const roundingField = fieldByLabel("Round up to");
  if (!(roundingField instanceof HTMLSelectElement)) throw new Error("expected a select");
  chooseOption(roundingField, rounding);
  renderShell(root);
}

describe("before anything is typed", () => {
  it("opens with Apply disabled and changes nothing if pressed, on a fixture where price and cost differ", () => {
    // Review finding: multiplier "1" and add "0" look inert but are not,
    // since price = cost * 1 + 0 is price = cost. Gadget here is price 20,
    // cost 10, so a fixture that used equal price and cost (as an earlier
    // version of this test did) could pass by accident even with that bug
    // back. Blank is the only default that cannot silently zero a margin.
    const root = shop();
    const before = JSON.stringify(getState().doc);

    const applyButton = [...document.querySelectorAll("#surface button")].find(
      (b) => (b.textContent ?? "").trim() === "Apply pricing",
    );
    if (!(applyButton instanceof HTMLButtonElement)) throw new Error("no Apply pricing button");
    expect(applyButton.disabled).toBe(true);

    applyButton.click();
    renderShell(root);

    expect(JSON.stringify(getState().doc)).toBe(before);
  });
});

describe("the preview", () => {
  it("shows old price, new price and profit for each selected row before anything is applied", () => {
    const root = shop();
    fillPanel(root, "3", "2", "99");

    // Widget: cost 12 * 3 + 2 = 38, rounded up to .99 -> 38.99, profit 26.99.
    expect(previewText()).toContain("from 12");
    expect(previewText()).toContain("from 38.99");
    expect(previewText()).toContain("26.99");

    // Gadget: cost 10 * 3 + 2 = 32, rounded up to .99 -> 32.99, profit 22.99.
    expect(previewText()).toContain("32.99");
    expect(previewText()).toContain("22.99");
  });

  it("leaves the document unchanged while it is on screen", () => {
    const root = shop();
    const before = JSON.stringify(getState().doc);

    fillPanel(root, "3", "2", "99");

    expect(JSON.stringify(getState().doc)).toBe(before);
  });
});

describe("rows that cannot be priced", () => {
  it("names a row with no cost, and a row with an unparseable cost, as skipped", () => {
    const root = shop();
    fillPanel(root, "3", "2", "99");

    expect(skippedText().toLowerCase()).toContain("skip");
    expect(skippedText()).toContain("Mystery");
    expect(skippedText()).toContain("Puzzle");
  });

  it("leaves both completely untouched after applying", () => {
    const root = shop();
    fillPanel(root, "3", "2", "99");

    press("Apply pricing");

    expect(tierRecords()[2]).toEqual({ id: "c", name: "Mystery", price: "9.99" });
    expect(tierRecords()[3]).toEqual({ id: "d", name: "Puzzle", price: "15", cost: "who knows" });
  });
});

describe("applying", () => {
  it("writes every selected row that could be priced", () => {
    const root = shop();
    fillPanel(root, "3", "2", "99");

    press("Apply pricing");

    expect(tierRecords()[0]?.["price"]).toBe("from 38.99");
    expect(tierRecords()[1]?.["price"]).toBe("32.99");
  });

  it('preserves the surround: a price of "from 12" becomes "from 38.99"', () => {
    const root = shop();
    fillPanel(root, "3", "2", "99");

    press("Apply pricing");

    expect(tierRecords()[0]?.["price"]).toBe("from 38.99");
  });

  it("does not clear the selection, so a seller can adjust and reapply", () => {
    const root = shop();
    fillPanel(root, "3", "2", "99");

    press("Apply pricing");

    expect([...(getState().selectedTiers?.tierIds ?? [])].sort()).toEqual(["a", "b", "c", "d"]);
  });

  it("writes exactly once for one application, not once per row", async () => {
    // Storage on, unlike every other test in this file: this is the one
    // property that needs a real IndexedDB write to count.
    const root = shop(true);
    fillPanel(root, "3", "2", "99");
    await settle();
    const putSpy = vi.spyOn(IDBObjectStore.prototype, "put");

    press("Apply pricing");
    await settle();

    expect(putSpy).toHaveBeenCalledTimes(1);
  });
});

describe("undo", () => {
  it("reverses the whole application, every row at once", () => {
    const root = shop();
    const original = JSON.parse(JSON.stringify(tierRecords())) as Record<string, unknown>[];
    fillPanel(root, "3", "2", "99");

    press("Apply pricing");
    renderShell(root);
    expect(tierRecords()[0]?.["price"]).toBe("from 38.99");

    press("Undo pricing 2 items");
    renderShell(root);

    expect(tierRecords()).toEqual(original);
  });
});

/**
 * Direct tests of the pure arithmetic, with no DOM, no jsdom repaint
 * ordering, and no fillPanel. These cover boundary cases that a rendered
 * panel makes awkward to reach: a discount typed as a negative "add", a
 * multiplier of zero, an exact multiple under "whole" rounding, and a row
 * whose cost parses next to a price that does not.
 */
describe("computeBulkPreview directly", () => {
  it("computes nothing at all when the multiplier or add is blank, the panel's own default", () => {
    const tiers = [{ id: "a", name: "Widget", price: "20", cost: "10" }];

    expect(computeBulkPreview(tiers, ["a"], BLANK_BULK_PRICING_INPUTS)).toEqual({ changed: [], skipped: [] });
  });

  it("treats a negative add as a discount, not as a decoration on the number", () => {
    // parseMoney would read "-2" as prefix "-", cents 200: a decoration, not
    // a sign. This is typed into a setting the seller controls right now, not
    // a price someone else wrote freehand, so it has to read as minus two.
    const tiers = [{ id: "a", name: "Widget", price: "20", cost: "10" }];

    const result = computeBulkPreview(tiers, ["a"], { multiplier: "1", extra: "-2", rounding: "none" });

    expect(result.changed).toEqual([{ id: "a", name: "Widget", oldPrice: "20", newPrice: "8.00", profit: "-2.00" }]);
  });

  it("allows a multiplier of zero, computing a full loss rather than refusing", () => {
    const tiers = [{ id: "a", name: "Widget", price: "20", cost: "10" }];

    const result = computeBulkPreview(tiers, ["a"], { multiplier: "0", extra: "0", rounding: "none" });

    expect(result.changed).toEqual([{ id: "a", name: "Widget", oldPrice: "20", newPrice: "0.00", profit: "-10.00" }]);
  });

  it('rounding "whole" leaves an exact multiple alone rather than bumping it up a dollar', () => {
    // FR-056d: rounding never reduces a price, but it must not inflate one
    // that already lands exactly on the chosen ending either. 10 * 3 is
    // exactly 30.00, already a whole number.
    const tiers = [{ id: "a", name: "Widget", price: "20", cost: "10" }];

    const result = computeBulkPreview(tiers, ["a"], { multiplier: "3", extra: "0", rounding: "whole" });

    expect(result.changed).toEqual([{ id: "a", name: "Widget", oldPrice: "20", newPrice: "30.00", profit: "20.00" }]);
  });

  it("falls back to a bare number when the cost parses but the price does not", () => {
    const tiers = [{ id: "a", name: "Widget", price: "DM me", cost: "10" }];

    const result = computeBulkPreview(tiers, ["a"], { multiplier: "2", extra: "0", rounding: "none" });

    expect(result.changed).toEqual([
      { id: "a", name: "Widget", oldPrice: "DM me", newPrice: "20.00", profit: "10.00" },
    ]);
  });
});
