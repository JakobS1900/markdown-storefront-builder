/**
 * The panel a seller pastes their price list into.
 *
 * It sits inside the price list section rather than on a surface of its own,
 * for three reasons that all turned out to be the same reason. It settles
 * which list the rows join, because they join the one whose button was
 * pressed. It keeps the section's undo offer in view, which is where the offer
 * to put a conversion back is rendered. And it means this feature adds no
 * navigation, no back-button case and no surface history entry.
 *
 * Nothing here writes to the document except `convertPaste`, and nothing calls
 * that except the one button that says how many products it will make. Until
 * then the paste is text on a screen: it is not saved, it does not compile,
 * and it cannot be published. That guarantee is held in `store.ts`'s `pasting`
 * rather than here.
 *
 * The word "import" appears nowhere a seller can read it. `import.ts` already
 * means opening a backup, which replaces the page they have open, and two
 * unrelated things under one word is how somebody loses their work.
 */
import { announce, button, checkbox, el, field } from "./dom.js";
import { canAddReviewedProduct, canBeProduct, readCandidates, type Candidate } from "../price-list-text.js";
import {
  convertPaste,
  getState,
  PASTE_REVIEW_PAGE_SIZE,
  setPastePage,
  setPasteText,
  setPasteRow,
  startPasting,
  stopPasting,
  tickAllPasteLines,
  togglePasteLine,
  untickAllPasteLines,
} from "../store.js";

/**
 * How many lines are drawn, however many were pasted.
 *
 * A real price list is tens of lines, occasionally hundreds. A paste can still
 * be enormous, by accident or because somebody dropped a whole spreadsheet in,
 * and one checkbox plus a label per line means ten thousand lines is twenty
 * thousand nodes. That does not degrade on a phone, it stops it.
 *
 * Draw one page at a time. The source and checked choices cover all lines, and
 * every proposed row is reachable without making an old phone render them all.
 */
const DRAWN = PASTE_REVIEW_PAGE_SIZE;

/** How the seller opens the panel, shown when it is not already open. */
export function pasteOpener(blockId: string): HTMLElement[] {
  if (getState().pasting?.blockId === blockId) return [];
  return [
    button({
      label: "Paste a price list",
      onClick: () => startPasting(blockId),
    }),
  ];
}

/** Extra columns stay visible even though only item and price are edited here. */
function otherDetails(candidate: Candidate): string {
  const parts: string[] = [];
  if (candidate.unit !== undefined) parts.push(candidate.unit);
  // Named, because a number silently landing in "cost" is the one field a
  // seller must never be surprised by: it is what they paid, and it is the
  // reason `cost` is stored and never published.
  if (candidate.cost !== undefined) parts.push(`cost ${candidate.cost}`);
  if (candidate.blurb !== undefined) parts.push(candidate.blurb);
  return parts.join(", ");
}

/**
 * The part of the panel that changes as the seller types.
 *
 * Split out from `pastePanel` so it can be rebuilt on its own. See the comment
 * on `refresh` for why that matters.
 */
function panelBody(
  text: string,
  ticked: ReadonlySet<number>,
  corrections: Readonly<Record<number, { readonly name: string; readonly price: string }>>,
  page: number,
  refresh: () => void,
): Node[] {
  if (text === "") return [];

  const candidates = readCandidates(text).map((candidate, i) => ({ ...candidate, ...corrections[i] }));
  // Counted with the same reviewed-name check used before conversion, so the
  // button cannot promise more than the conversion delivers. Counting raw
  // ticks let a seller tick a blank line and be told "Add 3 items" for two,
  // or "Added 1 item" when nothing at all had been added.
  let chosen = candidates.filter((candidate, i) => ticked.has(i) && canAddReviewedProduct(candidate)).length;
  const count = el("p", { class: "paste-count" }, [`${String(chosen)} of ${String(candidates.length)} lines ready`]);
  const issue = el("p", { class: "paste-issue", role: "status" });
  const add = button({
    label: `Add ${String(chosen)} item${chosen === 1 ? "" : "s"}`,
    variant: "primary",
    disabled: chosen === 0,
    onClick: () => {
      convertPaste();
      announce(`Added ${String(chosen)} item${chosen === 1 ? "" : "s"}. Undo is in the price list.`);
    },
  });
  const updateCount = (): void => {
    chosen = candidates.filter((candidate, i) => ticked.has(i) && canAddReviewedProduct(candidate)).length;
    const unnamed = candidates.findIndex((candidate, i) => ticked.has(i) && canBeProduct(candidate) && !canAddReviewedProduct(candidate));
    count.textContent = `${String(chosen)} of ${String(candidates.length)} lines ready`;
    issue.textContent = unnamed === -1 ? "" : `Fill in Item on line ${String(unnamed + 1)} or untick it before adding.`;
    add.textContent = `Add ${String(chosen)} item${chosen === 1 ? "" : "s"}`;
    add.disabled = chosen === 0 || unnamed !== -1;
  };
  const edit = (index: number, key: "name" | "price", value: string): void => {
    setPasteRow(index, key, value);
    const candidate = candidates[index];
    if (candidate !== undefined) candidates[index] = { ...candidate, [key]: value };
    updateCount();
  };
  updateCount();
  const first = Math.min(page * DRAWN, Math.max(0, candidates.length - 1));
  const last = Math.min(first + DRAWN, candidates.length);
  const go = (next: number): void => {
    setPastePage(next);
    refresh();
    document.querySelector<HTMLElement>(".paste-lines input")?.focus({ preventScroll: true });
  };

  return [
    count,
    el("div", { class: "paste-tools", role: "group", "aria-label": "Choose lines" }, [
      button({ label: "Tick all", onClick: () => tickAllPasteLines() }),
      button({ label: "Untick all", onClick: () => untickAllPasteLines() }),
    ]),
    ...(candidates.length <= DRAWN
      ? []
      : [
          el("p", { class: "paste-capped" }, [
            `Showing lines ${String(first + 1)} to ${String(last)} of ${String(candidates.length)}. Tick all and Add still cover every line.`,
          ]),
          el("div", { class: "paste-tools", role: "group", "aria-label": "Review pages" }, [
            button({ label: "Previous 100 lines", disabled: page === 0, onClick: () => go(page - 1) }),
            button({ label: "Next 100 lines", disabled: last === candidates.length, onClick: () => go(page + 1) }),
          ]),
        ]),
    el(
      "ul",
      { class: "paste-lines" },
      candidates.slice(first, last).map((candidate, offset) => {
        const i = first + offset;
        return el("li", {}, [
          // A line that cannot become a product gets no checkbox, because
          // there is nothing for the seller to decide about it. It is still
          // shown: they have to be able to see everything they pasted, and a
          // heading that failed to be recognised is obvious on screen and
          // invisible if it were quietly removed.
          ...(canBeProduct(candidate)
            ? [
                checkbox({
                  // The line itself is the accessible name, because it is what
                  // the seller is deciding about. "Line 4" would be a
                  // plausible looking name that tells them nothing, which is
                  // what the a11y gate exists to catch.
                  label: candidate.line.trim(),
                  checked: ticked.has(i),
                  onChange: () => togglePasteLine(i),
                }),
              ]
            : [el("p", { class: "paste-skipped" }, [candidate.line.trim() === "" ? "(blank line)" : candidate.line])]),
          ...(ticked.has(i) && canBeProduct(candidate)
            ? [
                el("div", { class: "paste-becomes", role: "group", "aria-label": `Proposed item for line ${String(i + 1)}` }, [
                  field({
                    label: `Item, line ${String(i + 1)}`,
                    value: candidate.name,
                    onInput: (value) => edit(i, "name", value),
                  }),
                  field({
                    label: `Price, line ${String(i + 1)}`,
                    value: candidate.price,
                    onInput: (value) => edit(i, "price", value),
                  }),
                  ...(otherDetails(candidate) === ""
                    ? []
                    : [el("p", {}, [`Other details: ${otherDetails(candidate)}`])]),
                ]),
              ]
            : []),
        ]);
      }),
    ),
    issue,
    add,
  ];
}

/**
 * The panel, or nothing when this section is not the one being pasted into.
 *
 * Candidates are re-read from the text rather than kept in the store beside
 * it. They are a pure function of the text, and storing a derived value next
 * to the thing it derives from is how the two drift apart.
 */
export function pastePanel(blockId: string): HTMLElement[] {
  const pasting = getState().pasting;
  if (pasting === undefined || pasting.blockId !== blockId) return [];

  const body = el("div", { class: "paste-body" });

  /**
   * Rebuilds the changing half of the panel without a repaint.
   *
   * This is the one place in the app that updates its own DOM instead of
   * letting `repaint` rebuild the tree, and it is not a shortcut. `repaint`
   * refuses to run while a text field has focus (`store.ts`'s `typing`),
   * because replacing a focused input tears down the Android InputConnection
   * bound to it and loses characters. The paste box IS a focused text field
   * for the entire time the seller is using it, so every deferred repaint
   * simply re-defers, and the count, the ticks and the Add button never
   * appeared at all until the seller happened to tap something inert. On a
   * phone, with the keyboard up, that is the whole feature failing to appear.
   *
   * Refreshing only the body leaves the textarea alone, so focus, caret and
   * keyboard all survive, and the seller sees their list immediately.
   */
  const refresh = (): void => {
    const now = getState().pasting;
    body.replaceChildren(...(now === undefined ? [] : panelBody(now.text, new Set(now.ticked), now.corrections, now.page, refresh)));
  };

  refresh();

  return [
    el("div", { class: "paste", role: "group", "aria-label": "Paste a price list" }, [
      field({
        label: "Paste your price list",
        value: pasting.text,
        multiline: true,
        hint: "One item per line. Tick the lines that are products, then add them. Nothing is added until you press the button.",
        onInput: (v) => {
          setPasteText(v);
          refresh();
        },
      }),
      ...fileControl(refresh),
      body,
      button({
        label: "Done pasting",
        onClick: () => stopPasting(),
      }),
    ]),
  ];
}

/**
 * The hidden picker, with a real button in front of it.
 *
 * The same pairing as `openBackupControl` in `export.ts`, which exists because
 * the accessibility gate requires a control with a real accessible name and a
 * bare file input does not have one.
 *
 * It refuses `.json` on purpose. A saved page opened here would do nothing
 * useful, and offering it would blur the line against opening a backup, which
 * replaces the page rather than adding to it.
 */
function fileControl(refresh: () => void): Node[] {
  const picker = el("input", {
    id: "price-list-file",
    type: "file",
    accept: ".csv,.tsv,.txt,.md,text/plain,text/csv",
    class: "sr-only",
    "aria-hidden": "true",
    tabindex: "-1",
  }) as HTMLInputElement;

  const open = button({
    label: "Open a price list from this device",
    onClick: () => picker.click(),
  });

  picker.addEventListener("change", () => {
    const file = picker.files?.[0];
    if (file === undefined) return;
    const draft = getState().pasting;
    open.disabled = true;

    void file
      .text()
      .then((text) => {
        if (draft === undefined || getState().pasting?.sourceRevision !== draft.sourceRevision) return;
        setPasteText(text);
        refresh();
        announce("Read the file. Tick the lines that are items.");
      })
      .catch(() => {
        // Nothing has been changed, and saying so is the point: a file that
        // could not be read must not leave the seller wondering whether it
        // half worked.
        announce("That file could not be read. Nothing has been changed.");
      })
      .finally(() => {
        open.disabled = false;
        picker.value = "";
      });
  });

  return [open, picker];
}
