import type { Block } from "../../document/types.js";
import type { Target } from "../capabilities.js";
import type { DiagnosticSink } from "../diagnostics.js";
import { escapeInline, escapeText } from "../escape.js";
import { encodeAddress, isSafeUrl } from "../link.js";
import { SECTION_HEADING_LEVEL, bulletList, cell, joinParts, sectionHeading } from "./shared.js";

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
    if ((t.imageUrls ?? []).some((u) => u !== "" && !isSafeUrl(u))) {
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
    // One item per block, rather than one table for the section, but only where
    // somebody is actually pricing by quantity. FR-030 and FR-031.
    //
    // The per item layout buys room for a quantity table and costs two real
    // things: the customer can no longer read down a single price column, and
    // twelve items become twelve tables to scroll past. An artist selling three
    // commission tiers would pay both and get nothing back, so they do not pay
    // them. Same rule the optional columns follow, applied to the whole shape.
    //
    // The condition is on the section and not the item, because two layouts
    // inside one price list would read as a rendering fault rather than a
    // feature.
    // Quantities need a table under the item, and several pictures need a row
    // of them: both are more than a table cell can hold. One picture still
    // fits in a column, so one picture does not trigger this and a page that
    // has always had one compiles to exactly what it always did.
    const perItem = tiers.some((t) => realQuantities(t).length > 0 || tierImages(t).length > 1);
    if (perItem) {
      if (!target.capabilities.tables) warnNoTables(block.id, target, sink);
      parts.push(tiers.map((t) => tierBlock(t, block.currency, target)).join("\n\n"));
    } else {
      parts.push(
        target.capabilities.tables
          ? tierTable(tiers, block.currency)
          : tierList(tiers, block.currency, block.id, target, sink),
      );
    }
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
 * Puts the currency against the first number in the price, if there is one.
 *
 * Sellers write prices in every imaginable form, which is why the contract
 * stores them as text. "45" wants the currency. "DM me" does not, and an early
 * version produced "USD DM me", which is worse than no currency at all because
 * it reads as a mistake the seller made.
 *
 * The rule used to be that ONLY a bare number got the symbol: anything
 * containing a letter was left alone, on the assumption the seller had a
 * reason. Building a real shop showed what that costs. A page listing
 * "18 each" beside "from 25 per model" published as "GBP18 each" and
 * "from 25 per model", with the symbol on one line and not the next, and
 * "from 25" is one of the commonest ways there is to write a price.
 *
 * So the test is now "does this contain a number" rather than "is this only a
 * number", and the symbol goes immediately before the first digit. Everything
 * the old rule protected is still protected, because a price with no digit in
 * it is still left exactly as written.
 */
function withCurrency(price: string, currency: string | undefined): string {
  if (currency === undefined || currency === "") return price;
  // Somebody who typed the symbol themselves does not want a second one. The
  // old rule got this for free by refusing anything with a symbol in it.
  if (price.includes(currency)) return price;
  const digit = /\d/.exec(price);
  if (digit === null) return price;
  // "USD 20" wants the space and "$20" does not. A currency written as a word
  // or a code is read as one, and a symbol belongs against the digits. Became
  // visible once units arrived, because "$ 20 per lb" has the space in the one
  // place a price should not.
  const symbol = !/[a-z]/i.test(currency);
  const at = digit.index;
  return `${price.slice(0, at)}${currency}${symbol ? "" : " "}${price.slice(at)}`;
}

/**
 * The pictures of an item that can actually be shown.
 *
 * An unsafe address is dropped here rather than emitted, matching the gallery.
 * The caller raises the warning, because it holds the block id.
 */
function tierImages(t: Tier): string[] {
  const usable = (t.imageUrls ?? []).filter((u) => u !== "" && isSafeUrl(u));
  return usable.map((url, i) => {
    // One picture is described by the item's name. Several need telling apart,
    // or a screen reader reads the same words three times and the listener
    // learns nothing about what the second and third pictures are for.
    const alt = usable.length === 1 ? cell(t.name) : `${cell(t.name)}, picture ${i + 1} of ${usable.length}`;
    return `![${alt}](${encodeAddress(url)})`;
  });
}

/**
 * The one picture a table cell has room for.
 *
 * A cell cannot hold a row of images without becoming unreadable on a phone,
 * so the table layout shows the first and the per item layout shows them all.
 * A tier with more than one picture is why the section chooses the per item
 * layout in the first place, so this only ever runs where there is one.
 */
function tierImage(t: Tier): string {
  return tierImages(t)[0] ?? "";
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

/**
 * The quantity breaks an item actually has.
 *
 * Half a break is one somebody started and abandoned, and it is dropped for the
 * same reason a half filled detail is: an empty row is not a thing anyone meant
 * to publish. FR-029.
 */
function realQuantities(tier: Tier): readonly { amount: string; price: string }[] {
  if (tier.quantities === undefined) return [];
  return tier.quantities
    .map((q) => ({ amount: q.amount.trim(), price: q.price.trim() }))
    .filter((q) => q.amount !== "" && q.price !== "");
}

/** Both table-less paths say the same thing, so they say it in one place. */
function warnNoTables(blockId: string, target: Target, sink: DiagnosticSink): void {
  sink.add({
    code: "table_unsupported",
    severity: "warning",
    blockId,
    capability: "tables",
    message: `${target.name} does not support tables, so your pricing has been laid out as a list instead. It will still read correctly, just without the columns.`,
  });
}

/**
 * Everything about an item other than its name and price, as blocks.
 *
 * Shared by the list fallback and the per item layout so the two cannot drift.
 * The order is the one the fallback has always used, which is what keeps the
 * golden files byte identical.
 */
function itemBody(tier: Tier): string[] {
  const lines: string[] = [];
  if (tier.blurb !== undefined && tier.blurb !== "") lines.push(escapeText(tier.blurb));
  // On one line, separated by spaces, so they render as a row that wraps
  // rather than as a column of full width pictures somebody has to scroll
  // past to reach the next item.
  const images = tierImages(tier);
  if (images.length > 0) lines.push(images.join(" "));
  const includes = tier.includes === undefined ? undefined : bulletList(tier.includes.map(escapeText));
  if (includes !== undefined) lines.push(includes);
  const details = bulletList(
    realDetails(tier).map((d) => `${escapeText(d.label)}: ${escapeText(d.value)}`),
  );
  if (details !== undefined) lines.push(details);
  return lines;
}

/**
 * One item as its own block: a heading carrying the name and price, then the
 * quantities, then everything else.
 *
 * The heading must sit strictly below the section's, and on a host that caps
 * headings at the section level it cannot, so it becomes bold instead. An item
 * rendered at the same level as the section it belongs to would read as a new
 * section, which is worse than not being a heading at all.
 */
function tierBlock(tier: Tier, currency: string | undefined, target: Target): string {
  // An item can legitimately have only one half: "Sketch" with the price still
  // to come, or a blank name against "DM me". A heading reading ", $20" would
  // look like the emitter lost something.
  const title = [tier.name.trim(), pricedAs(tier, currency).trim()]
    .filter((s) => s !== "")
    .map(escapeInline)
    .join(", ");

  const level = SECTION_HEADING_LEVEL + 1;
  const heading =
    level <= target.capabilities.maxHeadingLevel ? `${"#".repeat(level)} ${title}` : `**${title}**`;

  const quantities = realQuantities(tier);
  const parts = [heading];
  if (quantities.length > 0) {
    parts.push(
      target.capabilities.tables
        ? [
            "| Quantity | Price |",
            "| --- | --- |",
            ...quantities.map(
              (q) => `| ${cell(q.amount)} | ${cell(withCurrency(q.price, currency))} |`,
            ),
          ].join("\n")
        : // FR-032. This layout was chosen over the alternative precisely
          // because it still reads correctly here.
          (bulletList(
            quantities.map((q) => `${escapeText(q.amount)}: ${escapeText(withCurrency(q.price, currency))}`),
          ) ?? ""),
    );
  }
  return [...parts, ...itemBody(tier)].join("\n\n");
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
  warnNoTables(blockId, target, sink);

  return tiers
    .map((t) =>
      // Details follow the item as a list, which is what this fallback already
      // does for what is included. See `itemBody`.
      [`**${escapeText(t.name)}**: ${escapeText(pricedAs(t, currency))}`, ...itemBody(t)].join("\n\n"),
    )
    .join("\n\n");
}
