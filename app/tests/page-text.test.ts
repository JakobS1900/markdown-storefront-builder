/**
 * Splitting a pasted page into classified lines, and those lines into runs.
 *
 * This is the half of feature 029 that has to be right before any of the
 * guessing can be, so these tests are about shape and never about meaning.
 * Nothing here knows what a price is, and nothing here proposes a section.
 *
 * The text a seller pastes came out of rentry, pastebin or a browser, so it
 * arrives with Windows line endings, non breaking spaces, trailing spaces and
 * smart quotes in it. Every one of those is somebody's page rather than a
 * defect, and the tests use them rather than a tidied idea of Markdown.
 *
 * `research.md` R3 is the table of line kinds and there is a case here for
 * each of its rows. R4 is the pair that needs a second line to decide: a row
 * of dashes is a heading when a paragraph is above it and a divider when a
 * blank line is.
 */
import { describe, expect, it, vi } from "vitest";

import { buildProposedBlock, readLines, readProposal, readRuns, runText } from "../src/page-text.js";

/** Every line's kind, which is what most of the classification cases assert. */
const kinds = (text: string): readonly string[] => readLines(text).map((line) => line.kind);

/** Every run's kind and the line range it claims, as one readable string. */
const runs = (text: string): readonly string[] =>
  readRuns(text).map((run) => `${run.kind} ${String(run.from)}..${String(run.to)}`);

describe("R3, a line that is empty or whitespace only", () => {
  it.each([
    { what: "nothing at all", line: "" },
    { what: "three spaces", line: "   " },
    { what: "a tab", line: "\t" },
    { what: "a non breaking space, which is what a browser copy is full of", line: " " },
    { what: "a non breaking space beside an ordinary one", line: "   " },
  ])("reads a line holding $what as blank", ({ line }) => {
    expect(kinds(line)).toEqual(["blank"]);
  });
});

describe("R3, a hash heading", () => {
  it.each([
    { line: "# Willow's Prints", level: 1 },
    { line: "## Postage", level: 2 },
    { line: "### Commissions", level: 3 },
    { line: "#### Small print", level: 4 },
    { line: "##### Even smaller", level: 5 },
    { line: "###### Smallest", level: 6 },
  ])("reads $line as a heading at level $level", ({ line, level }) => {
    const [read] = readLines(line);
    expect(read?.kind).toBe("heading");
    expect(read?.level).toBe(level);
  });

  it.each([
    { line: "#", level: 1 },
    { line: "###", level: 3 },
    { line: "######", level: 6 },
  ])("reads $line, with nothing after the hashes, as a heading at level $level", ({ line, level }) => {
    // The `$` branch of `ATX_HEADING`, which R3's table does not mention and
    // which the comment above the pattern used to deny outright by saying the
    // space was always required. Reviewed on 2026-09-12 and kept: CommonMark
    // permits an empty ATX heading and a seller's own paste host renders one as
    // a heading, so reading it as text would show them a page their host does
    // not produce. Principle VII, Honest Fidelity.
    const [read] = readLines(line);
    expect(read?.kind).toBe("heading");
    expect(read?.level).toBe(level);
  });

  it("does not read a seventh hash as a heading, because there is no level seven", () => {
    expect(kinds("####### Seven")).toEqual(["text"]);
  });

  it("does not read a hash with no space after it as a heading", () => {
    // R3's table says "then a space", which is CommonMark and is also the only
    // reading that leaves a seller room to write a hashtag at the start of a
    // line. Getting this wrong turns "#commissionsopen" into an empty heading
    // and loses the word.
    expect(kinds("#commissionsopen")).toEqual(["text"]);
  });
});

describe("R3, a horizontal rule", () => {
  it.each([{ line: "---" }, { line: "***" }, { line: "___" }, { line: "- - -" }, { line: "**********" }])(
    "reads $line, alone under a blank line, as a rule",
    ({ line }) => {
      expect(kinds(`Something above\n\n${line}`)).toEqual(["text", "blank", "rule"]);
    },
  );

  it("does not read two dashes as a rule, because three is the bar", () => {
    expect(kinds("Something above\n\n--")).toEqual(["text", "blank", "text"]);
  });

  it("does not read a bulleted line as a rule", () => {
    // A rule is the decoration alone on the line. "- A bullet" is a list item
    // and every word of it is the seller's.
    expect(kinds("\n- A bullet nobody should lose")).toEqual(["blank", "text"]);
  });
});

describe("R3, a table's rule", () => {
  it.each([{ line: "| --- | --- |" }, { line: "|---|:--:|" }, { line: "--- | ---" }, { line: "| :-- | --: |" }])(
    "reads $line as a table rule",
    ({ line }) => {
      expect(readLines(line)[0]?.kind).toBe("tableRule");
    },
  );

  it("does not read a row of empty cells as a table rule", () => {
    // 023's own reason, kept: at least one dash, or "| | |" is a rule.
    expect(kinds("| | |")).toEqual(["text"]);
  });

  // The pipe condition `page-text.ts` adds on top of 023's `isTableRule`, pinned
  // under its own name. Before these cases existed, the only test that went red
  // when the condition was deleted was the one about three dashes being the
  // bar, which would have sent the next person reading `THEMATIC_BREAK` instead
  // of the line that actually changed. Both groups sit under a blank line, in a
  // position the setext rule cannot claim, because that is where the condition
  // is the only thing deciding.
  it.each([{ line: "| --- |" }, { line: "| --- | --- |" }, { line: "|:--:|" }])(
    "reads $line as a table rule, mid page, because it carries a pipe",
    ({ line }) => {
      expect(kinds(`Terms\n\n${line}`)).toEqual(["text", "blank", "tableRule"]);
    },
  );

  it.each([
    { what: "two bare dashes", line: "--" },
    { what: "a colon fenced pair", line: ":--:" },
    { what: "a single colon fenced dash", line: ":-:" },
    { what: "two dashes with a space between them", line: "- -" },
  ])("does not read $what as a table rule mid page, because it carries no pipe", ({ line }) => {
    expect(kinds(`Terms\n\n${line}`)).toEqual(["text", "blank", "text"]);
  });
});

describe("R3, the line directly above a table rule", () => {
  it("reads it as the table's header rather than as text", () => {
    // The one piece of lookahead, and 023 already needs it for the same
    // reason: a header row reads exactly like a product row, and only its
    // position above the rule tells the two apart.
    expect(kinds("| Item | Price |\n| --- | --- |\n| A3 print | 25 |")).toEqual([
      "tableHeader",
      "tableRule",
      "text",
    ]);
  });

  it("reads a line above a rule that is not a table's as something else entirely", () => {
    // A bare row of dashes under a paragraph is a setext heading, not a one
    // column table, so the line above it is a heading and not a header.
    expect(kinds("Terms\n---")).toEqual(["heading", "headingUnderline"]);
  });
});

describe("R3, anything else", () => {
  it.each([
    { what: "a sentence", line: "Postage is 5 flat, and I post on Mondays." },
    { what: "a product line", line: "Sketch - 30" },
    { what: "a table row", line: "| A3 print | 25 |" },
    { what: "a block quote this app does not support", line: "> Please read the terms" },
    { what: "an image address", line: "![A3 print](https://example.test/print.png)" },
  ])("reads $what as text", ({ line }) => {
    expect(readLines(line)[0]?.kind).toBe("text");
  });
});

describe("R4, a row of dashes is a heading or a divider depending on what is above it", () => {
  it("reads a row of equals under a paragraph line as a level 1 heading", () => {
    // 028 found this live, in shipped code, in the other direction: a seller's
    // own sentence became an h1 on both paste hosts because underlining a
    // heading with a row of equals is a plain text habit older than Markdown.
    // `docs/research/2026-09-11-marks-verification.md` has that evidence. The
    // same habit means a page arriving here has setext headings in it, written
    // by somebody who has never heard the word.
    const read = readLines("Willow's Prints\n===============");
    expect(read.map((line) => line.kind)).toEqual(["heading", "headingUnderline"]);
    expect(read[0]?.level).toBe(1);
    expect(read[0]?.text).toBe("Willow's Prints");
  });

  it("reads a row of dashes under a paragraph line as a level 2 heading", () => {
    const read = readLines("Terms\n-----");
    expect(read.map((line) => line.kind)).toEqual(["heading", "headingUnderline"]);
    expect(read[0]?.level).toBe(2);
  });

  it("reads the same row of dashes with a blank line above it as a rule", () => {
    expect(kinds("Terms\n\n-----")).toEqual(["text", "blank", "rule"]);
  });

  it("does not underline a hash heading, so a rule after one stays a rule", () => {
    // CommonMark: a setext underline needs a paragraph above it. A heading is
    // not a paragraph, so this is a heading followed by a divider, which is
    // exactly how sellers write a section break.
    expect(kinds("# Willow's Prints\n---")).toEqual(["heading", "rule"]);
  });

  it("does not underline an underline, so a second row of dashes is a rule", () => {
    expect(kinds("Terms\n===\n---")).toEqual(["heading", "headingUnderline", "rule"]);
  });

  it("turns the product line directly above a divider into a heading, which is the cost of R4", () => {
    // Pinned because it is a cost and not a defect, and because chunk 2 and the
    // holistic review would otherwise meet it as a surprise. "Full colour - 80"
    // stops being a product: the dashes under it are a setext underline and
    // CommonMark says so, which R4 chose deliberately.
    //
    // Two things make it defensible. This reading is MORE conservative than
    // CommonMark, which makes the WHOLE preceding paragraph the heading where
    // this promotes only the last line of it. And a seller whose page has this
    // shape is already being shown a heading there by their own paste host, so
    // the app is being faithful rather than wrong. FR-029-18 lets them swap the
    // section afterwards if it was not what they meant.
    const read = readLines("Sketch - 30\nFull colour - 80\n---");
    expect(read.map((line) => line.kind)).toEqual(["text", "heading", "headingUnderline"]);
    expect(read[1]?.level).toBe(2);
  });

  it("does not read a spaced row of dashes as an underline", () => {
    // "- - -" is a thematic break in Markdown and never an underline. The
    // difference between the two is only whether the characters are adjacent,
    // which is the kind of detail that is wrong forever once it is wrong.
    expect(kinds("Terms\n- - -")).toEqual(["text", "rule"]);
  });
});

describe("grouping lines into runs", () => {
  it("gives a heading a run of its own", () => {
    expect(runs("# Prices\nSketch - 30")).toEqual(["heading 0..0", "text 1..1"]);
  });

  it("keeps a setext heading and its underline in one run", () => {
    // They are one heading, so they are one run. The underline is inside the
    // run's source range rather than floating between two runs, which is what
    // keeps every line accounted for.
    expect(runs("Prices\n======\nSketch - 30")).toEqual(["heading 0..1", "text 2..2"]);
  });

  it("gives a rule a run of its own", () => {
    expect(runs("Sketch - 30\n\n---\n\nFull colour - 80")).toEqual([
      "text 0..0",
      "blank 1..1",
      "rule 2..2",
      "blank 3..3",
      "text 4..4",
    ]);
  });

  it("gives two rules two runs rather than one", () => {
    expect(runs("---\n***")).toEqual(["rule 0..0", "rule 1..1"]);
  });

  it("gives two headings two runs rather than one", () => {
    expect(runs("# Prints\n## A3")).toEqual(["heading 0..0", "heading 1..1"]);
  });

  it("takes a whole table, header and rule and rows, as one run", () => {
    expect(runs("| Item | Price |\n| --- | --- |\n| A3 | 25 |\n| A4 | 15 |")).toEqual(["text 0..3"]);
  });

  it("ends a run at a blank line and groups the blanks together", () => {
    expect(runs("Sketch - 30\n\n\nFull colour - 80")).toEqual(["text 0..0", "blank 1..2", "text 3..3"]);
  });

  it("accounts for every line of a real looking page exactly once, in order", () => {
    // The phase's own independent test: every line index appears in exactly
    // one run, in order, with none missing and none repeated. The generated
    // version of this lives in `page-paste-lossless.test.ts`; this one is here
    // so a reader can see the shape it is asserting.
    const page = [
      "Willow's Prints",
      "===============",
      "",
      "Postage is 5 flat, and I post on Mondays.",
      "",
      "---",
      "",
      "## Prints",
      "",
      "| Item | Price |",
      "| --- | --- |",
      "| A3 print | 25 |",
      "| A4 print | 15 |",
    ].join("\n");

    expect(runs(page)).toEqual([
      "heading 0..1",
      "blank 2..2",
      "text 3..3",
      "blank 4..4",
      "rule 5..5",
      "blank 6..6",
      "heading 7..7",
      "blank 8..8",
      "text 9..12",
    ]);
  });

  it("gives back a run's own source text, joined and unaltered", () => {
    const [run] = readRuns("| Item | Price |\n| --- | --- |\n| A3 print | 25 |");
    expect(run === undefined ? "" : runText(run)).toBe("| Item | Price |\n| --- | --- |\n| A3 print | 25 |");
  });

  it("reads a Windows paste the same way it reads a Unix one", () => {
    expect(runs("# Prices\r\n\r\nSketch - 30\r\n")).toEqual(["heading 0..0", "blank 1..1", "text 2..2", "blank 3..3"]);
  });
});

describe("changing not one character of what the seller wrote", () => {
  it("keeps trailing spaces, which are a line break in Markdown", () => {
    const line = "Two spaces end this line  ";
    expect(readLines(line)[0]?.text).toBe(line);
  });

  it("keeps smart quotes rather than tidying them into straight ones", () => {
    // R11: rewriting a seller's punctuation is altering their words. A paste
    // host hands back curly quotes, and a reader that straightened them would
    // be editing the page it claims to be reading.
    const line = "Don’t worry, I’ll post it “first class”";
    expect(readLines(line)[0]?.text).toBe(line);
  });

  it("keeps a non breaking space inside a line while still treating it as whitespace", () => {
    const line = "Non breaking spaces come out of a browser";
    const [read] = readLines(line);
    expect(read?.kind).toBe("text");
    expect(read?.text).toBe(line);
  });
});

describe("the reader is pure, which nothing but this test enforces", () => {
  // ESLint forbids the clock, randomness and the DOM inside `engine/src`.
  // Nothing lints `app/src` the same way, so this is the only thing holding
  // FR-029-13. `plan.md`, Constitution Check, Principle I.
  const PAGE = "Willow's Prints\n===\n\nSketch - 30\n\n---\n\n| Item | Price |\n| --- | --- |\n| A3 | 25 |";

  it("returns a deeply equal reading for the same text twice", () => {
    expect(readRuns(PAGE)).toEqual(readRuns(PAGE));
  });

  it("reads a page with the clock, the randomness and the DOM rigged to throw", () => {
    vi.spyOn(Date, "now").mockImplementation(() => {
      throw new Error("the reader read the clock");
    });
    vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("the reader consumed randomness");
    });
    vi.stubGlobal(
      "document",
      new Proxy(
        {},
        {
          get: () => {
            throw new Error("the reader touched the DOM");
          },
        },
      ),
    );

    // Read inside the rigging and assert outside it. Leaving `Date.now`
    // throwing while `expect` runs would fail the test for the wrong reason,
    // and a test that can fail for the wrong reason stops being evidence.
    let thrown: unknown;
    let read: unknown;
    try {
      read = {
        runs: readRuns(PAGE),
        proposal: readProposal(PAGE),
        built: readProposal(PAGE).sections.map((section) => buildProposedBlock(section)),
      };
    } catch (error) {
      thrown = error;
    } finally {
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
    }

    expect(thrown).toBeUndefined();
    expect(read).toEqual({
      runs: readRuns(PAGE),
      proposal: readProposal(PAGE),
      built: readProposal(PAGE).sections.map((section) => buildProposedBlock(section)),
    });
  });
});
