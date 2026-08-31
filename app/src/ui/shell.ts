/**
 * The shell: the three surfaces, the target switcher, and the status line.
 *
 * On a phone the surfaces are a bottom tab bar, within thumb reach. On a wider
 * screen the same three become a split view with Build beside Preview, since
 * seeing both at once is the whole point when there is room for it. One set of
 * components, one layout decision, made in CSS.
 */
import { TARGETS } from "@mdsb/engine";

import { getState, setSurface, setTarget, type Surface } from "../store.js";
import { handOff } from "../files.js";
import { rememberSurface } from "../surface-history.js";
import { announce, button, el, render, resetFieldIds, select } from "./dom.js";
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

  render(
    root,
    el("header", { class: "bar" }, [
      el("h1", {}, ["Storefront builder"]),
      select({
        label: "Where you will paste this",
        value: state.doc.target,
        options: TARGETS.map((t) => ({ value: t.id, label: t.name })),
        onChange: (value) => {
          setTarget(value);
          announce(`Now preparing for ${TARGETS.find((t) => t.id === value)?.name ?? value}`);
        },
      }),
    ]),
    statusLine(),
    el("main", {}, [panel]),
    tabs,
  );

  // Groups before the caret: a field inside a folded group cannot take focus.
  restoreOpenGroups(openGroups);
  restoreCaret(caret);

  // A question that has just appeared takes focus, on the safe answer. The
  // button that raised it no longer exists, so without this a keyboard or
  // switch user is left at the top of the document hunting for what changed.
  // Only when nothing else holds focus, so a later repaint cannot snatch it
  // back from whichever answer the artist has tabbed to.
  if (state.pendingDeleteId !== undefined && document.activeElement === document.body) {
    document.querySelector<HTMLElement>(".block-row.confirm .btn.primary")?.focus({ preventScroll: true });
  }
}
