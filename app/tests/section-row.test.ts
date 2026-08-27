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

import { addBlock, getState, init, subscribe } from "../src/store.js";
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
