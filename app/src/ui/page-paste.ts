import { buildMappedPagePasteBlock, buildProposedBlock, mapPagePasteTable, pagePasteConversionIssue, readPagePasteTable, readProposal, swapProposalKind, type PagePasteTableMapping, type ProposedSection } from "../page-text.js";
import {
  clearPagePasteTableMapping, confirmPagePaste, dropPagePasteSection, getState, restorePagePasteSection,
  setPagePasteReviewStart, setPagePasteTableMapping, setPagePasteText, stopPastingPage, swapPagePasteSection,
} from "../store.js";
import { announce, button, checkbox, el, field, select } from "./dom.js";

const DRAWN_SECTIONS = 100;
const DRAWN_LINES = 20;

interface SectionPage {
  start: number;
  rows: Record<number, number>;
}

function focusTableControl(index: number, label: string): void {
  const section = document.querySelector(`.page-paste-sections li[data-section-index="${String(index)}"]`);
  const control = [...(section?.querySelectorAll<HTMLSelectElement>(".page-paste-table select") ?? [])]
    .find((candidate) => candidate.labels?.[0]?.textContent === label);
  control?.focus();
}

function focusRowPager(index: number, direction: "next" | "previous"): void {
  const section = document.querySelector(`.page-paste-sections li[data-section-index="${String(index)}"]`);
  const controls = [...(section?.querySelectorAll<HTMLButtonElement>(".page-paste-table .paste-tools button") ?? [])];
  (controls.find((control) => control.textContent?.startsWith(`Show ${direction}`)) ?? controls[0])?.focus();
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

function tableReview(section: ProposedSection, index: number, page: SectionPage, refresh: () => void): Node[] {
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
    refresh();
    focusTableControl(index, `${role === "size" ? "Size" : role === "price" ? "Price" : "Product"} column`);
  };
  const mapped = mapping === undefined ? undefined : mapPagePasteTable(section, mapping);
  const invalid = mapping === undefined ? undefined : table.rows.find((row) =>
    (row.cells[mapping.product] === "" && row.cells[mapping.price] === "" && row.cells.some((cell) => cell !== ""))
    || (mapping.size !== undefined && row.cells[mapping.price] === "" && row.cells[mapping.size] !== ""));
  const start = Math.min(page.rows[index] ?? 0, Math.max(0, Math.floor((table.rows.length - 1) / ROW_PAGE) * ROW_PAGE));
  const end = Math.min(start + ROW_PAGE, table.rows.length);
  const tiers = mapped?.tiers ?? [];
  return [el("div", { class: "page-paste-table" }, [
    el("p", {}, ["Assign the columns, then review every proposed item before adding the page."]),
    select({ label: "Product column", value: String(selected.product), options, onChange: (value) => change("product", value) }),
    select({ label: "Price column", value: String(selected.price), options, onChange: (value) => change("price", value) }),
    select({ label: "Size column", value: selected.size === undefined ? "" : String(selected.size), options: [{ value: "", label: "No size column" }, ...options], onChange: (value) => change("size", value) }),
    ...(mapping === undefined ? [button({ label: "Review these columns as Prices", onClick: () => { setPagePasteTableMapping(index, selected); refresh(); focusTableControl(index, "Product column"); } })] : []),
    ...(mapping === undefined ? [] : [button({ label: "Keep this table as Text", onClick: () => { clearPagePasteTableMapping(index); refresh(); focusSection(index, ".page-paste-table button"); } })]),
    ...(invalid === undefined ? [] : [el("p", {}, [`Source row ${String(invalid.line)} ${invalid.cells[mapping?.product ?? 0] === "" && invalid.cells[mapping?.price ?? 0] === ""
      ? "has no Product or Price but has another value"
      : "has Size but no Price"}. Change the columns or keep this table as Text.`])]),
    ...(mapping === undefined ? [] : [
      el("p", {}, [`Showing rows ${String(start + 1)} to ${String(end)} of ${String(table.rows.length)}.`]),
      el("ol", { class: "page-paste-rows", start: start + 1 }, table.rows.slice(start, end).map((row, offset) => {
        const tier = tiers[start + offset];
        return el("li", {}, [
          el("strong", {}, [`Source row ${String(row.line)}`]),
          ...(mapped === undefined
            ? [el("p", {}, [table.headers.map((header, cell) => `${header}: ${row.cells[cell] ?? ""}`).join(". ")])]
            : [el("p", {}, [`Product: ${tier?.name ?? ""}. Price: ${tier?.price ?? ""}. Size: ${tier?.unit ?? ""}.`]),
              ...(tier?.blurb === undefined ? [] : [el("p", {}, [tier.blurb])])]),
        ]);
      })),
      el("div", { class: "paste-tools" }, [
        ...(start === 0 ? [] : [button({ label: `Show previous ${String(ROW_PAGE)} rows`, onClick: () => { page.rows[index] = Math.max(0, start - ROW_PAGE); refresh(); focusRowPager(index, "previous"); } })]),
        ...(end >= table.rows.length ? [] : [button({ label: `Show next ${String(ROW_PAGE)} rows`, onClick: () => { page.rows[index] = end; refresh(); focusRowPager(index, "next"); } })]),
      ]),
    ]),
  ])];
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
    el("pre", { class: "page-paste-preview" }, [lines.slice(0, DRAWN_LINES).join("\n")]),
    ...(lines.length > DRAWN_LINES
      ? [el("p", { class: "paste-capped" }, [`${String(lines.length - DRAWN_LINES)} more lines are included when the page is made.`])]
      : []),
  ];
}

function panelBody(refresh: () => void, pending: boolean, confirm: () => void, page: SectionPage): Node[] {
  const draft = getState().pastingPage;
  if (draft === undefined || draft.text.trim() === "") return [];
  const proposal = readProposal(draft.text);
  if (proposal.sections.length === 0) return [];
  const sections = proposal.sections.map((section, index) => ({
    section: draft.swapped.includes(index) ? swapProposalKind(section) : section,
    index,
  }));
  // The builder and confirm path both make one block per retained proposal.
  // Counting the blocks here keeps the button's promise tied to conversion.
  const count = sections.filter(({ section, index }) => !draft.dropped.includes(index) && (draft.mappings?.[index] === undefined ? buildProposedBlock(section) : buildMappedPagePasteBlock(section, draft.mappings[index])) !== undefined).length;
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
    el("p", {}, [proposal.sections.length === 1 ? "This text can make one editable section." : "Review the sections this text can make."]),
    ...(sections.length > DRAWN_SECTIONS
      ? [
          el("p", { class: "paste-capped" }, [`Showing sections ${String(start + 1)} to ${String(end)} of ${String(sections.length)}.`]),
          el("div", { class: "paste-tools", role: "group", "aria-label": "Review proposed sections" }, paging),
        ]
      : []),
    el("ul", { class: "page-paste-sections" }, sections.slice(start, end).map(({ section, index }) => {
      const mapping = draft.mappings?.[index];
      const built = mapping === undefined ? buildProposedBlock(section) : buildMappedPagePasteBlock(section, mapping);
      const name = kindName(built.kind);
      const content = shortContent(section.source);
      const issue = draft.mappings?.[index] === undefined ? pagePasteConversionIssue(section) : undefined;
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
        ...preview(section),
        ...tableReview(section, index, page, refresh),
        ...(issue === undefined ? [] : [el("p", {}, [issue])]),
        ...(section.swappable && issue === undefined && readPagePasteTable(section) === undefined
          ? [button({
              label: `Make ${section.kind === "prose" ? "Prices instead of Text" : "Text instead of Prices"}`,
              onClick: () => { swapPagePasteSection(index); refresh(); focusSection(index, "button"); },
            })]
          : []),
      ]);
    })),
    button({
      label: `Add ${String(count)} section${count === 1 ? "" : "s"} as a new page`,
      variant: "primary",
      disabled: count === 0 || pending || draft.confirming === true,
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
    if (file.name.toLowerCase().endsWith(".json")) {
      announce("Choose a text or Markdown file. A saved page can be opened from Your pages.");
      picker.value = "";
      return;
    }
    const draft = getState().pastingPage;
    open.disabled = true;
    void file.text().then((text) => {
      if (draft === undefined || getState().pastingPage?.sourceRevision !== draft.sourceRevision) return;
      box.value = text;
      setPagePasteText(text);
      refresh();
      announce("Read the file. Review the sections below.");
    }).catch(() => {
      if (draft !== undefined && getState().pastingPage?.sourceRevision === draft.sourceRevision) {
        announce("That file could not be read. Nothing has been changed.");
      }
    })
      .finally(() => { open.disabled = false; picker.value = ""; });
  });
  return [open, picker];
}

export function pagePastePanel(): HTMLElement[] {
  const draft = getState().pastingPage;
  if (draft === undefined) return [];
  const body = el("div", { class: "page-paste-body" });
  let pending = false;
  const page: SectionPage = { start: draft.reviewStart, rows: {} };
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
  box.disabled = draft.confirming === true;
  refresh();
  const files = fileControl(refresh, box);
  if (draft.confirming) for (const control of files) if (control instanceof HTMLButtonElement || control instanceof HTMLInputElement) control.disabled = true;
  return [el("div", { class: "page-paste", role: "group", "aria-label": "Paste a page you already have" }, [
    input,
    ...files,
    ...(draft.confirming ? [el("p", { role: "status" }, ["Adding this page. Please wait."])] : []),
    body,
    button({ label: "Done pasting", disabled: draft.confirming === true, onClick: () => stopPastingPage() }),
  ])];
}
