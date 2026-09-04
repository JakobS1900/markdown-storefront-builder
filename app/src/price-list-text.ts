/**
 * Reading a price list the seller pasted, without committing to any of it.
 *
 * Everything here is a suggestion. The screen shows the lines as text with
 * ticks on them, and the seller corrects whatever this got wrong before
 * anything becomes a product, so a bad guess costs one tick and never costs
 * data. That is the whole reason this module is allowed to guess at all.
 *
 * It stays pure for the same reason `money.ts` does: the interesting cases are
 * awkward to reach by typing into a rendered screen, and a parser that can only
 * be exercised through the DOM is a parser that does not get exercised.
 *
 * `parseMoney` is used to ask "does this fragment look like a price", never to
 * rewrite one. `engine/src/document/descriptor.ts:73` says why prices are free
 * text: artists write "45", "from 45", "45+" and "DM me", and a reader that
 * substitutes a number for any of those has destroyed what they wrote.
 */
import { parseMoney } from "./money.js";

export type Delimiter = "comma" | "tab" | "pipe" | "dash" | "none";

/** One pasted line, what it looks like it means, and whether to pre-tick it. */
export interface Candidate {
  /** The line exactly as pasted, so the screen can show what it was given. */
  readonly line: string;
  readonly suggested: boolean;
  readonly name: string;
  readonly price: string;
  readonly unit?: string;
  readonly cost?: string;
  /** Whatever the named fields did not claim. Kept, never dropped. */
  readonly blurb?: string;
}

// Tab first and dash last, which is the order of how sure each one makes us.
// A tab is almost never anything but a column boundary; a spaced hyphen is
// often one and is sometimes just punctuation.
const DELIMITERS: readonly { id: Delimiter; pattern: string }[] = [
  { id: "tab", pattern: "\t" },
  { id: "pipe", pattern: "|" },
  { id: "comma", pattern: "," },
  // Spaced, so "Well-loved bag" is a product name and not a split point. An
  // unspaced hyphen inside a word is the common case in real product names,
  // and cutting one in half is a mistake that looks like data loss.
  { id: "dash", pattern: " - " },
];

// Leading list decoration from a Markdown or plain text list. It is how the
// seller wrote a list, not part of what they are selling.
const DECORATION = /^\s*(?:[-*+]\s+|\d+[.)]\s+)/;

// A Markdown table's rule, such as "| --- | :-- |". Pipes, dashes, colons and
// space only, and at least one dash so a row of empty cells is not mistaken
// for one.
const TABLE_RULE = /^[|\s:-]+$/;

/** Whitespace separated pieces, empties dropped. */
function tokens(line: string): string[] {
  return line.split(/\s+/).filter((t) => t !== "");
}

function isBlank(line: string): boolean {
  return line.trim() === "";
}

function isTableRule(line: string): boolean {
  const trimmed = line.trim();
  return trimmed !== "" && TABLE_RULE.test(trimmed) && trimmed.includes("-");
}

/**
 * Which separator this paste uses, judged over the paste as a whole rather
 * than line by line.
 *
 * Per line would be worse in the way that matters: one product name containing
 * a comma would make that single line comma separated while its neighbours
 * were not, and the seller would see one row split differently from the rest
 * for no visible reason. One decision for the whole paste is predictable, and
 * predictable is what makes a wrong guess cheap to correct.
 *
 * A quarter of the lines is the bar. Half was tried first and was wrong for
 * the shape real lists actually have: a list with headings, blank lines and a
 * terms paragraph can easily be under half products and still be a price list.
 */
export function inferDelimiter(lines: readonly string[]): Delimiter {
  const meaningful = lines.filter((line) => !isBlank(line) && !isTableRule(line));
  if (meaningful.length === 0) return "none";

  const bar = Math.max(1, Math.ceil(meaningful.length * 0.25));
  let best: Delimiter = "none";
  let bestCount = 0;

  for (const { id, pattern } of DELIMITERS) {
    const count = meaningful.filter((line) => line.includes(pattern)).length;
    // Strictly greater, so the DELIMITERS order breaks ties rather than the
    // last one examined winning by accident.
    if (count >= bar && count > bestCount) {
      best = id;
      bestCount = count;
    }
  }

  return best;
}

/*
 * Every comma EXCEPT one grouping thousands, which is the one with a digit
 * before it and exactly three digits after it.
 *
 * `parseMoney` accepts "1,234.56" on purpose (`money.ts` says why). Splitting a
 * comma separated paste on every comma therefore turned "Sofa, 1,200" into a
 * product priced 1 with a phantom supplier cost of 200: two modules each
 * correct alone, wrong where they meet, and invisible to a review of either.
 *
 * Written as the negation of "preceded by a digit and followed by exactly three
 * digits", so that "Bananas,400" still splits (the comma has a letter before
 * it) and "Item 0, 0" still splits (the comma has a space after it).
 */
const COMMA_CELLS = /(?<!\d),|,(?!\d{3}(?!\d))/;

/** The line's cells, once its decoration and any surrounding pipes are gone. */
function cells(line: string, delimiter: Delimiter): string[] {
  const bare = line.replace(DECORATION, "").trim();
  if (delimiter === "none") return [bare];

  const pattern = DELIMITERS.find((d) => d.id === delimiter)?.pattern ?? "";
  // A Markdown table row is written "| a | b |", so splitting on the pipe
  // leaves an empty cell at each end. Trimming the fence first is what keeps
  // those out of the product name.
  const fenced = delimiter === "pipe" ? bare.replace(/^\|/, "").replace(/\|$/, "") : bare;
  const on: string | RegExp = delimiter === "comma" ? COMMA_CELLS : pattern;

  return fenced.split(on).map((cell) => cell.trim());
}

/**
 * The fallback when no separator was found: the price is the last thing on the
 * line that holds a digit.
 *
 * Read from the right on purpose. "A3 print 25" has two numbers in it and only
 * the second is a price, which is the usual shape: sizes, weights and counts
 * live in the name, and the price is what the line ends with.
 */
function splitAtLastNumber(bare: string): { name: string; price: string; unit?: string } {
  const parts = tokens(bare);

  // Scanned backwards by hand rather than with `findLastIndex`, which needs
  // lib ES2023. This project targets ES2022 on purpose (`tsconfig.base.json`),
  // and raising the whole project's floor to save four lines here would be the
  // tail wagging the dog. Vitest ran the newer call happily on Node, so only
  // `npm run typecheck` ever caught it, which is the argument for the gate.
  let at = -1;
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const part = parts[i];
    if (part !== undefined && /\d/.test(part)) {
      at = i;
      break;
    }
  }
  // Nothing numeric anywhere, so there is nothing to split on. FR-062: the
  // whole line becomes the name rather than the line being skipped, because a
  // product with no price is still the seller's product.
  if (at <= 0) return { name: bare, price: "" };

  const name = parts.slice(0, at).join(" ");
  const price = parts[at] ?? "";
  const rest = parts.slice(at + 1).join(" ");
  return rest === "" ? { name, price } : { name, price, unit: rest };
}

/**
 * Reads one line into a candidate.
 *
 * The rule for the cells after the name is positional only as a last resort:
 * the price is the first cell that reads as money, the cost is the next one
 * after it, and whatever non-empty cell is left over is the unit. A seller's
 * columns are in whatever order their spreadsheet had them, and "the first
 * number is the price" is wrong less often than "the second column is".
 *
 * When no cell reads as money the FIRST remaining cell is taken as the price
 * anyway, verbatim. That is what carries "DM me" and "from 45" across intact
 * instead of discarding the column they were in.
 */
function readLine(line: string, delimiter: Delimiter): Omit<Candidate, "suggested"> {
  const parts = cells(line, delimiter);
  const bare = line.replace(DECORATION, "").trim();

  // The paste's separator did not appear on this line, so this line gets the
  // fallback rather than being left as one undivided name. Mixed lists are the
  // normal case: a heading, some comma separated items, and one item somebody
  // typed differently.
  if (parts.length < 2) {
    const split = splitAtLastNumber(bare);
    return split.unit === undefined
      ? { line, name: split.name, price: split.price }
      : { line, name: split.name, price: split.price, unit: split.unit };
  }

  const name = parts[0] ?? "";
  const rest = parts.slice(1);

  const moneyAt = rest.findIndex((cell) => parseMoney(cell) !== undefined);
  const priceAt = moneyAt === -1 ? 0 : moneyAt;
  const costAt = rest.findIndex((cell, i) => i > priceAt && parseMoney(cell) !== undefined);
  const unitAt = rest.findIndex((cell, i) => i !== priceAt && i !== costAt && cell !== "");

  const price = rest[priceAt] ?? "";
  const cost = costAt === -1 ? undefined : rest[costAt];
  const unit = unitAt === -1 ? undefined : rest[unitAt];

  // Everything the four named fields did not claim, kept as the blurb rather
  // than dropped. A five column spreadsheet export used to lose its fifth
  // column silently, which breaks the promise SC-003 makes: what the seller
  // wrote is distributed between fields, never discarded. `blurb` is the field
  // on MENU_TIER_FIELDS for prose about an item, so it is where the leftovers
  // belong.
  const spare = rest
    .filter((cell, i) => i !== priceAt && i !== costAt && i !== unitAt && cell !== "")
    .join(", ");

  // Built by spreading rather than by assigning undefined, because
  // `exactOptionalPropertyTypes` is on and an explicit undefined is a
  // different type from an absent key.
  return {
    line,
    name,
    price,
    ...(unit === undefined || unit === "" ? {} : { unit }),
    ...(spare === "" ? {} : { blurb: spare }),
    ...(cost === undefined ? {} : { cost }),
  };
}

/**
 * Whether to pre-tick this line.
 *
 * Getting this wrong in either direction is survivable, which is the point of
 * the design, so it errs towards ticking anything that produced a price and
 * leaves the structural furniture of a list alone.
 */
function looksLikeItem(candidate: Omit<Candidate, "suggested">, isTableHeader: boolean): boolean {
  const trimmed = candidate.line.trim();
  if (trimmed === "" || isTableRule(trimmed)) return false;
  // A Markdown heading is a heading in every list this will ever meet.
  if (trimmed.startsWith("#")) return false;
  // The header row of a table reads exactly like a product row ("Item",
  // "Price") and is the one case content alone cannot tell apart. Its position
  // above the rule is what gives it away.
  if (isTableHeader) return false;
  return candidate.price !== "";
}

/**
 * Every pasted line, in order, as a candidate.
 *
 * One candidate per line including the blanks and the headings, because the
 * seller has to see what they pasted. Dropping the lines this module thinks
 * are not products would be the silent mangling the whole feature exists to
 * avoid, and it would also hide the mistakes: a heading that failed to be
 * recognised is obvious on screen and invisible if it was quietly removed.
 */
export function readCandidates(text: string): readonly Candidate[] {
  const lines = text.split(/\r?\n/);
  const delimiter = inferDelimiter(lines);

  return lines.map((line, i) => {
    const read = readLine(line, delimiter);
    const next = lines[i + 1];
    const isTableHeader = next !== undefined && isTableRule(next);
    return { ...read, suggested: looksLikeItem(read, isTableHeader) };
  });
}

/** A product about to exist, without the id the store will give it. */
export type NewProduct = Omit<Candidate, "line" | "suggested">;

/**
 * Whether this line could become a product at all, if the seller asked.
 *
 * Wider than `suggested` on purpose, and the gap between the two is where the
 * seller's judgement goes. A heading is not suggested, because it is usually a
 * heading, but it CAN be converted, because sometimes it is a product whose
 * price is written elsewhere. Blank lines and a table's rule cannot, because
 * there is no reading of those that is somebody's product.
 */
export function canBeProduct(candidate: Candidate): boolean {
  const trimmed = candidate.line.trim();
  if (trimmed === "" || isTableRule(trimmed)) return false;
  return candidate.name !== "" || candidate.price !== "";
}

/**
 * The ticked candidates, as products, in the order they were pasted.
 *
 * Order is the paste's, not the tick order, so a seller who goes back and
 * ticks a line they missed gets it where they see it rather than at the end.
 */
export function toProducts(candidates: readonly Candidate[], ticked: readonly number[]): readonly NewProduct[] {
  const chosen = new Set(ticked);
  return candidates
    .filter((candidate, i) => chosen.has(i) && canBeProduct(candidate))
    // Built field by field rather than by destructuring `line` and `suggested`
    // away into unused names, which lint rejects, and spread rather than
    // assigned undefined, which `exactOptionalPropertyTypes` rejects.
    .map((candidate) => ({
      name: candidate.name,
      price: candidate.price,
      ...(candidate.unit === undefined ? {} : { unit: candidate.unit }),
      ...(candidate.cost === undefined ? {} : { cost: candidate.cost }),
      ...(candidate.blurb === undefined ? {} : { blurb: candidate.blurb }),
    }));
}
