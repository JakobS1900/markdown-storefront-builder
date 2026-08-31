/**
 * The Export surface: getting the Markdown out and onto the host.
 *
 * This is the last step of the whole product, and the one where an artist is
 * most likely to give up. So it gives them the text three ways, and tells them
 * exactly what to do with it, for the host they actually chose.
 *
 * The textarea holding the output is deliberately real and selectable. Clipboard
 * permissions are refused often enough on mobile browsers that a copy button
 * alone would strand people, and "select all and copy by hand" has to work.
 */
import { compile, findTarget, serializeDocument } from "@mdsb/engine";

import { getState } from "../store.js";
import { handOff } from "../files.js";
import { announce, button, el, render } from "./dom.js";

/** Where to paste, per host. Kept beside the target ids it describes. */
const WALKTHROUGH: Record<string, string[]> = {
  rentry: [
    "Open rentry.co in a new tab.",
    "Delete the example text in the big box.",
    "Paste your page in.",
    "Set a custom URL and an edit code, and write the edit code down. You cannot change the page later without it.",
    "Press Go.",
  ],
  portable: [
    "Open the site you want to post on.",
    "Find its editor or paste box.",
    "Paste your page in.",
    "Save or publish, whatever that site calls it.",
    "This version avoids anything unusual, so it should work almost anywhere.",
  ],
};

/** Announces what actually happened, which is not always what was asked for. */
function save(name: string, text: string, type: string): void {
  announce(handOff(name, text, type).message);
}

export function exportSurface(container: HTMLElement): void {
  const state = getState();
  const result = compile(state.doc, state.doc.target);
  const target = findTarget(result.targetId);

  if (result.markdown === "") {
    render(
      container,
      el("p", { class: "empty" }, [
        "There is nothing to copy yet. Add a section on the Build tab first.",
      ]),
    );
    return;
  }

  const output = el("textarea", {
    id: "output",
    rows: 14,
    readonly: true,
    "aria-describedby": "output-hint",
  }) as HTMLTextAreaElement;
  output.value = result.markdown;

  const copy = button({
    label: "Copy the whole thing",
    variant: "primary",
    onClick: () => {
      // Select first, so that if the clipboard write is refused the text is at
      // least highlighted and one keystroke away.
      output.focus();
      output.select();
      void navigator.clipboard
        .writeText(result.markdown)
        .then(() => announce("Copied. Now paste it into your page."))
        .catch(() => {
          announce("This browser would not let the page copy for you. The text is selected, so copy it yourself.");
        });
    },
  });

  const steps = WALKTHROUGH[result.targetId] ?? WALKTHROUGH["portable"] ?? [];

  render(
    container,
    el("div", { class: "stack" }, [
      el("div", { class: "field" }, [
        el("label", { for: "output" }, [`Your page, ready for ${target?.name ?? result.targetId}`]),
        el("p", { class: "hint", id: "output-hint" }, [
          "This is Markdown. It looks like plain text with symbols in it, and the site turns it into your page when you paste it.",
        ]),
        output,
      ]),

      el("div", { class: "adders" }, [
        copy,
        button({
          label: "Save as a file",
          onClick: () => save("page.md", result.markdown, "text/markdown"),
        }),
        button({
          label: "Save a backup you can reopen here",
          onClick: () => save("page-backup.json", serializeDocument(state.doc), "application/json"),
        }),
      ]),

      el("section", { "aria-labelledby": "steps-heading" }, [
        el("h2", { id: "steps-heading" }, ["What to do next"]),
        el("ol", { class: "steps" }, steps.map((s) => el("li", {}, [s]))),
      ]),

      ...(result.diagnostics.length > 0
        ? [
            el("p", { class: "caveat" }, [
              `There ${result.diagnostics.length === 1 ? "is 1 warning" : `are ${result.diagnostics.length} warnings`} about this page. Check the Preview tab before you post it.`,
            ]),
          ]
        : []),
    ]),
  );
}
