import { findPagePasteSourceCandidates, type PagePasteReview, type PagePasteReviewRow, type PagePasteReviewSection } from "../page-paste-review.js";
import { readLines, readPagePasteTable, type PagePasteTableMapping, type ProposedSection } from "../page-text.js";
import {
  applyPagePasteSharedName, applyPagePasteSourceEdit, cancelPagePasteSourceEdit,
  clearPagePasteRowSelection, clearPagePasteTableMapping, confirmPagePaste, correctPagePasteRow,
  createPagePasteCategoryForSelected, dropPagePasteSection, getPagePasteReview, getState,
  moveSelectedPagePasteRows, restorePagePasteSection,
  pagePasteMappingLocked, pagePasteSourceHasChoices, startManualPagePasteSection,
  setPagePasteAdjustingSection, setPagePasteReviewStart, setPagePasteRowStart,
  resolvePagePasteMapping, setPagePasteSourceBuffer, setPagePasteTableMapping, setPagePasteText,
  setPagePasteAddedItem, setPagePasteEmptyHeadingChoice,
  startPagePasteSourceEdit, stopPastingPage, swapPagePasteSection, undoPagePasteTableMapping,
  togglePagePasteRowSelection, undoPagePasteSourceLine, usePagePasteSourceLine,
} from "../store.js";
import { announce, button, checkbox, el, field, select } from "./dom.js";

const DRAWN_SECTIONS = 100;
const DRAWN_LINES = 20;

// Values typed for a batch action are pending form input, not a reviewed correction.
// The source revision keeps them through UI refreshes and resets them for a new paste.
let pendingBatch: { sourceRevision: number; sharedName: string; newCategoryName: string; destinationId: string } | undefined;

interface SectionPage {
  start: number;
  rows: Record<number, number>;
}

function lockedSource(): boolean {
  return pagePasteSourceHasChoices() || getState().pastingPage?.sourceBuffer !== undefined;
}

function addDisabled(review: PagePasteReview, pending = false): boolean {
  const current = getState();
  const draft = current.pastingPage;
  return draft === undefined || review.blocks.length === 0 || !review.canConfirm || pending || draft.confirming === true ||
    draft.sourceBuffer !== undefined || draft.pendingMapping !== undefined ||
    current.pageId !== draft.originPageId || current.doc.target !== draft.target;
}

function proposedRow(row: PagePasteReviewRow, manual: boolean): string {
  const outcome = manual ? row.included === true ? "Converted to Prices." : "Kept as Text."
    : row.included === false ? "Excluded." : "Included.";
  return `Proposed: ${row.name || "No item name"}. Amount: ${row.amount || "None"}. Price: ${row.price || "No price"}. Details: ${row.details || "None"}. ${outcome}`;
}

function correctionCards(reviewed: PagePasteReviewSection, page: SectionPage, refresh: () => void): Node[] {
  const rows = reviewed.rows;
  const index = reviewed.index;
  const review = getPagePasteReview();
  if (review === undefined) return [];
  const selectedCount = review.rows.filter((row) => row.selected === true).length;
  const categoryLabel = (id: string): string => {
    const category = review.categories.find((item) => item.id === id);
    if (category === undefined) return "Choose a destination";
    return category.id.startsWith("section:")
      ? `${category.name} (source section ${String(Number(category.id.slice(8)) + 1)})`
      : category.id.startsWith("source:") ? `${category.name} (source row ${category.id.slice(7)})`
      : `${category.name} (new category ${String(review.categories.filter((item) => item.id.startsWith("new:")).findIndex((item) => item.id === id) + 1)})`;
  };
  const sourceRevision = getState().pastingPage?.sourceRevision ?? -1;
  if (pendingBatch?.sourceRevision !== sourceRevision) pendingBatch = { sourceRevision, sharedName: "", newCategoryName: "", destinationId: "" };
  const batchFields = pendingBatch;
  const manual = getState().pastingPage?.manualSections?.includes(index) === true;
  const start = Math.min(page.rows[index] ?? 0, Math.max(0, Math.floor((rows.length - 1) / CORRECTION_PAGE) * CORRECTION_PAGE));
  const end = Math.min(start + CORRECTION_PAGE, rows.length);
  const batch = selectedCount === 0
    ? el("p", { class: "hint" }, ["Select price rows below to give them one name or move them together."])
    : el("div", { class: "page-paste-batch", role: "group", "aria-label": "Change selected price rows" }, [
      el("p", {}, [`${String(selectedCount)} selected price row${selectedCount === 1 ? "" : "s"}. Selection carries across review pages.`]),
      field({ label: "Shared item name for selected rows", value: batchFields.sharedName, onInput: (value) => { batchFields.sharedName = value; } }),
      button({ label: "Use name on selected rows", onClick: () => {
        if (batchFields.sharedName.trim() === "") { announce("Enter an item name for the selected rows."); return; }
        applyPagePasteSharedName(batchFields.sharedName); batchFields.sharedName = ""; refresh();
        focusSectionButton(index, "Use name on selected rows");
      } }),
      select({ label: "Destination category for selected rows", value: batchFields.destinationId, options: [
        { value: "", label: "Choose a Prices category" },
        ...review.categories.map((category) => ({ value: category.id, label: categoryLabel(category.id) })),
      ], onChange: (value) => { batchFields.destinationId = value; } }),
      button({ label: "Move selected rows to category", onClick: () => {
        if (batchFields.destinationId === "") { announce("Choose a destination category first."); return; }
        moveSelectedPagePasteRows(batchFields.destinationId); refresh();
        focusSectionButton(index, "Move selected rows to category");
      } }),
      field({ label: "New category name", value: batchFields.newCategoryName, onInput: (value) => { batchFields.newCategoryName = value; } }),
      button({ label: "Create category and move selected rows", onClick: () => {
        if (batchFields.newCategoryName.trim() === "") { announce("Enter a new category name first."); return; }
        createPagePasteCategoryForSelected(batchFields.newCategoryName); batchFields.newCategoryName = ""; refresh();
        focusSectionButton(index, "Create category and move selected rows");
      } }),
      button({ label: "Clear selection", onClick: () => { clearPagePasteRowSelection(); refresh();
        focusSection(index, ".page-paste-select-row, .page-paste-preview"); } }),
    ]);
  return [el("div", { class: "page-paste-corrections", role: "group", "aria-label": `Adjust imported prices in section ${String(index + 1)}` }, [
    el("p", {}, [`Showing correction rows ${String(start + 1)} to ${String(end)} of ${String(rows.length)}. The original source stays above.`]),
    el("p", { class: "hint" }, ["Use Edit source to replace the pasted text. Changing corrected table columns asks what to do with your row edits."]),
    ...(manual ? [el("p", { class: "hint" }, ["Convert a Text row to Prices before selecting it for shared changes."])] : []),
    batch,
    ...rows.slice(start, end).map((row) => {
      const result = el("p", { class: "page-paste-row-result", role: "status" }, [proposedRow(row, manual)]);
      const issue = el("p", { class: "page-paste-row-issue", role: "status" }, [row.issue ?? row.warning ?? ""]);
      const numeric = checkbox({ label: `Accept ${row.name || "numeric name"} as an item name, source row ${String(row.sourceLine)}`,
        checked: row.acceptedNumericName === true,
        onChange: (acceptedNumericName) => { correctPagePasteRow(row.key, { acceptedNumericName }); refresh(); } });
      numeric.hidden = !/^\d+(?:[.,]\d+)?$/.test(row.name.trim());
      const sync = (): void => {
        const updated = getPagePasteReview();
        if (updated === undefined) return;
        const latestSection = updated.sections[index];
        const sectionElement = document.querySelector<HTMLElement>(`.page-paste-sections > li[data-section-index="${String(index)}"]`);
        if (latestSection !== undefined && sectionElement !== null) {
          const label = sectionElement.querySelector<HTMLInputElement>('input[type="checkbox"]')?.labels?.[0];
          if (label !== undefined) label.textContent = sectionLabel(latestSection);
          let sectionIssue = sectionElement.querySelector<HTMLElement>(".page-paste-section-issue");
          if (sectionIssue === null && latestSection.issue !== undefined) {
            sectionIssue = el("p", { class: "page-paste-section-issue", role: "status" });
            sectionElement.append(sectionIssue);
          }
          if (sectionIssue !== null) {
            sectionIssue.textContent = latestSection.issue ?? "";
            sectionIssue.hidden = latestSection.issue === undefined;
          }
        }
        for (const choice of document.querySelectorAll<HTMLElement>(`.page-paste-sections li[data-section-index="${String(index)}"] .page-paste-source-choice[data-source-line]`)) {
          const sourceLine = Number(choice.dataset.sourceLine);
          const role = choice.dataset.sourceRole;
          const status = choice.querySelector<HTMLElement>("[role=status]");
          const kind = updated.coverage.find((line) => line.sourceLine === sourceLine)?.kind;
          if (status !== null) status.textContent = kind === "item"
            ? `Source row ${String(sourceLine)} already makes Prices. Change that row before using it elsewhere.`
            : kind === (role === "name" ? "usedName" : "usedCategory") ? "Used once in the page."
              : `Source row ${String(sourceLine)} stays ${role === "name" ? "Text" : "Heading"} unless you use it.`;
        }
        const latest = updated.rows.find((candidate) => candidate.key === row.key);
        if (latest !== undefined) {
          result.textContent = proposedRow(latest, manual);
          issue.textContent = latest.issue ?? latest.warning ?? "";
          numeric.hidden = !/^\d+(?:[.,]\d+)?$/.test(latest.name.trim());
          const label = numeric.querySelector("label");
          if (label !== null) label.textContent = `Accept ${latest.name || "numeric name"} as an item name, source row ${String(latest.sourceLine)}`;
          const box = numeric.querySelector<HTMLInputElement>("input");
          if (box !== null) box.checked = latest.acceptedNumericName === true;
        }
        const add = document.querySelector<HTMLButtonElement>(".page-paste button.primary");
        if (add !== null) {
          add.disabled = addDisabled(updated);
          add.textContent = `Add ${String(updated.blocks.length)} section${updated.blocks.length === 1 ? "" : "s"} as a new page`;
        }
        const source = document.querySelector<HTMLTextAreaElement>(".page-paste textarea");
        if (source !== null) source.disabled = lockedSource();
        const editSource = document.querySelector<HTMLButtonElement>(".page-paste-source-tools button");
        if (editSource !== null && editSource.textContent === "Edit source") editSource.hidden = !lockedSource();
        const file = [...document.querySelectorAll<HTMLButtonElement>(".page-paste button")]
          .find((control) => control.textContent === "Read a text file from this device");
        if (file !== undefined) file.disabled = getState().pastingPage?.confirming === true;
        for (const section of document.querySelectorAll<HTMLElement>(".page-paste-sections > li")) {
          const sectionIndex = Number(section.dataset.sectionIndex);
          for (const control of section.querySelectorAll<HTMLSelectElement>(".page-paste-table select")) control.disabled = pagePasteMappingLocked(sectionIndex);
          for (const control of section.querySelectorAll<HTMLButtonElement>(".page-paste-table button"))
            if (control.textContent === "Keep this table as Text") control.disabled = pagePasteMappingLocked(sectionIndex);
        }
      };
      const edit = (fieldName: "name" | "amount" | "price" | "details", value: string): void => {
        correctPagePasteRow(row.key, fieldName === "name" ? { name: value, acceptedNumericName: false } : { [fieldName]: value });
        sync();
      };
      const selectRow = checkbox({ label: `Select source row ${String(row.sourceLine)} for group changes`, checked: row.selected === true,
        onChange: (selected) => { togglePagePasteRowSelection(row.key, selected); refresh();
          focusSection(index, `.page-paste-card[data-row-key="${row.key}"] .page-paste-select-row`); } });
      selectRow.querySelector("input")?.classList.add("page-paste-select-row");
      return el("div", { class: "page-paste-card", "data-row-key": row.key }, [
        el("strong", {}, [`Source row ${String(row.sourceLine)}`]),
        el("pre", { class: "page-paste-row-source" }, [getState().pastingPage?.text.split(/\r?\n/)[row.sourceLine - 1] ?? ""]),
        el("p", { class: "page-paste-destination" }, [`Destination: ${categoryLabel(row.destinationId)}`]),
        checkbox({ label: manual ? `Convert source row ${String(row.sourceLine)} to Prices` : `Include source row ${String(row.sourceLine)}`,
          checked: row.included === true,
          onChange: (included) => { correctPagePasteRow(row.key, { included }); refresh(); focusSection(index, `.page-paste-card[data-row-key="${row.key}"] input[type=checkbox]`); } }),
        ...(row.included === true ? [selectRow] : []),
        field({ label: `Item, source row ${String(row.sourceLine)}`, value: row.name, onInput: (value) => edit("name", value) }),
        field({ label: `Amount, source row ${String(row.sourceLine)}`, value: row.amount, onInput: (value) => edit("amount", value) }),
        field({ label: `Price, source row ${String(row.sourceLine)}`, value: row.price, onInput: (value) => edit("price", value) }),
        ...(reviewed.block.kind === "prose" && getState().pastingPage?.mappings?.[index] !== undefined &&
          row.included === true && row.amount.trim() !== "" && row.price.trim() === "" &&
          getState().pastingPage?.corrections?.[row.key]?.price === undefined
          ? [button({ label: `Keep without a price, source row ${String(row.sourceLine)}`, onClick: () => {
            correctPagePasteRow(row.key, { price: "" }); refresh();
            const card = document.querySelector(`.page-paste-card[data-row-key="${row.key}"]`);
            [...(card?.querySelectorAll<HTMLInputElement>("input[type=text]") ?? [])]
              .find((input) => input.labels?.[0]?.textContent === `Price, source row ${String(row.sourceLine)}`)?.focus();
          } })] : []),
        field({ label: `Details, source row ${String(row.sourceLine)}`, value: row.details, onInput: (value) => edit("details", value) }),
        numeric,
        issue,
        result,
      ]);
    }),
    el("div", { class: "paste-tools" }, [
      ...(start === 0 ? [] : [button({ label: `Show previous ${String(CORRECTION_PAGE)} correction rows`, onClick: () => { page.rows[index] = Math.max(0, start - CORRECTION_PAGE); setPagePasteRowStart(index, page.rows[index] ?? 0); refresh(); focusRowPager(index, "previous"); } })]),
      ...(end >= rows.length ? [] : [button({ label: `Show next ${String(Math.min(CORRECTION_PAGE, rows.length - end))} correction row${rows.length - end === 1 ? "" : "s"}`, onClick: () => { page.rows[index] = end; setPagePasteRowStart(index, end); refresh(); focusRowPager(index, "next"); } })]),
    ]),
  ])];
}

function focusTableControl(index: number, label: string): void {
  const section = document.querySelector(`.page-paste-sections li[data-section-index="${String(index)}"]`);
  const control = [...(section?.querySelectorAll<HTMLSelectElement>(".page-paste-table select") ?? [])]
    .find((candidate) => candidate.labels?.[0]?.textContent === label);
  control?.focus();
}

function focusRowPager(index: number, direction: "next" | "previous"): void {
  const section = document.querySelector(`.page-paste-sections li[data-section-index="${String(index)}"]`);
  const controls = [...(section?.querySelectorAll<HTMLButtonElement>(".page-paste-table .paste-tools button, .page-paste-corrections .paste-tools button") ?? [])];
  (controls.find((control) => control.textContent?.startsWith(`Show ${direction}`)) ?? controls[0])?.focus();
}

function focusSectionButton(index: number, label: string): void {
  const section = document.querySelector(`.page-paste-sections li[data-section-index="${String(index)}"]`);
  [...(section?.querySelectorAll<HTMLButtonElement>("button") ?? [])].find((control) => control.textContent === label)?.focus();
}

const ROW_PAGE = 20;
const CORRECTION_PAGE = 5;

function suggestedMapping(headers: readonly string[]): PagePasteTableMapping {
  const index = (pattern: RegExp, fallback: number): number => {
    const found = headers.findIndex((header) => pattern.test(header));
    return found < 0 ? fallback : found;
  };
  const product = index(/^(?:product|item|name|service)$/i, 0);
  const price = index(/^(?:price|selling price|rate)$/i, headers.length - 1);
  const size = headers.findIndex((header) => /^(?:size|quantity|unit|amount)$/i.test(header));
  return { product, price, ...(size < 0 || size === product || size === price ? {} : { size }) };
}

function tableSourceChoices(reviewed: PagePasteReviewSection, refresh: () => void): Node[] {
  const draft = getState().pastingPage;
  const review = getPagePasteReview();
  if (draft === undefined || review === undefined || !reviewed.included) return [];
  const candidates = findPagePasteSourceCandidates(draft.text, reviewed.index);
  const included = reviewed.rows.filter((row) => row.included === true);
  const selected = included.filter((row) => row.selected === true);
  const affected = selected.length > 0 ? selected.length : included.length;
  if (affected === 0) return [];
  const choices = (["name", "category"] as const).flatMap((role): Node[] => {
    const candidate = candidates[role];
    const source = candidate === undefined ? undefined : review.sections[candidate.sectionIndex];
    if (candidate === undefined || source === undefined || !source.included) return [];
    const sourceIsItem = source.rows.some((row) => row.sourceLine === candidate.sourceLine && row.included === true);
    const unavailable = draft.sourceBuffer !== undefined || draft.pendingMapping !== undefined || draft.confirming === true;
    const used = review.coverage.some((line) => line.sourceLine === candidate.sourceLine &&
      line.kind === (role === "name" ? "usedName" : "usedCategory"));
    const sourceRole = role === "name" ? "item name" : "category";
    const originalRole = role === "name" ? "Text" : "Heading";
    const useLabel = `Use source row ${String(candidate.sourceLine)} as ${sourceRole} for ${String(affected)} row${affected === 1 ? "" : "s"}`;
    const undoLabel = `Undo source row ${String(candidate.sourceLine)} ${sourceRole}${role === "category" ? " for all linked rows" : ""}`;
    const keepLabel = `Keep source row ${String(candidate.sourceLine)} as ${originalRole}`;
    return [el("div", { class: "page-paste-source-choice", role: "group",
      "aria-label": `Source row ${String(candidate.sourceLine)} ${sourceRole}`,
      "data-source-line": String(candidate.sourceLine), "data-source-role": role }, [
      el("strong", {}, [`Source row ${String(candidate.sourceLine)}: ${candidate.value}`]),
      el("p", {}, [role === "name"
        ? `Result: ${candidate.value} as item name for ${String(affected)} ${selected.length > 0 ? "selected" : "included"} price row${affected === 1 ? "" : "s"}.`
        : `Result: ${candidate.value} as Prices category for ${String(affected)} ${selected.length > 0 ? "selected" : "included"} price row${affected === 1 ? "" : "s"}.`]),
      el("p", { role: "status" }, [sourceIsItem ? `Source row ${String(candidate.sourceLine)} already makes Prices. Change that row before using it elsewhere.`
        : used ? "Used once in the page." : `Source row ${String(candidate.sourceLine)} stays ${originalRole} unless you use it.`]),
      ...(role === "category" && draft.sourceUses?.[candidate.sourceLine]?.role === role
        ? [el("p", {}, ["Keeping or undoing this heading restores it for all linked rows."])] : []),
      button({ label: useLabel, disabled: unavailable || sourceIsItem || role === "name" && source.block.kind !== "prose",
        onClick: () => { if (usePagePasteSourceLine(candidate.sourceLine, reviewed.index, role) === 0) {
          announce("This source row cannot be used now. Finish the other review choice first."); return;
        }
        refresh(); focusSectionButton(reviewed.index, undoLabel); } }),
      ...(sourceIsItem ? [] : [button({ label: keepLabel, disabled: unavailable, onClick: () => {
        undoPagePasteSourceLine(candidate.sourceLine); refresh(); focusSectionButton(reviewed.index, keepLabel);
        announce(`Source row ${String(candidate.sourceLine)} stays ${originalRole} in the page.`);
      } })]),
      ...(draft.sourceUses?.[candidate.sourceLine]?.role === role ? [button({ label: undoLabel, disabled: unavailable, onClick: () => {
        undoPagePasteSourceLine(candidate.sourceLine); refresh(); focusSectionButton(reviewed.index, useLabel);
      } })] : []),
    ])];
  });
  return choices.length === 0 ? [] : [el("div", { class: "page-paste-source-choices", role: "group",
    "aria-label": `Use original lines for table in section ${String(reviewed.index + 1)}` }, choices)];
}

function tableReview(reviewed: PagePasteReviewSection, page: SectionPage, refresh: () => void): Node[] {
  const { proposed: section, index } = reviewed;
  const table = readPagePasteTable(section);
  if (table === undefined) return [];
  const draft = getState().pastingPage;
  const mapping = draft?.mappings?.[index];
  const selected = mapping ?? suggestedMapping(table.headers);
  const options = table.headers.map((header, column) => ({ value: String(column), label: `Column ${String(column + 1)}: ${header}` }));
  const change = (role: keyof PagePasteTableMapping, value: string): void => {
    const next: { product: number; price: number; size?: number } = { ...selected };
    if (role === "size" && value === "") delete next.size;
    else {
      const desired = Number(value);
      const previous = next[role];
      const occupied = (["product", "price", "size"] as const).find((other) => other !== role && next[other] === desired);
      if (occupied !== undefined) {
        if (previous === undefined) { announce("Choose a free column before assigning Size."); refresh(); return; }
        next[occupied] = previous;
      }
      next[role] = desired;
    }
    setPagePasteTableMapping(index, next);
    page.rows[index] = 0;
    setPagePasteRowStart(index, 0);
    refresh();
    focusTableControl(index, `${role === "size" ? "Size" : role === "price" ? "Price" : "Product"} column`);
  };
  const mapped = mapping !== undefined && reviewed.block.kind === "menu";
  const invalid = mapping === undefined ? undefined : table.rows.find((row) =>
    (row.cells[mapping.product] === "" && row.cells[mapping.price] === "" && row.cells.some((cell) => cell !== ""))
    || (mapping.size !== undefined && row.cells[mapping.price] === "" && row.cells[mapping.size] !== ""));
  const start = Math.min(page.rows[index] ?? 0, Math.max(0, Math.floor((table.rows.length - 1) / ROW_PAGE) * ROW_PAGE));
  const end = Math.min(start + ROW_PAGE, table.rows.length);
  const content = el("div", { class: "page-paste-table" }, [
    el("p", {}, ["Assign the columns, then review every proposed item before adding the page."]),
    select({ label: "Product column", value: String(selected.product), options, onChange: (value) => change("product", value) }),
    select({ label: "Price column", value: String(selected.price), options, onChange: (value) => change("price", value) }),
    select({ label: "Size column", value: selected.size === undefined ? "" : String(selected.size), options: [{ value: "", label: "No size column" }, ...options], onChange: (value) => change("size", value) }),
    ...(mapping === undefined ? [button({ label: "Review these columns as Prices", onClick: () => { setPagePasteTableMapping(index, selected); refresh(); focusTableControl(index, "Product column"); } })] : []),
    ...(mapping === undefined ? [] : [button({ label: "Keep this table as Text", disabled: pagePasteMappingLocked(index), onClick: () => { clearPagePasteTableMapping(index); refresh(); focusSection(index, ".page-paste-table button"); } })]),
    ...(mapping === undefined ? [] : tableSourceChoices(reviewed, refresh)),
    ...(draft?.pendingMapping?.index !== index ? [] : [el("div", { class: "page-paste-mapping-choice", role: "group", "aria-label": "Choose how to change table columns" }, [
      el("p", {}, ["Changing this table's columns can replace row edits. Keep those edits, discard them, or cancel the change."]),
      button({ label: "Keep row edits", onClick: () => { resolvePagePasteMapping("keep"); refresh(); focusTableControl(index, "Product column"); } }),
      button({ label: "Discard row edits", onClick: () => { resolvePagePasteMapping("discard"); refresh(); focusTableControl(index, "Product column"); } }),
      button({ label: "Cancel mapping change", onClick: () => { resolvePagePasteMapping("cancel"); refresh(); focusTableControl(index, "Product column"); } }),
    ])]),
    ...(draft?.mappingUndo?.index !== index ? [] : [button({ label: "Undo mapping change", onClick: () => { undoPagePasteTableMapping(); refresh(); focusTableControl(index, "Product column"); } })]),
    ...(invalid === undefined ? [] : [el("p", {}, [`Source row ${String(invalid.line)} ${invalid.cells[mapping?.product ?? 0] === "" && invalid.cells[mapping?.price ?? 0] === ""
      ? "has no Product or Price but has another value"
      : "has Size but no Price"}. Change the columns or keep this table as Text.`])]),
    ...(mapping === undefined ? [] : draft?.adjustingSection === index ? correctionCards(reviewed, page, refresh) : [
      el("p", {}, [`Showing rows ${String(start + 1)} to ${String(end)} of ${String(table.rows.length)}.`]),
      el("ol", { class: "page-paste-rows", start: start + 1 }, table.rows.slice(start, end).map((row, offset) => {
        const rowReview = reviewed.rows[start + offset];
        return el("li", {}, [
          el("strong", {}, [`Source row ${String(row.line)}`]),
          ...(!mapped
            ? [el("p", {}, [table.headers.map((header, cell) => `${header}: ${row.cells[cell] ?? ""}`).join(". ")])]
            : [el("p", {}, [`Product: ${rowReview?.name ?? ""}. Price: ${rowReview?.price ?? ""}. Size: ${rowReview?.amount ?? ""}.`]),
              ...(rowReview?.details === "" || rowReview === undefined ? [] : [el("p", {}, [rowReview.details])])]),
        ]);
      })),
      el("div", { class: "paste-tools" }, [
        ...(start === 0 ? [] : [button({ label: `Show previous ${String(ROW_PAGE)} rows`, onClick: () => { page.rows[index] = Math.max(0, start - ROW_PAGE); setPagePasteRowStart(index, page.rows[index] ?? 0); refresh(); focusRowPager(index, "previous"); } })]),
        ...(end >= table.rows.length ? [] : [button({ label: `Show next ${String(ROW_PAGE)} rows`, onClick: () => { page.rows[index] = end; setPagePasteRowStart(index, end); refresh(); focusRowPager(index, "next"); } })]),
      ]),
    ]),
  ]);
  if (pagePasteMappingLocked(index)) for (const control of content.querySelectorAll("select")) control.disabled = true;
  return [content];
}

function kindName(kind: "heading" | "divider" | "prose" | "menu"): string {
  return { heading: "Heading", divider: "Divider", prose: "Text", menu: "Prices" }[kind];
}

function shortContent(source: string): string {
  const line = source.split("\n").find((part) => part.trim() !== "")?.trim() ?? "blank lines";
  return line.length > 100 ? `${line.slice(0, 100)}…` : line;
}

function sectionLabel(section: PagePasteReviewSection): string {
  const name = section.blocks.map((block) => kindName(block.kind)).join(", then ") || "No items yet";
  return `${name}: ${shortContent(section.proposed.source)}`;
}

function focusSection(index: number, selector: string): void {
  const item = document.querySelector(`.page-paste-sections li[data-section-index="${String(index)}"]`);
  const control = item?.querySelector<HTMLElement>(selector);
  control?.focus();
}

function preview(section: ProposedSection): Node[] {
  const lines = section.source.split("\n");
  return [
    el("pre", { class: "page-paste-preview", tabindex: "-1" }, [lines.slice(0, DRAWN_LINES).join("\n")]),
    ...(lines.length > DRAWN_LINES
      ? [el("p", { class: "paste-capped" }, [`${String(lines.length - DRAWN_LINES)} more lines are included when the page is made.`])]
      : []),
  ];
}

function emptyTableRecovery(index: number, refresh: () => void): Node[] {
  const item = getState().pastingPage?.addedItems?.[index];
  const needsBlankPriceChoice = (entry: typeof item): boolean => entry !== undefined && entry.name.trim() !== "" &&
    entry.amount.trim() !== "" && entry.price.trim() === "" && entry.allowBlankPrice !== true;
  const update = (part: "name" | "amount" | "price", value: string): void => {
    const current = getState().pastingPage?.addedItems?.[index] ?? { name: "", amount: "", price: "" };
    setPagePasteAddedItem(index, { ...current, [part]: value, allowBlankPrice: false });
    const review = getPagePasteReview();
    const add = document.querySelector<HTMLButtonElement>(".page-paste button.primary");
    if (review !== undefined && add !== null) {
      add.disabled = addDisabled(review);
      add.textContent = `Add ${String(review.blocks.length)} section${review.blocks.length === 1 ? "" : "s"} as a new page`;
      const section = review.sections[index];
      const element = document.querySelector(`.page-paste-sections li[data-section-index="${String(index)}"]`);
      if (section !== undefined && element !== null) {
        const label = element.querySelector<HTMLInputElement>("input[type=checkbox]")?.labels?.[0];
        if (label !== undefined) label.textContent = sectionLabel(section);
        const issue = element.querySelector<HTMLElement>(".page-paste-section-issue");
        if (issue !== null) issue.textContent = section.issue ?? "";
      }
      const summary = document.querySelector<HTMLElement>(".page-paste-summary");
      if (summary !== null) summary.textContent = review.blocks.length === 1
        ? "This text can make one editable section." : "Review the sections this text can make.";
      const latest = getState().pastingPage?.addedItems?.[index];
      const blankPrice = element?.querySelector<HTMLButtonElement>(".page-paste-blank-price");
      if (blankPrice !== undefined && blankPrice !== null) blankPrice.hidden = !needsBlankPriceChoice(latest);
      const choice = element?.querySelector<HTMLElement>(".page-paste-blank-price-choice");
      if (choice !== undefined && choice !== null) choice.textContent = latest?.allowBlankPrice === true &&
        latest.price.trim() === "" ? "Chosen: keep without a price." : "";
    }
  };
  const blankPrice = button({ label: "Keep without a price", onClick: () => {
    const current = getState().pastingPage?.addedItems?.[index];
    if (current === undefined) return;
    setPagePasteAddedItem(index, { ...current, allowBlankPrice: true });
    refresh();
    [...document.querySelectorAll<HTMLInputElement>(".page-paste-added-item input[type=text]")]
      .find((input) => input.labels?.[0]?.textContent === "Price")?.focus();
  } });
  blankPrice.classList.add("page-paste-blank-price");
  blankPrice.hidden = !needsBlankPriceChoice(item);
  return [el("div", { class: "page-paste-empty-table", role: "group", "aria-label": `Recover empty table in section ${String(index + 1)}` }, [
    el("p", {}, ["This table has a header but no items. Keep the header as Text, remove this section, or enter an item. Adding an item also keeps the original header as Text."]),
    el("div", { class: "paste-tools" }, [
      button({ label: "Keep header as Text", onClick: () => { setPagePasteAddedItem(index, undefined); refresh();
        focusSectionButton(index, "Keep header as Text"); } }),
      button({ label: "Remove this empty section", onClick: () => { dropPagePasteSection(index); refresh();
        focusSection(index, "input[type=checkbox]"); } }),
      button({ label: "Enter an item", onClick: () => { setPagePasteAddedItem(index, { name: "", amount: "", price: "" }); refresh();
        focusSection(index, ".page-paste-added-item input"); } }),
    ]),
    ...(item === undefined ? [] : [el("div", { class: "page-paste-added-item", role: "group", "aria-label": "New item for empty table" }, [
      field({ label: "Item name", value: item.name, onInput: (value) => update("name", value) }),
      field({ label: "Amount", value: item.amount, onInput: (value) => update("amount", value) }),
      field({ label: "Price", value: item.price, onInput: (value) => update("price", value) }),
      blankPrice,
      el("p", { class: "page-paste-blank-price-choice", role: "status" }, [item.allowBlankPrice === true &&
        item.price.trim() === "" ? "Chosen: keep without a price." : ""]),
      button({ label: "Remove new item", onClick: () => { setPagePasteAddedItem(index, undefined); refresh();
        focusSectionButton(index, "Enter an item"); } }),
    ])]),
  ])];
}

function panelBody(refresh: () => void, pending: boolean, confirm: () => void, page: SectionPage): Node[] {
  const draft = getState().pastingPage;
  if (draft === undefined || draft.text.trim() === "") return [];
  const review = getPagePasteReview();
  if (review === undefined) return [];
  const sections = review.sections;
  if (sections.length === 0) return [];
  const count = review.blocks.length;
  const lastStart = Math.max(0, Math.floor((sections.length - 1) / DRAWN_SECTIONS) * DRAWN_SECTIONS);
  const start = Math.min(page.start, lastStart);
  const end = Math.min(sections.length, start + DRAWN_SECTIONS);
  const paging: Node[] = [];
  if (start > 0) {
    const previous = Math.min(DRAWN_SECTIONS, start);
    paging.push(button({
      label: `Show previous ${String(previous)} sections`,
      onClick: () => {
        page.start = Math.max(0, start - DRAWN_SECTIONS);
        setPagePasteReviewStart(page.start);
        focusSection(page.start, "input[type=checkbox]");
      },
    }));
  }
  if (end < sections.length) {
    const next = Math.min(DRAWN_SECTIONS, sections.length - end);
    paging.push(button({
      label: `Show next ${String(next)} sections`,
      onClick: () => {
        page.start = end;
        setPagePasteReviewStart(page.start);
        focusSection(page.start, "input[type=checkbox]");
      },
    }));
  }

  return [
    el("p", { class: "page-paste-summary" }, [count === 1 ? "This text can make one editable section." : "Review the sections this text can make."]),
    ...(sections.length > DRAWN_SECTIONS
      ? [
          el("p", { class: "paste-capped" }, [`Showing sections ${String(start + 1)} to ${String(end)} of ${String(sections.length)}.`]),
          el("div", { class: "paste-tools", role: "group", "aria-label": "Review proposed sections" }, paging),
        ]
      : []),
    el("ul", { class: "page-paste-sections" }, sections.slice(start, end).map((reviewed) => {
      const { proposed: section, index, issue } = reviewed;
      const table = readPagePasteTable(section);
      const sourceLines = readLines(section.source);
      const headerOnly = table === undefined && sourceLines.filter((line) => line.kind === "tableHeader").length === 1 &&
        sourceLines.filter((line) => line.kind === "tableRule").length === 1 &&
        sourceLines.every((line) => line.kind === "tableHeader" || line.kind === "tableRule" ||
          line.kind === "blank" || line.kind === "heading" || line.kind === "headingUnderline");
      const manual = draft.manualSections?.includes(index) === true;
      const active = sections.length === 1 || draft.adjustingSection === index || draft.adjustingSection === undefined && index === start;
      return el("li", { "data-section-index": index }, [
        checkbox({
          label: sectionLabel(reviewed),
          checked: !draft.dropped.includes(index),
          onChange: (checked) => {
            if (checked) restorePagePasteSection(index);
            else dropPagePasteSection(index);
            refresh();
            focusSection(index, "input[type=checkbox]");
          },
        }),
        ...(active ? [...preview(section), ...tableReview(reviewed, page, refresh)]
          : [button({ label: `Review section ${String(index + 1)}`,
              onClick: () => { setPagePasteAdjustingSection(index); refresh(); focusSection(index, ".page-paste-preview"); } })]),
        ...(active && table === undefined && reviewed.block.kind === "menu" ? tableSourceChoices(reviewed, refresh) : []),
        ...(headerOnly ? emptyTableRecovery(index, refresh) : []),
        ...(reviewed.headingRecovery !== true ? [] : [el("div", { class: "page-paste-empty-heading", role: "group", "aria-label": `Choose original heading in section ${String(index + 1)}` }, [
          el("p", {}, ["No offers remain in this category. Keep or remove its heading before Add."]),
          ...(draft.emptyHeadingChoices?.[index] === undefined ? [] : [el("p", { role: "status" }, [
            `Chosen: ${draft.emptyHeadingChoices[index] === "keep" ? "Keep" : "Remove"} original heading`,
          ])]),
          button({ label: "Keep original heading", onClick: () => { setPagePasteEmptyHeadingChoice(index, "keep"); refresh();
            focusSectionButton(index, "Keep original heading"); } }),
          button({ label: "Remove original heading", onClick: () => { setPagePasteEmptyHeadingChoice(index, "remove"); refresh();
            focusSectionButton(index, "Remove original heading"); } }),
        ])]),
        ...((reviewed.rows.length > 0 && (reviewed.block.kind === "menu" || draft.mappings?.[index] !== undefined || manual))
          ? [button({ label: draft.adjustingSection === index ? "Close imported prices" : "Adjust imported prices",
              onClick: () => { setPagePasteAdjustingSection(draft.adjustingSection === index ? undefined : index); refresh(); focusSectionButton(index, draft.adjustingSection === index ? "Adjust imported prices" : "Close imported prices"); } })] : []),
        ...(table === undefined && !headerOnly && reviewed.block.kind === "prose" && !manual
          ? [button({ label: "Adjust as prices", onClick: () => { setPagePasteAdjustingSection(index); startManualPagePasteSection(index); page.rows[index] = 0; refresh(); focusSection(index, ".page-paste-corrections input"); } })] : []),
        ...(table === undefined && draft.adjustingSection === index && reviewed.rows.length > 0
          ? correctionCards(reviewed, page, refresh) : []),
        ...(issue === undefined && !headerOnly ? [] : [el("p", { class: "page-paste-section-issue", role: "status" }, [issue ?? ""])]),
        ...(section.swappable && issue === undefined && readPagePasteTable(section) === undefined
          ? [button({
              label: `Make ${section.kind === "prose" ? "Prices instead of Text" : "Text instead of Prices"}`,
              onClick: () => { swapPagePasteSection(index); refresh(); focusSectionButton(index, `Make ${section.kind === "prose" ? "Text instead of Prices" : "Prices instead of Text"}`); },
            })]
          : []),
      ]);
    })),
    ...(getState().pageId === draft.originPageId && getState().doc.target === draft.target ? [] : [
      el("p", { role: "status" }, ["Return to the page where you started this paste to add it. Your review stays here."]),
    ]),
    ...(lockedSource() ? [el("p", { role: "status" }, ["Use Edit source to replace the current text. Your corrections stay until you confirm the replacement."])] : []),
    button({
      label: `Add ${String(count)} section${count === 1 ? "" : "s"} as a new page`,
      variant: "primary",
      disabled: addDisabled(review, pending),
      onClick: confirm,
    }),
  ];
}

function fileControl(refresh: () => void, box: HTMLTextAreaElement): Node[] {
  const picker = el("input", {
    type: "file", accept: ".txt,.md,text/plain,text/markdown",
    class: "sr-only", "aria-hidden": "true", tabindex: "-1",
  }) as HTMLInputElement;
  const open = button({ label: "Read a text file from this device", onClick: () => picker.click() });
  const error = el("p", { class: "paste-file-error" }) as HTMLParagraphElement;
  error.hidden = true;
  picker.addEventListener("change", () => {
    const file = picker.files?.[0];
    if (file === undefined) return;
    if (file.name && !/\.(txt|md)$/i.test(file.name) && !file.type.startsWith("text/")) {
      error.textContent = "Choose a text or Markdown file. A saved page can be opened from Your pages.";
      error.hidden = false;
      announce(error.textContent);
      picker.value = "";
      return;
    }
    error.hidden = true;
    const draft = getState().pastingPage;
    open.disabled = true;
    void file.text().then((text) => {
      const latest = getState().pastingPage;
      if (draft === undefined || latest?.sourceRevision !== draft.sourceRevision ||
        latest.corrections !== draft.corrections || latest.manualSections !== draft.manualSections ||
        latest.sourceBuffer !== draft.sourceBuffer || latest.confirming === true) return;
      if (lockedSource()) startPagePasteSourceEdit(text);
      else { box.value = text; setPagePasteText(text); }
      refresh();
      announce(lockedSource() ? "Read the file into Edit source. Apply it to replace the current review." : "Read the file. Review the sections below.");
    }).catch(() => {
      if (draft !== undefined && getState().pastingPage?.sourceRevision === draft.sourceRevision) {
        error.textContent = "That file could not be read. Nothing has been changed.";
        error.hidden = false;
        announce(error.textContent);
      }
    })
      .finally(() => { open.disabled = getState().pastingPage?.confirming === true; picker.value = ""; });
  });
  return [open, picker, error];
}

function sourceEditor(refresh: () => void, box: HTMLTextAreaElement, page: SectionPage): Node[] {
  const draft = getState().pastingPage;
  if (draft === undefined || draft.confirming) return [];
  if (draft.sourceBuffer === undefined) {
    const edit = button({ label: "Edit source", onClick: () => { startPagePasteSourceEdit(); refresh();
      document.querySelector<HTMLTextAreaElement>(".page-paste-source-buffer textarea")?.focus(); } });
    edit.hidden = !lockedSource();
    return [edit];
  }
  const editor = field({ label: "Replacement source text", value: draft.sourceBuffer, multiline: true,
    onInput: setPagePasteSourceBuffer });
  return [el("div", { class: "page-paste-source-buffer", role: "group", "aria-label": "Edit source" }, [
    editor,
    el("div", { class: "paste-tools" }, [
      button({ label: "Apply source replacement", onClick: () => {
        if (applyPagePasteSourceEdit()) { box.value = getState().pastingPage?.text ?? ""; box.disabled = false;
          page.start = 0; page.rows = {}; }
        refresh();
        const choice = document.querySelector<HTMLButtonElement>(".page-paste-source-choice button");
        if (choice !== null) choice.focus();
        else if (lockedSource()) document.querySelector<HTMLButtonElement>(".page-paste-source-tools button")?.focus();
        else box.focus();
      } }),
      button({ label: "Cancel source edit", onClick: () => { cancelPagePasteSourceEdit(); refresh();
        document.querySelector<HTMLButtonElement>(".page-paste-source-tools button")?.focus(); } }),
    ]),
    ...(draft.sourceDiscardPrompt !== true ? [] : [el("div", { class: "page-paste-source-choice", role: "group", "aria-label": "Replace source choice" }, [
      el("p", {}, ["Replace this source and discard its corrections and review choices?"]),
      button({ label: "Discard corrections and replace source", onClick: () => {
        if (applyPagePasteSourceEdit(true)) { box.value = getState().pastingPage?.text ?? ""; box.disabled = false;
          page.start = 0; page.rows = {}; }
        refresh(); box.focus();
      } }),
      button({ label: "Keep original source", onClick: () => { cancelPagePasteSourceEdit(); refresh();
        document.querySelector<HTMLButtonElement>(".page-paste-source-tools button")?.focus(); } }),
    ])]),
  ])];
}

export function pagePastePanel(): HTMLElement[] {
  const draft = getState().pastingPage;
  if (draft === undefined) return [];
  const body = el("div", { class: "page-paste-body" });
  const sourceTools = el("div", { class: "page-paste-source-tools" });
  let pending = false;
  const page: SectionPage = { start: draft.reviewStart, rows: { ...draft.rowStarts } };
  // R9: repaint defers while a text field has focus. Refresh only this body so
  // the paste textarea and the Android keyboard connection remain intact.
  const confirm = (): void => {
    if (pending) return;
    pending = true;
    refresh();
    void confirmPagePaste().finally(() => { pending = false; refresh(); });
  };
  const refresh = (): void => {
    box.disabled = getState().pastingPage?.confirming === true || lockedSource();
    sourceTools.replaceChildren(...sourceEditor(refresh, box, page));
    body.replaceChildren(...panelBody(refresh, pending, confirm, page));
  };
  const input = field({
    label: "Paste the text of your page",
    value: draft.text,
    multiline: true,
    hint: "Review what it will make. Nothing is saved until you press Add.",
    onInput: (text) => { page.start = 0; page.rows = {}; setPagePasteText(text); refresh(); },
  });
  const candidate = input.querySelector("textarea");
  if (candidate === null) throw new Error("missing paste box");
  const box: HTMLTextAreaElement = candidate;
  box.disabled = draft.confirming === true || lockedSource();
  refresh();
  const files = fileControl(refresh, box);
  if (draft.confirming) for (const control of files) if (control instanceof HTMLButtonElement || control instanceof HTMLInputElement) control.disabled = true;
  return [el("div", { class: "page-paste", role: "group", "aria-label": "Paste a page you already have" }, [
    input,
    ...files,
    sourceTools,
    ...(draft.confirming ? [el("p", { role: "status" }, ["Adding this page. Please wait."])] : []),
    body,
    button({ label: "Done pasting", disabled: draft.confirming === true, onClick: () => stopPastingPage() }),
  ])];
}
