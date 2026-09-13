/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, expect, it } from "vitest";
import { getState, init, subscribe } from "../src/store.js";
import { renderShell } from "../src/ui/shell.js";

let stop: (() => void) | undefined;

function live(): HTMLElement {
  document.body.innerHTML = '<div id="app"></div><div id="live-region" role="status"></div>';
  const root = document.getElementById("app");
  if (root === null) throw new Error("missing app");
  init(true);
  stop = subscribe(() => renderShell(root));
  renderShell(root);
  return root;
}

function click(label: string): void {
  const control = [...document.querySelectorAll("button")].find((node) => node.textContent === label);
  if (!(control instanceof HTMLButtonElement)) throw new Error(`missing button ${label}`);
  control.click();
}

function paste(text: string): void {
  const box = document.querySelector<HTMLTextAreaElement>(".page-paste textarea");
  if (box === null) throw new Error("missing paste box");
  box.value = text;
  box.dispatchEvent(new Event("input", { bubbles: true }));
}

beforeEach(() => {
  stop?.();
  stop = undefined;
  globalThis.indexedDB = new IDBFactory();
});

it("offers a new page from the empty state, then allows dropping and swapping", async () => {
  live();
  expect(document.querySelector(".empty")?.textContent).toMatch(/paste a page/i);
  click("Paste a page you already have");
  paste("# Shop\n\nHello there\n\nPortrait $20\nIcon $10");
  const boxes = [...document.querySelectorAll<HTMLInputElement>(".page-paste input[type=checkbox]")];
  expect(boxes).toHaveLength(3);
  expect(boxes[1]?.labels?.[0]?.textContent).toMatch(/Text.*Hello there/);
  const toDrop = boxes[1];
  if (toDrop === undefined) throw new Error("missing Text section");
  toDrop.checked = false;
  toDrop.dispatchEvent(new Event("change", { bubbles: true }));
  click("Make Prices instead of Text");
  expect(document.querySelector(".page-paste")?.textContent).toContain("Add 2 sections as a new page");
  click("Add 2 sections as a new page");
  for (let i = 0; i < 50 && getState().doc.blocks.length === 0; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  expect(getState().doc.blocks).toHaveLength(2);
});

it("replaces the proposal on a second paste and loses only the draft on close", () => {
  live();
  const original = getState().doc;
  click("Paste a page you already have");
  paste("First words");
  expect(document.querySelector(".page-paste")?.textContent).toContain("First words");
  paste("Second words");
  expect(document.querySelector(".page-paste")?.textContent).toContain("Second words");
  expect(document.querySelector(".page-paste")?.textContent).not.toContain("First words");
  click("Done pasting");
  expect(getState().pastingPage).toBeUndefined();
  expect(getState().doc).toBe(original);
});

it("keeps whitespace empty and offers a single short line honestly", () => {
  live();
  click("Paste a page you already have");
  paste("  \n ");
  expect(document.querySelector(".page-paste input[type=checkbox]")).toBeNull();
  expect(document.querySelector(".page-paste button.primary")).toBeNull();
  paste("Hello");
  expect(document.querySelector(".page-paste")?.textContent).toContain("Text");
  expect(document.querySelector(".page-paste")?.textContent).not.toMatch(/recognised a page/i);
});

it("disables confirmation when every section is dropped", () => {
  live();
  click("Paste a page you already have");
  paste("Hello");
  const checkbox = document.querySelector<HTMLInputElement>(".page-paste input[type=checkbox]");
  if (checkbox === null) throw new Error("missing section checkbox");
  checkbox.checked = false;
  checkbox.dispatchEvent(new Event("change", { bubbles: true }));
  const confirm = [...document.querySelectorAll(".page-paste button")].find((node) => node.textContent === "Add 0 sections as a new page");
  expect(confirm).toBeInstanceOf(HTMLButtonElement);
  expect((confirm as HTMLButtonElement).disabled).toBe(true);
});

it("caps the preview while retaining the full paste for conversion", () => {
  live();
  click("Paste a page you already have");
  paste(Array.from({ length: 25 }, (_, i) => `Line ${String(i)}`).join("\n"));
  const preview = document.querySelector(".page-paste-preview");
  expect(preview?.textContent).toContain("Line 19");
  expect(preview?.textContent).not.toContain("Line 20");
  expect(document.querySelector(".page-paste-body")?.textContent).toContain("5 more lines are included");
  expect(getState().pastingPage?.text).toContain("Line 24");
});
