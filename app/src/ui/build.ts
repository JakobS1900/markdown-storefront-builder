/**
 * The Build surface: the list of sections and the form for the selected one.
 *
 * Reordering offers both drag handles and up and down buttons. Only the buttons
 * are implemented, deliberately and in that order: drag on a phone is
 * unreliable and unreachable by keyboard, so the buttons are the accessible
 * path and drag is the enhancement, not the other way round.
 */
import { type Block } from "@mdsb/engine";

import {
  addBlock,
  clearBusy,
  getState,
  moveBlock,
  removeBlock,
  selectBlock,
  setBusy,
  undoLast,
  updateBlock,
  update,
} from "../store.js";
import { openBackup } from "../import.js";
import { showsEmptyState, starterPicker } from "./pages-sidebar.js";
import { announce, button, el, field, render } from "./dom.js";
import { KIND_LABEL, blankBlock, blockForm } from "./forms.js";

const ADDABLE: Block["kind"][] = [
  "profile",
  "menu",
  "gallery",
  "prose",
  "heading",
  "divider",
];

/**
 * Cuts a summary to length and says that it did.
 *
 * A bare slice reads as text that stopped rather than text that was shortened.
 * The section list showed "Open Text: Everything here is made in runs of forty
 * or fewer, finished" for a sentence that carries on, and there was nothing on
 * the row to say so: no ellipsis, and `text-overflow` is `clip` because the cut
 * happens here rather than in the stylesheet.
 *
 * It backs up to a word boundary when there is one in the last part of the
 * budget, so the cut does not land inside a word either. When there is not one,
 * a long unbroken string still gets cut at the limit, because a row that grows
 * to fit one is worse than a word split across the ellipsis.
 */
function shorten(text: string, max = 60): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/** A short description of a section, so the list is scannable. */
function summarise(block: Block): string {
  switch (block.kind) {
    case "heading":
      return block.text === "" ? "Empty heading" : shorten(block.text);
    case "divider":
      return "A line across the page";
    case "prose":
      return shorten(block.heading ?? (block.text === "" ? "Empty" : block.text));
    case "menu":
      // "item", matching the form. The section used to call these options in
      // one place and items in another, which is one word too many for a
      // person who is only trying to list what they sell.
      return `${block.tiers.length} item${block.tiers.length === 1 ? "" : "s"}`;
    case "gallery":
      return `${block.items.length} image${block.items.length === 1 ? "" : "s"}`;
    case "profile":
      return block.displayName === "" ? "No name yet" : block.displayName;
  }
}

/**
 * Brings a just-opened section to the top of the screen.
 *
 * Measured at 360 by 720, the phone this was built on: opening a price section
 * rendered seven fields and put none of them in view. Pressing a control and
 * seeing nothing change is indistinguishable from the control not working, and
 * the artist has to guess that the answer is to scroll.
 *
 * There are two ways into an open section and both had the problem: pressing
 * Open on a row, and adding a section, which selects what it adds. The first
 * measurement only caught one of them.
 *
 * Selecting repaints synchronously, so the row exists by the time this runs.
 * Guarded because jsdom has no layout and no scrollIntoView, and a test
 * environment should not be what decides whether this ships.
 */
function revealSection(blockId: string): void {
  const row = document.querySelector(`[aria-controls="editor-${blockId}"]`);
  if (row instanceof HTMLElement && typeof row.scrollIntoView === "function") {
    row.scrollIntoView({ block: "start", behavior: "smooth" });
  }
}

// `showsEmptyState`, `lastEdited` and `starterPicker` moved to
// `pages-sidebar.ts` in feature 025, along with the page list itself. They are
// imported above. The dependency runs one way: this file reads from there, and
// nothing there reads from here.

/**
 * What somebody sees before they have written anything.
 *
 * The web build has always opened on a blank editor, which demonstrates
 * nothing. A person handed a link to see whether the thing works arrives at an
 * empty form and a row of buttons, and has to imagine the rest.
 *
 * So the empty state offers a real page. It goes through `openBackup`, the same
 * path the import uses, which means a file that does not parse is refused here
 * exactly as a bad backup is, and the example arrives as its own page instead
 * of overwriting anything. The address is relative because the app is served
 * from a subdirectory on the web and from the root of a custom scheme inside
 * the Android shell, and an absolute path is wrong for one of those.
 */
function emptyState(): HTMLElement[] {
  const load = button({
    label: "See an example page",
    variant: "primary",
    onClick: () => {
      load.disabled = true;
      announce("Loading an example.");
      // This one crosses the network, so it can be slow for a reason a seller
      // will recognise, and slower than any of the others.
      setBusy("Opening the example page");
      void fetch("example.json")
        .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
        .then((text) => openBackup(text))
        .catch(() => ({ ok: false, message: "The example could not be loaded. Nothing has been changed." }))
        .then((result) => {
          clearBusy();
          load.disabled = false;
          // Its own words on success. `openBackup` says "the page you had open
          // is still saved", which is true of an import and nonsense to
          // somebody who arrived thirty seconds ago and had no page at all.
          announce(
            result.ok
              ? "Opened an example page. Change anything you like, or start your own from Your pages."
              : result.message,
          );
        });
    },
  });

  return [
    el("p", { class: "empty" }, [
      "Your page is empty. Add a section below to start, or begin from a template.",
    ]),
    el("div", { class: "adders" }, [load]),
    starterPicker("starters-group-empty"),
  ];
}

export function buildSurface(container: HTMLElement): void {
  const state = getState();
  const { blocks } = state.doc;

  const list = el(
    "ul",
    { class: "blocks", "aria-label": "Sections of your page" },
    blocks.map((block, i) => {
      const selected = state.selectedBlockId === block.id;
      const kind = KIND_LABEL[block.kind];
      // Prefixed because a block id is a UUID and may start with a digit.
      const editorId = `editor-${block.id}`;

      const row = el("div", { class: "block-row" }, [

            // It says which way it will go. It used to read "Edit" whether the
            // section was open or shut, so the button offering to edit was the
            // one that took the editor away, and the only sign it was already
            // open was a border colour.
            button({
              label: `${selected ? "Close" : "Open"} ${kind}: ${summarise(block)}`,
              variant: "ghost",
              expanded: selected,
              // Only while the region is there to point at. The form is not
              // rendered when the section is shut, and an aria-controls naming
              // an element that does not exist is a dangling reference, not a
              // hint about one that might appear later.
              ...(selected ? { controls: editorId } : {}),
              onClick: () => {
                const opening = !selected;
                selectBlock(opening ? block.id : undefined);
                // Bring the row it opened to the top of the screen.
                //
                // Measured at 360 by 720, which is the phone this was built on:
                // opening a price section put seven fields on the page and none
                // of them in view. Pressing "Open" and seeing nothing change is
                // the disorientation an accordion is warned about, and the
                // artist has to guess that the answer is to scroll.
                //
                // Selecting repaints synchronously, so by here the new row
                // exists. Guarded because jsdom has no layout and no
                // scrollIntoView, and a test environment should not decide
                // whether this ships.
                if (opening) revealSection(block.id);
              },
            }),
            el("div", { class: "block-tools" }, [
              button({
                label: `Move ${kind} up`,
                glyph: "↑",
                disabled: i === 0,
                onClick: () => {
                  moveBlock(block.id, -1);
                  announce(`Moved ${kind} up`);
                },
              }),
              button({
                label: `Move ${kind} down`,
                glyph: "↓",
                disabled: i === blocks.length - 1,
                onClick: () => {
                  moveBlock(block.id, 1);
                  announce(`Moved ${kind} down`);
                },
              }),
              button({
                label: `Remove ${kind}`,
                glyph: "×",
                variant: "danger",
                onClick: () => {
                  removeBlock(block.id);
                  announce(`Removed ${kind}. Undo is where it was, in the list.`);
                },
              }),
            ]),
          ]);

      return el("li", { class: `block${selected ? " selected" : ""}` }, [
        row,
        ...(selected
          ? [
              el("div", { class: "block-editor", id: editorId }, [
                blockForm(block, (next) => updateBlock(block.id, next)),
              ]),
            ]
          : []),
      ]);
    }),
  );

  // The offer to put back what was just removed, sitting at the index it came
  // from. The gap it leaves is where the artist was already looking, which is
  // most of why it is here rather than floating over the tab bar. It is not on
  // a timer: FR-024b, because an undo that expires while somebody is scrolled
  // elsewhere is a safety net that is not there when it is reached for.
  // Only a removed SECTION belongs in this list. A removed row is offered back
  // inside the section it came from, where the gap is, which is the same
  // reasoning applied one level down.
  if (state.undo !== undefined && state.undo.kind === "block") {
    const { block, index } = state.undo;
    const kind = KIND_LABEL[block.kind];
    list.insertBefore(
      el("li", { class: "undone" }, [
        el("p", {}, [`Removed ${kind}.`]),
        button({
          label: `Undo removing ${kind}`,
          variant: "primary",
          onClick: () => {
            undoLast();
            announce(`${kind} is back.`);
          },
        }),
      ]),
      list.children[index] ?? null,
    );
  }

  const adders = el(
    "div",
    // `adders-dock` is the one that stays reachable: on a phone it sticks above
    // the tab bar rather than sitting at the far end of the list. The other
    // `.adders` on this surface, the one in `pageList`, is not docked, because
    // starting a new page is not a thing anybody does repeatedly.
    { class: "adders adders-dock", role: "group", "aria-label": "Add a section" },
    ADDABLE.map((kind) =>
      button({
        label: KIND_LABEL[kind],
        // Chips, which is what `.adders .btn.ghost` in the stylesheet was
        // written for and what it never got applied to. Six of these were
        // `primary`, so the empty state painted the solid accent seven times:
        // once on "See an example page", which is the thing a new person
        // should press, and six times on the row below it, which is not.
        // Seven primaries is no primary.
        variant: "ghost",
        onClick: () => {
          const block = blankBlock(kind);
          addBlock(block);
          announce(`Added ${KIND_LABEL[kind]}`);
          // Adding selects what it added, so the same problem applies: the new
          // section's fields render below the buttons that were just pressed.
          revealSection(block.id);
        },
      }),
    ),
  );

  render(
    container,
    el("div", { class: "stack" }, [
      // The page list used to open this surface, above the page being edited.
      // It is in the sidebar now, reachable from all three surfaces instead of
      // this one, which is feature 025 and FR-106: there is exactly one of it.
      field({
        label: "Page title (optional)",
        value: state.doc.title ?? "",
        hint: "Only you see this. It is how the page is listed when you come back.",
        onInput: (value) => {
          const next = { ...state.doc } as Record<string, unknown>;
          if (value === "") delete next["title"];
          else next["title"] = value;
          update(next as typeof state.doc);
        },
      }),
      ...(showsEmptyState(state) ? emptyState() : [list]),
      el("h2", { class: "sr-only" }, ["Add a section"]),
      adders,
    ]),
  );
}
