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
import { heldAsset } from "../assets.js";
import { menuFileBody } from "../menu-file.js";
import { button, disclosure, el, render } from "./dom.js";
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

  // The menu file is built unconditionally and asked whether IT is empty,
  // rather than being shown only when the paste host has something to say.
  //
  // Those are different questions, and the holistic review found the seam. A
  // page whose only content is a picture from the seller's device compiles to
  // nothing at all for rentry, because no paste host can carry that picture, and
  // to a real file for the menu file, because that is the whole point of it. The
  // old gate was on the paste result, so that seller was told "Nothing to
  // preview yet" while the Copy tab would cheerfully hand them a menu with
  // their picture in it. The preview and the file disagreed about whether the
  // page existed, which is Principle VII failing for exactly the person user
  // story 2 was written for.
  const { body, notes } = menuFileBody(getState().doc, heldAsset);
  const menuFileIsEmpty = body.childNodes.length === 0;

  if (result.markdown === "" && menuFileIsEmpty) {
    parts.push(
      el("p", { class: "empty" }, [
        "Nothing to preview yet. Add a section on the Build tab and it will appear here.",
      ]),
    );
  }

  if (result.markdown !== "") {
    const page = el("div", { class: "rendered" });
    page.append(renderMarkdown(result.markdown));
    parts.push(
      el("section", { "aria-labelledby": "preview-heading" }, [
        el("h2", { id: "preview-heading", class: "sr-only" }, ["Preview of your page"]),
        page,
      ]),
    );

    // Principle VII again, for the other thing this app now produces. The menu
    // file is compiled for its own host, so it is not the same page as the one
    // above: it can carry pictures no paste host will take. Built by the same
    // function the saved file is built by, from the same compiled output, so
    // the two cannot show different things.
    //
    // Folded, because it is the whole page a second time and the seller came
    // here to look at the first one. Web pictures are not read in here: that
    // needs the network, it happens at the point of saving, and doing it on
    // every repaint would fetch a photograph per keystroke.
    //
    // Pictures on the device are different, and that is why this reads the held
    // ones rather than refusing them all. They were gathered when the page was
    // opened and when the seller chose them, so they are already in memory and
    // this lookup is synchronous. Showing them here is Principle VII doing its
    // job: the seller is looking at the file they are about to send, and a
    // preview that dropped every device picture with a note would be describing
    // a file that does not exist.
  }

  if (!menuFileIsEmpty) {
    parts.push(
      disclosure({
        id: "menu-file-preview",
        summary: "The menu file you can save",
        className: "menu-file",
        children: [
          el("p", { class: "hint" }, [
            "This is the file itself, as whoever you send it to will see it. Save it from the Copy tab.",
          ]),
          // Why this can look different from the page above, said rather than
          // left to be noticed. A picture from the device counts toward the per
          // item layout only where the host can show one, so the same page can
          // be a table on rentry and a block per item here. Principle VII wants
          // a divergence stated in the product, not in a document.
          ...(result.markdown === ""
            ? [
                el("p", { class: "caveat" }, [
                  "Your page has nothing a paste host can carry yet, so the preview above is empty. This file still has your pictures in it.",
                ]),
              ]
            : []),
          ...notes.map((note) => el("p", { class: "caveat" }, [note])),
          body,
        ],
      }),
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
