/**
 * Reading a pasted price list, and never committing to what it read.
 *
 * Everything this module decides is a suggestion. The seller sees the lines as
 * text with ticks on them and fixes whatever the guess got wrong, so being
 * wrong here costs one tick and never costs data. That is why these tests care
 * far more about "nothing was lost" than about "the split was clever".
 *
 * The list comes from a spreadsheet, a note, or a Markdown host, because those
 * are the places a seller already keeps one. Hence four delimiters and a
 * fallback rather than one format.
 */
import { describe, expect, it } from "vitest";

import { inferDelimiter, readCandidates } from "../src/price-list-text.js";

describe("inferring what separates a name from a price", () => {
  it.each([
    ["comma", "Bananas, 4\nApples, 3\nPears, 5"],
    ["tab", "Bananas\t4\nApples\t3\nPears\t5"],
    ["pipe", "| Bananas | 4 |\n| Apples | 3 |"],
    ["dash", "Bananas - 4\nApples - 3\nPears - 5"],
  ])("reads a %s separated paste", (expected, text) => {
    expect(inferDelimiter(text.split("\n"))).toBe(expected);
  });

  it("finds no separator in a plain list, so the fallback takes over", () => {
    expect(inferDelimiter(["Bananas $4", "Apples $3"])).toBe("none");
  });

  it("ignores a separator that only one line in a long paste happens to hold", () => {
    // One hyphenated product name in thirty lines does not make the paste
    // dash separated, and treating it as such would cut that one name in half
    // while leaving every other line unsplit.
    const lines = ["Well-loved bag $40", ...Array.from({ length: 9 }, (_, i) => `Item ${String(i)} $${String(i)}`)];
    expect(inferDelimiter(lines)).toBe("none");
  });
});

describe("turning lines into candidate products", () => {
  it("splits a comma separated line into a name and a price", () => {
    const [row] = readCandidates("Bananas, 4");
    expect(row?.name).toBe("Bananas");
    expect(row?.price).toBe("4");
  });

  it("keeps a price no parser can read, exactly as written", () => {
    // The descriptor says why price is free text: "DM me" is a real price and
    // a numeric type would either reject it or discard it.
    const [row] = readCandidates("Custom piece - DM me");
    expect(row?.name).toBe("Custom piece");
    expect(row?.price).toBe("DM me");
  });

  it.each([["from 45"], ["45+"], ["$45"], ["DM me"], ["ask!"]])(
    "carries the price %s across without altering a character",
    (price) => {
      const [row] = readCandidates(`Thing, ${price}`);
      expect(row?.price).toBe(price);
    },
  );

  it("keeps the whole line as a name when there is nothing to split on", () => {
    // FR-062: never skip the line. A product with no price is still the
    // seller's product, and they can type the price afterwards.
    const [row] = readCandidates("Something with no price at all");
    expect(row?.name).toBe("Something with no price at all");
    expect(row?.price).toBe("");
  });

  it.each([
    ["- Bananas, 4", "Bananas"],
    ["* Bananas, 4", "Bananas"],
    ["1. Bananas, 4", "Bananas"],
    ["1) Bananas, 4", "Bananas"],
  ])("strips the list decoration in %s, which is not part of the product", (line, name) => {
    const [row] = readCandidates(line);
    expect(row?.name).toBe(name);
  });

  it("reads a Markdown table without leaving pipes in the product name", () => {
    // The seller is coming from a Markdown host, so this is the common paste,
    // not an exotic one.
    const rows = readCandidates("| Item | Price |\n| --- | --- |\n| Bananas | 4 |\n| Apples | 3 |");
    const suggested = rows.filter((r) => r.suggested);
    expect(suggested.map((r) => r.name)).toEqual(["Bananas", "Apples"]);
    expect(suggested.map((r) => r.price)).toEqual(["4", "3"]);
  });

  it("reads a third column as the unit, which is what one of the price buys", () => {
    const [row] = readCandidates("Bananas, 4, per lb");
    expect(row?.unit).toBe("per lb");
  });

  it("reads a second number as the cost, which is never published", () => {
    const [row] = readCandidates("Bananas, 12, per lb, 4");
    expect(row?.price).toBe("12");
    expect(row?.unit).toBe("per lb");
    expect(row?.cost).toBe("4");
  });

  it("splits on the last number when the paste has no separator", () => {
    const [row] = readCandidates("Large canvas print 60");
    expect(row?.name).toBe("Large canvas print");
    expect(row?.price).toBe("60");
  });

  it("does not cut a name in half at a number that is part of it", () => {
    // "A3" is the size of the print, not its price. The LAST number is the
    // price, which is the whole reason the fallback reads from the right.
    const [row] = readCandidates("A3 print 25");
    expect(row?.name).toBe("A3 print");
    expect(row?.price).toBe("25");
  });
});

describe("the seam with the money parser", () => {
  it("does not split a price at its thousands separator", () => {
    // `parseMoney` accepts "1,234.56" on purpose. A comma separated paste that
    // split on every comma turned a 1,200 sofa into a 1 sofa with a phantom
    // supplier cost of 200. Two modules each correct alone, wrong where they
    // meet, which is exactly what a per-file review cannot see.
    const [row] = readCandidates("Sofa, 1,200");
    expect(row?.name).toBe("Sofa");
    expect(row?.price).toBe("1,200");
    expect(row?.cost).toBeUndefined();
  });

  it("still splits a comma that is separating columns, not grouping digits", () => {
    const [row] = readCandidates("Bananas,400");
    expect(row?.name).toBe("Bananas");
    expect(row?.price).toBe("400");
  });

  it("still splits when the number after the comma is not a thousands group", () => {
    const [row] = readCandidates("Item 0, 0");
    expect(row?.name).toBe("Item 0");
    expect(row?.price).toBe("0");
  });
});

describe("columns nobody named", () => {
  it("keeps a fifth column instead of dropping it on the floor", () => {
    // SC-003 promises what the seller wrote is distributed between fields,
    // never discarded. Reading only price, cost and unit silently lost every
    // column past the fourth, and the character accounting test could not see
    // it because no fixture had five columns.
    const [row] = readCandidates("Bananas, 4, per lb, 2, organic");
    expect(row?.blurb).toContain("organic");
  });

  it("accounts for every character of a five column line", () => {
    const line = "Bananas, 4, per lb, 2, organic, fair trade";
    const strip = (s: string) => s.replaceAll(/[\s,|\t*-]/g, "");
    const [row] = readCandidates(line);
    if (row === undefined) throw new Error("no row");

    const parts = [row.name, row.price, row.unit ?? "", row.cost ?? "", row.blurb ?? ""].join("");
    expect(strip(parts)).toBe(strip(line));
  });
});

describe("which lines get pre-ticked", () => {
  it("ticks the item shaped lines and leaves the rest alone", () => {
    const rows = readCandidates("COMMISSIONS\n\nSketch - 30\nFull colour - 80\n\nTERMS\nHalf up front");
    expect(rows.filter((r) => r.suggested).map((r) => r.name)).toEqual(["Sketch", "Full colour"]);
  });

  it.each([[""], ["   "], ["# Heading"], ["## Prices"]])("does not tick %s", (line) => {
    const rows = readCandidates(`Sketch - 30\n${line}`);
    expect(rows[1]?.suggested).toBe(false);
  });

  it("does not tick a Markdown table's header or its separator row", () => {
    const rows = readCandidates("| Item | Price |\n| --- | --- |\n| Bananas | 4 |");
    expect(rows[0]?.suggested).toBe(false);
    expect(rows[1]?.suggested).toBe(false);
    expect(rows[2]?.suggested).toBe(true);
  });

  it("keeps a row for every line, ticked or not, so nothing vanishes off the screen", () => {
    // The seller has to be able to see what they pasted, including the parts
    // the reader thinks are not products. Dropping them here is exactly the
    // silent mangling this feature exists to avoid.
    const text = "COMMISSIONS\n\nSketch - 30\n\nTERMS";
    expect(readCandidates(text)).toHaveLength(text.split("\n").length);
  });

  it("keeps the original line beside every candidate", () => {
    const rows = readCandidates("- Bananas, 4");
    expect(rows[0]?.line).toBe("- Bananas, 4");
  });
});

describe("losing nothing", () => {
  it("accounts for every non-separator character of every line", () => {
    // The strongest guarantee this module can offer, and the one the whole
    // feature rests on: whatever the seller pasted is still there afterwards,
    // only distributed between fields. Punctuation used as a separator is the
    // single exception, which is why it is stripped from the comparison.
    const text = "Bananas, $4.50, per lb\nCustom piece - DM me\nA3 print 25\nJust a name";
    const strip = (s: string) => s.replaceAll(/[\s,|\t*-]/g, "");

    for (const row of readCandidates(text)) {
      const parts = [row.name, row.price, row.unit ?? "", row.cost ?? ""].join("");
      expect(strip(parts)).toBe(strip(row.line));
    }
  });

  it("handles a paste of ten thousand lines without falling over", () => {
    const text = Array.from({ length: 10000 }, (_, i) => `Item ${String(i)}, ${String(i)}`).join("\n");
    const rows = readCandidates(text);
    expect(rows).toHaveLength(10000);
    expect(rows.every((r) => r.suggested)).toBe(true);
  });
});
