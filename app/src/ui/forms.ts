/**
 * The editing form for each block kind.
 *
 * One function per kind, dispatched on `kind`, so the compiler complains if the
 * contract gains a section type and nobody writes its form. That is the same
 * discipline the emitters use, for the same reason.
 */
import type { Block } from "@mdsb/engine";

import { button, disclosure, el, field, select } from "./dom.js";
import { imageField } from "./image-field.js";
import { getState, newId } from "../store.js";

type OnChange = (next: Block) => void;

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
      return { id, kind, tiers: [{ name: "", price: "" }] };
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
 * The price list.
 *
 * Reordered after an artist tried it and said it did not feel like adding an
 * item. It did not: the section opened on a heading field and a currency
 * field, then asked you to press "Add an option" before anything you could
 * sell existed, and each option then showed five fields of which three were
 * optional. The two things the section is actually for, what it is and what it
 * costs, were the fourth and fifth things it offered.
 *
 * Now the item comes first and the settings come last. A new price list
 * arrives with one empty item already open, so there is nothing to press
 * before typing, and the shape of the thing is legible at a glance: item,
 * price, another item.
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
        : [...tiers, change({ name: "", price: "" })],
    );

  const shown = block.tiers.length > 0 ? block.tiers : [{ name: "", price: "" }];

  const tiers = shown.map((tier, i) =>
    el("fieldset", { class: "sub item" }, [
      el("legend", {}, [`Item ${i + 1}`]),
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
          imageField({
            label: "Sample image (optional)",
            value: tier.imageUrl ?? "",
            hint: "An example of this option, if you have one online.",
            onInput: (v) => editTier(i, (t) => withOptional(t, "imageUrl", v)),
          }),
        ],
      }),
      // Nothing to remove on the placeholder row, so it does not offer to.
      ...(i < block.tiers.length
        ? [
            button({
              label: `Remove item ${i + 1}`,
              glyph: "×",
              variant: "danger",
              onClick: () => withTiers((tiers) => tiers.filter((_, j) => j !== i)),
            }),
          ]
        : []),
    ]),
  );

  return el("div", {}, [
    ...tiers,
    button({
      label: "Add another item",
      variant: "primary",
      onClick: () => withTiers((tiers) => [...tiers, { name: "", price: "" }]),
    }),
    disclosure({
      summary: "Section settings",
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
      ...(i < block.items.length
        ? [
            button({
              label: `Remove image ${i + 1}`,
              glyph: "×",
              variant: "danger",
              onClick: () => withItems((all) => all.filter((_, j) => j !== i)),
            }),
          ]
        : []),
    ]),
  );

  return el("div", {}, [
    ...items,
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
      button({
        label: `Remove link ${i + 1}`,
        glyph: "×",
        variant: "danger",
        onClick: () => withLinks((all) => all.filter((_, j) => j !== i)),
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
    button({
      label: "Add a link",
      variant: "primary",
      onClick: () => withLinks((all) => [...all, { label: "", url: "" }]),
    }),
  ]);
}
