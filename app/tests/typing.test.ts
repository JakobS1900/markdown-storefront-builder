/**
 * @vitest-environment jsdom
 *
 * Typing has to survive typing.
 *
 * Every earlier test in this project set a field's value in one assignment and
 * fired one input event. That is not what a person does, and it is structurally
 * incapable of finding the bug this file exists for: the app rebuilds its whole
 * DOM on every state change, and a keystroke is a state change, so the element
 * being typed into is destroyed after the first character. Focus dies with it.
 * On a phone the on-screen keyboard closes, so a real user types one letter,
 * watches the field close, reopens it, and types the second.
 *
 * The tests below type character by character and, before each one, ask the
 * document what is focused rather than holding a reference. Holding a reference
 * is exactly the assumption that hid this: the old node still accepts input, it
 * just is not on the page any more.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { addBlock, getState, init, selectBlock, subscribe, updateBlock } from "../src/store.js";
import { blankBlock } from "../src/ui/forms.js";
import { renderShell } from "../src/ui/shell.js";

let stop: (() => void) | undefined;

function mount(): HTMLElement {
  document.body.innerHTML =
    '<a class="skip" href="#surface">Skip</a><div id="app"></div>' +
    '<div id="live-region" class="sr-only" role="status" aria-live="polite"></div>';
  const root = document.getElementById("app");
  if (root === null) throw new Error("missing #app");
  return root;
}

/**
 * Wires the app the way main.ts does.
 *
 * Without this subscription the bug is invisible, because nothing re-renders
 * and the node under the caret survives. Every test that rendered by hand was
 * testing a version of the app that does not exist.
 */
function live(): HTMLElement {
  const root = mount();
  init(false);
  stop = subscribe(() => renderShell(root));
  renderShell(root);
  return root;
}

beforeEach(() => {
  stop?.();
  stop = undefined;
});

/** The element a person's next keystroke would actually land in. */
function focused(): HTMLInputElement | HTMLTextAreaElement | null {
  const active = document.activeElement;
  return active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement
    ? active
    : null;
}

function labelOf(control: Element): string {
  const id = control.getAttribute("id") ?? "";
  return document.querySelector(`label[for="${id}"]`)?.textContent ?? "(unlabelled)";
}

/**
 * Types one character into whatever currently has focus, the way a keyboard
 * does: at the caret, followed by an input event.
 */
function pressKey(character: string): void {
  const control = focused();
  if (control === null) throw new Error("nothing is focused, so this keystroke would be lost");
  const at = control.selectionStart ?? control.value.length;
  control.value = control.value.slice(0, at) + character + control.value.slice(at);
  try {
    control.setSelectionRange(at + 1, at + 1);
  } catch {
    // Some input types refuse selection. Not what is under test.
  }
  control.dispatchEvent(new Event("input", { bubbles: true }));
}

function typeWord(word: string): void {
  for (const character of word) pressKey(character);
}

function openFirstBlock(kind: Parameters<typeof blankBlock>[0]): void {
  addBlock(blankBlock(kind));
  selectBlock(getState().doc.blocks[0]?.id);
}

/**
 * Finds a control by the words next to it, which is how a person finds one.
 *
 * Picking the first input on the surface instead looks equivalent and is not:
 * the page title sits above the open section, so "the first text box" is a
 * different field from the one the test means. That mistake made a real result
 * look like a bug in the app.
 */
function fieldByLabel(text: string): HTMLInputElement | HTMLTextAreaElement {
  const labels = [...document.querySelectorAll("#surface label")];
  // Exact first: "Text" must not match "Heading text".
  const label =
    labels.find((l) => (l.textContent ?? "").trim() === text) ??
    labels.find((l) => (l.textContent ?? "").includes(text));
  if (label === undefined) throw new Error(`no field labelled "${text}"`);
  const control = document.getElementById(label.getAttribute("for") ?? "");
  if (!(control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement)) {
    throw new Error(`"${text}" is not a typable control`);
  }
  return control;
}

describe("typing into a section", () => {
  it("keeps focus in the same field after the first character", () => {
    live();
    openFirstBlock("profile");

    const start = fieldByLabel("Your name");
    const startLabel = labelOf(start);
    start.focus();

    pressKey("A");

    const after = focused();
    expect(after, "focus was lost after one character").not.toBeNull();
    expect(labelOf(after as Element)).toBe(startLabel);
  });

  it("accepts a whole word without the field being torn out underneath it", () => {
    live();
    openFirstBlock("profile");

    const start = fieldByLabel("Your name");
    start.focus();
    const startLabel = labelOf(start);

    typeWord("Ari");

    const after = focused();
    expect(after).not.toBeNull();
    expect(labelOf(after as Element)).toBe(startLabel);
    expect((after as HTMLInputElement).value).toBe("Ari");
  });

  it("leaves the caret where the typist put it, not at the start", () => {
    live();
    openFirstBlock("profile");

    fieldByLabel("Your name").focus();
    typeWord("Ari");

    const after = focused();
    expect(after?.selectionStart).toBe(3);
  });

  it("types into a multiline field the same way", () => {
    live();
    openFirstBlock("prose");

    const area = fieldByLabel("Text");
    area.focus();
    const startLabel = labelOf(area);

    typeWord("hello");

    const after = focused();
    expect(after).not.toBeNull();
    expect(labelOf(after as Element)).toBe(startLabel);
    expect((after as HTMLTextAreaElement).value).toBe("hello");
  });
});

describe("every field in every section survives being typed into", () => {
  // The bug was never specific to one field. It came from how the app repaints,
  // so it applied to all of them, and finding it one field at a time is exactly
  // the work nobody should have to do. This sweeps the lot.
  const kinds = ["profile", "menu", "gallery", "prose", "heading"] as const;

  for (const kind of kinds) {
    it(`holds the caret through every field of a "${kind}" section`, () => {
      live();
      openFirstBlock(kind);

      // Sections that hold a list start empty, so add one row to get its fields
      // on screen. Otherwise this test would pass by checking nothing.
      const adder = [...document.querySelectorAll("#surface button")].find((b) =>
        /^Add an? /.test(b.textContent ?? ""),
      );
      (adder as HTMLButtonElement | undefined)?.click();

      // Expand the folded groups, because a field inside a closed <details>
      // cannot take focus in a real browser. jsdom will happily focus it, so
      // without this the sweep would pass on fields no one can reach.
      for (const group of document.querySelectorAll("details")) group.open = true;

      const count = document.querySelectorAll(
        "#surface input[type=text], #surface input[type=url], #surface textarea",
      ).length;
      expect(count, `no typable fields found in a "${kind}" section`).toBeGreaterThan(0);

      for (let index = 0; index < count; index += 1) {
        // Re-queried every time: the previous keystroke rebuilt the document.
        const controls = document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
          "#surface input[type=text], #surface input[type=url], #surface textarea",
        );
        const target = controls[index];
        if (target === undefined) throw new Error(`field ${index} vanished in "${kind}"`);

        const name = labelOf(target);
        const before = target.value;
        target.focus();
        pressKey("a");
        pressKey("b");

        const after = focused();
        expect(after, `focus lost while typing into "${name}" of a ${kind}`).not.toBeNull();
        expect(labelOf(after as Element), `caret moved away from "${name}"`).toBe(name);
        expect((after as HTMLInputElement).value).toBe(`${before}ab`);
      }
    });
  }
});

describe("the repaint that was deferred still happens", () => {
  // Deferring is only correct if it arrives. A version that simply stopped
  // repainting would pass every test above and leave the collapsed summary of
  // a section permanently stale.
  it("catches the interface up once typing stops, without dropping the caret", async () => {
    vi.useFakeTimers();
    try {
      live();
      openFirstBlock("profile");

      const start = fieldByLabel("Your name");
      start.focus();
      const startLabel = labelOf(start);
      typeWord("Ari");

      // The row summary still shows the old value: nothing has repainted.
      expect(document.querySelector(".block-row")?.textContent ?? "").not.toContain("Ari");

      await vi.advanceTimersByTimeAsync(400);

      expect(document.querySelector(".block-row")?.textContent ?? "").toContain("Ari");
      const after = focused();
      expect(after, "the deferred repaint threw the caret away").not.toBeNull();
      expect(labelOf(after as Element)).toBe(startLabel);
      expect((after as HTMLInputElement).value).toBe("Ari");
    } finally {
      vi.useRealTimers();
    }
  });

  it("repaints at once when the shape of the page changes", () => {
    live();
    addBlock(blankBlock("profile"));
    // No timer advanced: adding a section must be on screen immediately, or a
    // button press reads as ignored.
    expect(document.querySelectorAll(".block-row").length).toBe(1);

    addBlock(blankBlock("prose"));
    expect(document.querySelectorAll(".block-row").length).toBe(2);
  });
});

describe("the field being typed into is never swapped out underneath the typist", () => {
  /**
   * Android hands text to a WebView through an InputConnection bound to the
   * focused editable. Replace that element and the connection is torn down and
   * rebuilt, and a character committed during the gap has nowhere to land.
   *
   * Measured on a Moto G7, typing "Full colour bust" into a Prices section:
   *
   *   empty section, first key adds a row   2 nodes, 1 swap   3 of 8 runs lost a character
   *   section that already has a row        1 node,  0 swaps  0 of 8 runs lost anything
   *
   * Always the character straight after the swap: "Full" arrived as "Ful". A
   * bare page that never replaces its input dropped nothing in six runs, so
   * this is the app's doing, not the injection.
   *
   * Deferring a repaint while a field has focus is what keeps the element
   * alive. The shape check alone was not enough: typing the first character
   * into a placeholder row genuinely adds a row, which is a shape change, and
   * that repainted at once while the artist was still typing.
   */
  function focusedNode(): Element | null {
    return document.activeElement instanceof HTMLInputElement ||
      document.activeElement instanceof HTMLTextAreaElement
      ? document.activeElement
      : null;
  }

  it("keeps the same element when the first character adds a row", () => {
    live();
    addBlock(blankBlock("menu"));
    const block = getState().doc.blocks[0];
    if (block === undefined || block.kind !== "menu") throw new Error("not a menu");
    updateBlock(block.id, { ...block, tiers: [] });
    selectBlock(block.id);

    const before = fieldByLabel("Item");
    before.focus();
    expect(focusedNode()).toBe(before);

    pressKey("F");

    expect(focusedNode(), "the field being typed into was replaced mid-word").toBe(before);
  });

  it("still adds the row to the document, even though it did not repaint yet", () => {
    live();
    addBlock(blankBlock("menu"));
    const block = getState().doc.blocks[0];
    if (block === undefined || block.kind !== "menu") throw new Error("not a menu");
    updateBlock(block.id, { ...block, tiers: [] });
    selectBlock(block.id);

    fieldByLabel("Item").focus();
    pressKey("F");

    const after = getState().doc.blocks[0];
    if (after === undefined || after.kind !== "menu") throw new Error("not a menu");
    expect(after.tiers).toEqual([{ name: "F", price: "" }]);
  });

  it("catches the interface up once typing stops", async () => {
    vi.useFakeTimers();
    try {
      live();
      addBlock(blankBlock("menu"));
      const block = getState().doc.blocks[0];
      if (block === undefined || block.kind !== "menu") throw new Error("not a menu");
      updateBlock(block.id, { ...block, tiers: [] });
      selectBlock(block.id);

      fieldByLabel("Item").focus();
      pressKey("F");
      expect(document.querySelector(".block-row")?.textContent ?? "").toContain("0 items");

      await vi.advanceTimersByTimeAsync(400);

      expect(document.querySelector(".block-row")?.textContent ?? "").toContain("1 item");
    } finally {
      vi.useRealTimers();
    }
  });

  it("still repaints at once when nothing is being typed into", () => {
    live();
    addBlock(blankBlock("profile"));
    // Focus is on no field here, so a section added by a button press must be
    // on screen immediately or the press reads as ignored.
    expect(document.querySelectorAll(".block-row").length).toBe(1);
    addBlock(blankBlock("prose"));
    expect(document.querySelectorAll(".block-row").length).toBe(2);
  });
});

describe("field identity across renders", () => {
  it("gives a field the same id before and after an unrelated change", () => {
    const root = live();
    openFirstBlock("profile");

    const before = [...document.querySelectorAll("#app input, #app textarea, #app select")].map(
      (c) => c.getAttribute("id"),
    );
    renderShell(root);
    const after = [...document.querySelectorAll("#app input, #app textarea, #app select")].map(
      (c) => c.getAttribute("id"),
    );

    // Unstable ids make focus impossible to restore and make every
    // label-to-control binding a fresh pair that happens to agree within one
    // render. Nothing can follow a control across a repaint.
    expect(after).toEqual(before);
  });
});
