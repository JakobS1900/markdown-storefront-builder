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

      return el("li", { class: `block${selected ? " selected" : ""}` }, [
        el("div", { class: "block-row" }, [
          button({
            label: `Edit ${KIND_LABEL[block.kind]}: ${summarise(block)}`,
            variant: "ghost",
            pressed: selected,
            onClick: () => selectBlock(selected ? undefined : block.id),
          }),
          el("div", { class: "block-tools" }, [
            button({
              label: `Move ${KIND_LABEL[block.kind]} up`,
              glyph: "↑",
              disabled: i === 0,
              onClick: () => {
                moveBlock(block.id, -1);
                announce(`Moved ${KIND_LABEL[block.kind]} up`);
              },
            }),
            button({
              label: `Move ${KIND_LABEL[block.kind]} down`,
              glyph: "↓",
              disabled: i === blocks.length - 1,
              onClick: () => {
                moveBlock(block.id, 1);
                announce(`Moved ${KIND_LABEL[block.kind]} down`);
              },
            }),
            button({
              label: `Delete ${KIND_LABEL[block.kind]}`,
              glyph: "×",
              variant: "danger",
              onClick: () => {
                removeBlock(block.id);
                announce(`Deleted ${KIND_LABEL[block.kind]}`);
              },
            }),
          ]),
        ]),
        ...(selected
          ? [el("div", { class: "block-editor" }, [blockForm(block, (next) => updateBlock(block.id, next))])]
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
