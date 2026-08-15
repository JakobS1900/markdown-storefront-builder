/**
 * @vitest-environment jsdom
 *
 * The accessibility gate. Constitution Principle VI.
 *
 * This is the gate `scripts/a11y.mjs` promised would become enforcing at
 * roadmap 2.2, written to fail loudly rather than to be remembered later.
 *
 * axe catches what a machine can catch. The assertions after it cover the three
 * things a machine reliably cannot: that every control has a real accessible
 * name rather than a plausible-looking one, that the touch target minimum is
 * actually met, and that nothing depends on a pointing device.
 */
import axe from "axe-core";
import { beforeEach, describe, expect, it } from "vitest";

import { init } from "../src/store.js";
import { renderShell } from "../src/ui/shell.js";
import { blankBlock } from "../src/ui/forms.js";
import { addBlock, selectBlock, getState } from "../src/store.js";

/**
 * Reads the stylesheet from disk.
 *
 * Resolved from the working directory rather than from import.meta.url: under
 * jsdom the module URL is not a file URL, so fileURLToPath refuses it.
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
    const found = await violations();
    expect(found.map((v) => v.id)).toEqual([]);
  });

  it("has no axe violations with a section open for editing", async () => {
    const root = mount();
    addBlock(blankBlock("menu"));
    const id = getState().doc.blocks[0]?.id;
    selectBlock(id);
    renderShell(root);
    const found = await violations();
    expect(found.map((v) => v.id)).toEqual([]);
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
      const name = b.getAttribute("aria-label") ?? b.textContent ?? "";
      expect(name.trim()).not.toBe("");
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
      const id = control.getAttribute("id");
      expect(id).toBeTruthy();
      expect(document.querySelector(`label[for="${id}"]`)).not.toBeNull();
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
      // everyone. A negative one on a control removes it from the sequence.
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

describe("the stylesheet meets the touch target minimum", () => {
  it("sets a 44 pixel minimum on every control", async () => {
    // Read the stylesheet as text: jsdom does not lay anything out, so an
    // assertion on computed size would be measuring nothing. This checks the
    // rule exists, and the manual pass checks it holds on a real device.
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
    const css = await stylesheet();

    expect(css).toContain("prefers-reduced-motion");
  });
});
