/**
 * @vitest-environment jsdom
 *
 * Filling in one field must not undo the last one.
 *
 * Repaints wait for a pause in typing, so the interface on screen is briefly
 * older than the document. Every field's handler was built during the last
 * render and closed over the block as it was then, so while that pause is
 * running a second field rebuilds the block from a stale snapshot and puts the
 * first field's old value back.
 *
 * Measured on the deployed app, typing an item name and then a price with
 * varying pauses between them:
 *
 *   pause   0ms -> {"name":"seed","price":"120"}              the name was lost
 *   pause 120ms -> {"name":"seed","price":"120"}              lost
 *   pause 250ms -> {"name":"Full colour bust","price":"120"}  kept
 *
 * The boundary is exactly the repaint delay. It applies to every form in the
 * app, not just this one: a name and a tagline, a heading and its text, an
 * image address and its caption.
 *
 * The fix is that a handler no longer says what the block should become. It
 * says how to change whatever the block currently is, and the store applies
 * that against the live document.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { addBlock, getState, init, selectBlock, subscribe } from "../src/store.js";
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

function field(label: string): HTMLInputElement | HTMLTextAreaElement {
  const l = [...document.querySelectorAll("#surface label")].find(
    (x) => (x.textContent ?? "").trim() === label,
  );
  if (l === undefined) {
    const seen = [...document.querySelectorAll("#surface label")].map((x) => x.textContent).join(" | ");
    throw new Error(`no field "${label}", saw: ${seen}`);
  }
  const c = document.getElementById(l.getAttribute("for") ?? "");
  if (!(c instanceof HTMLInputElement || c instanceof HTMLTextAreaElement)) {
    throw new Error(`"${label}" is not typable`);
  }
  return c;
}

/** Types without letting a repaint happen in between, which is the whole point. */
function put(label: string, value: string): void {
  const c = field(label);
  c.focus();
  c.value = value;
  c.dispatchEvent(new Event("input", { bubbles: true }));
}

function menu(): Extract<ReturnType<typeof getState>["doc"]["blocks"][number], { kind: "menu" }> {
  const block = getState().doc.blocks[0];
  if (block === undefined || block.kind !== "menu") throw new Error("not a menu");
  return block;
}

describe("editing two fields before the interface catches up", () => {
  it("keeps the item name when the price is typed straight after", () => {
    live();
    addBlock(blankBlock("menu"));
    selectBlock(getState().doc.blocks[0]?.id);

    put("Item", "seed");
    vi.useFakeTimers();
    try {
      vi.advanceTimersByTime(400);
    } finally {
      vi.useRealTimers();
    }

    put("Item", "Full colour bust");
    put("Price", "120");

    // The id comes from blankBlock's newId() call and is not predictable here,
    // so it is checked separately from the fields the test is actually about.
    expect(menu().tiers).toHaveLength(1);
    expect(menu().tiers[0]).toMatchObject({ name: "Full colour bust", price: "120" });
    expect(menu().tiers[0]?.id).not.toBe("");
  });

  it("keeps the name when a tagline is typed straight after", () => {
    live();
    addBlock(blankBlock("profile"));
    selectBlock(getState().doc.blocks[0]?.id);

    put("Your name", "Ari");
    put("One line about you (optional)", "Character art");

    const block = getState().doc.blocks[0];
    if (block === undefined || block.kind !== "profile") throw new Error("not a profile");
    expect(block.displayName).toBe("Ari");
    expect(block.tagline).toBe("Character art");
  });

  it("keeps a section heading when the text is typed straight after", () => {
    live();
    addBlock(blankBlock("prose"));
    selectBlock(getState().doc.blocks[0]?.id);

    put("Section heading (optional)", "About");
    put("Text", "Half up front.");

    const block = getState().doc.blocks[0];
    if (block === undefined || block.kind !== "prose") throw new Error("not a prose");
    expect(block.heading).toBe("About");
    expect(block.text).toBe("Half up front.");
  });

  it("keeps an image address when a caption is typed straight after", () => {
    live();
    addBlock(blankBlock("gallery"));
    selectBlock(getState().doc.blocks[0]?.id);

    put("Image address", "https://example.test/a.png");
    put("Caption (optional)", "a bust");

    const block = getState().doc.blocks[0];
    if (block === undefined || block.kind !== "gallery") throw new Error("not a gallery");
    expect(block.items).toEqual([{ imageUrl: "https://example.test/a.png", caption: "a bust" }]);
  });

  it("keeps a heading's text when its size is changed straight after", () => {
    live();
    addBlock(blankBlock("heading"));
    selectBlock(getState().doc.blocks[0]?.id);

    put("Heading text", "Prices");
    const size = document.querySelector<HTMLSelectElement>("#surface select");
    if (size === null) throw new Error("no size select");
    size.value = "3";
    size.dispatchEvent(new Event("change", { bubbles: true }));

    const block = getState().doc.blocks[0];
    if (block === undefined || block.kind !== "heading") throw new Error("not a heading");
    expect(block.text).toBe("Prices");
    expect(block.level).toBe(3);
  });
});
