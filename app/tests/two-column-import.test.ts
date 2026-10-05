import { expect, it } from "vitest";

import { buildPagePasteReview } from "../src/page-paste-review.js";
import { readPagePasteTable, readProposal } from "../src/page-text.js";

it("keeps reversed price and item columns as Text until explicitly assigned", () => {
  const text = "| Price | Item |\n| --- | --- |\n| $25 | Portrait |\n| $40 | Landscape |";
  const draft = { text, dropped: [], swapped: [] };
  const initial = buildPagePasteReview(draft);
  expect(initial.blocks).toEqual([{ kind: "prose", text }]);
  expect(initial.sections[0]?.issue).toMatch(/column/i);
  const mapped = buildPagePasteReview({ ...draft, mappings: { 0: { product: 1, price: 0 } } });
  expect(mapped.blocks).toEqual([{ kind: "menu", tiers: [
    { name: "Portrait", price: "$25" }, { name: "Landscape", price: "$40" },
  ] }]);
  expect(mapped.rows.map((row) => row.sourceLine)).toEqual([3, 4]);
  expect(mapped.canConfirm).toBe(true);
});

it("routes repeated unruled headers through mapping without importing them as offers", () => {
  const text = "| Item | Price |\n| --- | --- |\n| Mug | $25 |\n| Item | Price |\n| Cup | $15 |";
  const draft = { text, dropped: [], swapped: [] };
  expect(buildPagePasteReview(draft).blocks).toEqual([{ kind: "prose", text }]);
  const mapped = buildPagePasteReview({ ...draft, mappings: { 0: { product: 0, price: 1 } } });
  expect(mapped.blocks).toEqual([
    { kind: "menu", tiers: [{ name: "Mug", price: "$25" }, { name: "Cup", price: "$15" }] },
  ]);
  expect(mapped.rows.map((row) => row.sourceLine)).toEqual([3, 5]);
  expect(mapped.canConfirm).toBe(true);
});

it.each([
  "| Service | Duration |\n| --- | --- |\n| Coaching | 30 min |\n| Consulting | 60 min |",
  "| Service | Notes |\n| --- | --- |\n| Coaching | Online only |\n| Consulting | By appointment |",
])("preserves non-price table values without inventing prices: %s", (text) => {
  const review = buildPagePasteReview({ text, dropped: [], swapped: [] });
  expect(review.blocks).toEqual([{ kind: "prose", text }]);
  expect(review.rows).toEqual([]);
  const section = readProposal(text).sections[0];
  expect(section === undefined ? undefined : readPagePasteTable(section)?.headers).toHaveLength(2);
});

it("keeps an adjacent delivery note as Text after its table", () => {
  const text = "| Item | Price |\n| --- | --- |\n| Portrait | $25 |\nDelivery is free";
  const review = buildPagePasteReview({ text, dropped: [], swapped: [] });
  expect(review.blocks).toEqual([
    { kind: "menu", tiers: [{ name: "Portrait", price: "$25" }] },
    { kind: "prose", text: "Delivery is free" },
  ]);
  expect(review.rows.map((row) => row.name)).toEqual(["Portrait"]);
});

it("still automatically imports ordinary two-column prices", () => {
  const text = "| Item | Price |\n| --- | --- |\n| Portrait | $25 |\n| Landscape | Ask me |";
  expect(buildPagePasteReview({ text, dropped: [], swapped: [] }).blocks).toEqual([
    { kind: "menu", tiers: [{ name: "Portrait", price: "$25" }, { name: "Landscape", price: "Ask me" }] },
  ]);
});

it("still groups quantity rows under the product named in their header", () => {
  const text = "| Coffee | Price |\n| --- | --- |\n| 250 g | $10 |\n| 500 g | $18 |";
  expect(buildPagePasteReview({ text, dropped: [], swapped: [] }).blocks).toEqual([
    { kind: "menu", tiers: [{ name: "Coffee", price: "", quantities: [
      { amount: "250 g", price: "$10" }, { amount: "500 g", price: "$18" },
    ] }] },
  ]);
});
