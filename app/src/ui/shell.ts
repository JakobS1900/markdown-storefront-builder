/**
 * The shell: the three surfaces, the target switcher, and the status line.
 *
 * On a phone the surfaces are a bottom tab bar, within thumb reach. On a wider
 * screen the same three sit under the header instead, and the editor keeps a
 * readable column rather than stretching to the window.
 *
 * With room for it, the preview sits beside the editor: the one thing a desktop
 * offers that a phone cannot, which is watching the page take shape without
 * switching away from what you are typing. Only beside Build, because Preview
 * and Copy already have the whole width and a preview beside a preview is
 * nonsense.
 *
 * The decision is made here rather than in CSS, and that is deliberate. Hiding
 * the pane with a media query would still compile the document and build its
 * DOM on every repaint, on the phone, for something the phone cannot show, and
 * that is precisely the work that made typing expensive on a Moto G7. So a
 * narrow screen does not build it at all, and a change of width repaints.
 */
import { getState, openSidebar, setSurface, type Surface } from "../store.js";
import { rememberSidebarOpen } from "../surface-history.js";
import {
  PANEL_ID,
  pagesColumn,
  pagesDrawer,
  syncSidebarFocus,
} from "./pages-sidebar.js";
import { handOff } from "../files.js";
import { rememberSurface } from "../surface-history.js";
import { announce, button, el, render, resetFieldIds } from "./dom.js";
import { buildSurface } from "./build.js";
import { exportSurface } from "./export.js";
import { previewSurface } from "./preview.js";
import { WIZARD_ID, syncWizardFocus, wizardLayer } from "./wizard.js";

const SURFACES: { id: Surface; label: string }[] = [
  { id: "build", label: "Build" },
  { id: "preview", label: "Preview" },
  { id: "export", label: "Copy" },
];

type SurfaceRenderer = (container: HTMLElement) => void;

/** All three surfaces exist as of feature 004. There is no placeholder left. */
const renderers: Record<Surface, SurfaceRenderer> = {
  build: buildSurface,
  preview: previewSurface,
  export: exportSurface,
};

/**
 * The width at which the preview earns a column of its own.
 *
 * Matches the stylesheet's own breakpoint. Read through matchMedia rather than
 * innerWidth so it agrees with the CSS on the same rounding, and so a test can
 * say which side of it we are on.
 */
const ROOM_FOR_BOTH = "(min-width: 900px)";

/**
 * Wide enough to pin the page list open beside everything else.
 *
 * A second breakpoint, which the plan for this feature said not to add, and the
 * reason it was wrong is arithmetic. At 900 pixels the editor already shares the
 * width with the preview; a third column would leave roughly 300 pixels each and
 * make all three worse. Pinning the list at 1300 instead is additive: nothing
 * that happens today at 900 changes, and a laptop gets list, editor and preview
 * at once.
 *
 * Below this the list is a drawer, which is available at every width including
 * a desktop window somebody has made narrow. It is not a phone feature that a
 * desktop tolerates.
 */
const ROOM_FOR_SIDEBAR = "(min-width: 1300px)";

function roomForBoth(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia(ROOM_FOR_BOTH).matches;
}

function roomForSidebar(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia(ROOM_FOR_SIDEBAR).matches;
}

/**
 * Repaints when the window crosses either breakpoint, since the shape changes.
 *
 * Both are watched. Crossing 1300 moves the page list between a drawer and a
 * pinned column, and a window dragged past it while the drawer was open would
 * otherwise keep an overlay up beside the column it just became.
 */
export function watchWidth(onChange: () => void): () => void {
  if (typeof window.matchMedia !== "function") return () => undefined;
  const handle = (): void => onChange();
  const queries = [window.matchMedia(ROOM_FOR_BOTH), window.matchMedia(ROOM_FOR_SIDEBAR)];
  for (const query of queries) query.addEventListener("change", handle);
  return () => {
    for (const query of queries) query.removeEventListener("change", handle);
  };
}

function statusLine(): HTMLElement {
  const { status } = getState();

  if (status.kind === "error") {
    const children: Node[] = [el("p", {}, [status.message ?? "Something went wrong."])];

    // FR-018. A page we refuse to open must still be recoverable as the exact
    // bytes that were saved. The button is part of the error, not hidden in a
    // menu, because this is the moment the artist needs it.
    if (status.rawRecovery !== undefined) {
      const { json } = status.rawRecovery;
      children.push(
        button({
          label: "Save exactly what was saved",
          variant: "primary",
          // Through the same hand-off as the export buttons. This one mattered
          // most and was just as inert in the Android shell: the recovery path
          // is the promise that a page we refuse to open is still not lost.
          onClick: () => announce(handOff("recovered-page.json", json, "application/json").message),
        }),
      );
    }

    return el("div", { class: "status error", role: "alert" }, children);
  }

  // `role="status"` is already an aria-live region, so a busy message is
  // announced as well as shown. Both matter here: the announcement is for a
  // screen reader, and the visible text is for the seller who tapped a template
  // and is watching nothing happen.
  if (status.kind === "busy") {
    return el("div", { class: "status busy", role: "status" }, [
      status.message ?? "Working",
    ]);
  }

  return el("div", { class: "status", role: "status" }, [
    status.kind === "saved" ? "Saved" : "",
  ]);
}

/**
 * Where the caret was, so a repaint can put it back.
 *
 * The label is carried alongside the id because an id only identifies a field
 * for as long as the page keeps its shape. Adding or removing a section
 * renumbers everything after it, and restoring by id alone would then drop the
 * caret into a different field, which is a worse failure than losing it: the
 * next thing typed would silently edit the wrong thing.
 */
interface CaretPosition {
  readonly id: string;
  readonly label: string;
  readonly start: number | null;
  readonly end: number | null;
}

function labelFor(id: string): string {
  return document.querySelector(`label[for="${id}"]`)?.textContent ?? "";
}

function captureCaret(): CaretPosition | null {
  const active = document.activeElement;
  if (!(active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement)) return null;
  if (active.id === "") return null;

  // Selection is unavailable on some input types and throws rather than
  // returning null. The field is still worth refocusing without it.
  let start: number | null = null;
  let end: number | null = null;
  try {
    start = active.selectionStart;
    end = active.selectionEnd;
  } catch {
    start = null;
    end = null;
  }

  return { id: active.id, label: labelFor(active.id), start, end };
}

function restoreCaret(caret: CaretPosition | null): void {
  if (caret === null) return;

  const next = document.getElementById(caret.id);
  if (!(next instanceof HTMLInputElement || next instanceof HTMLTextAreaElement)) return;
  // The id came back as a different field. Better to lose the caret than to
  // start typing into something the artist is not looking at.
  if (labelFor(caret.id) !== caret.label) return;
  if (document.activeElement === next) return;

  // preventScroll because a repaint should not also move the page. Without it
  // the view jumps to the focused field on every keystroke.
  next.focus({ preventScroll: true });
  if (caret.start !== null && caret.end !== null) {
    try {
      next.setSelectionRange(caret.start, caret.end);
    } catch {
      // Same input types as above. Focus alone is the useful part.
    }
  }
}

/**
 * Which folded groups the artist had opened.
 *
 * A repaint builds fresh `details` elements, and a fresh one is closed. Typing
 * inside an opened group would therefore fold it away 200ms later, taking the
 * field being typed into with it, which is the same defect as losing the caret
 * wearing a different hat.
 */
function captureOpenGroups(): string[] {
  return [...document.querySelectorAll("details[open]")]
    .map((node) => node.id)
    .filter((id) => id !== "");
}

function restoreOpenGroups(ids: readonly string[]): void {
  for (const id of ids) {
    const node = document.getElementById(id);
    if (node instanceof HTMLDetailsElement) node.open = true;
  }
}

export function renderShell(root: HTMLElement): void {
  const state = getState();
  // Taken before anything is rebuilt, because the nodes holding the caret and
  // the open groups are about to be thrown away.
  const caret = captureCaret();
  const openGroups = captureOpenGroups();
  resetFieldIds();

  const tabs = el(
    "nav",
    { class: "tabs", "aria-label": "Sections of the editor" },
    SURFACES.map((s) =>
      button({
        label: s.label,
        variant: state.surface === s.id ? "primary" : "ghost",
        pressed: state.surface === s.id,
        controls: "surface",
        onClick: () => {
          // The history entry is what gives the system back gesture somewhere
          // to return to. Without it, back closed the app from every screen.
          rememberSurface(s.id);
          setSurface(s.id);
        },
      }),
    ),
  );

  const panel = el("div", { id: "surface", class: "surface", role: "tabpanel", "aria-label": "Editor" });
  renderers[state.surface](panel);

  // The preview beside the editor, on a screen wide enough to hold both.
  const alongside = state.surface === "build" && roomForBoth();
  const panes: Node[] = [panel];
  if (alongside) {
    const side = el("div", {
      id: "beside",
      class: "surface beside",
      role: "region",
      "aria-label": "Preview of your page",
    });
    previewSurface(side);
    panes.push(side);
  }

  // Pinned where there is room, a drawer everywhere else. Decided here rather
  // than in CSS for the reason the preview pane is: a media query would still
  // build the phone's copy on every repaint for something the phone never
  // shows, and that is the work that made typing expensive on a Moto G7.
  const pinned = roomForSidebar();
  const drawerOpen = state.sidebarOpen && !pinned;

  if (pinned) panes.unshift(pagesColumn(state));

  // The setup wizard, which is a layer over all of it. It has no width to care
  // about: there is one of it, and it is the same at every size.
  const wizardOpen = state.wizardOpen;

  // While either layer is up, everything behind it is out of reach. `inert` is
  // the platform's word for that and it is what a browser acts on. jsdom
  // implements it neither as a property nor as behaviour, so nothing here is
  // proved by asserting the attribute; the focus containment inside the layer
  // is the guarantee the tests actually establish. Both exist because they fail
  // in different places.
  const covered = drawerOpen || wizardOpen;
  const behind = covered ? { inert: "" } : {};

  // Set on the element rather than wrapped in one. `.tabs` is `position:
  // fixed`, and giving it a new parent is how it once ended up pinned to the
  // app instead of the viewport.
  if (covered) tabs.setAttribute("inert", "");

  const trigger = pinned
    ? undefined
    : button({
        label: "Your pages",
        expanded: state.sidebarOpen,
        controls: PANEL_ID,
        onClick: () => {
          rememberSidebarOpen();
          openSidebar();
        },
      });

  render(
    root,
    // The host picker used to live here, which made it the first control on
    // the page and the first decision asked of somebody who had just arrived.
    // It is unanswerable at that moment: they have not made anything to paste,
    // and they have no reason to know what rentry is. It has moved to the
    // Export tab, where the choice is actually being made and where its effect
    // is visible in the same glance.
    el("header", { class: "bar", ...behind }, [
      ...(trigger === undefined ? [] : [trigger]),
      el("h1", {}, ["Storefront builder"]),
    ]),
    statusLine(),
    el("main", { class: alongside ? "split" : undefined, ...behind }, panes),
    tabs,
    ...(drawerOpen ? [pagesDrawer(state)] : []),
    // Last, so it is over the drawer in paint order as well as by z-index.
    // Both really can be open at once: `drawerOpen` below is false while
    // `sidebarOpen` is true on a window wide enough to pin the list, and
    // nothing closes the sidebar when it becomes pinned, so `main` is reachable
    // and the wizard can be opened from behind a list that is still open.
    // `surface-history.ts` works the same case through for the back gesture and
    // explains it at length there.
    ...(wizardOpen ? [wizardLayer(state)] : []),
  );

  // After the render, because the nodes it moves focus to have just been made.
  // It acts only on a change of state, or every keystroke would drag the caret
  // out of the field being typed into and into the panel.
  syncSidebarFocus(
    drawerOpen,
    root.querySelector<HTMLElement>(`.bar [aria-controls="${PANEL_ID}"]`),
  );

  // Second, and unlike the back gesture's ordering in `surface-history.ts`,
  // this order is not load bearing. An earlier version of this comment claimed
  // it was: that it gave the wizard the last word when both layers are up. It
  // would not have. `syncSidebarFocus` runs first and takes focus itself
  // whenever focus has been lost to the body, after which `lost` is false here
  // and this call does nothing.
  //
  // It never arises. Both layers up means `drawerOpen`, which needs a narrow
  // window, and a narrow window with the drawer open has `main` inert, so the
  // wizard cannot be opened from behind it. The pair that IS reachable is the
  // wizard over the PINNED column, and that column lives inside `main` and is
  // inert while the wizard is up, so nothing in it can hold focus either way.
  //
  // Its trigger is drawn by the Build surface's empty state rather than by the
  // shell, which is why this looks anywhere in the tree for it instead of in
  // the header.
  syncWizardFocus(
    wizardOpen,
    root.querySelector<HTMLElement>(`[aria-controls="${WIZARD_ID}"]`),
  );

  // Groups before the caret: a field inside a folded group cannot take focus.
  restoreOpenGroups(openGroups);
  restoreCaret(caret);

  // An offer to undo takes focus when nothing else holds it. The control that
  // was pressed has gone with the section it removed, so without this a
  // keyboard or switch user is left at the top of the document with no idea
  // what changed, and the way back is the thing they cannot find.
  //
  // This replaces the same handling for the delete question, which asked before
  // removing anything. Only when nothing else holds focus, so a later repaint
  // cannot snatch it back from wherever the artist has since tabbed to.
  if (state.undo !== undefined && document.activeElement === document.body) {
    document.querySelector<HTMLElement>(".undone .btn")?.focus({ preventScroll: true });
  }
}
