/**
 * The pages a seller has, and the ways in and out of them.
 *
 * This was a folded group at the top of the Build surface, above the page being
 * edited, which put the way to another page inside the page you were already
 * looking at. Reaching a second page meant scrolling to the top of your own
 * work and unfolding a disclosure, and it was only there at all, so somebody on
 * the Copy tab had to go back to Build first.
 *
 * ONE list, TWO containers. `pagesPanelContents` knows nothing about where it
 * is drawn, which is what lets a drawer on a phone and a pinned column on a
 * wide screen be the same list rather than two lists that have to agree. The
 * container decides the chrome: a drawer has a way to close and a backdrop, a
 * column has neither because it is simply there.
 *
 * WHY THIS IS HAND WRITTEN. A `<dialog>` with `showModal()` gives a focus trap,
 * escape, an inert background and top layer rendering for nothing, and this
 * project's own rule is to take the platform feature. jsdom implements the
 * `open` property and neither method, proven by probe, and every user interface
 * test here runs under jsdom. Building on it would mean asserting against a stub
 * of the exact mechanism under test, which is how this project once shipped
 * twenty one tests covering a panel that displayed nothing. So the trap, the
 * escape and the background are ours, and each one has a test.
 */
import { serializeDocument } from "@mdsb/engine";

import {
  askPageDelete,
  cancelPageDelete,
  clearBusy,
  getState,
  newPage,
  openPage,
  removePage,
  setBusy,
  type State,
} from "../store.js";
import { dismissSidebar } from "../surface-history.js";
import { openBackup } from "../import.js";
import { STARTERS } from "../starters/index.js";
import { announce, button, disclosure, el } from "./dom.js";

/** The id the trigger points at, and the thing focus moves into. */
export const PANEL_ID = "pages-panel";

/**
 * Whether the Build surface has nothing of its own to show: no sections, and no
 * offer to undo removing the last one hanging over an otherwise empty page.
 *
 * `buildSurface` reads this to choose the empty state over the section list.
 * `pagesPanelContents` reads the very same predicate to decide whether to
 * include its own copy of the starting-point picker, rather than repeating the
 * condition. The two placements answer two different situations, "just arrived
 * with nothing saved" and "already have pages, want another", and must never
 * both be on screen at once: pressing "Start a new page" while a page is
 * already saved lands on an empty document with `state.pages` non-empty, which
 * is true of both conditions independently the moment they are written
 * separately. A second copy of this check drifting from the first is exactly how
 * that duplicate picker, with the identical name "Start from a template", would
 * come back.
 *
 * It lives in this module rather than in `build.ts` because both need it and
 * the dependency has to run one way. `build.ts` imports from here; nothing here
 * imports from `build.ts`.
 */
export function showsEmptyState(state: State): boolean {
  return state.doc.blocks.length === 0 && state.undo?.kind !== "block";
}

/** When a page was last written, short enough to sit beside its title. */
export function lastEdited(at: number): string {
  const when = new Date(at);
  return when.toDateString() === new Date().toDateString()
    ? `today at ${when.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
    : when.toLocaleDateString();
}

/**
 * The starting points, offered wherever somebody might begin a page.
 *
 * Rendered in exactly one place at a time, see `showsEmptyState`. Two
 * disclosures sharing a summary is an accessible-name collision.
 */
export function starterPicker(id: string): HTMLElement {
  return disclosure({
    id,
    className: "starters",
    summary: "Start from a template",
    children: [
      el(
        "ul",
        { "aria-label": "Templates to start from" },
        STARTERS.map((starter) =>
          el("li", {}, [
            button({
              // The description is part of the name, not decoration beside it.
              // "Art commissions" and "Handmade and crafts" are a choice only
              // once you know which one covers what you sell.
              label: `${starter.label}. ${starter.description}`,
              onClick: () => {
                // Before the import starts, not after. `load()` is a dynamic
                // import of a lazy chunk, about thirty ticks cold, and this is
                // the sentence that stops that reading as a dead button.
                setBusy(`Opening ${starter.label}`);
                void starter
                  .load()
                  .then((doc) => openBackup(serializeDocument(doc)))
                  // Catches a rejection, which is the offline `load()` and a
                  // `serializeDocument` throw. It deliberately does not cover
                  // `openBackup` RESOLVING `{ ok: false }`, whose message is
                  // written for a file import and would read as nonsense here.
                  .catch(() => ({
                    ok: false,
                    message: "That template could not be opened. Nothing has been changed.",
                  }))
                  .then((result) => {
                    clearBusy();
                    if (result.ok) dismissSidebar();
                    announce(
                      result.ok
                        ? `Started a new page from ${starter.label}. Change anything you like.`
                        : result.message,
                    );
                  });
              },
            }),
          ]),
        ),
      ),
    ],
  });
}

/**
 * One entry in the list.
 *
 * The page on screen is a statement rather than a destination, and has no
 * remove control: removing what somebody is looking at raises a question with
 * no good answer, and every answer to it is worse than not asking. The store
 * refuses its id as well, so this is the polite half of a rule enforced twice.
 */
function pageEntry(state: State, page: State["pages"][number], live: string): HTMLElement {
  const current = page.id === state.pageId;
  // The record only catches up to the title when a save lands, so the page on
  // screen reads its name from the document instead. Renaming renames the entry
  // as it is typed.
  const title = current ? live : page.title;
  // A title is optional and untitled pages are all called the same thing, so
  // the date is part of the name rather than decoration beside it. Two entries
  // reading "Untitled page" are not a choice.
  const label = `${title}, last edited ${lastEdited(page.updatedAt)}`;

  if (current) {
    return el("li", {}, [
      el("p", { class: "current", "aria-current": "page" }, [`${label}. Open now.`]),
    ]);
  }

  // Being asked about, the row holds the question and its two answers and
  // nothing else, exactly as a section does. The control that raised it is gone
  // while it stands, so the same thumb cannot hit it twice, and "open this page"
  // is not sitting a few pixels from "destroy this page" during the one
  // interaction that is final.
  if (state.pendingPageDeleteId === page.id) {
    // The group role goes on a wrapper, not on the `li`. Overriding a list
    // item's role breaks the list it is in, which axe says as
    // `aria-allowed-role` and `list`, and it caught this the day the markup was
    // written.
    return el("li", { class: "confirm" }, [
      el("div", { role: "group", "aria-label": `Remove ${title}?` }, [
        el("p", { class: "ask" }, [`Remove ${title}? This cannot be undone.`]),
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
        setBusy(`Opening ${title}`);
        void openPage(page.id).then(() => {
          clearBusy();
          // Only when it actually opened. A page can be refused, by FR-018,
          // and the list is exactly what that seller needs next: something else
          // to choose. Closing it on them would leave the refusal on screen
          // with no way back to the other pages except opening the drawer
          // again. An existing test caught this, which is the test earning its
          // keep rather than being updated to match a regression.
          if (getState().pageId !== page.id) return;
          dismissSidebar();
          announce(`Opened ${title}`);
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
}

/**
 * The list and the ways to start a page, with no opinion about its container.
 *
 * Storage that will not work is the one case where there is nothing useful to
 * say here: there are no saved pages, there will be none, and the status line
 * is already carrying that news in words that explain it.
 */
export function pagesPanelContents(state: State): Node[] {
  const live =
    state.doc.title === undefined || state.doc.title === "" ? "Untitled page" : state.doc.title;

  const parts: Node[] = [
    el("h2", { class: "panel-heading" }, [
      state.storageOk ? `Your pages (${String(state.pages.length)})` : "Your pages",
    ]),
  ];

  if (state.pages.length > 0) {
    parts.push(
      el(
        "ul",
        { class: "pages", "aria-label": "Saved pages" },
        state.pages.map((page) => pageEntry(state, page, live)),
      ),
    );
  }

  parts.push(
    el("div", { class: "adders" }, [
      button({
        label: "Start a new page",
        variant: "primary",
        onClick: () => {
          void newPage(getState().doc.target).then(() => {
            dismissSidebar();
            announce("Started a new page");
          });
        },
      }),
    ]),
  );

  // Skipped while the empty state is the thing on screen: it carries its own
  // copy of this same picker, and having both up at once is two disclosures
  // sharing the summary "Start from a template".
  if (!showsEmptyState(state)) parts.push(starterPicker("starters-group"));

  return parts;
}

/** Everything inside the drawer that a keyboard can reach. */
function focusable(panel: HTMLElement): HTMLElement[] {
  return [
    ...panel.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
    ),
  ];
}

/**
 * Keeps a keyboard inside the drawer while it is open.
 *
 * This is the part `showModal()` would have done. Tab from the last control
 * returns to the first and shift tab from the first goes to the last, so focus
 * cannot walk out into a page the seller cannot see.
 *
 * It is also the guarantee that is actually TESTED. `inert` is set on
 * everything behind the drawer, which is the correct thing for a browser, and
 * jsdom implements it neither as a property nor as behaviour: an element inside
 * an inert subtree still takes focus there. Asserting the attribute would be
 * asserting that a word is present, so the containment below is what the tests
 * prove and the attribute is what real browsers act on.
 */
function trapFocus(panel: HTMLElement, event: KeyboardEvent): void {
  if (event.key !== "Tab") return;

  const stops = focusable(panel);
  const first = stops[0];
  const last = stops[stops.length - 1];
  if (first === undefined || last === undefined) {
    // Nothing to move between, so there is nowhere for Tab to go that is not
    // out. Holding it here is still right: out is the page behind the drawer.
    event.preventDefault();
    return;
  }

  const active = document.activeElement;
  if (event.shiftKey && (active === first || active === panel)) {
    event.preventDefault();
    last.focus();
    return;
  }
  if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

/**
 * The drawer, built only when it is open.
 *
 * A closed drawer adds nothing to the DOM and costs nothing per repaint, which
 * is the same rule that keeps the preview pane off a phone: a rebuild measured
 * 37ms on a Moto G7 and two per keystroke dropped typed characters outright.
 *
 * The backdrop is a sibling of the panel rather than its parent, so dismissing
 * by tapping outside is a click on a known element rather than a guess about
 * where a click landed.
 */
export function pagesDrawer(state: State): HTMLElement {
  const panel = el(
    // A plain `div`, not an `aside`. An `aside` is already a `complementary`
    // landmark and `role="dialog"` is not a role it is allowed to take, which
    // axe reports as `aria-allowed-role`. This project has met that rule once
    // before, overriding an `li`'s role and breaking the list it was in, and
    // the answer is the same both times: change the element, not the role.
    //
    // The pinned column below stays an `aside`, because there it really is a
    // complementary landmark and overrides nothing.
    "div",
    {
      id: PANEL_ID,
      class: "pages-panel",
      role: "dialog",
      "aria-modal": "true",
      "aria-label": "Your pages",
      // So the panel itself can hold focus on opening without stealing it from
      // a control the seller has not chosen yet.
      tabindex: "-1",
    },
    [
      button({
        label: "Close your pages",
        glyph: "×",
        onClick: () => {
          dismissSidebar();
        },
      }),
      ...pagesPanelContents(state),
    ],
  );

  panel.addEventListener("keydown", (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      dismissSidebar();
      return;
    }
    trapFocus(panel, event);
  });

  const backdrop = el("div", { class: "pages-backdrop" }, []);
  backdrop.addEventListener("click", (event: MouseEvent) => {
    // Stopped here rather than allowed to travel on. A dismissing tap must not
    // also press whatever happened to be under it.
    event.stopPropagation();
    dismissSidebar();
  });

  return el("div", { class: "pages-drawer" }, [backdrop, panel]);
}

/** The same list, pinned beside the editor where there is room for it. */
export function pagesColumn(state: State): HTMLElement {
  return el(
    "aside",
    { id: PANEL_ID, class: "pages-panel pinned", "aria-label": "Your pages" },
    pagesPanelContents(state),
  );
}

/**
 * Moves focus in when the drawer opens and back to the trigger when it closes.
 *
 * Called after every render, and it acts only on a CHANGE, which is the part
 * that matters. The shell rebuilds its whole interface on every keystroke, so
 * focusing the panel whenever it happens to be open would take the caret out of
 * whatever the seller was typing into.
 */
let wasOpen = false;

export function syncSidebarFocus(open: boolean, trigger: HTMLElement | null): void {
  // Two reasons to take focus, and the second is not obvious.
  //
  // The drawer has just opened, which is the ordinary one. Or it is open and
  // focus has fallen to the body, which happens on any repaint that destroys
  // the control the seller was on: the shell rebuilds its whole interface, and
  // only form fields get their caret put back. A modal that lets focus land on
  // the body behind it is not containing anything, and tab from there walks
  // straight into a page nobody can see.
  //
  // Both conditions require focus to be nowhere useful, so neither can pull the
  // caret out of a field somebody is typing into.
  const lost = document.activeElement === document.body;

  if (open && (!wasOpen || lost)) {
    document.getElementById(PANEL_ID)?.focus({ preventScroll: true });
  } else if (!open && wasOpen) {
    trigger?.focus({ preventScroll: true });
  }
  wasOpen = open;
}

/** Test seam: the focus tracker is module state and a test needs it reset. */
export function resetSidebarFocusTracking(): void {
  wasOpen = false;
}
