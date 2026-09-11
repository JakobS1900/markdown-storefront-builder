/**
 * @vitest-environment jsdom
 *
 * The accessibility gate. Constitution Principle VI.
 *
 * This is the gate `scripts/a11y.mjs` promised would become enforcing at
 * roadmap 2.2, written to fail loudly rather than to be remembered later.
 *
 * axe catches what a machine can catch. The assertions after it cover the
 * things a machine reliably cannot: that every control has a real accessible
 * name rather than a plausible-looking one, that the touch target minimum is
 * actually met, and that nothing depends on a pointing device.
 */
import "fake-indexeddb/auto";
import axe from "axe-core";
import { IDBFactory } from "fake-indexeddb";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Whether this build has an Imgur Client-ID is mocked rather than inherited.
 *
 * It decides whether the upload control exists at all, so it decides what this
 * gate is even looking at. Left to the environment it came from .env.local,
 * which meant CI and a contributor's machine checked different DOMs, and an
 * unlabelled file input sat in the shipped build for weeks because the gate
 * that would have caught it never rendered the control.
 *
 * Default true, so the assertions below see the larger of the two UIs. The
 * build that actually ships has no key, and axe is run against that shape too.
 */
const mocks = vi.hoisted(() => ({ uploads: true }));

vi.mock("../src/upload.js", () => ({
  uploadConfigured: () => mocks.uploads,
  uploadImage: vi.fn(),
  // `assets.ts` imports this from the same module, and a mock missing a named
  // export fails at link time rather than when something calls it.
  normalise: vi.fn(),
}));

import { writePage } from "../src/db.js";
import {
  addBlock,
  closeWizard,
  getState,
  init,
  openSidebar,
  refreshPages,
  selectBlock,
  selectTiers,
  setPasteText,
  setSurface,
  startPasting,
  updateBlock,
} from "../src/store.js";
import { blankBlock } from "../src/ui/forms.js";
import { renderShell } from "../src/ui/shell.js";
import { QUESTION_COUNT, WIZARD_ID, resetWizardFocusTracking } from "../src/ui/wizard.js";

/**
 * Reads the stylesheet from disk.
 *
 * Resolved from the working directory rather than from `import.meta.url`: under
 * jsdom the module URL is not a file URL, so `fileURLToPath` refuses it.
 */
async function stylesheet(): Promise<string> {
  const { readFileSync } = await import("node:fs");
  return readFileSync("app/src/styles.css", "utf8");
}

function mount(): HTMLElement {
  document.body.innerHTML =
    '<a class="skip" href="#surface">Skip to the editor</a><div id="app"></div>' +
    '<div id="live-region" class="sr-only" role="status" aria-live="polite"></div>';
  const root = document.getElementById("app");
  if (root === null) throw new Error("missing #app");
  return root;
}

/**
 * The name a person actually hears, which for a glyph is never its text.
 *
 * `aria-label` first, because a control that has one has one for a reason: the
 * close controls in this app draw a "×" and nothing else, and their text passes
 * a length check while saying nothing at all read aloud.
 *
 * Hoisted here rather than repeated. This expression was written out five times
 * in this file before the wizard block made it six, and the copies had already
 * drifted: two of them omit the trim, one omits the text fallback entirely, and
 * those are left where they are because each is doing something slightly
 * different on purpose and changing them is not this helper's business.
 */
function nameOf(control: Element): string {
  return (control.getAttribute("aria-label") ?? control.textContent ?? "").trim();
}

async function violations(): Promise<axe.Result[]> {
  const results = await axe.run(document.body, {
    // Colour contrast needs real layout and computed styles, which jsdom does
    // not provide. Asserting it here would produce a result that means nothing.
    // It is covered by the manual pass in docs/WORKFLOW.md instead, and that
    // limitation is stated rather than hidden behind a green test.
    rules: { "color-contrast": { enabled: false } },
  });
  return results.violations;
}

describe("the shell is accessible", () => {
  beforeEach(() => {
    init(true);
  });

  it("has no axe violations when empty", async () => {
    renderShell(mount());
    const found = await violations();
    expect(found.map((v) => `${v.id}: ${v.nodes.length} node(s)`)).toEqual([]);
  });

  it("has no axe violations with every section type present", async () => {
    const root = mount();
    for (const kind of ["profile", "menu", "gallery", "prose", "heading", "divider"] as const) {
      addBlock(blankBlock(kind));
    }
    renderShell(root);
    expect((await violations()).map((v) => v.id)).toEqual([]);
  });

  it("has no axe violations with a section open for editing", async () => {
    const root = mount();
    addBlock(blankBlock("menu"));
    selectBlock(getState().doc.blocks[0]?.id);
    renderShell(root);
    expect((await violations()).map((v) => v.id)).toEqual([]);
  });

  it("has no axe violations with the formatting buttons on screen", async () => {
    // Feature 028. The text section is the only one that draws them, so the
    // test above, which opens a Prices section, never sees them.
    const root = mount();
    addBlock(blankBlock("prose"));
    selectBlock(getState().doc.blocks[0]?.id);
    renderShell(root);

    // DEMANDED, NOT ASSUMED. SC-028-7, and the fourth time this project has
    // written a guard like this: a gate that measures less does not say so. If
    // the bar ever stops rendering, this fails instead of quietly auditing a
    // page with six fewer controls on it and reporting a pass.
    const bar = document.querySelector("#surface .format-bar");
    expect(bar, "the formatting bar must be on screen for this to mean anything").not.toBeNull();
    const buttons = [...(bar?.querySelectorAll("button") ?? [])];
    expect(buttons).toHaveLength(6);
    for (const node of buttons) {
      // A real accessible name, not a plausible looking one: the glyph alone
      // reads aloud as a letter and says nothing about what the button does.
      const name = node.getAttribute("aria-label") ?? "";
      expect(name.length).toBeGreaterThan(4);
      expect(name).not.toBe(node.textContent);
      expect(node.getAttribute("type")).toBe("button");
    }

    expect((await violations()).map((v) => v.id)).toEqual([]);
  });

  it("has no axe violations with a row's More details fold open", async () => {
    // A blank row keeps that fold shut, and axe skips what is hidden, so every
    // control inside it was going unscanned by the gate above: the cost, the
    // unit, the quantity breakdown, the details, and now the two selling mode
    // controls. This opens it the way the form itself does, by giving the row
    // something to show.
    const root = mount();
    addBlock(blankBlock("menu"));
    const block = getState().doc.blocks[0];
    if (block === undefined || block.kind !== "menu") throw new Error("not a menu");
    updateBlock(block.id, {
      ...block,
      tiers: [
        {
          id: "sign",
          name: "Carved sign",
          price: "80",
          availability: "made-to-order",
          leadTime: "about 2 weeks",
        },
      ],
    });
    selectBlock(block.id);
    renderShell(root);

    // The gate is worthless if the fold turned out to be shut anyway.
    expect(document.querySelector("fieldset.item details.more")?.hasAttribute("open")).toBe(true);
    expect((await violations()).map((v) => v.id)).toEqual([]);
  });

  it("has no axe violations with the bulk pricing Apply panel open", async () => {
    // bulkPricingPanel returns nothing until a tier is selected, so a gate
    // that never selects one never renders the panel's three controls, its
    // role="group" wrapper, or its preview and skipped lists. This file's own
    // docstring already names this exact failure: "an unlabelled file input
    // sat in the shipped build for weeks because the gate was green on a
    // control it had never rendered."
    const root = mount();
    addBlock(blankBlock("menu"));
    const seeded = getState().doc.blocks[0];
    if (seeded === undefined || seeded.kind !== "menu") throw new Error("not a menu");
    // Two rows, because the selection controls and the panel with them only
    // appear once there is a choice between rows: it is bulk pricing, and one
    // row is not bulk. `blankBlock` seeds exactly one, so a gate built on it
    // alone would render none of what this is here to audit, which is the
    // failure this test's own comment is about.
    updateBlock(seeded.id, {
      ...seeded,
      tiers: [
        { id: "t0", name: "Bust", price: "40" },
        { id: "t1", name: "Half body", price: "80" },
      ],
    });
    const block = getState().doc.blocks[0];
    if (block === undefined || block.kind !== "menu") throw new Error("not a menu");
    selectBlock(block.id);
    selectTiers(
      block.id,
      block.tiers.map((tier) => tier.id),
    );
    renderShell(root);

    expect(document.querySelector('[aria-label="Apply pricing"]')).not.toBeNull();
    expect((await violations()).map((v) => v.id)).toEqual([]);
  });

  it("has no axe violations with the paste a price list panel open", async () => {
    // Same failure as the Apply panel above, and FR-067 claims this gate
    // enforces the feature's accessibility. It could not: `pastePanel` returns
    // nothing until `startPasting`, and its body renders nothing until there
    // is text, so a gate that does neither never sees the textarea, the
    // checkboxes, the Add button, or the hidden file picker that has to stay
    // out of the tab order.
    const root = mount();
    addBlock(blankBlock("menu"));
    const block = getState().doc.blocks[0];
    if (block === undefined || block.kind !== "menu") throw new Error("not a menu");
    selectBlock(block.id);
    startPasting(block.id);
    setPasteText("COMMISSIONS\nSketch, 30\nFull colour, 80\n\n| --- |");
    renderShell(root);

    expect(document.querySelector('[aria-label="Paste a price list"]')).not.toBeNull();
    expect(document.querySelectorAll(".paste-lines input[type=checkbox]").length).toBeGreaterThan(0);
    expect((await violations()).map((v) => v.id)).toEqual([]);
  });

  it("has no axe violations in the build that actually ships, which has no uploading", async () => {
    // The published site carries no Imgur Client-ID, so this is the DOM real
    // artists meet. Checking only the richer build would leave the common one
    // unexamined, which is how the upload control went unchecked to begin with.
    mocks.uploads = false;
    try {
      const root = mount();
      addBlock(blankBlock("profile"));
      addBlock(blankBlock("gallery"));
      selectBlock(getState().doc.blocks[0]?.id);
      renderShell(root);
      expect((await violations()).map((v) => v.id)).toEqual([]);
      // The Imgur picker, and only that one. The device picture control below
      // it has its own picker and is present in every build, deliberately: it
      // needs no key and no service, which is the whole point of it.
      expect(document.querySelector("input[type=file]:not([id$='-device-file'])")).toBeNull();
      expect(document.querySelector("input[type=file][id$='-device-file']")).not.toBeNull();
    } finally {
      mocks.uploads = true;
    }
  });
});

describe("the page switcher is accessible", () => {
  /**
   * Rendered through the real path, not assembled by hand.
   *
   * The switcher only exists when storage holds a page other than the one on
   * screen, so a gate that boots the app and looks would never see it. That is
   * exactly how an unlabelled file input shipped for weeks: the gate was green
   * on a control it had never rendered. So this seeds two pages into
   * fake-indexeddb and lets the app decide what to draw.
   */
  beforeEach(async () => {
    globalThis.indexedDB = new IDBFactory();
    init(true, undefined, "mine");
    for (const [id, title, updatedAt] of [
      ["mine", "Commissions", 2000],
      ["backup", "Untitled page", 1000],
    ] as const) {
      await writePage({ id, json: '{"schemaVersion":1,"target":"rentry","blocks":[]}', title, updatedAt });
    }
    await refreshPages();
  });

  /**
   * Showing, because a panel that is not built is content axe cannot see.
   *
   * It used to be a folded `details` that this unfolded. It is a drawer now,
   * absent from the document entirely until it is opened, so this opens it and
   * renders rather than reaching for a node and setting a property. That is a
   * state the gate had never seen before feature 025 and it is the state where
   * the interface is at its most unusual: a modal region over an inert page.
   */
  function open(root: HTMLElement): void {
    openSidebar();
    renderShell(root);
    if (document.querySelector(".pages-panel") === null) {
      throw new Error("the switcher did not render");
    }
  }

  it("has no axe violations with the switcher open", async () => {
    open(mount());
    expect((await violations()).map((v) => v.id)).toEqual([]);
  });

  it("names every entry, and names them differently from each other", () => {
    open(mount());

    const names = [...document.querySelectorAll(".pages li > :first-child")].map(nameOf);
    expect(names).toHaveLength(2);
    for (const name of names) expect(name).not.toBe("");
    expect(new Set(names).size).toBe(names.length);
  });

  it("marks the open page rather than offering to open it again", () => {
    open(mount());

    expect(document.querySelectorAll('.pages [aria-current="page"]')).toHaveLength(1);
    expect(document.querySelectorAll(".pages li > button:first-child")).toHaveLength(1);
  });

  it("names the remove control after the page it removes", () => {
    // "Remove" repeated down a list is not an answerable question read aloud,
    // and the glyph alone is nothing at all.
    open(mount());

    const remove = [...document.querySelectorAll(".pages li > button.danger")];
    expect(remove).toHaveLength(1);
    for (const control of remove) {
      const name = control.getAttribute("aria-label") ?? "";
      expect(name).toContain("Remove ");
      expect(name).not.toBe(control.textContent);
    }
  });

  it("has no axe violations while it is asking whether to remove a page", async () => {
    // The question is a state the gate would otherwise never render, which is
    // the exact failure this file exists to stop repeating.
    const root = mount();
    open(root);
    const remove = document.querySelector<HTMLButtonElement>(".pages li > button.danger");
    if (remove === null) throw new Error("no remove control to press");
    remove.click();
    // This harness renders on demand rather than subscribing, so the state
    // change has to be drawn deliberately.
    open(root);

    expect(document.querySelector(".pages li.confirm")).not.toBeNull();
    expect((await violations()).map((v) => v.id)).toEqual([]);
  });
});

describe("the starting point picker is accessible", () => {
  /**
   * The blind spot this file's own docstring warns about, landed again. An
   * unlabelled file input shipped for weeks because "the gate was green on a
   * control it had never rendered", and this file rendered the shell without
   * ever opening the starters disclosure, folded shut with eight buttons, a
   * `ul[aria-label]`, and a `summary`, in either of its two placements.
   */
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
  });

  it("has no axe violations open in the empty state", async () => {
    init(true);
    const root = mount();
    renderShell(root);
    const group = document.querySelector<HTMLDetailsElement>(".starters");
    if (group === null) throw new Error("the picker did not render in the empty state");
    group.open = true;

    expect(document.querySelectorAll(".starters button").length).toBeGreaterThan(0);
    expect((await violations()).map((v) => v.id)).toEqual([]);
  });

  it("has no axe violations open beside Your pages", async () => {
    init(true);
    const root = mount();
    addBlock(blankBlock("profile"));
    renderShell(root);
    // The save this triggers lands asynchronously (store.ts save -> refreshPages),
    // which is what populates state.pages and, with it, the pages group this
    // placement of the picker lives inside.
    for (let i = 0; i < 12; i += 1) await new Promise((r) => setTimeout(r, 0));
    renderShell(root);

    openSidebar();
    renderShell(root);
    const pages = document.querySelector(".pages-panel");
    if (pages === null) throw new Error("Your pages did not render");
    const group = document.querySelector<HTMLDetailsElement>(".pages-panel .starters");
    if (group === null) throw new Error("the picker did not render beside Your pages");
    group.open = true;

    expect(document.querySelectorAll(".starters button").length).toBeGreaterThan(0);
    expect((await violations()).map((v) => v.id)).toEqual([]);
  });
});

/**
 * The setup wizard, feature 027.
 *
 * A `role="dialog"` layer with nine choices on its first screen, six question
 * screens and a finish screen, and until this block existed the gate had never
 * had one pixel of it on screen. The wizard itself is days old, so that is not
 * an old failure; the PATTERN is this file's oldest, and
 * `specs/027-setup-wizard/research.md` R6 records the two most recent times it
 * landed anyway: feature 025 moved the page list into a drawer and the contrast
 * gate quietly went from 164 elements to 137, and feature 026 found it had
 * never opened a price row's fold at all. Nothing failed either time, because a
 * gate that measures less does not complain about it.
 *
 * So every helper below proves the surface is really on screen before anything
 * is asserted about it, and every screen is reached by pressing the control a
 * seller presses rather than by writing to the store.
 */
describe("the setup wizard is accessible", () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
    init(true);
    // Module state in `wizard.ts` outlives a test: it remembers whether the
    // layer was open on the last repaint, and how many repaints the focus
    // landing may still act on. Left alone, a test inherits the previous one's
    // answer to both and the focus moves for reasons this file cannot see.
    resetWizardFocusTracking();
  });

  // And once on the way out, because that state is not this block's to leave
  // lying around. The last test here finishes with `wasOpen` true, so the first
  // render of every describe after this one looks like a wizard that has just
  // closed and takes the focus landing branch, which moves focus into the new
  // page. Harmless today only because nothing below reads `document.activeElement`.
  afterAll(resetWizardFocusTracking);

  function panel(): HTMLElement {
    const found = document.getElementById(WIZARD_ID);
    if (found === null) throw new Error("the wizard is not on screen");
    return found;
  }

  /** Every button on the screen showing, in document order. */
  function controls(): HTMLButtonElement[] {
    return [...panel().querySelectorAll<HTMLButtonElement>("button")];
  }

  /**
   * Opens the wizard through the real control, not through `openWizard()`.
   *
   * The trigger is drawn by the EMPTY STATE rather than by the shell, so it
   * exists only on a page with nothing on it yet. Reaching past it to the store
   * would leave the one way into this feature unrendered, and a gate green on a
   * control it never built is the exact failure this file's docstring is about.
   */
  function open(root: HTMLElement): void {
    renderShell(root);
    const trigger = [...document.querySelectorAll("button")].find(
      (control) => control.getAttribute("aria-controls") === WIZARD_ID,
    );
    if (trigger === undefined) {
      throw new Error("the wizard trigger did not render on the empty state");
    }
    trigger.click();
    // This harness renders on demand rather than subscribing, so the state
    // change has to be drawn deliberately.
    renderShell(root);
    if (document.getElementById(WIZARD_ID) === null) {
      throw new Error("the wizard did not render after its trigger was pressed");
    }
  }

  /** Presses a control by name, and says what was there when there is none. */
  function press(root: HTMLElement, name: string): void {
    const control = controls().find((one) => nameOf(one) === name);
    if (control === undefined) {
      throw new Error(
        `no control called "${name}" on this screen. What is here: ${controls()
          .map(nameOf)
          .join(", ")}`,
      );
    }
    control.click();
    renderShell(root);
  }

  /**
   * Walks every screen the wizard has, handing each one to `visit`.
   *
   * Steps 0 to `QUESTION_COUNT` inclusive, which is seven screens counting the
   * finish. Driven off the count rather than off the literal six, so a seventh
   * question added later is measured without anybody remembering to come back
   * here: that is the difference between this gate and one that silently
   * measures less than it did yesterday.
   *
   * Forward by pressing Next, which is the path a seller takes. Each screen has
   * to prove it rendered before it is visited, or a `Next` that stopped working
   * would leave this walking the same screen seven times and reporting green.
   */
  async function walk(
    root: HTMLElement,
    visit: (step: number) => Promise<void> | void,
  ): Promise<void> {
    open(root);
    for (let step = 0; step <= QUESTION_COUNT; step += 1) {
      if (step < QUESTION_COUNT) {
        const progress = panel().querySelector(".wizard-progress")?.textContent ?? "";
        const expected = `Question ${String(step + 1)} of ${String(QUESTION_COUNT)}`;
        if (progress !== expected) {
          throw new Error(
            `step ${String(step)} did not render: expected "${expected}", found "${progress}"`,
          );
        }
        // And that it rendered something to answer WITH. A question carries
        // either a list of choices or one or more fields, and a heading with a
        // Back, Skip and Next under it would satisfy every check above while
        // the nine choices this feature exists for went unmeasured. That is R6
        // in one sentence: a gate that measures less does not complain.
        const answerable =
          panel().querySelectorAll(".wizard-choices li").length +
          panel().querySelectorAll(".field :is(input, textarea, select)").length;
        if (answerable === 0) {
          throw new Error(`step ${String(step)} rendered its question but nothing to answer it with`);
        }
      } else if (!controls().some((one) => nameOf(one) === "Make my page")) {
        throw new Error("the finish screen did not render");
      }

      await visit(step);
      if (step < QUESTION_COUNT) press(root, "Next");
    }
  }

  it("has no axe violations on any question, or on the finish", async () => {
    // FR-119 and Principle VI. Seven screens, each one scanned where it stands.
    const root = mount();
    await walk(root, async (step) => {
      expect((await violations()).map((v) => v.id), `step ${String(step)}`).toEqual([]);
    });
  });

  it("gives every control on every question a real accessible name", async () => {
    const root = mount();
    await walk(root, (step) => {
      const buttons = controls();
      expect(buttons.length, `step ${String(step)}`).toBeGreaterThan(0);

      for (const control of buttons) {
        // Named in the message as well as counted, because a failure here is
        // read by somebody who has to go and find the control, and "step 0" on
        // a screen of eleven buttons does not tell them which one.
        const where = `step ${String(step)}, the control reading "${control.textContent ?? ""}"`;
        expect(nameOf(control), where).not.toBe("");
        // The close control is the reason this is not "has some text". It draws
        // a "×" and nothing else, so its text passes a length check while
        // saying nothing at all read aloud, and only `aria-label` makes it a
        // name somebody can act on.
        //
        // FOUR IS A HEURISTIC AND IT IS WORTH SAYING WHAT IT CANNOT DO. It is
        // the same threshold the icon-only assertion further down this file has
        // used since feature 004, chosen because every glyph this app draws is
        // one character and no useful English name for a control is four or
        // fewer: "Close setup" clears it, "×", "···" and "Back" do not, and
        // "Back" is never an icon. What it cannot catch is a five character
        // label that is real English and still says nothing, "Press" say. No
        // machine catches that one, and pretending a longer threshold would is
        // how a gate ends up measuring the wrong thing confidently. The second
        // assertion is the half that does real work: a label identical to the
        // glyph is a label that was never written.
        if (control.classList.contains("icon")) {
          const label = control.getAttribute("aria-label") ?? "";
          expect(label.length, where).toBeGreaterThan(4);
          expect(label, where).not.toBe(control.textContent);
        }
      }

      for (const control of panel().querySelectorAll("input, textarea, select")) {
        const id = control.getAttribute("id");
        expect(id, `step ${String(step)}`).toBeTruthy();
        // Resolved INSIDE the panel, not over the document. The surface behind
        // the layer is still in the DOM with all its own labels on it, and a
        // document wide lookup would let one of those answer for a wizard field
        // whose own label was never drawn. Ids are minted per render and shared
        // across both, so that is a collision waiting to happen rather than a
        // theoretical one.
        expect(
          panel().querySelector(`label[for="${id ?? ""}"]`),
          `step ${String(step)}`,
        ).not.toBeNull();
      }
    });
  });

  it("does not use a placeholder in place of a label on any question", async () => {
    // FR-130, and research R2 is why it is worth a test of its own. The
    // examples in these fields are hints, sitting beside a real label and read
    // out with it. A placeholder is neither: it disappears the moment somebody
    // types, and it is the first thing anybody "helpfully" reaches for here.
    const root = mount();
    await walk(root, (step) => {
      for (const control of panel().querySelectorAll("input, textarea")) {
        expect(control.getAttribute("placeholder"), `step ${String(step)}`).toBeNull();
      }
    });
  });

  it("meets the 44 by 44 touch target minimum on every control of every question", async () => {
    // FR-132, which nothing else in this repository asserts. Constitution VI
    // wants CI to fail on it, so driving the wizard by eye on the handset is a
    // second opinion rather than the mechanism.
    //
    // jsdom lays nothing out, so a computed size here would be a number that
    // means nothing. This asserts the PAIR that produces the size, the way the
    // menu file control's assertion does: the control carries the class, and
    // the class carries the minimum in the stylesheet.
    const css = await stylesheet();
    expect(css).toMatch(/\.btn\s*\{[^}]*min-height: var\(--tap\)/);
    expect(css).toMatch(/\.btn\s*\{[^}]*min-width: var\(--tap\)/);
    // A text field takes the full width of the panel rather than a 44 pixel
    // minimum, so the horizontal half of the rule is `width: 100%` here. A
    // `min-width` on it would be a floor it is never anywhere near.
    expect(css).toMatch(/\.field input[^{]*\{[^}]*width: 100%/);
    expect(css).toMatch(/\.field input[^{]*\{[^}]*min-height: var\(--tap\)/);

    const root = mount();
    await walk(root, (step) => {
      for (const control of controls()) {
        expect(
          control.classList.contains("btn"),
          `step ${String(step)}, the control "${nameOf(control)}"`,
        ).toBe(true);
      }
      for (const control of panel().querySelectorAll("input, textarea, select")) {
        // The wrapper is what the rule above is written against, so a field
        // built by hand outside `field()` fails here rather than shipping a
        // 20 pixel box nobody can hit.
        //
        // Named by its label rather than by its id, for the reason the naming
        // test gives: a failure is read by somebody who has to go and find the
        // control, and `f7` is not a thing anybody can see on a screen.
        const label = panel().querySelector(`label[for="${control.getAttribute("id") ?? ""}"]`);
        expect(
          control.parentElement?.classList.contains("field"),
          `step ${String(step)}, the control "${label === null ? "unlabelled" : nameOf(label)}"`,
        ).toBe(true);
      }
    });
  });

  it("marks everything behind the wizard inert while it is open", () => {
    // The attribute is what a browser acts on. jsdom implements `inert` neither
    // as a property nor as behaviour, proven by probe in feature 025 and
    // recorded in research R1, so this asserts only that the word is applied.
    // The guarantee actually TESTED is the focus containment below. Both exist
    // because they fail in different places.
    const root = mount();
    open(root);
    for (const selector of ["header.bar", "main", "nav.tabs"]) {
      expect(root.querySelector(selector)?.hasAttribute("inert"), selector).toBe(true);
    }
  });

  it("leaves nothing inert once the wizard closes", () => {
    // The negative control, and without it the test above passes just as
    // happily on a shell that marks these three inert and never takes it back.
    // `pages-sidebar.test.ts` carries the same pair for the drawer, for the same
    // reason: half a toggle asserted is a toggle nobody has checked.
    //
    // Closed through the store rather than by pressing the close control, the
    // way the drawer's half of this does. The control goes through
    // `dismissWizard`, which spends a history entry with `history.back()`, and
    // jsdom's history is a model rather than a browser: nothing here could
    // honestly observe when that lands. What is under test is the attribute,
    // not the route taken to it.
    const root = mount();
    open(root);
    closeWizard();
    renderShell(root);
    if (document.getElementById(WIZARD_ID) !== null) {
      throw new Error("the wizard is still on screen, so this proves nothing");
    }

    for (const selector of ["header.bar", "main", "nav.tabs"]) {
      expect(root.querySelector(selector)?.hasAttribute("inert"), selector).toBe(false);
    }
  });

  it("holds the keyboard inside the panel", () => {
    // What `showModal()` would have given for nothing, done by hand. UNDER
    // JSDOM it is the only thing standing between a keyboard user and a page
    // they cannot see, which is the honest way to say it: in a real browser
    // `inert` above does that work and this trap is the belt to its braces.
    // jsdom implements none of `inert`, so here the braces are all there is.
    const root = mount();
    open(root);
    const stops = [
      ...panel().querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
      ),
    ];
    // Two, not one. `trapFocus` wraps from the last stop to the first, and with
    // a single stop the first IS the last: both assertions below would pass
    // with focus never having moved and the trap doing nothing at all.
    if (stops.length < 2) {
      throw new Error(
        `the trap needs at least two stops to prove anything, and the panel offered ${String(stops.length)}`,
      );
    }
    const first = stops[0];
    const last = stops[stops.length - 1];
    if (first === undefined || last === undefined) throw new Error("nothing to tab between");

    last.focus();
    panel().dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    expect(document.activeElement).toBe(first);

    first.focus();
    panel().dispatchEvent(
      new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true }),
    );
    expect(document.activeElement).toBe(last);
  });
});

describe("the preview and export surfaces are accessible", () => {
  beforeEach(() => {
    init(true);
  });

  it("has no axe violations on the preview", async () => {
    const root = mount();
    addBlock(blankBlock("profile"));
    addBlock(blankBlock("menu"));
    setSurface("preview");
    renderShell(root);
    expect((await violations()).map((v) => v.id)).toEqual([]);
  });

  it("has no axe violations on the export surface", async () => {
    const root = mount();
    addBlock(blankBlock("heading"));
    setSurface("export");
    renderShell(root);
    expect((await violations()).map((v) => v.id)).toEqual([]);
  });

  /**
   * The menu file control, feature 024.
   *
   * Rendered here rather than assumed, because this file's own docstring is
   * about a control that shipped unlabelled for weeks while the gate was green
   * on a DOM it had never built.
   */
  function menuFileButton(): HTMLButtonElement {
    const root = mount();
    // A real item, not a blank one. Both surfaces show their empty state until
    // the page compiles to something, so a blank menu renders neither the
    // control nor the preview and would make every assertion below vacuous.
    addBlock({ id: "m", kind: "menu", heading: "Prices", tiers: [{ id: "t", name: "Bust", price: "45" }] });
    setSurface("export");
    renderShell(root);

    const found = [...document.querySelectorAll("button")].find((b) =>
      /menu/i.test(b.getAttribute("aria-label") ?? b.textContent ?? ""),
    );
    if (found === undefined) throw new Error("the menu file control did not render");
    return found;
  }

  it("gives the menu file control a name that says what it produces", () => {
    const name = menuFileButton().textContent ?? "";
    // A real name, not a glyph and not "Save" on its own, which says nothing
    // about which of the four things on this surface it saves.
    expect(name.trim().length).toBeGreaterThan(8);
    expect(name.toLowerCase()).toContain("menu");
  });

  it("makes the menu file control reachable and operable by keyboard", () => {
    const control = menuFileButton();
    expect(control.tagName).toBe("BUTTON");
    expect(control.getAttribute("type")).toBe("button");
    // Not removed from the tab order, and not hidden from a screen reader.
    expect(control.getAttribute("tabindex")).toBeNull();
    expect(control.getAttribute("aria-hidden")).toBeNull();
    expect(control.disabled).toBe(false);
  });

  it("gives the menu file control the 44 pixel touch target", async () => {
    // jsdom lays nothing out, so this asserts the pair that produces the size:
    // the control carries `.btn`, and `.btn` carries both minimums.
    expect(menuFileButton().classList.contains("btn")).toBe(true);
    const css = await stylesheet();
    expect(css).toMatch(/\.btn\s*\{[^}]*min-height: var\(--tap\)/);
    expect(css).toMatch(/\.btn\s*\{[^}]*min-width: var\(--tap\)/);
  });

  it("has no axe violations with the menu file preview open", async () => {
    const root = mount();
    addBlock({ id: "m", kind: "menu", heading: "Prices", tiers: [{ id: "t", name: "Bust", price: "45" }] });
    setSurface("preview");
    renderShell(root);

    const group = document.querySelector<HTMLDetailsElement>("details.menu-file");
    if (group === null) throw new Error("the menu file preview did not render");
    group.open = true;

    expect(document.querySelector("details.menu-file .rendered")).not.toBeNull();
    expect((await violations()).map((v) => v.id)).toEqual([]);
  });

  it("labels the output box rather than leaving it bare", () => {
    const root = mount();
    addBlock(blankBlock("heading"));
    setSurface("export");
    renderShell(root);
    expect(document.getElementById("output")).not.toBeNull();
    expect(document.querySelector('label[for="output"]')).not.toBeNull();
  });
});

/**
 * Pictures held on this device, feature 024 Phase 4.
 *
 * Rendered through the real path in every case below, for the reason this
 * file's own docstring gives: an unlabelled file input shipped for weeks
 * because the gate was green on a control it had never built. Two of these
 * controls only exist once something has been stored, and one of them only
 * exists while a question is being asked, so all three states are drawn here
 * rather than assumed.
 */
describe("the device picture controls are accessible", () => {
  /** A stored picture, written straight to the store, as an earlier session left. */
  async function storePicture(id: string, bytes: number): Promise<void> {
    const { writeAsset } = await import("../src/db.js");
    await writeAsset({
      id,
      data: new Uint8Array(bytes).buffer,
      mime: "image/jpeg",
      bytes,
      createdAt: bytes,
    });
  }

  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
    init(true);
  });

  /** The build surface with a price list open, which is where the field lives. */
  function fieldOpen(): HTMLElement {
    const root = mount();
    addBlock({ id: "m", kind: "menu", heading: "Prices", tiers: [{ id: "t", name: "Bust", price: "45" }] });
    selectBlock("m");
    renderShell(root);
    return root;
  }

  /**
   * Found by structure, not by wording.
   *
   * "Upload a picture from this device" is the Imgur control and sits in the
   * same field, so matching on the words alone picks that one up and every
   * assertion below quietly moves to it. The two are different controls doing
   * different things: one puts a picture on the web, this one keeps it here.
   */
  function deviceButton(): HTMLButtonElement {
    const found = document.querySelector<HTMLButtonElement>(".device-picture .uploader button");
    if (found === null) throw new Error("the device picture control did not render");
    return found;
  }

  it("offers the control on the price list, the gallery and the profile alike", () => {
    // FR-078: every place that accepts a picture behaves the same way as every
    // other. One control built in one place is what keeps that true, and this
    // is the assertion that it really is reaching all three.
    for (const kind of ["menu", "gallery", "profile"] as const) {
      const root = mount();
      init(true);
      addBlock(blankBlock(kind));
      selectBlock(getState().doc.blocks[0]?.id);
      renderShell(root);

      expect(document.querySelectorAll(".device-picture").length, kind).toBeGreaterThan(0);
      expect(deviceButton().textContent ?? "", kind).toMatch(/picture from this device/i);
    }
  });

  it("tells the seller where the picture will and will not appear before they choose one", () => {
    // FR-082. Not only that the words are on the page, but that they are ahead
    // of the control, because a caveat under the button is a caveat read after
    // the file dialog has already been through.
    fieldOpen();
    const caveat = [...document.querySelectorAll(".device-picture .hint")].find((p) =>
      /menu file/i.test(p.textContent ?? ""),
    );
    if (caveat === undefined) throw new Error("the caveat did not render");

    expect(caveat.textContent ?? "").toMatch(/rentry/i);
    expect(caveat.compareDocumentPosition(deviceButton()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("gives the control a real name, the touch target, and the keyboard", async () => {
    fieldOpen();
    const control = deviceButton();

    expect((control.textContent ?? "").trim().length).toBeGreaterThan(8);
    expect(control.tagName).toBe("BUTTON");
    expect(control.getAttribute("type")).toBe("button");
    expect(control.getAttribute("tabindex")).toBeNull();
    expect(control.getAttribute("aria-hidden")).toBeNull();
    // jsdom lays nothing out, so this asserts the pair that produces the size.
    expect(control.classList.contains("btn")).toBe(true);
    const css = await stylesheet();
    expect(css).toMatch(/\.btn\s*\{[^}]*min-height: var\(--tap\)/);
  });

  it("keeps its file picker out of the tab order and out of the a11y tree", () => {
    fieldOpen();
    const picker = document.querySelector<HTMLInputElement>("input[type=file][id$='-device-file']");
    if (picker === null) throw new Error("the device picker did not render");

    expect(picker.getAttribute("aria-hidden")).toBe("true");
    expect(picker.getAttribute("tabindex")).toBe("-1");
  });

  it("has no axe violations with the field on screen", async () => {
    fieldOpen();
    expect((await violations()).map((v) => v.id)).toEqual([]);
  });

  it("has no axe violations with a picture chosen", async () => {
    await storePicture("held", 4096);
    const root = mount();
    addBlock({
      id: "m",
      kind: "menu",
      heading: "Prices",
      tiers: [{ id: "t", name: "Bust", price: "45", localImageIds: ["held"] }],
    });
    selectBlock("m");
    const { holdAssets } = await import("../src/assets.js");
    await holdAssets(["held"]);
    renderShell(root);

    expect(document.querySelector(".device-picture .thumb")).not.toBeNull();
    expect((await violations()).map((v) => v.id)).toEqual([]);
  });

  it("says so rather than rendering a broken picture when one is gone", async () => {
    // FR-088. The editor half: a page pointing at a picture that is no longer
    // stored still opens, and shows a sentence instead of an image element with
    // nothing behind it.
    const root = mount();
    addBlock({
      id: "m",
      kind: "menu",
      heading: "Prices",
      tiers: [{ id: "t", name: "Bust", price: "45", localImageIds: ["cleared-long-ago"] }],
    });
    selectBlock("m");
    renderShell(root);

    expect(document.querySelector(".device-picture .thumb")).toBeNull();
    expect(document.querySelector(".device-picture .img-status")?.textContent ?? "").toMatch(
      /no longer stored/i,
    );
    expect((await violations()).map((v) => v.id)).toEqual([]);
  });
});

describe("the storage view is accessible", () => {
  async function storePicture(id: string, bytes: number): Promise<void> {
    const { writeAsset } = await import("../src/db.js");
    await writeAsset({ id, data: new Uint8Array(bytes).buffer, mime: "image/jpeg", bytes, createdAt: bytes });
  }

  /** Opens the panel and waits for it to read the store. */
  async function openPanel(): Promise<void> {
    const root = mount();
    addBlock(blankBlock("heading"));
    setSurface("export");
    renderShell(root);

    const panel = document.querySelector<HTMLDetailsElement>("#device-pictures");
    if (panel === null) throw new Error("the storage panel did not render");
    panel.open = true;
    // Dispatched as well as set, because jsdom's `toggle` is not guaranteed to
    // fire for a programmatic change and a panel that never filled would make
    // every assertion below vacuous, which is this file's oldest failure.
    panel.dispatchEvent(new Event("toggle"));
    for (let i = 0; i < 20; i += 1) await new Promise((r) => setTimeout(r, 0));
  }

  beforeEach(async () => {
    globalThis.indexedDB = new IDBFactory();
    init(true);
    await storePicture("one", 240_000);
    await storePicture("two", 12_000);
  });

  it("lists what each picture costs", async () => {
    await openPanel();
    const rows = [...document.querySelectorAll(".stored-pictures li")];
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.textContent ?? "").join(" ")).toMatch(/KB/);
  });

  it("names each remove control after the picture it removes", async () => {
    // "Remove" repeated down a list is not an answerable question read aloud.
    await openPanel();
    const names = [...document.querySelectorAll(".stored-pictures button")].map(
      (b) => b.getAttribute("aria-label") ?? b.textContent ?? "",
    );
    expect(names).toHaveLength(2);
    for (const name of names) expect(name).toMatch(/^Remove picture \d+ of \d+$/);
    expect(new Set(names).size).toBe(names.length);
  });

  it("has no axe violations with the panel open", async () => {
    await openPanel();
    expect((await violations()).map((v) => v.id)).toEqual([]);
  });

  it("has no axe violations while it is asking whether to remove a picture", async () => {
    await openPanel();
    const remove = document.querySelector<HTMLButtonElement>(".stored-pictures button");
    if (remove === null) throw new Error("no remove control to press");
    remove.click();

    expect(document.querySelector(".stored-pictures p")?.textContent ?? "").toMatch(/cannot be brought back/i);
    expect((await violations()).map((v) => v.id)).toEqual([]);
  });

  it("keeps every control in the panel reachable and named", async () => {
    await openPanel();
    for (const control of document.querySelectorAll(".device-pictures button")) {
      expect(nameOf(control)).not.toBe("");
      expect(control.getAttribute("tabindex")).toBeNull();
      expect(control.classList.contains("btn")).toBe(true);
    }
  });
});

describe("every control can be named and reached", () => {
  beforeEach(() => {
    init(true);
  });

  it("gives every button an accessible name", () => {
    const root = mount();
    for (const kind of ["profile", "menu", "gallery", "prose"] as const) addBlock(blankBlock(kind));
    selectBlock(getState().doc.blocks[1]?.id);
    renderShell(root);

    const buttons = [...document.querySelectorAll("button")];
    expect(buttons.length).toBeGreaterThan(10);
    for (const b of buttons) {
      expect(nameOf(b)).not.toBe("");
    }
  });

  it("gives icon-only buttons a name that says what they do, not what they look like", () => {
    const root = mount();
    addBlock(blankBlock("heading"));
    addBlock(blankBlock("prose"));
    renderShell(root);

    for (const b of document.querySelectorAll("button.icon")) {
      const name = b.getAttribute("aria-label") ?? "";
      expect(name.length).toBeGreaterThan(4);
      // The glyph alone would be useless read aloud.
      expect(name).not.toBe(b.textContent);
    }
  });

  it("binds every form control to a real label", () => {
    const root = mount();
    addBlock(blankBlock("profile"));
    selectBlock(getState().doc.blocks[0]?.id);
    renderShell(root);

    for (const control of document.querySelectorAll("input, textarea, select")) {
      // A control hidden from assistive technology is exempt, because it is
      // not a control as far as a screen reader is concerned. The exemption is
      // not free: the test below requires anything claiming it to also be out
      // of the tab order, so this cannot be used to smuggle a real control
      // past the label rule.
      if (control.getAttribute("aria-hidden") === "true") continue;
      const id = control.getAttribute("id");
      expect(id).toBeTruthy();
      expect(document.querySelector(`label[for="${id}"]`)).not.toBeNull();
    }
  });

  it("keeps anything hidden from screen readers out of the tab order too", () => {
    const root = mount();
    addBlock(blankBlock("profile"));
    selectBlock(getState().doc.blocks[0]?.id);
    renderShell(root);

    // The pairing that makes the exemption above safe. Focus landing on an
    // element a screen reader refuses to describe is a dead end: the user is
    // somewhere with no name, no role, and no way to know what happened.
    const hidden = document.querySelectorAll(
      "[aria-hidden='true']:is(button, input, textarea, select, a[href])",
    );
    expect(hidden.length).toBeGreaterThan(0);
    for (const node of hidden) {
      expect(node.getAttribute("tabindex")).toBe("-1");
    }
  });

  it("binds the controls inside a price row's fold to real labels too", () => {
    // The label test above opens a profile, which has no fold and no rows. The
    // controls a seller meets most are the ones on a price row, and until this
    // existed none of them were checked.
    const root = mount();
    addBlock(blankBlock("menu"));
    const block = getState().doc.blocks[0];
    if (block === undefined || block.kind !== "menu") throw new Error("not a menu");
    updateBlock(block.id, {
      ...block,
      tiers: [{ id: "sign", name: "Carved sign", price: "80", availability: "sold-out" }],
    });
    selectBlock(block.id);
    renderShell(root);

    const controls = [...document.querySelectorAll("fieldset.item :is(input, textarea, select)")];
    expect(controls.length).toBeGreaterThan(5);
    for (const control of controls) {
      if (control.getAttribute("aria-hidden") === "true") continue;
      const id = control.getAttribute("id");
      expect(id).toBeTruthy();
      expect(document.querySelector(`label[for="${id}"]`)).not.toBeNull();
    }
  });

  it("gives every choice in a select words of its own", () => {
    // An option with no text is a blank line in the list, which is unusable by
    // sight and silent when read aloud. The empty VALUE is deliberate and is
    // how the field clears; the empty LABEL would be the bug.
    const root = mount();
    addBlock(blankBlock("menu"));
    addBlock(blankBlock("profile"));
    selectBlock(getState().doc.blocks[0]?.id);
    renderShell(root);

    const options = [...document.querySelectorAll("select option")];
    expect(options.length).toBeGreaterThan(4);
    for (const option of options) {
      expect((option.textContent ?? "").trim()).not.toBe("");
    }
  });

  it("does not use a placeholder in place of a label", () => {
    const root = mount();
    addBlock(blankBlock("menu"));
    selectBlock(getState().doc.blocks[0]?.id);
    renderShell(root);

    for (const control of document.querySelectorAll("input, textarea")) {
      expect(control.getAttribute("placeholder")).toBeNull();
    }
  });

  it("keeps every interactive element reachable by keyboard", () => {
    const root = mount();
    addBlock(blankBlock("gallery"));
    renderShell(root);

    for (const node of document.querySelectorAll("button, input, textarea, select, a[href]")) {
      // A positive tabindex reorders the tab sequence and breaks it for
      // everyone. A negative one removes the element from the sequence, which
      // is only acceptable when it is hidden from assistive technology as
      // well, so that nothing is offering itself to one kind of user and not
      // the other.
      if (node.getAttribute("aria-hidden") === "true") continue;
      const tabindex = node.getAttribute("tabindex");
      if (tabindex !== null) expect(Number(tabindex)).toBe(0);
    }
  });

  it("marks the pressed state of toggle buttons", () => {
    const root = mount();
    renderShell(root);
    const tabs = document.querySelectorAll(".tabs button");
    expect(tabs.length).toBe(3);
    for (const tab of tabs) expect(tab.getAttribute("aria-pressed")).not.toBeNull();
  });
});

describe("no artist text can become markup", () => {
  const corpus = [
    "<script>alert(1)</script>",
    "<img src=x onerror=alert(1)>",
    "<iframe src=//evil.test></iframe>",
    "javascript:alert(1)",
    "<svg/onload=alert(1)>",
    "</textarea><script>alert(1)</script>",
    "&lt;script&gt;alert(1)&lt;/script&gt;",
  ];

  beforeEach(() => {
    init(true);
  });

  it.each(corpus)("renders %j as text, never as an element", (payload) => {
    const root = mount();
    addBlock({ id: "p", kind: "profile", displayName: payload, tagline: payload });
    addBlock({ id: "t", kind: "prose", text: payload });
    setSurface("preview");
    renderShell(root);

    // The decisive assertion: no script, iframe, or svg exists anywhere in the
    // document. Not "was filtered out" but never created, because nothing in
    // this application parses HTML. That is why there is no sanitizer: the
    // dangerous operation is never performed rather than being filtered.
    expect(document.querySelectorAll("script, iframe, svg, object, embed")).toHaveLength(0);

    for (const node of document.querySelectorAll("*")) {
      for (const attr of node.attributes) {
        expect(attr.name.startsWith("on")).toBe(false);
        expect(attr.value.toLowerCase().startsWith("javascript:")).toBe(false);
      }
    }
  });

  it("shows the artist the characters they actually typed", () => {
    const root = mount();
    addBlock({ id: "t", kind: "prose", text: "a < b and c > d and e & f" });
    setSurface("preview");
    renderShell(root);

    // The compiler emits entities so the host cannot build a tag. The preview
    // decodes them back for display, or the artist sees "&lt;" where they wrote
    // "<" and reasonably concludes the tool mangled their text.
    const rendered = document.querySelector(".rendered")?.textContent ?? "";
    expect(rendered).toContain("a < b");
    expect(rendered).toContain("c > d");
    expect(rendered).toContain("e & f");
  });
});

describe("the stylesheet meets the touch target minimum", () => {
  it("sets a 44 pixel minimum on every control", async () => {
    // Read the stylesheet as text: jsdom lays nothing out, so an assertion on
    // computed size would be measuring nothing. This checks the rule exists,
    // and the manual pass checks it holds on a real device.
    const css = await stylesheet();

    expect(css).toContain("--tap: 44px");
    for (const rule of ["min-height: var(--tap)", "min-width: var(--tap)"]) {
      expect(css).toContain(rule);
    }
  });

  it("keeps focus visible and does not remove the outline", async () => {
    const css = await stylesheet();

    expect(css).toContain(":focus-visible");
    // `outline: none` without a replacement is the single most common way a
    // keyboard user is stranded with no idea where they are on the page.
    expect(css).not.toMatch(/outline:\s*(none|0)\s*;/);
  });

  it("respects a stated preference for reduced motion", async () => {
    expect(await stylesheet()).toContain("prefers-reduced-motion");
  });
});
