/**
 * The editing form for each block kind.
 *
 * One function per kind, dispatched on `kind`, so the compiler complains if the
 * contract gains a section type and nobody writes its form. That is the same
 * discipline the emitters use, for the same reason.
 */
import type { Block } from "@mdsb/engine";

import { bulkPricingPanel, bulkPricingToolbar, bulkUndoOffer } from "./bulk-pricing.js";
import { button, checkbox, disclosure, el, field, select } from "./dom.js";
import { imageField } from "./image-field.js";
import { pasteOpener, pastePanel } from "./price-list-paste.js";
import { formatMoney, parseMoney } from "../money.js";
import { getState, newId, removeRow, selectedIdsIn, toggleTier, undoLast } from "../store.js";

type OnChange = (next: Block) => void;

/**
 * Move up, move down, and remove, for one row inside a section.
 *
 * Sections have had these since the beginning and rows had only remove, which
 * was the wrong way round for anybody with a real list. A shop has three
 * sections and thirty products: reordering matters more down here, and so does
 * getting a deletion back, because a product holds a name, a price, a unit, a
 * bulk table, several details and an image address.
 *
 * Removing goes through the store rather than through `onChange` so the
 * section as it was is remembered. Everything else is an ordinary edit.
 *
 * `count` is the number of REAL rows. The placeholder row past the end is not
 * one, so it gets no tools: there is nothing yet to move or remove.
 */
function rowTools(args: {
  readonly blockId: string;
  readonly noun: string;
  readonly index: number;
  readonly count: number;
  readonly reorder: (from: number, to: number) => Block;
  readonly without: (index: number) => Block;
  readonly onChange: OnChange;
  /**
   * What this row belongs to, when the same words appear more than once.
   *
   * Every product has a "picture 1", so without this there are as many
   * controls called "Remove picture 1" as there are products, and a screen
   * reader listing the buttons on the page reads the same name repeatedly with
   * no way to tell which item each one acts on.
   */
  readonly within?: string;
}): Node[] {
  const { blockId, noun, index, count, reorder, without, onChange, within } = args;
  if (index >= count) return [];
  const name = `${noun} ${index + 1}${within === undefined || within === "" ? "" : ` in ${within}`}`;

  const tools: Node[] = [];
  if (count > 1) {
    tools.push(
      button({
        label: `Move ${name} up`,
        glyph: "\u2191",
        disabled: index === 0,
        onClick: () => onChange(reorder(index, index - 1)),
      }),
      button({
        label: `Move ${name} down`,
        glyph: "\u2193",
        disabled: index === count - 1,
        onClick: () => onChange(reorder(index, index + 1)),
      }),
    );
  }

  tools.push(
    button({
      label: `Remove ${name}`,
      glyph: "\u00d7",
      variant: "danger",
      onClick: () => removeRow(blockId, without(index), name),
    }),
  );

  return [el("div", { class: "block-tools row-tools" }, tools)];
}

/**
 * The offer to put a removed row back, shown where the row was.
 *
 * Same reasoning as the one for sections: at the gap, because that is where
 * the person is already looking, and on no timer, because an undo that expires
 * while somebody is scrolled elsewhere is a safety net that is not there when
 * it is reached for.
 */
function rowUndo(blockId: string): Node[] {
  const undo = getState().undo;
  if (undo === undefined || undo.kind !== "row" || undo.block.id !== blockId) return [];
  return [
    el("div", { class: "undone" }, [
      el("p", {}, [`Removed ${undo.label}.`]),
      button({
        label: `Undo removing ${undo.label}`,
        variant: "primary",
        onClick: () => undoLast(),
      }),
    ]),
  ];
}

/**
 * The picture fields for one item, plus the button that adds another.
 *
 * A blank field is always offered at the end, the same placeholder idea the
 * item rows themselves use: there is something to type into without pressing
 * anything first, and nothing is written until it is typed into.
 */
function pictureFields(
  block: Extract<Block, { kind: "menu" }>,
  tier: Extract<Block, { kind: "menu" }>["tiers"][number],
  at: number,
  editTier: (i: number, change: (t: Extract<Block, { kind: "menu" }>["tiers"][number]) => Extract<Block, { kind: "menu" }>["tiers"][number]) => void,
  onChange: OnChange,
): Node[] {
  const urls = tier.imageUrls ?? [];
  const shown = urls.length > 0 ? [...urls, ""] : [""];
  const named = tier.name.trim() === "" ? `item ${at + 1}` : tier.name.trim();

  const setUrls = (
    t: Extract<Block, { kind: "menu" }>["tiers"][number],
    next: readonly string[],
  ): Extract<Block, { kind: "menu" }>["tiers"][number] => {
    const kept = next.filter((u) => u !== "");
    const out = { ...t } as Record<string, unknown>;
    if (kept.length === 0) delete out["imageUrls"];
    else out["imageUrls"] = kept;
    return out as typeof t;
  };

  const tiersWith = (next: readonly string[]): Block => {
    const now = nowBlock(block);
    return { ...now, tiers: now.tiers.map((t, j) => (j === at ? setUrls(t, next) : t)) };
  };

  return shown.flatMap((url, k) => [
    imageField({
      label: shown.length > 2 ? `Picture ${k + 1} (optional)` : "Picture (optional)",
      value: url,
      hint:
        k === 0
          ? "A photograph of this item, if you have one online. Add more below for other angles."
          : "Another angle, or a detail.",
      onInput: (v) =>
        editTier(at, (t) => {
          const now = [...(t.imageUrls ?? [])];
          if (k < now.length) now[k] = v;
          else if (v !== "") now.push(v);
          return setUrls(t, now);
        }),
    }),
    ...rowTools({
      blockId: block.id,
      noun: "picture",
      index: k,
      count: urls.length,
      within: named,
      reorder: (from, to) => tiersWith(moved(urls, from, to)),
      without: (i) => tiersWith(urls.filter((_, j) => j !== i)),
      onChange,
    }),
  ]);
}

/** Moves one element of a list, returning a new list. */
function moved<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  if (item !== undefined) next.splice(to, 0, item);
  return next;
}

/**
 * The section as it is right now, rather than as it was when this form was
 * drawn.
 *
 * Repaints wait for a pause in typing, so between keystrokes the controls on
 * screen are older than the document. Every handler here was created during the
 * last render, and one that closed over the block from then would rebuild it
 * from a stale copy: filling in a second field put the first field's old value
 * back. Measured on the deployed app, an item name typed and then a price typed
 * within the repaint delay lost the name entirely, and the same held for a name
 * and a tagline, a heading and its text, an image and its caption.
 *
 * Drawing still uses the snapshot it was given, which is correct: that is the
 * state being shown. Only the handlers look at what is live, because by the
 * time one runs, the snapshot is history.
 */
function nowBlock<K extends Block["kind"]>(
  fallback: Extract<Block, { kind: K }>,
): Extract<Block, { kind: K }> {
  const found = getState().doc.blocks.find((b) => b.id === fallback.id);
  return found !== undefined && found.kind === fallback.kind
    ? (found as Extract<Block, { kind: K }>)
    : fallback;
}

/** A default, valid instance of each kind, for the add-section menu. */
export function blankBlock(kind: Block["kind"]): Block {
  const id = newId();
  switch (kind) {
    case "heading":
      return { id, kind, text: "", level: 2 };
    case "divider":
      return { id, kind };
    case "prose":
      return { id, kind, text: "" };
    case "menu":
      // One empty item already there. A price list whose first screen is two
      // optional settings and a button does not read as a price list.
      return { id, kind, tiers: [{ id: newId(), name: "", price: "" }] };
    case "gallery":
      return { id, kind, layout: "grid", items: [{ imageUrl: "" }] };
    case "profile":
      return { id, kind, displayName: "" };
  }
}

/** What each kind is called in the interface, in the artist's words. */
export const KIND_LABEL: Record<Block["kind"], string> = {
  profile: "About you",
  menu: "Prices",
  gallery: "Gallery",
  prose: "Text",
  heading: "Heading",
  divider: "Divider",
};

export function blockForm(block: Block, onChange: OnChange): HTMLElement {
  switch (block.kind) {
    case "heading":
      return headingForm(block, onChange);
    case "divider":
      return el("p", { class: "hint" }, ["A divider has nothing to fill in. It draws a line."]);
    case "prose":
      return proseForm(block, onChange);
    case "menu":
      return menuForm(block, onChange);
    case "gallery":
      return galleryForm(block, onChange);
    case "profile":
      return profileForm(block, onChange);
  }
}

/**
 * Optional text fields are removed when emptied, not stored as "".
 *
 * The contract distinguishes absent from empty and preserves that across a
 * round trip. An editor that wrote "" for every untouched field would fill a
 * saved page with content the artist never entered.
 */
function withOptional<T extends object>(block: T, key: string, value: string): T {
  const next = { ...block } as Record<string, unknown>;
  if (value === "") delete next[key];
  else next[key] = value;
  return next as T;
}

function headingForm(block: Extract<Block, { kind: "heading" }>, onChange: OnChange): HTMLElement {
  return el("div", {}, [
    field({
      label: "Heading text",
      value: block.text,
      onInput: (text) => onChange({ ...nowBlock(block), text }),
    }),
    select({
      label: "Size",
      value: String(block.level),
      options: [1, 2, 3, 4, 5, 6].map((n) => ({
        value: String(n),
        label: n === 1 ? "1 (largest)" : n === 6 ? "6 (smallest)" : String(n),
      })),
      onChange: (v) => onChange({ ...nowBlock(block), level: Number(v) }),
    }),
  ]);
}

function proseForm(block: Extract<Block, { kind: "prose" }>, onChange: OnChange): HTMLElement {
  return el("div", {}, [
    field({
      label: "Section heading (optional)",
      value: block.heading ?? "",
      onInput: (v) => onChange(withOptional(nowBlock(block), "heading", v)),
    }),
    field({
      label: "Text",
      value: block.text,
      multiline: true,
      hint: "Blank line between paragraphs. **bold**, *italic*, [text](https://address) for a link, and lines starting with a dash for a list.",
      onInput: (text) => onChange({ ...nowBlock(block), text }),
    }),
  ]);
}

/**
 * What this item earns, shown beside what it costs to make.
 *
 * Nothing is guessed. `price` is free text and `cost` is free text, so either
 * can fail to parse, and FR-056a's rule applies here too: a row that cannot be
 * read is skipped and shown as skipped, never defaulted to zero. A zero would
 * be a claim ("this item breaks even") that nothing here actually knows, and a
 * dash reads as a value rather than as "not shown". Absence is the only answer
 * that does not lie.
 *
 * The displayed figure is built with its own empty-prefix, empty-suffix
 * `Money`, never the price's. `formatMoney` writes the sign after the prefix,
 * so reusing a price of "$12.99" would render a loss as "$-2.50". Currency
 * wording, if any, belongs to the surrounding text, not to this number.
 *
 * Profit is shown exactly as computed, including negative. A seller who is
 * underwater on an item is precisely who needs to see that, not have it
 * clamped to zero or hidden.
 */
function profitLine(tier: { readonly price: string; readonly cost?: string }): Node[] {
  const cost = parseMoney(tier.cost ?? "");
  const price = parseMoney(tier.price);
  if (cost === undefined || price === undefined) return [];

  const profit = formatMoney({ prefix: "", cents: 0, suffix: "" }, price.cents - cost.cents);
  return [el("p", { class: "profit" }, [`Profit: ${profit}`])];
}

/**
 * The price list.
 *
 * Reordered after an artist tried it and said it did not feel like adding an
 * item. It did not: the section opened on a heading field and a currency
 * field, then asked you to press "Add an option" before anything you could
 * sell existed, and each option then showed five fields of which three were
 * optional. The two things the section is actually for, what it is and what it
 * costs, were the fourth and fifth things it offered.
 *
 * The item comes first and the settings come last. A new price list arrives
 * with one empty item already open, so there is nothing to press before
 * typing, and the shape of the thing is legible at a glance: item, price,
 * another item.
 *
 * The one thing ahead of the items is the bulk pricing toolbar, and only once
 * there is a real row for it to act on: "0 selected", "Select all" and
 * "Select none" ahead of the first Item field would read as settings for a
 * price list that does not exist yet, the same complaint that moved the
 * settings disclosure to the end in the first place. So the toolbar is left
 * out entirely while `block.tiers` is empty, which is also when it would have
 * nothing to select.
 *
 * BLANK_ROW. Seeding a new section was not enough. A section saved before that
 * change, or one whose last row has just been removed, holds no rows at all,
 * and it showed a button offering "another" item beside a folded settings
 * group: nothing to type into, and a button naming something that did not
 * exist. So an empty section now draws one blank row that is not in the
 * document. Typing into it appends the row; leaving it alone writes nothing,
 * which keeps "no items" a state the document can still honestly hold.
 */
function menuForm(block: Extract<Block, { kind: "menu" }>, onChange: OnChange): HTMLElement {
  type Tier = (typeof block.tiers)[number];
  const withTiers = (make: (tiers: readonly Tier[]) => readonly Tier[]): void => {
    const now = nowBlock(block);
    onChange({ ...now, tiers: make(now.tiers) });
  };
  // A row past the end is the placeholder, so typing into it appends rather
  // than editing nothing. See BLANK_ROW above. The row being edited is read
  // from the live section too, or a second field would revert the first.
  const editTier = (i: number, change: (tier: Tier) => Tier): void =>
    withTiers((tiers) =>
      i < tiers.length
        ? tiers.map((t, j) => (i === j ? change(t) : t))
        // Minted here, inside the handler, not while drawing the placeholder
        // row below. Typing is what turns the placeholder into a real row, and
        // this runs once per keystroke that does that, so the id is stable
        // from then on. See the placeholder's own comment for what goes wrong
        // if a render path minted it instead.
        : [...tiers, change({ id: newId(), name: "", price: "" })],
    );

  // A constant, not `newId()`: this row is redrawn every repaint and is not in
  // the document, so a minted id here would be a fresh one on every repaint
  // while the store settles, and the checkbox Task 5 adds must never treat it
  // as selectable. `rowTools` already excludes it by index, since `count` is
  // `block.tiers.length` rather than `shown.length`.
  const shown = block.tiers.length > 0 ? block.tiers : [{ id: "", name: "", price: "" }];

  // `selectedIdsIn` does the scoping: tier ids repeat across menu blocks
  // (`t0` in one price list means nothing about `t0` in another), so a
  // selection that belongs to a different block must read as nothing
  // selected here. See `State.selectedTiers` and the accessor's own comment.
  const selectedIds = selectedIdsIn(block);

  const tiers = shown.map((tier, i) =>
    el("fieldset", { class: "sub item" }, [
      el("legend", {}, [`Item ${i + 1}`]),
      // FR-055. No checkbox on the placeholder row: `i < block.tiers.length`
      // is the same test `rowTools` already uses, since a row that is not in
      // the document has nothing to select. The name falls back to its
      // position rather than a bare "Select", because a fieldset legend does
      // not fold into a control's accessible name: a price list of sixty
      // rows named only "Item" in their legend would otherwise present sixty
      // controls all called "Select".
      ...(i < block.tiers.length
        ? [
            checkbox({
              label: `Select ${tier.name.trim() === "" ? `item ${i + 1}` : tier.name.trim()}`,
              checked: selectedIds.includes(tier.id),
              onChange: () => toggleTier(block.id, tier.id),
            }),
          ]
        : []),
      field({
        label: "Item",
        value: tier.name,
        onInput: (name) => editTier(i, (t) => ({ ...t, name })),
      }),
      field({
        label: "Price",
        value: tier.price,
        hint: 'Anything you like: "45", "from 45", or "DM me".',
        onInput: (price) => editTier(i, (t) => ({ ...t, price })),
      }),
      // Beside the price, because that is what it is measured against. Never
      // compiled: engine/src/document/descriptor.ts says why, and
      // engine/tests/compile/cost-never-published.test.ts is the test that
      // makes the promise true. A customer never sees this field; only the
      // seller who typed it does.
      field({
        label: "What you paid",
        value: tier.cost ?? "",
        hint: "Only you see this. It is never part of your published page.",
        onInput: (v) => editTier(i, (t) => withOptional(t, "cost", v)),
      }),
      ...profitLine(tier),
      // Beside the price, because it qualifies the price. Twenty dollars of
      // bananas is not a price until you know it buys a pound, and this is
      // where somebody is already looking when they type the twenty.
      field({
        label: "What the price buys (optional)",
        value: tier.unit ?? "",
        hint: 'Leave empty for one of something. Or: "per lb", "each", "per hour".',
        onInput: (v) => editTier(i, (t) => withOptional(t, "unit", v)),
      }),
      // Kept at the top level rather than folded away, even though it makes an
      // already long form one field longer. It is the only field here that
      // changes how the whole section is laid out, and a control with that much
      // reach that nobody can find is worse than the extra scroll.
      field({
        label: "Bulk pricing (optional)",
        value: (tier.quantities ?? []).map((q) => `${q.amount} = ${q.price}`).join("\n"),
        multiline: true,
        hint: 'One per line, as "5 lb = 90". Leave empty if you sell one at a time.',
        onInput: (v) => {
          // Lines rather than a pair of boxes per break, for the reason the
          // details field is: three prices would otherwise be six controls plus
          // an add and a remove for each, on a phone. Either separator is
          // accepted so somebody typing a colon out of habit is not punished.
          const parsed = v
            .split("\n")
            .map((line) => {
              const cuts = [line.indexOf("="), line.indexOf(":")].filter((n) => n !== -1);
              if (cuts.length === 0) return { amount: line.trim(), price: "" };
              const at = Math.min(...cuts);
              return { amount: line.slice(0, at).trim(), price: line.slice(at + 1).trim() };
            })
            .filter((q) => q.amount !== "" || q.price !== "");
          editTier(i, (t) => {
            const next = { ...t } as Record<string, unknown>;
            if (parsed.length === 0) delete next["quantities"];
            else next["quantities"] = parsed;
            return next as Tier;
          });
        },
      }),
      disclosure({
        summary: "More details",
        children: [
          field({
            label: "Details (optional)",
            value: (tier.details ?? []).map((d) => `${d.label}: ${d.value}`).join("\n"),
            multiline: true,
            hint: 'One per line, as "Colour: black". Anything you want listed against this item.',
            onInput: (v) => {
              // Typed as lines rather than as pairs of fields. Two boxes per
              // detail is six controls for a phone with three facts on it, and
              // the format people already write is a label, a colon, a value.
              // A line with no colon is kept as a value with no label, which
              // the compiler then leaves out rather than guessing at a label.
              const parsed = v
                .split("\n")
                .map((line) => {
                  const at = line.indexOf(":");
                  return at === -1
                    ? { label: "", value: line.trim() }
                    : { label: line.slice(0, at).trim(), value: line.slice(at + 1).trim() };
                })
                .filter((d) => d.label !== "" || d.value !== "");
              editTier(i, (t) => {
                const next = { ...t } as Record<string, unknown>;
                if (parsed.length === 0) delete next["details"];
                else next["details"] = parsed;
                return next as Tier;
              });
            },
          }),
          field({
            label: "Description (optional)",
            value: tier.blurb ?? "",
            onInput: (v) => editTier(i, (t) => withOptional(t, "blurb", v)),
          }),
          field({
            label: "What is included (optional)",
            value: (tier.includes ?? []).join("\n"),
            multiline: true,
            hint: "One per line.",
            onInput: (v) => {
              const items = v.split("\n").map((s) => s.trim()).filter((s) => s !== "");
              editTier(i, (t) => {
                const next = { ...t } as Record<string, unknown>;
                if (items.length === 0) delete next["includes"];
                else next["includes"] = items;
                return next as Tier;
              });
            },
          }),
          // As many pictures as the item has. A print or a knife wants a
          // front, a back and a detail, and one field made the gallery the
          // only place to put the other two, where nothing says which product
          // they belong to.
          //
          // Repeated address fields rather than one box of addresses, because
          // this field carries a live thumbnail and tells you when a link does
          // not load an image. Typing addresses into a textarea would lose
          // both, and a wrong image address is invisible until somebody else
          // opens the page.
          ...pictureFields(block, tier, i, editTier, onChange),
        ],
      }),
      // Move, reorder and remove. Nothing on the placeholder row, which is not
      // a real item yet, so there is nothing to move or take away.
      ...rowTools({
        blockId: block.id,
        noun: "item",
        index: i,
        count: block.tiers.length,
        reorder: (from, to) => ({ ...nowBlock(block), tiers: moved(nowBlock(block).tiers, from, to) }),
        without: (at) => ({ ...nowBlock(block), tiers: nowBlock(block).tiers.filter((_, j) => j !== at) }),
        onChange,
      }),
    ]),
  );

  return el("div", {}, [
    ...(block.tiers.length === 0 ? [] : [bulkPricingToolbar(block)]),
    ...bulkPricingPanel(block),
    ...tiers,
    ...rowUndo(block.id),
    ...bulkUndoOffer(block.id),
    button({
      label: "Add another item",
      variant: "primary",
      onClick: () => withTiers((tiers) => [...tiers, { id: newId(), name: "", price: "" }]),
    }),
    // Beside "Add another item", because it answers the same question for
    // somebody whose list already exists somewhere else. Feature 023.
    ...pasteOpener(block.id),
    ...pastePanel(block.id),
    disclosure({
      summary: "Section settings",
      // A stable id, which is exactly what `disclosure` asks for from a group
      // that exists once per section. The numbered ids are a function of how
      // many controls were rendered before this point, and the paste panel
      // above renders one checkbox per pasted line. Without this, changing the
      // line count renumbered this group, `restoreOpenGroups` could no longer
      // find it, and Section settings folded itself shut underneath the
      // seller. That is the same defect the page list already hit, recorded in
      // `dom.ts`'s comment on `nextFieldId`.
      id: `menu-settings-${block.id}`,
      children: [
        field({
          label: "Section heading (optional)",
          value: block.heading ?? "",
          onInput: (v) => onChange(withOptional(nowBlock(block), "heading", v)),
        }),
        field({
          label: "Currency (optional)",
          value: block.currency ?? "",
          hint: "For example USD or a symbol. Only added to prices that are just a number.",
          onInput: (v) => onChange(withOptional(nowBlock(block), "currency", v)),
        }),
      ],
    }),
  ]);
}

function galleryForm(block: Extract<Block, { kind: "gallery" }>, onChange: OnChange): HTMLElement {
  // Same placeholder row as the price list, and the same live read. See
  // BLANK_ROW and nowBlock on menuForm.
  type Item = (typeof block.items)[number];
  const withItems = (make: (items: readonly Item[]) => readonly Item[]): void => {
    const now = nowBlock(block);
    onChange({ ...now, items: make(now.items) });
  };
  const editItem = (i: number, change: (item: Item) => Item): void =>
    withItems((items) =>
      i < items.length
        ? items.map((it, j) => (i === j ? change(it) : it))
        : [...items, change({ imageUrl: "" })],
    );

  const shown = block.items.length > 0 ? block.items : [{ imageUrl: "" }];

  const items = shown.map((item, i) =>
    el("fieldset", { class: "sub" }, [
      el("legend", {}, [`Image ${i + 1}`]),
      imageField({
        label: "Image address",
        value: item.imageUrl,
        onInput: (imageUrl) => editItem(i, (it) => ({ ...it, imageUrl })),
      }),
      field({
        label: "Caption (optional)",
        value: item.caption ?? "",
        onInput: (v) => editItem(i, (it) => withOptional(it, "caption", v)),
      }),
      ...rowTools({
        blockId: block.id,
        noun: "image",
        index: i,
        count: block.items.length,
        reorder: (from, to) => ({ ...nowBlock(block), items: moved(nowBlock(block).items, from, to) }),
        without: (at) => ({ ...nowBlock(block), items: nowBlock(block).items.filter((_, j) => j !== at) }),
        onChange,
      }),
    ]),
  );

  return el("div", {}, [
    ...items,
    ...rowUndo(block.id),
    button({
      label: "Add another image",
      variant: "primary",
      onClick: () => withItems((all) => [...all, { imageUrl: "" }]),
    }),
    disclosure({
      summary: "Section settings",
      children: [
        field({
          label: "Section heading (optional)",
          value: block.heading ?? "",
          onInput: (v) => onChange(withOptional(nowBlock(block), "heading", v)),
        }),
        select({
          label: "Layout",
          value: block.layout,
          options: [
            { value: "grid", label: "Grid, two across" },
            { value: "list", label: "One under another" },
            { value: "single", label: "One at a time" },
          ],
          onChange: (v) => onChange({ ...nowBlock(block), layout: v as typeof block.layout }),
        }),
      ],
    }),
  ]);
}

function profileForm(block: Extract<Block, { kind: "profile" }>, onChange: OnChange): HTMLElement {
  // Every handler reads the profile as it is now. See nowBlock on menuForm.
  type Link = NonNullable<(typeof block)["links"]>[number];
  const withLinks = (make: (links: readonly Link[]) => readonly Link[]): void => {
    const now = nowBlock(block);
    onChange({ ...now, links: make(now.links ?? []) });
  };

  const links = (block.links ?? []).map((link, i) =>
    el("fieldset", { class: "sub" }, [
      el("legend", {}, [`Link ${i + 1}`]),
      field({
        label: "What to call it",
        value: link.label,
        onInput: (label) => withLinks((all) => all.map((l, j) => (i === j ? { ...l, label } : l))),
      }),
      field({
        label: "Address",
        value: link.url,
        inputMode: "url",
        hint: "Must start with https://",
        onInput: (url) => withLinks((all) => all.map((l, j) => (i === j ? { ...l, url } : l))),
      }),
      ...rowTools({
        blockId: block.id,
        noun: "link",
        index: i,
        count: (block.links ?? []).length,
        reorder: (from, to) => ({ ...nowBlock(block), links: moved(nowBlock(block).links ?? [], from, to) }),
        without: (at) => ({
          ...nowBlock(block),
          links: (nowBlock(block).links ?? []).filter((_, j) => j !== at),
        }),
        onChange,
      }),
    ]),
  );

  return el("div", {}, [
    field({
      label: "Your name",
      value: block.displayName,
      onInput: (displayName) => onChange({ ...nowBlock(block), displayName }),
    }),
    field({
      label: "One line about you (optional)",
      value: block.tagline ?? "",
      onInput: (v) => onChange(withOptional(nowBlock(block), "tagline", v)),
    }),
    imageField({
      label: "Profile picture address (optional)",
      value: block.avatarUrl ?? "",
      hint: "Paste the address of a picture already online. Leave it blank if you would rather not have one.",
      onInput: (v) => onChange(withOptional(nowBlock(block), "avatarUrl", v)),
    }),
    select({
      label: "Are you taking work",
      value: block.status ?? "",
      options: [
        { value: "", label: "Do not say" },
        { value: "open", label: "Open" },
        { value: "closed", label: "Closed" },
        { value: "waitlist", label: "Waitlist" },
      ],
      onChange: (v) => onChange(withOptional(nowBlock(block), "status", v)),
    }),
    field({
      label: "How you take payment (optional)",
      value: (block.paymentMethods ?? []).join("\n"),
      multiline: true,
      hint: "One per line.",
      onInput: (v) => {
        const items = v.split("\n").map((s) => s.trim()).filter((s) => s !== "");
        const next = { ...nowBlock(block) } as Record<string, unknown>;
        if (items.length === 0) delete next["paymentMethods"];
        else next["paymentMethods"] = items;
        onChange(next as typeof block);
      },
    }),
    ...links,
    ...rowUndo(block.id),
    button({
      label: "Add a link",
      variant: "primary",
      onClick: () => withLinks((all) => [...all, { label: "", url: "" }]),
    }),
  ]);
}
