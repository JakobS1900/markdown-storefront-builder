# Tasks: Adjust imported prices

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/review.md](contracts/review.md), [quickstart.md](quickstart.md)
**Tests**: Mandatory failing test before each behavior change. Existing `Document` JSON schema is unchanged.

## Order and review rule

Complete the foundation first as its own commit. Each later phase is one implementation chunk. Use one fresh implementer, then fresh spec and code-quality reviewers per chunk. Fix findings before the next chunk. After all chunks, run one holistic review of the combined diff. Keep review carry-forwards in `CHUNK N:` code comments until resolved.

## Phase 1: Foundation, shared source-to-result contract

**Goal**: One pure reviewed result is the source of both the visible review and confirmation, with stable source-row identities.

**Independent Test**: A mapped three-column table exposes source line and field values; building it twice yields the same ordered blocks and issues. The existing `Document` name, type and order parity test remains unchanged.

- [x] T001 Add failing source-key, exact line-coverage, block-order and review-to-confirm parity tests in `app/tests/page-paste-review.test.ts`, including a retained note between offers, a line beyond row 20 and a section beyond 100.
- [x] T002 Implement the minimal draft-only row and result types plus pure builder and consumed/retained source partition in `app/src/page-paste-review.ts`; use current parser and block builders without changing `engine/src/document/descriptor.ts`.
- [x] T003 Route the current review count and `confirmPagePaste` through the shared result in `app/src/ui/page-paste.ts` and `app/src/store.ts`; bind the draft to its starting page ID and target, check before write, lock competing page switches during confirmation, and preserve the existing `openBackup` validation path.
- [x] T004 Run focused parser, store, quantity integration and document parity tests; get fresh spec and quality reviews of the foundation, fix findings, then commit it alone.

## Phase 2: User Story 1, correct imported fields

**Goal**: Correct the reviewed item name, amount, price and details before adding a page.

**Independent Test**: Map a fictional Amount, Price, Item table, edit one row, and see the exact corrected values in review, saved Build, Preview and Copy.

- [x] T005 [US1] Add failing tests for all six Item, Amount and Price column orders, extra columns, repeated headers, `$0`, `from $25`, `Ask me`, blank name, blank price, and numeric name in `app/tests/page-paste-review.test.ts`.
- [x] T006 [US1] Add failing draft lifecycle and frozen confirmation tests for row edits, exclusion and exact price text in `app/tests/page-paste-store.test.ts`.
- [x] T007 [US1] Implement row edits keyed by source identity, inclusion, field validation and accepted numeric names in `app/src/page-paste-review.ts` and `app/src/store.ts`; once a correction exists, disable direct source editing until buffered replacement arrives in T021.
- [x] T008 [US1] Add failing UI tests for `Adjust imported prices`, visible source, labelled Item, Amount, Price and Details fields, per-row exclusion, issue messages and focus in `app/tests/page-paste.test.ts`.
- [x] T009 [US1] Render bounded correction cards and a separate `Adjust as prices` manual path from ambiguous Text lines in `app/src/ui/page-paste.ts` and `app/src/styles.css`; limit total visible cards across all sections to 20, collapse inactive sections, and keep header furniture and unassigned source as Text until explicitly handled.
- [x] T010 [US1] Verify Task A in `specs/030-adjust-imported-prices/quickstart.md`, then get fresh spec and quality reviews of the phase and fix findings. Browser evidence is in `docs/research/2026-10-01-import-correction-phase2-check.md`.

## Phase 3: User Story 2, shared names and categories

**Goal**: Reconnect amount-price rows to a name and a Prices category while keeping source order and unassigned text.

**Independent Test**: Two fictional categories and four items retain every chosen name, amount and price after moving one row to a new category and adding the page.

- [x] T011 [US2] Add failing pure tests for detached names, shared names on selected rows, duplicate visible category names, notes between offers, a move across a retained note and another heading, and quantity grouping in `app/tests/page-paste-review.test.ts`.
- [x] T012 [US2] Implement draft destination IDs, category names, row moves and stable source ordering in `app/src/page-paste-review.ts` and `app/src/store.ts`.
- [x] T013 [US2] Group compatible same-name amount-price offers into existing `quantities`; use `unit` on standalone offers and separate tiers when row details differ in `app/src/page-paste-review.ts`.
- [x] T014 [US2] Add failing UI tests for assigning a shared item name and moving selected rows to existing or new categories in `app/tests/page-paste.test.ts`.
- [x] T015 [US2] Add category and multi-row controls to the correction panel in `app/src/ui/page-paste.ts` and `app/src/styles.css`, keeping source text and destination visible at 320 CSS pixels.
- [x] T016 [US2] Add a saved Build, Preview and Copy acceptance test for Task B in `app/tests/page-paste-store.test.ts` and `app/tests/import-quantity-integration.test.ts`.
- [x] T017 [US2] Get fresh spec and quality reviews of the phase, run focused tests, and fix findings. All 101 focused tests and independent closure reviews passed.

## Phase 4: User Story 3, recover safely

**Goal**: Corrections remain reachable, reversible and local to the draft.

**Independent Test**: Correct a late row, cancel a source replacement, undo a mapping change, then cancel import; the saved page remains unchanged and the draft retains its exact values until cancelled.

- [x] T018 [US3] Add failing store tests for remap warning, one-step undo, buffered source replacement cancel, page-switch pause and return, competing switch during confirmation, and failed save in `app/tests/page-paste-store.test.ts`.
- [x] T019 [US3] Implement a deliberate discard choice, mapping snapshot and undo in `app/src/store.ts`; keep corrected row identity across mapping and both pagers, and regression-check the foundation's page-switch lock.
- [x] T020 [US3] Add failing UI tests for section 101, table row 21, a many-table fixture with at most 20 visible correction cards, Edit source cancel, pasted/file/IME replacement, missing-name block, numeric-name acceptance and empty-section recovery in `app/tests/page-paste.test.ts`. Include a headed category whose every offer moved away: give the original heading an explicit keep or remove choice before Add.
- [x] T021 [US3] Implement buffered Edit source and file replacement, recovery controls and focus restoration in `app/src/ui/page-paste.ts` and responsive styling in `app/src/styles.css`.
- [x] T022 [US3] Extend `app/tests/a11y.test.ts` for visible names, keyboard operation and touch targets on the correction panel; test the failure path before fixing it.
- [x] T023 [US3] Get fresh spec and quality reviews of the phase, run focused tests, and fix findings. Both reviews passed after four findings were fixed. The final focused run passed 163 tests; the full `npm run verify` passed with 1,845 tests in 90 files and 64 accessibility tests.

## Phase 5A: User Story 4, source-use contract

**Goal**: Give one exact detached source line a deliberate reviewed role without changing the saved document schema.

**Independent Test**: Choosing a standalone name and preceding heading for two table rows gives each source line one coverage outcome and the same ordered blocks in review and confirmation. Undo or removal of all linked offers restores the source line.

- [x] T024 [US4] Add failing exact-line source-use, undo, coverage and review-to-confirm parity tests in `app/tests/page-paste-review.test.ts` and `app/tests/page-paste-store.test.ts`, including a matching typed value without a choice, a retained note, row exclusion and a later name or destination edit.
- [x] T025 [US4] Implement the minimal draft-only source-use choice, exact preceding-line candidates, and pure reviewed-output behavior in `app/src/page-paste-review.ts` and `app/src/store.ts`. Merge adjacent same-category menus only across used lines, retaining notes in order. Keep `Document` name, type and order unchanged. Fresh spec and quality reviews passed. The isolated contract was pushed as `d85c24e`. Full `npm run verify` exited 0 with 1,863 tests in 90 files, 64 accessibility tests and clean browser gates.

## Phase 5B: User Story 4, use detached source in the panel

**Goal**: Let the seller choose the nearby name and heading in the correction panel and publish each once.

**Independent Test**: Two categories and four detached names become four items with eight amount-price pairs in Build, Preview and Copy, without duplicate standalone Heading or Text sections.

- [ ] T026 [US4] Add failing UI tests for source-identified name and category choices that act on all included table rows without prior selection, selected-row exceptions, keep-as-Text behavior, undo, keyboard focus and pagination in `app/tests/page-paste.test.ts` and `app/tests/a11y.test.ts`.
- [ ] T027 [US4] Add the minimum source-use controls in `app/src/ui/page-paste.ts` and responsive styling in `app/src/styles.css`. State the number of affected rows and show the exact source row and resulting category or name before Add; keep a visible choice to retain ambiguous source as Text or Heading.
- [ ] T028 [US4] Add saved Build, Preview and Copy acceptance for Task D in `app/tests/import-quantity-integration.test.ts`. Run real Chrome Task D at 320 and 390 CSS pixels and record the observed output in `docs/research/`.
- [ ] T029 [US4] Get fresh spec and quality reviews of the panel chunk, run focused tests and fix findings.

## Phase 6: Whole-feature verification and delivery

- [ ] T030 Run one holistic review of the full `030-adjust-imported-prices` diff for source loss, category placement, grouping, review-to-confirm parity and preservation of existing pages. Fix findings with regressions.
- [ ] T031 Run `npm run verify` in PowerShell and read its full exit status. Check the quantity fixture, all six column permutations, real Chrome Tasks A, B, C and D at 320 and 390 CSS pixels, and the Android 6 tablet with an updated signed APK. Record exact evidence in `docs/research/`.
- [ ] T032 Update `docs/HANDOFF.md`, `specs/README.md` and this task list with actual status. Commit without AI attribution, push the branch and update the draft PR against `032-menu-first-workflow`.
- [ ] T033 Keep the stacked PR draft until feature 032's five real seller sessions and this panel's seller observation have been reviewed. Do not publish a normal release from a solo test.

## Dependencies and parallel work

T001 through T004 precede every user story because all consumers need the same reviewed-output contract. User Story 1 provides editable fields for User Story 2. User Story 3 relies on both. User Story 4 follows recovery because source-use choices must participate in undo and source replacement. Its source-use contract lands alone before the UI. Independent test fixtures for the six column orders and two-category menu can be written in parallel before their implementation chunks. UI and store changes within a chunk must be reviewed together because they share focus and draft state.

## Delivery strategy

The first useful increment is User Story 1 on recognized tables, with ambiguous source retained as Text and an explicit manual row path. Subsequent chunks add cross-section grouping, recovery and explicit use of detached source without adding a second import entry point or changing already saved pages.
