/**
 * @vitest-environment jsdom
 *
 * The interface must not rebuild itself under a field somebody is typing into.
 *
 * Reported on a Pixel on 2026-09-01: single characters going missing at random,
 * one key at a time, and whole swiped words coming out wrong. The keyboard no
 * longer closes, which was the 2026-08-25 defect, so this is the same seam
 * failing more quietly.
 *
 * The mechanism, which the existing code makes plain once you look at when the
 * guard runs. A change made while a field has focus is deferred rather than
 * painted, so the field is not taken away mid-keystroke. But `typing()` is
 * consulted when the repaint is SCHEDULED and never when it FIRES. Two hundred
 * milliseconds later it repaints regardless, `replaceChildren` destroys the
 * focused input, and Android tears down the InputConnection bound to it. A
 * character committed in that window has nowhere to land.
 *
 * That timing is why it looks random when typing and reliable when swiping. A
 * pause of a fifth of a second is nothing while thinking of the next word, and
 * a swipe gesture is a second or more with no input events at all, so the timer
 * always fires in the middle of one.
 *
 * The property these tests defend: while an editable holds focus, the element
 * holding it is not replaced and what it contains is not overwritten.
 */
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";

import { addBlock, getState, init, subscribe, update } from "../src/store.js";
import { blankBlock } from "../src/ui/forms.js";
import { renderShell } from "../src/ui/shell.js";

let stop: (() => void) | undefined;

/** Longer than the repaint delay, so a deferred repaint has had its chance. */
const AFTER_THE_QUIET = 400;

function live(): HTMLElement {
  document.body.innerHTML =
    '<a class="skip" href="#surface">Skip</a><div id="app"></div>' +
    '<div id="live-region" class="sr-only" role="status" aria-live="polite"></div>';
  const root = document.getElementById("app");
  if (root === null) throw new Error("missing #app");
  init(true);
  stop = subscribe(() => renderShell(root));
  renderShell(root);
  return root;
}

/** The page title field, which is on screen without opening anything. */
function titleField(): HTMLInputElement {
  const field = document.querySelector<HTMLInputElement>("#app input[type=text]");
  if (field === null) throw new Error("no title field");
  return field;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeEach(() => {
  stop?.();
  stop = undefined;
  globalThis.indexedDB = new IDBFactory();
});

describe("a repaint never lands on a field being typed into", () => {
  it("does not replace the focused element after the quiet delay", async () => {
    live();
    const field = titleField();
    field.focus();
    expect(document.activeElement).toBe(field);

    // One character, exactly as the input handler would report it.
    field.value = "l";
    update({ ...getState().doc, title: "l" });

    // Then a pause. A fifth of a second is nothing while thinking of the next
    // word, and this is where the character used to go.
    await wait(AFTER_THE_QUIET);

    expect(document.querySelector("#app input[type=text]")).toBe(field);
    expect(document.activeElement).toBe(field);
  });

  it("does not overwrite what the field holds but the document does not", async () => {
    // This is the swipe case. A gesture commits nothing until it ends, so the
    // element can hold text the document has never been told about. A repaint
    // that writes the document back over it destroys the word.
    live();
    const field = titleField();
    field.focus();
    update({ ...getState().doc, title: "lm" });

    // The keyboard has more in the field than the document knows about.
    field.value = "lmao";
    await wait(AFTER_THE_QUIET);

    expect(document.querySelector<HTMLInputElement>("#app input[type=text]")?.value).toBe("lmao");
  });

  it("repaints as soon as focus leaves, so nothing is left stale", async () => {
    const root = live();
    addBlock(blankBlock("heading"));
    renderShell(root);

    const field = document.querySelector<HTMLInputElement>(".block-editor input[type=text]");
    if (field === null) throw new Error("no heading field");
    field.focus();

    const block = getState().doc.blocks[0];
    if (block?.kind !== "heading") throw new Error("expected a heading");
    update({
      ...getState().doc,
      blocks: [{ ...block, text: "Commissions" }],
    });
    await wait(AFTER_THE_QUIET);

    // Still holding off, because focus has not moved.
    const summaryWhileTyping =
      document.querySelector(".block-row > button:first-child")?.textContent ?? "";

    field.blur();
    await wait(AFTER_THE_QUIET);

    const summaryAfter = document.querySelector(".block-row > button:first-child")?.textContent ?? "";
    expect(summaryWhileTyping).not.toContain("Commissions");
    expect(summaryAfter).toContain("Commissions");
  });

  it("still repaints promptly when nothing has focus", async () => {
    const root = live();
    addBlock(blankBlock("heading"));
    renderShell(root);
    (document.activeElement as HTMLElement | null)?.blur();

    const block = getState().doc.blocks[0];
    if (block?.kind !== "heading") throw new Error("expected a heading");
    update({ ...getState().doc, blocks: [{ ...block, text: "Prices" }] });
    await wait(AFTER_THE_QUIET);

    expect(document.querySelector(".block-row > button:first-child")?.textContent).toContain("Prices");
  });
});
