/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, expect, it } from "vitest";
import { getState, init, setSurface, subscribe } from "../src/store.js";
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
  const toDrop = boxes[0];
  if (toDrop === undefined) throw new Error("missing Heading section");
  toDrop.checked = false;
  toDrop.dispatchEvent(new Event("change", { bubbles: true }));
  click("Make Prices instead of Text");
  expect(document.querySelector(".page-paste")?.textContent).toContain("Add 2 sections as a new page");
  click("Add 2 sections as a new page");
  // Adoption happens before the page-list refresh and final session cleanup.
  // Wait for the whole confirm, or its late continuation can clear a draft in
  // the next test when the full suite makes that refresh slower.
  for (let i = 0; i < 50 && getState().pastingPage !== undefined; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  expect(getState().doc.blocks).toHaveLength(2);
  expect(getState().pastingPage).toBeUndefined();
  expect(getState().doc.blocks[0]).toMatchObject({
    kind: "menu",
    tiers: [{ name: "Hello there" }],
  });
  expect(getState().doc.blocks[1]).toMatchObject({
    kind: "menu",
    tiers: [{ name: "Portrait", price: "$20" }, { name: "Icon", price: "$10" }],
  });
});

it("explains why a wide price table stays Text in review", () => {
  live();
  click("Paste a page you already have");
  paste("| Product | Size | Price |\n| --- | --- | --- |\n| Mug | 12 oz | $28 |\n| Bowl | 16 oz | $32 |");
  const review = document.querySelector(".page-paste");
  expect(review?.textContent).toMatch(/three or more columns.*choose.*price.*Text/is);
  expect(review?.textContent).toContain("| Bowl | 16 oz | $32 |");
  expect([...document.querySelectorAll(".page-paste button")].some((node) => node.textContent === "Make Prices instead of Text")).toBe(false);
});

it("explains unsupported table syntax without offering unavailable mapping controls", () => {
  live();
  click("Paste a page you already have");
  paste("Product,Size,Price,Notes\nMug,12 oz,$28,Blue\nBowl,16 oz,$32,Red");
  expect(document.querySelector(".page-paste")?.textContent).toMatch(/remains Text.*Markdown pipe table.*header.*separator.*consistent rows/is);
  expect(document.querySelector(".page-paste-table")).toBeNull();
});

it("restores focus after changing a role and paging review rows", () => {
  live();
  click("Paste a page you already have");
  const rows = Array.from({ length: 41 }, (_, i) => `| Item ${String(i + 1)} | ${String(i + 1)} oz | $${String(i + 1)} |`);
  paste(["| Product | Size | Price |", "| --- | --- | --- |", ...rows].join("\n"));
  click("Review these columns as Prices");
  const price = [...document.querySelectorAll<HTMLSelectElement>(".page-paste-table select")].find((control) => control.labels?.[0]?.textContent === "Price column");
  if (price === undefined) throw new Error("missing Price column");
  price.focus();
  price.value = "1";
  price.dispatchEvent(new Event("change", { bubbles: true }));
  expect((document.activeElement as HTMLSelectElement).labels?.[0]?.textContent).toBe("Price column");
  const next = [...document.querySelectorAll<HTMLButtonElement>(".page-paste-table button")].find((control) => control.textContent === "Show next 20 rows");
  if (next === undefined) throw new Error("missing row page control");
  next.focus();
  next.click();
  expect((document.activeElement as HTMLButtonElement).textContent).toBe("Show next 20 rows");
});

it("moves focus to the next mapping control after Review and Keep as Text", () => {
  live();
  click("Paste a page you already have");
  paste("| Product | Size | Price |\n| --- | --- | --- |\n| Mug | 12 oz | $28 |");
  const review = [...document.querySelectorAll<HTMLButtonElement>(".page-paste-table button")]
    .find((control) => control.textContent === "Review these columns as Prices");
  if (review === undefined) throw new Error("missing Review button");
  review.focus();
  review.click();
  expect((document.activeElement as HTMLSelectElement).labels?.[0]?.textContent).toBe("Product column");
  const keep = [...document.querySelectorAll<HTMLButtonElement>(".page-paste-table button")]
    .find((control) => control.textContent === "Keep this table as Text");
  if (keep === undefined) throw new Error("missing Keep as Text button");
  keep.focus();
  keep.click();
  expect((document.activeElement as HTMLButtonElement).textContent).toBe("Review these columns as Prices");
});

it("shows labelled table roles and the final source row in bounded review", () => {
  live();
  click("Paste a page you already have");
  const rows = Array.from({ length: 100 }, (_, i) => `| Item ${String(i + 1)} | ${String(i + 1)} oz | $${String(i + 1)} | Note ${String(i + 1)} |`);
  paste(["| Product | Size | Price | Notes |", "| --- | --- | --- | --- |", ...rows].join("\n"));
  const labels = [...document.querySelectorAll<HTMLLabelElement>(".page-paste label")].map((label) => label.textContent);
  expect(labels).toEqual(expect.arrayContaining(["Product column", "Price column", "Size column"]));
  click("Review these columns as Prices");
  expect(document.querySelector<HTMLInputElement>(".page-paste input[type=checkbox]")?.labels?.[0]?.textContent).toMatch(/^Prices:/);
  expect(document.querySelector(".page-paste")?.textContent).toContain("Source row 3");
  for (let i = 0; i < 4; i += 1) click("Show next 20 rows");
  const review = document.querySelector(".page-paste")?.textContent;
  expect(review).toContain("Source row 102");
  expect(review).toContain("Note 100");
  expect(review).toContain("$100");
});

it("updates reviewed values when the seller corrects a column", () => {
  live();
  click("Paste a page you already have");
  paste("| A | B | C |\n| --- | --- | --- |\n| Mug | $28 | 12 oz |");
  click("Review these columns as Prices");
  expect(document.querySelector(".page-paste-rows")?.textContent).toContain("Price: 12 oz");
  const price = [...document.querySelectorAll<HTMLSelectElement>(".page-paste-table select")].find((control) => control.labels?.[0]?.textContent === "Price column");
  if (price === undefined) throw new Error("missing Price column");
  price.value = "1";
  price.dispatchEvent(new Event("change", { bubbles: true }));
  expect(document.querySelector(".page-paste-rows")?.textContent).toContain("Price: $28");
  expect(getState().doc.blocks).toHaveLength(0);
});

it("swaps occupied Price and Size roles when correcting a three-column table", () => {
  live();
  click("Paste a page you already have");
  paste("| Product | Size | Price |\n| --- | --- | --- |\n| Mug | $28 | 12 oz |");
  click("Review these columns as Prices");
  const price = [...document.querySelectorAll<HTMLSelectElement>(".page-paste-table select")].find((control) => control.labels?.[0]?.textContent === "Price column");
  if (price === undefined) throw new Error("missing Price column");
  price.value = "1";
  price.dispatchEvent(new Event("change", { bubbles: true }));
  expect(getState().pastingPage?.mappings?.[0]).toEqual({ product: 0, price: 1, size: 2 });
  expect(document.querySelector(".page-paste-rows")?.textContent).toContain("Price: $28. Size: 12 oz");
});

it("labels the saved result exactly and lets a mapped table return to Text", async () => {
  live();
  click("Paste a page you already have");
  const source = "# Ceramics\n\n| Product | Size | Price |\n| --- | --- | --- |\n| Mug | 12 oz | $28 |";
  paste(source);
  const label = () => document.querySelector<HTMLInputElement>(".page-paste input[type=checkbox]")?.labels?.[0]?.textContent;
  expect(label()).toMatch(/^Text:/);
  click("Review these columns as Prices");
  expect(label()).toMatch(/^Prices:/);
  expect([...document.querySelectorAll<HTMLButtonElement>(".page-paste button")].some((node) => node.textContent === "Make Text instead of Prices")).toBe(false);
  click("Keep this table as Text");
  expect(label()).toMatch(/^Text:/);
  click("Add 1 section as a new page");
  for (let i = 0; i < 50 && getState().pastingPage !== undefined; i += 1) await new Promise((resolve) => setTimeout(resolve, 10));
  expect(getState().doc.blocks).toEqual([expect.objectContaining({ kind: "prose", text: source })]);
});

it("shows an imported category in its closed Build summary", async () => {
  live();
  click("Paste a page you already have");
  paste("# Ceramics\n\n| Product | Size | Price |\n| --- | --- | --- |\n| Mug | 12 oz | $28 |");
  click("Review these columns as Prices");
  click("Add 1 section as a new page");
  for (let i = 0; i < 50 && getState().pastingPage !== undefined; i += 1) await new Promise((resolve) => setTimeout(resolve, 10));
  expect(getState().selectedBlockId).toBeUndefined();
  expect(document.querySelector("#surface .block-row > button")?.getAttribute("aria-label")).toBe("Open Prices: Ceramics, 1 item");
});

it("names the invalid late row and keeps all source rows reachable", () => {
  live();
  click("Paste a page you already have");
  const rows = Array.from({ length: 99 }, (_, i) => `| Item ${String(i + 1)} | 12 oz | $28 | Blue |`);
  paste(["| Product | Size | Price | Notes |", "| --- | --- | --- | --- |", ...rows, "| | 16 oz | | Red |"].join("\n"));
  click("Review these columns as Prices");
  expect(document.querySelector<HTMLInputElement>(".page-paste input[type=checkbox]")?.labels?.[0]?.textContent).toMatch(/^Text:/);
  expect(document.querySelector(".page-paste-table")?.textContent).toContain("Source row 102");
  expect(document.querySelector(".page-paste-rows")?.textContent).toContain("Source row 3");
  for (let i = 0; i < 4; i += 1) click("Show next 20 rows");
  expect(document.querySelector(".page-paste-rows")?.textContent).toContain("Source row 102");
  expect(document.querySelector(".page-paste-rows")?.textContent).toContain("Red");
});

it("keeps a blank Price with Size as Text through review, Preview, and Copy", async () => {
  const root = live();
  click("Paste a page you already have");
  const source = "| Product | Size | Price |\n| --- | --- | --- |\n| Mug | 12 oz | |";
  paste(source);
  click("Review these columns as Prices");
  expect(document.querySelector<HTMLInputElement>(".page-paste input[type=checkbox]")?.labels?.[0]?.textContent).toMatch(/^Text:/);
  expect(document.querySelector(".page-paste-table")?.textContent).toMatch(/Source row 3.*Size.*no Price/s);
  expect(document.querySelector(".page-paste-rows")?.textContent).toContain("Mug");
  click("Add 1 section as a new page");
  for (let i = 0; i < 50 && getState().pastingPage !== undefined; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  expect(getState().doc.blocks[0]).toMatchObject({ kind: "prose", text: source });
  setSurface("preview");
  renderShell(root);
  expect(document.querySelector("#surface .rendered")?.textContent).toContain("12 oz");
  setSurface("export");
  renderShell(root);
  expect(document.querySelector<HTMLTextAreaElement>("#output")?.value).toContain("12 oz");
});

it("offers page paste after a seller already has sections and keeps the panel open", () => {
  live();
  click("Text");
  expect(document.querySelector(".empty")).toBeNull();
  click("Paste a page you already have");
  paste("Fresh menu");
  expect(document.querySelector(".page-paste")?.textContent).toContain("Fresh menu");
  click("Heading");
  expect(document.querySelector(".page-paste")?.textContent).toContain("Fresh menu");
});

it("offers page paste on the Copy tab where clipboard work happens", () => {
  live();
  setSurface("export");
  expect(document.querySelector("main")?.textContent).toContain("Paste a page you already have");
  click("Paste a page you already have");
  expect(getState().surface).toBe("export");
  paste("Clipboard menu\n\nSketch - 30");
  expect(document.querySelector(".page-paste")?.textContent).toContain("Clipboard menu");
  expect(document.querySelector(".page-paste")?.textContent).toContain("Sketch - 30");
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

it("lets the seller review and drop sections beyond the first hundred", () => {
  live();
  click("Paste a page you already have");
  paste(Array.from({ length: 102 }, (_, i) => `Section ${String(i + 1)}`).join("\n\n"));
  expect(document.querySelectorAll(".page-paste-sections li")).toHaveLength(100);
  expect(document.querySelector(".page-paste")?.textContent).toContain("Showing sections 1 to 100 of 102");
  const next = [...document.querySelectorAll<HTMLButtonElement>(".page-paste button")]
    .find((control) => control.textContent === "Show next 2 sections");
  if (next === undefined) throw new Error("missing next sections button");
  next.focus();
  next.click();
  expect(document.querySelectorAll(".page-paste-sections li")).toHaveLength(2);
  expect(document.querySelector(".page-paste")?.textContent).toContain("Section 102");
  expect(document.activeElement).toBe(document.querySelector('.page-paste li[data-section-index="100"] input[type=checkbox]'));
  const last = [...document.querySelectorAll<HTMLInputElement>(".page-paste input[type=checkbox]")]
    .find((box) => box.labels?.[0]?.textContent?.includes("Section 102") ?? false);
  if (last === undefined) throw new Error("missing final section checkbox");
  last.focus();
  last.checked = false;
  last.dispatchEvent(new Event("change", { bubbles: true }));
  expect(document.querySelector(".page-paste")?.textContent).toContain("Add 101 sections as a new page");
  expect(document.querySelector(".page-paste")?.textContent).toContain("Showing sections 101 to 102 of 102");
  expect(document.activeElement).toBe(document.querySelector('.page-paste li[data-section-index="101"] input[type=checkbox]'));
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

function deferredFile(): { resolve: (text: string) => void } {
  const picker = document.querySelector<HTMLInputElement>(".page-paste input[type=file]");
  if (picker === null) throw new Error("missing file picker");
  let resolve: (text: string) => void = () => {};
  const pending = new Promise<string>((done) => { resolve = done; });
  const file = new File(["old text"], "page.md", { type: "text/markdown" });
  Object.defineProperty(file, "text", { value: () => pending });
  Object.defineProperty(picker, "files", { configurable: true, value: [file] });
  picker.dispatchEvent(new Event("change", { bubbles: true }));
  return { resolve };
}

it("does not replace text typed after a file read begins", async () => {
  live();
  click("Paste a page you already have");
  const read = deferredFile();
  paste("New typed text");
  read.resolve("Old file text");
  await Promise.resolve();
  expect(getState().pastingPage?.text).toBe("New typed text");
  expect(document.querySelector<HTMLTextAreaElement>(".page-paste textarea")?.value).toBe("New typed text");
});

it("reads the chosen file after a review choice changes", async () => {
  live();
  click("Paste a page you already have");
  paste("# Original\n\nText here");
  const read = deferredFile();
  const checkbox = document.querySelector<HTMLInputElement>(".page-paste input[type=checkbox]");
  if (checkbox === null) throw new Error("missing section checkbox");
  checkbox.focus();
  checkbox.checked = false;
  checkbox.dispatchEvent(new Event("change", { bubbles: true }));
  read.resolve("# New file");
  await Promise.resolve();
  expect(getState().pastingPage?.text).toBe("# New file");
});

it("does not put an old file into a newly opened paste panel", async () => {
  live();
  click("Paste a page you already have");
  const read = deferredFile();
  click("Done pasting");
  click("Paste a page you already have");
  paste("Fresh session");
  read.resolve("Old file text");
  await Promise.resolve();
  expect(getState().pastingPage?.text).toBe("Fresh session");
  expect(document.querySelector<HTMLTextAreaElement>(".page-paste textarea")?.value).toBe("Fresh session");
});

it("bounds checkbox names while keeping the longer preview visible", () => {
  live();
  click("Paste a page you already have");
  paste(`Start ${"x".repeat(1000)}\nLast line`);
  const label = document.querySelector(".page-paste input[type=checkbox]")?.nextElementSibling?.textContent ?? "";
  expect(label.length).toBeLessThan(160);
  expect(label).toContain("Start");
  expect(document.querySelector(".page-paste-preview")?.textContent).toContain("Last line");
});

it("keeps keyboard focus on the checkbox and swap control after updates", async () => {
  live();
  click("Paste a page you already have");
  paste("Hello there");
  const checkbox = document.querySelector<HTMLInputElement>(".page-paste input[type=checkbox]");
  if (checkbox === null) throw new Error("missing checkbox");
  checkbox.focus();
  checkbox.checked = false;
  checkbox.dispatchEvent(new Event("change", { bubbles: true }));
  expect(document.activeElement).toBe(document.querySelector(".page-paste input[type=checkbox]"));
  await new Promise((resolve) => setTimeout(resolve, 300));
  expect(document.activeElement).toBe(document.querySelector(".page-paste input[type=checkbox]"));
  const swap = [...document.querySelectorAll(".page-paste button")].find((node) => node.textContent === "Make Prices instead of Text");
  if (!(swap instanceof HTMLButtonElement)) throw new Error("missing swap control");
  swap.focus();
  swap.click();
  expect(document.activeElement).toBe([...document.querySelectorAll(".page-paste button")].find((node) => node.textContent === "Make Text instead of Prices"));
  await new Promise((resolve) => setTimeout(resolve, 300));
  expect(document.activeElement).toBe([...document.querySelectorAll(".page-paste button")].find((node) => node.textContent === "Make Text instead of Prices"));
});
