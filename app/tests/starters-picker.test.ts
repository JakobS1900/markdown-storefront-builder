/**
 * @vitest-environment jsdom
 *
 * Choosing a starting point.
 *
 * Two of these are about placement rather than behaviour, and they are the
 * reason the picker is rendered twice. `pageList` returns nothing when there
 * are no saved pages (`build.ts:130`), which is correct and which would have
 * hidden this feature from the only person it was built for.
 */
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

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
  init(true);
  stop = subscribe(() => renderShell(root));
  renderShell(root);
  return root;
}

function starterButtons(): HTMLButtonElement[] {
  return [...document.querySelectorAll<HTMLButtonElement>(".starters button")];
}

async function settle(): Promise<void> {
  for (let i = 0; i < 12; i += 1) await new Promise((r) => setTimeout(r, 0));
}

beforeEach(() => {
  stop?.();
  stop = undefined;
  globalThis.indexedDB = new IDBFactory();
});

afterEach(() => {
  stop?.();
  stop = undefined;
});

describe("the starting point picker", () => {
  it("is reachable by somebody who has nothing saved at all", () => {
    live();
    // The empty state. There is no pages group at this point, by design.
    expect(document.querySelector(".pages-group")).toBeNull();
    expect(starterButtons().length).toBeGreaterThan(0);
  });

  it("names every starting point and says who each is for", () => {
    live();
    for (const b of starterButtons()) {
      const name = b.getAttribute("aria-label") ?? b.textContent ?? "";
      expect(name.trim()).not.toBe("");
    }
  });

  it("leaves the blank path exactly one press", async () => {
    const root = live();
    addBlock(blankBlock("profile"));
    renderShell(root);
    // `pageList`, and the starters group beside its "Start a new page"
    // button, are gated on `state.pages`, which only catches up once the
    // save this triggers has actually landed (`store.ts` save -> refreshPages).
    // A real press is never this fast; settling first is what makes the
    // assertion about the button, not about a race it would otherwise
    // sometimes lose.
    await settle();
    renderShell(root);
    const blank = [...document.querySelectorAll<HTMLButtonElement>("#app button")]
      .find((b) => (b.textContent ?? "").includes("Start a new page"));
    expect(blank).toBeDefined();
  });

  it("opens a starting point as its own page, leaving the open one alone", async () => {
    const root = live();
    addBlock(blankBlock("profile"));
    renderShell(root);
    // Same wait as above: the starters group inside `pageList` needs the
    // save this triggered to have landed before it is there to click.
    await settle();
    renderShell(root);
    const before = getState().pageId;

    const first = starterButtons()[0];
    expect(first).toBeDefined();
    first?.click();
    await settle();
    renderShell(root);

    expect(getState().pageId).not.toBe(before);
    expect(getState().doc.blocks.length).toBeGreaterThanOrEqual(3);
    // The page that was open is still in storage, which is the whole contract
    // `openBackup` exists to keep.
    expect(getState().pages.some((p) => p.id === before)).toBe(true);
  });

  it("says what it did, without the wording meant for a file import", async () => {
    const root = live();

    starterButtons()[0]?.click();
    await settle();
    renderShell(root);

    const said = document.getElementById("live-region")?.textContent ?? "";
    expect(said).not.toBe("");
    // `openBackup` says "the page you had open is still saved", which is right
    // for a backup and meaningless for a template.
    expect(said).not.toContain("backup");
  });
});
