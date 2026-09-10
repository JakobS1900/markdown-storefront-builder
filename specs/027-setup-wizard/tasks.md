# Tasks: The Setup Wizard

**Feature**: 027 | **Branch**: `027-setup-wizard` | **Date**: 2026-09-08
**Input**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [quickstart.md](quickstart.md)

## A note on the ordering

The phases below are **not** in user story priority order, and that is
deliberate. US2, examples in the fields, is P2 and goes first because it is the
smallest thing that answers the original complaint, it is shippable entirely on
its own, and `research.md` R2 found it needs no new code at all. **If it turns
out to be enough by itself, that is worth knowing before building a surface.**

Every phase starts with a failing test. `CLAUDE.md` requires it and this project
has twice shipped a gate that measured nothing, so a test that has never been
seen red is not evidence.

---

## Phase 1: Setup

- [x] T001 Run `npm run verify` from PowerShell, whole and unpiped, and record the numbers in the first commit message. It is what says the tree is where `docs/HANDOFF.md` claims.
- [x] T002 Confirm `engine/tests/document/parity.snapshot.json` is unchanged and stays that way. **A diff to it anywhere in this feature is a defect, not a step**: 027 adds no schema, and `SCHEMA_VERSION` stays at 5.

---

## Phase 2: Examples in the fields [US2]

**Goal**: Somebody meeting an empty field can see what belongs in it, whether or
not they ever touch the wizard.

**Independent test**: Open any section form with no wizard involved. Every empty
field either shows an example or is named in the exemption list, and no field
lost its label.

- [x] T003 [US2] Write the failing test `app/tests/field-examples.test.ts`: render every section form and assert each text field either carries a hint containing a concrete example or appears in an explicit exemption list. It must fail now: of the 21 text fields in `app/src/ui/forms.ts`, ten have no hint and two more say only "One per line.", which is the format rather than the content.
- [x] T004 [US2] In that same test, build the exemption list as data with **a written reason per entry**. A test that only counts hints can be satisfied with noise; the reason is what stops that.
- [x] T005 [US2] Add a hint with an example to `Item` in `app/src/ui/forms.ts`. It sits next to `Price`, which already says `Anything you like: "45", "from 45", or "DM me"`, and has nothing. It is the first field anybody meets on a price row.
- [x] T006 [P] [US2] Add hints to the remaining Prices fields in `app/src/ui/forms.ts`: `Description (optional)`, `Section heading (optional)`, and rewrite `What is included (optional)`, whose entire hint was "One per line." `Currency (optional)` already had one and was left alone.
- [x] T007 [P] [US2] Add hints to the About you fields in `app/src/ui/forms.ts`: `Your name`, `One line about you (optional)`, `What to call it`, and rewrite `How you take payment (optional)`, the second field whose entire hint was "One per line." `Address` already had one.
- [x] T008 [P] [US2] Add hints to the remaining section fields in `app/src/ui/forms.ts`: `Heading text`, `Caption (optional)`, and the two other `Section heading (optional)` fields, each with an example from its own kind of section. `Text` already had one.
- [x] T009 [US2] **Confirm no `placeholder` attribute was added anywhere.** FR-130, and `a11y.test.ts` already refuses one. Do not weaken that assertion: `research.md` R2 records why it is stricter than the spec first assumed.
- [x] T010 [US2] **Break the gate.** Remove the hint from `Item` and confirm `field-examples.test.ts` goes red naming that field, not just failing a count. Put it back. Quote the failure in the commit.
- [x] T011 [US2] Run `npm run verify` and commit Phase 2 alone. It is shippable at this point and should be treated as such.

---

## Phase 3: Answers to a document, with no DOM at all [US1]

**Goal**: Every real decision in this feature lives in one pure function that can
be tested without clicking through six screens.

**Independent test**: Call it with an answer set, get a `Document`, compile it.
No jsdom, no store, no IndexedDB.

- [x] T012 [US1] Write the failing test `app/tests/wizard-answers.test.ts`. No `@vitest-environment jsdom` line in it, deliberately: if this file ever needs the DOM, the seam has moved into the wrong place.
- [x] T013 [US1] **The assertion this half turns on**: an empty answer set produces the chosen starting point unchanged, and its compiled output is **byte identical** to opening that starter from the picker. Assert bytes, not shape.
- [x] T014 [US1] Create `app/src/ui/wizard-answers.ts` with the answer set type from `data-model.md` and a function to a `Document`. Every field optional, because every question is skippable.
- [x] T015 [US1] Map the "what do you sell" answer to one of the eight starter ids, with an explicit `other` that maps to a default. FR-122: no ninth set of page content is invented.
- [x] T016 [US1] Write the store name to `profile.displayName`, and to `document.title` as well. FR-121.
- [x] T017 [US1] **Test that the store name reaches the compiled output**, not merely the field. `title` is never emitted, and a name that appears in the editor and not in the output is the exact defect FR-121 exists to prevent.
- [x] T018 [US1] Write the first item and price to the starter's first tier, replacing what was there rather than appending a second row.
- [x] T019 [US1] Write the selling mode to `tier.availability` using the four values feature 026 defined, and the amount to `tier.unit`. FR-124: no parallel way of saying the same thing.
- [x] T020 [US1] A skipped question leaves the starter's own content alone and **writes no empty string**. An absent optional field and an empty one must not come to mean the same thing.
- [x] T021 [US1] A starter with no menu section takes no item. `Portfolio and about me` ships with no prices deliberately; the item is dropped rather than a Prices section being invented. Test it, so the behaviour is chosen rather than discovered later.
- [x] T022 [US1] **Grow the XSS corpus** by the store name, the item name and the price, per Constitution IV. Everything typed reaches the page through the same escaping path as every other authored string, and this feature contains no string template that produces Markdown.
- [x] T023 [US1] **Break the gate.** Write the store name only to `document.title` and confirm T017 fails. If it passes, it is checking the field rather than the output and is the wrong test.
- [x] T024 [US1] Run `npm run verify` and commit Phase 3.

---

## Phase 4: The surface [US1] [US3]

**Goal**: Six questions, one per screen, that can be walked backwards and walked
away from.

**Independent test**: Open it, answer, go back, see the answer still there,
dismiss it.

- [x] T025 [US1] Write the failing test `app/tests/wizard.test.ts` covering: the layer opens, one question is on screen at a time, and the focus trap holds.
- [x] T026 [US1] Create `app/src/ui/wizard.ts` as a `div` with `role="dialog"`. **Not an `aside`**: `aria-allowed-role` fails that and the a11y gate catches it. Feature 025 paid for this finding; do not rediscover it.
- [x] T027 [US1] Set `inert` on the header and main by attribute while the wizard is open, the way `shell.ts` already does for the pages drawer. jsdom implements neither the `inert` property nor its behaviour, so it is asserted as an attribute.
- [x] T028 [US1] Add `wizardOpen`, `wizardStep` and `wizardAnswers` to `State` in `app/src/store.ts`, on the **immediate `set` path** the way `sidebarOpen` is. A surface that appears one repaint after the press reads as a dead button.
- [x] T029 [US1] Build the six question screens from `data-model.md`'s seven answer fields. `firstItem` and `firstPrice` share a screen; the other five have one each. The selling mode question takes its words from the engine's exported `SELLING_MODE_WORDS`, so the word somebody picks is the word their page prints.
- [x] T029a [US1] Assert the screen count in `app/tests/wizard.test.ts`: walking from the first question to the finish without typing anything passes at most seven screens. SC-002, which nothing counted before.
- [x] T029b [US1] `wantsPicture` decides which section is open when the page appears and changes nothing about the document itself. Test both: the section choice happens, and two documents differing only in that answer are byte identical.
- [x] T030 [US3] Going back a question keeps the answer already given. FR-126, and a test.
- [x] T031 [US3] Every question is skippable, and skipping every one still reaches the finish. FR-120 and FR-127.
- [x] T032 [US3] Dismiss the wizard on the device back gesture **before** it leaves the surface, in `app/src/surface-history.ts`, following what feature 025 settled for the sidebar. FR-133.
- [x] T033 [US1] Restore focus on close to the control that opened it, and add a `syncWizardFocus` equivalent so focus does not leak to `document.body` on every repaint. That leak was a real defect in 025 and the same shape of code causes it.
- [x] T034 [US1] Run `npm run verify` and commit Phase 4.

---

## Phase 5: The way in, and the way out [US1] [US3]

**Goal**: It is reachable, it finishes into a real page, and it never costs
anybody work they had already done.

**Independent test**: Open a page with real content, run the wizard, and confirm
that page is untouched whether you finish or abandon.

- [x] T035 [US1] Write the failing test: the empty state offers the wizard **and** still offers the starting point picker. FR-128. If the picker is gone or is behind the wizard, this fails. In `app/tests/wizard-entry.test.ts`, a new file: everything in it crosses a seam into storage and needs `fake-indexeddb`, which `wizard.test.ts` deliberately has none of.
- [x] T036 [US1] Add the entry point in `app/src/ui/build.ts`, beside `starterPicker` rather than in front of it. It carries `aria-controls`, so the focus restore is proved from the real control at last, and it pairs `rememberWizardOpen()` with `openWizard()`, which nothing in the app did before.
- [x] T037 [US1] Finish by calling `openBackup(serializeDocument(doc))`, the same path `starterPicker` uses. FR-123. Do not write answers into the live document.
- [x] T038 [US1] Inherit the failure handling from `starterPicker`: `setBusy` before the lazy `load()`, and the offline catch that changes nothing and says so.
- [x] T039 [US3] **The seam test, and the one most worth writing.** Open a page with real content, run the wizard halfway, abandon, and assert the page is byte identical. Then run it to completion and assert the same, with the new page opened alongside. FR-125 and Principle V.
- [x] T040 [US3] Abandoning writes nothing to IndexedDB. Assert on the store contents, not on the absence of an error.
- [x] T041 [US1] Run `npm run verify` and commit Phase 5.

---

## Phase 6: The gates

**Goal**: The new surface is actually measured. This project has twice found the
contrast gate green about a surface it never laid out.

- [ ] T042 Extend `app/tests/a11y.test.ts` with the wizard on screen **at every question**, asserting no axe violations, every control named, and no placeholder.
- [ ] T043 [P] Assert in `app/tests/a11y.test.ts` that the focus trap holds and that everything behind the wizard is `inert` while it is open.
- [ ] T043a **FR-132, which nothing else asserts.** Add to `app/tests/a11y.test.ts`: every control on every wizard question meets the 44 by 44 minimum, checked the way the existing touch target assertion checks it. Constitution VI requires CI to fail on this, so driving it by eye in T051 is not the mechanism, only a second opinion.
- [ ] T043b [P] Assert no horizontal overflow with the wizard open at 390px. The contrast gate runs a real browser at that width and is where a layout assertion can mean something.
- [ ] T044 Extend `scripts/contrast.mjs` to open the wizard, count what it drew, and **refuse a pass if it cannot see it**, the way it now counts `folded` and `pages`. Record the before and after element counts in the commit.
- [ ] T045 **Break the contrast guard.** Stop the gate opening the wizard and confirm it refuses to report a pass rather than passing with a smaller number. Quote the refusal.
- [ ] T046 **Break the a11y addition.** Strip an accessible name from a wizard control and confirm the gate fires. Put it back.
- [ ] T047 Run `npm run contrast` in both palettes with the wizard measured, and `npm run verify` whole. Commit Phase 6.

---

## Phase 7: Review, proof and release

- [ ] T048 **One holistic review over the whole feature diff**, by a fresh reviewer. Mandatory: this is six chunks, and per chunk reviews structurally cannot see a seam where both sides are internally correct. Feature 024's holistic review found two high severity defects of exactly that shape. The seams to look at are named in `plan.md`: the answer set to the document, and the wizard's finish to `openBackup`.
- [ ] T049 Fix the review's findings. Auto-apply the mechanical ones, batch any genuine decisions into one question.
- [ ] T050 Confirm the bundled example and all eight starting points still compile byte identically, the way feature 026 proved it: compile against the engine before and after and diff the bytes. It should be trivially true here because no engine code was touched, and it is cheap to prove rather than assert.
- [ ] T051 Drive it in a browser at 390px following `quickstart.md`, including the check that matters most: the store name reaches the **Copy tab**, not just the editor.
- [ ] T052 Drive it on the handset following `quickstart.md` and `docs/WORKFLOW.md`. Check `mWakefulness` immediately before each `screencap`, and set `svc power stayon` back to `false` afterwards.
- [ ] T053 [P] Update `docs/HANDOFF.md` and `specs/README.md`, and the block between the SPECKIT markers in `CLAUDE.md`. That block has now rotted twice; it does not update itself.
- [ ] T054 Release it. Bump `versionCode` and `versionName` **with the Edit tool, never `Set-Content`**, which writes a BOM that kills the Gradle build in a second with no useful message. Verify the APK carries the assets just built and is signed with the right key, then push, tag, and publish the Release with the APK attached, per `CLAUDE.md` rule 3.

---

## Dependencies

```text
Phase 1  setup
   |
Phase 2  examples in the fields [US2]      <- shippable alone, stop here if it is enough
   |
Phase 3  answers to a document [US1]       <- no DOM, all the real decisions
   |
Phase 4  the surface [US1] [US3]
   |
Phase 5  the way in and the way out [US1] [US3]
   |
Phase 6  the gates
   |
Phase 7  holistic review, proof, release
```

Phase 2 depends on nothing but Phase 1 and can be released before Phase 3
starts. Phases 4 and 5 both depend on Phase 3, because the surface has nothing
to hand its answers to until the pure function exists.

## Parallel opportunities

- T006, T007 and T008 touch different form functions in the same file and are
  parallel in effort, though they land in one commit.
- T042 and T043 are independent assertions in the same test file.
- T053 is documentation and runs alongside T050 to T052.

## MVP

**Phase 2 alone is a real release.** It answers the complaint the whole feature
exists for, everywhere in the app, with no new code and no new surface.

Phases 3 through 5 are the wizard, and the MVP of that is US1: somebody answers
questions and gets a page with their words in it. US3, skipping and abandoning,
is not optional polish on top of it: FR-125 and FR-128 protect what already
ships, and shipping the wizard without them would trap people.
