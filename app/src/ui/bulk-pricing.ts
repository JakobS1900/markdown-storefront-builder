/**
 * The selection toolbar and the "Apply pricing" panel for one price list.
 *
 * The toolbar is how many rows are chosen, and the two blunt ways to change
 * that at once. FR-055: the seller must be able to select any subset and
 * select all or none in one action.
 *
 * The panel spends a selection on pricing maths: FR-056 onward. It lives here
 * rather than in `forms.ts`, already 660 lines and rendering nine controls per
 * tier before this feature touched it.
 */
import type { Block } from "@mdsb/engine";

import { announce, button, el, field, select } from "./dom.js";
import { applyPricing, formatMoney, parseMoney, type Money, type Rounding } from "../money.js";
import {
  applyBulkPricing,
  clearTierSelection,
  getState,
  selectedIdsIn,
  selectTiers,
  setBulkPricingInputs,
  undoLast,
} from "../store.js";

type MenuBlock = Extract<Block, { kind: "menu" }>;
type Tier = MenuBlock["tiers"][number];

/** What the three "Apply pricing" inputs hold, as typed text plus the chosen rounding. */
export interface BulkPricingInputs {
  readonly multiplier: string;
  readonly extra: string;
  readonly rounding: Rounding;
}

/** One selected row that will be written, and what it will become. */
export interface BulkPricedRow {
  readonly id: string;
  readonly name: string;
  readonly oldPrice: string;
  readonly newPrice: string;
  readonly profit: string;
}

/** One selected row that will be left alone, and why. */
export interface BulkSkippedRow {
  readonly name: string;
  readonly reason: string;
}

export interface BulkPreview {
  readonly changed: readonly BulkPricedRow[];
  readonly skipped: readonly BulkSkippedRow[];
}

/**
 * No default input is ever pre-filled with a working multiplier or addition:
 * see `computeBulkPreview`'s comment on why blank has to mean "compute
 * nothing" rather than "change nothing".
 */
export const BLANK_BULK_PRICING_INPUTS: BulkPricingInputs = { multiplier: "", extra: "", rounding: "none" };

const EMPTY_MONEY: Money = { prefix: "", cents: 0, suffix: "" };

const ROUNDING_OPTIONS: readonly { value: Rounding; label: string }[] = [
  { value: "99", label: "Ending .99" },
  { value: "95", label: "Ending .95" },
  { value: "whole", label: "A whole number" },
  { value: "none", label: "No rounding" },
];

/**
 * A plain decimal the seller typed into "Multiply cost by" or "Add", or
 * nothing for blank or unreadable text.
 *
 * Deliberately not `parseMoney`: that parser reads a sign as a decoration
 * ("-5" is prefix "-", cents 500, by design, see `money.ts`), which is
 * correct for a price someone else wrote freehand and wrong for a setting the
 * seller is typing right now, where "-10" typed into "Add" has to mean a ten
 * unit discount.
 */
function parseNumber(text: string): number | undefined {
  const trimmed = text.trim();
  if (trimmed === "") return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * The live block, re-read from the document by id.
 *
 * Mirrors `nowBlock` in `forms.ts`, kept local rather than imported to avoid
 * a circular dependency (that file already imports from this one). Read at
 * the moment of writing rather than trusted from render time, the same
 * reason `editTier` there does it: the block a panel was drawn from can be a
 * step behind by the time a button in it is pressed, and applying against a
 * stale snapshot would silently discard whatever else changed in between.
 */
function liveBlock(id: string, fallback: MenuBlock): MenuBlock {
  const found = getState().doc.blocks.find((b) => b.id === id);
  return found !== undefined && found.kind === "menu" ? found : fallback;
}

/**
 * The pure arithmetic FR-056, FR-056a and FR-056b govern: what each selected
 * row becomes, and what gets skipped and why. Takes plain data rather than a
 * block or the store, so the boundary cases that are awkward to reach by
 * typing into a rendered panel (a multiplier of zero, a negative "add" used
 * as a discount, rounding "whole" on an exact multiple, a cost that parses
 * next to a price that does not) can be exercised directly.
 *
 * A multiplier or an addition that does not parse is not guessed at: both
 * must be readable numbers before anything is computed at all, and this is
 * also why the panel's defaults must never be pre-filled with numbers that
 * parse. `"1"` and `"0"` look inert but are not: `price = cost * 1 + 0` is
 * `price = cost`, which zeroes every seller's margin the moment they press
 * Apply without changing anything, on every row where price and cost differ.
 * Blank text is the only default that means "not decided yet" rather than
 * "decided, and the decision happens to erase your markup".
 */
export function computeBulkPreview(tiers: readonly Tier[], selectedIds: readonly string[], inputs: BulkPricingInputs): BulkPreview {
  const multiplier = parseNumber(inputs.multiplier);
  const extra = parseNumber(inputs.extra);
  const changed: BulkPricedRow[] = [];
  const skipped: BulkSkippedRow[] = [];

  if (multiplier === undefined || extra === undefined) return { changed, skipped };

  const extraCents = Math.round(extra * 100);
  for (const id of selectedIds) {
    const index = tiers.findIndex((tier) => tier.id === id);
    const tier = tiers[index];
    if (tier === undefined) continue;
    const name = tier.name.trim() === "" ? `item ${String(index + 1)}` : tier.name.trim();

    // FR-056a. A row whose cost is absent or unparseable is named as
    // skipped and left completely alone: never guessed at, never defaulted.
    const cost = parseMoney(tier.cost ?? "");
    if (cost === undefined) {
      skipped.push({
        name,
        reason: (tier.cost ?? "").trim() === "" ? "no cost recorded" : "cost could not be read",
      });
      continue;
    }

    // FR-056c: the new price keeps whatever the seller wrote around the old
    // one, "from 12" becomes "from 38.99". A price that does not parse at
    // all (never typed, or "DM me") has no surround to keep, so the write
    // falls back to a bare number rather than guessing at one.
    const priceMoney = parseMoney(tier.price) ?? EMPTY_MONEY;
    const newCents = applyPricing(cost, multiplier, extraCents, inputs.rounding);
    changed.push({
      id,
      name,
      oldPrice: tier.price,
      newPrice: formatMoney(priceMoney, newCents),
      // Its own empty-prefix, empty-suffix Money, never the price's:
      // formatMoney places the sign after the prefix, so reusing a price of
      // "$12.99" would render a loss as "$-2.50".
      profit: formatMoney(EMPTY_MONEY, newCents - cost.cents),
    });
  }

  return { changed, skipped };
}

/**
 * The toolbar for one menu block's selection.
 *
 * `selectedIdsIn` does the scoping: tier ids repeat across menu blocks (see
 * `State.selectedTiers`), so a selection belonging to a different price list
 * must count as nothing here, not as a stale total left over from wherever it
 * was last touched. It also reads the count against this block's live tier
 * ids rather than the raw length of `tierIds`, so a stale id left over from a
 * deleted row is not counted as if it still named something.
 */
export function bulkPricingToolbar(block: Extract<Block, { kind: "menu" }>): HTMLElement {
  const selected = selectedIdsIn(block);

  return el("div", { class: "bulk-toolbar", role: "group", "aria-label": "Choose items to price" }, [
    el("p", { class: "count" }, [`${String(selected.length)} selected`]),
    button({
      label: "Select all",
      // Read live rather than the `ids` captured at render time, matching
      // `selectedIdsIn` beside it: a handler is run long after the render that
      // built it, and by then the tiers can differ from what was on screen.
      onClick: () => selectTiers(block.id, liveBlock(block.id, block).tiers.map((tier) => tier.id)),
    }),
    button({
      label: "Select none",
      onClick: () => clearTierSelection(),
    }),
  ]);
}

/**
 * The "Apply pricing" panel: three inputs, the preview FR-056b requires, and
 * the button that commits it. Empty when nothing is selected, since there is
 * nothing to price.
 *
 * Nothing here writes anything until "Apply pricing" is pressed. The preview
 * is pure arithmetic read from the document as it stands, recomputed on every
 * input change, which is what makes "the document is unchanged while the
 * preview is on screen" true by construction rather than by discipline.
 */
export function bulkPricingPanel(block: MenuBlock): HTMLElement[] {
  const selected = selectedIdsIn(block);
  if (selected.length === 0) return [];

  const inputs = getState().bulkPricingInputs ?? BLANK_BULK_PRICING_INPUTS;
  const { changed, skipped } = computeBulkPreview(block.tiers, selected, inputs);

  // Read at the moment a handler runs, not the moment the panel was drawn.
  // Mirrors `nowBlock` in `forms.ts`: repaints are deferred while a field
  // holds focus (`store.ts`'s `typing`), so nothing repaints between typing
  // the multiplier and typing the addition, and every handler below still
  // closes over the `inputs` this render started with. Spreading that stale
  // snapshot in a second handler wrote the first field back to blank the
  // moment it ran. `app/tests/stale-edit.test.ts` is the same defect against
  // `nowBlock`'s callers; this is `bulk-pricing.ts` adopting it.
  const now = () => getState().bulkPricingInputs ?? BLANK_BULK_PRICING_INPUTS;

  return [
    el("div", { class: "bulk-apply", role: "group", "aria-label": "Apply pricing" }, [
      field({
        label: "Multiply cost by",
        value: inputs.multiplier,
        inputMode: "decimal",
        onInput: (v) => setBulkPricingInputs({ ...now(), multiplier: v }),
      }),
      field({
        label: "Add",
        value: inputs.extra,
        inputMode: "decimal",
        onInput: (v) => setBulkPricingInputs({ ...now(), extra: v }),
      }),
      select({
        label: "Round up to",
        value: inputs.rounding,
        options: ROUNDING_OPTIONS,
        onChange: (v) => setBulkPricingInputs({ ...now(), rounding: v as Rounding }),
      }),
      ...(changed.length === 0
        ? []
        : [
            el(
              "ul",
              { class: "bulk-preview" },
              changed.map((row) =>
                el("li", {}, [`${row.name}: ${row.oldPrice} to ${row.newPrice}, profit ${row.profit}`]),
              ),
            ),
          ]),
      ...(skipped.length === 0
        ? []
        : [
            el(
              "ul",
              { class: "bulk-skipped" },
              skipped.map((row) => el("li", {}, [`${row.name}: skipped, ${row.reason}`])),
            ),
          ]),
      button({
        label: "Apply pricing",
        variant: "primary",
        disabled: changed.length === 0,
        onClick: () => {
          // Recomputed from the live block and the live inputs, not from
          // `changed` above: that was built from whatever this render started
          // with, and the two can disagree by the time the button is actually
          // pressed for the same reason the three fields above can. Applying
          // the render-time preview against the live document would let a
          // change typed after the last repaint be silently dropped.
          const current = liveBlock(block.id, block);
          const liveSelected = selectedIdsIn(current);
          const { changed: liveChanged } = computeBulkPreview(current.tiers, liveSelected, now());
          const nextTiers = current.tiers.map((tier) => {
            const row = liveChanged.find((r) => r.id === tier.id);
            return row === undefined ? tier : { ...tier, price: row.newPrice };
          });
          const label = `${String(liveChanged.length)} item${liveChanged.length === 1 ? "" : "s"}`;
          // One `replaceBlocks` call inside `applyBulkPricing`, not one per
          // row: forty rows through one call is one save, not forty.
          applyBulkPricing(current.id, { ...current, tiers: nextTiers }, label);
          announce(`Priced ${label}. Undo is in the price list.`);
        },
      }),
    ]),
  ];
}

/**
 * The offer to put back a whole bulk price application, shown in the price
 * list it changed.
 *
 * Shares `undoLast` with row removal: `State.undo`'s "bulk" variant restores
 * the section wholesale for the same reason a removed row does, so this is
 * the row-undo idea in `forms.ts`'s `rowUndo`, wired to the other kind.
 */
export function bulkUndoOffer(blockId: string): HTMLElement[] {
  const undo = getState().undo;
  if (undo === undefined || undo.kind !== "bulk" || undo.block.id !== blockId) return [];
  return [
    el("div", { class: "undone" }, [
      el("p", {}, [`Priced ${undo.label}.`]),
      button({
        label: `Undo pricing ${undo.label}`,
        variant: "primary",
        onClick: () => undoLast(),
      }),
    ]),
  ];
}
