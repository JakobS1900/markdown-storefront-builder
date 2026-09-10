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
import { PORTABLE, TARGETS, compile, findTarget, serializeDocument } from "@mdsb/engine";

import { getState, setTarget } from "../store.js";
import { handOff } from "../files.js";
import { openBackup } from "../import.js";
import { describeBytes } from "../assets.js";
import { MENU_FILE_NAME, buildMenuFile, fetchAssets, fetchPictures } from "../menu-file.js";
import { announce, button, el, render, select } from "./dom.js";
import { storagePanel } from "./storage.js";

/** Where to paste, per host. Kept beside the target ids it describes. */
const WALKTHROUGH: Record<string, string[]> = {
  rentry: [
    "Open rentry.co in a new tab.",
    "Delete the example text in the big box.",
    "Paste your page in.",
    "Set a custom URL and an edit code, and write the edit code down. You cannot change the page later without it.",
    "Press Go.",
  ],
  "text.is": [
    "Open text.is in a new tab.",
    "Paste your page into the big box.",
    "Set a custom URL and an edit code, and write the edit code down. You cannot change the page later without it.",
    "Press Publish.",
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

/**
 * A size somebody can act on, rather than a byte count.
 *
 * FR-077 exists because a menu file with photographs in it can be too large to
 * send, and finding that out from a messaging app that refuses it is finding
 * out too late. Measured in bytes of UTF-8, which is what the file actually is,
 * rather than in characters.
 */
function sizeOf(html: string): string {
  return describeBytes(new TextEncoder().encode(html).length);
}

/**
 * Saves the menu file.
 *
 * Compiled for `MENU_FILE` whatever host is selected above, for the same reason
 * the `.md` button always compiles portable: a file is not a host. FR-074.
 *
 * Reading the web pictures needs the network, so this is asynchronous and the
 * control says so rather than appearing to do nothing. A picture that cannot be
 * read is named in the announcement instead of quietly leaving a hole, FR-076,
 * and so is one held on a device that no longer has it, FR-088.
 */
function menuFileControl(): HTMLButtonElement {
  const control: HTMLButtonElement = button({
    // "Export menu", Jakob's words on 2026-09-09, and the reason is worth
    // keeping because it is the sixth instance of one pattern in this project.
    // This button writes a real `menu.html` of type `text/html`, which is the
    // whole of feature 024 and has shipped since 0.7.0. It was called "Save a
    // menu you can send", the word "export" appeared nowhere on it, and Jakob
    // asked where the export to HTML feature was. The feature existed and the
    // name did not let anyone find it, which is exactly what `specs/027` opens
    // by describing and what a rename fixed the last time.
    label: "Export menu",
    onClick: () => {
      const doc = getState().doc;
      control.disabled = true;
      announce("Preparing your menu file.");

      // Both kinds of picture are gathered before anything is built, because
      // the build is synchronous. Web pictures need the network and pictures on
      // this device need IndexedDB; neither may be reached from inside a render.
      void Promise.all([fetchPictures(doc), fetchAssets(doc)])
        .then(([pictures, resolve]) => {
          const file = buildMenuFile(doc, resolve, pictures);
          const handed = handOff(MENU_FILE_NAME, file.html, "text/html");
          announce(
            [handed.ok ? `${handed.message} It is ${sizeOf(file.html)}.` : handed.message, ...file.notes].join(" "),
          );
        })
        .catch(() => {
          announce("The menu file could not be prepared. Your page is still saved here.");
        })
        .finally(() => {
          control.disabled = false;
        });
    },
  });

  return control;
}

/**
 * The other half of the backup button, which was missing.
 *
 * "A backup you can reopen here" was true about the saving and false about the
 * reopening: there was no file input anywhere in the app. The picker is hidden
 * from assistive technology and from the tab order, with a real button in front
 * of it, which is the same pairing the image field uses and the accessibility
 * gate enforces.
 */
function openBackupControl(): Node[] {
  const picker = el("input", {
    id: "backup-file",
    type: "file",
    accept: "application/json,.json",
    class: "sr-only",
    "aria-hidden": "true",
    tabindex: "-1",
  }) as HTMLInputElement;

  const open = button({
    label: "Open a backup from this device",
    onClick: () => picker.click(),
  });

  picker.addEventListener("change", () => {
    const file = picker.files?.[0];
    if (file === undefined) return;
    open.disabled = true;
    announce("Reading the backup.");

    void file
      .text()
      .then((text) => openBackup(text))
      .catch(() => ({ ok: false, message: "That file could not be read. Nothing has been changed." }))
      .then((result) => {
        open.disabled = false;
        picker.value = "";
        announce(result.message);
      });
  });

  return [open, picker];
}

export function exportSurface(container: HTMLElement): void {
  const state = getState();
  const result = compile(state.doc, state.doc.target);
  const target = findTarget(result.targetId);

  if (result.markdown === "") {
    // The empty page still offers to open a backup. Somebody who has just lost
    // everything is exactly who needs it, and hiding it behind having content
    // would put it out of reach at the only moment it matters.
    render(
      container,
      el("div", { class: "stack" }, [
        el("p", { class: "empty" }, [
          "There is nothing to copy yet. Add a section on the Build tab first, or open a backup you saved earlier.",
        ]),
        el("div", { class: "adders" }, openBackupControl()),
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
      // Asked here rather than in the header, because here is where it can be
      // answered. The output below changes as it changes, and the steps at the
      // bottom become the steps for whatever is chosen, so the consequence of
      // the choice is on screen at the moment it is made.
      select({
        label: "Where you will paste this",
        value: state.doc.target,
        options: TARGETS.map((t) => ({ value: t.id, label: t.name })),
        onChange: (value) => {
          setTarget(value);
          announce(`Now preparing for ${TARGETS.find((t) => t.id === value)?.name ?? value}`);
        },
      }),
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
          label: "Save as a .md file",
          onClick: () => {
            // A file is not a host. The box above is tuned for the one site the
            // artist picked, and a .md file ends up somewhere else entirely:
            // GitHub, Obsidian, a text editor, or a different paste site next
            // year. So the file is compiled portable rather than handed the
            // host-specific output, which is what this button used to do.
            const portable = compile(getState().doc, PORTABLE);
            save("page.md", portable.markdown, "text/markdown");
          },
        }),
        menuFileControl(),
        button({
          label: "Save a backup you can reopen here",
          onClick: () => save("page-backup.json", serializeDocument(state.doc), "application/json"),
        }),
        ...openBackupControl(),
      ]),

      // Beside the save controls, because this is the surface where the size of
      // what is being sent is already on screen, and because the menu file is
      // the only thing a device picture ever appears in. FR-087.
      storagePanel(),

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
