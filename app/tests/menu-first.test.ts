/** @vitest-environment jsdom */
import { beforeEach, expect, it } from "vitest";

import { addBlock, getState, init, selectBlock, setSurface, subscribe } from "../src/store.js";
import { blankBlock } from "../src/ui/forms.js";
import { renderShell } from "../src/ui/shell.js";

let stop: (() => void) | undefined;

function live(): HTMLElement {
  document.body.innerHTML =
    '<a class="skip" href="#surface">Skip</a><div id="app"></div>' +
    '<div id="live-region" class="sr-only" role="status" aria-live="polite"></div>';
  const root = document.getElementById("app");
  if (root === null) throw new Error("missing app");
  init(false);
  stop = subscribe(() => renderShell(root));
  renderShell(root);
  return root;
}

beforeEach(() => {
  stop?.();
  stop = undefined;
});

function click(label: string): void {
  const target = button(label);
  target.focus();
  target.click();
}

function button(label: string): HTMLButtonElement {
  const found = [...document.querySelectorAll<HTMLButtonElement>("#surface button")].find(
    (candidate) => candidate.textContent?.trim() === label,
  );
  if (found === undefined) throw new Error(`missing button ${label}`);
  return found;
}

function field(label: string, within: ParentNode = document): HTMLInputElement {
  const wrapper = [...within.querySelectorAll<HTMLLabelElement>("label")].find(
    (candidate) => candidate.textContent?.trim() === label,
  );
  const control = document.getElementById(wrapper?.htmlFor ?? "");
  if (!(control instanceof HTMLInputElement)) throw new Error(`missing field ${label}`);
  return control;
}

function type(control: HTMLInputElement, value: string): void {
  control.value = value;
  control.dispatchEvent(new Event("input", { bubbles: true }));
}

it("starts a blank menu directly with a visible category and first item", () => {
  live();
  const start = [...document.querySelectorAll<HTMLButtonElement>("#surface button")].find(
    (button) => button.textContent?.trim() === "Create a menu",
  );
  expect(start?.classList.contains("primary")).toBe(true);
  start?.click();

  expect(getState().doc.blocks).toHaveLength(1);
  expect(getState().doc.blocks[0]?.kind).toBe("menu");
  expect(document.querySelectorAll("#surface fieldset.item")).toHaveLength(1);
  const heading = field("Category");
  expect(heading.closest("details")).toBeNull();
  expect(heading.compareDocumentPosition(field("Item")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(document.querySelector("#surface")?.textContent).not.toContain("Hand-thrown mug");
});

it("names a closed Prices section by its category", () => {
  live();
  click("Create a menu");
  const category = field("Category");
  type(category, "Ceramics");
  category.blur();
  selectBlock(undefined);
  expect(button("Open Prices: Ceramics, 1 item")).not.toBeNull();
  expect(document.querySelector("#surface fieldset.item")).toBeNull();
});

it("inserts a new category beside the selected one without moving other sections", () => {
  live();
  click("Create a menu");
  const ceramicsId = getState().doc.blocks[0]?.id;
  if (ceramicsId === undefined) throw new Error("missing first category");
  addBlock(blankBlock("prose"));
  addBlock(blankBlock("gallery"));
  selectBlock(ceramicsId);

  button("Add category").click();

  expect(getState().doc.blocks.map((block) => block.kind)).toEqual(["menu", "menu", "prose", "gallery"]);
  expect(getState().selectedBlockId).toBe(getState().doc.blocks[1]?.id);
});

it("focuses the new category field after both menu creation actions", () => {
  live();
  const start = button("Create a menu");
  start.focus();
  start.click();
  expect(document.activeElement).toBe(field("Category"));

  const add = button("Add category");
  add.focus();
  add.click();
  expect(document.activeElement).toBe(field("Category"));
});

it("focuses the new item after adding a row", () => {
  live();
  click("Create a menu");
  const add = button("Add another item");
  add.focus();
  add.click();
  const rows = document.querySelectorAll("#surface fieldset.item");
  expect(rows).toHaveLength(2);
  const last = rows[1];
  if (last === undefined) throw new Error("missing new item");
  expect(document.activeElement).toBe(field("Item", last));
});

it("keeps a four-item menu editable through Build, Preview, and Copy", () => {
  const root = live();
  click("Create a menu");
  type(field("Category"), "Ceramics");
  const ceramics: [string, string][] = [
    ["Hand-thrown mug", "$28"],
    ["Speckled planter", "from $35"],
    ["Custom name plaque", "Ask me"],
  ];
  for (const [index, [name, price]] of ceramics.entries()) {
    if (index > 0) click("Add another item");
    const rows = document.querySelectorAll("#surface fieldset.item");
    const row = rows[index];
    if (row === undefined) throw new Error(`missing item ${index}`);
    type(field("Item", row), name);
    type(field("Price", row), price);
  }
  const first = document.querySelector("#surface fieldset.item");
  expect(document.querySelectorAll("#surface fieldset.item")).toHaveLength(3);
  expect(first?.querySelector("details summary")?.textContent).toContain("More details");
  expect(first?.querySelector("details")?.textContent).toContain("What the price buys (optional)");
  expect(first?.querySelector("details")?.textContent).toContain("Prices for different amounts (optional)");
  expect(first?.querySelector<HTMLButtonElement>('button[aria-label="Move item 1 down"]')).not.toBeNull();
  expect(first?.querySelector<HTMLButtonElement>('button[aria-label="Remove item 1"]')).not.toBeNull();
  click("Add category");
  type(field("Category"), "Prints");
  type(field("Item"), "Botanical print");
  type(field("Price"), "$18");

  const blocks = getState().doc.blocks;
  expect(blocks.map((block) => block.kind === "menu" ? block.heading : "")).toEqual(["Ceramics", "Prints"]);
  expect(blocks[0]?.kind === "menu" ? blocks[0].tiers.map((tier) => [tier.name, tier.price]) : []).toEqual(ceramics);
  expect(blocks[1]?.kind === "menu" ? blocks[1].tiers.map((tier) => [tier.name, tier.price]) : []).toEqual([["Botanical print", "$18"]]);
  expect(document.querySelector("#surface .block-editor")?.textContent).toContain("Category");

  setSurface("preview");
  renderShell(root);
  const preview = document.querySelector("#surface .rendered")?.textContent ?? "";
  for (const text of ["Ceramics", "Prints", ...ceramics.flat(), "Botanical print", "$18"]) {
    expect(preview).toContain(text);
  }

  setSurface("export");
  renderShell(root);
  const output = document.getElementById("output");
  if (!(output instanceof HTMLTextAreaElement)) throw new Error("missing Copy output");
  for (const text of ["Ceramics", "Prints", ...ceramics.flat(), "Botanical print", "$18"]) {
    expect(output.value).toContain(text.replaceAll("$", "&#36;"));
  }
  expect(output.value.indexOf("Ceramics")).toBeLessThan(output.value.indexOf("Prints"));
});
