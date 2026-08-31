/**
 * @vitest-environment jsdom
 *
 * Build beside Preview, on a screen with room for both.
 *
 * The stylesheet and the shell both claimed this for months and neither built
 * it. It is the one thing a desktop gives that a phone cannot: seeing what the
 * page will look like while you are still editing it, without switching away
 * and back.
 *
 * The rules it has to keep:
 *
 *   - A phone renders one surface. The preview pane is not merely hidden with
 *     CSS on a narrow screen, it is not built, because compiling the page and
 *     building its DOM on every repaint is exactly the work that made typing
 *     expensive on the Moto G7.
 *   - It only appears beside Build. Preview and Copy are already the whole
 *     width, and a preview beside a preview is nonsense.
 *   - It follows the document, or it is worse than not being there.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { addBlock, getState, init, selectBlock, setSurface, subscribe, updateBlock } from "../src/store.js";
import { blankBlock } from "../src/ui/forms.js";
import { renderShell } from "../src/ui/shell.js";

let stop: (() => void) | undefined;

/** Pretends the window is wide, or not, the way matchMedia would. */
function width(wide: boolean): void {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: wide && query.includes("min-width"),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    onchange: null,
    dispatchEvent: () => false,
  }));
}

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

const beside = (): HTMLElement | null => document.querySelector("#beside");

beforeEach(() => {
  stop?.();
  stop = undefined;
  vi.unstubAllGlobals();
});

describe("on a screen with room for both", () => {
  it("shows the preview beside the editor", () => {
    width(true);
    const root = live();
    addBlock(blankBlock("heading"));
    renderShell(root);

    expect(beside(), "no preview pane beside the editor").not.toBeNull();
  });

  it("names the pane, so it is not an unlabelled region", () => {
    width(true);
    const root = live();
    renderShell(root);

    expect(beside()?.getAttribute("aria-label")).toBeTruthy();
  });

  it("follows the document", () => {
    width(true);
    const root = live();
    addBlock(blankBlock("heading"));
    const block = getState().doc.blocks[0];
    if (block === undefined || block.kind !== "heading") throw new Error("not a heading");
    selectBlock(block.id);
    renderShell(root);

    expect(beside()?.textContent ?? "").not.toContain("Sold out");

    updateBlock(block.id, { ...block, text: "Sold out" });
    renderShell(root);

    expect(beside()?.textContent ?? "").toContain("Sold out");
  });

  it("does not appear beside Preview or Copy, which are already full width", () => {
    width(true);
    const root = live();
    addBlock(blankBlock("heading"));

    setSurface("preview");
    renderShell(root);
    expect(beside()).toBeNull();

    setSurface("export");
    renderShell(root);
    expect(beside()).toBeNull();
  });
});

describe("on a phone", () => {
  it("does not build the preview pane at all", () => {
    width(false);
    const root = live();
    addBlock(blankBlock("heading"));
    renderShell(root);

    expect(beside(), "a narrow screen paid to compile a preview it cannot show").toBeNull();
  });

  it("still shows the preview when Preview is the chosen surface", () => {
    width(false);
    const root = live();
    addBlock(blankBlock("heading"));
    setSurface("preview");
    renderShell(root);

    expect(document.querySelector("#surface")).not.toBeNull();
    expect(beside()).toBeNull();
  });
});
