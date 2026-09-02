/**
 * @vitest-environment jsdom
 *
 * Moving and removing a row inside a section.
 *
 * Removing a SECTION was undoable and removing a ROW was not, which is
 * backwards: a shop has three sections and thirty products, and a product holds
 * a name, a price, a unit, a bulk table, several details and an image address.
 * Sections could be reordered and rows could not, for the same bad reason.
 *
 * Changing all of it broke no existing test, which is why this file exists.
 */
import { beforeEach, describe, expect, it } from "vitest";

import { addBlock, getState, init, selectBlock, subscribe, updateBlock } from "../src/store.js";
import { blankBlock } from "../src/ui/forms.js";
import { renderShell } from "../src/ui/shell.js";

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

/** A price list holding three real, filled-in items. */
function shop(): string {
  live();
  addBlock(blankBlock("menu"));
  const block = getState().doc.blocks[0];
  if (block === undefined || block.kind !== "menu") throw new Error("not a menu");
  updateBlock(block.id, {
    ...block,
    tiers: [
      { id: "bust", name: "Bust", price: "45" },
      { id: "half-body", name: "Half body", price: "80" },
      { id: "full-body", name: "Full body", price: "120" },
    ],
  });
  selectBlock(block.id);
  return block.id;
}

function names(): string[] {
  const block = getState().doc.blocks[0];
  if (block === undefined || block.kind !== "menu") throw new Error("not a menu");
  return block.tiers.map((t) => t.name);
}

function press(label: string): void {
  const button = [...document.querySelectorAll("#surface button")].find(
    (b) => (b.getAttribute("aria-label") ?? b.textContent ?? "").trim() === label,
  );
  if (!(button instanceof HTMLButtonElement)) {
    const seen = [...document.querySelectorAll("#surface button")]
      .map((b) => (b.getAttribute("aria-label") ?? b.textContent ?? "").trim())
      .join(" | ");
    throw new Error(`no button "${label}", saw: ${seen}`);
  }
  button.click();
}

describe("reordering a product", () => {
  it("moves one down", () => {
    shop();
    press("Move item 1 down");
    expect(names()).toEqual(["Half body", "Bust", "Full body"]);
  });

  it("moves one up", () => {
    shop();
    press("Move item 3 up");
    expect(names()).toEqual(["Bust", "Full body", "Half body"]);
  });

  it("cannot move the first one up or the last one down", () => {
    shop();
    const up = [...document.querySelectorAll("#surface button")].find(
      (b) => (b.getAttribute("aria-label") ?? "") === "Move item 1 up",
    );
    const down = [...document.querySelectorAll("#surface button")].find(
      (b) => (b.getAttribute("aria-label") ?? "") === "Move item 3 down",
    );
    expect((up as HTMLButtonElement).disabled).toBe(true);
    expect((down as HTMLButtonElement).disabled).toBe(true);
  });

  it("offers no move buttons when there is only one item", () => {
    live();
    addBlock(blankBlock("menu"));
    const block = getState().doc.blocks[0];
    if (block === undefined || block.kind !== "menu") throw new Error("not a menu");
    updateBlock(block.id, { ...block, tiers: [{ id: "only", name: "Only", price: "1" }] });
    selectBlock(block.id);
    const labels = [...document.querySelectorAll("#surface button")].map(
      (b) => b.getAttribute("aria-label") ?? "",
    );
    expect(labels.filter((l) => l.startsWith("Move item"))).toEqual([]);
    expect(labels).toContain("Remove item 1");
  });

  it("loses nothing that was typed into the row that moved", () => {
    shop();
    const block = getState().doc.blocks[0];
    if (block === undefined || block.kind !== "menu") throw new Error("not a menu");
    updateBlock(block.id, {
      ...block,
      tiers: [
        { id: "bust", name: "Bust", price: "45", unit: "each", details: [{ label: "Ink", value: "black" }] },
        { id: "half-body", name: "Half body", price: "80" },
      ],
    });
    selectBlock(block.id);
    press("Move item 1 down");
    const after = getState().doc.blocks[0];
    if (after === undefined || after.kind !== "menu") throw new Error("not a menu");
    expect(after.tiers[1]).toEqual({
      id: "bust",
      name: "Bust",
      price: "45",
      unit: "each",
      details: [{ label: "Ink", value: "black" }],
    });
  });
});

describe("removing a product can be undone", () => {
  it("removes it at once, with no confirmation", () => {
    shop();
    press("Remove item 2");
    expect(names()).toEqual(["Bust", "Full body"]);
  });

  it("offers to put it back", () => {
    shop();
    press("Remove item 2");
    const text = document.getElementById("surface")?.textContent ?? "";
    expect(text).toContain("Removed item 2.");
  });

  it("puts it back where it was, not on the end", () => {
    shop();
    press("Remove item 2");
    press("Undo removing item 2");
    expect(names()).toEqual(["Bust", "Half body", "Full body"]);
  });

  it("restores everything the row was carrying", () => {
    live();
    addBlock(blankBlock("menu"));
    const block = getState().doc.blocks[0];
    if (block === undefined || block.kind !== "menu") throw new Error("not a menu");
    const rich = {
      id: "dragon",
      name: "Articulated dragon",
      price: "18",
      unit: "each",
      quantities: [{ amount: "3", price: "48" }],
      details: [{ label: "Colour", value: "black" }],
      blurb: "One piece, no supports.",
      imageUrl: "https://e.test/d.png",
    };
    updateBlock(block.id, { ...block, tiers: [rich, { id: "desk-tray", name: "Desk tray", price: "12" }] });
    selectBlock(block.id);

    press("Remove item 1");
    press("Undo removing item 1");

    const after = getState().doc.blocks[0];
    if (after === undefined || after.kind !== "menu") throw new Error("not a menu");
    expect(after.tiers[0]).toEqual(rich);
  });

  it("takes the offer away once something else is done", () => {
    // Same rule the section undo follows: the next unrelated action clears it,
    // so a stale offer cannot put a row back into a section that has moved on.
    shop();
    press("Remove item 2");
    expect(getState().undo).toBeDefined();
    press("Move item 1 down");
    expect(getState().undo).toBeUndefined();
  });
});

describe("the same tools exist for the other kinds of row", () => {
  it("gallery images can be moved and removed", () => {
    live();
    addBlock(blankBlock("gallery"));
    const block = getState().doc.blocks[0];
    if (block === undefined || block.kind !== "gallery") throw new Error("not a gallery");
    updateBlock(block.id, {
      ...block,
      items: [{ imageUrl: "https://e.test/a.png" }, { imageUrl: "https://e.test/b.png" }],
    });
    selectBlock(block.id);

    press("Move image 1 down");
    const moved = getState().doc.blocks[0];
    if (moved === undefined || moved.kind !== "gallery") throw new Error("not a gallery");
    expect(moved.items[0]?.imageUrl).toBe("https://e.test/b.png");

    press("Remove image 1");
    press("Undo removing image 1");
    const back = getState().doc.blocks[0];
    if (back === undefined || back.kind !== "gallery") throw new Error("not a gallery");
    expect(back.items).toHaveLength(2);
  });

  it("profile links can be moved and removed", () => {
    live();
    addBlock(blankBlock("profile"));
    const block = getState().doc.blocks[0];
    if (block === undefined || block.kind !== "profile") throw new Error("not a profile");
    updateBlock(block.id, {
      ...block,
      displayName: "Ari",
      links: [
        { label: "Instagram", url: "https://e.test/i" },
        { label: "Email", url: "mailto:a@e.test" },
      ],
    });
    selectBlock(block.id);

    press("Move link 2 up");
    const moved = getState().doc.blocks[0];
    if (moved === undefined || moved.kind !== "profile") throw new Error("not a profile");
    expect(moved.links?.[0]?.label).toBe("Email");

    press("Remove link 1");
    press("Undo removing link 1");
    const back = getState().doc.blocks[0];
    if (back === undefined || back.kind !== "profile") throw new Error("not a profile");
    expect(back.links).toHaveLength(2);
  });
});

describe("removing a section still works the way it did", () => {
  it("is still undoable, and the two offers do not collide", () => {
    shop();
    press("Remove item 2");
    expect(getState().undo?.kind).toBe("row");

    const block = getState().doc.blocks[0];
    if (block === undefined) throw new Error("no block");
    const remove = [...document.querySelectorAll("button")].find(
      (b) => (b.getAttribute("aria-label") ?? "") === "Remove Prices",
    );
    if (!(remove instanceof HTMLButtonElement)) throw new Error("no section remove button");
    remove.click();

    expect(getState().undo?.kind).toBe("block");
    expect(getState().doc.blocks).toHaveLength(0);
  });
});
