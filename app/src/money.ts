/**
 * Reading and writing a price a seller typed by hand, and the arithmetic that
 * turns a cost into a price.
 *
 * `price` is free text on purpose (`engine/src/document/descriptor.ts`):
 * artists write "45", "from 45", "45+", and "DM me". Arithmetic over that is
 * only safe if it refuses to guess, so anything unparseable comes back as
 * `undefined` rather than a wrong number.
 */

export interface Money {
  /** Whatever the seller wrote before the number, such as "$" or "from ". */
  readonly prefix: string;
  /** Whole cents, so no result depends on binary floating point. */
  readonly cents: number;
  /** Whatever the seller wrote after the number, such as "+". */
  readonly suffix: string;
}

// Group 1 is the prefix, lazily matched and non-numeric so "from " and "$"
// are captured but digits never are. Group 2 is the whole part, either
// comma-grouped thousands or plain digits. Group 3 is an optional one or two
// place decimal. Group 4 is the suffix. Anchoring at both ends is what makes
// "DM me" fail rather than matching some fragment of itself.
const PRICE = /^(\D*?)(\d{1,3}(?:,\d{3})*|\d+)(?:\.(\d{1,2}))?(\D*)$/;

export function parseMoney(text: string): Money | undefined {
  // A seller who typed a trailing space did not mean it as part of the
  // price, and leaving it in would let it be captured into the prefix or
  // suffix group instead of being ignored.
  const match = PRICE.exec(text.trim());
  if (match === null) return undefined;

  const prefix = match[1] ?? "";
  const whole = match[2] ?? "";
  const decimal = match[3];
  const suffix = match[4] ?? "";

  // A decimal comma is rejected by the anchoring above rather than by a
  // special case here: for "1.234,56", the decimal group can take at most
  // two digits, so whatever it leaves over ("4,56" or, if the decimal group
  // is skipped, ".234,56") contains a digit that the suffix group (\D*)
  // structurally cannot absorb, and the `$` anchor then has nothing left to
  // match against. The whole expression simply fails to match, which is why
  // "45.999" and other trailing-number shapes are rejected the same way.

  // Thousands separators are stripped before converting to a number: the
  // whole-part group keeps its commas, and Number() would otherwise fail or
  // read them wrong.
  const wholeCents = Number(whole.replaceAll(",", "")) * 100;

  // Parsed as an integer, and padded to two digits before that, rather than
  // combined with the whole part as a float: parseFloat(x) * 100 is where
  // binary floating point error enters this kind of arithmetic.
  const decimalCents = decimal === undefined ? 0 : Number(decimal.padEnd(2, "0"));

  return { prefix, cents: wholeCents + decimalCents, suffix };
}

export function formatMoney(money: Money, cents: number): string {
  const whole = Math.trunc(cents / 100);
  const remainder = Math.abs(cents % 100)
    .toString()
    .padStart(2, "0");
  return `${money.prefix}${whole}.${remainder}${money.suffix}`;
}

export type Rounding = "99" | "95" | "whole" | "none";

// The smallest value ending in `ending` cents (out of 100) that is greater
// than or equal to `cents`. Rounding never reduces a price: a rule that could
// quietly cut a seller's margin is not one they can trust.
function roundUpToEnding(cents: number, ending: number): number {
  const base = Math.floor(cents / 100) * 100 + ending;
  return base >= cents ? base : base + 100;
}

export function applyPricing(
  cost: Money,
  multiplier: number,
  extraCents: number,
  rounding: Rounding,
): number {
  const computed = Math.round(cost.cents * multiplier) + extraCents;
  switch (rounding) {
    case "99":
      return roundUpToEnding(computed, 99);
    case "95":
      return roundUpToEnding(computed, 95);
    case "whole":
      return Math.ceil(computed / 100) * 100;
    case "none":
      return computed;
  }
}
