import type { Block } from "../../document/types.js";
import type { Target } from "../capabilities.js";
import type { DiagnosticSink } from "../diagnostics.js";
import { escapeText } from "../escape.js";
import { encodeAddress, isSafeUrl } from "../link.js";
import { bulletList, cell, joinParts, sectionHeading } from "./shared.js";

type Menu = Extract<Block, { kind: "menu" }>;
type Tier = Menu["tiers"][number];

/**
 * Emits a pricing menu.
 *
 * This is usually the reason the page exists, and it is the first section whose
 * good layout depends on a capability a host might lack.
 *
 * With tables, tiers become a table so a client can scan names against prices.
 * Without them, each tier becomes a bold name, its price, and a bullet list of
 * what is included. That reads correctly and loses the column alignment that
 * made the prices scannable, which is what the warning is for.
 */
export function emitMenu(block: Menu, target: Target, sink: DiagnosticSink): string {
  const parts: (string | undefined)[] = [sectionHeading(block.heading, target)];

  /**
   * An item with neither a name nor a price is not an item.
   *
   * Adding one and leaving it produced a row of empty cells in the pasted page,
   * `|  |  |  |`, which a client reads as a gap in the price list with no way
   * to tell what belonged there. Either half is enough to keep the row: "Sketch"
   * with the price still to come is a real line, and so is a blank name against
   * "DM me". Only having neither means nothing was entered.
   *
   * Dropped rather than emitted, and warned about rather than dropped in
   * silence, which is the rule the refused addresses below already follow.
   */
  const tiers = block.tiers.filter((t) => t.name.trim() !== "" || t.price.trim() !== "");

  if (tiers.length !== block.tiers.length) {
    sink.add({
      code: "item_omitted",
      severity: "warning",
      blockId: block.id,
      message:
        "One of your items has no name and no price, so it has been left out. Fill in either one and it will appear.",
    });
  }

  // Holistic review HB-6 established that a refused address must never be
  // dropped in silence, wherever it appears. This is the third such place.
  for (const t of tiers) {
    if (t.imageUrl !== undefined && t.imageUrl !== "" && !isSafeUrl(t.imageUrl)) {
      sink.add({
        code: "link_scheme_refused",
        severity: "warning",
        blockId: block.id,
        message:
          "One of your example images does not have an http:// or https:// address, so it has been left out. Images need a web address to show on your page.",
      });
    }
  }

  if (tiers.length > 0) {
    parts.push(
      target.capabilities.tables
        ? tierTable(tiers, block.currency)
        : tierList(tiers, block.currency, block.id, target, sink),
    );
  }

  if (block.addOns !== undefined && block.addOns.length > 0) {
    parts.push(
      bulletList(
        block.addOns.map(
          (a) => `${escapeText(a.name)}: ${escapeText(withCurrency(a.price, block.currency))}`,
        ),
      ),
    );
  }

  return joinParts(parts);
}

/**
 * Prefixes the currency, but only onto a price that is purely a number.
 *
 * Artists write prices in every imaginable form, which is why the contract
 * stores them as text. "45" wants the currency in front of it. "DM me" does
 * not, and an earlier version of this produced "USD DM me", which is worse than
 * having no currency at all because it reads as a mistake the artist made.
 *
 * The rule is therefore narrow on purpose: digits, separators, and symbols like
 * `+` get the currency. Anything containing a letter is left exactly as the
 * artist wrote it, on the assumption that they had a reason.
 */
function withCurrency(price: string, currency: string | undefined): string {
  if (currency === undefined || currency === "") return price;
  const isBareNumber = /^[\d\s.,+\-/]+$/.test(price.trim());
  return isBareNumber ? `${currency} ${price}` : price;
}

/**
 * An example image for a tier, or nothing.
 *
 * An unsafe address is dropped here rather than emitted, matching the gallery.
 * The caller raises the warning, because it holds the block id.
 */
function tierImage(t: Tier): string {
  if (t.imageUrl === undefined || t.imageUrl === "" || !isSafeUrl(t.imageUrl)) return "";
  return `![${cell(t.name)}](${encodeAddress(t.imageUrl)})`;
}

function tierTable(tiers: readonly Tier[], currency: string | undefined): string {
  // The Example column appears only when at least one tier has a usable image.
  // An empty column on every row would be a worse table for everyone who does
  // not use the feature.
  const withImages = tiers.some((t) => tierImage(t) !== "");

  const rows = tiers.map((t) => {
    const includes = t.includes === undefined ? "" : t.includes.map(cell).join(", ");
    const detail = [t.blurb === undefined ? "" : cell(t.blurb), includes]
      .filter((s) => s !== "")
      .join(". ");
    const cells = [cell(t.name), cell(withCurrency(t.price, currency)), detail];
    if (withImages) cells.push(tierImage(t));
    return `| ${cells.join(" | ")} |`;
  });

  // "Item", the same word the form uses. The section called them tiers in the
  // output, options in one part of the interface, and items in another, which
  // is two words too many for a person who is only listing what they sell.
  const head = withImages
    ? ["| Item | Price | What you get | Example |", "| --- | --- | --- | --- |"]
    : ["| Item | Price | What you get |", "| --- | --- | --- |"];

  return [...head, ...rows].join("\n");
}

function tierList(
  tiers: readonly Tier[],
  currency: string | undefined,
  blockId: string,
  target: Target,
  sink: DiagnosticSink,
): string {
  sink.add({
    code: "table_unsupported",
    severity: "warning",
    blockId,
    capability: "tables",
    message: `${target.name} does not support tables, so your pricing has been laid out as a list instead. It will still read correctly, just without the columns.`,
  });

  return tiers
    .map((t) => {
      const lines = [
        `**${escapeText(t.name)}**: ${escapeText(withCurrency(t.price, currency))}`,
      ];
      if (t.blurb !== undefined && t.blurb !== "") lines.push(escapeText(t.blurb));
      const image = tierImage(t);
      if (image !== "") lines.push(image);
      const includes = t.includes === undefined ? undefined : bulletList(t.includes.map(escapeText));
      if (includes !== undefined) lines.push(includes);
      return lines.join("\n\n");
    })
    .join("\n\n");
}
