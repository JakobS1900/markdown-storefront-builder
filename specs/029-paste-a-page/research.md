# Research: Bringing In a Page You Already Have

Phase 0. Every question here was open when the spec was written and is closed
here, with the evidence that closed it, so the implementation does not reopen
any of them.

## R1: Where the reader lives

**Decision: `app/src/page-text.ts`, pure, beside `app/src/price-list-text.ts`.**

The engine is the obvious home for a pure text function and it is the wrong one.
The constitution's Additional Constraints say the engine MUST NOT import from the
app, and the reader's whole value is reusing `price-list-text.ts`, which is in
the app. Moving that into the engine to make room would drag `money.ts` with it
and turn a compiler into a compiler plus a guesser.

There is also a plainer argument. Principle I defines the engine as
`compile(doc, target)`. A reader is not a compiler and has no target. It belongs
where the other reader already lives.

`price-list-text.ts` sets the precedent and states the reason in its own header:
it stays pure "because the interesting cases are awkward to reach by typing into
a rendered screen, and a parser that can only be exercised through the DOM is a
parser that does not get exercised." That applies here with more force, because
this reader has more to get wrong.

## R2: The delimiter must be inferred per run, not per paste

**Decision: split the paste into runs FIRST, then call `readCandidates` on each
Prices run's own text.**

This is the trap that would have been found in review at best and by a seller at
worst. `inferDelimiter` judges the separator "over the paste as a whole rather
than line by line", and says why: one decision for the whole paste is
predictable, and predictable is what makes a wrong guess cheap to correct.

That reasoning is correct for a paste that IS a price list. It inverts for a
paste that is a whole page. The bar is a quarter of meaningful lines containing
the character, and English prose contains commas. A page with two paragraphs and
twelve product lines can infer `comma` from the paragraphs, and then every
product line is cut at its first comma instead of at its columns.

Calling `readCandidates` on one run at a time keeps 023's guarantee exactly as
written, with "the paste" now meaning the run the seller is looking at. Nothing
in `price-list-text.ts` changes.

## R3: How a paste becomes runs

**Decision: classify every line independently, then group neighbours.**

Per line, with no lookahead except the one case that needs it:

| Shape | Classification |
|---|---|
| Empty, or whitespace only | blank |
| `#` to `######` then a space | heading, level from the count |
| Three or more `-`, `*` or `_`, alone on the line | rule |
| `\|` and `-` and `:` and spaces, with at least one `-` | table rule |
| A line directly above a table rule | table header |
| Anything else | text |

The one lookahead is the table header, and it is the one `readCandidates`
already does for the same reason it gives: "the header row of a table reads
exactly like a product row and is the one case content alone cannot tell apart.
Its position above the rule is what gives it away."

Runs are then maximal groups of adjacent non-blank lines of compatible kinds. A
blank line ends a run. A heading is its own run of one. A rule is its own run of
one.

## R4: A run of `-` is a heading when text is above it, and a divider otherwise

**Decision: follow CommonMark, and say so.**

A line of `=` or `-` directly under a non-blank text line is a setext heading and
turns that text line into a heading, `=` giving level 1 and `-` giving level 2.
The same line of `-` with a blank line above it is a horizontal rule.

This is not pedantry about a spec. Feature 028 found the equals form live, in
shipped code, in the other direction: a seller's own sentence became an `<h1>` on
both paste hosts because underlining a heading with a row of equals is a
plain-text habit older than Markdown. `docs/research/2026-09-11-marks-verification.md`
has the evidence. The same habit means a seller's page arriving here has setext
headings in it, written by somebody who has never heard the word.

## R5: When a run of text is a price list

**Decision: a run becomes Prices when it contains a table rule, or when at least
two of its lines read as products AND more than half of its non-blank lines do.**

`readCandidates` already marks each line `suggested`, and `looksLikeItem` already
excludes blanks, table rules, headings and a table's header row. So the run
decision only has to aggregate what that function already computed.

The bar is "more than half", not "at least half", and the difference is the case
it exists for. `splitAtLastNumber` gives "Postage is 5 flat" a price of 5, so one
ordinary sentence containing one number is a suggested line. Two sentences, one
with a number, is exactly half. At least half would turn that paragraph into a
price list; more than half leaves it as text.

Requiring two suggested lines kills the single stray sentence, which is a run of
one.

A table rule overrides the count, because a Markdown table with a name column and
a price column is a price list whatever its rows look like, and because its
header row is deliberately not suggested, which drags the ratio down on exactly
the input we are most sure about.

**This bar is a guess and the spec is built so that it can be wrong.** FR-029-18
exists because of this line: the seller can swap either way before anything is
made.

## R6: A heading above a price run joins it, and a heading above prose does not

**Decision: absorb into Prices only, and include the heading line in that
section's source range.**

FR-029-09 requires the first half. The second half is the part worth writing
down, because symmetry would suggest doing the same for `prose.heading` and it
would be wrong: one heading is commonly followed by several paragraphs, so
attaching it to the first paragraph invents a relationship the seller did not
write. A Prices section is one thing, and the heading above it names that thing.

**The heading line stays inside the Prices section's source range**, which is
what makes FR-029-18a work without a special case: swap that section to Text and
the heading line is simply part of the text again, because it always was.

## R7: The page title is copied from the first heading, never consumed by it

**Decision: if the paste's first non-blank line is a heading, its text becomes
the document title AND that heading still becomes a Heading section.**

Consuming it would be a quiet act of vandalism. The title is private, and the
field's own hint says so: "Only you see this. It is how the page is listed when
you come back." A published page whose visible `# Willow's Prints` had been
moved into a field only the seller can see would come out of this app missing
its own title.

## R8: Confirming goes through `openBackup`

**Decision: build a `Document`, serialize it, and hand it to
`openBackup`, exactly as `starterPicker` does.**

This is the reuse that pays for itself three times over:

- FR-029-22, arriving as a new page with its own identifier that touches nothing
  the seller has, is what `openBackup` already guarantees and already has tests
  for.
- FR-029-26, never producing a page that cannot be saved or reopened, comes free:
  `openBackup` runs `parseDocument` and writes nothing at all if it refuses. A
  reader bug becomes a refusal rather than a corrupt page.
- The pages list refresh and the picture holding are already inside it.

Its success sentence is written for a file and would read as nonsense here, so
the caller announces its own, which is what `starterPicker` already does and for
the same reason.

The new document takes `target` from the page currently open, because that is the
host the seller has chosen and nothing in a pasted page says otherwise.

## R9: The panel must refresh its own body

**Carried forward from 023, not rediscovered.** `price-list-paste.ts` documents
it at length: `repaint` refuses to run while a text field has focus, because
replacing a focused input tears down the Android InputConnection bound to it and
loses characters. The paste box is a focused text field for the whole time the
seller is using it, so every deferred repaint re-defers and the panel never
appears at all.

This panel has the same shape and needs the same treatment: rebuild the changing
half, leave the textarea alone.

## R10: What is drawn, and what is accepted

**Decision: cap what is DRAWN per section and cap the number of sections drawn.
Cap nothing that is converted.**

023's cap is 500 lines because "one checkbox plus a label per line means ten
thousand lines is twenty thousand nodes", and that "does not degrade on a phone,
it stops it."

The count here is different in a way that helps and a way that hurts. A whole
page yields few sections, so the section list is short. But one Prices section
can hold two thousand rows, and drawing them all brings the same problem back
through a different door.

So: at most 20 lines of preview per proposed section, with an honest line saying
how many more there are, and at most 100 proposed sections drawn. Both bound the
node count at roughly two thousand whatever arrives. Neither bounds what the
confirm button makes, which is 023's rule and the only one that keeps the
promise in FR-029-06.

## R11: Line endings and whitespace

**Decision: split on `\r?\n`, and change nothing else about any character.**

`readCandidates` already splits that way. Classification trims, and treats a
non-breaking space as whitespace, because a page copied out of a browser is full
of them. Content is stored exactly as pasted.

Smart quotes, ligatures and unusual dashes are NOT normalized. Rewriting a
seller's punctuation is altering their words, which FR-029-06 forbids in spirit
and SC-002 measures.

## R12: What state this needs, and why not the state that is already there

**Decision: a new field in the store, separate from `pasting`.**

`pasting` is `{ blockId, text, ticked }` and is scoped to one Prices section.
Every function around it, `startPasting(blockId)` through `convertPaste`, assumes
that block exists and writes into it. This feature has no block, writes no block,
and produces a whole page.

Widening `pasting` to mean both would make `blockId` optional and every one of
those seven functions would need to ask which mode it is in. That is the shape of
change that produces a bug where two features meet, which is exactly what the
holistic review keeps finding here.

## R13: Things deliberately not done, with reasons

- **No normalization of the seller's punctuation.** R11.
- **No Gallery and no About you.** Jakob, 2026-09-12. They arrive as Text.
- **No change to `price-list-text.ts`'s behaviour.** Exporting `isTableRule` and
  the decoration pattern so this module can reuse them is a change to its surface
  and not to what it does. Duplicating either would be two definitions of "is
  this a table rule" that can drift.
- **No second entry point.** The control goes on the empty state only. Starting a
  new page from the sidebar lands on the empty state, so one placement already
  covers both ways somebody arrives with nothing.

## Amendments after contact with the code

Chunk 1, 2026-09-12. Four of the decisions above were incomplete rather than
wrong, and they are corrected here rather than quietly diverging from the code.

**R3 is one kind and one lookbehind short.** It says "no lookahead except the
table header", which is true, and it does not mention that R4's setext rule
needs the line BELOW to reach back and reclassify the line above. That is a
second piece of non-local reading, and the underline itself needs a kind of its
own, `headingUnderline`. `data-model.md` carries the corrected table.

**R11's "change nothing else about any character" has exactly one exception, and
it is the `\r`.** Splitting on `\r?\n` drops it, so a page written on Windows
comes back with Unix line endings and cannot be reconstructed byte for byte. That
is the paste's transport convention rather than anything anybody wrote, and the
app's own documents are `\n` throughout.

**The thing NOT done about it is the part worth recording.** The cheap fix is to
normalize both sides of the losslessness test, which would make it pass while
asserting less than it claims. The test instead compares against the page with
its terminators settled and says so at the top of the file. A test that quietly
measures less than its name is the failure mode this project has hit four times
with gates that measured nothing.

**R13's "one definition, do not duplicate" survives, with a condition on top.**
`isTableRule` accepts a bare `---`, and over a price list that is correct: a lone
row of dashes inside one is the rule under its header. Over a whole page it is
almost never that. It is a divider, or it is a setext underline, and neither
shape exists in the paste 023 was built for. `page-text.ts` therefore requires a
table rule to carry a pipe as well, as a condition of its own, and 023's looser
reading does not move.

**The cost is stated rather than hidden**: a single column Markdown table whose
rule line carries no pipe at all is not recognised as a table here. That shape is
vanishingly rare, and FR-029-18 lets the seller swap the section.

**`DECORATION` is exported and has no consumer yet.** T004 puts both exports in
the contract chunk. Phase 3's builders are where it is read.
