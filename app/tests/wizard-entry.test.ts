/**
 * @vitest-environment jsdom
 *
 * The way in and the way out: the control that opens the wizard, and the page
 * the finish creates.
 *
 * SEPARATE FROM `wizard.test.ts` ON PURPOSE, and the split is the same one that
 * file states at its own top. That file is the layer: what is on screen, what a
 * keyboard can reach, and nothing that crosses into storage. Everything here
 * crosses a seam. It needs `fake-indexeddb`, because the finish writes a page
 * through `openBackup`, and it needs the real Build surface rather than a
 * hand-built trigger, because the whole of T036 is that the control the shell
 * looks for by `aria-controls` actually exists in the tree.
 *
 * The seam is what these tests are for. `wizard.ts` is correct on its own and
 * `openBackup` is correct on its own, and a per chunk review sees one internally
 * correct side of that at a time. Feature 024's holistic review found two high
 * severity defects of exactly that shape, which is why the byte identity of the
 * page that was already open is asserted here rather than reasoned about.
 */
import "fake-indexeddb/auto";
import { serializeDocument } from "@mdsb/engine";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { listPages, type StoredPage } from "../src/db.js";
import { openBackup } from "../src/import.js";
import { getState, init, openWizard, subscribe } from "../src/store.js";
import { STARTERS } from "../src/starters/index.js";
import { startSurfaceHistory, wizardOwnsHistory } from "../src/surface-history.js";
import { renderShell } from "../src/ui/shell.js";
import { QUESTION_COUNT, WIZARD_ID, resetWizardFocusTracking } from "../src/ui/wizard.js";
import { DEFAULT_STARTER_ID } from "../src/ui/wizard-answers.js";

let stop: (() => void) | undefined;

/**
 * The `popstate` listener is registered once for the whole file, exactly as
 * `main.ts` registers it once for the life of the app.
 *
 * `startSurfaceHistory` offers no way to remove one, so calling it per test
 * accumulates them, and that is not harmless here even though every listener is
 * identical. The first one closes the wizard and returns; the second sees a
 * closed wizard and falls through to `setSurface`, which is a second repaint,
 * and `render` calls `replaceChildren`, so it destroys the trigger that the
 * first repaint had just given focus back to. Focus lands on the body and the
 * restore looks broken while the code under test is right.
 *
 * Found by that failure rather than reasoned about in advance. The app has one
 * listener, so the test gets one.
 */
let historyStarted = false;

/**
 * The app as `main.ts` runs it: subscribed, so a state change repaints by
 * itself.
 *
 * Every other DOM test in this project calls `renderShell` by hand, which steps
 * over the path between a state change and a paint. That path is where the
 * chunk 4 review found a closed surface staying on screen, and it is also the
 * path the focus restore below runs on.
 */
function live(): HTMLElement {
  document.body.innerHTML =
    '<a class="skip" href="#surface">Skip</a><div id="app"></div>' +
    '<div id="live-region" class="sr-only" role="status" aria-live="polite"></div>';
  const root = document.getElementById("app");
  if (root === null) throw new Error("missing #app");
  init(true);
  // `main.ts` starts this, and without it every way out of the wizard is a
  // `history.back()` nothing is listening for, so the layer would never close.
  // That is not a detail of the test: the trigger pushes an entry, so from here
  // on the close is a history traversal rather than a direct state change, and
  // jsdom delivers `popstate` on a later task. Anything asserting the wizard is
  // gone has to wait for it, which is why `settleUntil` appears in tests that
  // look like they are only pressing a button.
  if (!historyStarted) {
    startSurfaceHistory();
    historyStarted = true;
  }
  stop = subscribe(() => renderShell(root));
  renderShell(root);
  return root;
}

/** The control the shell finds by `aria-controls`, in the real tree. */
function wizardTrigger(): HTMLButtonElement | null {
  return document.querySelector<HTMLButtonElement>(`#app [aria-controls="${WIZARD_ID}"]`);
}

function starterButtons(): HTMLButtonElement[] {
  return [...document.querySelectorAll<HTMLButtonElement>("#app .starters button")];
}

function panel(): HTMLElement {
  const found = document.getElementById(WIZARD_ID);
  if (found === null) throw new Error("the wizard is not on screen");
  return found;
}

function named(name: string): HTMLElement | undefined {
  return [...panel().querySelectorAll<HTMLElement>("button")].find(
    (control) => (control.getAttribute("aria-label") ?? control.textContent) === name,
  );
}

/** Presses a control on the wizard by its accessible name. */
function press(name: string): void {
  const control = named(name);
  if (control === undefined) {
    throw new Error(
      `no control called "${name}" on this screen. What is here: ${[
        ...panel().querySelectorAll<HTMLElement>("button"),
      ]
        .map((c) => c.getAttribute("aria-label") ?? c.textContent)
        .join(", ")}`,
    );
  }
  control.click();
}

/** Types into the wizard field with this label, the way a keyboard does. */
function type(label: string, value: string): void {
  const field = [...panel().querySelectorAll("label")].find((l) => l.textContent === label);
  if (field === undefined) throw new Error(`no field called "${label}"`);
  const control = document.getElementById(field.htmlFor);
  if (!(control instanceof HTMLInputElement)) throw new Error(`"${label}" is not a text field`);
  control.value = value;
  control.dispatchEvent(new Event("input", { bubbles: true }));
}

const tick = (): Promise<unknown> => new Promise((r) => setTimeout(r, 0));

/**
 * Waits for something to become true rather than guessing how long it takes.
 *
 * The same helper `starters-picker.test.ts` needed and for the same measured
 * reason: opening a starting point dynamically imports its document, which took
 * 30 ticks cold against 3 warm, and a fixed budget passes or fails on which
 * test in the run happened to pay the import. The ceiling is a stop rather than
 * a wait, so a condition that never comes true reaches the assertion below
 * instead of hanging until the suite times out.
 */
async function settleUntil(until: () => boolean): Promise<void> {
  for (let i = 0; i < 200 && !until(); i += 1) await tick();
}

/** Every stored page, ordered, so two snapshots can be compared as they are. */
async function stored(): Promise<StoredPage[]> {
  return [...(await listPages())].sort((a, b) => a.id.localeCompare(b.id));
}

/** A page with real content in it, opened the way the picker opens one. */
async function aPageWithContentInIt(): Promise<void> {
  const starter = STARTERS[0];
  if (starter === undefined) throw new Error("no starting points to open");
  // No `settleUntil` after this: `openBackup` is awaited and `adopt` runs
  // synchronously inside it, so the blocks are there before any poll could
  // check. A wait here would look like it was covering something asynchronous
  // and cover nothing.
  await openBackup(serializeDocument(await starter.load()));
}

beforeEach(() => {
  stop?.();
  stop = undefined;
  globalThis.indexedDB = new IDBFactory();
  // The wizard's history entry outlives a test otherwise: jsdom keeps one
  // history across the file, and `rememberWizardOpen` pushes onto it.
  history.replaceState({ surface: "build" }, "");
  resetWizardFocusTracking();
});

afterEach(() => {
  stop?.();
  stop = undefined;
});

describe("the way in", () => {
  it("offers the wizard beside the starting points, not in front of them", () => {
    // FR-128 and FR-119 in one assertion, because they are one screen. All
    // three ways to begin are on it at once, with nothing to dismiss and no
    // question answered: the wizard, the eight starting points, and the blank
    // page somebody is already looking at.
    live();

    expect(wizardTrigger()).not.toBeNull();

    // The picker, still there and still whole. "Behind the wizard" would mean
    // reaching it required opening or dismissing something, so the wizard being
    // shut is part of what is asserted rather than incidental to it.
    expect(getState().wizardOpen).toBe(false);
    expect(document.querySelectorAll("#app .starters").length).toBe(1);
    expect(starterButtons().length).toBe(STARTERS.length);

    // The blank page. On the empty state it is the document already open, so
    // what has to remain reachable is the way to put a section in it.
    expect(getState().doc.blocks).toHaveLength(0);
    expect(document.querySelectorAll("#app .adders-dock button").length).toBeGreaterThan(0);
  });

  it("takes a history entry as it opens, so the back gesture has one to spend", () => {
    // FR-133, and the half of it nothing in the app did until this trigger
    // existed. `surface-history.ts` has had `rememberWizardOpen` and the
    // `popstate` branch that consumes its entry since phase 3, and only the
    // tests called it, by hand. Build pushes no history of its own on purpose,
    // so without this pairing the first back press leaves the app rather than
    // dismissing the wizard, and no test that supplies its own entry can see
    // that.
    live();

    wizardTrigger()?.click();

    expect(getState().wizardOpen).toBe(true);
    expect(wizardOwnsHistory()).toBe(true);
  });

  it("gives focus back to the real control it was opened from", async () => {
    // The assertion phase 4 could not make and said so: its focus test supplies
    // a trigger of its own, because `render` calls `replaceChildren` on the
    // root and destroys anything a test appends to it. The shell finds the real
    // one with `root.querySelector` on `aria-controls`, and nothing proved that
    // lookup found anything until there was a control in the tree to find.
    live();

    wizardTrigger()?.click();
    expect(document.activeElement).toBe(document.getElementById(WIZARD_ID));

    press("Close setup");
    // The trigger pushed a history entry, so closing is a traversal and lands
    // on a later task. See `live`.
    await settleUntil(() => !getState().wizardOpen);

    // Not the same element: the shell rebuilds the whole surface, so the button
    // focus lands on is the newly drawn one at the same place. That it is found
    // by `aria-controls` at all is the point.
    const back = document.activeElement;
    expect(back).not.toBe(document.body);
    expect(back?.getAttribute("aria-controls")).toBe(WIZARD_ID);
    expect(document.getElementById("app")?.contains(back)).toBe(true);
  });
});

/**
 * The seam, and the reason this file exists.
 *
 * `wizard.ts` is internally correct and `openBackup` is internally correct, and
 * a review of either one alone cannot see what happens between them. FR-125 and
 * Principle V both come down to a single question: what happened to the page
 * that was already open. It is asked here as bytes.
 */
describe("a page that was already open", () => {
  /**
   * Runs the wizard as far as a store name, which is enough to have said
   * something worth losing.
   *
   * The wizard is opened directly rather than through the trigger, because the
   * trigger lives on the empty state and this is a surface with content on it.
   * That is the situation the requirement is about: somebody with work already
   * done.
   */
  function halfway(): void {
    openWizard();
    const first = STARTERS[0];
    if (first === undefined) throw new Error("no starting points to choose from");
    press(`${first.label}. ${first.description}`);
    type("Store name", "Ari's Ceramics");
  }

  it("is byte identical after the wizard is abandoned halfway", async () => {
    live();
    await aPageWithContentInIt();

    const pageId = getState().pageId;
    const before = serializeDocument(getState().doc);
    const savedBefore = await stored();

    halfway();
    press("Close setup");

    // The document on screen, unchanged, down to the bytes rather than to a
    // block count. A wizard writing into the live document would show up here
    // as a display name and nothing else.
    expect(serializeDocument(getState().doc)).toBe(before);
    expect(getState().pageId).toBe(pageId);
    // T040: the store itself, not the absence of an error. An abandoned wizard
    // must leave nothing behind, and the cheapest way to guarantee that is to
    // have written nothing at all, so this compares whole records.
    expect(await stored()).toEqual(savedBefore);
    // And the answers are gone with it, which is what makes the next run start
    // from the beginning rather than from somebody else's session.
    expect(getState().wizardAnswers).toEqual({});
  });

  it("is byte identical after the wizard finishes, with the new page opened alongside", async () => {
    live();
    await aPageWithContentInIt();

    const pageId = getState().pageId;
    const before = serializeDocument(getState().doc);
    const savedBefore = await stored();

    halfway();
    // Everything else skipped, except the picture question, which is the one
    // answer that has to survive `adopt` clearing the selection.
    press("Next");
    press("Yes");
    while (named("Make my page") === undefined) press("Skip this question");
    press("Make my page");
    // Waited on the LAST thing the finish does rather than the first. The page
    // id changes inside `adopt`, which is part way through `openBackup`, so a
    // wait on that alone would assert against a finish still in flight: the
    // dismiss, the selection and the announcement all come after it resolves.
    await settleUntil(() => !getState().wizardOpen && getState().pageId !== pageId);

    // A NEW page. FR-123: the wizard creates its page the way the picker does,
    // and the one that was open is not the one it wrote to.
    expect(getState().pageId).not.toBe(pageId);
    expect(getState().wizardOpen).toBe(false);

    // The page that was open, exactly as it was, read back out of storage
    // rather than out of memory. This is the assertion the whole seam is for.
    const savedAfter = await stored();
    expect(savedAfter.find((page) => page.id === pageId)).toEqual(
      savedBefore.find((page) => page.id === pageId),
    );
    expect(savedAfter).toHaveLength(savedBefore.length + 1);

    // What was answered reached the page, so the byte identity above is about
    // the old page rather than about a wizard that did nothing.
    const made = serializeDocument(getState().doc);
    expect(made).not.toBe(before);
    expect(made).toContain("Ari's Ceramics");

    // The picture answer survived. `adopt` sets `selectedBlockId` to undefined
    // as it opens the page, so a selection applied before that resolved would
    // be silently wiped and this answer would do nothing at all.
    // The literal kind, not `sectionToOpen`'s own rule recomputed here. This
    // starting point ships with a gallery, so "gallery" is the answer, and
    // asserting it costs nothing and actually discriminates between the two
    // branches rather than agreeing with whichever one ran.
    const open = getState().doc.blocks.find((block) => block.id === getState().selectedBlockId);
    expect([open === undefined, open?.kind]).toEqual([false, "gallery"]);
  });

  it("says what it made, in the wizard's words rather than the import's", async () => {
    live();
    const pageId = getState().pageId;

    openWizard();
    while (named("Make my page") === undefined) press("Skip this question");
    press("Make my page");
    await settleUntil(
      () => (document.getElementById("live-region")?.textContent ?? "") !== "",
    );

    const said = document.getElementById("live-region")?.textContent ?? "";
    // FR-127: answering nothing still produces a usable page, and the sentence
    // that reports it must not be `openBackup`'s, which talks about a backup
    // somebody chose off their device.
    expect(said).toContain("Made your page from");
    expect(said).not.toContain("backup");
    expect(getState().pageId).not.toBe(pageId);
    expect(getState().doc.blocks.length).toBeGreaterThan(0);
  });
  it("makes one page when the button is pressed twice, and spends one history entry", async () => {
    // The chunk 5 spec review found this and corrected the reasoning written
    // beside the code, which claimed the worst a double press could do was
    // leave a spare page. It is worse than that.
    //
    // Both presses land before the first finishes, because the work is a
    // dynamic import and an IndexedDB write and the button is rebuilt enabled
    // by the `setBusy` repaint. Each chain then calls `dismissWizard`, which
    // goes through `history.back()`, which is asynchronous. The second chain
    // still sees `wizardOwnsHistory()` as true, so TWO backs are queued: the
    // first spends the wizard's entry and the second spends the one underneath
    // it. On Build there is nothing underneath by design, so the second back
    // leaves the app.
    live();
    const pageId = getState().pageId;
    const before = await stored();

    // Opened through the REAL trigger, not `openWizard()`. That distinction is
    // the whole test: only the trigger calls `rememberWizardOpen`, and without
    // an entry of its own `dismissWizard` never reaches `history.back()`, so
    // the history assertion below could not fail no matter what the code did.
    // It was written that way first and caught in review.
    wizardTrigger()?.click();
    for (let i = 0; i < QUESTION_COUNT; i += 1) press("Skip this question");
    press("Make my page");
    press("Make my page");
    await settleUntil(() => !getState().wizardOpen && getState().pageId !== pageId);
    await tick();

    // One page, not two. This is the assertion that discriminates: without the
    // guard it reads two, which was checked by removing the guard.
    expect(await stored()).toHaveLength(before.length + 1);

    // THE WORSE HALF OF THIS CANNOT BE ASSERTED HERE, and a first version of
    // this test pretended otherwise with `expect(history.state).not.toBeNull()`.
    // That could not fail. jsdom clamps `history.back()` at the first entry
    // instead of leaving anything, so the second back is a silent no-op and the
    // state stays exactly as it was, guard or no guard. Removing the guard and
    // watching that line still pass is how it was caught.
    //
    // What the second back really does is spend the entry belonging to the
    // surface underneath, and on Build there is nothing underneath, so a real
    // WebView finishes the activity. That is a handset check, T052, and it is
    // named in `quickstart.md` rather than pretended at here.
  });

  it("keeps the wizard on screen when the page could not be made", async () => {
    // The invariant the finish docblock states most loudly, pinned by nothing
    // until now: the dismiss happens only in the success branch. Move
    // `dismissWizard()` above the `if (!ok)` and every other test in this file
    // stays green, which is exactly the shape of gap this project keeps
    // finding.
    //
    // A failure is forced at the lazy import, which is the real offline case
    // rather than a contrived one: `load()` is a dynamic import of a chunk that
    // has to be fetched.
    live();
    const pageId = getState().pageId;
    const before = await stored();

    const starter = STARTERS.find((one) => one.id === DEFAULT_STARTER_ID);
    if (starter === undefined) throw new Error("no default starting point");
    const load = vi.spyOn(starter, "load").mockRejectedValue(new Error("offline"));

    try {
      openWizard();
      while (named("Make my page") === undefined) press("Skip this question");
      press("Make my page");
      await settleUntil(
        () => (document.getElementById("live-region")?.textContent ?? "").includes("could not"),
      );

      // Still there, with the message on a screen that still explains it.
      expect(getState().wizardOpen).toBe(true);
      expect(getState().pageId).toBe(pageId);
      expect(await stored()).toEqual(before);
      expect(document.getElementById("live-region")?.textContent ?? "").toContain(
        "Nothing has been changed",
      );
    } finally {
      load.mockRestore();
    }
  });

  it("puts focus into the page it just made, not on the body", async () => {
    // The finish path's half of T033. The close path is proved above, and this
    // one was not: the trigger lives on the empty state, and a finished wizard
    // has just filled that empty state with a page, so the control the shell
    // looks for by `aria-controls` no longer exists and `syncWizardFocus` calls
    // `focus` on nothing. A keyboard or switch user answered six questions and
    // landed at the top of a document they have never seen.
    //
    // The comment at the trigger in `build.ts` used to claim this contract
    // outright, which is what made the gap a defect rather than a wish: it was
    // true of the close and untrue of the finish. That comment was corrected in
    // the same change as this test.
    live();
    const pageId = getState().pageId;

    openWizard();
    press(`${STARTERS[0]?.label ?? ""}. ${STARTERS[0]?.description ?? ""}`);
    press("Next");
    press("Yes");
    while (named("Make my page") === undefined) press("Skip this question");
    press("Make my page");
    await settleUntil(() => !getState().wizardOpen && getState().pageId !== pageId);
    await tick();

    const landed = document.activeElement;
    expect(landed).not.toBe(document.body);
    // On the section the picture answer opened, which is the whole of what that
    // answer does. Somebody who said yes should be looking at the picture
    // field, and "looking at" is focus for anybody not using their eyes.
    expect(document.getElementById("app")?.contains(landed)).toBe(true);
    expect(landed?.getAttribute("aria-controls")).toBe(`editor-${getState().selectedBlockId ?? ""}`);
  });
});
