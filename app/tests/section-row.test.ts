/**
 * @vitest-environment jsdom
 *
 * The control that opens and closes a section.
 *
 * It read "Edit Prices: 2 items" whether the section was open or shut. Pressing
 * it while the form was already open collapsed the form, so the button offering
 * to edit was the button that took the editor away. The only sign the section
 * was open was a border colour.
 *
 * It is a disclosure: it shows and hides the region below it. So it says which
 * way it will go, and it carries `aria-expanded` and `aria-controls` rather
 * than `aria-pressed`, which is what makes a screen reader announce "collapsed"
 * and "expanded" instead of "pressed".
 */
import { beforeEach, describe, expect, it } from "vitest";

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

function row(): HTMLButtonElement {
  const node = document.querySelector(".block-row > button:first-child");
  if (!(node instanceof HTMLButtonElement)) throw new Error("no section row");
  return node;
}

describe("the section row", () => {
  it("offers to open the section when it is shut", () => {
    live();
    addBlock(blankBlock("prose"));
    // addBlock opens the section it added, so close it to get the shut state.
    row().click();

    expect(row().textContent).toBe("Open Text: Empty");
  });

  it("offers to close it once it is open, rather than still offering to edit", () => {
    live();
    addBlock(blankBlock("prose"));
    // addBlock selects the new section, so it is already open.
    expect(getState().selectedBlockId).toBe(getState().doc.blocks[0]?.id);

    expect(row().textContent).toBe("Close Text: Empty");
  });

  it("is a disclosure, not a toggle button", () => {
    live();
    addBlock(blankBlock("prose"));

    expect(row().getAttribute("aria-expanded")).toBe("true");
    expect(row().getAttribute("aria-pressed"), "a disclosure is not pressed").toBeNull();
  });

  it("points at the region it opens, and that region exists when open", () => {
    live();
    addBlock(blankBlock("prose"));

    const controls = row().getAttribute("aria-controls");
    expect(controls).not.toBeNull();
    expect(document.getElementById(controls ?? ""), "aria-controls points at nothing").not.toBeNull();
  });

  it("points at nothing while shut, rather than at a region that is not there", () => {
    live();
    addBlock(blankBlock("prose"));
    row().click();

    // The form is not rendered while the section is closed, so naming it would
    // be a dangling reference. Every id in aria-controls has to resolve.
    expect(row().getAttribute("aria-controls")).toBeNull();
  });

  it("reports itself collapsed once closed", () => {
    live();
    addBlock(blankBlock("prose"));
    row().click();

    expect(row().getAttribute("aria-expanded")).toBe("false");
    expect(row().textContent).toBe("Open Text: Empty");
  });

  it("still says what the section holds, so the list stays scannable", () => {
    live();
    addBlock(blankBlock("menu"));

    expect(row().textContent).toContain("Prices: 1 item");
  });
});

describe("opening a section brings it into view", () => {
  it("scrolls the row it just opened to the top", () => {
    // Measured at 360 by 720: opening a price section rendered seven fields and
    // put none of them on screen. Pressing a control and seeing nothing change
    // is indistinguishable from the control not working.
    const root = live();
    addBlock(blankBlock("menu"));
    selectBlock(undefined);
    renderShell(root);

    const calls: string[] = [];
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function scrollIntoView(this: Element) {
      calls.push(this.getAttribute("aria-controls") ?? this.tagName);
    };

    try {
      const open = [...document.querySelectorAll<HTMLButtonElement>(".block-row > button:first-child")][0];
      open?.click();
      expect(calls).toHaveLength(1);
      expect(calls[0]).toMatch(/^editor-/);
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });

  it("scrolls to a section that was just added, which is the commoner route in", () => {
    const root = live();
    renderShell(root);

    const calls: string[] = [];
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function scrollIntoView(this: Element) {
      calls.push(this.getAttribute("aria-controls") ?? this.tagName);
    };

    try {
      const prices = [...document.querySelectorAll<HTMLButtonElement>(".adders button")].find(
        (b) => b.textContent === "Prices",
      );
      prices?.click();
      expect(calls).toHaveLength(1);
      expect(calls[0]).toMatch(/^editor-/);
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });

  it("does not scroll when the section is being closed", () => {
    const root = live();
    addBlock(blankBlock("menu"));
    renderShell(root);

    const calls: string[] = [];
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function scrollIntoView() {
      calls.push("called");
    };

    try {
      // addBlock selects what it adds, so this row is already open.
      const close = [...document.querySelectorAll<HTMLButtonElement>(".block-row > button:first-child")][0];
      expect(close?.getAttribute("aria-expanded")).toBe("true");
      close?.click();
      expect(calls).toHaveLength(0);
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });
});
