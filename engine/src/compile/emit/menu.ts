import type { Block } from "../../document/types.js";
import type { Target } from "../capabilities.js";
import type { DiagnosticSink } from "../diagnostics.js";
import { escapeText } from "../escape.js";
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

  if (block.tiers.length > 0) {
    parts.push(
      target.capabilities.tables
        ? tierTable(block.tiers, block.currency)
        : tierList(block.tiers, block.currency, block.id, target, sink),
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

function tierTable(tiers: readonly Tier[], currency: string | undefined): string {
  const rows = tiers.map((t) => {
    const includes = t.includes === undefined ? "" : t.includes.map(cell).join(", ");
    const detail = [t.blurb === undefined ? "" : cell(t.blurb), includes]
      .filter((s) => s !== "")
      .join(". ");
    return `| ${cell(t.name)} | ${cell(withCurrency(t.price, currency))} | ${detail} |`;
  });

  return ["| Tier | Price | What you get |", "| --- | --- | --- |", ...rows].join("\n");
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
      const includes = t.includes === undefined ? undefined : bulletList(t.includes.map(escapeText));
      if (includes !== undefined) lines.push(includes);
      return lines.join("\n\n");
    })
    .join("\n\n");
}
