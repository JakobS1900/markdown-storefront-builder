# Tasks: Selling modes

**Feature**: 026-selling-modes
**Date**: 2026-09-08
**Input**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md)

## How to read this

**Test tasks are not optional.** Principle III is test-first and `CLAUDE.md`
routes any logic through a failing test.

**Phase 1 lands alone.** The document contract crosses the engine, the app,
IndexedDB and the saved menu file. Constitution governance and `CLAUDE.md` both
require it to land first and by itself. Nothing from Phase 2 or 3 may be
committed with it.

Three chunks, so a holistic review is at the reviewer's discretion. The seam
worth watching is between the emitter and the golden files: this feature's whole
safety argument is that pages without the fields do not move, and only the
goldens can prove it.

---

## Phase 1: The contract, alone

- [ ] T001 [P] Add `engine/tests/document/fixtures/v4-page.json`, a valid version 4 page with a menu tier carrying `unit`, `quantities`, `imageUrls` and `cost`, so the new fields land among populated neighbours rather than in an empty row.
- [ ] T002 Write the failing migration test at `engine/tests/document/migrate-selling-modes.test.ts`, modelled on `migrate-local-pictures.test.ts`. Assert: a v4 page comes forward to the current version; no tier gains `availability` or `leadTime`, tested with `!("availability" in tier)` because absent and empty must stay distinguishable; every existing field keeps its value; and `migrate(doc, 4)` does not mutate its input.
- [ ] T003 **The assertion this feature turns on.** In the same file, compile the v4 fixture before and after the migration and require BYTE IDENTICAL markdown for every target in `ALL_TARGETS`, with a discriminating guard so the comparison cannot degrade into two empty strings. FR-110, SC-001.
- [ ] T004 In `engine/src/document/descriptor.ts`, add to `MENU_TIER_FIELDS`, positioned immediately after `unit`: `availability` as an optional `enum` with values `in-stock`, `made-to-order`, `preorder`; then `leadTime` as an optional `string`. Bump `SCHEMA_VERSION` to 5. Comment why they sit there (they qualify the offer, which is what `price` and `unit` do, so they belong beside them) and why `sold-out` is absent (research D2).
- [ ] T005 Add `{ from: 4, to: 5, apply }` to `MIGRATIONS` in `engine/src/document/migrate.ts`. It stamps the version and changes nothing else, creating neither field even as an empty string.
- [ ] T006 Regenerate `engine/tests/document/parity.snapshot.json` with `npm run snapshot` and READ the diff. Two added field specs and one changed `schemaVersion`, nothing else.
- [ ] T007 [P] Extend `engine/tests/document/roundtrip.test.ts` with a row carrying both fields.
- [ ] T008 Run `npm run verify` and commit Phase 1 ALONE.

---

## Phase 2: Saying it on the page

- [ ] T009 Write the failing test at `engine/tests/compile/selling-modes.test.ts`: a row marked made to order says so in the output; a preorder says something different; a wait appears with the mode as one statement; a wait with no mode still appears; a row with neither says nothing at all.
- [ ] T010 [P] Add `engine/tests/compile/fixtures/selling-modes.json`, a page mixing rows that use the fields with rows that do not, so the conditional column is exercised in both directions by one fixture.
- [ ] T011 In `engine/src/compile/emit/menu.ts`, add the conditional `Availability` column to `tierTable`, following `withDetails` and `withImages` exactly: present only when some tier in the section has something to say. An empty column on every row is a worse table for everybody who does not use the feature.
- [ ] T012 Add the same statement to `itemBody`, which is shared by `tierBlock` and the no-tables `tierList`, so the per item layout and the fallback cannot drift apart.
- [ ] T013 The words are the app's and the wait is the seller's: emit "In stock", "Made to order", "Preorder", and pass the wait through as typed. A seller who wrote "about 2 weeks" must not find it title cased. Research D4.
- [ ] T014 Everything a seller typed goes through `cell` in a table and `escapeText` in a bullet, the same as every other string they type. FR-114.
- [ ] T015 **Grow the hostile corpus by a case for `leadTime`**, which Principle IV requires of a new user authored field rather than suggests. A newline or a pipe in it must not break a table row.
- [ ] T016 Regenerate golden files with `npm run golden` and read the diff. **Only `selling-modes.md` may appear.** Any movement in a fixture that does not use the new fields is a defect this feature must not ship, and it is the whole reason the column is conditional.
- [ ] T017 **Break the gate.** Make the column unconditional and confirm the goldens for every other fixture move. Revert. That is the proof that "invisible to pages that do not use it" is enforced by something rather than believed.
- [ ] T018 Run `npm run verify` and commit Phase 2.

---

## Phase 3: Setting it in the editor

- [ ] T019 Write the failing test: a blank price row still asks for exactly two things, and the new controls are inside `More details` with the others.
- [ ] T020 Add the two controls to the tier form in `app/src/ui/forms.ts`, inside the `More details` disclosure. **FR-092 from feature 024 forbids growing a blank row past two fields and it did not expire.** A select for the mode and a text field for the wait.
- [ ] T021 The mode must be clearable back to nothing, and clearing must delete the field rather than store an empty value, so a cleared row is indistinguishable from one that never had it. Use the existing `withOptional` helper, which already does exactly this.
- [ ] T022 Label them for what a seller would call them, not for what the app stores. "Made to order" is a phrase a seller uses; `made-to-order` is not.
- [ ] T023 [P] Extend `app/tests/a11y.test.ts` with the new controls: real accessible names, 44 by 44, keyboard operable.
- [ ] T024 Run `npm run verify` including `npm run contrast` in both palettes, and commit Phase 3.

---

## Phase 4: Proof and release

- [ ] T025 Confirm the bundled example and all eight starting points still compile byte identically. They are the pages most like a seller's real one, and none of them uses these fields.
- [ ] T026 Drive the app: set a mode and a wait, look at the Preview and the Copy tab, and save a menu file with them in it.
- [ ] T027 [P] Update `docs/HANDOFF.md` and `specs/README.md`.
- [ ] T028 Release it. Bump the version with the Edit tool, never `Set-Content`, which writes a BOM that fails the Gradle build in one second with no useful message. Tag and publish with the signed APK, per `CLAUDE.md` rule 3.

---

## Dependencies

```text
Phase 1  the contract, ALONE
   |
Phase 2  the output, and the goldens that prove nothing else moved
   |
Phase 3  the controls
   |
Phase 4  proof and release
```

## MVP

Phases 1 and 2. At that point a seller can mark an item made to order by editing
a backup file, which is not a product, but the contract and the output are real
and the wizard has something to write into. Phase 3 is what makes it usable, and
stopping before it would be shipping a field nobody can reach.
