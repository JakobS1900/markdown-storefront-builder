/**
 * @vitest-environment jsdom
 *
 * Choosing which saved page to open.
 *
 * Storage has been multi-page since feature 004 and nothing in the interface
 * ever let anyone pick one, so the app opened whichever page had the newest
 * timestamp and that was the only page anybody could reach. Import writes a new
 * page every time, on purpose, and FR-018 refuses to open a damaged one while
 * leaving it in place with the newest timestamp of all. Both of those strand
 * the page the artist actually cares about, in storage, intact, with no route
 * back to it.
 *
 * The refusal case is the one that matters and it is the last test here: a page
 * that cannot be opened must not take the list down with it, or the fix is only
 * a fix for the easy half.
 *
 * jsdom has no IndexedDB, so these run against fake-indexeddb, as db.test.ts
 * does, with a fresh factory per test.
 */
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";

import { emptyDocument } from "@mdsb/engine";

import { listPages, writePage } from "../src/db.js";
import { addBlock, getState, init, refreshPages, selectBlock, subscribe, update } from "../src/store.js";
import { blankBlock } from "../src/ui/forms.js";
import { renderShell } from "../src/ui/shell.js";
import { settle } from "./settle.js";

let stop: (() => void) | undefined;

/** A page in storage. The default title is what an untitled page is stored as. */
async function stored(id: string, over: { title?: string; updatedAt?: number; json?: string } = {}) {
  await writePage({
    id,
    json: over.json ?? '{"schemaVersion":1,"target":"rentry","blocks":[]}',
    title: over.title ?? "Untitled page",
    updatedAt: over.updatedAt ?? 1000,
  });
}

/**
 * Waits for storage.
 *
 * fake-indexeddb settles a request over several turns of the event loop, as the
 * real thing does. One flush is not enough and a test that asserts too early
 * fails for a reason that has nothing to do with what it is testing.
 */
/**
 * Boots the app on a given page id, with storage working.
 *
 * The title is passed separately because the open page's entry reads its name
 * from the live document rather than from the record, which is the point of one
 * of these tests. At launch the two agree, because the document came from the
 * record; here they only agree if the test says so.
 */
async function live(pageId: string, title?: string): Promise<void> {
  document.body.innerHTML =
    '<a class="skip" href="#surface">Skip</a><div id="app"></div>' +
    '<div id="live-region" class="sr-only" role="status" aria-live="polite"></div>';
  const root = document.getElementById("app");
  if (root === null) throw new Error("missing #app");
  init(true, title === undefined ? undefined : { ...emptyDocument("rentry"), title }, pageId);
  stop = subscribe(() => renderShell(root));
  await refreshPages();
  renderShell(root);
}

/**
 * What each row is called, by accessible name.
 *
 * First child only: that is the control that opens the page, or the text
 * marking the one already open. A row also carries a remove control, which is
 * feature 012's and is not what these tests are about.
 */
function entries(): string[] {
  return [...document.querySelectorAll(".pages li > :first-child")].map((node) =>
    (node.getAttribute("aria-label") ?? node.textContent ?? "").trim(),
  );
}

/** The rows that can be opened, which excludes the page already open. */
function openable(): HTMLButtonElement[] {
  return [...document.querySelectorAll<HTMLButtonElement>(".pages li > button:first-child")];
}

beforeEach(() => {
  stop?.();
  stop = undefined;
  // A fresh database per test, so nothing passes because of a leftover page.
  globalThis.indexedDB = new IDBFactory();
});

describe("the page list", () => {
  it("is not there at all before anything has been saved", async () => {
    // A brand new install showed "Your pages (0)": a list of nothing, above an
    // empty page, offering to start another empty page. There is nothing to
    // switch to and nothing to gain from a second blank page when the one on
    // screen is already blank.
    await live("nothing-saved-yet");

    expect(getState().pages).toHaveLength(0);
    expect(document.querySelector(".pages-group")).toBeNull();
    expect(document.querySelector(".pages")).toBeNull();
  });

  it("appears as soon as the first page has actually been saved", async () => {
    // The half that matters. Hiding the group at zero is only right if the
    // group comes back by itself, and nothing refreshed the list after a save,
    // so a new artist would have typed their first page and still had no way to
    // start a second one until they next launched the app.
    await live("first-page");

    update({ ...getState().doc, title: "Commissions" });
    await settle();
    renderShell(document.getElementById("app") as HTMLElement);

    expect(await listPages()).toHaveLength(1);
    expect(document.querySelector(".pages-group")).not.toBeNull();
    expect(document.querySelector(".pages-group > summary")?.textContent).toBe("Your pages (1)");
    expect(document.querySelector('.pages [aria-current="page"]')?.textContent).toContain("Commissions");
  });

  it("does not re-read storage on every keystroke once the page is listed", async () => {
    // The refresh above fires when the page just written is not in the list
    // yet, which is once per page, not once per save. Re-reading every stored
    // page's contents on every character is exactly the cost the deferred
    // repaint exists to avoid.
    await live("first-page");
    update({ ...getState().doc, title: "C" });
    await settle();

    const reads: number[] = [];
    for (const ch of ["Co", "Com", "Comm"]) {
      update({ ...getState().doc, title: ch });
      await settle();
      reads.push(getState().pages.length);
    }

    expect(reads).toEqual([1, 1, 1]);
    expect(await listPages()).toHaveLength(1);
  });

  it("offers nothing to switch to when there is only one page", async () => {
    // This asserted that the whole group was absent, which was FR-020c. Feature
    // 012 replaced that rule: the group carries the only way to start a second
    // page, so somebody with one page has to be able to reach it. What survives
    // of the original intent is the part that was actually about switching.
    await stored("only");
    await live("only");

    expect(openable()).toHaveLength(0);
    expect(document.querySelectorAll(".pages li")).toHaveLength(1);
    expect(document.querySelector('.pages [aria-current="page"]')).not.toBeNull();
  });

  it("appears once a second page exists", async () => {
    await stored("mine", { title: "Commissions", updatedAt: 2000 });
    await stored("backup", { title: "Commissions (backup)", updatedAt: 1000 });
    await live("mine");

    expect(document.querySelector(".pages")).not.toBeNull();
    expect(entries()).toHaveLength(2);
    expect(document.querySelector(".pages-group > summary")?.textContent).toBe("Your pages (2)");
  });

  it("lists the newest first", async () => {
    await stored("old", { title: "Older", updatedAt: 1000 });
    await stored("new", { title: "Newer", updatedAt: 5000 });
    await live("old", "Older");

    expect(entries().map((e) => e.split(",")[0])).toEqual(["Newer", "Older"]);
  });

  it("tells two untitled pages apart", async () => {
    // Titles are optional and default to the same words, so a title alone
    // cannot name an entry. FR-020a.
    await stored("a", { updatedAt: Date.UTC(2026, 0, 2) });
    await stored("b", { updatedAt: Date.UTC(2026, 5, 9) });
    await live("a");

    const names = entries();
    expect(names[0]).not.toBe(names[1]);
    expect(names.every((n) => n.startsWith("Untitled page, last edited "))).toBe(true);
  });

  it("marks the page already open, and does not offer to open it again", async () => {
    await stored("mine", { title: "Commissions", updatedAt: 2000 });
    await stored("other", { title: "Old prices", updatedAt: 1000 });
    await live("mine", "Commissions");

    const current = document.querySelector('.pages [aria-current="page"]');
    expect(current?.textContent).toContain("Commissions");
    expect(openable().map((b) => b.textContent?.split(",")[0])).toEqual(["Old prices"]);
  });

  it("takes the open page's title from the document, not the stale record", async () => {
    // The record is only rewritten when a save lands. Reading the live document
    // means renaming a page renames its entry at once.
    await stored("mine", { title: "Commissions", updatedAt: 2000 });
    await stored("other", { title: "Old prices", updatedAt: 1000 });
    await live("mine", "Commissions");

    // The switcher holds no inputs, so the first text input is the page title.
    const title = document.querySelector<HTMLInputElement>("#app input[type=text]");
    if (title === null) throw new Error("no title field");
    title.value = "Renamed";
    title.dispatchEvent(new Event("input"));
    renderShell(document.getElementById("app") as HTMLElement);

    expect(document.querySelector('.pages [aria-current="page"]')?.textContent).toContain("Renamed");
  });

  it("stays open when a section is opened, having been left open", async () => {
    // It used to fold itself shut whenever a section was opened. The shell
    // remembers which groups were open by id, and this one took its id from the
    // counter that every field draws from, so rendering an open section's
    // fields moved the number out from under it and the shell had nothing to
    // restore. Nothing the artist did closed it and it closed anyway.
    await stored("mine", { title: "Commissions", updatedAt: 2000 });
    await stored("other", { title: "Old prices", updatedAt: 1000 });
    await live("mine", "Commissions");
    const root = document.getElementById("app") as HTMLElement;

    // A section with several fields, but shut, so opening it later is what
    // moves the field counter. addBlock selects what it adds, so this starts by
    // putting the editor away again: with it already open there is no change in
    // the number of fields and the bug cannot happen.
    addBlock(blankBlock("menu"));
    const section = getState().doc.blocks[0]?.id;
    selectBlock(undefined);
    renderShell(root);

    const group = document.querySelector<HTMLDetailsElement>(".pages-group");
    if (group === null) throw new Error("no group");
    group.open = true;
    const idWhileShut = group.id;

    selectBlock(section);
    renderShell(root);

    const after = document.querySelector<HTMLDetailsElement>(".pages-group");
    expect(after?.id).toBe(idWhileShut);
    expect(after?.open).toBe(true);
  });

  it("opens the page that was pressed", async () => {
    await stored("mine", { title: "Commissions", updatedAt: 2000 });
    await stored("other", {
      title: "Old prices",
      updatedAt: 1000,
      json: '{"schemaVersion":1,"target":"rentry","title":"Old prices","blocks":[{"id":"h","kind":"heading","text":"Prices","level":2}]}',
    });
    await live("mine", "Commissions");

    const button = openable()[0];
    if (button === undefined) throw new Error("nothing to open");
    button.click();
    await settle();

    expect(getState().pageId).toBe("other");
    expect(getState().doc.blocks).toHaveLength(1);
  });

  it("leaves the list up when a page will not open, so another can be chosen", async () => {
    // The whole reason this exists. A refused page keeps the newest timestamp,
    // so it is what the app tries to open at every launch. If refusing it also
    // removed the way out, the artist is exactly as stuck as before. FR-020b.
    await stored("damaged", {
      title: "A damaged page",
      updatedAt: 9000,
      json: '{"schemaVersion":1,"target":"rentry","blocks":[{"id":"x","kind":"heading","text":"my work","level":"TWO"}]}',
    });
    await stored("mine", { title: "Commissions", updatedAt: 2000 });
    // No page is open: the launch attempt was refused, so pageId is a fresh id
    // that is not in storage.
    await live("nothing-open-yet");

    const damaged = openable().find((b) => b.textContent?.startsWith("A damaged page"));
    if (damaged === undefined) throw new Error("the damaged page is not listed");
    damaged.click();
    await settle();

    expect(getState().status.kind).toBe("error");
    expect(getState().status.rawRecovery?.id).toBe("damaged");
    expect(document.querySelector(".pages")).not.toBeNull();

    const mine = openable().find((b) => b.textContent?.startsWith("Commissions"));
    if (mine === undefined) throw new Error("no way out of the refusal");
    mine.click();
    await settle();

    expect(getState().pageId).toBe("mine");
    expect(getState().status.kind).toBe("idle");
  });

  it("puts focus somewhere after switching, since the button pressed is gone", async () => {
    await stored("mine", { title: "Commissions", updatedAt: 2000 });
    await stored("other", { title: "Old prices", updatedAt: 1000 });
    await live("mine", "Commissions");

    const button = openable()[0];
    if (button === undefined) throw new Error("nothing to open");
    button.click();
    await settle();

    expect(document.activeElement).toBe(document.querySelector(".pages-group > summary"));
  });
});
