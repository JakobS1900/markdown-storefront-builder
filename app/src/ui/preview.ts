/**
 * The Preview surface: what the page will look like, and what will not survive.
 *
 * Two halves, and the second is the one an artist would otherwise pay someone
 * for. The rendered page shows what they built. The warnings say which section
 * the chosen host cannot do justice to, and what will be produced instead.
 *
 * Principle VII, honest fidelity: this renders the compiled Markdown, and it
 * states plainly that it is an approximation of the host's renderer rather than
 * the host itself. That caveat is in the interface, not buried in a document,
 * because a limitation the user never sees is not a limitation they were told
 * about.
 */
import { compile, findTarget, type CompileDiagnostic } from "@mdsb/engine";

import { getState, selectBlock, setSurface } from "../store.js";
import { button, el, render } from "./dom.js";
import { KIND_LABEL } from "./forms.js";
import { renderMarkdown } from "./render-markdown.js";

/** The section a warning is about, named as the artist would recognise it. */
function sectionName(blockId: string | undefined): string | undefined {
  if (blockId === undefined) return undefined;
  const block = getState().doc.blocks.find((b) => b.id === blockId);
  return block === undefined ? undefined : KIND_LABEL[block.kind];
}

function diagnosticItem(diagnostic: CompileDiagnostic): HTMLElement {
  const name = sectionName(diagnostic.blockId);

  const children: (Node | string)[] = [el("p", {}, [diagnostic.message])];

  // SC-005: a person must be able to tell which part of their page a warning is
  // about. A button that takes them straight there is the strongest form of
  // that, and it is why the diagnostic carries a block id rather than prose.
  if (diagnostic.blockId !== undefined && name !== undefined) {
    const id = diagnostic.blockId;
    children.push(
      button({
        label: `Go to the ${name} section`,
        onClick: () => {
          selectBlock(id);
          setSurface("build");
        },
      }),
    );
  }

  return el("li", { class: `diagnostic ${diagnostic.severity}` }, children);
}

export function previewSurface(container: HTMLElement): void {
  const state = getState();
  const result = compile(state.doc, state.doc.target);
  const target = findTarget(result.targetId);

  const parts: Node[] = [];

  // Named, not offered. The choice belongs on the Export tab, but what is on
  // screen here depends on it, and an unexplained dependency reads as the
  // preview being wrong rather than as it being for a particular host.
  if (result.markdown !== "") {
    parts.push(
      el("p", { class: "hint" }, [
        `This is how it will look on ${target?.name ?? result.targetId}. You can change that on the Copy tab.`,
      ]),
    );
  }

  if (result.diagnostics.length > 0) {
    parts.push(
      el("section", { class: "warnings", "aria-labelledby": "warnings-heading" }, [
        el("h2", { id: "warnings-heading" }, [
          result.diagnostics.length === 1
            ? "One thing to know before you publish"
            : `${result.diagnostics.length} things to know before you publish`,
        ]),
        el("ul", {}, result.diagnostics.map(diagnosticItem)),
      ]),
    );
  }

  if (result.markdown === "") {
    parts.push(
      el("p", { class: "empty" }, [
        "Nothing to preview yet. Add a section on the Build tab and it will appear here.",
      ]),
    );
  } else {
    const page = el("div", { class: "rendered" });
    page.append(renderMarkdown(result.markdown));
    parts.push(
      el("section", { "aria-labelledby": "preview-heading" }, [
        el("h2", { id: "preview-heading", class: "sr-only" }, ["Preview of your page"]),
        page,
      ]),
    );
  }

  // The honest caveat, in the interface rather than in a document.
  parts.push(
    el("p", { class: "caveat" }, [
      `This is close to how ${target?.name ?? result.targetId} will show your page, but it is our best approximation rather than their software. Check it on the site itself before you share it.`,
    ]),
  );

  render(container, el("div", { class: "stack" }, parts));
}
