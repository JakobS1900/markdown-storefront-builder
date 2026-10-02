/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { emptyDocument } from "@mdsb/engine";
import { beforeEach, expect, it } from "vitest";
import { adopt, correctPagePasteRow, createPagePasteCategoryForSelected, getPagePasteReview, getState, init,
  setPagePasteTableMapping, setSurface, startManualPagePasteSection, subscribe, togglePagePasteRowSelection } from "../src/store.js";
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

function editReviewedField(label: string, value: string): void {
  const input = [...document.querySelectorAll<HTMLInputElement>(".page-paste-corrections input[type=text]")]
    .find((node) => node.labels?.[0]?.textContent === label);
  if (input === undefined) throw new Error(`missing correction field ${label}`);
  input.focus();
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function openDetachedTable(): void {
  const table = getPagePasteReview()?.sections.find((section) => section.proposed.source.includes("| Item | Amount | Price |"));
  if (table === undefined) throw new Error("missing detached table");
  click(`Review section ${String(table.index + 1)}`);
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

it("opens labelled row corrections and shows exactly the selected result", () => {
  live();
  click("Paste a page you already have");
  paste("| Amount | Price | Item | Notes |\n| --- | --- | --- | --- |\n| 12 oz | $25 | Mug | Blue |");
  click("Review these columns as Prices");
  click("Adjust imported prices");
  expect(document.querySelector(".page-paste-preview")?.textContent).toContain("12 oz | $25 | Mug");
  expect([...document.querySelectorAll(".page-paste-corrections label")].map((node) => node.textContent)).toEqual(expect.arrayContaining([
    "Item, source row 3", "Amount, source row 3", "Price, source row 3", "Details, source row 3",
  ]));
  editReviewedField("Item, source row 3", "Large mug");
  editReviewedField("Amount, source row 3", "16 oz");
  editReviewedField("Price, source row 3", "Ask me");
  editReviewedField("Details, source row 3", "Glazed");
  expect(document.querySelector(".page-paste-row-result")?.textContent).toMatch(/Large mug.*16 oz.*Ask me.*Glazed/s);
  expect(document.querySelector<HTMLTextAreaElement>(".page-paste textarea")?.disabled).toBe(true);
  expect(document.querySelector(".page-paste")?.textContent).toMatch(/Edit source.*replace the current text/i);
});

it("applies one name and a new category to selected rows in the correction panel", () => {
  live();
  click("Paste a page you already have");
  paste("| Item | Amount | Price |\n| --- | --- | --- |\n| | 12 oz | $25 |\n| | 16 oz | $32 |");
  click("Review these columns as Prices");
  click("Adjust imported prices");
  expect(document.querySelector(".page-paste-batch")).toBeNull();
  for (const line of [3, 4]) {
    const choice = [...document.querySelectorAll<HTMLInputElement>(".page-paste-corrections input[type=checkbox]")]
      .find((node) => node.labels?.[0]?.textContent === `Select source row ${String(line)} for group changes`);
    if (choice === undefined) throw new Error(`missing row selection ${String(line)}`);
    choice.focus();
    choice.click();
    const restored = document.querySelector<HTMLInputElement>(`.page-paste-card[data-row-key="0:${String(line)}:0"] .page-paste-select-row`);
    expect(document.activeElement).toBe(restored);
  }
  const batch = document.querySelector(".page-paste-batch");
  const firstCard = document.querySelector(".page-paste-card");
  if (batch === null || firstCard === null) throw new Error("missing batch controls or card");
  expect(batch.compareDocumentPosition(firstCard) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  editReviewedField("Shared item name for selected rows", "Arrow Orb");
  click("Use name on selected rows");
  editReviewedField("New category name", "Limited figures");
  click("Create category and move selected rows");
  const cards = [...document.querySelectorAll(".page-paste-card")];
  expect(cards).toHaveLength(2);
  for (const card of cards) expect(card.textContent).toMatch(/Destination: Limited figures/);
  expect(document.querySelector(".page-paste-row-result")?.textContent).toContain("Arrow Orb");
  expect(document.querySelector<HTMLButtonElement>(".page-paste button.primary")?.disabled).toBe(false);
});

it("moves only selected rows to an existing Prices section with the same visible name", () => {
  live();
  click("Paste a page you already have");
  paste("# Ceramics\n\n| Item | Amount | Price |\n| --- | --- | --- |\n| Mug | 12 oz | $25 |\n| Bowl | 16 oz | $32 |\n\n# Ceramics\n\n| Item | Amount | Price |\n| --- | --- | --- |\n| Vase | 20 oz | $40 |");
  click("Review these columns as Prices");
  setPagePasteTableMapping(1, { product: 0, size: 1, price: 2 });
  click("Adjust imported prices");
  const chosen = [...document.querySelectorAll<HTMLInputElement>(".page-paste-corrections input[type=checkbox]")]
    .find((node) => node.labels?.[0]?.textContent === "Select source row 6 for group changes");
  if (chosen === undefined) throw new Error("missing row selection");
  chosen.click();
  const destination = [...document.querySelectorAll<HTMLSelectElement>(".page-paste-corrections select")]
    .find((node) => node.labels?.[0]?.textContent === "Destination category for selected rows");
  if (destination === undefined) throw new Error("missing destination category");
  expect([...destination.options].map((option) => option.value)).toEqual(["", "section:0", "section:1"]);
  destination.value = "section:1";
  destination.dispatchEvent(new Event("change", { bubbles: true }));
  click("Move selected rows to category");
  expect(getState().pastingPage?.corrections?.["0:6:0"]?.destinationId).toBe("section:1");
  expect(getState().pastingPage?.corrections?.["0:5:0"]?.destinationId).toBeUndefined();
});

it("offers a deliberate blank price choice before adding another corrected table row", () => {
  live();
  click("Paste a page you already have");
  paste("| Item | Amount | Price |\n| --- | --- | --- |\n| Mug | 12 oz | $25 |\n| Bowl | 16 oz | |");
  click("Review these columns as Prices");
  click("Adjust imported prices");
  editReviewedField("Item, source row 3", "Large mug");
  expect(document.querySelector<HTMLButtonElement>(".page-paste button.primary")?.disabled).toBe(true);
  expect(document.querySelector(".page-paste-corrections")?.textContent).toContain("Keep without a price, source row 4");
  const keep = [...document.querySelectorAll<HTMLButtonElement>(".page-paste-corrections button")]
    .find((node) => node.textContent === "Keep without a price, source row 4");
  keep?.focus();
  click("Keep without a price, source row 4");
  expect(getState().pastingPage?.corrections?.["0:4:0"]?.price).toBe("");
  expect(document.querySelector<HTMLButtonElement>(".page-paste button.primary")?.disabled).toBe(false);
  expect(document.querySelector(".page-paste-row-result")?.textContent).toContain("Large mug");
  const price = [...document.querySelectorAll<HTMLInputElement>('.page-paste-card[data-row-key="0:4:0"] input[type=text]')]
    .find((input) => input.labels?.[0]?.textContent === "Price, source row 4");
  expect(document.activeElement).toBe(price);
});

it("clears selected rows from both correction pages", () => {
  live();
  click("Paste a page you already have");
  paste(["| Item | Amount | Price |", "| --- | --- | --- |",
    ...Array.from({ length: 6 }, (_, index) => `| Item ${String(index + 1)} | 12 oz | $25 |`)].join("\n"));
  click("Review these columns as Prices");
  click("Adjust imported prices");
  const first = document.querySelector<HTMLInputElement>('.page-paste-card[data-row-key="0:3:0"] .page-paste-select-row');
  if (first === null) throw new Error("missing first row selection");
  first.click();
  click("Show next 1 correction row");
  const later = document.querySelector<HTMLInputElement>('.page-paste-card[data-row-key="0:8:0"] .page-paste-select-row');
  if (later === null) throw new Error("missing later row selection");
  later.click();
  expect(document.querySelector(".page-paste-batch")?.textContent).toContain("2 selected price rows");
  click("Clear selection");
  expect(document.querySelector(".page-paste-batch")).toBeNull();
  expect(getState().pastingPage?.selectedRowKeys).toEqual([]);
  click("Show previous 5 correction rows");
  expect(document.querySelector<HTMLInputElement>('.page-paste-card[data-row-key="0:3:0"] .page-paste-select-row')?.checked).toBe(false);
});

it("focuses the section preview after clearing an off-page selection with no selectable row on screen", () => {
  live();
  click("Paste a page you already have");
  const rows = Array.from({ length: 6 }, (_, index) => `| Item ${String(index + 1)} | 12 oz | $25 |`);
  paste(["| Item | Amount | Price |", "| --- | --- | --- |", ...rows].join("\n"));
  click("Review these columns as Prices");
  click("Adjust imported prices");
  const selected = document.querySelector<HTMLInputElement>('.page-paste-card[data-row-key="0:3:0"] .page-paste-select-row');
  if (selected === null) throw new Error("missing selection");
  selected.checked = true;
  selected.dispatchEvent(new Event("change", { bubbles: true }));
  click("Show next 1 correction row");
  const include = [...document.querySelectorAll<HTMLInputElement>(".page-paste-card input[type=checkbox]")]
    .find((input) => input.labels?.[0]?.textContent === "Include source row 8");
  if (include === undefined) throw new Error("missing include control");
  include.checked = false;
  include.dispatchEvent(new Event("change", { bubbles: true }));
  click("Clear selection");
  expect(document.activeElement).toBe(document.querySelector(".page-paste-preview"));
});

it("keeps unfinished group fields when selecting another row", () => {
  live();
  click("Paste a page you already have");
  paste("| Item | Amount | Price |\n| --- | --- | --- |\n| Mug | 12 oz | $25 |\n| Bowl | 16 oz | $32 |");
  click("Review these columns as Prices");
  click("Adjust imported prices");
  document.querySelector<HTMLInputElement>('.page-paste-card[data-row-key="0:3:0"] .page-paste-select-row')?.click();
  editReviewedField("Shared item name for selected rows", "Shared name in progress");
  editReviewedField("New category name", "Draft category");
  const destination = [...document.querySelectorAll<HTMLSelectElement>(".page-paste-corrections select")]
    .find((node) => node.labels?.[0]?.textContent === "Destination category for selected rows");
  if (destination === undefined) throw new Error("missing destination picker");
  destination.value = "section:0";
  destination.dispatchEvent(new Event("change", { bubbles: true }));
  document.querySelector<HTMLInputElement>('.page-paste-card[data-row-key="0:4:0"] .page-paste-select-row')?.click();
  const batchInputs = [...document.querySelectorAll<HTMLInputElement>(".page-paste-batch input[type=text]")];
  expect(batchInputs.map((input) => input.value)).toEqual(["Shared name in progress", "Draft category"]);
  expect(document.querySelector<HTMLSelectElement>(".page-paste-batch select")?.value).toBe("section:0");
  click("Use name on selected rows");
  expect(document.activeElement?.textContent).toBe("Use name on selected rows");
  expect(getState().pastingPage?.selectedRowKeys).toEqual(["0:3:0", "0:4:0"]);
});

it("distinguishes two new categories with the same visible name", () => {
  live();
  click("Paste a page you already have");
  paste("Mug - $25\nBowl - $32");
  click("Adjust imported prices");
  document.querySelector<HTMLInputElement>('.page-paste-card[data-row-key="0:1:0"] .page-paste-select-row')?.click();
  editReviewedField("New category name", "Ceramics");
  click("Create category and move selected rows");
  click("Clear selection");
  document.querySelector<HTMLInputElement>('.page-paste-card[data-row-key="0:2:0"] .page-paste-select-row')?.click();
  editReviewedField("New category name", "Ceramics");
  click("Create category and move selected rows");
  const options = [...(document.querySelector<HTMLSelectElement>(".page-paste-batch select")?.options ?? [])]
    .filter((option) => option.value.startsWith("new:"));
  expect(options.map((option) => [option.value, option.textContent])).toEqual([
    ["new:0", "Ceramics (new category 1)"], ["new:1", "Ceramics (new category 2)"],
  ]);
  expect(document.querySelector('.page-paste-card[data-row-key="0:1:0"] .page-paste-destination')?.textContent).toContain("new category 1");
  expect(document.querySelector('.page-paste-card[data-row-key="0:2:0"] .page-paste-destination')?.textContent).toContain("new category 2");
});

it("requires a name, offers numeric-name acceptance, and excludes a bad row", () => {
  live();
  click("Paste a page you already have");
  paste("| Item | Amount | Price |\n| --- | --- | --- |\n| | 12 oz | $25 |\n| 42 | 16 oz | $32 |");
  click("Review these columns as Prices");
  click("Adjust imported prices");
  expect(document.querySelector<HTMLButtonElement>(".page-paste button.primary")?.disabled).toBe(true);
  expect(document.querySelector(".page-paste-corrections")?.textContent).toMatch(/needs an item name/i);
  editReviewedField("Item, source row 3", "Mug");
  const accept = [...document.querySelectorAll<HTMLInputElement>(".page-paste-corrections input[type=checkbox]")]
    .find((node) => node.labels?.[0]?.textContent === "Accept 42 as an item name, source row 4");
  if (accept === undefined) throw new Error("missing numeric name choice");
  accept.checked = true;
  accept.dispatchEvent(new Event("change", { bubbles: true }));
  expect(document.querySelector<HTMLButtonElement>(".page-paste button.primary")?.disabled).toBe(false);
  const include = [...document.querySelectorAll<HTMLInputElement>(".page-paste-corrections input[type=checkbox]")]
    .find((node) => node.labels?.[0]?.textContent === "Include source row 3");
  if (include === undefined) throw new Error("missing include choice");
  include.checked = false;
  include.dispatchEvent(new Event("change", { bubbles: true }));
  expect(getState().pastingPage?.corrections?.["0:3:0"]?.included).toBe(false);
});

it("reveals numeric-name acceptance without replacing the focused name field", () => {
  live();
  click("Paste a page you already have");
  paste("| Item | Amount | Price |\n| --- | --- | --- |\n| Mug | 12 oz | $25 |");
  click("Review these columns as Prices");
  click("Adjust imported prices");
  editReviewedField("Item, source row 3", "42");
  const name = [...document.querySelectorAll<HTMLInputElement>(".page-paste-corrections input[type=text]")]
    .find((node) => node.labels?.[0]?.textContent === "Item, source row 3");
  expect(document.activeElement).toBe(name);
  const numeric = [...document.querySelectorAll<HTMLInputElement>(".page-paste-corrections input[type=checkbox]")]
    .find((node) => node.labels?.[0]?.textContent === "Accept 42 as an item name, source row 3");
  expect(numeric?.parentElement?.hidden).toBe(false);
  expect(document.querySelector<HTMLButtonElement>(".page-paste button.primary")?.disabled).toBe(true);
  numeric?.click();
  expect(document.querySelector<HTMLButtonElement>(".page-paste button.primary")?.disabled).toBe(false);
});

it("shows the original source beside the twenty-first correction card", () => {
  live();
  click("Paste a page you already have");
  const rows = Array.from({ length: 21 }, (_, i) => `| Item ${String(i + 1)} | 12 oz | $${String(i + 1)} | Note ${String(i + 1)} |`);
  paste(["| Item | Amount | Price | Notes |", "| --- | --- | --- | --- |", ...rows].join("\n"));
  click("Review these columns as Prices");
  click("Adjust imported prices");
  for (let i = 0; i < 3; i += 1) click("Show next 5 correction rows");
  click("Show next 1 correction row");
  expect(document.querySelectorAll(".page-paste-card")).toHaveLength(1);
  expect(document.querySelector(".page-paste-row-source")?.textContent).toBe(rows[20]);
});

it("collapses inactive mapped tables instead of rendering every row list", () => {
  live();
  click("Paste a page you already have");
  paste(Array.from({ length: 12 }, (_, i) => `| Item | Amount | Price |\n| --- | --- | --- |\n| Item ${String(i + 1)} | 12 oz | $25 |`).join("\n\n"));
  for (let i = 0; i < 12; i += 1) setPagePasteTableMapping(i, { product: 0, size: 1, price: 2 });
  expect(document.querySelectorAll(".page-paste-sections > li")).toHaveLength(12);
  expect(document.querySelectorAll(".page-paste-rows")).toHaveLength(1);
  expect(document.querySelectorAll(".page-paste-preview")).toHaveLength(1);
  click("Review section 2");
  expect(document.querySelectorAll(".page-paste-rows")).toHaveLength(0);
  expect(document.querySelectorAll(".page-paste-card")).toHaveLength(1);
  expect(document.querySelectorAll(".page-paste-preview")).toHaveLength(1);
  expect(document.querySelector('.page-paste-sections li[data-section-index="1"] .page-paste-row-source')?.textContent).toContain("Item 2");
});

it("lets an untouched second table assign columns after correcting the first", () => {
  live();
  click("Paste a page you already have");
  paste("| Item | Amount | Price |\n| --- | --- | --- |\n| Mug | 12 oz | $25 |\n\n| Item | Amount | Price |\n| --- | --- | --- |\n| Bowl | 16 oz | $32 |");
  click("Review these columns as Prices");
  click("Adjust imported prices");
  editReviewedField("Price, source row 3", "Ask me");
  click("Review section 2");
  const second = document.querySelector<HTMLElement>('.page-paste-sections > li[data-section-index="1"]');
  expect(second?.querySelector<HTMLSelectElement>(".page-paste-table select")?.disabled).toBe(false);
  const review = [...(second?.querySelectorAll<HTMLButtonElement>("button") ?? [])]
    .find((node) => node.textContent === "Review these columns as Prices");
  if (review === undefined) throw new Error("missing second table review button");
  review.click();
  expect(getState().pastingPage?.mappings?.[1]).toEqual({ product: 0, size: 1, price: 2 });
  expect(getState().pastingPage?.corrections?.["0:3:0"]?.price).toBe("Ask me");
});

it("keeps Add disabled when a row is edited after switching away from the draft page", () => {
  live();
  const original = getState();
  click("Paste a page you already have");
  paste("| Item | Amount | Price |\n| --- | --- | --- |\n| Mug | 12 oz | $25 |");
  click("Review these columns as Prices");
  click("Adjust imported prices");
  adopt("another", emptyDocument("pastebin"));
  editReviewedField("Price, source row 3", "$32");
  expect(document.querySelector<HTMLButtonElement>(".page-paste button.primary")?.disabled).toBe(true);
  adopt(original.pageId, original.doc);
});

it("offers explicit manual prices for unsupported Text while leaving unchosen lines as Text", () => {
  live();
  click("Paste a page you already have");
  paste("Product,Price\nMug,$25\nA note");
  expect(document.querySelector(".page-paste")?.textContent).toContain("Adjust as prices");
  click("Adjust as prices");
  expect(document.querySelector(".page-paste-corrections")?.textContent).toContain("Source row 2");
  const second = document.querySelector<HTMLElement>('.page-paste-card[data-row-key="0:2:0"]');
  const choice = second?.querySelector<HTMLInputElement>('input[type="checkbox"]');
  expect(choice?.labels?.[0]?.textContent).toBe("Convert source row 2 to Prices");
  expect(second?.querySelector(".page-paste-select-row")).toBeNull();
  expect(document.querySelector(".page-paste-corrections")?.textContent).toMatch(/Convert.*Prices.*select.*shared/i);
  expect(second?.querySelector(".page-paste-row-result")?.textContent).toContain("Kept as Text");
  expect(second?.querySelector(".page-paste-row-result")?.textContent).not.toContain("Excluded");
  expect(document.querySelector(".page-paste button.primary")?.textContent).toContain("1 section");
  if (!choice) throw new Error("missing manual conversion choice");
  choice.checked = true;
  choice.dispatchEvent(new Event("change", { bubbles: true }));
  expect(document.querySelector('.page-paste-card[data-row-key="0:2:0"] .page-paste-row-result')?.textContent).toContain("Converted to Prices");
  expect(document.querySelector(".page-paste button.primary")?.textContent).toContain("3 sections");
  expect(document.querySelector('.page-paste-card[data-row-key="0:2:0"] .page-paste-select-row')).not.toBeNull();
  document.querySelector<HTMLInputElement>('.page-paste-card[data-row-key="0:2:0"] .page-paste-select-row')?.click();
  expect(getState().pastingPage?.selectedRowKeys).toEqual(["0:2:0"]);
  document.querySelector<HTMLInputElement>('.page-paste-card[data-row-key="0:2:0"] input[type=checkbox]')?.click();
  expect(getState().pastingPage?.selectedRowKeys).toEqual([]);
  expect(document.querySelector('.page-paste-card[data-row-key="0:2:0"] .page-paste-select-row')).toBeNull();
  expect(document.querySelector(".page-paste-batch")).toBeNull();
  expect(document.querySelector(".page-paste button.primary")?.textContent).toContain("1 section");
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

it("rejects a non-text file chosen from an unrestricted Android document picker", () => {
  live();
  click("Paste a page you already have");
  const picker = document.querySelector<HTMLInputElement>(".page-paste input[type=file]");
  if (picker === null) throw new Error("missing file picker");
  const file = new File(["binary"], "photo.png", { type: "image/png" });
  Object.defineProperty(picker, "files", { configurable: true, value: [file] });
  picker.dispatchEvent(new Event("change", { bubbles: true }));
  expect(getState().pastingPage?.text).toBe("");
  expect(document.getElementById("live-region")?.textContent).toContain("text or Markdown file");
  expect(document.querySelector(".page-paste .paste-file-error")?.textContent).toContain("text or Markdown file");
  expect(document.querySelector<HTMLParagraphElement>(".page-paste .paste-file-error")?.hidden).toBe(false);
});

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

it("does not replace corrected source when an earlier file read completes", async () => {
  live();
  click("Paste a page you already have");
  paste("Mug - $25\nBowl - $32");
  const read = deferredFile();
  click("Adjust imported prices");
  editReviewedField("Price, source row 1", "Ask me");
  read.resolve("Old file text");
  await Promise.resolve();
  expect(getState().pastingPage?.text).toBe("Mug - $25\nBowl - $32");
  expect(getState().pastingPage?.corrections?.["0:1:0"]?.price).toBe("Ask me");
  expect([...document.querySelectorAll<HTMLButtonElement>(".page-paste button")].find((node) => node.textContent === "Read a text file from this device")?.disabled).toBe(false);
});

it("opens a file chosen after corrections in the replacement buffer", async () => {
  live();
  click("Paste a page you already have");
  paste("| Item | Amount | Price |\n| --- | --- | --- |\n| Mug | 12 oz | $25 |");
  click("Review these columns as Prices");
  click("Adjust imported prices");
  editReviewedField("Price, source row 3", "Ask me");
  const read = deferredFile();
  read.resolve("Bowl - $32");
  await Promise.resolve();
  expect(getState().pastingPage?.text).toContain("Mug | 12 oz | $25");
  expect(getState().pastingPage?.sourceBuffer).toBe("Bowl - $32");
  click("Apply source replacement");
  click("Discard corrections and replace source");
  expect(getState().pastingPage?.text).toBe("Bowl - $32");
  expect(getState().pastingPage?.corrections).toBeUndefined();
});

it("keeps composed source text in a buffer across a page switch and cancel", () => {
  live();
  const original = getState();
  click("Paste a page you already have");
  paste("| Item | Amount | Price |\n| --- | --- | --- |\n| Mug | 12 oz | $25 |");
  click("Review these columns as Prices");
  click("Edit source");
  expect(document.querySelector<HTMLButtonElement>(".page-paste button.primary")?.disabled).toBe(true);
  const buffer = document.querySelector<HTMLTextAreaElement>(".page-paste-source-buffer textarea");
  if (buffer === null) throw new Error("missing buffer");
  buffer.focus();
  buffer.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
  buffer.value = "手作 Mug - $25";
  buffer.dispatchEvent(new InputEvent("input", { bubbles: true, isComposing: true }));
  buffer.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true }));
  expect(getState().pastingPage?.sourceBuffer).toBe("手作 Mug - $25");
  expect(getState().pastingPage?.text).toContain("Mug | 12 oz | $25");
  adopt("another", emptyDocument("pastebin"));
  expect(getState().pastingPage?.sourceBuffer).toBe("手作 Mug - $25");
  adopt(original.pageId, original.doc);
  click("Cancel source edit");
  expect(getState().pastingPage?.sourceBuffer).toBeUndefined();
  expect(getState().pastingPage?.mappings?.[0]).toEqual({ product: 0, price: 2, size: 1 });
});

it("edits a separate source buffer, cancels it, and asks before discarding corrections", () => {
  live();
  click("Paste a page you already have");
  paste("| Item | Amount | Price |\n| --- | --- | --- |\n| Mug | 12 oz | $25 |");
  click("Review these columns as Prices");
  click("Adjust imported prices");
  editReviewedField("Price, source row 3", "Ask me");
  click("Edit source");
  const buffer = document.querySelector<HTMLTextAreaElement>(".page-paste-source-buffer textarea");
  expect(buffer?.value).toContain("Mug | 12 oz | $25");
  if (buffer === null) throw new Error("missing source buffer");
  buffer.value = "Bowl - $32";
  buffer.dispatchEvent(new Event("input", { bubbles: true }));
  expect(getState().pastingPage?.text).toContain("Mug | 12 oz | $25");
  click("Cancel source edit");
  expect(getState().pastingPage?.corrections?.["0:3:0"]?.price).toBe("Ask me");
  click("Edit source");
  const replacement = document.querySelector<HTMLTextAreaElement>(".page-paste-source-buffer textarea");
  if (replacement === null) throw new Error("missing source buffer");
  replacement.value = "Bowl - $32";
  replacement.dispatchEvent(new Event("input", { bubbles: true }));
  click("Apply source replacement");
  expect(document.querySelector(".page-paste-source-choice")?.textContent).toMatch(/discard.*corrections/i);
  click("Keep original source");
  expect(getState().pastingPage?.text).toContain("Mug | 12 oz | $25");
});

it("closes Edit source without a warning when no text changed", () => {
  live();
  click("Paste a page you already have");
  paste("| Item | Amount | Price |\n| --- | --- | --- |\n| Mug | 12 oz | $25 |");
  click("Review these columns as Prices");
  click("Adjust imported prices");
  editReviewedField("Price, source row 3", "Ask me");
  click("Edit source");
  click("Apply source replacement");
  expect(document.querySelector(".page-paste-source-choice")).toBeNull();
  expect(getState().pastingPage?.sourceBuffer).toBeUndefined();
  expect(getState().pastingPage?.corrections?.["0:3:0"]?.price).toBe("Ask me");
  expect(document.activeElement?.textContent).toBe("Edit source");
});

it("asks before remapping a corrected table and restores the focused mapping after undo", () => {
  live();
  click("Paste a page you already have");
  paste("| Item | Amount | Price |\n| --- | --- | --- |\n| Mug | 12 oz | $25 |");
  click("Review these columns as Prices");
  click("Adjust imported prices");
  editReviewedField("Price, source row 3", "Ask me");
  const product = [...document.querySelectorAll<HTMLSelectElement>(".page-paste-table select")]
    .find((control) => control.labels?.[0]?.textContent === "Product column");
  if (product === undefined) throw new Error("missing Product column");
  product.value = "2";
  product.dispatchEvent(new Event("change", { bubbles: true }));
  expect(document.querySelector<HTMLButtonElement>(".page-paste button.primary")?.disabled).toBe(true);
  expect(document.querySelector(".page-paste-mapping-choice")?.textContent).toMatch(/keep.*edits.*discard/i);
  click("Keep row edits");
  expect(getState().pastingPage?.mappings?.[0]?.product).toBe(2);
  click("Undo mapping change");
  expect(getState().pastingPage?.mappings?.[0]?.product).toBe(0);
  expect(document.activeElement).toBe([...document.querySelectorAll<HTMLSelectElement>(".page-paste-table select")]
    .find((control) => control.labels?.[0]?.textContent === "Product column"));
});

it("asks what to do with a heading after moving its only item", () => {
  live();
  click("Paste a page you already have");
  paste("# Ceramics\n| Item | Amount | Price |\n| --- | --- | --- |\n| Mug | 12 oz | $25 |");
  click("Review these columns as Prices");
  togglePagePasteRowSelection("0:4:0", true);
  createPagePasteCategoryForSelected("Gifts");
  expect(document.querySelector<HTMLButtonElement>(".page-paste button.primary")?.disabled).toBe(true);
  expect(document.querySelector(".page-paste-empty-heading")?.textContent).toMatch(/keep.*remove/i);
  click("Remove original heading");
  expect(getPagePasteReview()?.blocks.map((block) => block.kind)).toEqual(["menu"]);
  expect(document.activeElement?.textContent).toBe("Remove original heading");
  expect(document.querySelector(".page-paste-empty-heading")?.textContent).toContain("Chosen: Remove original heading");
});

it("asks what to do with a heading after excluding its only mapped item", () => {
  live();
  click("Paste a page you already have");
  paste("# Ceramics\n| Item | Amount | Price |\n| --- | --- | --- |\n| Mug | 12 oz | $25 |\n\n# About\nHandmade goods");
  click("Review these columns as Prices");
  click("Adjust imported prices");
  const include = [...document.querySelectorAll<HTMLInputElement>(".page-paste-card input[type=checkbox]")]
    .find((input) => input.labels?.[0]?.textContent === "Include source row 4");
  if (include === undefined) throw new Error("missing include control");
  include.checked = false;
  include.dispatchEvent(new Event("change", { bubbles: true }));
  expect(document.querySelector<HTMLButtonElement>(".page-paste button.primary")?.disabled).toBe(true);
  expect(document.querySelector(".page-paste-empty-heading")?.textContent).toContain("No offers remain in this category");
  click("Keep original heading");
  expect(document.querySelector<HTMLButtonElement>(".page-paste button.primary")?.disabled).toBe(false);
  expect(getPagePasteReview()?.blocks.map((block) => block.kind)).toContain("heading");
});

it("offers item entry and Text preservation for a header-only table", () => {
  live();
  click("Paste a page you already have");
  paste("| Item | Amount | Price |\n| --- | --- | --- |");
  expect(document.querySelector(".page-paste-empty-table")?.textContent).toMatch(/keep.*Text.*remove.*enter an item/is);
  expect(document.querySelector(".page-paste-empty-table")?.textContent).toContain("Adding an item also keeps the original header as Text");
  click("Enter an item");
  const fields = [...document.querySelectorAll<HTMLInputElement>(".page-paste-added-item input[type=text]")];
  expect(fields.map((input) => input.labels?.[0]?.textContent)).toEqual(["Item name", "Amount", "Price"]);
  expect(document.querySelector<HTMLButtonElement>(".page-paste button.primary")?.disabled).toBe(true);
  for (const [index, value] of ["Mug", "12 oz", "$25"].entries()) {
    const input = fields[index];
    if (input === undefined) throw new Error("missing added item field");
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }
  expect(getPagePasteReview()?.blocks.map((block) => block.kind)).toEqual(["prose", "menu"]);
  click("Keep header as Text");
  expect(getPagePasteReview()?.blocks.map((block) => block.kind)).toEqual(["prose"]);
});

it("does not call a malformed table with a data row empty", () => {
  live();
  click("Paste a page you already have");
  paste("| Item | Amount | Price |\n| --- | --- | --- |\n| Mug | 12 oz |");
  expect(document.querySelector(".page-paste-empty-table")).toBeNull();
  expect(document.querySelector(".page-paste-sections")?.textContent).toContain("This table remains Text");
  expect(getPagePasteReview()?.blocks.map((block) => block.kind)).toEqual(["prose"]);
});

it("shows exact detached source choices for an included table and uses all its rows", () => {
  live();
  click("Paste a page you already have");
  paste("# Figures\n\nArrow Orb\n\n| Item | Amount | Price |\n| --- | --- | --- |\n| | 12 oz | $25 |\n| | 16 oz | $32 |");
  openDetachedTable();
  click("Review these columns as Prices");
  const choices = document.querySelector(".page-paste-source-choices");
  expect(choices?.textContent).toContain("Source row 3: Arrow Orb");
  expect(choices?.textContent).toContain("Source row 1: Figures");
  expect(choices?.textContent).toContain("2 included price rows");
  expect(choices?.textContent).toContain("Keep source row 3 as Text");
  expect(choices?.textContent).toContain("Keep source row 1 as Heading");
  click("Keep source row 3 as Text");
  expect(getPagePasteReview()?.coverage.find((line) => line.sourceLine === 3)?.kind).toBe("text");
  click("Use source row 3 as item name for 2 rows");
  click("Use source row 1 as category for 2 rows");
  expect(document.querySelector(".page-paste-source-choices")?.textContent).toContain("all linked rows");
  expect(document.querySelector(".page-paste-destination")?.textContent).toContain("Figures (source row 1)");
  expect(getPagePasteReview()?.sections.at(-1)?.rows.map((row) => [row.name, row.destinationId]))
    .toEqual([["Arrow Orb", "source:1"], ["Arrow Orb", "source:1"]]);
  expect(getPagePasteReview()?.coverage.filter((line) => line.kind === "usedName" || line.kind === "usedCategory"))
    .toMatchObject([{ sourceLine: 1, kind: "usedCategory" }, { sourceLine: 3, kind: "usedName" }]);
  expect(document.querySelector(".page-paste-source-choices")?.textContent).toContain("Used once in the page");
  click("Undo source row 3 item name");
  expect(getPagePasteReview()?.coverage.find((line) => line.sourceLine === 3)?.kind).toBe("text");
  expect(document.activeElement?.textContent).toBe("Use source row 3 as item name for 2 rows");
});

it("uses only selected rows in the current table when choosing a detached source", () => {
  live();
  click("Paste a page you already have");
  paste("Arrow Orb\n\n| Item | Amount | Price |\n| --- | --- | --- |\n| | 12 oz | $25 |\n| | 16 oz | $32 |");
  openDetachedTable();
  click("Review these columns as Prices");
  const first = getPagePasteReview()?.sections.at(-1)?.rows[0];
  if (first === undefined) throw new Error("missing mapped row");
  togglePagePasteRowSelection(first.key, true);
  expect(document.querySelector(".page-paste-source-choices")?.textContent).toContain("1 selected price row");
  click("Use source row 1 as item name for 1 row");
  expect(getPagePasteReview()?.sections.at(-1)?.rows.map((row) => row.name)).toEqual(["Arrow Orb", ""]);
});

it("keeps exact source controls reachable when the heading is on an earlier review page", () => {
  live();
  click("Paste a page you already have");
  paste([...Array.from({ length: 99 }, (_, index) => `Section ${String(index + 1)}`),
    "# Figures", "Arrow Orb", "| Item | Amount | Price |\n| --- | --- | --- |\n| | 12 oz | $25 |"].join("\n\n"));
  click("Show next 2 sections");
  openDetachedTable();
  click("Review these columns as Prices");
  expect(document.querySelector(".page-paste-source-choices")?.textContent).toContain("Figures");
  click("Use source row 199 as category for 1 row");
  expect(getPagePasteReview()?.coverage.find((line) => line.sourceLine === 199)?.kind).toBe("usedCategory");
  expect(document.activeElement?.textContent).toBe("Undo source row 199 category for all linked rows");
});

it("offers detached source choices for a native two-column quantity table", () => {
  live();
  click("Paste a page you already have");
  paste("# Figures\n\nHandmade\n\n| Arrow Orb | Price |\n| --- | --- |\n| 12 oz | $25 |");
  const table = getPagePasteReview()?.sections.find((section) => section.proposed.source.includes("| Arrow Orb | Price |"));
  if (table === undefined) throw new Error("missing quantity table");
  click(`Review section ${String(table.index + 1)}`);
  expect(document.querySelector(".page-paste-source-choices")?.textContent).toContain("Source row 3: Handmade");
  click("Use source row 3 as item name for 1 row");
  expect(getPagePasteReview()?.sections[table.index]?.rows[0]?.name).toBe("Handmade");
});

it("keeps an explicitly retained name as Text after a later matching edit", () => {
  live();
  click("Paste a page you already have");
  paste("Arrow Orb\n\n| Item | Amount | Price |\n| --- | --- | --- |\n| | 12 oz | $25 |");
  openDetachedTable();
  click("Review these columns as Prices");
  click("Use source row 1 as item name for 1 row");
  editReviewedField("Item, source row 5", "Comet");
  expect(getPagePasteReview()?.coverage.find((line) => line.sourceLine === 1)?.kind).toBe("text");
  click("Keep source row 1 as Text");
  editReviewedField("Item, source row 5", "Arrow Orb");
  expect(getState().pastingPage?.sourceUses?.[1]).toBeUndefined();
  expect(getPagePasteReview()?.coverage.find((line) => line.sourceLine === 1)?.kind).toBe("text");
});

it("disables detached source actions during source replacement and mapping decisions", () => {
  live();
  click("Paste a page you already have");
  paste("Arrow Orb\n\n| Item | Amount | Price |\n| --- | --- | --- |\n| | 12 oz | $25 |");
  openDetachedTable();
  click("Review these columns as Prices");
  click("Use source row 1 as item name for 1 row");
  click("Edit source");
  expect([...document.querySelectorAll<HTMLButtonElement>(".page-paste-source-choices button")]
    .every((control) => control.disabled)).toBe(true);
  click("Cancel source edit");
  expect(document.querySelector<HTMLButtonElement>(".page-paste-source-choices button")?.disabled).toBe(false);
  editReviewedField("Price, source row 5", "Ask me");
  const product = [...document.querySelectorAll<HTMLSelectElement>(".page-paste-table select")]
    .find((control) => control.labels?.[0]?.textContent === "Product column");
  if (product === undefined) throw new Error("missing Product column");
  product.value = "2";
  product.dispatchEvent(new Event("change", { bubbles: true }));
  expect(getState().pastingPage?.pendingMapping).toBeDefined();
  expect([...document.querySelectorAll<HTMLButtonElement>(".page-paste-source-choices button")]
    .every((control) => control.disabled)).toBe(true);
});

it("does not offer a detached name already converted to a price item", () => {
  live();
  click("Paste a page you already have");
  paste("Arrow Orb\n\n| Item | Amount | Price |\n| --- | --- | --- |\n| | 12 oz | $25 |");
  openDetachedTable();
  click("Review these columns as Prices");
  startManualPagePasteSection(0);
  correctPagePasteRow("0:1:0", { included: true, name: "Separate item", price: "$9" });
  expect(document.querySelector(".page-paste-source-choices")?.textContent).toContain("already makes Prices");
  expect([...document.querySelectorAll<HTMLButtonElement>(".page-paste-source-choices button")]
    .find((control) => control.textContent === "Use source row 1 as item name for 1 row")?.disabled).toBe(true);
  editReviewedField("Price, source row 5", "$28");
  expect(document.querySelector(".page-paste-source-choices")?.textContent).toContain("already makes Prices");
  expect([...document.querySelectorAll<HTMLButtonElement>(".page-paste-source-choices button")]
    .find((control) => control.textContent === "Use source row 1 as item name for 1 row")?.disabled).toBe(true);
});

it("states that undoing a heading restores every linked table", () => {
  live();
  click("Paste a page you already have");
  paste("# Figures\n\n| Item | Amount | Price |\n| --- | --- | --- |\n| Mug | 12 oz | $25 |\n\n| Item | Amount | Price |\n| --- | --- | --- |\n| Bowl | 16 oz | $32 |");
  click("Review these columns as Prices");
  click("Use source row 1 as category for 1 row");
  click("Review section 2");
  click("Review these columns as Prices");
  click("Use source row 1 as category for 1 row");
  const before = getPagePasteReview()?.rows.map((row) => row.destinationId);
  expect(before).toEqual(["source:1", "source:1"]);
  click("Undo source row 1 category for all linked rows");
  expect(getPagePasteReview()?.rows.map((row) => row.destinationId)).not.toContain("source:1");
  expect(document.activeElement?.textContent).toBe("Use source row 1 as category for 1 row");
});

it("updates the section summary when a corrected price makes a table publishable", () => {
  live();
  click("Paste a page you already have");
  paste("| Item | Amount | Price |\n| --- | --- | --- |\n| Mug | 12 oz | |");
  click("Review these columns as Prices");
  click("Adjust imported prices");
  const section = document.querySelector('.page-paste-sections > li[data-section-index="0"]');
  const label = section?.querySelector<HTMLInputElement>('input[type="checkbox"]')?.labels?.[0];
  const issue = section?.querySelector<HTMLElement>(".page-paste-section-issue");
  expect(label?.textContent).toMatch(/^Text:/);
  expect(issue?.textContent).toMatch(/correct or exclude/i);
  editReviewedField("Price, source row 3", "$25");
  expect(label?.textContent).toMatch(/^Prices:/);
  expect(issue?.textContent).toBe("");
  expect(document.querySelector<HTMLButtonElement>(".page-paste button.primary")?.disabled).toBe(false);
});

it("updates the live section proposal while composing a new item name", () => {
  live();
  click("Paste a page you already have");
  paste("| Item | Amount | Price |\n| --- | --- | --- |");
  click("Enter an item");
  const input = document.querySelector<HTMLInputElement>(".page-paste-added-item input[type=text]");
  if (input === null) throw new Error("missing item name");
  input.focus();
  expect(document.querySelector(".page-paste-section-issue")?.textContent).toContain("Name the new item");
  input.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
  input.value = "手作 Mug";
  input.dispatchEvent(new InputEvent("input", { bubbles: true, isComposing: true }));
  expect(document.activeElement).toBe(input);
  expect(document.querySelector(".page-paste-added-item input[type=text]")).toBe(input);
  expect(document.querySelector<HTMLInputElement>(".page-paste-sections input[type=checkbox]")?.labels?.[0]?.textContent)
    .toMatch(/^Text, then Prices:/);
  expect(document.querySelector(".page-paste-section-issue")?.textContent)
    .toBe(getPagePasteReview()?.sections[0]?.issue ?? "");
  input.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true }));
});

it("asks before keeping a new amount without a price", () => {
  live();
  click("Paste a page you already have");
  paste("| Item | Amount | Price |\n| --- | --- | --- |");
  click("Enter an item");
  for (const [label, value] of [["Item name", "Mug"], ["Amount", "12 oz"]] as const) {
    const input = [...document.querySelectorAll<HTMLInputElement>(".page-paste-added-item input[type=text]")]
      .find((field) => field.labels?.[0]?.textContent === label);
    if (input === undefined) throw new Error(`missing ${label}`);
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }
  expect(document.querySelector<HTMLButtonElement>(".page-paste button.primary")?.disabled).toBe(true);
  expect(document.querySelector(".page-paste-section-issue")?.textContent).toMatch(/price/i);
  click("Keep without a price");
  expect(document.querySelector<HTMLButtonElement>(".page-paste button.primary")?.disabled).toBe(false);
  expect(document.querySelector(".page-paste-added-item")?.textContent).toContain("Chosen: keep without a price");
});

it("pauses Add with an explanation after switching away from the starting page", () => {
  live();
  const original = getState();
  click("Paste a page you already have");
  paste("Mug $28");
  adopt("another", emptyDocument("pastebin"));
  const add = [...document.querySelectorAll<HTMLButtonElement>(".page-paste button")]
    .find((control) => control.textContent === "Add 1 section as a new page");
  expect(add?.disabled).toBe(true);
  expect(document.querySelector(".page-paste")?.textContent).toMatch(/Return to the page where you started this paste/);
  adopt(original.pageId, original.doc);
  expect([...document.querySelectorAll<HTMLButtonElement>(".page-paste button")]
    .find((control) => control.textContent === "Add 1 section as a new page")?.disabled).toBe(false);
});

it("names the actual Prices and Text output when one source section splits", () => {
  live();
  click("Paste a page you already have");
  paste("Mug - $28\n* \nBowl - $32");
  expect(document.querySelector(".page-paste input[type=checkbox]")?.nextElementSibling?.textContent).toMatch(/^Prices, then Text, then Prices:/);
  expect(document.querySelector(".page-paste button.primary")?.textContent).toBe("Add 3 sections as a new page");
});

it("buffers a chosen file after a review choice changes", async () => {
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
  expect(getState().pastingPage?.text).toBe("# Original\n\nText here");
  expect(getState().pastingPage?.sourceBuffer).toBe("# New file");
  click("Apply source replacement");
  expect(getState().pastingPage?.sourceDiscardPrompt).toBe(true);
  click("Keep original source");
  expect(getState().pastingPage?.dropped).toEqual([0]);
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
