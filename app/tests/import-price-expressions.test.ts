import { describe, expect, it } from "vitest";
import { buildPagePasteReview } from "../src/page-paste-review.js";
import { readCandidates } from "../src/price-list-text.js";

const offers = [
  ["Portrait from $45", "Portrait", "from $45"],
  ["Full colour from 80", "Full colour", "from 80"],
  ["Logo $100 - $200", "Logo", "$100 - $200"],
  ["Banner $50-$75", "Banner", "$50-$75"],
  ["Lesson $60 / 30 min", "Lesson", "$60 / 30 min"],
  ["Consultation $90 per 60 min", "Consultation", "$90 per 60 min"],
  ["Portrait $ 45", "Portrait", "$ 45"],
  ["Candle, €12,50", "Candle", "€12,50"],
  ["Soap: €4,50", "Soap", "€4,50"],
  ["Small, woven basket $24", "Small, woven basket", "$24"],
  ["A3 print - from £25+", "A3 print", "from £25+"],
  ["- Sculpture from $1,200.50", "Sculpture", "from $1,200.50"],
] as const;

describe("public price expressions stay associated with their item", () => {
  it.each(offers)("reads %s without moving price text into the name", (line, name, price) => {
    expect(readCandidates(line)).toEqual([{ line, name, price, suggested: true }]);
  });

  it("keeps the same exact fields in whole-page review for a mixed creator menu", () => {
    const text = offers.map(([line]) => line).join("\n");
    const review = buildPagePasteReview({ text, dropped: [], swapped: [] });
    expect(review.canConfirm).toBe(true);
    expect(review.blocks).toEqual([{
      kind: "menu", tiers: offers.map(([, name, price]) => ({ name, price })),
    }]);
    expect(review.rows.map(({ name, price }) => ({ name, price })))
      .toEqual(offers.map(([, name, price]) => ({ name, price })));
  });

  it("does not absorb explicitly separated size, cost or note columns into a price", () => {
    expect(readCandidates("Mug | $25 | 12 oz")[0]).toMatchObject({ name: "Mug", price: "$25", unit: "12 oz" });
    expect(readCandidates("Mug\t$25\t12 oz")[0]).toMatchObject({ name: "Mug", price: "$25", unit: "12 oz" });
    expect(readCandidates("Mug, $25, 12 oz, $10, Handmade")[0]).toMatchObject({
      name: "Mug", price: "$25", unit: "12 oz", cost: "$10", blurb: "Handmade",
    });
  });

  it("keeps a supplier's numeric dash columns separate", () => {
    expect(readCandidates("Mug - 25 - $10")[0]).toMatchObject({ name: "Mug", price: "25", cost: "$10" });
  });

  it("keeps explicitly separated quantity and note columns before the price", () => {
    expect(readCandidates("Mug, 12 oz, $25")[0]).toMatchObject({ name: "Mug", unit: "12 oz", price: "$25" });
    expect(readCandidates("Mug, per piece, $25")[0]).toMatchObject({ name: "Mug", unit: "per piece", price: "$25" });
  });

  it("keeps dash-separated quantities and notes before the price", () => {
    expect(readCandidates("Mug - 12 oz - $25")[0]).toMatchObject({ name: "Mug", unit: "12 oz", price: "$25" });
    expect(readCandidates("Mug - per piece - $25")[0]).toMatchObject({ name: "Mug", unit: "per piece", price: "$25" });
  });

  it("never treats contact instructions as private numeric cost", () => {
    const [row] = readCandidates("Portrait, $45, DM me");
    expect(row).toMatchObject({ name: "Portrait", price: "$45", unit: "DM me" });
    expect(row?.cost).toBeUndefined();
  });
});
