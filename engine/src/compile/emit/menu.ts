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
  if (!isBareNumber) return price;
  // "USD 20" wants the space and "$ 20" does not. A currency written as a word
  // or a code is read as one, and a symbol belongs against the digits. Became
  // visible once units arrived, because "$ 20 per lb" has the space in the one
  // place a price should not.
  const symbol = !/[a-z]/i.test(currency);
  return symbol ? `${currency}${price}` : `${currency} ${price}`;
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

/**
 * Whether a run of text already closes its own sentence.
 *
 * The text has been through the escaper by this point, so a full stop arrives
 * as `\.` on a host whose escape style backslashes one. Both forms end in the
 * punctuation itself, which is why this looks at the last character rather than
 * trying to unescape anything.
 */
function endsSentence(text: string): boolean {
  return /[.!?:]$/.test(text);
}

/**
 * The price, with what it buys.
 *
 * Twenty dollars of bananas is not a price until you know it buys a pound. The
 * unit follows the price in the same breath because it qualifies the price and
 * not the item: "Bananas, per lb" answers a different question.
 */
function pricedAs(tier: Tier, currency: string | undefined): string {
  const price = withCurrency(tier.price, currency);
  const unit = tier.unit === undefined ? "" : tier.unit.trim();
  return unit === "" ? price : `${price} ${unit}`;
}

/**
 * The labelled facts an item actually has.
 *
 * A detail missing either half is one somebody started and abandoned, and it is
 * dropped for the same reason an item with no name and no price is: an empty
 * row is not a thing anyone meant to publish. FR-026a.
 */
function realDetails(tier: Tier): readonly { label: string; value: string }[] {
  if (tier.details === undefined) return [];
  return tier.details
    .map((d) => ({ label: d.label.trim(), value: d.value.trim() }))
    .filter((d) => d.label !== "" && d.value !== "");
}

function tierTable(tiers: readonly Tier[], currency: string | undefined): string {
  // The Example column appears only when at least one tier has a usable image.
  // An empty column on every row would be a worse table for everyone who does
  // not use the feature.
  const withImages = tiers.some((t) => tierImage(t) !== "");
  // The same rule for details: a column of empty cells is a worse table for
  // everybody who does not sell anything with options.
  const withDetails = tiers.some((t) => realDetails(t).length > 0);

  // "What you get" earns its place the same way. It was unconditional, so a
  // greengrocer listing weights and prices got a column of nothing, which is
  // precisely the cost the other two columns are conditional to avoid.
  const describe = (t: Tier): string => {
    const includes = t.includes === undefined ? "" : t.includes.map(cell).join(", ");
    // A table cell cannot hold a bullet list, so the blurb and the list of what
    // is included run together in one column, joined by a full stop. Adding one
    // to a blurb that already ends in punctuation produced "tumbled finish.."
    // eight times in a real page, because most people end a sentence with a
    // full stop and the emitter added a second.
    const parts = [t.blurb === undefined ? "" : cell(t.blurb), includes].filter((s) => s !== "");
    return parts.reduce((acc, part) => (acc === "" ? part : `${acc}${endsSentence(acc) ? " " : ". "}${part}`), "");
  };

  const withDescriptions = tiers.some((t) => describe(t) !== "");

  const rows = tiers.map((t) => {
    const cells = [cell(t.name), cell(pricedAs(t, currency))];
    if (withDescriptions) cells.push(describe(t));
    if (withDetails) {
      cells.push(realDetails(t).map((d) => `${cell(d.label)}: ${cell(d.value)}`).join(", "));
    }
    if (withImages) cells.push(tierImage(t));
    return `| ${cells.join(" | ")} |`;
  });

  // "Item", the same word the form uses. The section called them tiers in the
  // output, options in one part of the interface, and items in another, which
  // is two words too many for a person who is only listing what they sell.
  // Built from the columns actually present, rather than one string per
  // combination, which is four strings for two optional columns and eight for
  // the next one somebody adds.
  const columns = ["Item", "Price"];
  if (withDescriptions) columns.push("What you get");
  if (withDetails) columns.push("Details");
  if (withImages) columns.push("Example");
  const head = [`| ${columns.join(" | ")} |`, `| ${columns.map(() => "---").join(" | ")} |`];

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
        `**${escapeText(t.name)}**: ${escapeText(pricedAs(t, currency))}`,
      ];
      if (t.blurb !== undefined && t.blurb !== "") lines.push(escapeText(t.blurb));
      const image = tierImage(t);
      if (image !== "") lines.push(image);
      const includes = t.includes === undefined ? undefined : bulletList(t.includes.map(escapeText));
      if (includes !== undefined) lines.push(includes);
      // Details follow the item as a list, which is what the fallback already
      // does for what is included.
      const details = bulletList(
        realDetails(t).map((d) => `${escapeText(d.label)}: ${escapeText(d.value)}`),
      );
      if (details !== undefined) lines.push(details);
      return lines.join("\n\n");
    })
    .join("\n\n");
}
