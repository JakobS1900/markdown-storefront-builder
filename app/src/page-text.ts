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
 * is what holds FR-029-13: it reads the same text twice expecting a deeply
 * equal result, and calls the reader with `Date.now`, `Math.random` and
 * `document` rigged to throw.
 *
 * **Two of those three riggings are load bearing and the third is weaker than
 * the sentence above makes it sound.** `Date.now` and `Math.random` are real
 * globals, and the rigging genuinely replaces them, so a reader that called
 * either would throw. `document` is not: the test file runs under the node
 * environment, where there is no `document` to begin with, so stubbing it
 * installs a throwing global where there was previously nothing at all and a
 * reader that touched the DOM would have been a ReferenceError with or without
 * it. It is kept because it costs nothing and because the test environment is a
 * setting somebody could change, not because it is what proves the DOM is
 * untouched.
 *
 * **Not one character of the seller's text is altered.** Classification trims a
 * copy; the `text` on every `Line` is the line exactly as it arrived, smart
 * quotes, trailing spaces, non breaking spaces and all. R11 is explicit that
 * rewriting a seller's punctuation is altering their words, and SC-002 measures
 * it over generated pastes in `app/tests/page-paste-lossless.test.ts`. The one
 * character this module does drop is the `\r` of a Windows line ending, which
 * is the paste's transport convention rather than anything anybody wrote.
 */
import type { Block } from "@mdsb/engine";

import { isTableRule, readCandidates, toProducts, type NewProduct } from "./price-list-text.js";

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

export type ProposedSectionKind = "heading" | "divider" | "prose" | "menu";

export interface ProposedSection {
  readonly kind: ProposedSectionKind;
  readonly source: string;
  readonly from: number;
  readonly to: number;
  readonly swappable: boolean;
}

export interface Proposal {
  readonly sections: readonly ProposedSection[];
  readonly title?: string;
}

type HeadingBlock = Omit<Extract<Block, { kind: "heading" }>, "id">;
type DividerBlock = Omit<Extract<Block, { kind: "divider" }>, "id">;
type ProseBlock = Omit<Extract<Block, { kind: "prose" }>, "id">;
type MenuBlock = Extract<Block, { kind: "menu" }>;
type ProposedMenuTier = Omit<MenuBlock["tiers"][number], "id" | "cost" | "localImageIds">;
type MenuBlockWithoutIds = Omit<MenuBlock, "id" | "tiers"> & {
  readonly tiers: readonly ProposedMenuTier[];
};

export type ProposedBlock = HeadingBlock | DividerBlock | ProseBlock | MenuBlockWithoutIds;

interface DraftSection {
  readonly kind: ProposedSectionKind;
  readonly startRun: number;
  endRun: number;
}

// A Markdown heading: `#` to `######`, then a space OR the end of the line.
//
// The space is required whenever anything follows the hashes, per R3's table
// and per CommonMark, and it is the only reading that leaves room for a seller
// who begins a line with a hashtag: without it "#commissionsopen" becomes an
// empty level 1 heading and the word is gone.
//
// **The `$` branch is the part R3's table does not mention**, and an earlier
// comment here flatly denied it by saying the space was always required. It is
// not: "#", "###" and "######" alone on a line all match, at levels 1, 3 and 6.
// That is deliberate and it stays. CommonMark permits an empty ATX heading, and
// a seller's own paste host renders one as a heading, so reading it as anything
// else would be showing them a page their host does not produce, which is what
// Principle VII, Honest Fidelity, exists to forbid.
//
// CHUNK 2: a heading line that is nothing but hashes has no text left once the
// hashes are stripped, so the heading builder will hand back a Heading section
// whose `text` is the empty string. That validates rather than failing, because
// `heading.text` is required but not `nonEmpty` in
// `engine/src/document/descriptor.ts`. Decide what that section should be
// deliberately. Do not discover it from a seller.
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
 * **The first reason written down here was false and is worth keeping as a
 * warning.** It claimed that requiring the pipe is what lets "Terms" over "---"
 * read as a heading rather than as a one column table nobody has ever written.
 * It is not. In `readLines` the setext branch runs BEFORE `THEMATIC_BREAK` and
 * before this check, so "Terms" over "---" is already a heading, and a bare
 * "---" under a blank line is already a rule because the thematic break check
 * comes first too. A reviewer disproved the claim by mutation on 2026-09-12:
 * deleting `&& trimmed.includes("|")` changes the reading of "Terms\n---",
 * "Terms\n-----", "Terms\n\n---", "# H\n---", "---", "---\n---", "  ---  " and
 * a real pipe table by not one kind.
 *
 * **What the pipe actually does** is stop the short and colon bearing dash rows,
 * "--", ":--:", ":-:" and "- -", from reading as table rules mid page, in the
 * positions the setext rule does not claim. Over a price list those rows are a
 * table's rule and 023 is right to take them. Over a whole page they are a
 * seller's dash, an emoticon or a fragment, and a `tableRule` there would put a
 * table's furniture in the middle of somebody's prose. That is a defensible
 * tightening. It is simply not the one that was written down.
 *
 * **The cost recorded alongside the false claim was misattributed too.** A
 * single column table whose rule carries no pipe, "Item" over "---" over "A3
 * print", reads as a setext heading in BOTH builds, with this condition and
 * without it. That cost comes from the setext ordering above, not from here.
 *
 * Tightened here rather than in 023 because 023's behaviour must not move. R13
 * wants one definition of the shape; this is that definition plus a condition
 * this reader states out loud, and `page-text.test.ts` now pins it under its own
 * name so that deleting it fails a test about the pipe rather than a test named
 * for the three dash bar.
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
    //
    // **`break` rather than `throw`, and the consequence is stated rather than
    // assumed.** If this ever fired, `readRuns` would return a SHORT list, the
    // tail of the page would belong to no run, and the loss would surface
    // somewhere downstream looking like a bug in whatever built the sections.
    // Throwing would name it at once, and was rejected: this is a pure reader
    // the paste panel calls on every keystroke, so turning an impossible case
    // into a user facing crash costs a seller their paste to buy a better stack
    // trace for us. The losslessness property in `page-paste-lossless.test.ts`
    // is what would catch a short list, and it names the missing line.
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

function headingTextFromLine(line: Line): string {
  return line.text.trim().replace(/^#{1,6}(?:\s|$)/, "").trim();
}

function headingTextFromRun(run: Run): string {
  const heading = run.lines.find((line) => line.kind === "heading");
  return heading === undefined ? "" : headingTextFromLine(heading);
}

function titleFrom(runs: readonly Run[]): string | undefined {
  const first = runs.find((run) => run.kind !== "blank");
  if (first?.kind !== "heading") return undefined;

  const title = headingTextFromRun(first);
  return title === "" ? undefined : title;
}

function candidatesForRun(run: Run) {
  // R2 and T014: this call is on the run's own text, never on the whole paste.
  // `inferDelimiter` uses one separator for its input, and prose is full of
  // commas. Calling it over the whole page lets comma-heavy paragraphs outvote
  // a tab-separated product run and cuts product names at their first comma.
  return readCandidates(runText(run));
}

const MARKDOWN_IMAGE_LINE = /^!\[[^\]]*\]\([^)]+\)\s*$/;
const CONTACT_LINE =
  /\b(?:discord|telegram|email|e-mail|reply|message|dm|contact|instagram|insta|ig|twitter|tiktok|threads|bluesky|bsky|linktree|website|site)\b|https?:\/\/|www\.|[\w.+-]+@[\w.-]+\.\w+/i;

function textRunIsContactBlock(lines: readonly Line[]): boolean {
  return lines.length > 0 && lines.every((line) => CONTACT_LINE.test(line.text));
}

function hasAmbiguousPublicNumber(candidate: ReturnType<typeof readCandidates>[number]): boolean {
  return candidate.suggested && candidate.cost !== undefined && candidate.unit === undefined;
}

function textRunIsMenu(run: Run): boolean {
  const nonBlankLines = run.lines.filter((line) => line.text.trim() !== "");
  // FR-029-15a: image links are kept as Text in this feature. `A3` and `A4`
  // inside alt text look numeric enough for the price reader's fallback, and a
  // whole run of them must still not become a Gallery or a Prices section.
  if (nonBlankLines.length > 0 && nonBlankLines.every((line) => MARKDOWN_IMAGE_LINE.test(line.text.trim()))) {
    return false;
  }
  if (textRunIsContactBlock(nonBlankLines)) return false;

  const candidates = candidatesForRun(run);
  if (candidates.some(hasAmbiguousPublicNumber)) return false;

  if (run.lines.some((line) => line.kind === "tableRule")) return true;

  const suggested = candidates.filter((candidate) => candidate.suggested).length;
  const nonBlank = nonBlankLines.length;

  // More than half, not at least half: "Postage is 5 flat" reads as one
  // suggested line, and at least half turns a two sentence paragraph containing
  // one number into a price list. Requiring two suggested lines also keeps one
  // stray numbered sentence as prose.
  return suggested >= 2 && suggested > nonBlank / 2;
}

function sourceFromRuns(runs: readonly Run[], startRun: number, endRun: number): string {
  return runs
    .slice(startRun, endRun + 1)
    .flatMap((run) => run.lines.map((line) => line.text))
    .join("\n");
}

function sectionFromDraft(runs: readonly Run[], draft: DraftSection): ProposedSection | undefined {
  const first = runs[draft.startRun];
  const last = runs[draft.endRun];
  if (first === undefined || last === undefined) return undefined;

  return {
    kind: draft.kind,
    source: sourceFromRuns(runs, draft.startRun, draft.endRun),
    from: first.from,
    to: last.to,
    swappable: draft.kind === "prose" || draft.kind === "menu",
  };
}

export function readProposal(text: string): Proposal {
  const runs = readRuns(text);
  const drafts: DraftSection[] = [];
  let pendingBlankStart: number | undefined;

  for (let i = 0; i < runs.length; i += 1) {
    const run = runs[i];
    if (run === undefined) continue;

    if (run.kind === "blank") {
      pendingBlankStart = pendingBlankStart ?? i;
      continue;
    }

    const startRun = pendingBlankStart ?? i;
    pendingBlankStart = undefined;

    const next = runs[i + 1];
    if (run.kind === "heading" && next?.kind === "text" && textRunIsMenu(next)) {
      // R6: absorb only into Prices. A heading above prose commonly names more
      // than one paragraph, so attaching it to the first would invent a
      // relationship the seller did not write. A price list is one thing, and
      // the heading immediately above it names that thing. The heading line
      // stays in `source`, so swapping this proposal to Text gives it back.
      drafts.push({ kind: "menu", startRun, endRun: i + 1 });
      i += 1;
      continue;
    }

    if (run.kind === "heading") {
      drafts.push({ kind: "heading", startRun, endRun: i });
      continue;
    }

    if (run.kind === "rule") {
      drafts.push({ kind: "divider", startRun, endRun: i });
      continue;
    }

    drafts.push({ kind: textRunIsMenu(run) ? "menu" : "prose", startRun, endRun: i });
  }

  const lastDraft = drafts[drafts.length - 1];
  if (pendingBlankStart !== undefined && lastDraft !== undefined) lastDraft.endRun = runs.length - 1;

  const sections = drafts.flatMap((draft) => {
    const section = sectionFromDraft(runs, draft);
    return section === undefined ? [] : [section];
  });
  const title = titleFrom(runs);

  return title === undefined ? { sections } : { sections, title };
}

export function swapProposalKind(section: ProposedSection): ProposedSection {
  if (section.kind === "prose") return { ...section, kind: "menu" };
  if (section.kind === "menu") return { ...section, kind: "prose" };
  return section;
}

function textRunForMenu(source: string): { readonly run: Run; readonly heading?: string } | undefined {
  const runs = readRuns(source);
  const textIndex = runs.findIndex((run) => run.kind === "text");
  const run = runs[textIndex];
  if (run === undefined) return undefined;

  const before = runs[textIndex - 1];
  const heading = before?.kind === "heading" ? headingTextFromRun(before) : undefined;
  return heading === undefined || heading === "" ? { run } : { run, heading };
}

function tierFrom(product: NewProduct): ProposedMenuTier {
  // This path is reading a public shop window, not a supplier spreadsheet.
  // `toProducts` may carry `cost` because feature 023 needs it, but the page
  // paste path drops it here: cost is the field the compiler is forbidden to
  // publish. Device picture ids are never written either, because nothing in a
  // pasted page can refer to this browser's storage.
  return {
    name: product.name,
    price: product.price,
    ...(product.unit === undefined ? {} : { unit: product.unit }),
    ...(product.blurb === undefined ? {} : { blurb: product.blurb }),
  };
}

function buildMenuBlock(section: ProposedSection): MenuBlockWithoutIds {
  const parts = textRunForMenu(section.source);
  const productText = parts === undefined ? section.source : runText(parts.run);
  const candidates = readCandidates(productText);
  const ticked = candidates.flatMap((candidate, i) =>
    candidate.suggested || (candidate.price === "" && candidate.name.trim() !== "") ? [i] : [],
  );
  const tiers = toProducts(candidates, ticked).map(tierFrom);

  return parts?.heading === undefined ? { kind: "menu", tiers } : { kind: "menu", heading: parts.heading, tiers };
}

export function buildProposedBlock(section: ProposedSection): ProposedBlock {
  if (section.kind === "divider") return { kind: "divider" };
  if (section.kind === "menu") return buildMenuBlock(section);
  if (section.kind === "heading") {
    const heading = readLines(section.source).find((line) => line.kind === "heading");
    return { kind: "heading", text: heading === undefined ? section.source.trim() : headingTextFromLine(heading), level: heading?.level ?? 1 };
  }
  return { kind: "prose", text: section.source };
}
