/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { compile, emptyDocument, serializeDocument, type Document } from "@mdsb/engine";
import { listPages, writePage } from "../src/db.js";
import { getState, init, openPage, refreshPages, removeBlock, setPasteText, startPasting, subscribe, undoLast } from "../src/store.js";
import { startSurfaceHistory } from "../src/surface-history.js";
import { resetSidebarFocusTracking } from "../src/ui/pages-sidebar.js";
import { renderShell } from "../src/ui/shell.js";
import { settle } from "./settle.js";

beforeAll(() => startSurfaceHistory());
beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  history.replaceState(null, "");
  resetSidebarFocusTracking();
  document.body.replaceChildren();
});
afterEach(() => vi.unstubAllGlobals());

function control(name: string): HTMLButtonElement {
  const matches = [...document.querySelectorAll<HTMLButtonElement>("button")]
    .filter((node) => (node.getAttribute("aria-label") ?? node.textContent) === name);
  expect(matches, `one control named ${name}`).toHaveLength(1);
  return matches[0] as HTMLButtonElement;
}

function titleInput(): HTMLInputElement {
  return document.querySelector<HTMLInputElement>("#build-private-title input") as HTMLInputElement;
}

function mount(doc: Document, pinned: boolean): HTMLElement {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("1300") && pinned }));
  init(true, doc, "mine");
  const root = document.createElement("div");
  document.body.replaceChildren(root);
  subscribe(() => renderShell(root));
  renderShell(root);
  return root;
}

describe("naming the open page through Your pages", () => {
  it("keeps an unfinished price paste and section undo when naming on Build", async () => {
    mount({ ...emptyDocument("rentry"), blocks: [
      { id: "menu", kind: "menu", heading: "Prices", tiers: [] },
      { id: "h", kind: "heading", level: 2, text: "Keep this heading" },
    ] }, false);
    removeBlock("h");
    startPasting("menu");
    setPasteText("Unfinished price list 12");
    const draft = getState().pasting;
    const undo = getState().undo;
    control("Your pages").click();
    control("Name this page").click();
    await vi.waitFor(() => expect(document.activeElement).toBe(titleInput()));
    expect(getState().pasting).toEqual(draft);
    expect(getState().undo).toEqual(undo);
    titleInput().blur();
    undoLast();
    expect(getState().doc.blocks.some((block) => block.id === "h")).toBe(true);
  });

  it.each([
    ["Preview", false, false],
    ["Copy", false, true],
    ["Preview", true, false],
    ["Copy", true, true],
  ] as const)("opens and keeps the title focused from %s, pinned=%s, content=%s", async (surface, pinned, content) => {
    const doc: Document = content
      ? { ...emptyDocument("rentry"), title: "Existing name", blocks: [{ id: "h", kind: "heading", level: 2, text: "Public heading" }] }
      : emptyDocument("rentry");
    const root = mount(doc, pinned);
    control(surface).click();
    if (!pinned) control("Your pages").click();
    const name = control("Name this page");
    name.focus();
    name.click();
    await vi.waitFor(() => {
      expect(getState().surface).toBe("build");
      expect(getState().sidebarOpen).toBe(false);
      expect(document.activeElement).toBe(titleInput());
    });
    expect(history.state, "naming returns the surface entry as well as the drawer entry").toBeNull();
    expect(root.querySelector(".pages-drawer")).toBeNull();
    expect(titleInput().closest("[inert]")).toBeNull();
    expect(titleInput().closest("details")?.open).toBe(true);
    expect(titleInput().value).toBe(content ? "Existing name" : "");
    titleInput().value = "A new private name";
    titleInput().dispatchEvent(new Event("input"));
    await settle();
    expect(document.activeElement).toBe(titleInput());
    expect(titleInput().value).toBe("A new private name");
    // An ordinary shell repaint must preserve the opened disclosure and caret too.
    renderShell(root);
    expect(titleInput().closest("details")?.open).toBe(true);
    expect(document.activeElement).toBe(titleInput());
    titleInput().blur();
    control("Copy").click();
    const navigated = new Promise<void>((resolve) => window.addEventListener("popstate", () => resolve(), { once: true }));
    history.back();
    await navigated;
    expect(getState().surface).toBe("build");
    expect(document.activeElement).not.toBe(titleInput());
    expect(titleInput().closest("details")?.open).toBe(false);
  });

  it.each([false, true])("leaves the next Back at the Build boundary, pinned=%s", async (pinned) => {
    history.replaceState({ beforeApp: true }, "");
    history.pushState(null, "");
    mount(emptyDocument("rentry"), pinned);
    control("Copy").click();
    if (!pinned) control("Your pages").click();
    control("Name this page").click();
    await vi.waitFor(() => expect(document.activeElement).toBe(titleInput()));
    expect(history.state).toBeNull();
    const navigated = new Promise<void>((resolve) => window.addEventListener("popstate", () => resolve(), { once: true }));
    history.back();
    await navigated;
    expect(history.state).toEqual({ beforeApp: true });
  });

  it("persists the private name and leaves public output and other saved pages intact", async () => {
    const doc: Document = { ...emptyDocument("rentry"), title: "Before", blocks: [{ id: "h", kind: "heading", level: 2, text: "Public heading" }] };
    await writePage({ id: "mine", title: "Before", json: serializeDocument(doc), updatedAt: 1000 });
    await writePage({ id: "other", title: "Other", json: serializeDocument(emptyDocument("rentry")), updatedAt: 900 });
    mount(doc, false);
    await refreshPages();
    const compiled = compile(getState().doc, "rentry");
    control("Copy").click();
    control("Your pages").click();
    control("Name this page").click();
    await vi.waitFor(() => expect(document.activeElement).toBe(titleInput()));
    titleInput().value = 'Private "name" <b>only</b>';
    titleInput().dispatchEvent(new Event("input"));
    await settle();
    expect(compile(getState().doc, "rentry")).toEqual(compiled);
    titleInput().blur();
    control("Your pages").click();
    expect(document.querySelector('[aria-current="page"]')?.textContent).toContain('Private "name" <b>only</b>');
    expect(document.querySelector('[aria-current="page"] b')).toBeNull();
    expect([...document.querySelectorAll(".pages button")].some((b) => b.textContent?.includes("Remove Private"))).toBe(false);
    control("Remove Other").click();
    expect(control("Yes, remove Other")).toBeTruthy();
    expect(await listPages()).toHaveLength(2);
    control("Keep Other").click();
    await openPage("other");
    await openPage("mine");
    expect(getState().doc).toEqual({ ...doc, title: 'Private "name" <b>only</b>' });
    expect(compile(getState().doc, "rentry")).toEqual(compiled);
    expect(await listPages()).toHaveLength(2);
  });
});
