/**
 * The editing form for each block kind.
 *
 * One function per kind, dispatched on `kind`, so the compiler complains if the
 * contract gains a section type and nobody writes its form. That is the same
 * discipline the emitters use, for the same reason.
 */
import type { Block } from "@mdsb/engine";

import { button, el, field, select } from "./dom.js";
import { imageField } from "./image-field.js";
import { newId } from "../store.js";

type OnChange = (next: Block) => void;

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
      return { id, kind, tiers: [] };
    case "gallery":
      return { id, kind, layout: "grid", items: [] };
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
      onInput: (text) => onChange({ ...block, text }),
    }),
    select({
      label: "Size",
      value: String(block.level),
      options: [1, 2, 3, 4, 5, 6].map((n) => ({
        value: String(n),
        label: n === 1 ? "1 (largest)" : n === 6 ? "6 (smallest)" : String(n),
      })),
      onChange: (v) => onChange({ ...block, level: Number(v) }),
    }),
  ]);
}

function proseForm(block: Extract<Block, { kind: "prose" }>, onChange: OnChange): HTMLElement {
  return el("div", {}, [
    field({
      label: "Section heading (optional)",
      value: block.heading ?? "",
      onInput: (v) => onChange(withOptional(block, "heading", v)),
    }),
    field({
      label: "Text",
      value: block.text,
      multiline: true,
      hint: "Leave a blank line between paragraphs. Formatting like bold and lists is not supported yet.",
      onInput: (text) => onChange({ ...block, text }),
    }),
  ]);
}

function menuForm(block: Extract<Block, { kind: "menu" }>, onChange: OnChange): HTMLElement {
  const tiers = block.tiers.map((tier, i) =>
    el("fieldset", { class: "sub" }, [
      el("legend", {}, [`Option ${i + 1}`]),
      field({
        label: "Name",
        value: tier.name,
        onInput: (name) => onChange({ ...block, tiers: block.tiers.map((t, j) => (i === j ? { ...t, name } : t)) }),
      }),
      field({
        label: "Price",
        value: tier.price,
        hint: 'Anything you like: "45", "from 45", or "DM me".',
        onInput: (price) => onChange({ ...block, tiers: block.tiers.map((t, j) => (i === j ? { ...t, price } : t)) }),
      }),
      field({
        label: "Description (optional)",
        value: tier.blurb ?? "",
        onInput: (v) =>
          onChange({
            ...block,
            tiers: block.tiers.map((t, j) => (i === j ? withOptional(t, "blurb", v) : t)),
          }),
      }),
      field({
        label: "What is included (optional)",
        value: (tier.includes ?? []).join("\n"),
        multiline: true,
        hint: "One per line.",
        onInput: (v) => {
          const items = v.split("\n").map((s) => s.trim()).filter((s) => s !== "");
          const next = { ...tier } as Record<string, unknown>;
          if (items.length === 0) delete next["includes"];
          else next["includes"] = items;
          onChange({ ...block, tiers: block.tiers.map((t, j) => (i === j ? (next as typeof t) : t)) });
        },
      }),
      imageField({
        label: "Sample image (optional)",
        value: tier.imageUrl ?? "",
        hint: "An example of this option, if you have one online.",
        onInput: (v) =>
          onChange({
            ...block,
            tiers: block.tiers.map((t, j) => (i === j ? withOptional(t, "imageUrl", v) : t)),
          }),
      }),
      button({
        label: `Remove option ${i + 1}`,
        variant: "danger",
        onClick: () => onChange({ ...block, tiers: block.tiers.filter((_, j) => j !== i) }),
      }),
    ]),
  );

  return el("div", {}, [
    field({
      label: "Section heading (optional)",
      value: block.heading ?? "",
      onInput: (v) => onChange(withOptional(block, "heading", v)),
    }),
    field({
      label: "Currency (optional)",
      value: block.currency ?? "",
      hint: 'For example USD or a symbol. Only added to prices that are just a number.',
      onInput: (v) => onChange(withOptional(block, "currency", v)),
    }),
    ...tiers,
    button({
      label: "Add an option",
      variant: "primary",
      onClick: () => onChange({ ...block, tiers: [...block.tiers, { name: "", price: "" }] }),
    }),
  ]);
}

function galleryForm(block: Extract<Block, { kind: "gallery" }>, onChange: OnChange): HTMLElement {
  const items = block.items.map((item, i) =>
    el("fieldset", { class: "sub" }, [
      el("legend", {}, [`Image ${i + 1}`]),
      imageField({
        label: "Image address",
        value: item.imageUrl,
        onInput: (imageUrl) =>
          onChange({ ...block, items: block.items.map((it, j) => (i === j ? { ...it, imageUrl } : it)) }),
      }),
      field({
        label: "Caption (optional)",
        value: item.caption ?? "",
        onInput: (v) =>
          onChange({
            ...block,
            items: block.items.map((it, j) => (i === j ? withOptional(it, "caption", v) : it)),
          }),
      }),
      button({
        label: `Remove image ${i + 1}`,
        variant: "danger",
        onClick: () => onChange({ ...block, items: block.items.filter((_, j) => j !== i) }),
      }),
    ]),
  );

  return el("div", {}, [
    field({
      label: "Section heading (optional)",
      value: block.heading ?? "",
      onInput: (v) => onChange(withOptional(block, "heading", v)),
    }),
    select({
      label: "Layout",
      value: block.layout,
      options: [
        { value: "grid", label: "Grid, two across" },
        { value: "list", label: "One under another" },
        { value: "single", label: "One at a time" },
      ],
      onChange: (v) => onChange({ ...block, layout: v as typeof block.layout }),
    }),
    ...items,
    button({
      label: "Add an image",
      variant: "primary",
      onClick: () => onChange({ ...block, items: [...block.items, { imageUrl: "" }] }),
    }),
  ]);
}

function profileForm(block: Extract<Block, { kind: "profile" }>, onChange: OnChange): HTMLElement {
  const links = (block.links ?? []).map((link, i) =>
    el("fieldset", { class: "sub" }, [
      el("legend", {}, [`Link ${i + 1}`]),
      field({
        label: "What to call it",
        value: link.label,
        onInput: (label) =>
          onChange({
            ...block,
            links: (block.links ?? []).map((l, j) => (i === j ? { ...l, label } : l)),
          }),
      }),
      field({
        label: "Address",
        value: link.url,
        inputMode: "url",
        hint: "Must start with https://",
        onInput: (url) =>
          onChange({ ...block, links: (block.links ?? []).map((l, j) => (i === j ? { ...l, url } : l)) }),
      }),
      button({
        label: `Remove link ${i + 1}`,
        variant: "danger",
        onClick: () => onChange({ ...block, links: (block.links ?? []).filter((_, j) => j !== i) }),
      }),
    ]),
  );

  return el("div", {}, [
    field({
      label: "Your name",
      value: block.displayName,
      onInput: (displayName) => onChange({ ...block, displayName }),
    }),
    field({
      label: "One line about you (optional)",
      value: block.tagline ?? "",
      onInput: (v) => onChange(withOptional(block, "tagline", v)),
    }),
    imageField({
      label: "Profile picture address (optional)",
      value: block.avatarUrl ?? "",
      hint: "Paste the address of a picture already online. Leave it blank if you would rather not have one.",
      onInput: (v) => onChange(withOptional(block, "avatarUrl", v)),
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
      onChange: (v) => onChange(withOptional(block, "status", v)),
    }),
    field({
      label: "How you take payment (optional)",
      value: (block.paymentMethods ?? []).join("\n"),
      multiline: true,
      hint: "One per line.",
      onInput: (v) => {
        const items = v.split("\n").map((s) => s.trim()).filter((s) => s !== "");
        const next = { ...block } as Record<string, unknown>;
        if (items.length === 0) delete next["paymentMethods"];
        else next["paymentMethods"] = items;
        onChange(next as typeof block);
      },
    }),
    ...links,
    button({
      label: "Add a link",
      variant: "primary",
      onClick: () => onChange({ ...block, links: [...(block.links ?? []), { label: "", url: "" }] }),
    }),
  ]);
}
