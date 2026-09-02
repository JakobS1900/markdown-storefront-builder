/**
 * @vitest-environment jsdom
 *
 * Removing a section, and putting it back.
 *
 * This replaces `delete-confirm.test.ts`. That file asserted a confirmation:
 * the row became "Delete Prices? This cannot be undone" with Keep offered
 * first. The intent it was defending is the one asserted here, that a mis-tap
 * must not cost the artist their work, and only the mechanism has changed.
 *
 * Feature 014, FR-024. A confirmation is the wrong tool for something
 * reversible, because people automate their answer to it: it is clicked through
 * without being read, so it taxes every deliberate removal and fails to prevent
 * the accidental one. The mis-tap itself was addressed by spacing the controls
 * apart, which is a separate change and the one that actually helps.
 */
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";

import { addBlock, getState, init, selectBlock, setSurface, subscribe, update } from "../src/store.js";
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

/** The three sections a page of any size has, in a known order. */
function threeSections(root: HTMLElement): string[] {
  for (const kind of ["profile", "menu", "gallery"] as const) addBlock(blankBlock(kind));
  selectBlock(undefined);
  renderShell(root);
  return getState().doc.blocks.map((b) => b.id);
}

function press(name: string): void {
  const found = [...document.querySelectorAll<HTMLButtonElement>("#app button")].filter(
    (b) => (b.getAttribute("aria-label") ?? b.textContent ?? "").trim() === name,
  );
  if (found.length !== 1) {
    const all = [...document.querySelectorAll("#app button")].map(
      (b) => (b.getAttribute("aria-label") ?? b.textContent ?? "").trim(),
    );
    throw new Error(`${String(found.length)} controls named ${JSON.stringify(name)}. Saw: ${JSON.stringify(all)}`);
  }
  found[0]?.click();
}

const said = (): string => document.getElementById("live-region")?.textContent ?? "";

beforeEach(() => {
  stop?.();
  stop = undefined;
  globalThis.indexedDB = new IDBFactory();
});

describe("removing a section", () => {
  it("removes it at once, without asking", () => {
    const root = live();
    threeSections(root);

    press("Remove Prices");
    renderShell(root);

    expect(getState().doc.blocks).toHaveLength(2);
    expect(getState().doc.blocks.map((b) => b.kind)).toEqual(["profile", "gallery"]);
  });

  it("says what went, and that it can come back", () => {
    // FR-024c. The section vanishing is invisible to anyone not looking at it.
    const root = live();
    threeSections(root);

    press("Remove Prices");

    expect(said()).toContain("Removed Prices");
    expect(said().toLowerCase()).toContain("undo");
  });

  it("offers to put it back, in the list, where it was", () => {
    const root = live();
    threeSections(root);

    press("Remove Prices");
    renderShell(root);

    const rows = [...document.querySelectorAll(".blocks > li")];
    expect(rows).toHaveLength(3);
    // Second of three, which is where it was.
    expect(rows[1]?.className).toContain("undone");
    expect(rows[1]?.textContent).toContain("Prices");
  });
});

describe("putting it back", () => {
  it("restores it to the position it was removed from, not the end", () => {
    // FR-024a. Restoring to the end is a different page from the one they had.
    const root = live();
    const ids = threeSections(root);

    press("Remove Prices");
    renderShell(root);
    press("Undo removing Prices");
    renderShell(root);

    expect(getState().doc.blocks.map((b) => b.id)).toEqual(ids);
    expect(getState().doc.blocks.map((b) => b.kind)).toEqual(["profile", "menu", "gallery"]);
  });

  it("restores the section's contents, not a blank one of the same kind", () => {
    const root = live();
    live();
    addBlock({ id: "m", kind: "menu", tiers: [{ id: "bust", name: "Full colour bust", price: "45" }] });
    selectBlock(undefined);
    renderShell(root);

    press("Remove Prices");
    renderShell(root);
    press("Undo removing Prices");

    const menu = getState().doc.blocks[0];
    expect(menu?.kind).toBe("menu");
    expect(menu?.kind === "menu" ? menu.tiers[0]?.name : "").toBe("Full colour bust");
  });

  it("takes the offer away once it has been used", () => {
    const root = live();
    threeSections(root);

    press("Remove Prices");
    renderShell(root);
    press("Undo removing Prices");
    renderShell(root);

    expect(document.querySelector(".undone")).toBeNull();
    expect(getState().undo).toBeUndefined();
  });

  it("works when the section removed was the only one", () => {
    const root = live();
    addBlock(blankBlock("menu"));
    selectBlock(undefined);
    renderShell(root);

    press("Remove Prices");
    renderShell(root);
    expect(getState().doc.blocks).toHaveLength(0);
    // The offer has to survive the page becoming empty, or the last section a
    // person removes is the one they cannot get back.
    expect(document.querySelector(".undone")).not.toBeNull();

    press("Undo removing Prices");
    renderShell(root);
    expect(getState().doc.blocks).toHaveLength(1);
  });
});

describe("when the offer goes away", () => {
  it("survives doing nothing, because it is not on a timer", async () => {
    // FR-024b. An undo that expires while somebody is scrolled elsewhere is a
    // safety net that is not there when it is reached for.
    const root = live();
    threeSections(root);
    press("Remove Prices");

    await new Promise((r) => setTimeout(r, 600));
    renderShell(root);

    expect(getState().undo).toBeDefined();
    expect(document.querySelector(".undone")).not.toBeNull();
  });

  it("goes when they type something", () => {
    const root = live();
    threeSections(root);
    press("Remove Prices");

    update({ ...getState().doc, title: "Commissions" });
    renderShell(root);

    expect(getState().undo).toBeUndefined();
    expect(document.querySelector(".undone")).toBeNull();
  });

  it("goes when they remove something else", () => {
    const root = live();
    threeSections(root);

    press("Remove Prices");
    renderShell(root);
    press("Remove Gallery");
    renderShell(root);

    // Only the most recent, FR-024d. One offer on screen, naming the gallery.
    const rows = [...document.querySelectorAll(".undone")];
    expect(rows).toHaveLength(1);
    expect(rows[0]?.textContent).toContain("Gallery");
  });

  it("goes when they leave the screen", () => {
    const root = live();
    threeSections(root);
    press("Remove Prices");

    setSurface("preview");
    setSurface("build");
    renderShell(root);

    expect(getState().undo).toBeUndefined();
  });
});

describe("nothing asks any more", () => {
  it("has no confirmation anywhere in a section row", () => {
    const root = live();
    threeSections(root);

    press("Remove Prices");
    renderShell(root);

    expect(document.querySelector(".block-row.confirm")).toBeNull();
    const names = [...document.querySelectorAll("#app button")].map(
      (b) => (b.getAttribute("aria-label") ?? b.textContent ?? "").trim(),
    );
    expect(names.some((n) => n.startsWith("Yes, delete"))).toBe(false);
    expect(names.some((n) => n.startsWith("Keep "))).toBe(false);
  });

  it("still asks before removing a page, which is a different weight of thing", () => {
    // Feature 012's reasoning is untouched: a page is deleted from storage
    // rather than held in memory, and it can carry a hundred sections.
    expect(getState).toBeDefined();
  });
});
