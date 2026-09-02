/**
 * @vitest-environment jsdom
 *
 * What a seller paid, and what they make.
 *
 * `cost` is the app's own secret about the seller's business, never the
 * customer's. The field that captures it must save onto the one row it was
 * typed into and nowhere else, the profit it makes possible must show without
 * guessing when either side is unreadable, and none of it may ever reach the
 * Copy surface, which is the text that leaves this app. That last property has
 * its own dedicated guard at the compiler boundary
 * (`engine/tests/compile/cost-never-published.test.ts`); this file checks the
 * same thing from the app's side, where the number would first exist on
 * screen before any compiling happens.
 */
import { beforeEach, describe, expect, it } from "vitest";

import { addBlock, getState, init, selectBlock, setSurface, subscribe, updateBlock } from "../src/store.js";
import { blankBlock } from "../src/ui/forms.js";
import { renderShell } from "../src/ui/shell.js";

const LABEL = "What you paid";

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

function menuBlock(): Extract<ReturnType<typeof getState>["doc"]["blocks"][number], { kind: "menu" }> {
  const block = getState().doc.blocks[0];
  if (block === undefined || block.kind !== "menu") throw new Error("not a menu");
  return block;
}

function tierRecords(): Record<string, unknown>[] {
  return menuBlock().tiers as unknown as Record<string, unknown>[];
}

/** A price list with two rows, neither carrying a cost yet. */
function twoItemSection(): void {
  live();
  addBlock(blankBlock("menu"));
  updateBlock(menuBlock().id, {
    ...menuBlock(),
    tiers: [
      { id: "a", name: "Widget", price: "12.99" },
      { id: "b", name: "Gadget", price: "DM me" },
    ],
  });
  selectBlock(menuBlock().id);
}

function itemFieldsets(): Element[] {
  return [...document.querySelectorAll("#surface fieldset.item")];
}

describe("what you paid", () => {
  it("renders one field per row", () => {
    twoItemSection();
    expect(fieldsByLabel(LABEL)).toHaveLength(2);
  });

  it("stores what is typed on that tier, and nowhere else", () => {
    twoItemSection();
    const fields = fieldsByLabel(LABEL);
    const second = fields[1];
    if (second === undefined) throw new Error("expected two fields");
    typeInto(second, "5.00");

    expect(tierRecords()[0]).not.toHaveProperty("cost");
    expect(tierRecords()[1]?.["cost"]).toBe("5.00");
    // Nothing else on the row moved.
    expect(tierRecords()[1]?.["price"]).toBe("DM me");
    expect(tierRecords()[1]?.["name"]).toBe("Gadget");
  });
});

describe("profit", () => {
  it("shows for a row whose cost and price both parse", () => {
    twoItemSection();
    updateBlock(menuBlock().id, {
      ...menuBlock(),
      tiers: [
        { id: "a", name: "Widget", price: "12.99", cost: "5.00" },
        { id: "b", name: "Gadget", price: "DM me" },
      ],
    });
    selectBlock(menuBlock().id);

    const items = itemFieldsets();
    expect(items).toHaveLength(2);
    expect(items[0]?.querySelector(".profit")?.textContent ?? "").toContain("7.99");
  });

  it("shows nothing at all, not zero or a dash, when the price does not parse", () => {
    twoItemSection();
    // Gadget's price is "DM me" and it has no cost either: neither an absent
    // cost nor an unparseable price may produce a profit figure.
    const items = itemFieldsets();
    expect(items[1]?.querySelector(".profit")).toBeNull();
  });

  it("shows nothing at all when the cost does not parse", () => {
    twoItemSection();
    updateBlock(menuBlock().id, {
      ...menuBlock(),
      tiers: [{ id: "a", name: "Widget", price: "12.99", cost: "who knows" }],
    });
    selectBlock(menuBlock().id);

    expect(itemFieldsets()[0]?.querySelector(".profit")).toBeNull();
  });

  it("does not clamp or hide a loss", () => {
    twoItemSection();
    updateBlock(menuBlock().id, {
      ...menuBlock(),
      tiers: [{ id: "a", name: "Widget", price: "5.00", cost: "12.99" }],
    });
    selectBlock(menuBlock().id);

    expect(itemFieldsets()[0]?.querySelector(".profit")?.textContent ?? "").toContain("-7.99");
  });

  it("is never present anywhere in the Copy surface output", () => {
    const root = live();
    addBlock(blankBlock("menu"));
    updateBlock(menuBlock().id, {
      ...menuBlock(),
      tiers: [{ id: "a", name: "Widget", price: "50.00", cost: "12.34" }],
    });
    setSurface("export");
    renderShell(root);

    const output = document.getElementById("output");
    if (!(output instanceof HTMLTextAreaElement)) throw new Error("no output box");
    // 50.00 minus 12.34 is 37.66, a figure that appears nowhere else on this
    // page, so its absence is not an accident of overlapping digits.
    expect(output.value).not.toContain("37.66");
    expect(output.value).not.toContain("12.34");
  });
});
