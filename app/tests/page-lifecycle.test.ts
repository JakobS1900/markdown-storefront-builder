/**
 * @vitest-environment jsdom
 *
 * Making a page and removing one.
 *
 * Feature 011 shipped a list you could switch with, could not add to except by
 * importing a file, and could never remove anything from. `newPage` had existed
 * since the app shell with no caller at all.
 *
 * The rule doing the real work here is that the page on screen cannot be
 * removed. It is what stops "what is open now" from ever being asked, and it is
 * enforced in the store as well as in the markup, because a control that is
 * merely not drawn is not a guarantee.
 */
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";

import { emptyDocument } from "@mdsb/engine";

import { listPages, writePage } from "../src/db.js";
import { getState, init, refreshPages, removePage, setSurface, subscribe } from "../src/store.js";
import { renderShell } from "../src/ui/shell.js";

let stop: (() => void) | undefined;

async function stored(id: string, over: { title?: string; updatedAt?: number; json?: string } = {}) {
  await writePage({
    id,
    json: over.json ?? '{"schemaVersion":1,"target":"rentry","blocks":[]}',
    title: over.title ?? "Untitled page",
    updatedAt: over.updatedAt ?? 1000,
  });
}

async function settle(): Promise<void> {
  for (let i = 0; i < 10; i += 1) await new Promise((r) => setTimeout(r, 0));
}

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

/** A control in the page group, by accessible name. */
function control(name: string): HTMLButtonElement {
  const found = [...document.querySelectorAll<HTMLButtonElement>(".pages-group button")].filter(
    (b) => (b.getAttribute("aria-label") ?? b.textContent ?? "").trim() === name,
  );
  if (found.length !== 1) {
    const all = [...document.querySelectorAll(".pages-group button")].map(
      (b) => (b.getAttribute("aria-label") ?? b.textContent ?? "").trim(),
    );
    throw new Error(`${String(found.length)} controls named ${JSON.stringify(name)}. Saw: ${JSON.stringify(all)}`);
  }
  return found[0] as HTMLButtonElement;
}

function ids(): string[] {
  return [...document.querySelectorAll(".pages li")].map((li) => li.textContent ?? "");
}

beforeEach(() => {
  stop?.();
  stop = undefined;
  globalThis.indexedDB = new IDBFactory();
});

describe("starting a page", () => {
  it("offers the way to make one even when there is only a single page", async () => {
    // FR-021c, which replaces FR-020c. The button that makes a second page has
    // to be reachable by somebody who has one.
    await stored("only", { title: "Commissions" });
    await live("only", "Commissions");

    expect(document.querySelector(".pages-group")).not.toBeNull();
    expect(control("Start a new page")).toBeTruthy();
  });

  it("makes a page, opens it, and leaves the old one alone", async () => {
    await stored("mine", { title: "Commissions", updatedAt: 2000 });
    await live("mine", "Commissions");

    control("Start a new page").click();
    await settle();

    expect(getState().pageId).not.toBe("mine");
    expect(getState().doc.blocks).toHaveLength(0);
    expect(getState().doc.title).toBeUndefined();

    const saved = await listPages();
    expect(saved).toHaveLength(2);
    const old = saved.find((p) => p.id === "mine");
    expect(old?.title).toBe("Commissions");
  });

  it("lists the new page straight away, rather than once it is typed into", async () => {
    await stored("mine", { title: "Commissions", updatedAt: 2000 });
    await live("mine", "Commissions");

    control("Start a new page").click();
    await settle();

    expect(document.querySelectorAll(".pages li")).toHaveLength(2);
    expect(document.querySelectorAll('.pages [aria-current="page"]')).toHaveLength(1);
  });
});

describe("removing a page", () => {
  it("offers no way to remove the page on screen", async () => {
    await stored("mine", { title: "Commissions", updatedAt: 2000 });
    await stored("other", { title: "Old prices", updatedAt: 1000 });
    await live("mine", "Commissions");

    expect(() => control("Remove Commissions")).toThrow();
    expect(control("Remove Old prices")).toBeTruthy();
  });

  it("asks first, and removes nothing while it is asking", async () => {
    await stored("mine", { title: "Commissions", updatedAt: 2000 });
    await stored("other", { title: "Old prices", updatedAt: 1000 });
    await live("mine", "Commissions");

    control("Remove Old prices").click();
    await settle();

    expect(document.querySelector(".pages li.confirm")).not.toBeNull();
    expect(await listPages()).toHaveLength(2);

    // The row holds the question and its answers and nothing else, so the
    // control that raised it cannot be hit again by the same thumb.
    expect(() => control("Remove Old prices")).toThrow();
    expect(control("Keep Old prices")).toBeTruthy();
    expect(control("Yes, remove Old prices")).toBeTruthy();
  });

  it("keeps the page when the safe answer is taken", async () => {
    await stored("mine", { title: "Commissions", updatedAt: 2000 });
    await stored("other", { title: "Old prices", updatedAt: 1000 });
    await live("mine", "Commissions");

    control("Remove Old prices").click();
    await settle();
    control("Keep Old prices").click();
    await settle();

    expect(await listPages()).toHaveLength(2);
    expect(document.querySelector(".pages li.confirm")).toBeNull();
  });

  it("removes it once, and only it, when the answer is yes", async () => {
    await stored("mine", { title: "Commissions", updatedAt: 3000 });
    await stored("other", { title: "Old prices", updatedAt: 2000 });
    await stored("third", { title: "Something else", updatedAt: 1000 });
    await live("mine", "Commissions");

    control("Remove Old prices").click();
    await settle();
    control("Yes, remove Old prices").click();
    await settle();

    const left = (await listPages()).map((p) => p.id).sort();
    expect(left).toEqual(["mine", "third"]);
    expect(ids().join(" ")).not.toContain("Old prices");
    expect(getState().pageId).toBe("mine");
    expect(getState().doc.title).toBe("Commissions");
  });

  it("refuses the open page even when asked directly", async () => {
    // FR-022a. The control is not drawn for the open page, and that is not the
    // guarantee: this is.
    await stored("mine", { title: "Commissions", updatedAt: 2000 });
    await stored("other", { title: "Old prices", updatedAt: 1000 });
    await live("mine", "Commissions");

    await removePage("mine");

    expect((await listPages()).map((p) => p.id).sort()).toEqual(["mine", "other"]);
  });

  it("cannot remove the last page, because there is nothing to be on but it", async () => {
    await stored("only", { title: "Commissions" });
    await live("only", "Commissions");

    expect(document.querySelectorAll(".pages li")).toHaveLength(1);
    expect(() => control("Remove Commissions")).toThrow();
  });

  it("treats leaving the screen as the safe answer", async () => {
    await stored("mine", { title: "Commissions", updatedAt: 2000 });
    await stored("other", { title: "Old prices", updatedAt: 1000 });
    await live("mine", "Commissions");

    control("Remove Old prices").click();
    await settle();
    setSurface("preview");
    setSurface("build");
    await settle();

    expect(document.querySelector(".pages li.confirm")).toBeNull();
    expect(await listPages()).toHaveLength(2);
  });

  it("can put away a page that would not open", async () => {
    // The case the switcher was built for, one step further on: the artist has
    // been handed the bytes and wants the wreckage off the list.
    await stored("damaged", {
      title: "A damaged page",
      updatedAt: 9000,
      json: '{"schemaVersion":1,"target":"rentry","blocks":[{"id":"x","kind":"heading","text":"my work","level":"TWO"}]}',
    });
    await stored("mine", { title: "Commissions", updatedAt: 2000 });
    await live("mine", "Commissions");

    control("Remove A damaged page").click();
    await settle();
    control("Yes, remove A damaged page").click();
    await settle();

    expect((await listPages()).map((p) => p.id)).toEqual(["mine"]);
  });
});
