/**
 * @vitest-environment jsdom
 *
 * Every field says what to type, not just what it is called.
 *
 * This is the whole of feature 027's User Story 2, and it is the smaller half
 * of the complaint the wizard exists for. Jakob, 2026-09-05: somebody used a
 * starting point and could not figure out what to write. They got overwhelmed.
 * The failure is not the sections. It is that a blank box with a word over it
 * does not tell anybody what belongs in it.
 *
 * The mechanism was already here and the coverage was not. `Price` has said
 * `Anything you like: "45", "from 45", or "DM me"` since feature 010, and
 * `Item`, the field immediately above it and the first one anybody meets, said
 * nothing at all.
 *
 * What this refuses, and why it is not just "has a hint":
 *
 *   1. A missing hint.
 *   2. A hint that gives only the FORMAT. "One per line." tells somebody how to
 *      type and not what to type, which is the exact complaint restated as
 *      help. Two fields shipped with that as their entire hint.
 *
 * The exemption list is the load bearing part. A test that counts hints can be
 * satisfied with noise, so an exemption is explicit, carries a written reason,
 * and a stale one fails: an entry naming a field that no longer exists is a
 * list rotting, and this project has watched documents rot before.
 *
 * There is deliberately no `placeholder` anywhere. `research.md` R2 has the
 * reason: the accessibility gate refuses one outright, not merely one doing a
 * label's job, because placeholders vanish on focus and fail anybody who looks
 * away mid sentence. The example goes beside the label, never instead of it.
 */
import { beforeEach, describe, expect, it } from "vitest";

import type { Block } from "@mdsb/engine";

import { init } from "../src/store.js";
import { blockForm } from "../src/ui/forms.js";

// The Prices form reads the current selection out of the store, so there has to
// be a store. Nothing here writes to it.
beforeEach(() => {
  init(false);
});

/**
 * Hints that say how to type rather than what to type.
 *
 * Matched whole, after trimming. A hint that opens with one of these and then
 * gives an example is fine, and that is what the fixes to these two look like.
 */
const FORMAT_ONLY = ["One per line.", "One per line", "Required.", "Optional."];

/**
 * Fields where an example cannot help, each with the reason it cannot.
 *
 * Keep this short and keep it honest. If an entry here is really "I could not
 * think of an example", the field needs an example, not an entry.
 */
const EXEMPT: Record<string, string> = {
  "What you paid":
    "Its hint is a promise about privacy, which matters more than an example of a number. Somebody typing what something cost them is not stuck on the format, they are wondering who sees it.",
};

/** One block of each kind, carrying enough for every field to be drawn. */
function everyForm(): HTMLElement {
  const blocks: Block[] = [
    { id: "h", kind: "heading", text: "", level: 2 },
    { id: "t", kind: "prose", text: "" },
    { id: "m", kind: "menu", tiers: [{ id: "r", name: "", price: "" }] },
    { id: "g", kind: "gallery", layout: "grid", items: [{ imageUrl: "" }] },
    { id: "p", kind: "profile", displayName: "", links: [{ label: "", url: "" }] },
  ];

  const host = document.createElement("div");
  for (const block of blocks) host.append(blockForm(block, () => {}));
  document.body.replaceChildren(host);
  return host;
}

/** Every field holding something typable, with its label and its hint. */
function typableFields(host: HTMLElement): { label: string; hint: string | null }[] {
  return [...host.querySelectorAll(".field")]
    .filter((f) => f.querySelector("input[type='text'], textarea") !== null)
    .map((f) => ({
      label: (f.querySelector("label")?.textContent ?? "").trim(),
      hint: f.querySelector("p.hint")?.textContent?.trim() ?? null,
    }));
}

describe("every field an artist types into", () => {
  it("draws enough fields to be worth asserting on", () => {
    // A guard on the guard. If a form stops rendering, everything below passes
    // by measuring nothing, which is the exact failure this project has now
    // found in two of its own gates.
    const found = typableFields(everyForm());
    expect(found.length).toBeGreaterThanOrEqual(18);
  });

  it("shows an example of what belongs in it", () => {
    const missing = typableFields(everyForm())
      .filter((f) => EXEMPT[f.label] === undefined)
      .filter((f) => f.hint === null || f.hint === "")
      .map((f) => f.label);

    expect(missing).toEqual([]);
  });

  it("never offers the format in place of the example", () => {
    // "One per line." is the complaint restated as help.
    const formatOnly = typableFields(everyForm())
      .filter((f) => EXEMPT[f.label] === undefined)
      .filter((f) => f.hint !== null && FORMAT_ONLY.includes(f.hint))
      .map((f) => f.label);

    expect(formatOnly).toEqual([]);
  });

  it("keeps its label, and never uses a placeholder as one", () => {
    // FR-130. The a11y gate asserts this for one section; this asserts it for
    // every kind at once, which is where a new field would slip through.
    const host = everyForm();
    for (const control of host.querySelectorAll("input, textarea")) {
      // No placeholder on anything, including the controls exempted below.
      expect(control.getAttribute("placeholder")).toBeNull();

      // The hidden file pickers are exempt, and the exemption is the same one
      // `a11y.test.ts` makes: `aria-hidden="true"` paired with `tabindex="-1"`,
      // driven by a real named button beside them. A screen reader is never
      // offered them, so a label would be describing something nobody meets.
      // The pairing is asserted rather than assumed, so this cannot be used to
      // smuggle a real control past the label rule.
      if (control.getAttribute("aria-hidden") === "true") {
        expect(control.getAttribute("tabindex")).toBe("-1");
        continue;
      }

      const id = control.getAttribute("id");
      expect(id).toBeTruthy();
      expect(host.querySelector(`label[for="${id}"]`)).not.toBeNull();
    }
  });
});

describe("the exemption list", () => {
  it("names only fields that exist", () => {
    // A stale exemption is a list rotting, and it silently excuses a field that
    // was renamed rather than the one somebody meant.
    const labels = typableFields(everyForm()).map((f) => f.label);
    const stale = Object.keys(EXEMPT).filter((label) => !labels.includes(label));

    expect(stale).toEqual([]);
  });

  it("gives a real reason for each entry", () => {
    for (const [label, reason] of Object.entries(EXEMPT)) {
      expect(reason.length, `${label} needs a reason worth reading`).toBeGreaterThan(40);
    }
  });
});
