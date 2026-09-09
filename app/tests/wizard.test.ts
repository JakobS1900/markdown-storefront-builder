/**
 * @vitest-environment jsdom
 *
 * The wizard's surface: the layer, the six questions, and the ways out.
 *
 * This is the half of feature 027 that has a DOM. Everything it can be tested
 * for here is about what is on screen and what a keyboard can reach; every
 * decision about what the answers MEAN lives in `wizard-answers.ts` and is
 * tested with no jsdom at all. If an assertion in this file starts caring which
 * starting point an answer chooses, it belongs in the other file.
 *
 * The tests that matter most are the ones covering what `showModal()` would
 * normally guarantee. jsdom has neither `showModal` nor `inert`, proven by
 * probe in feature 025 and recorded in `research.md` R1, so the focus trap, the
 * escape and the backdrop are ours and each one is asserted here.
 *
 * The back gesture is asserted by dispatching `popstate` rather than by calling
 * `history.back()`, for the reason `pages-sidebar.test.ts` gives: jsdom's
 * history is a model rather than a browser, and the timing of a real back is
 * not something a test here can observe honestly. The gesture itself is
 * verified on the handset.
 */
import { SELLING_MODE_WORDS } from "@mdsb/engine";
import { beforeEach, describe, expect, it } from "vitest";

import {
  answerWizard,
  closeWizard,
  getState,
  init,
  openWizard,
  setSurface,
  setWizardStep,
  subscribe,
} from "../src/store.js";
import { STARTERS } from "../src/starters/index.js";
import {
  dismissWizard,
  rememberWizardOpen,
  startSurfaceHistory,
  wizardOwnsHistory,
} from "../src/surface-history.js";
import { renderShell } from "../src/ui/shell.js";
import {
  QUESTION_COUNT,
  WIZARD_ID,
  resetWizardFocusTracking,
  sectionToOpen,
  syncWizardFocus,
} from "../src/ui/wizard.js";
import { DEFAULT_STARTER_ID } from "../src/ui/wizard-answers.js";

function shell(): HTMLElement {
  const host = document.createElement("div");
  host.id = "app";
  document.body.replaceChildren(host);
  renderShell(host);
  return host;
}

function panel(): HTMLElement {
  const found = document.getElementById(WIZARD_ID);
  if (found === null) throw new Error("the wizard is not on screen");
  return found;
}

/** Every control on the question showing, by the name a person would hear. */
function controls(): HTMLElement[] {
  return [...panel().querySelectorAll<HTMLElement>("button")];
}

function named(name: string): HTMLElement | undefined {
  return controls().find(
    (control) => (control.getAttribute("aria-label") ?? control.textContent) === name,
  );
}

/** Presses a control by its accessible name, and says so when there is none. */
function press(name: string): void {
  const control = named(name);
  if (control === undefined) {
    throw new Error(
      `no control called "${name}" on this screen. What is here: ${controls()
        .map((c) => c.getAttribute("aria-label") ?? c.textContent)
        .join(", ")}`,
    );
  }
  control.click();
}

/** Types into the field with this label, the way a person's keyboard does. */
function type(label: string, value: string): void {
  const field = [...panel().querySelectorAll("label")].find((l) => l.textContent === label);
  if (field === null || field === undefined) throw new Error(`no field called "${label}"`);
  const control = document.getElementById(field.htmlFor);
  if (!(control instanceof HTMLInputElement)) throw new Error(`"${label}" is not a text field`);
  control.value = value;
  control.dispatchEvent(new Event("input", { bubbles: true }));
}

function valueOf(label: string): string {
  const field = [...panel().querySelectorAll("label")].find((l) => l.textContent === label);
  if (field === null || field === undefined) throw new Error(`no field called "${label}"`);
  const control = document.getElementById(field.htmlFor);
  if (!(control instanceof HTMLInputElement)) throw new Error(`"${label}" is not a text field`);
  return control.value;
}

/** The label on the store name field, which is not the heading above it. */
const STORE_NAME = "Store name";

describe("the wizard's own state", () => {
  beforeEach(() => {
    init(true);
  });

  it("starts closed, on the first question, with nothing answered", () => {
    expect([getState().wizardOpen, getState().wizardStep, getState().wizardAnswers]).toEqual([
      false,
      0,
      {},
    ]);
  });

  it("repaints immediately, not on the deferred repaint", () => {
    // The same reasoning as `openSidebar`. The deferred path waits 200ms of
    // quiet, and a surface that appears a fifth of a second after the press
    // reads as a press that needs repeating.
    let notified = 0;
    const stop = subscribe(() => {
      notified += 1;
    });

    openWizard();
    expect(notified).toBe(1);

    setWizardStep(1);
    expect(notified).toBe(2);

    answerWizard({ storeName: "Ari's Ceramics" });
    expect(notified).toBe(3);

    closeWizard();
    expect(notified).toBe(4);

    stop();
  });

  it("closing an already closed wizard changes nothing", () => {
    let notified = 0;
    const stop = subscribe(() => {
      notified += 1;
    });

    closeWizard();
    expect(notified).toBe(0);

    stop();
  });

  it("forgets the answers when it closes", () => {
    // Nothing was created, so there is nothing to come back to. `data-model.md`
    // makes this the whole storage story for the feature: never written, so an
    // abandoned wizard cannot leave anything behind.
    openWizard();
    answerWizard({ storeName: "Ari's Ceramics" });
    closeWizard();

    expect([getState().wizardAnswers, getState().wizardStep]).toEqual([{}, 0]);
  });
});

describe("the layer", () => {
  beforeEach(() => {
    init(true);
    resetWizardFocusTracking();
  });

  it("is absent entirely until it is opened", () => {
    // Not hidden. Absent. The shell rebuilds its whole interface on every
    // keystroke, and a rebuild measured 37ms on a Moto G7.
    const host = shell();
    expect(host.querySelector(".wizard")).toBeNull();
    expect(host.querySelector(`#${WIZARD_ID}`)).toBeNull();
  });

  it("is a div carrying the dialog role, never an aside", () => {
    // `aria-allowed-role` fails an `aside` with `role="dialog"` and the a11y
    // gate catches it. Feature 025 paid for this finding.
    openWizard();
    shell();

    expect(panel().tagName).toBe("DIV");
    expect(panel().getAttribute("role")).toBe("dialog");
    expect(panel().getAttribute("aria-modal")).toBe("true");
    expect(panel().getAttribute("tabindex")).toBe("-1");
    expect(panel().getAttribute("aria-label")).not.toBe(null);
    expect(panel().getAttribute("aria-label")).not.toBe("");
  });

  it("marks the rest of the app inert while it is open", () => {
    // The attribute is what a browser acts on. jsdom implements `inert` neither
    // as a property nor as behaviour, so this asserts only that the word is
    // applied. The guarantee that is actually TESTED is the focus containment
    // below, which is why both exist.
    openWizard();
    const host = shell();
    for (const selector of ["header.bar", "main", "nav.tabs"]) {
      expect([selector, host.querySelector(selector)?.hasAttribute("inert")]).toEqual([
        selector,
        true,
      ]);
    }
  });

  it("leaves nothing inert once it closes", () => {
    openWizard();
    shell();
    closeWizard();
    const host = shell();
    for (const selector of ["header.bar", "main", "nav.tabs"]) {
      expect([selector, host.querySelector(selector)?.hasAttribute("inert")]).toEqual([
        selector,
        false,
      ]);
    }
  });

  it("never transforms the app root", () => {
    // The transform rule, asserted rather than left to a comment. `.tabs` is
    // `position: fixed`, and a transform on any ancestor containing it makes
    // that ancestor its containing block. Only the panel is transformed.
    openWizard();
    const host = shell();
    expect(host.style.transform).toBe("");
    expect(host.getAttribute("style") ?? "").not.toContain("transform");
  });
});

describe("one question at a time", () => {
  beforeEach(() => {
    init(true);
    resetWizardFocusTracking();
  });

  it("asks six questions, from the seven things it can be told", () => {
    // Six screens for seven answers: the item and its price are asked together,
    // because an item without its price is half an answer.
    expect(QUESTION_COUNT).toBe(6);
  });

  it("puts exactly one question on the screen at a time", () => {
    openWizard();
    const headings: string[] = [];

    for (let step = 0; step <= QUESTION_COUNT; step += 1) {
      setWizardStep(step);
      shell();
      const asked = panel().querySelectorAll("h2");
      expect([step, asked.length]).toEqual([step, 1]);
      headings.push(asked[0]?.textContent ?? "");
    }

    // Every screen asks a different thing. A copy-pasted heading would pass a
    // count and fail a person.
    expect(new Set(headings).size).toBe(headings.length);
  });

  it("takes the selling mode's words from the engine, not from a copy of them", () => {
    // FR-124. The word somebody picks here is the word their page prints, and
    // the only way to guarantee that is to read the same map the emitter does.
    openWizard();
    setWizardStep(4);
    shell();

    for (const word of Object.values(SELLING_MODE_WORDS)) {
      expect([word, named(word) !== undefined]).toEqual([word, true]);
    }
  });

  it("reaches the finish in at most seven screens without typing anything", () => {
    // SC-002, and FR-120's bound. Nothing counted this before.
    openWizard();
    shell();

    let seen = 1;
    while (named("Make my page") === undefined) {
      press("Skip this question");
      shell();
      seen += 1;
      if (seen > 10) throw new Error("the wizard never reached a finish");
    }

    expect(seen).toBeLessThanOrEqual(7);
    expect(seen).toBe(QUESTION_COUNT + 1);
    // FR-127: skipping everything answers nothing, and the finish is still
    // there to be pressed.
    expect(getState().wizardAnswers).toEqual({});
  });

  it("keeps an answer when the question is walked back to", () => {
    // FR-126. Somebody who goes back to check what they typed must find it
    // there, not a blank field asking them to type it again.
    openWizard();
    setWizardStep(1);
    shell();

    type(STORE_NAME, "Ari's Ceramics");
    press("Next");
    shell();
    press("Back");
    shell();

    expect(valueOf(STORE_NAME)).toBe("Ari's Ceramics");
    expect(getState().wizardAnswers.storeName).toBe("Ari's Ceramics");
  });

  it("skipping a question forgets what was said, and moves on regardless", () => {
    // FR-120. Skip is not another Next: it is the answer being taken back, so
    // the starting point's own content stands.
    openWizard();
    setWizardStep(1);
    shell();

    type(STORE_NAME, "Ari's Ceramics");
    press("Skip this question");
    shell();

    expect(getState().wizardAnswers.storeName).toBe(undefined);
    expect(getState().wizardStep).toBe(2);
  });

  it("offers no way back from the first question, because there is nothing behind it", () => {
    openWizard();
    shell();
    expect(named("Back")).toBe(undefined);
  });

  it("shows a chosen answer as chosen when the question is walked back to", () => {
    // FR-126 for the four screens that are choices rather than fields. Walking
    // back to a text field shows what was typed because the value is in the
    // store; walking back to a choice shows nothing at all unless the pressed
    // state is wired to the same answer. Only the typing half was covered.
    openWizard();
    shell();

    const mine = STARTERS[0];
    if (mine === undefined) throw new Error("no starting points to choose from");
    const label = `${mine.label}. ${mine.description}`;

    press(label);
    shell();
    press("Back");
    shell();

    expect(named(label)?.getAttribute("aria-pressed")).toBe("true");
  });
});

describe("the picture answer", () => {
  beforeEach(() => {
    init(true);
    resetWizardFocusTracking();
  });

  /** The starting point with that id, loaded the way the picker loads it. */
  async function starterNamed(id: string) {
    const found = STARTERS.find((s) => s.id === id);
    if (found === undefined) throw new Error(`there is no starting point called "${id}"`);
    return found.load();
  }

  it("is recorded, and decides which section the page opens with", async () => {
    const starter = await starterNamed(DEFAULT_STARTER_ID);
    openWizard();
    setWizardStep(2);
    shell();

    press("Yes");

    expect(getState().wizardAnswers.wantsPicture).toBe(true);
    const chosen = sectionToOpen(starter, getState().wizardAnswers);
    expect(starter.blocks.find((block) => block.id === chosen)?.kind).toBe("gallery");
  });

  it("chooses a real picture field on every one of the eight, not just the three with a gallery", async () => {
    // The defect the chunk 4 spec review found. This returned the constant
    // "gallery" and five of the eight starting points do not have one, so for
    // those five the answer was quietly dropped while the screen promised it
    // decided something. Asserting per starting point rather than in aggregate,
    // so a failure names the one that broke.
    for (const starter of STARTERS) {
      const doc = await starter.load();
      const chosen = sectionToOpen(doc, { wantsPicture: true });
      const block = doc.blocks.find((b) => b.id === chosen);
      // A gallery holds as many pictures as somebody wants; a profile holds the
      // one at the top through `avatarUrl`. Either is a picture field. Nothing
      // else is, and `undefined` here is the answer going nowhere.
      expect([starter.id, block?.kind]).toEqual([
        starter.id,
        doc.blocks.some((b) => b.kind === "gallery") ? "gallery" : "profile",
      ]);
    }
  });

  it("chooses nothing when it was not asked for", async () => {
    const starter = await starterNamed(DEFAULT_STARTER_ID);
    expect(sectionToOpen(starter, {})).toBe(undefined);
    expect(sectionToOpen(starter, { wantsPicture: false })).toBe(undefined);
  });

  // The other half of T029b, that two pages differing only in this answer are
  // byte identical, is asserted in `wizard-answers.test.ts` under "whether they
  // want a picture", and in a stronger form: against a full answer set rather
  // than an otherwise empty one. It was briefly duplicated here, which broke
  // this file's own rule at the top. An assertion about what an answer does to
  // a document belongs in the file that has no DOM in it.
});

/**
 * Everything `showModal()` would have done, done by hand.
 *
 * `inert` is set on the rest of the app and jsdom implements none of its
 * behaviour, so the containment below is the only thing standing between a
 * keyboard user and a page they cannot see.
 */
describe("the wizard holds on to the keyboard", () => {
  beforeEach(() => {
    init(true);
    resetWizardFocusTracking();
  });

  function stops(): HTMLElement[] {
    return [
      ...document.querySelectorAll<HTMLElement>(
        `#${WIZARD_ID} a[href], #${WIZARD_ID} button:not([disabled]), #${WIZARD_ID} input:not([disabled]), #${WIZARD_ID} summary, #${WIZARD_ID} [tabindex]:not([tabindex="-1"])`,
      ),
    ];
  }

  it("moves focus into the panel when it opens", () => {
    shell();
    openWizard();
    shell();
    expect(document.activeElement).toBe(document.getElementById(WIZARD_ID));
  });

  it("never lets focus fall out to the body across a repaint", () => {
    // The shell rebuilds its whole interface on any state change, which
    // destroys whatever control was focused. Focus then lands on the body, and
    // tab from the body walks straight into the page behind the wizard.
    openWizard();
    shell();
    stops()[0]?.focus();

    shell();
    expect(document.activeElement).not.toBe(document.body);
    expect(panel().contains(document.activeElement)).toBe(true);
  });

  it("gives focus back to the control that opened it", () => {
    // The shell finds that control by `aria-controls`, and Phase 5 is what
    // draws one, in the empty state beside the starting point picker. The
    // trigger is supplied here so the restore itself is proved now rather than
    // waiting on the screen that will carry it.
    openWizard();
    shell();

    const trigger = document.createElement("button");
    trigger.setAttribute("aria-controls", WIZARD_ID);
    document.body.append(trigger);

    syncWizardFocus(false, trigger);
    expect(document.activeElement).toBe(trigger);
  });

  it("wraps from the last control back to the first", () => {
    openWizard();
    shell();
    const all = stops();
    const first = all[0];
    const last = all[all.length - 1];
    if (first === undefined || last === undefined) throw new Error("nothing to tab between");

    last.focus();
    panel().dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));

    expect(document.activeElement).toBe(first);
  });

  it("wraps backwards from the first control to the last", () => {
    openWizard();
    shell();
    const all = stops();
    const first = all[0];
    const last = all[all.length - 1];
    if (first === undefined || last === undefined) throw new Error("nothing to tab between");

    first.focus();
    panel().dispatchEvent(
      new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true }),
    );

    expect(document.activeElement).toBe(last);
  });

  it("closes on escape", () => {
    openWizard();
    shell();
    panel().dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

    expect(getState().wizardOpen).toBe(false);
  });

  it("really leaves the screen on escape from inside a text field", async () => {
    // THE ONE TEST IN THIS FILE THAT CROSSES THE STORE'S REPAINT DEFERRAL, and
    // it exists because every other test here drives `renderShell` by hand and
    // therefore cannot see the defect it was written for.
    //
    // `repaint` refuses to paint while a text field holds focus and reschedules
    // itself every 200ms until that stops being true. A pointer press blurs the
    // field on the way in, so every other way out of this layer is safe.
    // Escape does not blur anything. So escaping out of the store name field
    // set `wizardOpen` to false and then deferred the repaint forever: the
    // panel stayed on screen, fully interactive, against a store that said it
    // was closed, and typing into it refilled the answers of a wizard somebody
    // had already escaped out of.
    //
    // Subscribed the way `main.ts` subscribes it, because the bug lives in the
    // path between a state change and a paint, and a test that calls the
    // renderer itself has stepped over exactly that path.
    const host = document.createElement("div");
    host.id = "app";
    document.body.replaceChildren(host);
    const stop = subscribe(() => renderShell(host));
    renderShell(host);

    try {
      openWizard();
      setWizardStep(1);

      const control = document.getElementById(
        [...panel().querySelectorAll("label")].find((l) => l.textContent === STORE_NAME)?.htmlFor ??
          "",
      );
      if (!(control instanceof HTMLInputElement)) throw new Error("no store name field");
      control.focus();
      control.value = "Ari's Ceramics";
      control.dispatchEvent(new Event("input", { bubbles: true }));

      panel().dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

      // The store is only half the answer, and it was the half that already
      // passed while the panel sat there.
      expect(getState().wizardOpen).toBe(false);
      expect(document.getElementById(WIZARD_ID)).toBeNull();
    } finally {
      stop();
    }
  });

  it("closes when the backdrop is tapped", () => {
    openWizard();
    const host = shell();
    host.querySelector<HTMLElement>(".wizard-backdrop")?.click();

    expect(getState().wizardOpen).toBe(false);
  });

  it("closes from its own close control", () => {
    openWizard();
    shell();
    press("Close setup");

    expect(getState().wizardOpen).toBe(false);
  });
});

/**
 * The back gesture.
 *
 * `startSurfaceHistory` adds a `popstate` listener per test and offers no way
 * to remove one, so the listeners accumulate across this block and every test
 * that dispatches a `popstate` runs all of the handlers added before it. That
 * is harmless while they are identical and read the same store, which `init`
 * resets each time, and it is worth knowing before a future test reads a
 * counter instead of a state.
 */
describe("the system back gesture", () => {
  beforeEach(() => {
    init(true);
    startSurfaceHistory();
  });

  it("dismisses the wizard rather than changing surface", () => {
    // FR-133. Back with the wizard up should put the wizard away, which is what
    // the seller is looking at, not navigate underneath it.
    setSurface("export");
    openWizard();

    window.dispatchEvent(new PopStateEvent("popstate", { state: null }));

    expect(getState().wizardOpen).toBe(false);
    expect(getState().surface).toBe("export");
  });

  it("gives back something to consume when the wizard opens", () => {
    // Without an entry of its own, back on Build leaves the app before any
    // popstate fires, because Build deliberately pushes nothing.
    rememberWizardOpen();
    expect(wizardOwnsHistory()).toBe(true);
  });

  it("carries the current surface on that entry", () => {
    setSurface("export");
    history.replaceState({ surface: "export" }, "");

    rememberWizardOpen();
    expect((history.state as { surface?: string }).surface).toBe("export");
  });

  it("closes directly when it never took a history entry", () => {
    // Opened from a test, or from anywhere that did not push. `dismissWizard`
    // must still work rather than consuming somebody else's entry.
    history.replaceState({ surface: "build" }, "");
    openWizard();

    dismissWizard();

    expect(getState().wizardOpen).toBe(false);
  });
});
