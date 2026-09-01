/**
 * @vitest-environment jsdom
 *
 * Where the host is chosen.
 *
 * It used to be the first control in the header, on every tab, which made it
 * the first decision asked of somebody who had just arrived. That question is
 * unanswerable at that moment: they have not made anything to paste, and they
 * have no reason to know what rentry is. Worse, changing it there did nothing
 * anybody could see, because everything it affects is on another tab.
 *
 * It now sits on the Copy tab, directly above the output it changes and the
 * steps it rewrites.
 *
 * Moving it broke no existing test, which is why this file exists.
 */
import { beforeEach, describe, expect, it } from "vitest";

import { RENTRY, TARGETS, TEXT_IS } from "@mdsb/engine";

import { addBlock, getState, init, setSurface, subscribe, updateBlock } from "../src/store.js";
import { blankBlock } from "../src/ui/forms.js";
import { renderShell } from "../src/ui/shell.js";

let stop: (() => void) | undefined;

function live(): void {
  document.body.innerHTML =
    '<a class="skip" href="#surface">Skip</a><div id="app"></div>' +
    '<div id="live-region" class="sr-only" role="status" aria-live="polite"></div>';
  const root = document.getElementById("app");
  if (root === null) throw new Error("missing #app");
  init(false);
  stop = subscribe(() => renderShell(root));
  renderShell(root);
}

beforeEach(() => {
  stop?.();
  stop = undefined;
});

const LABEL = "Where you will paste this";

function picker(): HTMLSelectElement | undefined {
  const label = [...document.querySelectorAll("label")].find(
    (l) => (l.textContent ?? "").trim() === LABEL,
  );
  if (label === undefined) return undefined;
  const control = document.getElementById(label.getAttribute("for") ?? "");
  return control instanceof HTMLSelectElement ? control : undefined;
}

/** A page with something on it, so the Copy tab is not in its empty state. */
function pageWithContent(): void {
  live();
  addBlock(blankBlock("prose"));
  const block = getState().doc.blocks[0];
  if (block === undefined || block.kind !== "prose") throw new Error("not prose");
  updateBlock(block.id, { ...block, text: "Half up front." });
}

describe("the first screen does not ask an unanswerable question", () => {
  it("has no host picker on it at all", () => {
    live();
    expect(picker()).toBeUndefined();
  });

  it("has no host picker in the header, on any tab", () => {
    pageWithContent();
    for (const surface of ["build", "preview", "export"] as const) {
      setSurface(surface);
      const header = document.querySelector("header.bar");
      expect(header?.querySelector("select"), `header on ${surface}`).toBeNull();
    }
  });
});

describe("the host is chosen where the choice takes effect", () => {
  it("is on the Copy tab", () => {
    pageWithContent();
    setSurface("export");
    expect(picker()).toBeDefined();
  });

  it("offers every shipped host", () => {
    pageWithContent();
    setSurface("export");
    const values = [...(picker()?.options ?? [])].map((o) => o.value);
    expect(values).toContain(RENTRY.id);
    expect(values).toContain(TEXT_IS.id);
    expect(values).toContain("portable");
  });

  it("shows the page as it stands for the chosen host", () => {
    pageWithContent();
    setSurface("export");
    const select = picker();
    if (select === undefined) throw new Error("no picker");

    select.value = TEXT_IS.id;
    select.dispatchEvent(new Event("change", { bubbles: true }));

    expect(getState().doc.target).toBe(TEXT_IS.id);
    const output = document.getElementById("output");
    expect(output).toBeInstanceOf(HTMLTextAreaElement);
    // The label beside the output names the host, so the choice is legible
    // rather than merely stored.
    expect(document.getElementById("surface")?.textContent).toContain(TEXT_IS.name);
  });

  it("rewrites the steps underneath to match", () => {
    pageWithContent();
    setSurface("export");
    const select = picker();
    if (select === undefined) throw new Error("no picker");

    select.value = RENTRY.id;
    select.dispatchEvent(new Event("change", { bubbles: true }));
    expect(document.getElementById("surface")?.textContent).toContain("rentry.co in a new tab");

    const again = picker();
    if (again === undefined) throw new Error("picker gone");
    again.value = TEXT_IS.id;
    again.dispatchEvent(new Event("change", { bubbles: true }));
    expect(document.getElementById("surface")?.textContent).toContain("text.is in a new tab");
  });
});

describe("the preview says which host it is showing", () => {
  it("names the host and where to change it", () => {
    // The preview still depends on the choice and can no longer offer it, and
    // an unexplained dependency reads as the preview being wrong.
    // Read the target rather than assuming the default. The store is module
    // state that outlives one test, and hard coding "Portable" made this pass
    // or fail depending on which test ran before it.
    pageWithContent();
    setSurface("preview");
    const chosen = TARGETS.find((t) => t.id === getState().doc.target);
    const text = document.getElementById("surface")?.textContent ?? "";
    expect(chosen).toBeDefined();
    expect(text).toContain(chosen?.name ?? "");
    expect(text).toContain("Copy tab");
  });

  it("says nothing about a host when there is nothing to preview", () => {
    live();
    setSurface("preview");
    const text = document.getElementById("surface")?.textContent ?? "";
    expect(text).not.toContain("Copy tab");
  });
});
