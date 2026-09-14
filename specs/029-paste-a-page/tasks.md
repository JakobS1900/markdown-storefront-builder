# Tasks: Bringing In a Page You Already Have

**Feature**: 029 | **Branch**: `029-paste-a-page` | **Date**: 2026-09-12
**Input**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md)

## A note on the ordering

**The reader comes before the screen, and most of this feature is the reader.**
Every guess this feature makes is testable without a DOM, and `research.md` R1
says why that matters: a parser that can only be exercised through a rendered
screen is a parser that does not get exercised. Phases 2 and 3 have no UI in
them at all and should be finished and reviewed before anything is drawn.

**The only chunk that can write anything is Phase 4.** It is small on purpose and
it is reviewed knowing that. Everything before it is pure, and everything after
it is paint.

**US1, my page comes in and nothing of mine is lost, is not a phase.** It is the
whole feature, and it is finished when Phase 5 ends. US2 is Phase 3, US3 is
Phases 3 and 5 together, US4 is Phase 5.

Every phase starts with a failing test. `CLAUDE.md` requires it, and this project
has now shipped four gates that measured nothing, so a test that has never been
seen red is not evidence.

---

## Phase 1: Setup

- [x] T001 Run `npm run verify` from PowerShell, whole and unpiped, and record the numbers. **Measured on `6ad878e` on 2026-09-12, exit 0: 80 test files, 1572 tests, a11y 61, contrast 411 elements plus the wizard at 7 screens with 7 help lines read by axe, in both palettes, secret scan 457, dash scan 332, menu file 21.2 KB with 9 headings and 13 embedded pictures, pwa gate clean.** Never pipe it through `Select-Object -First N`, which ends the pipeline early and reports a green gate as exit 255.

  **The handoff expected 1480 tests and a11y 60 and that is now stale**, not wrong: 028's own later commits added tests after the handoff paragraph was written. The numbers above are the ones this feature is measured against.
- [x] T002 Record `engine/tests/document/parity.snapshot.json`'s hash now. **A diff to it anywhere in this feature is a defect, not a step.** 029 adds no schema field and `SCHEMA_VERSION` stays at 5.

  `F9F1A45BCD6151A5629C6355EDB249FCFC1D75750F61F1819CAD884317F85DA7`, SHA256.
- [x] T003 Record the hashes of every golden fixture now, for the same reason. This feature touches no emitter, so no golden file may move. A moved golden means something reached the engine that should not have.

  55 files under `engine/tests/compile/golden` and `engine/tests/compile/fixtures`, SHA256 of their concatenated per-file SHA256s in sorted path order: `1f238e21168390f3011b1890d2aedef4ce1aa16783df14e43ca8b7b55ec9eb52`. T051 recomputes it exactly this way.

---

## Phase 2: Line classification and runs, alone [foundational]

**Goal**: one block of text becomes an ordered list of runs, each knowing which
lines it came from. Nothing is proposed yet and nothing knows what a price is.

**Independent test**: feed it a real rentry page and read the runs. Every line
index appears in exactly one run, in order, with none missing and none repeated.

**Blocks**: Phases 3, 4 and 5.

- [x] T004 Export `isTableRule` and the list decoration pattern from `app/src/price-list-text.ts`. **Exports only. Do not change what either does**, and do not copy them into the new module: two definitions of "is this a table rule" is the drift this avoids. `research.md` R13.

  `isTableRule` exported, body untouched, and the whole of 023's own suite still green. **`page-text.ts` tightens it rather than changing it**: over a whole page a table's rule must also carry a pipe. 023 keeps its looser reading, which is correct where the whole paste is a price list.

  **The reason first recorded here for that condition was false, and review caught it on 2026-09-12.** It said the pipe is what lets "Terms" over "---" read as a setext heading instead of as a one column table. It is not: in `readLines` the setext branch runs before `THEMATIC_BREAK` and before the table rule check, so that reading is already settled before the pipe is ever asked about. Disproved by mutation: deleting `&& trimmed.includes("|")` leaves `"Terms\n---"`, `"Terms\n-----"`, `"Terms\n\n---"`, `"# H\n---"`, `"---"`, `"---\n---"`, `"  ---  "` and a real pipe table classified identically. What the pipe actually stops is `--`, `:--:`, `:-:` and `- -` reading as table rules mid page, which is a defensible tightening and is now pinned by tests named for the pipe. The "cost" recorded alongside, a single column table with no pipe in its rule, is real but comes from the setext ordering: it reads as a heading in both builds.

  **`DECORATION` was exported here too and the export is reverted**, same review. It had no consumer: Phase 3 reaches a price list through `readCandidates`, which strips decoration internally, so the claim that the builders would read it was speculative. Reverted to a plain `const` per CLAUDE.md's minimalism ladder. Re-exporting is one word if something ever needs it.
- [x] T005 Write the failing tests in `app/tests/page-text.test.ts` first, one per row of R3's table, plus the setext pair from R4: a line of `=` under text is a level 1 heading, a line of `-` under text is a level 2 heading, and the same line of `-` with a blank line above it is a rule. Quote the failure.

  53 cases, seen red against a stub with the right signatures rather than only against a missing import, because "cannot find module" proves the import and nothing else: **43 failed, 13 passed**, including `expected [ 'text' ] to deeply equal [ 'blank' ]`, `expected 'text' to be 'heading'` for all six levels, and `expected [ 'text', 'text', 'text' ] to deeply equal [ 'text', 'blank', 'rule' ]` for each of the five rule forms. The 13 that passed against the stub are the cases that assert something is text, which is what the stub returned, and they are the reason the other 43 matter.
- [x] T006 Create `app/src/page-text.ts` and implement `Line` classification per R3. **No lookahead except the table header**, which is the one case content alone cannot tell apart, exactly as `readCandidates` already documents.

  **R3 is one kind short and one lookbehind short, and both are recorded at the code.** R4's setext rule needs the line BELOW to change the line above, which is a second piece of non-local reading that R3's table does not mention; and the underline itself is not blank, not a heading, not a rule and not text, so it needs a kind of its own. `headingUnderline` is that kind. Without it the underline lands in no run and the losslessness property is a lie.
- [x] T007 Implement run grouping: maximal groups of adjacent non-blank lines, a blank line ends a run, a heading is a run of one, a rule is a run of one.

  **Blank lines get runs of their own** rather than being dropped between the runs around them, so "every line index is in exactly one run" is true of the data structure instead of being bookkeeping every caller has to redo. This phase's own independent test is stated that way, and T022's proposal level version needs the blanks from somewhere.
- [x] T008 Write the **losslessness property test** in `app/tests/page-paste-lossless.test.ts`, generating pastes from a vocabulary of real shapes: headings, rules, tables, product lines, paragraphs, blank runs, Windows line endings, trailing spaces, non-breaking spaces. Assert that the runs, reassembled in order with their blanks, reconstruct the input byte for byte. **Generated, not five hand written examples**: a test over five shapes proves nothing about the sixth shape a seller has. SC-002.

  24 shapes, 200 seeded pages, three properties: every line claimed exactly once, the runs reassembled give the page back, and the ranges are contiguous and honest about their own length. The seed is fixed and printed with every failure.

  **One character does change, and "byte for byte" has to be read against that.** R11 chose to split on `\r?\n`, so a Windows paste comes back with Unix line endings. The test compares against the page with its terminators settled and says so at the top of the file, rather than normalizing both sides and quietly asserting less than it claims. Every other character, smart quotes, trailing spaces and non breaking spaces included, comes back untouched.
- [x] T009 Write the **purity test**: the same text read twice returns a deeply equal result, and the reader is called with `Date.now`, `Math.random` and `document` stubbed to throw. Nothing lints `app/src` for this the way ESLint lints the engine, so the test is the only thing that holds it. `plan.md` Constitution Check, Principle I.

  In `page-text.test.ts`, with the reading taken inside the rigging and every assertion made after it is torn down. A `Date.now` left throwing while `expect` runs would fail the test for the wrong reason, and a test that can fail for the wrong reason stops being evidence.
- [x] T010 **Break it.** Delete one line's run assignment and confirm the losslessness test goes red naming the missing line, not failing a count. Put it back and quote the failure in the commit.

  `from = to + 1` changed to `from = to + 2`, which drops the first line of every run after the first. All three properties went red on seed 2, and the first one named the lines rather than counting them:

  ```text
  - "missing": [],
  + "missing": [
  +   "line 2: \"Terms\"",
  +   "line 4: \"Non breaking spaces come out of a browser copy\"",
  + ],
  ```

  The contiguity property added `run 1 starts at 3 after a run ending at 1`. Put back, and all 56 green again.
- [x] T011 Run `npm run typecheck`, `npm run lint` and `npm run test`. Commit this phase alone. `CLAUDE.md`: the cross-boundary contract lands first and by itself, and in this feature the runs are that contract.

  All three alone and unpiped, exit 0 each. **82 test files and 1628 tests, against T001's 80 and 1572**: two new files, 56 new tests. Dash scan clean over 341 files.

---

## Phase 3: Proposals, and the guessing [US2, US3]

**Goal**: runs become proposed sections of the four kinds Jakob chose, each
carrying the source text it came from.

**Independent test**: paste the example rentry page from the spec's Story 2.
Heading, Text, Divider, Prices with thirty rows, in that order.

- [x] T012 [US2] Write the failing test: a run of product lines becomes ONE `menu` proposal, not one per line. FR-029-08.

  `app/tests/page-proposal.test.ts`, seen red against stubs with the right signatures: **11 failed, 0 passed**, including `expected [] to have a length of 1 but got +0` for the product-run test. Green after implementation.
- [x] T013 [US2] Implement the Prices bar from R5: a run becomes `menu` when it contains a table rule, **or** when at least two of its lines are `suggested` AND more than half of its non-blank lines are. Write the reason for "more than half" at the code, not only here: at least half turns a two sentence paragraph containing one number into a price list, and `splitAtLastNumber` gives "Postage is 5 flat" a price of 5.

  Implemented in `textRunIsMenu` in `app/src/page-text.ts`, with the "more than half" reason at the branch. The table-rule override stays before the ratio. Two narrow FR-029-15a guards run first: a run made only of Markdown image links stays Text, because `A3` and `A4` inside alt text otherwise look enough like prices to trip the fallback, and a contact-looking block stays Text even when handles contain numbers.
- [x] T014 [US2] **Call `readCandidates` on the run's own text, never on the whole paste.** This is R2 and it is the single most important line in this feature. `inferDelimiter`'s bar is a quarter of meaningful lines containing the character, and English prose is full of commas, so a page with two paragraphs and twelve product lines infers `comma` and cuts every product name at its first comma. Write that reason at the call site.

  The only call for the proposal reader is `candidatesForRun(run)`, which calls `readCandidates(runText(run))`. The comment names the comma-heavy prose trap at the call site.
- [x] T015 [US2] Write the failing test for T014 directly: a paste whose paragraphs contain commas and whose product lines are tab separated must still split on tabs. It must fail before T014 and pass after.

  `app/tests/page-proposal.test.ts` now has the comma-heavy prose plus tabbed product run case. It asserts the product run builds `Sticker`, `Badge`, and `Print` with prices `5`, `7`, and `12`, rather than cutting on commas from the prose elsewhere in the paste.
- [x] T016 [US2] Implement heading absorption per R6: a heading run immediately above a `menu` run becomes that section's `heading`, and **the heading's line stays inside the section's source range**. Do not absorb a heading into a `prose` section, and write the reason at the code: one heading commonly precedes several paragraphs, so attaching it to the first invents a relationship the seller did not write.

  Implemented in `readProposal`. The absorption branch writes the R6 reason at the code and the tests assert both halves: `## Prints` over products becomes one menu proposal whose source still starts with `## Prints`, while `## Terms` over prose remains Heading then Text.
- [x] T017 [US3] Implement the title per R7: the paste's first non-blank line, when it is a heading, becomes `Proposal.title` **and still remains in the proposed content**. Write the reason at the code: the title is private, its own hint says "Only you see this", so consuming the heading would publish a page missing its own title.

  Implemented as `titleFrom(runs)`: the title is copied from the first non-blank heading and does not remove it from the proposed content. The test uses a leading blank line, then `# Willow's Prints`, and gets both `proposal.title === "Willow's Prints"` and a Heading block with that text. R6 still wins when the opening heading is directly above prices: it becomes the menu heading and remains inside that menu section's `source`.
- [x] T018 [US2] Implement the four block builders from `data-model.md`. Build by spreading rather than assigning `undefined`: `exactOptionalPropertyTypes` is on and an explicit `undefined` is a different type from an absent key. Assert in the same test file that **a price the app cannot read as a number arrives verbatim** ("DM me", "from 45", "45+") and that **inline marks inside a Text section arrive verbatim** (`**bold**`, `*italic*`, `[text](address)`, `~~strike~~`, `==highlight==`), because Text sections use that same grammar. FR-029-10 and FR-029-11.

  `buildProposedBlock` returns heading, divider, prose, and menu blocks without ids. Optional fields are built with spreads only. Tests cover all five inline marks in Text, the three odd price strings in Prices, and a mostly Prices section with a note line, which is kept as an empty-price row rather than dropped.
- [x] T019 [US2] **Drop `cost` on this path only.** `readLine` produces it and `toProducts` carries it, and a pasted public page has no supplier cost in it. Write the reason at the code: 023 keeps it because there the seller pasted their own spreadsheet; here they pasted their shop window, and `cost` is the field the compiler is forbidden to publish. `data-model.md`, the fields this feature never writes. Assert in the same test that **no built block ever carries `localImageIds` or `localAvatarId`**, because nothing in a pasted page can refer to this device's storage and a picture address found in text is an address that can be published. FR-029-29.

  `tierFrom` drops `cost` and never writes device-picture fields. The test builds comma rows that would carry supplier cost through 023, and asserts the page-paste tiers have only name, price, and unit, with no `cost`, `localImageIds`, or `localAvatarId` in the built menu.
- [x] T020 [US2] Write the failing test that no proposal is ever `gallery` or `profile`, and that a run of image links and a run of contact lines both arrive as `prose` carrying exactly what was written. FR-029-15a, Jakob 2026-09-12.

  Covered in `page-proposal.test.ts`: Markdown image links and numeric contact lines produce two `prose` sections, and neither `gallery` nor `profile` appears. This caught two real false positives: `A3` and `A4` in image alt text were enough for the price fallback until `MARKDOWN_IMAGE_LINE` guarded that run, and handles such as `willow1234` looked like fallback prices until contact-looking blocks were guarded too.
- [x] T021 [US3] Implement the swap: re-read the section's `source` as the other kind. **A swap converts nothing.** Test it both ways round: Text to Prices to Text returns the original proposal exactly, which is the observable form of FR-029-18a.

  `swapProposalKind` changes only `kind` between `prose` and `menu`; `source`, `from`, `to`, and `swappable` are unchanged. Tests cover Text to Prices to Text and Prices to Text to Prices, and the Text-to-Prices block reads the source into `Sketch` at `30`.
- [x] T022 [US2] Extend the losslessness property test to proposals, not just runs: concatenating every proposed section's `source` in order, blanks included, still reconstructs the input byte for byte, and it holds with any subset of sections swapped.

  `app/tests/page-paste-lossless.test.ts` now has two proposal-level properties over the same 200 generated pages: raw proposal sources rebuild the paste with line endings settled, and swapping alternating swappable sections leaves the same rebuild. Whitespace-only paste is the named exception, matching FR-029-27: no proposal and no confirm path.
- [x] T023 [US2] **Break it.** Make heading absorption drop the heading line from the source range and confirm the losslessness test goes red naming the heading. Put it back and quote the failure.

  Broke the absorption draft to start at the text run instead of the heading run. `npm run test -- app/tests/page-paste-lossless.test.ts` went red on seed 1 in both proposal-source properties and named the missing line:

  ```text
  - ## Postage
  ```

  Put back, and the same file returned green: 1 file, 5 tests.
- [x] T024 Run `npm run typecheck`, `npm run lint` and `npm run test`. Commit. Still no DOM anywhere in this feature.

  `npm run typecheck`, exit 0. `npm run lint`, exit 0. `npm run test`, exit 0: **84 test files, 1654 tests**. `npm run dashscan`, exit 0: **345 authored files checked**. The reader-focused batch before the full suite was also green: 4 files, 82 tests.

  The first full run after the chunk code had all 83 files and 1652 tests passing but exited 1 on an unhandled stale jsdom repaint: `ReferenceError: document is not defined` from `renderShell` after the environment tore down. Fixed at the store test lifecycle with `resetStoreForTests`, wired through `app/tests/setup.ts`, and pinned in `app/tests/store-cleanup.test.ts`, then reran all three gates above.

---

## Phase 4: The store, and the only code that writes [US1]

**Goal**: the seller's decisions are held, and confirming makes a new page.

**Independent test**: drive the store directly with no screen, confirm a paste,
and read the stored pages before and after. One more page, none changed.

- [x] T025 [US1] Add `pastingPage` to `State` per `data-model.md`. **A new field, not a widened `pasting`.** R12: `pasting` is scoped to a `blockId` and all seven functions around it write into that block. Write the reason at the field.
- [x] T026 [US1] Add the actions: start, set text, drop a section, restore a section, swap a section, stop. Setting the text clears `dropped` and `swapped`, because the indices are into a proposal that has just changed.
- [x] T027 [US1] Write the failing test: nothing reaches storage, the open document, or any page until confirm is called. FR-029-19. Assert it by counting writes, not by reading the screen.
- [x] T028 [US1] Implement confirm: build the `Document` with `target` copied from the page currently open, serialize it, and hand it to `openBackup`. R8. Do not write a page by hand: `openBackup` runs `parseDocument` and writes nothing if it refuses, which is FR-029-26 for free and turns a reader bug into a refusal rather than a corrupt page.
- [x] T029 [US1] Give each built row its `id` with `newId()` **here, in the store, not in the reader**, which is the one impure thing on the path and the reason the reader stays pure. R1.
- [x] T030 [US1] Announce the caller's own sentence on success, not `openBackup`'s. Its message is written for a file and reads as nonsense here, which is exactly the problem `starterPicker` already solved the same way. The sentence must say the page arrived as a new page and where the previous one still is. FR-029-23.
- [x] T031 [US1] Write the failing test for SC-006: list every stored page and its bytes before, confirm a paste, list again. Exactly one page added, every existing page byte identical. **This is the one this project has the most reason to be careful about.**
- [x] T032 [US1] Write the test that a paste the reader somehow read into an invalid document leaves storage untouched and says so, by forcing the builder to emit a block with an empty `id`. Proves the `openBackup` refusal is load bearing rather than assumed.
- [x] T033 Run `npm run typecheck`, `npm run lint` and `npm run test`. Commit.

  Chunk 3 evidence, 2026-09-13: `page-paste-store.test.ts` has six passing
  tests with real IndexedDB. A deliberate no-op confirm produced four
  behavioral failures, including two pages instead of three. A deliberate
  pre-confirm save produced five failures, including two unexpected writes
  and changed existing records. Both mutations were removed. Full test run:
  85 files, 1660 tests passed. Typecheck and lint passed. Confirm uses
  `JSON.stringify` to reach `openBackup`'s parser, so the invalid-builder test
  exercises that refusal before the validated serializer writes anything.

---

## Phase 5: The panel and the way in [US1, US3, US4]

**Goal**: the seller can see the proposal, correct it, and press one button.

**Independent test**: open the app with no page, paste a rentry page, read the
panel, untick one section, swap another, confirm, and read the Build screen.

- [x] T034 [US1] Create `app/src/ui/page-paste.ts`. **Refresh the panel's own body, do not repaint.** R9, carried from `price-list-paste.ts` rather than rediscovered: `repaint` refuses while a text field has focus, the paste box IS a focused text field the whole time, so every deferred repaint re-defers and on a phone with the keyboard up the panel never appears at all. Write the reference at the code.
- [x] T035 [US1] Draw each proposed section with its kind, a preview of its content, and a checkbox **named by the kind and the content**, the way 023 names a line by the line. "Section 3" is a plausible looking name that tells the seller nothing, which is what the a11y gate exists to catch. FR-029-16, Principle VI.
- [x] T036 [US3] Draw the swap control on `prose` and `menu` sections only, and on nothing else. Its label must say what it will become, not what it is.
- [x] T037 [US4] Empty or whitespace-only paste: no proposal, no confirm control, and no error. FR-029-27.
- [x] T038 [US4] A paste that yields one Text section is still offered, and the wording must not claim a page was recognised. FR-029-28.
- [x] T039 [US1] The confirm control says how many sections it will make, is disabled at zero, and **the count is the number actually made**. FR-029-20 and FR-029-21. 023 got this wrong once by counting ticks that included a line the conversion dropped, and told the seller "Add 3 items" for two.
- [x] T040 [US1] Apply R10's caps: at most 20 lines of preview per section, at most 100 sections drawn, each with an honest line saying how many more there are. **Cap what is drawn, never what is converted.**
- [x] T041 [US1] Add the control to the empty state in `app/src/ui/build.ts`, as a **plain button, not `primary`**. There is exactly one solid accent on that row and it is the wizard, settled by Jakob on 2026-09-11. `6b8bc45` is about the count.
- [x] T042 [US1] **Add it to the empty state's own sentence too.** That sentence currently names three ways in, and the T048 research found that the loudest control on the screen was the one the screen never mentioned. A fourth way in that the sentence does not name repeats the mistake that was just fixed.
- [x] T043 [US1] The word "import" appears nowhere a seller can read. FR-029-02. Grep the diff for it before committing.
- [x] T044 [US1] Offer the file picker as the secondary path, with a real button in front of a hidden input, the same pairing `price-list-paste.ts` and `export.ts` both use because a bare file input has no accessible name. Refuse `.json`, for the reason 023 gives: a saved page opened here would do nothing useful and would blur the line against opening a backup. FR-029-03.
- [x] T045 [US3] Write the DOM tests in `app/tests/page-paste.test.ts`: unticking removes a section, swapping changes what is made, a second paste describes itself and not the first, and closing the panel loses only the paste.
- [x] T046 [US1] Add the repaint case to `app/tests/repaint-while-typing.test.ts`, or the trap in T034 is documented and unguarded.
- [x] T047 Run `npm run typecheck`, `npm run lint` and `npm run test`. Commit.

  Chunk 4 evidence, 2026-09-13: The first targeted panel run had all three
  tests red because the empty Build screen did not offer the page paste entry.
  The panel and repaint tests now cover edits, cancellation, zero selection,
  preview limits, and focused typing. Typecheck and lint passed. The final full
  test run passed with 86 files and 1668 tests.

---

## Phase 6: The gates

**Goal**: the things a machine checks forever, rather than once.

- [x] T048 Add a case to `app/tests/a11y.test.ts` rendering the panel open with a proposal on screen. A11y file now has 62 tests. Focused Vitest exit 0, 62 passed.
- [x] T049 Add a pass to `scripts/contrast.mjs` measuring the panel in both palettes. `npm run contrast` exit 0: light and dark each drew 3 proposed sections, 3 checkboxes and 16 measured contrast nodes, with 0 failures. The gate refuses fewer than 3 of each.
- [x] T050 Add the XSS corpus case: a whole page paste carrying `<script>` and `<img onerror>`, taken through proposal, compile and preview. Focused renderer test exit 0, 40 passed.
- [x] T051 Confirm the parity snapshot and every golden fixture are byte identical to T002 and T003. Parity SHA256 remains `F9F1A45BCD6151A5629C6355EDB249FCFC1D75750F61F1819CAD884317F85DA7`. `git diff --exit-code 6ad878e -- engine/tests/document/parity.snapshot.json engine/tests/compile/golden engine/tests/compile/fixtures` exited 0, and all 55 fixture paths are clean in status. Recorded fixture aggregate at T003 was `1f238e21168390f3011b1890d2aedef4ce1aa16783df14e43ca8b7b55ec9eb52`.
- [x] T052 Run `npm run verify` whole and unpiped, exit 0 after lifecycle fix `5191002`: 86 test files and 1675 tests against T001's 80 and 1572, six new files and 103 new tests. A11y 62 against 61, from T048. Contrast retained 411 storefront elements and seven wizard screens in each palette, and added the page paste panel at 3 sections, 3 checkboxes and 16 measured nodes in each. Secret scan 488 against 457 and dash scan 349 against 332, reflecting added source and test files. Menu file stayed 21.2 KB with 9 headings and 13 embedded pictures, and PWA update stayed clean.
- [x] T053 Break each new gate once. Clearing the first proposed checkbox label made the a11y case fail at the checkbox name assertion. Changing light `--muted` to `#dedede` made contrast exit 1 and name the page paste hint at 1.2:1 against required 4.5:1. Both mutations were restored.

---

## Phase 7: Review, the browser, and the handset

- [ ] T054 Per-chunk reviews as the work lands: a fresh spec-compliance reviewer then a fresh code-quality reviewer per chunk, per `CLAUDE.md`. Track carry-forwards as `CHUNK N:` code comments at the exact site, never as prose.
- [x] T055 **The holistic review over the whole feature diff. Required**, five chunks being more than roughly three. On 028 it found three ways the feature corrupted a seller's text that four per-chunk reviews had each passed, because per-chunk reviews each see one internally correct side of a seam.

  Completed on 2026-09-13 with a fresh read-only holistic review over
  `ac1e5f1774bd64f6dab4867ff82250e6abb99f6e..e5a030ca145ae17ead688a500cedd6857fd98cb2`,
  then fixed in the working tree. Findings and fixes:

  - A second money-like public column could disappear through `cost`. Fixed by
    leaving those ambiguous runs as Text unless there is a real unit column, and
    covered at proposal and confirmed-page level.
  - The way in existed only on the empty Build page. Fixed by offering page
    paste on a page that already has sections and from Your pages, switching to
    Build before opening the panel.
  - Only the first 100 proposed sections were reviewable. Fixed with previous
    and next controls that page through long proposals while the confirm count
    still covers every retained section.
  - The page paste panel had no matching stylesheet rules. Fixed with bounded
    scrolling and wrapping preview text.

  Evidence after the fixes: `npm run verify`, exit 0. 86 test files and 1680
  tests passed, a11y 62 passed, secret scan 488 and dash scan 349 were clean,
  contrast passed in light and dark with the page paste panel measured at 3
  sections, 3 checkboxes and 16 contrast nodes, menu-file stayed clean at 21.2
  KB, and PWA update stayed clean.
- [ ] T056 Drive it in a real browser: paste an actual page copied out of rentry, confirm, and read the Build screen, the Preview and the Copy tab. Quote what came out.
- [ ] T057 Prove it on the handset. Check `dumpsys power` for `mWakefulness` **immediately before each `screencap`**, not once at the start: a screenshot under about 20 kB is a sleeping screen until proven otherwise, which cost real time on 2026-09-01. `adb shell svc power stayon usb` holds it awake, and set it back to `false` afterwards because it is the owner's device setting.
- [ ] T058 Paste on the handset with the keyboard up, which is the only way to prove T034's fix rather than assume it. A phone is where that trap lives and jsdom cannot see it.

---

## Phase 8: Ship

- [ ] T059 Merge to master with `--no-ff`. Five features in a row have gone that way and it is settled practice.
- [ ] T060 Bump the version. **Never `Set-Content` it**: it writes a UTF-8 BOM into `build.gradle` and Gradle dies in about a second with no useful message. Use Edit, and check the first three bytes are `97,112,112` and not `239,187,191` if a build dies instantly.
- [ ] T061 Build the signed APK with `$env:JAVA_HOME="C:\Program Files\Java\jdk-21"` set for the build only. The machine's `JAVA_HOME` points at JDK 8 and the build fails with "Dependency requires at least JVM runtime version 11".
- [ ] T062 Push, tag, and publish the GitHub Release **with the APK attached**. Verify with `gh release view` and `git ls-remote --tags origin`. `CLAUDE.md`: pushing commits is not shipping, and 024 was pushed and never released, so Jakob reasonably concluded nothing had shipped.
- [ ] T063 Update `docs/HANDOFF.md`, `specs/README.md`'s status table, `docs/ROADMAP.md`'s known gaps section, and `CLAUDE.md`'s status block. **The block does not update itself. Whoever finishes a feature updates it.**
- [ ] T064 Record in `docs/ROADMAP.md` what the reader could not recognise in real pastes, so the Gallery and About you question Jakob deferred on 2026-09-12 gets decided on evidence rather than on a second guess.

---

## Coverage, checked rather than assumed

Every requirement in the spec maps to at least one task, and the mapping was
checked by walking the spec rather than by trusting that writing the tasks from
it was enough. Two gaps were found that way and closed by widening T018 and T019
rather than by adding tasks: the verbatim guarantees, FR-029-10 and FR-029-11,
and the promise about pictures, FR-029-29. All three were requirements that
nothing would have failed on.

| Requirements | Where |
|---|---|
| FR-029-01, 02, 03, 04 | T040 to T044 |
| FR-029-05, 07, 12, 14 | T005 to T008 |
| FR-029-06 | T008, T022, T023, and SC-002 |
| FR-029-08, 09, 10, 11, 13 | T012 to T018, T009 |
| FR-029-15, 15a, 15b | T005, T018, T020 |
| FR-029-16, 17, 20, 21 | T035, T039, T045 |
| FR-029-18, 18a | T021, T036 |
| FR-029-19, 22, 23, 26 | T027 to T032 |
| FR-029-24, 25 | T017, T056 |
| FR-029-27, 28 | T037, T038 |
| FR-029-29 | T019 |
| SC-001 to SC-007 | T031, T040, T052, T056, T057 |

**The one requirement with no automated home is FR-029-24**, that the new page is
immediately editable, compiles, previews and publishes with no further action.
Nothing short of driving the real app proves it, which is what T056 is, and it is
recorded here as a manual step rather than left looking covered.
