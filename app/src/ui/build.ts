/**
 * The Build surface: the list of sections and the form for the selected one.
 *
 * Reordering offers both drag handles and up and down buttons. Only the buttons
 * are implemented, deliberately and in that order: drag on a phone is
 * unreliable and unreachable by keyboard, so the buttons are the accessible
 * path and drag is the enhancement, not the other way round.
 */
import type { Block } from "@mdsb/engine";

import {
  addBlock,
  askDelete,
  askPageDelete,
  cancelDelete,
  cancelPageDelete,
  getState,
  moveBlock,
  newPage,
  openPage,
  removeBlock,
  removePage,
  selectBlock,
  updateBlock,
  update,
  type State,
} from "../store.js";
import { openBackup } from "../import.js";
import { announce, button, disclosure, el, field, render } from "./dom.js";
import { KIND_LABEL, blankBlock, blockForm } from "./forms.js";

const ADDABLE: Block["kind"][] = [
  "profile",
  "menu",
  "gallery",
  "prose",
  "heading",
  "divider",
];

/** A short description of a section, so the list is scannable. */
function summarise(block: Block): string {
  switch (block.kind) {
    case "heading":
      return block.text === "" ? "Empty heading" : block.text;
    case "divider":
      return "A line across the page";
    case "prose":
      return (
        block.heading ?? (block.text === "" ? "Empty" : block.text.slice(0, 60))
      );
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

/** When a page was last written, short enough to sit beside its title. */
function lastEdited(at: number): string {
  const when = new Date(at);
  return when.toDateString() === new Date().toDateString()
    ? `today at ${when.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
    : when.toLocaleDateString();
}

/**
 * The other pages saved in this browser.
 *
 * Storage has been multi-page since the app shell was built and there was never
 * a way to choose one, so whichever page had the newest timestamp was the only
 * page anybody could reach. That went unnoticed while there was one page per
 * device, and then two things started making more: importing a backup writes it
 * under a new id so that opening the wrong file cannot destroy the page already
 * open, and FR-018 refuses a page it cannot read while leaving it in place with
 * the newest timestamp of all. Each of those strands the artist's real page,
 * intact and unreachable, which is close enough to losing it.
 *
 * It lives on Build, folded, rather than in a fourth tab: Build is the surface
 * still standing when a page has been refused, which is the case this exists
 * for, and a tab would spend a permanent quarter of the tab bar on something
 * used once a month.
 *
 * It is present whenever storage works, including for somebody who has exactly
 * one page. It first appeared only when there was something to switch to, which
 * was right while it was only a switcher and became wrong the moment it carried
 * the only way to start a second page. That is FR-021c replacing FR-020c, and
 * the reasoning is written down in specs/012-page-lifecycle rather than being
 * quietly edited into the spec it contradicts.
 *
 * The page on screen has no remove control, and the store refuses its id as
 * well. Removing what somebody is looking at raises a question with no good
 * answer, and every answer to it is worse than not asking.
 */
function pageList(state: State): HTMLElement[] {
  if (!state.storageOk) return [];

  // Nothing saved yet, so there is nothing to list. A new install used to open
  // on "Your pages (0)": a list of nothing, above an empty page, offering to
  // start a second empty page. It appears the moment the first page is written,
  // which the store now notices, so hiding it here does not hide the way to a
  // second page for longer than it takes to type one character.
  if (state.pages.length === 0) return [];

  const live =
    state.doc.title === undefined || state.doc.title === ""
      ? "Untitled page"
      : state.doc.title;

  return [
    disclosure({
      // Its own id, not one from the numbered sequence. There is exactly one of
      // these on the surface, and a number would make its identity depend on
      // how many fields the open section happens to have.
      id: "pages-group",
      className: "pages-group",
      summary: `Your pages (${String(state.pages.length)})`,
      children: [
        el(
          "ul",
          { class: "pages", "aria-label": "Saved pages" },
          state.pages.map((page) => {
            const current = page.id === state.pageId;
            // The record only catches up to the title when a save lands, so the
            // page on screen reads its name from the document instead. Renaming
            // renames the entry as it is typed.
            const title = current ? live : page.title;
            // A title is optional and untitled pages are all called the same
            // thing, so the date is part of the name rather than decoration
            // beside it. Two entries reading "Untitled page" are not a choice.
            const label = `${title}, last edited ${lastEdited(page.updatedAt)}`;

            if (current) {
              return el("li", {}, [
                el("p", { class: "current", "aria-current": "page" }, [
                  `${label}. Open now.`,
                ]),
              ]);
            }

            // Being asked about, the row holds the question and its two answers
            // and nothing else, exactly as a section does. The control that
            // raised it is gone while it stands, so the same thumb cannot hit
            // it twice, and "open this page" is not sitting a few pixels from
            // "destroy this page" during the one interaction that is final.
            if (state.pendingPageDeleteId === page.id) {
              // The group role goes on a wrapper, not on the `li`. Overriding a
              // list item's role breaks the list it is in, which axe says as
              // `aria-allowed-role` and `list`, and it caught this the day the
              // markup was written.
              return el("li", { class: "confirm" }, [
                el("div", { role: "group", "aria-label": `Remove ${title}?` }, [
                  el("p", { class: "ask" }, [
                    `Remove ${title}? This cannot be undone.`,
                  ]),
                  el("div", { class: "answers" }, [
                    button({
                      label: `Keep ${title}`,
                      variant: "primary",
                      onClick: () => {
                        cancelPageDelete();
                        announce(`Kept ${title}`);
                      },
                    }),
                    button({
                      label: `Yes, remove ${title}`,
                      variant: "danger",
                      onClick: () => {
                        void removePage(page.id).then(() => {
                          announce(`Removed ${title}`);
                        });
                      },
                    }),
                  ]),
                ]),
              ]);
            }

            return el("li", {}, [
              button({
                label,
                onClick: () => {
                  void openPage(page.id).then(() => {
                    if (getState().pageId === page.id)
                      announce(`Opened ${title}`);
                    // The button just pressed no longer exists: it is the
                    // current entry now, or the page was refused and the
                    // status line has the news. Either way focus has fallen
                    // to the body, which leaves a keyboard user at the top
                    // of the document hunting for what changed. The summary
                    // is where they were.
                    document
                      .querySelector<HTMLElement>(".pages-group > summary")
                      ?.focus({ preventScroll: true });
                  });
                },
              }),
              button({
                label: `Remove ${title}`,
                glyph: "×",
                variant: "danger",
                onClick: () => {
                  askPageDelete(page.id);
                },
              }),
            ]);
          }),
        ),
        el("div", { class: "adders" }, [
          button({
            label: "Start a new page",
            variant: "primary",
            onClick: () => {
              void newPage(getState().doc.target).then(() => {
                announce("Started a new page");
              });
            },
          }),
        ]),
      ],
    }),
  ];
}

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
      void fetch("example.json")
        .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
        .then((text) => openBackup(text))
        .catch(() => ({ ok: false, message: "The example could not be loaded. Nothing has been changed." }))
        .then((result) => {
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
      "Your page is empty. Add a section below to start. Most people begin with About you.",
    ]),
    el("div", { class: "adders" }, [load]),
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
      const asking = state.pendingDeleteId === block.id;
      // Prefixed because a block id is a UUID and may start with a digit.
      const editorId = `editor-${block.id}`;

      // While a section is being asked about, its row holds the question and
      // nothing else. The move controls sit either side of the delete control
      // and are 44px apart, so leaving them there during the one interaction
      // that cannot be undone is asking for the mis-tap all over again.
      const row = asking
        ? el(
            "div",
            {
              class: "block-row confirm",
              role: "group",
              "aria-label": `Delete ${kind}?`,
            },
            [
              el("p", { class: "ask" }, [
                `Delete ${kind}? This cannot be undone.`,
              ]),
              el("div", { class: "block-tools" }, [
                button({
                  label: `Keep ${kind}`,
                  variant: "primary",
                  onClick: () => {
                    cancelDelete();
                    announce(`Kept ${kind}`);
                  },
                }),
                button({
                  label: `Yes, delete ${kind}`,
                  variant: "danger",
                  onClick: () => {
                    removeBlock(block.id);
                    announce(`Deleted ${kind}`);
                  },
                }),
              ]),
            ],
          )
        : el("div", { class: "block-row" }, [
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
              onClick: () => selectBlock(selected ? undefined : block.id),
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
                label: `Delete ${kind}`,
                glyph: "×",
                variant: "danger",
                onClick: () => {
                  askDelete(block.id);
                  announce(`Delete ${kind}? Nothing has been removed yet.`);
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

  const adders = el(
    "div",
    { class: "adders", role: "group", "aria-label": "Add a section" },
    ADDABLE.map((kind) =>
      button({
        label: KIND_LABEL[kind],
        variant: "primary",
        onClick: () => {
          addBlock(blankBlock(kind));
          announce(`Added ${KIND_LABEL[kind]}`);
        },
      }),
    ),
  );

  render(
    container,
    el("div", { class: "stack" }, [
      ...pageList(state),
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
      ...(blocks.length === 0 ? emptyState() : [list]),
      el("h2", { class: "sr-only" }, ["Add a section"]),
      adders,
    ]),
  );
}
