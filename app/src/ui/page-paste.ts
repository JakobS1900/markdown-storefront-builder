import { type PagePasteReview, type PagePasteReviewRow, type PagePasteReviewSection } from "../page-paste-review.js";
import { readPagePasteTable, type PagePasteTableMapping, type ProposedSection } from "../page-text.js";
import {
  clearPagePasteTableMapping, confirmPagePaste, correctPagePasteRow, dropPagePasteSection, getPagePasteReview, getState, restorePagePasteSection,
  pagePasteMappingLocked, startManualPagePasteSection,
  setPagePasteAdjustingSection, setPagePasteReviewStart, setPagePasteRowStart,
  setPagePasteTableMapping, setPagePasteText, stopPastingPage, swapPagePasteSection,
} from "../store.js";
import { announce, button, checkbox, el, field, select } from "./dom.js";

const DRAWN_SECTIONS = 100;
const DRAWN_LINES = 20;

interface SectionPage {
  start: number;
  rows: Record<number, number>;
}

function lockedSource(): boolean {
  // CHUNK 2: Phase 4 replaces this lock with buffered source replacement and a remap choice.
  const draft = getState().pastingPage;
  return Object.keys(draft?.corrections ?? {}).length > 0 || (draft?.manualSections?.length ?? 0) > 0;
}

function addDisabled(review: PagePasteReview, pending = false): boolean {
  const current = getState();
  const draft = current.pastingPage;
  return draft === undefined || review.blocks.length === 0 || !review.canConfirm || pending || draft.confirming === true ||
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
  const manual = getState().pastingPage?.manualSections?.includes(index) === true;
  const start = Math.min(page.rows[index] ?? 0, Math.max(0, Math.floor((rows.length - 1) / ROW_PAGE) * ROW_PAGE));
  const end = Math.min(start + ROW_PAGE, rows.length);
  return [el("div", { class: "page-paste-corrections", role: "group", "aria-label": `Adjust imported prices in section ${String(index + 1)}` }, [
    el("p", {}, [`Showing correction rows ${String(start + 1)} to ${String(end)} of ${String(rows.length)}. The original source stays above.`]),
    el("p", { class: "hint" }, ["Source editing is locked after a correction. Columns in corrected tables are protected; untouched tables can still be assigned."]),
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
        const file = [...document.querySelectorAll<HTMLButtonElement>(".page-paste button")]
          .find((control) => control.textContent === "Read a text file from this device");
        if (file !== undefined) file.disabled = lockedSource();
        for (const section of document.querySelectorAll<HTMLElement>(".page-paste-sections > li")) {
          const sectionIndex = Number(section.dataset.sectionIndex);
          for (const control of section.querySelectorAll<HTMLSelectElement>(".page-paste-table select")) control.disabled = pagePasteMappingLocked(sectionIndex);
          for (const control of section.querySelectorAll<HTMLButtonElement>(".page-paste-table button")) {
            if (control.textContent === "Keep this table as Text") control.disabled = pagePasteMappingLocked(sectionIndex);
          }
        }
      };
      const edit = (fieldName: "name" | "amount" | "price" | "details", value: string): void => {
        correctPagePasteRow(row.key, fieldName === "name" ? { name: value, acceptedNumericName: false } : { [fieldName]: value });
        sync();
      };
      return el("div", { class: "page-paste-card", "data-row-key": row.key }, [
        el("strong", {}, [`Source row ${String(row.sourceLine)}`]),
        el("pre", { class: "page-paste-row-source" }, [getState().pastingPage?.text.split(/\r?\n/)[row.sourceLine - 1] ?? ""]),
        checkbox({ label: manual ? `Convert source row ${String(row.sourceLine)} to Prices` : `Include source row ${String(row.sourceLine)}`,
          checked: row.included === true,
          onChange: (included) => { correctPagePasteRow(row.key, { included }); refresh(); focusSection(index, `.page-paste-card[data-row-key="${row.key}"] input[type=checkbox]`); } }),
        field({ label: `Item, source row ${String(row.sourceLine)}`, value: row.name, onInput: (value) => edit("name", value) }),
        field({ label: `Amount, source row ${String(row.sourceLine)}`, value: row.amount, onInput: (value) => edit("amount", value) }),
        field({ label: `Price, source row ${String(row.sourceLine)}`, value: row.price, onInput: (value) => edit("price", value) }),
        field({ label: `Details, source row ${String(row.sourceLine)}`, value: row.details, onInput: (value) => edit("details", value) }),
        numeric,
        issue,
        result,
      ]);
    }),
    el("div", { class: "paste-tools" }, [
      ...(start === 0 ? [] : [button({ label: `Show previous ${String(ROW_PAGE)} correction rows`, onClick: () => { page.rows[index] = Math.max(0, start - ROW_PAGE); setPagePasteRowStart(index, page.rows[index] ?? 0); refresh(); focusRowPager(index, "previous"); } })]),
      ...(end >= rows.length ? [] : [button({ label: `Show next ${String(ROW_PAGE)} correction rows`, onClick: () => { page.rows[index] = end; setPagePasteRowStart(index, end); refresh(); focusRowPager(index, "next"); } })]),
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

function suggestedMapping(headers: readonly string[]): PagePasteTableMapping {
  const index = (pattern: RegExp, fallback: number): number => {
    const found = headers.findIndex((header) => pattern.test(header));
    return found < 0 ? fallback : found;
  };
  const product = index(/^(?:product|item|name)$/i, 0);
  const price = index(/^(?:price|selling price)$/i, headers.length - 1);
  const size = headers.findIndex((header) => /^(?:size|quantity|unit|amount)$/i.test(header));
  return { product, price, ...(size < 0 || size === product || size === price ? {} : { size }) };
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
    el("p", {}, [count === 1 ? "This text can make one editable section." : "Review the sections this text can make."]),
    ...(sections.length > DRAWN_SECTIONS
      ? [
          el("p", { class: "paste-capped" }, [`Showing sections ${String(start + 1)} to ${String(end)} of ${String(sections.length)}.`]),
          el("div", { class: "paste-tools", role: "group", "aria-label": "Review proposed sections" }, paging),
        ]
      : []),
    el("ul", { class: "page-paste-sections" }, sections.slice(start, end).map((reviewed) => {
      const { proposed: section, index, issue } = reviewed;
      const name = reviewed.blocks.map((output) => kindName(output.kind)).join(", then ") || "No items yet";
      const content = shortContent(section.source);
      const table = readPagePasteTable(section);
      const manual = draft.manualSections?.includes(index) === true;
      const active = sections.length === 1 || draft.adjustingSection === index || draft.adjustingSection === undefined && index === start;
      return el("li", { "data-section-index": index }, [
        checkbox({
          label: `${name}: ${content}`,
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
        ...((reviewed.rows.length > 0 && (reviewed.block.kind === "menu" || draft.mappings?.[index] !== undefined || manual))
          ? [button({ label: draft.adjustingSection === index ? "Close imported prices" : "Adjust imported prices",
              onClick: () => { setPagePasteAdjustingSection(draft.adjustingSection === index ? undefined : index); refresh(); focusSectionButton(index, draft.adjustingSection === index ? "Adjust imported prices" : "Close imported prices"); } })] : []),
        ...(table === undefined && reviewed.block.kind === "prose" && !manual
          ? [button({ label: "Adjust as prices", onClick: () => { setPagePasteAdjustingSection(index); startManualPagePasteSection(index); page.rows[index] = 0; refresh(); focusSection(index, ".page-paste-corrections input"); } })] : []),
        ...(table === undefined && draft.adjustingSection === index && reviewed.rows.length > 0
          ? correctionCards(reviewed, page, refresh) : []),
        ...(issue === undefined ? [] : [el("p", {}, [issue])]),
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
    ...(lockedSource() ? [el("p", { role: "status" }, ["Source editing is locked while corrections are open. Corrected table columns are protected; other tables can still be assigned."])] : []),
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
  picker.addEventListener("change", () => {
    const file = picker.files?.[0];
    if (file === undefined) return;
    if (lockedSource()) {
      announce("The source is locked while corrections are open. Your current review is unchanged.");
      picker.value = "";
      return;
    }
    if (file.name.toLowerCase().endsWith(".json")) {
      announce("Choose a text or Markdown file. A saved page can be opened from Your pages.");
      picker.value = "";
      return;
    }
    const draft = getState().pastingPage;
    open.disabled = true;
    void file.text().then((text) => {
      if (draft === undefined || getState().pastingPage?.sourceRevision !== draft.sourceRevision || lockedSource()) return;
      box.value = text;
      setPagePasteText(text);
      refresh();
      announce("Read the file. Review the sections below.");
    }).catch(() => {
      if (draft !== undefined && getState().pastingPage?.sourceRevision === draft.sourceRevision) {
        announce("That file could not be read. Nothing has been changed.");
      }
    })
      .finally(() => { open.disabled = lockedSource() || getState().pastingPage?.confirming === true; picker.value = ""; });
  });
  return [open, picker];
}

export function pagePastePanel(): HTMLElement[] {
  const draft = getState().pastingPage;
  if (draft === undefined) return [];
  const body = el("div", { class: "page-paste-body" });
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
  const refresh = (): void => body.replaceChildren(...panelBody(refresh, pending, confirm, page));
  const input = field({
    label: "Paste the text of your page",
    value: draft.text,
    multiline: true,
    hint: "Review what it will make. Nothing is saved until you press Add.",
    onInput: (text) => { page.start = 0; page.rows = {}; setPagePasteText(text); refresh(); },
  });
  const box = input.querySelector("textarea");
  if (box === null) throw new Error("missing paste box");
  box.disabled = draft.confirming === true || lockedSource();
  refresh();
  const files = fileControl(refresh, box);
  if (draft.confirming || lockedSource()) for (const control of files) if (control instanceof HTMLButtonElement || control instanceof HTMLInputElement) control.disabled = true;
  return [el("div", { class: "page-paste", role: "group", "aria-label": "Paste a page you already have" }, [
    input,
    ...files,
    ...(draft.confirming ? [el("p", { role: "status" }, ["Adding this page. Please wait."])] : []),
    body,
    button({ label: "Done pasting", disabled: draft.confirming === true, onClick: () => stopPastingPage() }),
  ])];
}
