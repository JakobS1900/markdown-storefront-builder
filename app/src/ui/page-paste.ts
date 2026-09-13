import { buildProposedBlock, readProposal, swapProposalKind, type ProposedSection } from "../page-text.js";
import {
  confirmPagePaste, dropPagePasteSection, getState, restorePagePasteSection,
  setPagePasteText, stopPastingPage, swapPagePasteSection,
} from "../store.js";
import { announce, button, checkbox, el, field } from "./dom.js";

const DRAWN_SECTIONS = 100;
const DRAWN_LINES = 20;

function kindName(section: ProposedSection): string {
  return { heading: "Heading", divider: "Divider", prose: "Text", menu: "Prices" }[section.kind];
}

function shortContent(source: string): string {
  const line = source.split("\n").find((part) => part.trim() !== "")?.trim() ?? "blank lines";
  return line.length > 100 ? `${line.slice(0, 100)}…` : line;
}

function focusSection(index: number, selector: string): void {
  const item = document.querySelector(`.page-paste-sections li:nth-child(${String(index + 1)})`);
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

function panelBody(refresh: () => void, pending: boolean, confirm: () => void): Node[] {
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
  const count = sections.filter(({ section, index }) => !draft.dropped.includes(index) && buildProposedBlock(section) !== undefined).length;
  return [
    el("p", {}, [proposal.sections.length === 1 ? "This text can make one editable section." : "Review the sections this text can make."]),
    ...(sections.length > DRAWN_SECTIONS
      ? [el("p", { class: "paste-capped" }, [`Showing the first ${String(DRAWN_SECTIONS)} of ${String(sections.length)} sections. The remaining sections will also be added.`])]
      : []),
    el("ul", { class: "page-paste-sections" }, sections.slice(0, DRAWN_SECTIONS).map(({ section, index }) => {
      const name = kindName(section);
      const content = shortContent(section.source);
      return el("li", {}, [
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
        ...(section.swappable
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
      disabled: count === 0 || pending,
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
      // A delayed read belongs only to the draft that started it. Typing,
      // closing, and reopening all replace that draft object in the store.
      if (draft === undefined || getState().pastingPage !== draft) return;
      box.value = text;
      setPagePasteText(text);
      refresh();
      announce("Read the file. Review the sections below.");
    }).catch(() => {
      if (draft !== undefined && getState().pastingPage === draft) {
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
  // R9: repaint defers while a text field has focus. Refresh only this body so
  // the paste textarea and the Android keyboard connection remain intact.
  const confirm = (): void => {
    if (pending) return;
    pending = true;
    refresh();
    void confirmPagePaste().finally(() => { pending = false; refresh(); });
  };
  const refresh = (): void => body.replaceChildren(...panelBody(refresh, pending, confirm));
  const input = field({
    label: "Paste the text of your page",
    value: draft.text,
    multiline: true,
    hint: "Review what it will make. Nothing is saved until you press Add.",
    onInput: (text) => { setPagePasteText(text); refresh(); },
  });
  const box = input.querySelector("textarea");
  if (box === null) throw new Error("missing paste box");
  refresh();
  return [el("div", { class: "page-paste", role: "group", "aria-label": "Paste a page you already have" }, [
    input,
    ...fileControl(refresh, box),
    body,
    button({ label: "Done pasting", onClick: () => stopPastingPage() }),
  ])];
}
