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
import { getState, setSurface, type Surface } from "../store.js";
import { handOff } from "../files.js";
import { rememberSurface } from "../surface-history.js";
import { announce, button, el, render, resetFieldIds } from "./dom.js";
import { buildSurface } from "./build.js";
import { exportSurface } from "./export.js";
import { previewSurface } from "./preview.js";

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

function roomForBoth(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia(ROOM_FOR_BOTH).matches;
}

/** Repaints when the window crosses the breakpoint, since the shape changes. */
export function watchWidth(onChange: () => void): () => void {
  if (typeof window.matchMedia !== "function") return () => undefined;
  const query = window.matchMedia(ROOM_FOR_BOTH);
  const handle = (): void => onChange();
  query.addEventListener("change", handle);
  return () => query.removeEventListener("change", handle);
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

  render(
    root,
    // The host picker used to live here, which made it the first control on
    // the page and the first decision asked of somebody who had just arrived.
    // It is unanswerable at that moment: they have not made anything to paste,
    // and they have no reason to know what rentry is. It has moved to the
    // Export tab, where the choice is actually being made and where its effect
    // is visible in the same glance.
    el("header", { class: "bar" }, [el("h1", {}, ["Storefront builder"])]),
    statusLine(),
    el("main", { class: alongside ? "split" : undefined }, panes),
    tabs,
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
