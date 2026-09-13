/**
 * SC-002, the feature's one absolute, as a property rather than as a list of
 * cases: every character of any pasted page survives the reader.
 *
 * Written over generated pastes on purpose. A test over five hand written
 * examples proves nothing about the sixth shape a seller has, and the shapes
 * this reader will actually meet are combinations rather than specimens: a
 * setext heading above a table, a paragraph between two price lists, a run of
 * blank lines somebody left in when they copied. The vocabulary below is the
 * list of shapes; the generator is the list of pages made out of them.
 *
 * The seed is fixed and printed with every failure. A generator that fails
 * once and passes on the next run is worse than no test at all, because it
 * teaches everyone to press the button again.
 *
 * **One character does change and it is the line terminator.** `research.md`
 * R11 chose to split on `\r?\n`, so a page written on Windows comes back with
 * Unix line endings. That is the paste's transport convention rather than
 * anything the seller wrote, and every other character, smart quotes, trailing
 * spaces, non breaking spaces and all, comes back untouched. The comparison
 * below says exactly that rather than quietly normalizing both sides.
 */
import { describe, expect, it } from "vitest";

import { readProposal, readRuns, runText, swapProposalKind } from "../src/page-text.js";

/**
 * The shapes a real page is made of. Each entry is one block of lines, kept
 * together because that is how it arrives: a table is a header, a rule and
 * some rows, and splitting it here would test something no seller ever pastes.
 */
const SHAPES: readonly (readonly string[])[] = [
  ["# Willow's Prints"],
  ["## Postage"],
  ["###### The small print"],
  ["Willow's Prints", "==============="],
  ["Terms", "-----"],
  ["---"],
  ["***"],
  ["___"],
  ["| Item | Price |", "| --- | --- |", "| A3 print | 25 |", "| A4 print | 15 |"],
  ["Sketch - 30", "Full colour - 80", "Custom piece - DM me"],
  ["Bananas, 4", "Apples, 3", "Pears, 5"],
  ["A3 print\t25", "A4 print\t15"],
  ["Postage is 5 flat, and I post on Mondays."],
  ["I am open for commissions, so send me a message.", "Turnaround is about two weeks."],
  ["", ""],
  [""],
  ["A line that ends in two spaces  "],
  ["Non breaking spaces come out of a browser copy"],
  ["Don’t worry, I’ll post it “first class”"],
  ["- A bullet nobody should lose", "- And another"],
  // Leading indentation, which no shape here had until 2026-09-12. A page
  // copied out of a word processor or a fenced code block arrives indented, and
  // every classification decision is made against a trimmed copy, so the
  // indentation is exactly the sort of thing a reader can lose without anybody
  // noticing.
  ["  Sketch - 30", "    Full colour - 80", "\tCustom piece - DM me"],
  ["> A block quote, which this app does not support and therefore keeps"],
  [" "],
  ["![A3 print](https://example.test/print.png)"],
  ["**Bold**, *italic*, ~~struck~~ and ==highlighted== all carry through"],
];

/**
 * A seeded generator, so a failure names a number somebody can put back.
 *
 * The constants are the Numerical Recipes LCG. Nothing here needs a good
 * random number, it needs a repeatable one, and `Math.random` cannot be
 * repeated.
 */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

/** One generated page, and the same page with its line endings settled. */
function generate(seed: number): { paste: string; unix: string } {
  const next = seeded(seed);

  // The empty paste, which no combination of the shapes above can produce and
  // which a seller reaches by pressing paste with nothing on the clipboard. It
  // is a page like any other and the reader owes it the same account: one blank
  // line, one run, nothing lost. Added 2026-09-12 after a review noticed the
  // generator had never once emitted it.
  if (next() < 0.05) return { paste: "", unix: "" };

  const lines: string[] = [];
  const blocks = 1 + Math.floor(next() * 12);

  for (let i = 0; i < blocks; i += 1) {
    const shape = SHAPES[Math.floor(next() * SHAPES.length)] ?? [];
    lines.push(...shape);
  }

  // Mixed line endings inside one paste, which is what a page assembled out of
  // two sources over three years actually looks like.
  const endings = lines.map(() => (next() < 0.3 ? "\r\n" : "\n"));

  // Whether the last line is terminated too. Until 2026-09-12 it never was, so
  // the generator could not produce the single commonest shape of all: copying
  // a page out of rentry hands back a trailing newline, which splits into a
  // final empty string that still has to land in a run.
  const terminated = next() < 0.5;
  const join = (terminators: readonly string[]): string =>
    lines
      .map((line, i) => (i === lines.length - 1 && !terminated ? line : line + (terminators[i] ?? "\n")))
      .join("");

  return { paste: join(endings), unix: join(endings.map(() => "\n")) };
}

describe("no line of a pasted page is ever dropped, duplicated or reordered", () => {
  it("accounts for every line of two hundred generated pages exactly once", () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const { paste } = generate(seed);
      const lines = paste.split(/\r?\n/);
      const runs = readRuns(paste);

      // Which runs claimed each line. Counted rather than marked, so a line
      // claimed twice is as visible as a line claimed by nobody.
      const owners = lines.map(() => 0);
      // A run claiming an index past the end of the page is its own fault and
      // gets its own list. It used to fall through the `claimed !== undefined`
      // guard below and be counted nowhere: not missing, because no real line
      // went unclaimed, and not claimed twice, because the count it bumped did
      // not exist. The test's own comment promised both were visible, so the
      // guard was quietly making the test weaker than it read.
      const outOfRange: string[] = [];
      for (const [r, run] of runs.entries()) {
        for (let i = run.from; i <= run.to; i += 1) {
          const claimed = owners[i];
          if (claimed === undefined) {
            outOfRange.push(`run ${String(r)} claims line ${String(i)} of a page holding ${String(lines.length)}`);
            continue;
          }
          owners[i] = claimed + 1;
        }
      }

      const named = (want: (count: number) => boolean): readonly string[] =>
        lines
          .map((text, i) => ({ text, i }))
          .filter(({ i }) => want(owners[i] ?? 0))
          .map(({ text, i }) => `line ${String(i)}: ${JSON.stringify(text)}`);

      // Named rather than counted. A count that says "13 lines, 12 accounted
      // for" sends the next person hunting; this prints the line that went
      // missing and its index, which is the difference between a failing test
      // and a useful one.
      expect({
        seed,
        missing: named((count) => count === 0),
        claimedTwice: named((count) => count > 1),
        outOfRange,
      }).toEqual({ seed, missing: [], claimedTwice: [], outOfRange: [] });
    }
  });

  it("gives back the whole page when two hundred generated pages are reassembled", () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const { paste, unix } = generate(seed);
      // The runs in order, joined the way the lines inside them are joined.
      // Blank runs are runs like any other, which is what makes this a plain
      // concatenation rather than a reconstruction that has to remember where
      // the gaps were.
      expect({ seed, rebuilt: readRuns(paste).map(runText).join("\n") }).toEqual({ seed, rebuilt: unix });
    }
  });

  it("hands out runs that are contiguous, ordered, and honest about their own length", () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const { paste } = generate(seed);
      const lines = paste.split(/\r?\n/);
      const runs = readRuns(paste);

      const faults = runs
        .map((run, r) => {
          const previous = runs[r - 1];
          if (r === 0 && run.from !== 0) return `run 0 starts at ${String(run.from)} rather than at 0`;
          if (previous !== undefined && run.from !== previous.to + 1) {
            return `run ${String(r)} starts at ${String(run.from)} after a run ending at ${String(previous.to)}`;
          }
          if (run.lines.length !== run.to - run.from + 1) {
            return `run ${String(r)} claims ${String(run.from)}..${String(run.to)} but holds ${String(run.lines.length)} lines`;
          }
          return "";
        })
        .filter((fault) => fault !== "");

      expect({ seed, faults, end: runs.at(-1)?.to }).toEqual({ seed, faults: [], end: lines.length - 1 });
    }
  });

  it("gives back the whole page from proposed section sources, blanks included", () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const { paste, unix } = generate(seed);
      const proposal = readProposal(paste);

      if (paste.trim() === "") {
        expect({ seed, sections: proposal.sections }).toEqual({ seed, sections: [] });
        continue;
      }

      expect({ seed, rebuilt: proposal.sections.map((section) => section.source).join("\n") }).toEqual({
        seed,
        rebuilt: unix,
      });
    }
  });

  it("keeps source accounting unchanged when any swappable section is swapped", () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const { paste, unix } = generate(seed);
      const proposal = readProposal(paste);

      if (paste.trim() === "") continue;

      const swapped = proposal.sections.map((section, i) =>
        section.swappable && i % 2 === 0 ? swapProposalKind(section) : section,
      );
      expect({ seed, rebuilt: swapped.map((section) => section.source).join("\n") }).toEqual({ seed, rebuilt: unix });
    }
  });
});
