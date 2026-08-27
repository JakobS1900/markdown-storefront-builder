/**
 * @vitest-environment jsdom
 *
 * Deleting a section asks first.
 *
 * The delete control sits between "move up" and "move down" in a row of three
 * touch targets 44px wide, on a phone, and it used to remove the section on the
 * first press. There is no undo. One mis-tap between two harmless buttons and a
 * section the artist wrote is gone with nothing to say about it.
 *
 * The confirmation is inline rather than a `confirm()` dialog: the surrounding
 * app rebuilds its DOM on every state change, and a native modal blocks that
 * loop, but more importantly the row itself is where the artist is looking. It
 * names the section it is about to remove, because "Delete this section?" over
 * a list of six sections is not an answerable question.
 */
import { beforeEach, describe, expect, it } from "vitest";

import { addBlock, getState, init, subscribe } from "../src/store.js";
import { blankBlock } from "../src/ui/forms.js";
import { renderShell } from "../src/ui/shell.js";

let stop: (() => void) | undefined;

function live(): HTMLElement {
  document.body.innerHTML =
    '<a class="skip" href="#surface">Skip</a><div id="app"></div>' +
    '<div id="live-region" class="sr-only" role="status" aria-live="polite"></div>';
  const root = document.getElementById("app");
  if (root === null) throw new Error("missing #app");
  init(false);
  stop = subscribe(() => renderShell(root));
  renderShell(root);
  return root;
}

beforeEach(() => {
  stop?.();
  stop = undefined;
});

function press(label: string): void {
  const button = [...document.querySelectorAll("#app button")].find(
    (b) => (b.getAttribute("aria-label") ?? b.textContent ?? "").trim() === label,
  );
  if (button === undefined) {
    const seen = [...document.querySelectorAll("#app button")]
      .map((b) => (b.getAttribute("aria-label") ?? b.textContent ?? "").trim())
      .join(" | ");
    throw new Error(`no button labelled "${label}", saw: ${seen}`);
  }
  (button as HTMLButtonElement).click();
}

function labelled(label: string): boolean {
  return [...document.querySelectorAll("#app button")].some(
    (b) => (b.getAttribute("aria-label") ?? b.textContent ?? "").trim() === label,
  );
}

function sectionCount(): number {
  return getState().doc.blocks.length;
}

describe("removing a section", () => {
  it("does not remove it on the first press", () => {
    live();
    addBlock(blankBlock("prose"));
    expect(sectionCount()).toBe(1);

    press("Delete Text");

    expect(sectionCount(), "the section went without being asked about").toBe(1);
  });

  it("asks, naming the section it means", () => {
    live();
    addBlock(blankBlock("prose"));
    press("Delete Text");

    expect(labelled("Yes, delete Text")).toBe(true);
    expect(labelled("Keep Text")).toBe(true);
  });

  it("removes it when the artist confirms", () => {
    live();
    addBlock(blankBlock("prose"));
    press("Delete Text");
    press("Yes, delete Text");

    expect(sectionCount()).toBe(0);
  });

  it("keeps it, and puts the row back, when the artist declines", () => {
    live();
    addBlock(blankBlock("prose"));
    press("Delete Text");
    press("Keep Text");

    expect(sectionCount()).toBe(1);
    expect(labelled("Delete Text"), "the delete control did not come back").toBe(true);
    expect(labelled("Yes, delete Text")).toBe(false);
  });

  it("only ever asks about one section at a time", () => {
    live();
    addBlock(blankBlock("prose"));
    addBlock(blankBlock("heading"));

    press("Delete Text");
    press("Delete Heading");

    expect(labelled("Yes, delete Heading")).toBe(true);
    expect(labelled("Yes, delete Text"), "two sections were asking at once").toBe(false);
    expect(sectionCount()).toBe(2);
  });

  it("stops asking if the artist walks away to another surface", () => {
    live();
    addBlock(blankBlock("prose"));
    press("Delete Text");
    press("Preview");
    press("Build");

    expect(labelled("Yes, delete Text"), "the question was still waiting on return").toBe(false);
    expect(sectionCount()).toBe(1);
  });

  it("says out loud that it is asking, and does not claim to have deleted anything", () => {
    live();
    addBlock(blankBlock("prose"));
    press("Delete Text");

    const spoken = document.getElementById("live-region")?.textContent ?? "";
    expect(spoken).toContain("Delete Text?");
    expect(spoken, "it announced a removal that had not happened").not.toContain("Deleted");
  });

  it("puts focus on the safe answer, since the button that asked is gone", () => {
    live();
    addBlock(blankBlock("prose"));
    press("Delete Text");

    const focused = document.activeElement;
    expect((focused?.textContent ?? "").trim()).toBe("Keep Text");
  });
});
