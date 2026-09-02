/**
 * Reading a price somebody typed, and refusing to guess.
 *
 * `price` is free text on purpose: the descriptor says artists write "45",
 * "from 45", "45+" and "DM me". Arithmetic over that is only safe if anything
 * unparseable comes back as nothing, so the caller can skip the row visibly
 * rather than inventing a number for it.
 */
import { describe, expect, it } from "vitest";

import { applyPricing, formatMoney, parseMoney } from "../src/money.js";

describe("reading a price", () => {
  it.each([
    ["45", "", 4500, ""],
    ["$45", "$", 4500, ""],
    ["45.50", "", 4550, ""],
    ["from 45", "from ", 4500, ""],
    ["45+", "", 4500, "+"],
    ["1,234.56", "", 123456, ""],
    ["  45  ", "", 4500, ""],
  ])("reads %s", (text, prefix, cents, suffix) => {
    expect(parseMoney(text)).toEqual({ prefix, cents, suffix });
  });

  it.each([["DM me"], [""], ["   "], ["ask"], ["free"]])(
    "returns nothing for %s, rather than a wrong number",
    (text) => {
      expect(parseMoney(text)).toBeUndefined();
    },
  );

  it("refuses a decimal comma rather than guessing which convention it is", () => {
    // 1.234,56 is one thousand two hundred and thirty four in much of Europe
    // and something else entirely if read the other way. A visible skip beats
    // a price wrong by a factor of a thousand. Recorded in the spec.
    expect(parseMoney("1.234,56")).toBeUndefined();
  });
});

describe("writing a price back", () => {
  it("keeps whatever the seller wrote around the number", () => {
    const parsed = parseMoney("from 12");
    if (parsed === undefined) throw new Error("expected a parse");
    expect(formatMoney(parsed, 3899)).toBe("from 38.99");
  });

  it("keeps a currency symbol", () => {
    const parsed = parseMoney("$5");
    if (parsed === undefined) throw new Error("expected a parse");
    expect(formatMoney(parsed, 1299)).toBe("$12.99");
  });
});

describe("computing a price from a cost", () => {
  const cost = (text: string) => {
    const m = parseMoney(text);
    if (m === undefined) throw new Error("expected a parse");
    return m;
  };

  it("multiplies, adds, and rounds up to .99", () => {
    // 1.20 x 3.2 = 3.84, plus 4.50 = 8.34, rounded up to 8.99.
    expect(applyPricing(cost("1.20"), 3.2, 450, "99")).toBe(899);
  });

  it("leaves a price that already ends in .99 alone", () => {
    expect(applyPricing(cost("8.99"), 1, 0, "99")).toBe(899);
  });

  it("rounds 9.00 up to 9.99, never down", () => {
    // Rounding must never reduce a price. A rule that could quietly cut a
    // margin is not one a seller can trust.
    expect(applyPricing(cost("9.00"), 1, 0, "99")).toBe(999);
  });

  it("rounds up to .95 when asked", () => {
    expect(applyPricing(cost("8.34"), 1, 0, "95")).toBe(895);
  });

  it("rounds up to a whole number when asked", () => {
    expect(applyPricing(cost("8.34"), 1, 0, "whole")).toBe(900);
  });

  it("leaves the number alone when asked for no rounding", () => {
    expect(applyPricing(cost("1.20"), 3.2, 450, "none")).toBe(834);
  });

  it("works in whole cents, so no result depends on floating point", () => {
    // 0.1 + 0.2 in floating point is not 0.3. Money never goes near that here.
    expect(applyPricing(cost("0.10"), 1, 20, "none")).toBe(30);
  });
});
