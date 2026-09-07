# Tasks: The pages sidebar

**Feature**: 025-pages-sidebar
**Date**: 2026-09-07
**Input**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md)

## How to read this

**Test tasks are not optional.** Constitution Principle III is test-first, and
`CLAUDE.md` routes any logic through a failing test. Every implementation task
below is preceded by the test that fails without it.

Three chunks, so a holistic review is at the reviewer's discretion rather than
mandatory. Run one anyway if chunk 2 turns out to be larger than it looks: the
accessibility work is the part the platform would normally have done.

`[P]` means parallelisable: different files, no dependency on an incomplete task.

---

## Phase 1: Foundational

Blocks both user stories. Ends in its own commit.

- [ ] T001 Write the failing test in `app/tests/pages-sidebar.test.ts` for open and closed state: `sidebarOpen` defaults to closed, opening sets it, closing clears it, and each notifies subscribers synchronously so the panel is on screen at once rather than after the deferred repaint.
- [ ] T002 Add `sidebarOpen: boolean` to `State` in `app/src/store.ts`, with `openSidebar()` and `closeSidebar()`. Use the immediate `set`, not `setQuietly`, for the reason `setBusy` does: a panel that appears 200ms after the tap reads as a second tap being needed.
- [ ] T003 Make the system back gesture close the drawer before it leaves the surface, in `app/src/surface-history.ts`. Read that module first: it exists because back used to close the app from every screen, and the fix must not undo that.
- [ ] T004 Run `npm run verify` and commit Phase 1.

---

## Phase 2: US1 and US2, reaching your pages from anywhere (Priority P1)

**Goal**: One control in one place, on every surface, that shows every page and
opens the one chosen.

**Independent test**: With three saved pages, open the list from Build, Preview
and Copy in turn, choose a different page, and confirm it opens.

- [ ] T005 [US1] Write the failing test for the list itself: every saved page appears newest first, the open page is marked as current and is not offered as a destination, and choosing another calls through to `openPage`.
- [ ] T006 [US1] Create `app/src/ui/pages-sidebar.ts` with one function that builds the list of pages. It takes the pages and the current page id and returns nodes. It does not know whether it is in a drawer or a column, which is what lets one list serve both.
- [ ] T007 [US1] Report that a page is opening, reusing `setBusy` and `clearBusy` from `app/src/store.ts` rather than a second mechanism. FR-104. The message names the page.
- [ ] T008 [US2] Add the trigger to `app/src/ui/shell.ts`, in `header.bar`, so it is in the same place on all three surfaces. It needs a real accessible name, `aria-expanded`, and `aria-controls` pointing at the panel.
- [ ] T009 [US2] Decide the container in `shell.ts` using the existing `roomForBoth()`: a drawer below 900 pixels, a plain column beside the editor at or above it. **Reuse `roomForBoth` and `watchWidth`; do not add a second breakpoint.** Above the breakpoint the panel is always present and the trigger is not rendered at all.
- [ ] T010 [US2] **Build the drawer only when it is open.** A closed drawer must add nothing to the DOM and nothing to a repaint, which is the same rule that keeps the preview pane off the phone. SC-014.

### The accessibility work, which the platform would have done for us

Research D1: jsdom implements no `showModal`, so this is ours. Each of these
needs its own failing test first, and they are the reason this chunk is bigger
than it looks.

- [ ] T011 [US2] Move focus into the panel when it opens, and back to the trigger when it closes. FR-099, SC-011.
- [ ] T012 [US2] Contain focus while the drawer is open: tab from the last control returns to the first, and shift tab from the first goes to the last.
- [ ] T013 [US2] Make the content behind the drawer unreachable, by keyboard and by assistive technology, and reachable again when it closes.
- [ ] T014 [US2] Close on escape. FR-100.
- [ ] T015 [P] [US2] Close on a tap outside the panel, and confirm that tap does not also reach whatever was behind it.
- [ ] T016 [US2] Style the drawer, the backdrop and the pinned column in `app/src/styles.css`. **Transform the panel only.** Nothing containing `.tabs` may be transformed, and `transform: none` in a `to` keyframe does not count as untransformed. Research D2.
- [ ] T017 [US2] **Assert `#app` carries no transform**, as a test rather than a comment, because this bug shipped once and the next thing added to `#app` can reintroduce it.
- [ ] T018 [P] [US2] Extend `app/tests/a11y.test.ts` with the drawer open. It is a state the gate has never seen, and it is the state where the interface is at its most unusual.
- [ ] T019 [US1] Run `npm run verify` including `npm run contrast` in both palettes, and commit Phase 2.

---

## Phase 3: US3, managing pages from the same place (Priority P2)

**Goal**: Starting and removing pages happens where the pages are.

**Independent test**: Start a new page and remove a different one, without
visiting the Build surface.

- [ ] T020 [US3] Write the failing test: starting a new page and starting from a template are reachable from the panel, and the page currently open offers no remove control at all.
- [ ] T021 [US3] Move "Start a new page" and the template picker into `pages-sidebar.ts`. What the new page button DOES is feature 027's business; this only moves the door.
- [ ] T022 [US3] Move removal in, keeping the confirmation exactly as it is: it names the page in the question and in both answers, and the answer that keeps the page is the prominent one. Do not redesign it while moving it.
- [ ] T023 [US3] Enforce FR-103: the open page cannot be removed. Today it can, and doing so removes the document under the editor.
- [ ] T024 [US3] **Delete the old list from `app/src/ui/build.ts`.** FR-106. This is the task the feature is really for, and the one most easily left undone: a sidebar beside an unchanged Build surface is two places to remove a page from.
- [ ] T025 [P] [US3] Check nothing else references the removed list, including `app/tests/page-list.test.ts` and `page-lifecycle.test.ts`, and move rather than delete what those cover.
- [ ] T026 [US3] Run `npm run verify` and commit Phase 3.

---

## Phase 4: Polish and proof

- [ ] T027 **Break the focus containment on purpose** and confirm the tests catch it. A trap nobody has escaped from is a trap nobody has tested, and this one is hand written precisely because the platform's version could not be tested at all.
- [ ] T028 **Measure typing on the reference handset**, SC-014. The pinned panel is rebuilt on every repaint above 900 pixels and the drawer must cost nothing when closed. A rebuild measured 37ms on a Moto G7 and two per character dropped input outright, so this is the number that matters.
- [ ] T029 Drive the app on the device: open the drawer on all three surfaces, switch pages, use the back gesture, and open it with the keyboard up. `docs/HANDOFF.md` has the checklist, including checking `mWakefulness` immediately before each capture and passing `-s` when an emulator is also attached.
- [ ] T030 [P] Update `docs/HANDOFF.md` with what was verified live and what was deferred.
- [ ] T031 [P] Update `specs/README.md` with 025 and the documents it actually has.
- [ ] T032 Release it. Bump the version, tag, and publish with the signed APK. `CLAUDE.md` rule 3: this is ordinary work now and does not need asking. Use the Edit tool for the version, never `Set-Content`, which writes a BOM that fails the Gradle build in one second with no useful message.

---

## Dependencies

```text
Phase 1  state, and the back gesture
   |
Phase 2  the panel, both containers, and the accessibility work
   |
Phase 3  moving management in, and DELETING the old list
   |
Phase 4  break the trap, measure the handset, ship
```

Phase 3 is what makes this a move rather than an addition. Stopping after
Phase 2 leaves the product worse than before it started, with two page lists.

## Parallel opportunities

T015 and T018 are independent of the focus work around them. T025, T030 and
T031 touch different files.

## MVP

Phases 1 and 2. That is the request: reach your pages from anywhere and open
one. It is shippable, but see the note above about not stopping at it.
