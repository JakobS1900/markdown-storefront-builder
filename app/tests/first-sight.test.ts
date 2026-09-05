/**
 * @vitest-environment jsdom
 *
 * How much a price row asks for before anybody has typed anything.
 *
 * A blank item rendered five fields and four hints: Item, Price, What you
 * paid, What the price buys, and Bulk pricing. Three products was fifteen
 * fields. Somebody used a starting point, could not work out what to write,
 * and gave up, which is the evidence this exists to answer, and "overwhelmed"
 * is a statement about volume rather than about wording. The examples were
 * already on screen the whole time, one line above every box.
 *
 * So the three that are optional fold into the "More details" group the row
 * already had, and a blank row asks for two things: what it is and what it
 * costs.
 *
 * Folding is about first sight, not about hiding. A row that already carries a
 * cost, a unit or a bulk price opens the group, because a seller who typed
 * something and cannot see it any more has been robbed rather than
 * uncluttered. That case matters more than it looks: bulk pricing reads
 * `cost` off every selected row, so a cost the seller cannot find is a feature
 * that silently prices nothing.
 */
import { beforeEach, describe, expect, it } from "vitest";

import { addBlock, getState, init, selectTiers, subscribe, updateBlock } from "../src/store.js";
import { blankBlock } from "../src/ui/forms.js";
import { renderShell } from "../src/ui/shell.js";
import { settle } from "./settle.js";

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

/** The labels an item asks for before anything is unfolded. */
function askedUpFront(): string[] {
  const item = document.querySelector("fieldset.item");
  if (item === null) return [];
  return [...item.children]
    .filter((n) => n.classList.contains("field") && !n.classList.contains("checkbox"))
    .map((n) => n.querySelector("label")?.textContent ?? "");
}

/** The labels folded away behind the group. */
function askedLater(): string[] {
  return [...document.querySelectorAll("fieldset.item .more .field label")].map(
    (n) => n.textContent ?? "",
  );
}

function group(): HTMLDetailsElement | null {
  return document.querySelector<HTMLDetailsElement>("fieldset.item .more");
}

describe("a blank price row", () => {
  it("asks for what it is and what it costs, and nothing else", () => {
    live();
    addBlock(blankBlock("menu"));

    expect(askedUpFront()).toEqual(["Item", "Price"]);
  });

  it("keeps the other three, folded rather than gone", () => {
    live();
    addBlock(blankBlock("menu"));

    const later = askedLater();
    for (const label of [
      "What you paid",
      "What the price buys (optional)",
      "Bulk pricing (optional)",
    ]) {
      expect(later).toContain(label);
    }
  });

  it("starts folded, because there is nothing in there to see yet", () => {
    live();
    addBlock(blankBlock("menu"));

    expect(group()?.open).toBe(false);
  });
});

describe("the bulk pricing controls on a section too small to need them", () => {
  /**
   * `blankBlock` seeds one real row on purpose, so the guard that was already
   * here, `block.tiers.length === 0`, never fired for a new section: a price
   * list with one empty row still drew "0 selected", "Select all" and "Select
   * none" above it, which is three controls doing what the row's own checkbox
   * does. It is BULK pricing. Below two rows there is no bulk.
   */
  function menuWith(rows: number): void {
    live();
    addBlock(blankBlock("menu"));
    const block = getState().doc.blocks[0];
    if (block === undefined || block.kind !== "menu") throw new Error("no menu block");
    const first = block.tiers[0];
    if (first === undefined) throw new Error("no tier");
    updateBlock(block.id, {
      ...block,
      tiers: Array.from({ length: rows }, (_, i) => ({
        ...first,
        id: `t${String(i)}`,
        name: `Item ${String(i)}`,
        price: "10",
      })),
    });
  }

  it("draws no toolbar and no checkbox on a one row section", async () => {
    menuWith(1);
    await settle();
    renderShell(document.getElementById("app") as HTMLElement);

    expect(document.querySelector("#surface .bulk-toolbar")).toBeNull();
    expect(document.querySelectorAll("#surface fieldset.item input[type=checkbox]").length).toBe(0);
  });

  it("brings both back as soon as there are two rows to choose between", async () => {
    menuWith(2);
    await settle();
    renderShell(document.getElementById("app") as HTMLElement);

    expect(document.querySelector("#surface .bulk-toolbar")).not.toBeNull();
    expect(document.querySelectorAll("#surface fieldset.item input[type=checkbox]").length).toBe(2);
  });

  it("takes the apply panel away with them, so no selection is left unreachable", async () => {
    // The trap this closes. The panel renders whenever something is selected,
    // and a selection outlives the row count changing. Hiding the checkboxes
    // without hiding the panel would leave somebody looking at Apply pricing
    // with no control on screen able to clear what it acts on.
    menuWith(2);
    const block = getState().doc.blocks[0];
    if (block === undefined || block.kind !== "menu") throw new Error("no menu block");
    selectTiers(block.id, ["t0", "t1"]);
    await settle();
    renderShell(document.getElementById("app") as HTMLElement);
    expect(document.querySelector("#surface .bulk-apply")).not.toBeNull();

    updateBlock(block.id, { ...block, tiers: [{ ...block.tiers[0] }] } as typeof block);
    await settle();
    renderShell(document.getElementById("app") as HTMLElement);

    expect(document.querySelector("#surface .bulk-toolbar")).toBeNull();
    expect(document.querySelector("#surface .bulk-apply")).toBeNull();
  });
});

describe("a row that already holds something in the folded part", () => {
  it("opens the group, so a cost that was typed can still be found", async () => {
    const root = live();
    addBlock(blankBlock("menu"));
    const block = getState().doc.blocks[0];
    if (block === undefined || block.kind !== "menu") throw new Error("no menu block");
    const tier = block.tiers[0];
    if (tier === undefined) throw new Error("no tier");
    updateBlock(block.id, {
      ...block,
      tiers: [{ ...tier, name: "Bust", price: "45", cost: "12" }],
    });
    // The shell defers a repaint rather than running one per keystroke, so the
    // group is rebuilt after this settles rather than inside `updateBlock`.
    await settle();
    renderShell(root);

    expect(group()?.open).toBe(true);
  });

  it("stays folded when only the two up-front fields are filled in", () => {
    live();
    addBlock(blankBlock("menu"));
    const block = getState().doc.blocks[0];
    if (block === undefined || block.kind !== "menu") throw new Error("no menu block");
    const tier = block.tiers[0];
    if (tier === undefined) throw new Error("no tier");
    updateBlock(block.id, {
      ...block,
      tiers: [{ ...tier, name: "Bust", price: "45" }],
    });

    expect(group()?.open).toBe(false);
  });
});
