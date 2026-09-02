/**
 * @vitest-environment jsdom
 *
 * The bulk pricing box, from typing to document and back.
 *
 * This field is typed as lines and stored as pairs, so the parse is the whole
 * feature: whatever it gets wrong ends up in somebody's saved page. The details
 * field shipped without a test at this level, which is a gap, and this one
 * should not widen it, because unlike details this field decides how the entire
 * section is laid out.
 *
 * FR-028, and the entry format in specs/017-quantity-pricing/spec.md.
 */
import { beforeEach, describe, expect, it } from "vitest";

import { addBlock, getState, init, selectBlock, subscribe, updateBlock } from "../src/store.js";
import { blankBlock } from "../src/ui/forms.js";
import { renderShell } from "../src/ui/shell.js";

const LABEL = "Bulk pricing (optional)";

let stop: (() => void) | undefined;

function live(): void {
  document.body.innerHTML =
    '<a class="skip" href="#surface">Skip</a><div id="app"></div>' +
    '<div id="live-region" class="sr-only" role="status" aria-live="polite"></div>';
  const root = document.getElementById("app");
  if (root === null) throw new Error("missing #app");
  init(false);
  stop = subscribe(() => renderShell(root));
  renderShell(root);
}

beforeEach(() => {
  stop?.();
  stop = undefined;
});

/** A Prices section holding one real item, selected and on screen. */
function itemSection(): void {
  live();
  addBlock(blankBlock("menu"));
  const block = getState().doc.blocks[0];
  if (block === undefined || block.kind !== "menu") throw new Error("not a menu");
  updateBlock(block.id, { ...block, tiers: [{ id: "bananas", name: "Bananas", price: "20" }] });
  selectBlock(block.id);
}

function fieldByLabel(text: string): HTMLInputElement | HTMLTextAreaElement {
  const label = [...document.querySelectorAll("#surface label")].find(
    (l) => (l.textContent ?? "").trim() === text,
  );
  if (label === undefined) {
    const seen = [...document.querySelectorAll("#surface label")]
      .map((l) => (l.textContent ?? "").trim())
      .join(" | ");
    throw new Error(`no field labelled "${text}", saw: ${seen}`);
  }
  const control = document.getElementById(label.getAttribute("for") ?? "");
  if (!(control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement)) {
    throw new Error(`"${text}" is not typable`);
  }
  return control;
}

function typeInto(label: string, value: string): void {
  const control = fieldByLabel(label);
  control.value = value;
  control.dispatchEvent(new Event("input", { bubbles: true }));
}

function tier(): Record<string, unknown> {
  const block = getState().doc.blocks[0];
  if (block === undefined || block.kind !== "menu") throw new Error("not a menu");
  const first = block.tiers[0];
  if (first === undefined) throw new Error("no item");
  return first as unknown as Record<string, unknown>;
}

describe("the field is reachable without opening anything", () => {
  it("sits outside every fold, not merely somewhere in the document", () => {
    // A label inside a closed <details> is still in the DOM, so finding it
    // proves nothing about whether anyone can see it. Asserting on the
    // ancestor is the actual property: this field decides the section's whole
    // layout and must not be behind a disclosure nobody opens.
    itemSection();
    const control = fieldByLabel(LABEL);
    expect(control.closest("details")).toBeNull();
  });

  it("is above the fold that holds the secondary fields", () => {
    itemSection();
    const bulk = fieldByLabel(LABEL);
    const details = fieldByLabel("Details (optional)");
    expect(details.closest("details")).not.toBeNull();
    expect(bulk.compareDocumentPosition(details) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe("what typing produces", () => {
  it("turns one line per break into amount and price pairs", () => {
    itemSection();
    typeInto(LABEL, "1 lb = 20\n5 lb = 90\n10 lb = 150");
    expect(tier()["quantities"]).toEqual([
      { amount: "1 lb", price: "20" },
      { amount: "5 lb", price: "90" },
      { amount: "10 lb", price: "150" },
    ]);
  });

  it("accepts a colon from somebody who types one out of habit", () => {
    itemSection();
    typeInto(LABEL, "1 lb: 20\n5 lb: 90");
    expect(tier()["quantities"]).toEqual([
      { amount: "1 lb", price: "20" },
      { amount: "5 lb", price: "90" },
    ]);
  });

  it("splits on whichever separator comes first", () => {
    // "2 for 1 = 30" and "half: 5 = 6" both have to land somewhere sensible.
    itemSection();
    typeInto(LABEL, "a: b = c");
    expect(tier()["quantities"]).toEqual([{ amount: "a", price: "b = c" }]);
  });

  it("keeps a line with no separator rather than discarding what was typed", () => {
    // Half a break is dropped by the compiler, not by the form. Throwing the
    // text away while somebody is still typing it is the worse failure.
    itemSection();
    typeInto(LABEL, "5 lb");
    expect(tier()["quantities"]).toEqual([{ amount: "5 lb", price: "" }]);
  });

  it("ignores blank lines between breaks", () => {
    itemSection();
    typeInto(LABEL, "1 lb = 20\n\n5 lb = 90\n");
    expect(tier()["quantities"]).toEqual([
      { amount: "1 lb", price: "20" },
      { amount: "5 lb", price: "90" },
    ]);
  });

  it("removes the field from the item entirely when emptied", () => {
    // Not an empty array. An absent optional field and an empty one must not
    // both be able to mean the same thing, or round tripping stops being equal.
    itemSection();
    typeInto(LABEL, "1 lb = 20");
    expect(tier()).toHaveProperty("quantities");
    typeInto(LABEL, "");
    expect(tier()).not.toHaveProperty("quantities");
  });
});

describe("what the field shows on the way back", () => {
  it("renders saved breaks in the format it accepts", () => {
    itemSection();
    const block = getState().doc.blocks[0];
    if (block === undefined || block.kind !== "menu") throw new Error("not a menu");
    updateBlock(block.id, {
      ...block,
      tiers: [
        {
          id: "bananas",
          name: "Bananas",
          price: "20",
          quantities: [
            { amount: "1 lb", price: "20" },
            { amount: "5 lb", price: "90" },
          ],
        },
      ],
    });
    selectBlock(block.id);
    expect(fieldByLabel(LABEL).value).toBe("1 lb = 20\n5 lb = 90");
  });

  it("survives a round trip through the field unchanged", () => {
    itemSection();
    typeInto(LABEL, "1 lb = 20\n5 lb = 90");
    const first = tier()["quantities"];
    const shown = fieldByLabel(LABEL).value;
    typeInto(LABEL, shown);
    expect(tier()["quantities"]).toEqual(first);
  });
});
