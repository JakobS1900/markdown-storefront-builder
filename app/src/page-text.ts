/**
 * Splitting a whole pasted page into runs of lines that belong together.
 *
 * This is the half of feature 029 that has to be right before any of the
 * guessing can be, and it deliberately knows nothing about what a line MEANS.
 * A run is a maximal group of neighbouring lines of compatible kinds; the next
 * chunk turns each run into at most one proposed section. Nothing here knows
 * what a price is, and nothing here calls `readCandidates`.
 *
 * **It lives in the app and not in the engine.** The constitution's Additional
 * Constraints forbid the engine importing from the app, and the whole value of
 * this module is reusing `price-list-text.ts`, which is in the app. Moving that
 * into the engine to make room would drag `money.ts` with it and turn a
 * compiler into a compiler plus a guesser. Principle I also defines the engine
 * as `compile(doc, target)`, and a reader is not a compiler and has no target.
 * `specs/029-paste-a-page/research.md` R1.
 *
 * **It is pure, and nothing lints `app/src` for that** the way ESLint lints
 * `engine/src` for the clock, the DOM and randomness. `app/tests/page-text.test.ts`
 * is the only thing holding FR-029-13: it calls the reader with `Date.now`,
 * `Math.random` and `document` rigged to throw.
 *
 * **Not one character of the seller's text is altered.** Classification trims a
 * copy; the `text` on every `Line` is the line exactly as it arrived, smart
 * quotes, trailing spaces, non breaking spaces and all. R11 is explicit that
 * rewriting a seller's punctuation is altering their words, and SC-002 measures
 * it over generated pastes in `app/tests/page-paste-lossless.test.ts`. The one
 * character this module does drop is the `\r` of a Windows line ending, which
 * is the paste's transport convention rather than anything anybody wrote.
 */
import { isTableRule } from "./price-list-text.js";

/**
 * What one line looks like, before anything reads meaning into a group of them.
 *
 * These are R3's table, plus `headingUnderline`, which R3 does not name and
 * which has to exist anyway. A row of `=` under a heading is not the heading,
 * is not a rule, and is certainly not text, and it has to be SOMETHING: every
 * line index lands in exactly one run or the losslessness property is a lie.
 * The alternative considered was leaving it classified `text` inside a heading
 * run, which leaves every later reader asking why a heading run holds a text
 * line.
 */
export type LineKind = "blank" | "heading" | "headingUnderline" | "rule" | "tableRule" | "tableHeader" | "text";

/** One line of the paste, classified. */
export interface Line {
  /** The line exactly as pasted, never altered. */
  readonly text: string;
  readonly kind: LineKind;
  /**
   * 1 to 6, on a heading only.
   *
   * Typed as a number rather than as a union of the six literals, because the
   * constraint that matters lives in `engine/src/document/descriptor.ts:223`
   * (integer, min 1, max 6) and the validator enforces it there. The `#`
   * pattern below caps the count at six by construction, so a union here would
   * buy a cast rather than a guarantee.
   */
  readonly level?: number;
}

/** What a whole run of lines is, which is coarser than what each line is. */
export type RunKind = "blank" | "heading" | "rule" | "text";

/** One group of neighbouring lines, and the range of the paste it claims. */
export interface Run {
  readonly kind: RunKind;
  /** First and last line index, inclusive. Together they prove nothing was lost. */
  readonly from: number;
  readonly to: number;
  readonly lines: readonly Line[];
}

// A Markdown heading, `#` to `######` then a space. The space is required, per
// R3's table and per CommonMark, and it is the only reading that leaves room
// for a seller who begins a line with a hashtag: without it "#commissionsopen"
// becomes an empty level 1 heading and the word is gone.
const ATX_HEADING = /^(#{1,6})(?:\s|$)/;

// A setext underline: a row of `=` or a row of `-`, and nothing else on the
// line. Strict on purpose. "- - -" is a thematic break and never an underline,
// and the only thing separating the two is whether the characters are adjacent.
const SETEXT_UNDERLINE = /^(?:=+|-+)$/;

// A thematic break: three or more of `-`, `*` or `_`, alone on the line. Tested
// against the line with its whitespace removed, which is what makes "* * *" and
// "***" the same thing, as Markdown says they are.
const THEMATIC_BREAK = /^(?:-{3,}|\*{3,}|_{3,})$/;

/** Which run a line of each kind belongs to. */
const RUN_OF: Readonly<Record<LineKind, RunKind>> = {
  blank: "blank",
  heading: "heading",
  headingUnderline: "heading",
  rule: "rule",
  // A table's header, its rule and its rows are one thing the seller wrote, so
  // they are one run. Telling a table apart from the prose around it is the
  // next chunk's problem and not this one's.
  tableRule: "text",
  tableHeader: "text",
  text: "text",
};

/**
 * 023's `isTableRule`, tightened here by one condition: a table's rule carries
 * a pipe.
 *
 * 023 accepts a bare `---` and is right to. There the whole paste is a price
 * list, and a lone row of dashes inside one is the rule under its header. Over
 * a whole page it is almost never that: it is a divider, or it is the underline
 * of a setext heading, and neither shape exists in the paste 023 was built for.
 * Requiring the pipe is what lets "Terms" over "---" read as a heading rather
 * than as a one column table nobody has ever written.
 *
 * Tightened here rather than there because 023's behaviour must not move. R13
 * wants one definition of the shape; this is that definition plus a condition
 * this reader states out loud.
 */
function isTableRuleLine(trimmed: string): boolean {
  return isTableRule(trimmed) && trimmed.includes("|");
}

/**
 * Every line of the paste, in order, classified.
 *
 * One `Line` per line including the blanks, for the reason `readCandidates`
 * already gives about its own candidates: dropping the lines this module thinks
 * are furniture would be the silent mangling the whole feature exists to avoid,
 * and it would hide the mistakes as well as the text.
 */
export function readLines(text: string): readonly Line[] {
  // `\r?\n`, the same split `readCandidates` uses, so a page written on Windows
  // and a page written anywhere else read identically.
  const raw = text.split(/\r?\n/);
  const lines: Line[] = [];

  for (const line of raw) {
    // `trim` already treats a non breaking space as whitespace, and a page
    // copied out of a browser is full of them. R11 asks for exactly that and
    // the language already does it, so there is no private whitespace table
    // here to fall out of date. The trimmed copy is used for every decision
    // below; `line` is what gets stored.
    const trimmed = line.trim();

    if (trimmed === "") {
      lines.push({ text: line, kind: "blank" });
      continue;
    }

    const hashes = ATX_HEADING.exec(trimmed)?.[1];
    if (hashes !== undefined) {
      lines.push({ text: line, kind: "heading", level: hashes.length });
      continue;
    }

    // The one piece of lookbehind, and the one classification that reaches back
    // and changes the line before it. A row of `=` or `-` under a paragraph
    // line turns that line into a heading: `=` gives level 1 and `-` gives
    // level 2. R4.
    //
    // This is not pedantry about a specification. Feature 028 found the equals
    // form live in shipped code in the other direction: a seller's own sentence
    // became an h1 on both paste hosts, because underlining a heading with a
    // row of equals is a plain text habit older than Markdown.
    // `docs/research/2026-09-11-marks-verification.md` has that evidence. The
    // same habit means a page arriving here has setext headings in it, written
    // by somebody who has never heard the word.
    //
    // Only over a `text` line, which is what CommonMark says and what keeps a
    // divider after a heading a divider: a heading is not a paragraph, so
    // nothing underlines it.
    const previous = lines[lines.length - 1];
    if (SETEXT_UNDERLINE.test(trimmed) && previous !== undefined && previous.kind === "text") {
      lines[lines.length - 1] = {
        text: previous.text,
        kind: "heading",
        level: trimmed.startsWith("=") ? 1 : 2,
      };
      lines.push({ text: line, kind: "headingUnderline" });
      continue;
    }

    // Below the setext check on purpose, and that ordering IS R4's rule rather
    // than an accident of how it is written: a row of dashes under a paragraph
    // is a heading, and the same row of dashes under a blank line is a divider.
    if (THEMATIC_BREAK.test(trimmed.replaceAll(/\s+/g, ""))) {
      lines.push({ text: line, kind: "rule" });
      continue;
    }

    if (isTableRuleLine(trimmed)) {
      lines.push({ text: line, kind: "tableRule" });
      continue;
    }

    lines.push({ text: line, kind: "text" });
  }

  // The table's header row, which is the one piece of lookahead, and the one
  // `readCandidates` already does for the reason it gives: "the header row of a
  // table reads exactly like a product row and is the one case content alone
  // cannot tell apart. Its position above the rule is what gives it away."
  //
  // A second pass rather than a peek inside the loop above, because the line
  // below has to be classified before this question can be asked, and the
  // setext rule can change what that line below turns out to be.
  return lines.map((line, i) =>
    line.kind === "text" && lines[i + 1]?.kind === "tableRule" ? { ...line, kind: "tableHeader" as const } : line,
  );
}

/** Whether the run that is open can swallow the line after it. */
function continues(kind: RunKind, next: Line | undefined): boolean {
  if (next === undefined) return false;
  // R3: a rule is its own run of one. Two dividers in a row are two dividers,
  // and a run that swallowed the second would make one section out of both.
  if (kind === "rule") return false;
  // A heading is its own run of one too, plus its own underline when it was
  // written setext style. Nothing else can join it, so two headings in a row
  // stay two headings.
  if (kind === "heading") return next.kind === "headingUnderline";
  return RUN_OF[next.kind] === kind;
}

/**
 * The paste as an ordered list of runs.
 *
 * Every line index lands in exactly one run, in order, with none missing and
 * none repeated. That is the contract the rest of the feature is built on and
 * it is what `page-paste-lossless.test.ts` measures over generated pastes.
 *
 * **Blank lines get runs of their own** rather than being dropped between the
 * runs around them. They produce no section, so it would have been cheaper to
 * skip them, and it would have put the burden of remembering where the gaps
 * were on every caller that wants to prove nothing was lost. A blank run costs
 * one object and turns reassembly into a plain concatenation.
 */
export function readRuns(text: string): readonly Run[] {
  const lines = readLines(text);
  const runs: Run[] = [];

  let from = 0;
  while (from < lines.length) {
    const first = lines[from];
    // Unreachable: `from` is inside the array. Written out rather than asserted
    // away, because `noUncheckedIndexedAccess` is on and a non null assertion
    // is a lint error in this project for good reasons.
    if (first === undefined) break;

    const kind = RUN_OF[first.kind];
    let to = from;
    while (continues(kind, lines[to + 1])) to += 1;

    runs.push({ kind, from, to, lines: lines.slice(from, to + 1) });
    from = to + 1;
  }

  return runs;
}

/**
 * The run's own source text, which is what the next chunk holds as a proposed
 * section's `source` and re-reads when the seller swaps that section between
 * Text and Prices. FR-029-18a works because that re-read happens against this
 * string rather than against whatever the last guess produced.
 *
 * Joined with "\n" rather than with whatever the paste used, because the split
 * dropped the "\r" and nothing downstream wants it back: the app's own
 * documents are "\n" throughout.
 */
export function runText(run: Run): string {
  return run.lines.map((line) => line.text).join("\n");
}
