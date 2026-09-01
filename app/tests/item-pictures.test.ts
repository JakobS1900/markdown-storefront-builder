/**
 * @vitest-environment jsdom
 *
 * Entering more than one picture for a product.
 *
 * Repeated address fields rather than one box of addresses, because this field
 * carries a live thumbnail and says when a link does not load an image. A
 * textarea would lose both, and a wrong image address is invisible until
 * somebody else opens the page.
 */
import { beforeEach, describe, expect, it } from "vitest";

import { addBlock, getState, init, selectBlock, subscribe, updateBlock } from "../src/store.js";
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

/** One product, with however many pictures are given. */
function product(urls: readonly string[]): void {
  live();
  addBlock(blankBlock("menu"));
  const block = getState().doc.blocks[0];
  if (block === undefined || block.kind !== "menu") throw new Error("not a menu");
  const tier: Record<string, unknown> = { name: "Dragon", price: "18" };
  if (urls.length > 0) tier["imageUrls"] = [...urls];
  updateBlock(block.id, { ...block, tiers: [tier as never] });
  selectBlock(block.id);
  openFolds();
}

/** The picture fields live in the "More details" group, which starts shut. */
function openFolds(): void {
  for (const d of document.querySelectorAll("#surface details")) {
    (d as HTMLDetailsElement).open = true;
  }
}

function urls(): string[] {
  const block = getState().doc.blocks[0];
  if (block === undefined || block.kind !== "menu") throw new Error("not a menu");
  return [...((block.tiers[0] as { imageUrls?: readonly string[] }).imageUrls ?? [])];
}

function pictureInputs(): HTMLInputElement[] {
  return [...document.querySelectorAll("#surface label")]
    .filter((l) => /^Picture( \d+)? \(optional\)$/.test((l.textContent ?? "").trim()))
    .map((l) => document.getElementById(l.getAttribute("for") ?? ""))
    .filter((c): c is HTMLInputElement => c instanceof HTMLInputElement);
}

function press(label: string): void {
  const button = [...document.querySelectorAll("#surface button")].find(
    (b) => (b.getAttribute("aria-label") ?? b.textContent ?? "").trim() === label,
  );
  if (!(button instanceof HTMLButtonElement)) {
    const seen = [...document.querySelectorAll("#surface button")]
      .map((b) => (b.getAttribute("aria-label") ?? b.textContent ?? "").trim())
      .join(" | ");
    throw new Error(`no button "${label}", saw: ${seen}`);
  }
  button.click();
}

describe("how many fields are offered", () => {
  it("offers one empty field when the item has no picture", () => {
    product([]);
    expect(pictureInputs()).toHaveLength(1);
    expect(urls()).toEqual([]);
  });

  it("offers a spare field after the ones already filled in", () => {
    // The same placeholder idea the item rows use: something to type into
    // without pressing anything first.
    product(["https://e.test/a.png"]);
    const inputs = pictureInputs();
    expect(inputs).toHaveLength(2);
    expect(inputs[0]?.value).toBe("https://e.test/a.png");
    expect(inputs[1]?.value).toBe("");
  });

  it("writes nothing to the page for a spare field nobody typed into", () => {
    product(["https://e.test/a.png"]);
    expect(urls()).toEqual(["https://e.test/a.png"]);
  });
});

describe("adding a second picture", () => {
  it("appends it when the spare field is typed into", () => {
    product(["https://e.test/a.png"]);
    const spare = pictureInputs()[1];
    if (spare === undefined) throw new Error("no spare field");
    spare.value = "https://e.test/b.png";
    spare.dispatchEvent(new Event("input", { bubbles: true }));
    expect(urls()).toEqual(["https://e.test/a.png", "https://e.test/b.png"]);
  });

  it("removes the field from the item when the last address is cleared", () => {
    product(["https://e.test/a.png"]);
    const first = pictureInputs()[0];
    if (first === undefined) throw new Error("no field");
    first.value = "";
    first.dispatchEvent(new Event("input", { bubbles: true }));
    const block = getState().doc.blocks[0];
    if (block === undefined || block.kind !== "menu") throw new Error("not a menu");
    expect(block.tiers[0]).not.toHaveProperty("imageUrls");
  });
});

describe("ordering and removing pictures", () => {
  it("names the controls after the product they belong to", () => {
    // Every product has a picture 1, so without this there are as many buttons
    // called "Remove picture 1" as there are products.
    product(["https://e.test/a.png", "https://e.test/b.png"]);
    const labels = [...document.querySelectorAll("#surface button")].map(
      (b) => b.getAttribute("aria-label") ?? "",
    );
    expect(labels).toContain("Remove picture 1 in Dragon");
    expect(labels).toContain("Move picture 2 in Dragon up");
  });

  it("reorders them", () => {
    product(["https://e.test/a.png", "https://e.test/b.png"]);
    press("Move picture 1 in Dragon down");
    expect(urls()).toEqual(["https://e.test/b.png", "https://e.test/a.png"]);
  });

  it("removes one, and offers it back", () => {
    product(["https://e.test/a.png", "https://e.test/b.png"]);
    press("Remove picture 1 in Dragon");
    expect(urls()).toEqual(["https://e.test/b.png"]);

    press("Undo removing picture 1 in Dragon");
    expect(urls()).toEqual(["https://e.test/a.png", "https://e.test/b.png"]);
  });

  it("offers no move buttons when there is only one picture", () => {
    product(["https://e.test/a.png"]);
    const labels = [...document.querySelectorAll("#surface button")].map(
      (b) => b.getAttribute("aria-label") ?? "",
    );
    expect(labels.filter((l) => l.startsWith("Move picture"))).toEqual([]);
    expect(labels).toContain("Remove picture 1 in Dragon");
  });

  it("falls back to the item's number when it has no name yet", () => {
    live();
    addBlock(blankBlock("menu"));
    const block = getState().doc.blocks[0];
    if (block === undefined || block.kind !== "menu") throw new Error("not a menu");
    updateBlock(block.id, {
      ...block,
      tiers: [{ name: "", price: "18", imageUrls: ["https://e.test/a.png"] } as never],
    });
    selectBlock(block.id);
    openFolds();
    const labels = [...document.querySelectorAll("#surface button")].map(
      (b) => b.getAttribute("aria-label") ?? "",
    );
    expect(labels).toContain("Remove picture 1 in item 1");
  });
});
