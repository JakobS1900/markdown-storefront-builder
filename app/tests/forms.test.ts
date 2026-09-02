/**
 * @vitest-environment jsdom
 *
 * What a section offers when it holds nothing yet.
 *
 * A Prices section with no items used to render two controls and no fields:
 * "Add another item" and a folded "Section settings". There was nothing on
 * screen to type a price into, and the button offered "another" of something
 * that did not exist. A Gallery with no images did the same.
 *
 * That is not a rare state. It is what every section saved before items were
 * seeded looks like, and it is what any section becomes the moment its last row
 * is removed. Found on a Moto G7 by opening a real saved page whose Prices
 * section read "0 items" and discovering there was no way to add a price
 * without first noticing a button that describes the wrong thing.
 *
 * The fix is a placeholder row: an empty section shows one blank item, and the
 * document gains that item at the moment the artist types into it. Until then
 * nothing is written, so an untouched section stays genuinely empty.
 */
import { beforeEach, describe, expect, it } from "vitest";

import { addBlock, getState, init, selectBlock, subscribe, updateBlock } from "../src/store.js";
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

/** Puts a section on screen, emptied of its rows, the way a saved one can be. */
function emptySection(kind: "menu" | "gallery"): string {
  addBlock(blankBlock(kind));
  const block = getState().doc.blocks[0];
  if (block === undefined) throw new Error("no block");
  if (block.kind === "menu") updateBlock(block.id, { ...block, tiers: [] });
  else if (block.kind === "gallery") updateBlock(block.id, { ...block, items: [] });
  else throw new Error(`${block.kind} holds no rows`);
  selectBlock(block.id);
  return block.id;
}

function labels(): string[] {
  return [...document.querySelectorAll("#surface label")].map((l) => (l.textContent ?? "").trim());
}

function fieldByLabel(text: string): HTMLInputElement | HTMLTextAreaElement {
  const label = [...document.querySelectorAll("#surface label")].find(
    (l) => (l.textContent ?? "").trim() === text,
  );
  if (label === undefined) throw new Error(`no field labelled "${text}", saw: ${labels().join(" | ")}`);
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

describe("a Prices section holding no items", () => {
  it("still shows an item and a price to fill in", () => {
    live();
    emptySection("menu");
    expect(labels()).toContain("Item");
    expect(labels()).toContain("Price");
  });

  it("adds the item to the page as soon as it is typed into", () => {
    live();
    emptySection("menu");
    typeInto("Item", "Full body");

    const block = getState().doc.blocks[0];
    if (block === undefined || block.kind !== "menu") throw new Error("not a menu");
    // The id is minted by newId() when the placeholder row is typed into, so
    // its value is not predictable here. Checked separately from the fields
    // the artist actually typed, which still match exactly.
    expect(block.tiers).toHaveLength(1);
    expect(block.tiers[0]).toMatchObject({ name: "Full body", price: "" });
    expect(block.tiers[0]?.id).not.toBe("");
  });

  it("writes nothing while the artist has not typed anything", () => {
    live();
    emptySection("menu");

    const block = getState().doc.blocks[0];
    if (block === undefined || block.kind !== "menu") throw new Error("not a menu");
    expect(block.tiers).toEqual([]);
  });

  it("records the price when the price is what gets filled in first", () => {
    live();
    emptySection("menu");
    typeInto("Price", "120");

    const block = getState().doc.blocks[0];
    if (block === undefined || block.kind !== "menu") throw new Error("not a menu");
    // See the comment above on the same minted-id reasoning.
    expect(block.tiers).toHaveLength(1);
    expect(block.tiers[0]).toMatchObject({ name: "", price: "120" });
    expect(block.tiers[0]?.id).not.toBe("");
  });
});

describe("a Gallery section holding no images", () => {
  it("still shows an image address to fill in", () => {
    live();
    emptySection("gallery");
    expect(labels()).toContain("Image address");
  });

  it("adds the image to the page as soon as an address is typed", () => {
    live();
    emptySection("gallery");
    typeInto("Image address", "https://example.com/a.png");

    const block = getState().doc.blocks[0];
    if (block === undefined || block.kind !== "gallery") throw new Error("not a gallery");
    expect(block.items).toEqual([{ imageUrl: "https://example.com/a.png" }]);
  });
});
