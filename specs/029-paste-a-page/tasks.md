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

- [ ] T001 Run `npm run verify` from PowerShell, whole and unpiped, and record the numbers in the first commit message. Baseline measured on `6ad878e` on 2026-09-12: **80 test files, 1572 tests, a11y 61, contrast 411 elements plus the wizard at 7 screens in both palettes, secret scan 457, dash scan 332, menu file 21.2 KB, pwa gate clean, exit 0.** Never pipe it through `Select-Object -First N`, which ends the pipeline early and reports a green gate as exit 255.
- [ ] T002 Record `engine/tests/document/parity.snapshot.json`'s hash now. **A diff to it anywhere in this feature is a defect, not a step.** 029 adds no schema field and `SCHEMA_VERSION` stays at 5.
- [ ] T003 Record the hashes of every golden fixture directory now, for the same reason. This feature touches no emitter, so no golden file may move. A moved golden means something reached the engine that should not have.

---

## Phase 2: Line classification and runs, alone [foundational]

**Goal**: one block of text becomes an ordered list of runs, each knowing which
lines it came from. Nothing is proposed yet and nothing knows what a price is.

**Independent test**: feed it a real rentry page and read the runs. Every line
index appears in exactly one run, in order, with none missing and none repeated.

**Blocks**: Phases 3, 4 and 5.

- [ ] T004 Export `isTableRule` and the list decoration pattern from `app/src/price-list-text.ts`. **Exports only. Do not change what either does**, and do not copy them into the new module: two definitions of "is this a table rule" is the drift this avoids. `research.md` R13.
- [ ] T005 Write the failing tests in `app/tests/page-text.test.ts` first, one per row of R3's table, plus the setext pair from R4: a line of `=` under text is a level 1 heading, a line of `-` under text is a level 2 heading, and the same line of `-` with a blank line above it is a rule. Quote the failure.
- [ ] T006 Create `app/src/page-text.ts` and implement `Line` classification per R3. **No lookahead except the table header**, which is the one case content alone cannot tell apart, exactly as `readCandidates` already documents.
- [ ] T007 Implement run grouping: maximal groups of adjacent non-blank lines, a blank line ends a run, a heading is a run of one, a rule is a run of one.
- [ ] T008 Write the **losslessness property test** in `app/tests/page-paste-lossless.test.ts`, generating pastes from a vocabulary of real shapes: headings, rules, tables, product lines, paragraphs, blank runs, Windows line endings, trailing spaces, non-breaking spaces. Assert that the runs, reassembled in order with their blanks, reconstruct the input byte for byte. **Generated, not five hand written examples**: a test over five shapes proves nothing about the sixth shape a seller has. SC-002.
- [ ] T009 Write the **purity test**: the same text read twice returns a deeply equal result, and the reader is called with `Date.now`, `Math.random` and `document` stubbed to throw. Nothing lints `app/src` for this the way ESLint lints the engine, so the test is the only thing that holds it. `plan.md` Constitution Check, Principle I.
- [ ] T010 **Break it.** Delete one line's run assignment and confirm the losslessness test goes red naming the missing line, not failing a count. Put it back and quote the failure in the commit.
- [ ] T011 Run `npm run typecheck`, `npm run lint` and `npm run test`. Commit this phase alone. `CLAUDE.md`: the cross-boundary contract lands first and by itself, and in this feature the runs are that contract.

---

## Phase 3: Proposals, and the guessing [US2, US3]

**Goal**: runs become proposed sections of the four kinds Jakob chose, each
carrying the source text it came from.

**Independent test**: paste the example rentry page from the spec's Story 2.
Heading, Text, Divider, Prices with thirty rows, in that order.

- [ ] T012 [US2] Write the failing test: a run of product lines becomes ONE `menu` proposal, not one per line. FR-029-08.
- [ ] T013 [US2] Implement the Prices bar from R5: a run becomes `menu` when it contains a table rule, **or** when at least two of its lines are `suggested` AND more than half of its non-blank lines are. Write the reason for "more than half" at the code, not only here: at least half turns a two sentence paragraph containing one number into a price list, and `splitAtLastNumber` gives "Postage is 5 flat" a price of 5.
- [ ] T014 [US2] **Call `readCandidates` on the run's own text, never on the whole paste.** This is R2 and it is the single most important line in this feature. `inferDelimiter`'s bar is a quarter of meaningful lines containing the character, and English prose is full of commas, so a page with two paragraphs and twelve product lines infers `comma` and cuts every product name at its first comma. Write that reason at the call site.
- [ ] T015 [US2] Write the failing test for T014 directly: a paste whose paragraphs contain commas and whose product lines are tab separated must still split on tabs. It must fail before T014 and pass after.
- [ ] T016 [US2] Implement heading absorption per R6: a heading run immediately above a `menu` run becomes that section's `heading`, and **the heading's line stays inside the section's source range**. Do not absorb a heading into a `prose` section, and write the reason at the code: one heading commonly precedes several paragraphs, so attaching it to the first invents a relationship the seller did not write.
- [ ] T017 [US3] Implement the title per R7: the paste's first non-blank line, when it is a heading, becomes `Proposal.title` **and still becomes a Heading section**. Write the reason at the code: the title is private, its own hint says "Only you see this", so consuming the heading would publish a page missing its own title.
- [ ] T018 [US2] Implement the four block builders from `data-model.md`. Build by spreading rather than assigning `undefined`: `exactOptionalPropertyTypes` is on and an explicit `undefined` is a different type from an absent key.
- [ ] T019 [US2] **Drop `cost` on this path only.** `readLine` produces it and `toProducts` carries it, and a pasted public page has no supplier cost in it. Write the reason at the code: 023 keeps it because there the seller pasted their own spreadsheet; here they pasted their shop window, and `cost` is the field the compiler is forbidden to publish. `data-model.md`, the fields this feature never writes.
- [ ] T020 [US2] Write the failing test that no proposal is ever `gallery` or `profile`, and that a run of image links and a run of contact lines both arrive as `prose` carrying exactly what was written. FR-029-15a, Jakob 2026-09-12.
- [ ] T021 [US3] Implement the swap: re-read the section's `source` as the other kind. **A swap converts nothing.** Test it both ways round: Text to Prices to Text returns the original proposal exactly, which is the observable form of FR-029-18a.
- [ ] T022 [US2] Extend the losslessness property test to proposals, not just runs: concatenating every proposed section's `source` in order, blanks included, still reconstructs the input byte for byte, and it holds with any subset of sections swapped.
- [ ] T023 [US2] **Break it.** Make heading absorption drop the heading line from the source range and confirm the losslessness test goes red naming the heading. Put it back and quote the failure.
- [ ] T024 Run `npm run typecheck`, `npm run lint` and `npm run test`. Commit. Still no DOM anywhere in this feature.

---

## Phase 4: The store, and the only code that writes [US1]

**Goal**: the seller's decisions are held, and confirming makes a new page.

**Independent test**: drive the store directly with no screen, confirm a paste,
and read the stored pages before and after. One more page, none changed.

- [ ] T025 [US1] Add `pastingPage` to `State` per `data-model.md`. **A new field, not a widened `pasting`.** R12: `pasting` is scoped to a `blockId` and all seven functions around it write into that block. Write the reason at the field.
- [ ] T026 [US1] Add the actions: start, set text, drop a section, restore a section, swap a section, stop. Setting the text clears `dropped` and `swapped`, because the indices are into a proposal that has just changed.
- [ ] T027 [US1] Write the failing test: nothing reaches storage, the open document, or any page until confirm is called. FR-029-19. Assert it by counting writes, not by reading the screen.
- [ ] T028 [US1] Implement confirm: build the `Document` with `target` copied from the page currently open, serialize it, and hand it to `openBackup`. R8. Do not write a page by hand: `openBackup` runs `parseDocument` and writes nothing if it refuses, which is FR-029-26 for free and turns a reader bug into a refusal rather than a corrupt page.
- [ ] T029 [US1] Give each built row its `id` with `newId()` **here, in the store, not in the reader**, which is the one impure thing on the path and the reason the reader stays pure. R1.
- [ ] T030 [US1] Announce the caller's own sentence on success, not `openBackup`'s. Its message is written for a file and reads as nonsense here, which is exactly the problem `starterPicker` already solved the same way. The sentence must say the page arrived as a new page and where the previous one still is. FR-029-23.
- [ ] T031 [US1] Write the failing test for SC-006: list every stored page and its bytes before, confirm a paste, list again. Exactly one page added, every existing page byte identical. **This is the one this project has the most reason to be careful about.**
- [ ] T032 [US1] Write the test that a paste the reader somehow read into an invalid document leaves storage untouched and says so, by forcing the builder to emit a block with an empty `id`. Proves the `openBackup` refusal is load bearing rather than assumed.
- [ ] T033 Run `npm run typecheck`, `npm run lint` and `npm run test`. Commit.

---

## Phase 5: The panel and the way in [US1, US3, US4]

**Goal**: the seller can see the proposal, correct it, and press one button.

**Independent test**: open the app with no page, paste a rentry page, read the
panel, untick one section, swap another, confirm, and read the Build screen.

- [ ] T034 [US1] Create `app/src/ui/page-paste.ts`. **Refresh the panel's own body, do not repaint.** R9, carried from `price-list-paste.ts` rather than rediscovered: `repaint` refuses while a text field has focus, the paste box IS a focused text field the whole time, so every deferred repaint re-defers and on a phone with the keyboard up the panel never appears at all. Write the reference at the code.
- [ ] T035 [US1] Draw each proposed section with its kind, a preview of its content, and a checkbox **named by the kind and the content**, the way 023 names a line by the line. "Section 3" is a plausible looking name that tells the seller nothing, which is what the a11y gate exists to catch. FR-029-16, Principle VI.
- [ ] T036 [US3] Draw the swap control on `prose` and `menu` sections only, and on nothing else. Its label must say what it will become, not what it is.
- [ ] T037 [US4] Empty or whitespace-only paste: no proposal, no confirm control, and no error. FR-029-27.
- [ ] T038 [US4] A paste that yields one Text section is still offered, and the wording must not claim a page was recognised. FR-029-28.
- [ ] T039 [US1] The confirm control says how many sections it will make, is disabled at zero, and **the count is the number actually made**. FR-029-20 and FR-029-21. 023 got this wrong once by counting ticks that included a line the conversion dropped, and told the seller "Add 3 items" for two.
- [ ] T040 [US1] Apply R10's caps: at most 20 lines of preview per section, at most 100 sections drawn, each with an honest line saying how many more there are. **Cap what is drawn, never what is converted.**
- [ ] T041 [US1] Add the control to the empty state in `app/src/ui/build.ts`, as a **plain button, not `primary`**. There is exactly one solid accent on that row and it is the wizard, settled by Jakob on 2026-09-11. `6b8bc45` is about the count.
- [ ] T042 [US1] **Add it to the empty state's own sentence too.** That sentence currently names three ways in, and the T048 research found that the loudest control on the screen was the one the screen never mentioned. A fourth way in that the sentence does not name repeats the mistake that was just fixed.
- [ ] T043 [US1] The word "import" appears nowhere a seller can read. FR-029-02. Grep the diff for it before committing.
- [ ] T044 [US1] Offer the file picker as the secondary path, with a real button in front of a hidden input, the same pairing `price-list-paste.ts` and `export.ts` both use because a bare file input has no accessible name. Refuse `.json`, for the reason 023 gives: a saved page opened here would do nothing useful and would blur the line against opening a backup. FR-029-03.
- [ ] T045 [US3] Write the DOM tests in `app/tests/page-paste.test.ts`: unticking removes a section, swapping changes what is made, a second paste describes itself and not the first, and closing the panel loses only the paste.
- [ ] T046 [US1] Add the repaint case to `app/tests/repaint-while-typing.test.ts`, or the trap in T034 is documented and unguarded.
- [ ] T047 Run `npm run typecheck`, `npm run lint` and `npm run test`. Commit.

---

## Phase 6: The gates

**Goal**: the things a machine checks forever, rather than once.

- [ ] T048 Add a case to `app/tests/a11y.test.ts` rendering the panel open with a proposal on screen. Expect the count to go from 61 to 62.
- [ ] T049 Add a pass to `scripts/contrast.mjs` measuring the panel in both palettes, and **make it refuse to report a pass unless the panel actually had sections on screen**. A gate that measured an empty panel would be green and worthless, which is a mistake this project has already made three times in one afternoon.
- [ ] T050 Add the XSS corpus case: a paste carrying a script tag, and an image with an `onerror`. Principle IV requires the corpus to grow by one case whenever a new way for user-authored content to arrive is introduced, and a paste is exactly that.
- [ ] T051 **Confirm the parity snapshot and every golden fixture are byte identical to T002 and T003.** Quote the comparison. This is the claim "the schema does not move" being checked rather than asserted.
- [ ] T052 Run `npm run verify` whole and unpiped. Record every number against T001's baseline and explain any that moved.
- [ ] T053 **Break each new gate once.** Strip the accessible name off a section checkbox and confirm a11y goes red naming it; weaken a colour and confirm contrast goes red naming the ratio. A gate that has never been seen red is not evidence.

---

## Phase 7: Review, the browser, and the handset

- [ ] T054 Per-chunk reviews as the work lands: a fresh spec-compliance reviewer then a fresh code-quality reviewer per chunk, per `CLAUDE.md`. Track carry-forwards as `CHUNK N:` code comments at the exact site, never as prose.
- [ ] T055 **The holistic review over the whole feature diff. Required**, five chunks being more than roughly three. On 028 it found three ways the feature corrupted a seller's text that four per-chunk reviews had each passed, because per-chunk reviews each see one internally correct side of a seam.
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
