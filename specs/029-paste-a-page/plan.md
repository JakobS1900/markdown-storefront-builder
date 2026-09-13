# Implementation Plan: Bringing In a Page You Already Have

**Branch**: `029-paste-a-page` | **Date**: 2026-09-12 | **Spec**: [spec.md](spec.md)
**Input**: `specs/029-paste-a-page/spec.md`, with both scope questions answered by
Jakob on 2026-09-12.

## Summary

A seller pastes the whole text of a page they already have. A pure reader in the
app splits it into an ordered list of proposed sections drawn from four kinds:
Heading, Divider, Text and Prices. The panel shows every one of them, says what
each will become, lets the seller drop any of them and flip any of them between
Text and Prices, and writes nothing until one button is pressed. That button
builds a `Document` and hands it to `openBackup`, which is the path the example
page and all eight templates already take, so the result arrives as a new page
and nothing the seller has is touched.

**The price half is not new work.** `app/src/price-list-text.ts` already reads
lines into products and already handles delimiters, Markdown tables, prices that
are not numbers, and leftover columns. This feature calls it once per run of
product lines rather than once over the whole paste, for the reason in
`research.md` R2, and adds nothing to it.

## Technical Context

**Language/Version**: TypeScript, ES2022 target, `exactOptionalPropertyTypes` on
**Primary Dependencies**: None new. The reader has zero dependencies beyond the
app's own `price-list-text.ts` and `money.ts`
**Storage**: IndexedDB, through the existing `writePage` inside `openBackup`. No
new record, no new field, no migration
**Testing**: Vitest. Unit tests against the reader directly, DOM tests against
the panel under jsdom, plus the a11y, contrast and menu file gates
**Target Platform**: The PWA and the Android shell built from it, phone first
**Project Type**: Offline-first web app with a pure compiler beside it
**Performance Goals**: A 2000 line paste is read and drawn without the screen
becoming unresponsive. SC-007
**Constraints**: Nothing written before the seller confirms. Nothing of the
seller's text discarded, ever. No schema change
**Scale/Scope**: One new pure module, one new panel, one new control on the empty
state, one new field in the store

## Constitution Check

*GATE: passed before Phase 0. Re-checked after Phase 1 and still passing.*

| # | Principle | How this plan satisfies it |
|---|---|---|
| I | The Engine Is a Pure Function | The engine is not touched at all. `compile` gains no input and no branch. The reader is a separate pure function in the app, and `research.md` R1 gives the reason it is not in the engine: the engine must not import from the app, and the reader's value is reusing `price-list-text.ts`, which is in the app. The reader's own purity is asserted by a test, not by a lint rule, because the engine's ESLint restriction does not cover `app/src` |
| II | Hosts Are Data, Never Code | No target record is read, written or consulted. The new document copies `target` from the page currently open. No emitter changes, so no host can be affected by this feature |
| III | Test-First, With Golden Files | TDD throughout, failing test first, and the three structurally required tests are already in place and must stay green. The parity snapshot is asserted byte identical at the end of the feature as an explicit task, because "the schema does not move" is the claim most easily broken by accident. No golden fixture should change; a task checks that none did |
| IV | The Narrow Gate | Pasted text is user-authored content and reaches the preview by exactly the same route every other user-authored field does, through the sanitizer, because it becomes ordinary block fields and nothing else. The XSS corpus grows by one case covering a paste carrying a script tag and an image with an `onerror`, which is the new way for hostile text to arrive. No secret, no network, no proxy involvement |
| V | The User's Work Is Sacred | The whole shape of the feature. Confirming creates a NEW page through `openBackup`, which writes a new identifier and leaves every existing page saved and unchanged, and which refuses to write anything at all if the built document does not validate. Nothing is written before the confirm press. No failure path deletes or overwrites anything, and SC-006 is checked by counting and comparing stored pages before and after |
| VI | Reachable By The People Who Need It | Every new control has a real accessible name, not a plausible one: the new empty state button says what it does, and each proposed section's checkbox is named by the section's kind and its content, the way 023 names a line by the line. The a11y gate grows a case rendering the panel open. The contrast gate grows a case measuring it in both palettes. Nothing here needs the network, so the offline promise is unaffected |
| VII | Honest Fidelity | The preview still renders compiled output and this feature does not touch it. The one honesty risk is in the panel rather than the preview: a proposal that quietly dropped a line would be showing the seller a page that is not the page they pasted. FR-029-06 and SC-002 make "every line is accounted for on screen" a testable property, and it is tested as a property over generated pastes rather than over a handful of examples |

No exceptions are claimed, so the Complexity Tracking table is empty and has been
removed.

## Project Structure

### Documentation (this feature)

```text
specs/029-paste-a-page/
├── spec.md
├── plan.md              # This file
├── research.md          # Phase 0, thirteen decisions with their evidence
├── data-model.md        # Phase 1, all of it in memory, schema unmoved
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2, written by /speckit-tasks
```

### Source Code

```text
app/src/
├── page-text.ts              # NEW. The reader. Pure, no DOM, no clock, no ids
├── price-list-text.ts        # Gains two exports, no behaviour change
├── store.ts                  # Gains `pastingPage` and its handful of actions
└── ui/
    ├── page-paste.ts         # NEW. The panel
    └── build.ts              # The empty state gains one control and one word

app/tests/
├── page-text.test.ts         # NEW. The reader, directly, including purity
├── page-paste.test.ts        # NEW. The panel under jsdom
├── page-paste-lossless.test.ts  # NEW. SC-002 as a property over many pastes
├── a11y.test.ts              # Gains a case with the panel open
└── render-markdown.test.ts   # The XSS corpus gains its paste case

scripts/contrast.mjs          # Gains a pass measuring the panel
```

**Structure Decision**: The existing app and engine layout, unchanged. This
feature adds two files to `app/src`, three test files, and edits four existing
files. The engine directory is not touched.

## Chunks

Five, which is more than roughly three, so **a holistic review over the whole
feature diff is required** by the constitution's Development Workflow and by
`CLAUDE.md`. It has earned its cost on 023, 024, 027 and 028, and on 028 it found
three ways the feature corrupted a seller's text that four per-chunk reviews had
each passed.

| Chunk | What lands | Why it is its own chunk |
|---|---|---|
| 1 | Line classification and runs in `page-text.ts`, with the two exports it needs from `price-list-text.ts` | This is the contract every later chunk reads. It is the cross-boundary piece of this feature, and it lands first and alone for the same reason the schema does |
| 2 | Proposals: the Prices bar, heading absorption, the title, and the four block builders | The guessing. Entirely testable without a screen, which is the point of R1 |
| 3 | `pastingPage` in the store, and the confirm path through `openBackup` | The only chunk that can write anything. Reviewed knowing that |
| 4 | The panel and the empty state control | The only chunk with a DOM. Carries the repaint trap from R9 |
| 5 | The gates: a11y case, contrast pass, XSS corpus case, and the parity and golden no-change assertions | Gates land last because they measure the finished thing, except the parity assertion, which is written in chunk 1 and must never go red |

## Test strategy

Written here rather than left to the tasks, because two of these are properties
rather than examples and that distinction is easy to lose.

**Losslessness is a property, not a list of cases.** SC-002 says every character
of any paste is present or accounted for. That is checked by generating pastes
from a vocabulary of real shapes, headings, rules, tables, product lines,
paragraphs, blank runs, and asserting that concatenating every proposed section's
`source` in order, with the blanks between them, reconstructs the input exactly.
A test over five hand written examples proves nothing about the sixth shape a
seller has.

**Purity is a property too.** The same text read twice returns a deeply equal
proposal, and the reader is called with the clock, `Math.random` and `document`
stubbed to throw, which is what the engine's ESLint rule does for the engine and
what nothing does for `app/src`.

**The swap is tested both ways round.** Text to Prices to Text must return the
original proposal exactly, which is the observable form of "a swap converts
nothing".

**The stored pages are counted before and after.** SC-006 is the one this project
has the most reason to be careful about, and a count plus a content comparison is
cheap.

## Risks, and what is done about each

| Risk | What makes it survivable |
|---|---|
| The Prices bar in R5 is wrong for some real page | The seller sees the guess and can flip it before anything is made. This is why FR-029-18 exists, and it is the reason Jakob's answer mattered |
| A run of prose containing numbers becomes a price list | Same answer, plus the "more than half" bar and the two line minimum, both chosen for exactly this case |
| The reader drops something | The lossless property test, run over generated input, and SC-002 |
| The panel never appears on a phone because a repaint deferred forever | R9. Known, documented in the code this copies, and carried into chunk 4 as its first concern |
| A paste large enough to stop a phone | R10. Drawing is bounded, converting is not |
| This feature and 023 drift apart | The price half is one module called from both. Chunk 1's two exports are the only new coupling, and they are the alternative to two definitions of "is this a table rule" |
