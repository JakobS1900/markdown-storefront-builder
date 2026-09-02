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
 */
import { beforeEach, describe, expect, it } from "vitest";

import {
  addBlock,
  getState,
  init,
  selectBlock,
  selectTiers,
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
  it("puts that row's id in the selection", () => {
    shop();
    checkboxFor("Bust").click();
    expect(getState().selectedTierIds).toEqual(["bust"]);
  });

  it("the count line reads how many are selected", () => {
    shop();
    expect(countLine()).toContain("0");
    checkboxFor("Bust").click();
    checkboxFor("Half body").click();
    expect(countLine()).toContain("2");
  });
});

describe("select all and none", () => {
  it("select all selects every real row and not the blank placeholder row", () => {
    shop();
    // Three checkboxes for three real rows, nothing extra: there is no
    // placeholder to have a checkbox at all while real rows exist.
    expect(document.querySelectorAll("#surface fieldset.item input[type=checkbox]").length).toBe(3);
    press("Select all");
    expect([...getState().selectedTierIds].sort()).toEqual(["bust", "full-body", "half-body"]);
  });

  it("never offers a checkbox on the blank placeholder row, and select all reaches for nothing when only it remains", () => {
    // BLANK_ROW in forms.ts: once every real row is gone the section still
    // draws one empty row to type into, and rowTools already refuses it a
    // move or remove control. The checkbox this task adds must refuse it the
    // same way, or "select all" on an empty list would select a row that is
    // not in the document.
    shop();
    press("Remove item 1");
    press("Remove item 1");
    press("Remove item 1");
    expect(menuBlock().tiers).toHaveLength(0);
    expect(document.querySelectorAll("#surface fieldset.item input[type=checkbox]").length).toBe(0);

    press("Select all");
    expect(getState().selectedTierIds).toEqual([]);
  });

  it("none clears it", () => {
    shop();
    press("Select all");
    expect(getState().selectedTierIds.length).toBe(3);
    press("Select none");
    expect(getState().selectedTierIds).toEqual([]);
  });
});

describe("the selection survives everything but a row's own removal", () => {
  it("reordering a row leaves the selection unchanged", () => {
    shop();
    selectTiers(["bust"]);

    // The real reorder path, not a simulated one: the same "Move item 1 down"
    // button row-tools.test.ts and cost-and-profit.test.ts drive, which runs
    // rowTools' `reorder` callback into `moved()` and back through
    // `onChange` -> `updateBlock` -> `store.update()`. Nothing here touches
    // `selectedTierIds` directly.
    press("Move item 1 down");

    expect(menuBlock().tiers.map((t) => t.name)).toEqual(["Half body", "Bust", "Full body"]);
    // Bust is now the second row, not the first, and its id is still selected.
    expect(menuBlock().tiers[1]).toMatchObject({ id: "bust", name: "Bust" });
    expect(getState().selectedTierIds).toEqual(["bust"]);
  });

  it("removing a selected row drops only that row from the selection", () => {
    shop();
    selectTiers(["bust", "half-body"]);

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
    selectTiers(["half-body"]);

    press("Remove item 1");

    expect(menuBlock().tiers.map((t) => t.id)).toEqual(["half-body", "full-body"]);
    expect(countLine()).toContain("1");
    expect(checkboxFor("Half body").checked).toBe(true);
  });

  it("editing a row's name leaves the selection unchanged", () => {
    shop();
    selectTiers(["bust"]);

    const [bustName] = fieldsByLabel("Item");
    if (bustName === undefined) throw new Error("no Item field");
    typeInto(bustName, "Bust (large)");

    expect(menuBlock().tiers[0]).toMatchObject({ id: "bust", name: "Bust (large)" });
    // update() clears undo on every edit; selection must not follow it.
    expect(getState().selectedTierIds).toEqual(["bust"]);
  });

  it("switching surface clears the selection", () => {
    shop();
    selectTiers(["bust"]);

    setSurface("preview");

    expect(getState().selectedTierIds).toEqual([]);
  });
});
