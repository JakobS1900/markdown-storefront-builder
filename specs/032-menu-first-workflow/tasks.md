# Tasks: Menu-first workflow

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md), [quickstart.md](quickstart.md)
**Tests**: Mandatory. Each implementation phase begins with a failing test and records its failing result before production code changes.

## Order and review rule

The three implementation phases are the project chunks. Complete each phase with one fresh implementer, then one fresh spec-compliance reviewer, then one fresh code-quality reviewer. Fix findings before the next phase. After all three, run one holistic review of the whole branch diff. The `Document` schema is unchanged, so no contract chunk or parity snapshot update is needed.

## Phase 1: Safety boundary, User Story 1

**Goal**: A wide public table cannot become a partial Prices section.

**Independent Test**: The audit's Product, Size, Price table remains intact as Text before a mapping exists; the quantity fixture still imports correctly.

- [x] T001 [US1] Add failing pure regressions in `app/tests/page-text.test.ts` for the two-row three-column Markdown, pipe without separator, and comma with Notes tables: requested or automatic Prices conversion must not output `12 oz` as Price or omit `$28` and `$32`. Cover two-column Product/Size and Product/Notes tables, and an unruled Product/Price header; preserve clear two-column item/price lists.
- [x] T002 [US1] Add failing UI/confirmation regressions in `app/tests/page-paste.test.ts` and `app/tests/page-paste-store.test.ts` that check review wording and the saved page for these shapes, including the Copy result.
- [x] T003 [US1] In `app/src/page-text.ts`, identify unsafe wide table conversion and return a safe Text result with a specific reason. Reuse the same result in review and confirmation; do not change the general supplier price-list reader.
- [x] T004 [US1] In `app/src/ui/page-paste.ts` and `app/src/store.ts`, prevent an unmapped wide table from being saved as Prices; keep all original lines in Text and explain what the seller must do.
- [x] T005 [US1] Run the focused regressions and `app/tests/import-quantity-integration.test.ts`; record the red and green results.
- [x] T006 [US1] Get fresh spec-compliance and code-quality reviews of this chunk, then fix findings before Phase 2.

## Phase 2: Direct menu editing, User Story 2

**Goal**: Make a four-item, two-category menu without a wizard, templates, or opening advanced product controls.

**Independent Test**: Follow Task A in `quickstart.md`; Build, Preview, and Copy retain seller content and order.

- [x] T007 [US2] Add failing UI tests in `app/tests/first-sight.test.ts` or a focused new test for a direct blank-page menu action, no example content, and a visible editable category heading.
- [x] T008 [US2] Add failing form tests for adding three products while their names and prices remain directly editable, with existing More details, quantities, row reorder, and remove controls still reachable. Assert focus reaches newly added Category and Item fields and a new category inserts next to its current category.
- [x] T009 [US2] In `app/src/ui/build.ts`, make direct menu creation the primary blank-page action using the existing blank menu block. Keep the wizard and templates available during evaluation. Add a visible Add category action in the menu context that creates another menu block without a section-type choice.
- [x] T010 [US2] In `app/src/ui/forms.ts` and `app/src/styles.css`, make category heading and essential product fields a compact visible list; preserve advanced fields and accessible labels.
- [x] T011 [US2] Verify the four-item acceptance menu through Build, Preview, and Copy in tests and at 320 and 390 CSS pixels in Chrome.
- [x] T012 [US2] Get fresh spec-compliance and code-quality reviews of this chunk, then fix findings before Phase 3.

## Phase 3: Explicit table mapping, User Story 3

**Goal**: The seller reviews and confirms Product, Size, and Price roles for one Markdown table before saving.

**Independent Test**: Follow Tasks B and C in `quickstart.md`, including changed column order, extra Notes, cancel, and source replacement.

- [x] T013 [US3] Add failing pure tests in `app/tests/page-text.test.ts` for consistent table reading, three column roles, exact free-text prices, extra public cells, a row with blank Product and Price but nonempty Size or Notes, repeated headers, a preceding category heading, two supported wide tables under one heading, headerless size-shaped prices, and unsupported table fallback.
- [x] T014 [US3] In `app/src/page-text.ts`, add the narrow pipe-table reader and mapped conversion. Use the same derived rows for review and confirmation; retain unassigned cells in public details.
- [x] T015 [US3] Add failing store tests in `app/tests/page-paste-store.test.ts` for mapping state, source replacement, cancel before Add, frozen confirmation during persistence, pagination index stability, and saving reviewed values rather than rerunning the guess.
- [x] T016 [US3] In `app/src/store.ts`, hold mapping only in the paste draft, validate role indices, clear it on source replacement, and pass it to confirmation.
- [x] T017 [US3] Add failing UI tests in `app/tests/page-paste.test.ts` for labeled role controls, source and proposed rows, corrections before confirmation, an actionable unmapped state, Keep as Text, labels matching the exact saved block, invalid late-row location, a visible confirmation busy state, and reachability of row 100 with its unassigned values.
- [x] T018 [US3] In `app/src/ui/page-paste.ts` and `app/src/styles.css`, render source-to-result review and table role controls. Use normal page scrolling for mapped rows, with bounded pagination. Show category names in collapsed Build cards. Keep controls operable at 320 and 390 CSS pixels without horizontal form scrolling.
- [x] T019 [US3] Extend `app/tests/a11y.test.ts` for the mapping surface and verify keyboard access, focus after role changes and row paging, accessible names, contrast, and touch targets.
- [x] T020 [US3] Run focused tests plus quantity fixture integration; inspect the two-row result in real Chrome Build, Preview, and Copy.
- [x] T021 [US3] Get fresh spec-compliance and code-quality reviews of this chunk, then fix findings.

## Phase 4: Whole-feature validation and seller evaluation

- [x] T022 Run one holistic review over the whole feature diff, focused on review-to-confirm parity, source loss, category and row editing, and interactions with existing quantity imports. Test and fix its blank Price plus Size buyer-output finding.
- [x] T023 Run `npm run verify` in PowerShell and read its full exit status, including browser gates. Do not use `--no-verify` on any hook.
- [x] T024 Capture phone-width screenshots for Tasks A and B and record exact Build, Preview, and Copy results in `docs/research/`.
- [x] T025 Superseded by the owner's 2026-10-05 instruction to use the tablet because testers are unavailable. Four scripted workflows passed; see docs/research/2026-10-05-tablet-workflows.md. No independent seller research or measured usability success is claimed.
- [x] T026 Update `specs/README.md`, `docs/HANDOFF.md`, and release documentation with actual status. Commit without AI attribution. Ship only after T025 and the normal signed APK and device checks.

## Phase 5: Usability iteration from the phone audit

- [x] T027 [US3] Add a failing pure test for mixed comma, colon, and pipe lines that checks clean names and exact price text. Implement line-specific interpretation only where the item-price boundary is clear, preserving original source and consistent table behavior.
- [x] T028 [US3] Add failing UI and store tests for correcting one pasted row's name and price, focused keyboard use, source replacement, Add, Preview, Copy, and cancel. Implement transient reviewed values with a visible row editor and no document write before Add.
- [x] T029 [US2] Add failing first-sight tests for the two primary starts, named secondary paths, and generic section choices reachable without a persistent six-button dock. Implement in Build and phone styles without changing saved documents.
- [x] T030 Get fresh spec and quality reviews for each chunk, fix findings, and run one cross-chunk review of the combined usability diff.
- [x] T031 Run `npm run verify`, repeat the four-item and mixed-paste workflows in real Chrome at 320 and 390 CSS pixels, then check the tablet. Record exact evidence and update the live handoff. Push the review branch. T025 remains the release gate.
