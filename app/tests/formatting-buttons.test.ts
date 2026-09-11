/**
 * @vitest-environment jsdom
 *
 * The formatting buttons over a text section. Feature 028.
 *
 * WHY EVERY TEST HERE FOCUSES THE TEXTAREA AND SETS A REAL SELECTION FIRST.
 * Feature 023's holistic review found twenty one tests passing over a panel
 * that showed a seller nothing at all, because every one of them used a helper
 * that never focused the box. The bug lived entirely in the state those tests
 * skipped. These buttons are built around that same state: `typing()` in
 * `store.ts` is true only while a text field holds focus, and `repaint()`
 * defers entirely while it is. A test that presses a button on an unfocused
 * field is testing a situation no seller is ever in.
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

/** A text section on screen, holding the given text. */
function textSection(text: string, heading?: string): void {
  addBlock(blankBlock("prose"));
  const block = getState().doc.blocks[0];
  if (block === undefined || block.kind !== "prose") throw new Error("no prose block");
  updateBlock(block.id, { ...block, text, ...(heading === undefined ? {} : { heading }) });
  selectBlock(block.id);
}

function box(): HTMLTextAreaElement {
  const label = [...document.querySelectorAll("#surface label")].find(
    (l) => (l.textContent ?? "").trim() === "Text",
  );
  const control = document.getElementById(label?.getAttribute("for") ?? "");
  if (!(control instanceof HTMLTextAreaElement)) throw new Error("no Text box");
  return control;
}

function buttonNamed(name: string): HTMLButtonElement {
  const found = [...document.querySelectorAll("#surface .format-bar button")].find((b) =>
    (b.getAttribute("aria-label") ?? "").startsWith(name),
  );
  if (!(found instanceof HTMLButtonElement)) {
    const seen = [...document.querySelectorAll("#surface .format-bar button")]
      .map((b) => b.getAttribute("aria-label"))
      .join(" | ");
    throw new Error(`no button named "${name}", saw: ${seen}`);
  }
  return found;
}

/**
 * Presses a button the way a seller does: field focused, something selected,
 * and the mousedown a real pointer sends before the click.
 */
function press(name: string, from: number, to: number): void {
  const control = box();
  control.focus();
  control.setSelectionRange(from, to);
  const node = buttonNamed(name);
  const down = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
  node.dispatchEvent(down);
  // Asserted rather than assumed. If this stops being prevented the field
  // blurs, `typing()` flips false, the deferred repaint lands mid edit, and
  // `replaceChildren` destroys the textarea the seller is working in.
  expect(down.defaultPrevented, "mousedown must be prevented or focus leaves the field").toBe(true);
  node.click();
}

function textOf(): string {
  const block = getState().doc.blocks[0];
  if (block === undefined || block.kind !== "prose") throw new Error("not prose");
  return block.text;
}

describe("the buttons are offered where formatting is honoured, and nowhere else", () => {
  it("offers all six over a text section", () => {
    live();
    textSection("Pay a deposit first");
    const names = [...document.querySelectorAll("#surface .format-bar button")].map(
      (b) => (b.getAttribute("aria-label") ?? "").split(",")[0],
    );
    expect(names).toEqual(["Bold", "Italic", "Cross out", "Highlight", "Link", "Bullet list"]);
  });

  it("offers them on no other field", () => {
    // FR-028-2. `formatInline` is called from one place in the engine, so a
    // button on any other field would promise what the compiler refuses.
    live();
    addBlock(blankBlock("menu"));
    const block = getState().doc.blocks[0];
    if (block === undefined) throw new Error("no block");
    selectBlock(block.id);
    expect(document.querySelectorAll("#surface .format-bar")).toHaveLength(0);
  });

  it("names each button after its own section, so three are not identical", () => {
    live();
    textSection("something", "Shipping and returns");
    expect(buttonNamed("Bold").getAttribute("aria-label")).toBe(
      'Bold, in the "Shipping and returns" section',
    );
  });

  it("still names them when the section has no heading", () => {
    live();
    textSection("something");
    expect(buttonNamed("Bold").getAttribute("aria-label")).toBe("Bold, in this text section");
  });

  it("gives every button an accessible name and a real group", () => {
    live();
    textSection("something");
    const bar = document.querySelector("#surface .format-bar");
    expect(bar?.getAttribute("role")).toBe("group");
    expect(bar?.getAttribute("aria-label")).toBe("Formatting for this text section");
    for (const node of document.querySelectorAll("#surface .format-bar button")) {
      expect((node.getAttribute("aria-label") ?? "").length).toBeGreaterThan(3);
      expect(node.getAttribute("type")).toBe("button");
    }
  });
});

describe("what a press does to the seller's text", () => {
  it("wraps the selection and reaches the document", () => {
    live();
    textSection("Pay a deposit first");
    press("Bold", 6, 13);
    expect(box().value).toBe("Pay a **deposit** first");
    // Through the listener `field` already installed, not by a second path.
    expect(textOf()).toBe("Pay a **deposit** first");
  });

  it("leaves the word selected, so a second press can undo it", () => {
    live();
    textSection("Pay a deposit first");
    press("Bold", 6, 13);
    const control = box();
    expect(control.value.slice(control.selectionStart, control.selectionEnd)).toBe("deposit");

    press("Bold", control.selectionStart, control.selectionEnd);
    expect(box().value).toBe("Pay a deposit first");
    expect(textOf()).toBe("Pay a deposit first");
  });

  it("unwraps when the markers are inside the selection too", () => {
    live();
    textSection("Pay a **deposit** first");
    press("Bold", 6, 17);
    expect(box().value).toBe("Pay a deposit first");
  });

  it("inserts a selected placeholder when nothing is selected", () => {
    live();
    textSection("Ready: ");
    press("Italic", 7, 7);
    const control = box();
    expect(control.value).toBe("Ready: *italic text*");
    // Selected, so the next keystroke replaces it rather than joining it.
    expect(control.value.slice(control.selectionStart, control.selectionEnd)).toBe("italic text");
  });

  it("crosses out and highlights with the markers the engine recognises", () => {
    live();
    textSection("Oak sign and limited run");
    press("Cross out", 0, 8);
    expect(box().value).toBe("~~Oak sign~~ and limited run");
    press("Highlight", 17, 29);
    expect(box().value).toBe("~~Oak sign~~ and ==limited run==");
    expect(textOf()).toBe("~~Oak sign~~ and ==limited run==");
  });

  it("puts the caret where the address goes for a link", () => {
    live();
    textSection("see my shop");
    press("Link", 4, 11);
    const control = box();
    expect(control.value).toBe("see [my shop]()");
    expect(control.selectionStart).toBe(control.value.length - 1);
    expect(control.selectionStart).toBe(control.selectionEnd);
  });

  it("bullets every line the selection touches, and unbullets them", () => {
    live();
    textSection("hate symbols\nreal people\nanything rushed");
    // Starts mid word on the first line and ends mid word on the last, which
    // is what a selection dragged down a phone screen actually looks like.
    press("Bullet list", 3, 30);
    expect(box().value).toBe("- hate symbols\n- real people\n- anything rushed");

    const control = box();
    press("Bullet list", control.selectionStart, control.selectionEnd);
    expect(box().value).toBe("hate symbols\nreal people\nanything rushed");
  });

  it("bullets the line the caret merely sits in, with nothing selected", () => {
    live();
    textSection("hate symbols\nreal people");
    press("Bullet list", 15, 15);
    expect(box().value).toBe("hate symbols\n- real people");
  });

  it("bullets only the lines the selection actually touches", () => {
    // The half of the rule the first version of this test got wrong. A
    // selection ending inside the second line does not mean the third.
    live();
    textSection("hate symbols\nreal people\nanything rushed");
    press("Bullet list", 3, 20);
    expect(box().value).toBe("- hate symbols\n- real people\nanything rushed");
  });
});

describe("what a press must not do", () => {
  it("does not move the seller's place or lose what they typed", () => {
    live();
    textSection("Half up front");
    const control = box();
    press("Bold", 5, 7);
    // The same element, still focused. A repaint here would have replaced it,
    // which is the failure this whole design is arranged around.
    expect(document.activeElement).toBe(box());
    expect(box()).toBe(control);
    expect(box().value).toBe("Half **up** front");
  });

  it("writes only what a seller could have typed themselves", () => {
    // The design in one assertion. The buttons produce the markers the grammar
    // already recognises, so this feature adds no second way for formatting to
    // reach a document and nothing the compiler does not already understand.
    live();
    textSection("word");
    press("Bold", 0, 4);
    press("Cross out", 2, 6);
    expect(textOf()).toBe("**~~word~~**");
  });
});
