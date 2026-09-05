/**
 * @vitest-environment jsdom
 *
 * The example page, for somebody who has just arrived.
 *
 * The web build has always existed and has always opened on an empty editor,
 * which demonstrates nothing. Somebody sent a link to see whether the thing
 * works sees a blank form and a row of buttons, and has to imagine the rest.
 *
 * This is the smallest fix: one control on the empty state that loads a real
 * page. It goes through `openBackup`, the same path the import uses, so a
 * document that fails to parse is refused here exactly as a bad file is, and
 * the example arrives as its own page rather than overwriting anything.
 */
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { addBlock, getState, init, subscribe } from "../src/store.js";
import { blankBlock } from "../src/ui/forms.js";
import { renderShell } from "../src/ui/shell.js";
import { settle } from "./settle.js";

let stop: (() => void) | undefined;
const realFetch = globalThis.fetch;

const EXAMPLE = JSON.stringify({
  schemaVersion: 1,
  target: "rentry",
  title: "Ridgeline Carry",
  blocks: [
    { id: "h", kind: "heading", text: "Folding knives", level: 2 },
    { id: "m", kind: "menu", tiers: [{ name: "Mk III", price: "185" }] },
  ],
});

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

function example(): HTMLButtonElement | null {
  return [...document.querySelectorAll<HTMLButtonElement>("#app button")].find(
    (b) => (b.textContent ?? "").includes("example"),
  ) ?? null;
}

beforeEach(() => {
  stop?.();
  stop = undefined;
  globalThis.indexedDB = new IDBFactory();
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("seeing an example", () => {
  it("is offered on an empty page, where there is nothing else to look at", () => {
    live();
    expect(example()).not.toBeNull();
  });

  it("is gone once there is a page of their own", () => {
    const root = live();
    addBlock(blankBlock("profile"));
    renderShell(root);
    expect(example()).toBeNull();
  });

  it("loads a real page when pressed", async () => {
    globalThis.fetch = vi.fn(async () => new Response(EXAMPLE, { status: 200 })) as typeof fetch;
    const root = live();

    example()?.click();
    await settle();
    renderShell(root);

    expect(getState().doc.blocks).toHaveLength(2);
    expect(getState().doc.title).toBe("Ridgeline Carry");
    expect(document.querySelectorAll(".block-row").length).toBe(2);
  });

  it("does not reassure a new arrival about a page they never had", async () => {
    // openBackup says "the page you had open is still saved", which is right
    // for an import and meaningless to somebody who opened the app a moment
    // ago with nothing in it.
    globalThis.fetch = vi.fn(async () => new Response(EXAMPLE, { status: 200 })) as typeof fetch;
    live();

    example()?.click();
    await settle();

    const said = document.getElementById("live-region")?.textContent ?? "";
    expect(said).toContain("example");
    expect(said).not.toContain("the page you had open");
  });

  it("asks for the file beside the app, not somewhere else", async () => {
    const spy = vi.fn(async () => new Response(EXAMPLE, { status: 200 }));
    globalThis.fetch = spy as typeof fetch;
    live();

    example()?.click();
    await settle();

    // Relative, so it resolves under whatever path the app is served from.
    // The site lives at /markdown-storefront-builder/ and the Android build at
    // the root of a custom scheme, and an absolute path is wrong for one of
    // them whichever one it is written for.
    expect(spy).toHaveBeenCalledTimes(1);
    const url = String((spy.mock.calls[0] as unknown[])[0]);
    expect(url.startsWith("/")).toBe(false);
    expect(url).toContain("example.json");
  });

  it("says so and changes nothing when it cannot be fetched", async () => {
    globalThis.fetch = vi.fn(async () => { throw new Error("offline"); }) as typeof fetch;
    const root = live();
    const before = getState().pageId;

    example()?.click();
    await settle();
    renderShell(root);

    expect(getState().doc.blocks).toHaveLength(0);
    expect(getState().pageId).toBe(before);
    expect(document.getElementById("live-region")?.textContent ?? "").toMatch(/could not|not be/i);
  });

  it("refuses a file that is not a page, the same way a bad backup is refused", async () => {
    globalThis.fetch = vi.fn(async () => new Response("{}", { status: 200 })) as typeof fetch;
    const root = live();

    example()?.click();
    await settle();
    renderShell(root);

    expect(getState().doc.blocks).toHaveLength(0);
    expect(document.getElementById("live-region")?.textContent ?? "").not.toBe("");
  });
});
