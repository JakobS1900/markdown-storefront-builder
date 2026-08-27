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
  cancelDelete,
  getState,
  moveBlock,
  removeBlock,
  selectBlock,
  updateBlock,
  update,
} from "../store.js";
import { announce, button, el, field, render } from "./dom.js";
import { KIND_LABEL, blankBlock, blockForm } from "./forms.js";

const ADDABLE: Block["kind"][] = ["profile", "menu", "gallery", "prose", "heading", "divider"];

/** A short description of a section, so the list is scannable. */
function summarise(block: Block): string {
  switch (block.kind) {
    case "heading":
      return block.text === "" ? "Empty heading" : block.text;
    case "divider":
      return "A line across the page";
    case "prose":
      return block.heading ?? (block.text === "" ? "Empty" : block.text.slice(0, 60));
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
        ? el("div", { class: "block-row confirm", role: "group", "aria-label": `Delete ${kind}?` }, [
            el("p", { class: "ask" }, [`Delete ${kind}? This cannot be undone.`]),
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
          ])
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
      ...(blocks.length === 0
        ? [
            el("p", { class: "empty" }, [
              "Your page is empty. Add a section below to start. Most people begin with About you.",
            ]),
          ]
        : [list]),
      el("h2", { class: "sr-only" }, ["Add a section"]),
      adders,
    ]),
  );
}
