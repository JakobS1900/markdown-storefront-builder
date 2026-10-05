/**
 * @vitest-environment jsdom
 *
 * The screen a seller pastes their price list into.
 *
 * It lives inside the price list section rather than on a surface of its own,
 * which is what makes "which list do these go into" a question nobody has to
 * answer: they answered it by pressing the button where they pressed it. It
 * also keeps the undo offer, which is rendered by the section, in view.
 *
 * The word "import" must not appear anywhere a seller can read. `import.ts`
 * already means opening a backup, which REPLACES the open page, and offering
 * two unrelated things under one word is how somebody loses a page.
 */
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
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
  globalThis.indexedDB = new IDBFactory();
});

function menuBlock(): Extract<ReturnType<typeof getState>["doc"]["blocks"][number], { kind: "menu" }> {
  const block = getState().doc.blocks[0];
  if (block === undefined || block.kind !== "menu") throw new Error("not a menu");
  return block;
}

function shop(): void {
  live();
  addBlock(blankBlock("menu"));
  updateBlock(menuBlock().id, {
    ...menuBlock(),
    tiers: [{ id: "bust", name: "Bust", price: "45" }],
  });
  selectBlock(menuBlock().id);
}

function press(label: string): void {
  const found = [...document.querySelectorAll("#surface button")].find(
    (b) => (b.getAttribute("aria-label") ?? b.textContent ?? "").trim() === label,
  );
  if (!(found instanceof HTMLButtonElement)) {
    const seen = [...document.querySelectorAll("#surface button")]
      .map((b) => (b.getAttribute("aria-label") ?? b.textContent ?? "").trim())
      .join(" | ");
    throw new Error(`no button "${label}", saw: ${seen}`);
  }
  found.click();
}

function has(label: string): boolean {
  return [...document.querySelectorAll("#surface button")].some(
    (b) => (b.getAttribute("aria-label") ?? b.textContent ?? "").trim() === label,
  );
}

/** The textarea behind a real label, never a placeholder standing in for one. */
function pasteBox(): HTMLTextAreaElement {
  const label = [...document.querySelectorAll("#surface label")].find((l) =>
    (l.textContent ?? "").includes("Paste your price list"),
  );
  if (label === undefined) throw new Error("no label for the paste box");
  const control = document.getElementById(label.getAttribute("for") ?? "");
  if (!(control instanceof HTMLTextAreaElement)) throw new Error("the paste box is not a textarea");
  return control;
}

function typeInto(control: HTMLTextAreaElement, value: string): void {
  control.value = value;
  control.dispatchEvent(new Event("input", { bubbles: true }));
}

function reviewField(label: string): HTMLInputElement {
  const found = [...document.querySelectorAll("#surface .paste-lines label")].find(
    (node) => node.textContent?.trim() === label,
  );
  const control = document.getElementById(found?.getAttribute("for") ?? "");
  if (!(control instanceof HTMLInputElement)) throw new Error(`no review field ${label}`);
  return control;
}

function ticks(): HTMLInputElement[] {
  return [...document.querySelectorAll<HTMLInputElement>("#surface .paste-lines input[type=checkbox]")];
}

function countText(): string {
  return document.querySelector("#surface .paste-count")?.textContent ?? "";
}

function openPaste(text: string): void {
  shop();
  press("Paste a price list");
  typeInto(pasteBox(), text);
}

/**
 * As above, but with the box actually focused, which is the only state a real
 * seller can paste from.
 *
 * `typeInto` alone leaves `document.activeElement` on the body, and `typing()`
 * in the store is true for any focused textarea. Every other test in this file
 * therefore repaints synchronously in a way the app never does on a phone,
 * where the keyboard is up and the box holds focus. This is the same technique
 * `repaint-while-typing.test.ts` already uses.
 */
function pasteWhileFocused(text: string): void {
  shop();
  press("Paste a price list");
  const box = pasteBox();
  box.focus();
  typeInto(box, text);
}

const LIST = "COMMISSIONS\nSketch, 30\nFull colour, 80";

describe("opening the paste screen", () => {
  it("is offered inside a price list, which is the list its rows will join", () => {
    shop();
    expect(has("Paste a price list")).toBe(true);
  });

  it("is not on screen until it is asked for", () => {
    shop();
    expect(document.querySelector("#surface .paste-lines")).toBeNull();
  });

  it("opens a box with a real label rather than a placeholder", () => {
    shop();
    press("Paste a price list");
    expect(pasteBox()).toBeInstanceOf(HTMLTextAreaElement);
  });

  it("never uses the word import, which already means replacing the page", () => {
    openPaste(LIST);
    const surface = document.getElementById("surface")?.textContent ?? "";
    expect(surface.toLowerCase()).not.toContain("import");
  });
});

describe("ticking the lines", () => {
  it("shows one tick per pasted line, including the ones it will not suggest", () => {
    openPaste(LIST);
    expect(ticks()).toHaveLength(3);
  });

  it("pre-ticks the item shaped lines only", () => {
    openPaste(LIST);
    expect(ticks().map((t) => t.checked)).toEqual([false, true, true]);
  });

  it("counts what is ticked, live", () => {
    openPaste(LIST);
    expect(countText()).toContain("2");

    const first = ticks()[0];
    if (first === undefined) throw new Error("no ticks");
    first.click();
    expect(countText()).toContain("3");
  });

  it("ticks all and unticks all in one press each", () => {
    openPaste(LIST);

    press("Tick all");
    expect(ticks().every((t) => t.checked)).toBe(true);

    press("Untick all");
    expect(ticks().some((t) => t.checked)).toBe(false);
  });

  it("shows the seller the line as they pasted it, not only what was made of it", () => {
    openPaste(LIST);
    const lines = document.querySelector("#surface .paste-lines")?.textContent ?? "";
    expect(lines).toContain("COMMISSIONS");
    expect(lines).toContain("Sketch");
  });
});

describe("pasting with the box focused, which is the only way it happens", () => {
  it("lets a seller correct one row while the keyboard and caret stay in that field", () => {
    const source = "Woven basket, $24\nHand-dyed scarf: from $35\nCotton tote | $18";
    pasteWhileFocused(source);
    expect(reviewField("Item, line 2").value).toBe("Hand-dyed scarf");
    expect(reviewField("Price, line 2").value).toBe("from $35");
    expect(document.querySelector("#surface .paste-lines")?.textContent).toContain("Hand-dyed scarf: from $35");

    const name = reviewField("Item, line 2");
    name.focus();
    name.value = "Indigo scarf";
    name.dispatchEvent(new Event("input", { bubbles: true }));
    expect(document.activeElement).toBe(name);
    expect(name.isConnected).toBe(true);
    expect(reviewField("Item, line 1").value).toBe("Woven basket");

    const price = reviewField("Price, line 2");
    price.focus();
    price.value = "from $42";
    price.dispatchEvent(new Event("input", { bubbles: true }));
    expect(document.activeElement).toBe(price);
    expect(price.isConnected).toBe(true);
    expect(getState().pasting?.corrections?.[1]).toEqual({ name: "Indigo scarf", price: "from $42" });

    press("Add 3 items");
    expect(menuBlock().tiers.map(({ name, price: savedPrice }) => [name, savedPrice])).toEqual([
      ["Bust", "45"],
      ["Woven basket", "$24"],
      ["Indigo scarf", "from $42"],
      ["Cotton tote", "$18"],
    ]);
  });

  it("drops an old row correction when the source box is replaced", () => {
    pasteWhileFocused("Woven basket, $24");
    const name = reviewField("Item, line 1");
    name.value = "Edited basket";
    name.dispatchEvent(new Event("input", { bubbles: true }));
    typeInto(pasteBox(), "Cotton tote | $18");
    expect(reviewField("Item, line 1").value).toBe("Cotton tote");
    expect(getState().pasting?.corrections).toEqual({});
  });

  it("disables Add while a reviewed item name is empty and restores it as typed", () => {
    pasteWhileFocused("Basket, $24");
    const name = reviewField("Item, line 1");
    name.focus();
    name.value = "";
    name.dispatchEvent(new Event("input", { bubbles: true }));
    expect(has("Add 0 items")).toBe(true);
    const add = [...document.querySelectorAll<HTMLButtonElement>("#surface button")].find((button) => button.textContent?.trim() === "Add 0 items");
    expect(add?.disabled).toBe(true);
    expect(document.activeElement).toBe(name);

    name.value = "Blue basket";
    name.dispatchEvent(new Event("input", { bubbles: true }));
    expect(has("Add 1 item")).toBe(true);
    expect(name.isConnected).toBe(true);
  });

  it("requires a checked unnamed row to be corrected or unticked before adding other rows", () => {
    pasteWhileFocused("Basket, $24\nTote, $18");
    const name = reviewField("Item, line 1");
    name.focus();
    name.value = "";
    name.dispatchEvent(new Event("input", { bubbles: true }));
    const add = [...document.querySelectorAll<HTMLButtonElement>("#surface button")].find(
      (control) => control.textContent?.trim() === "Add 1 item",
    );
    expect(add?.disabled).toBe(true);
    expect(document.querySelector("#surface .paste-body")?.textContent).toContain("line 1");
    ticks()[0]?.focus();
    ticks()[0]?.click();
    expect([...document.querySelectorAll<HTMLButtonElement>("#surface button")].find(
      (control) => control.textContent?.trim() === "Add 1 item",
    )?.disabled).toBe(false);
  });

  it("makes later price-list lines reachable for correction", () => {
    pasteWhileFocused(Array.from({ length: 101 }, (_, i) => `Item ${String(i + 1)}, $${String(i + 1)}`).join("\n"));
    expect(reviewField("Item, line 1").value).toBe("Item 1");
    expect(document.querySelector("#surface .paste-body")?.textContent).toContain("Showing lines 1 to 100 of 101");
    press("Next 100 lines");
    expect(reviewField("Item, line 101").value).toBe("Item 101");
    expect(document.querySelector("#surface .paste-body")?.textContent).toContain("Showing lines 101 to 101 of 101");
  });

  it("shows the lines without waiting for the seller to tap somewhere else", async () => {
    // On a phone the keyboard is up and the box holds focus. `typing()` is
    // true for any focused textarea, and `repaint` defers while it is, so a
    // panel whose whole body is behind a repaint shows the seller nothing at
    // all after their paste: no count, no ticks, no Add button, and a "Done
    // pasting" that throws the paste away.
    pasteWhileFocused(LIST);
    for (let i = 0; i < 10; i += 1) await new Promise((r) => setTimeout(r, 30));

    expect(ticks()).toHaveLength(3);
    expect(has("Add 2 items")).toBe(true);
  });
});

describe("a paste far larger than any real price list", () => {
  it("draws a bounded list and says so, rather than freezing the phone", () => {
    // One checkbox and a label per line, rebuilt on every keystroke, is what
    // makes an enormous paste a hang rather than a slowdown. The cap is on
    // what is DRAWN, so nothing is lost.
    const many = Array.from({ length: 900 }, (_, i) => `Item ${String(i)}, ${String(i)}`).join("\n");
    openPaste(many);

    expect(ticks()).toHaveLength(100);
    expect(document.querySelector("#surface .paste-capped")?.textContent ?? "").toContain("900");
  });

  it("counts every line, not only the drawn ones", () => {
    // That the conversion itself covers the undrawn lines is asserted in
    // `price-list-paste.test.ts`, without a shell attached. Converting nine
    // hundred rows here meant rendering nine hundred price list forms, which
    // took two seconds alone and blew the five second timeout as soon as the
    // full suite ran it beside anything else. A test that only passes when the
    // machine is quiet is worse than no test.
    const many = Array.from({ length: 900 }, (_, i) => `Item ${String(i)}, ${String(i)}`).join("\n");
    openPaste(many);

    expect(has("Add 900 items")).toBe(true);
  });
});

describe("converting", () => {
  it("names how many products the press will make", () => {
    openPaste(LIST);
    expect(has("Add 2 items")).toBe(true);
  });

  it("says one item rather than 1 items", () => {
    openPaste("Sketch, 30");
    expect(has("Add 1 item")).toBe(true);
  });

  it("offers nothing to press when nothing is ticked", () => {
    openPaste(LIST);
    press("Untick all");

    // By its exact label, not by "starts with Add": the section also holds
    // "Add another item", and a looser match finds that one and passes while
    // proving nothing.
    const add = [...document.querySelectorAll("#surface button")].find(
      (b) => (b.textContent ?? "").trim() === "Add 0 items",
    );
    expect(add instanceof HTMLButtonElement && add.disabled).toBe(true);
  });

  it("adds the ticked lines to the price list", () => {
    openPaste(LIST);
    press("Add 2 items");
    expect(menuBlock().tiers.map((t) => t.name)).toEqual(["Bust", "Sketch", "Full colour"]);
  });

  it("offers the undo in the words of what it did, not of pricing", () => {
    // The undo entry is shared with feature 022's bulk pricing, which is the
    // right mechanism and the wrong sentence: this priced nothing.
    openPaste(LIST);
    press("Add 2 items");
    expect(has("Undo adding 2 items")).toBe(true);
    expect(has("Undo pricing 2 items")).toBe(false);
  });

  it("puts the rows back, and keeps the paste so the ticks can be corrected", () => {
    openPaste(LIST);
    press("Add 2 items");
    press("Undo adding 2 items");

    expect(menuBlock().tiers.map((t) => t.name)).toEqual(["Bust"]);
    expect(pasteBox().value).toBe(LIST);
    expect(ticks().map((t) => t.checked)).toEqual([false, true, true]);
  });

  it("closes when the seller is done, and forgets the paste", () => {
    openPaste(LIST);
    press("Done pasting");
    expect(document.querySelector("#surface .paste-lines")).toBeNull();
    expect(getState().pasting).toBeUndefined();
  });
});

describe("opening a file instead of pasting", () => {
  it("rejects a non-text file chosen from an unrestricted Android document picker", () => {
    shop();
    press("Paste a price list");
    const picker = document.getElementById("price-list-file");
    if (!(picker instanceof HTMLInputElement)) throw new Error("no picker");
    const file = new File(["binary"], "photo.png", { type: "image/png" });
    Object.defineProperty(picker, "files", { value: [file], configurable: true });
    picker.dispatchEvent(new Event("change", { bubbles: true }));
    expect(getState().pasting?.text).toBe("");
    expect(document.getElementById("live-region")?.textContent).toContain("text or price list file");
    expect(document.querySelector(".paste-file-error")?.textContent).toContain("text or price list file");
    expect(document.querySelector<HTMLParagraphElement>(".paste-file-error")?.hidden).toBe(false);
  });

  it("reads the chosen file after a line is unticked", async () => {
    openPaste("Original, $10");
    const picker = document.getElementById("price-list-file");
    if (!(picker instanceof HTMLInputElement)) throw new Error("no picker");
    let finishRead: ((value: string) => void) | undefined;
    const file = { text: () => new Promise<string>((resolve) => { finishRead = resolve; }) };
    Object.defineProperty(picker, "files", { value: [file], configurable: true });
    picker.dispatchEvent(new Event("change", { bubbles: true }));
    ticks()[0]?.focus();
    ticks()[0]?.click();
    finishRead?.("New item, $22");
    for (let i = 0; i < 10; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
    expect(getState().pasting?.text).toBe("New item, $22");
  });

  it("ignores a file read that finishes after the seller starts a different paste", async () => {
    shop();
    press("Paste a price list");
    const picker = document.getElementById("price-list-file");
    if (!(picker instanceof HTMLInputElement)) throw new Error("no picker");
    let finishRead: ((value: string) => void) | undefined;
    const file = { text: () => new Promise<string>((resolve) => { finishRead = resolve; }) };
    Object.defineProperty(picker, "files", { value: [file], configurable: true });
    picker.dispatchEvent(new Event("change", { bubbles: true }));

    press("Done pasting");
    press("Paste a price list");
    finishRead?.("Old basket, $24");
    for (let i = 0; i < 10; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
    expect(getState().pasting?.text).toBe("");
    expect(pasteBox().value).toBe("");
  });

  it("offers a real button in front of a hidden picker, the pairing the a11y gate wants", () => {
    shop();
    press("Paste a price list");
    expect(has("Open a price list from this device")).toBe(true);
  });

  it("does not accept a saved page, which is a different feature that replaces the page", () => {
    shop();
    press("Paste a price list");
    const picker = document.getElementById("price-list-file");
    const accept = picker?.getAttribute("accept") ?? "";
    expect(accept).toContain(".csv");
    expect(accept).not.toContain("json");
  });

  it("says so and changes nothing when the file cannot be read", async () => {
    shop();
    press("Paste a price list");

    const picker = document.getElementById("price-list-file");
    if (!(picker instanceof HTMLInputElement)) throw new Error("no picker");
    // A File whose text() rejects, which is what an unreadable file does.
    const broken = {
      text: () => Promise.reject(new Error("unreadable")),
    };
    Object.defineProperty(picker, "files", { value: [broken], configurable: true });
    picker.dispatchEvent(new Event("change", { bubbles: true }));

    for (let i = 0; i < 20; i += 1) await new Promise((r) => setTimeout(r, 0));

    const said = document.getElementById("live-region")?.textContent ?? "";
    expect(said).toContain("could not be read");
    expect(document.querySelector(".paste-file-error")?.textContent).toContain("could not be read");
    expect(document.querySelector<HTMLParagraphElement>(".paste-file-error")?.hidden).toBe(false);
    expect(getState().pasting?.text).toBe("");
  });

  it("fills the box from a chosen file", async () => {
    shop();
    press("Paste a price list");

    const picker = document.getElementById("price-list-file");
    if (!(picker instanceof HTMLInputElement)) throw new Error("no picker");
    const file = new File(["Sketch, 30\nFull colour, 80"], "prices.csv", { type: "text/csv" });
    // jsdom has no DataTransfer to build a FileList with, so the property is
    // defined directly. The change handler only ever reads `files[0]`.
    Object.defineProperty(picker, "files", { value: [file], configurable: true });
    picker.dispatchEvent(new Event("change", { bubbles: true }));

    for (let i = 0; i < 20; i += 1) await new Promise((r) => setTimeout(r, 0));

    expect(getState().pasting?.text).toContain("Sketch");
    expect(ticks()).toHaveLength(2);
  });
});
