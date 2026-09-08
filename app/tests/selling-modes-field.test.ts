/**
 * @vitest-environment jsdom
 *
 * Saying how an item reaches a buyer, from the row it belongs to.
 *
 * The two controls go inside the `More details` fold, next to the cost, the
 * unit and the quantity breakdown. That is not a filing preference: FR-092 in
 * feature 024 forbids growing a blank price row past two fields, because
 * somebody met five fields on a blank row, could not work out what to write,
 * and stopped. The rule did not expire because two more fields would be
 * convenient at the top.
 *
 * Clearing matters as much as setting. A cleared row has to be indistinguishable
 * from one that never carried a mode, or absent and empty come to mean the same
 * thing and the round trip stops being lossless. FR-105 and FR-106.
 */
import { beforeEach, describe, expect, it } from "vitest";

import { addBlock, getState, init, selectBlock, subscribe, updateBlock } from "../src/store.js";
import { blankBlock } from "../src/ui/forms.js";
import { renderShell } from "../src/ui/shell.js";
import { settle } from "./settle.js";

const MODE = "How you sell it (optional)";
const WAIT = "How long the buyer waits (optional)";

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
  updateBlock(block.id, { ...block, tiers: [{ id: "sign", name: "Carved sign", price: "80" }] });
  selectBlock(block.id);
}

function controlFor(text: string): HTMLElement {
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
  if (control === null) throw new Error(`"${text}" labels nothing`);
  return control;
}

function chooseMode(value: string): void {
  const control = controlFor(MODE);
  if (!(control instanceof HTMLSelectElement)) throw new Error("the mode is not a select");
  control.value = value;
  control.dispatchEvent(new Event("change", { bubbles: true }));
}

function typeWait(value: string): void {
  const control = controlFor(WAIT);
  if (!(control instanceof HTMLInputElement)) throw new Error("the wait is not typable");
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

/** Repaints after a change the shell defers rather than running per keystroke. */
async function repaint(): Promise<void> {
  await settle();
  const root = document.getElementById("app");
  if (root === null) throw new Error("missing #app");
  renderShell(root);
}

describe("a blank row still asks for two things", () => {
  it("does not grow because two more fields now exist", () => {
    // FR-092, carried forward deliberately rather than rediscovered later.
    itemSection();
    const upFront = [...document.querySelectorAll("fieldset.item > .field")]
      .filter((n) => !n.classList.contains("checkbox"))
      .map((n) => (n.querySelector("label")?.textContent ?? "").trim());

    expect(upFront).toEqual(["Item", "Price"]);
  });

  it("keeps both new controls one fold deep, never two", () => {
    // One press to reach either. A disclosure inside a disclosure is how a
    // control becomes unfindable.
    itemSection();
    for (const label of [MODE, WAIT]) {
      const fold = controlFor(label).closest("details");
      expect(fold, label).not.toBeNull();
      expect(fold?.parentElement?.closest("details") ?? null, label).toBeNull();
    }
  });

  it("opens the fold over a mode already set, rather than hiding it", async () => {
    // Same rule the cost and the bulk price already follow. Folding is about
    // what somebody meets on a blank row, never about hiding what they typed:
    // a sold-out flag nobody can find is a flag nobody can clear.
    itemSection();
    const block = getState().doc.blocks[0];
    if (block === undefined || block.kind !== "menu") throw new Error("not a menu");
    const first = block.tiers[0];
    if (first === undefined) throw new Error("no item");
    updateBlock(block.id, { ...block, tiers: [{ ...first, availability: "sold-out" }] });
    await repaint();

    expect(controlFor(MODE).closest("details")?.open).toBe(true);
  });

  it("opens the fold over a wait already typed", async () => {
    itemSection();
    const block = getState().doc.blocks[0];
    if (block === undefined || block.kind !== "menu") throw new Error("not a menu");
    const first = block.tiers[0];
    if (first === undefined) throw new Error("no item");
    updateBlock(block.id, { ...block, tiers: [{ ...first, leadTime: "about 2 weeks" }] });
    await repaint();

    expect(controlFor(WAIT).closest("details")?.open).toBe(true);
  });
});

describe("choosing how you sell it", () => {
  it("offers every mode the contract allows, and a way to say nothing", () => {
    // The empty first option is what makes the field clearable at all. A select
    // with no way back to nothing is a field you can only ever set once.
    itemSection();
    const control = controlFor(MODE);
    const values = [...control.querySelectorAll("option")].map((o) => o.getAttribute("value"));
    expect(values).toEqual(["", "in-stock", "made-to-order", "preorder", "sold-out"]);
  });

  it("writes the chosen mode to the row", () => {
    itemSection();
    chooseMode("made-to-order");
    expect(tier()["availability"]).toBe("made-to-order");
  });

  it("carries sold out, which is the one people reach for most", () => {
    itemSection();
    chooseMode("sold-out");
    expect(tier()["availability"]).toBe("sold-out");
  });

  it("clears back to absent, not to an empty value", async () => {
    itemSection();
    chooseMode("preorder");
    expect(tier()).toHaveProperty("availability");
    await repaint();
    chooseMode("");
    expect(tier()).not.toHaveProperty("availability");
  });

  it("shows a saved mode as the one already chosen", async () => {
    itemSection();
    chooseMode("in-stock");
    await repaint();
    const control = controlFor(MODE);
    expect((control as HTMLSelectElement).value).toBe("in-stock");
  });
});

describe("saying how long the buyer waits", () => {
  it("takes it in the seller's own words", () => {
    // Free text, not a number of days. "back in about a month" is what a seller
    // writes, and a date picker would refuse it.
    itemSection();
    typeWait("about 2 weeks");
    expect(tier()["leadTime"]).toBe("about 2 weeks");
  });

  it("stands on its own without a mode beside it", () => {
    itemSection();
    typeWait("3 to 5 days");
    expect(tier()["leadTime"]).toBe("3 to 5 days");
    expect(tier()).not.toHaveProperty("availability");
  });

  it("clears back to absent when emptied", () => {
    itemSection();
    typeWait("3 days");
    expect(tier()).toHaveProperty("leadTime");
    typeWait("");
    expect(tier()).not.toHaveProperty("leadTime");
  });
});
