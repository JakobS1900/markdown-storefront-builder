/**
 * The selection toolbar for one price list.
 *
 * How many rows are chosen, and the two blunt ways to change that at once.
 * FR-055: the seller must be able to select any subset and select all or none
 * in one action.
 *
 * Only the toolbar lives here for now. The panel that spends a selection on
 * pricing maths, FR-056 onward, is Task 6: this file exists so that task has
 * somewhere to grow that is not `forms.ts`, already 660 lines and rendering
 * nine controls per tier before this feature touched it.
 */
import type { Block } from "@mdsb/engine";

import { button, el } from "./dom.js";
import { clearTierSelection, getState, selectTiers } from "../store.js";

/**
 * The toolbar for one menu block's selection.
 *
 * Reads `state.selectedTiers` only when it names this block: tier ids repeat
 * across menu blocks (see `State.selectedTiers`), so a selection belonging to
 * a different price list must count as nothing here, not as a stale total
 * left over from wherever it was last touched.
 *
 * Within that, the count is still read against this block's live tier ids
 * rather than the raw length of `tierIds`, for the same reason the checkbox
 * in `forms.ts` is: nothing here chases a row being removed, so a stale id
 * left over from a deleted row must not be counted as if it still named
 * something.
 */
export function bulkPricingToolbar(block: Extract<Block, { kind: "menu" }>): HTMLElement {
  const ids = block.tiers.map((tier) => tier.id);
  const selection = getState().selectedTiers;
  const selected =
    selection !== undefined && selection.blockId === block.id
      ? selection.tierIds.filter((id) => ids.includes(id))
      : [];

  return el("div", { class: "bulk-toolbar", role: "group", "aria-label": "Choose items to price" }, [
    el("p", { class: "count" }, [`${String(selected.length)} selected`]),
    button({
      label: "Select all",
      onClick: () => selectTiers(block.id, ids),
    }),
    button({
      label: "Select none",
      onClick: () => clearTierSelection(),
    }),
  ]);
}
