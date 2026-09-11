/**
 * @vitest-environment jsdom
 *
 * FR-028-17: a seller who marks a word for a host that cannot show it is told
 * so BEFORE they publish, and told which section it is in.
 *
 * This is the half of the fallback that lives outside the engine, and nothing
 * else asserts it. The engine tests prove `mark_unsupported` is raised with the
 * right block and capability; they cannot prove anybody ever sees it. That gap
 * is exactly the shape of seam this project's holistic reviews keep finding:
 * two sides each correct on their own.
 *
 * Constitution Principle VII in its own words: where our approximation of a
 * host's renderer can diverge from that host, the limitation MUST be stated in
 * the product UI, not only in documentation.
 */
import { beforeEach, describe, expect, it } from "vitest";

import { addBlock, getState, init, setSurface, setTarget, subscribe, updateBlock } from "../src/store.js";
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

/** A text section carrying a highlighted word, previewed for one host. */
function previewOn(target: string, text: string): HTMLElement {
  const root = live();
  addBlock(blankBlock("prose"));
  const block = getState().doc.blocks[0];
  if (block === undefined || block.kind !== "prose") throw new Error("no prose block");
  updateBlock(block.id, { ...block, heading: "Shipping", text });
  setTarget(target);
  setSurface("preview");
  renderShell(root);
  return root;
}

function warnings(): string[] {
  return [...document.querySelectorAll(".warnings li p")].map((p) => (p.textContent ?? "").trim());
}

describe("a mark the chosen host cannot show", () => {
  it("warns before publishing, and names the host", () => {
    previewOn("portable", "A ==limited run== of forty");
    const found = warnings().filter((w) => /[Hh]ighlight/.test(w));
    expect(found).toHaveLength(1);
    expect(found[0]).toContain("Portable (works anywhere)");
  });

  it("heads the warnings with something a seller reads before posting", () => {
    previewOn("portable", "A ==limited run== of forty");
    expect(document.querySelector(".warnings h2")?.textContent).toContain("before you publish");
  });

  it("offers a way straight to the section it is about", () => {
    // SC-005, and the reason the diagnostic carries a block id rather than
    // prose. A warning a seller cannot act on is a worse version of silence.
    previewOn("portable", "A ==limited run== of forty");
    const go = [...document.querySelectorAll(".warnings button")].map((b) => b.textContent ?? "");
    expect(go.some((label) => /Go to the Text section/.test(label))).toBe(true);
  });

  it("shows the words plain in the page preview at the same time", () => {
    // Both halves of Principle VII on one screen: the page as that host will
    // render it, and the sentence saying why.
    const root = previewOn("portable", "A ==limited run== of forty");
    // The paste host's page specifically, not the whole surface. The menu file
    // preview sits on the same screen and is compiled for a different target.
    const page = root.querySelector('section[aria-labelledby="preview-heading"] .rendered');
    expect(page, "the page preview must be on screen for this to mean anything").not.toBeNull();
    expect(page?.querySelector("mark")).toBeNull();
    expect(page?.textContent).toContain("A limited run of forty");
  });

  it("SHOWS the highlight in the menu file preview on the same screen", () => {
    // Not a contradiction, and the seam is worth an assertion of its own.
    //
    // The page above is compiled for the paste host the seller picked, which
    // cannot highlight. The menu file below it is compiled for our own
    // renderer, which can. So the same words are plain in one and highlighted
    // in the other, on one screen, and both are true.
    //
    // That divergence is exactly what the menu file preview's own hint says it
    // exists to state, and it is why the fallback had to be per target rather
    // than a decision taken once for the document.
    const root = previewOn("portable", "A ==limited run== of forty");
    const file = root.querySelector(".menu-file");
    expect(file, "the menu file preview must be on screen for this to mean anything").not.toBeNull();
    expect(file?.querySelector("mark")?.textContent).toBe("limited run");
  });

  it("says nothing at all on a host that renders it", () => {
    const root = previewOn("rentry", "A ==limited run== of forty");
    expect(warnings().filter((w) => /[Hh]ighlight/.test(w))).toHaveLength(0);
    expect(root.querySelector("mark")?.textContent).toBe("limited run");
  });

  it("warns once for the section, not once per highlighted word", () => {
    previewOn("portable", "A ==limited run== and a ==second one== and a ==third==");
    expect(warnings().filter((w) => /[Hh]ighlight/.test(w))).toHaveLength(1);
  });

  it("warns about crossing out separately from highlighting", () => {
    previewOn("portable", "~~Sold out~~ and a ==limited run==");
    const found = warnings();
    expect(found.filter((w) => /[Cc]ross/.test(w))).toHaveLength(1);
    expect(found.filter((w) => /[Hh]ighlight/.test(w))).toHaveLength(1);
  });

  it("never quotes the seller's own words back", () => {
    // FR-081. A warning is somewhere a seller might screenshot, and a product
    // name or a price does not belong in one.
    previewOn("portable", "A ==limited run of the Ridgeline Carry==");
    for (const warning of warnings()) {
      expect(warning).not.toContain("Ridgeline");
      expect(warning).not.toContain("limited run");
    }
  });
});
