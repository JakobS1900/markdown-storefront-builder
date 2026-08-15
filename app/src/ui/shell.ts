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
import { announce, button, el, render, select } from "./dom.js";
import { buildSurface } from "./build.js";

const SURFACES: { id: Surface; label: string }[] = [
  { id: "build", label: "Build" },
  { id: "preview", label: "Preview" },
  { id: "export", label: "Copy" },
];

/** Rendered by later features. Placeholders keep the shell honest meanwhile. */
type SurfaceRenderer = (container: HTMLElement) => void;
const renderers: Partial<Record<Surface, SurfaceRenderer>> = { build: buildSurface };

export function registerSurface(id: Surface, renderer: SurfaceRenderer): void {
  renderers[id] = renderer;
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
          label: "Download exactly what was saved",
          variant: "primary",
          onClick: () => {
            const blob = new Blob([json], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const link = el("a", { href: url, download: "recovered-page.json" });
            link.click();
            URL.revokeObjectURL(url);
            announce("Downloaded the saved file");
          },
        }),
      );
    }

    return el("div", { class: "status error", role: "alert" }, children);
  }

  return el("div", { class: "status", role: "status" }, [
    status.kind === "saved" ? "Saved" : "",
  ]);
}

export function renderShell(root: HTMLElement): void {
  const state = getState();

  const tabs = el(
    "nav",
    { class: "tabs", "aria-label": "Sections of the editor" },
    SURFACES.map((s) =>
      button({
        label: s.label,
        variant: state.surface === s.id ? "primary" : "ghost",
        pressed: state.surface === s.id,
        controls: "surface",
        onClick: () => setSurface(s.id),
      }),
    ),
  );

  const panel = el("div", { id: "surface", class: "surface", role: "tabpanel", "aria-label": "Editor" });
  const renderer = renderers[state.surface];
  if (renderer === undefined) {
    render(panel, el("p", { class: "empty" }, ["This part of the editor is not built yet."]));
  } else {
    renderer(panel);
  }

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
}
