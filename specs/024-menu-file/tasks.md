# Tasks: The menu file

**Feature**: 024-menu-file
**Date**: 2026-09-06
**Input**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/menu-file.md](./contracts/menu-file.md), [quickstart.md](./quickstart.md)

## How to read this

**Test tasks are not optional here.** The Speckit template treats them as
opt-in. Constitution Principle III makes test-first non-negotiable in this
repository, and `CLAUDE.md` routes any logic through a failing test first, so
every implementation task below is preceded by the test that fails without it.

**Phases map to chunks.** `CLAUDE.md` requires one fresh implementer subagent
per chunk, then a fresh spec-compliance reviewer, then a fresh code-quality
reviewer. Do not dispatch one subagent per task. Chunk boundaries are marked and
each ends in its own commit.

**Phase 2A lands alone.** The document contract crosses the engine, the app,
IndexedDB and the saved file. Constitution governance and `CLAUDE.md` both
require it to land first and by itself, guarded by the parity test. Nothing from
any later phase may be committed with it.

`[P]` means parallelisable: different files, no dependency on an incomplete
task.

---

## Phase 1: Setup

- [x] T001 Establish the baseline by running `npm run verify` from PowerShell, whole and unpiped, and quote the result. Done on 2026-09-06 at `965fc5b`: 64 files, 1092 tests, a11y 34, contrast 0 failures in both palettes, PWA gate clean, exit code 0. Recorded in `docs/HANDOFF.md`.
- [x] T002 Correct `docs/HANDOFF.md`, which described `4d26e5f` and v0.4.0 while HEAD was `965fc5b` and v0.6.0. Committed as `5d3288c`.

---

## Phase 2: Foundational

### Phase 2A: The contract, alone (Chunk 0)

**Ends in its own commit containing nothing else.**

- [x] T003 [P] Add a version 3 fixture at `engine/tests/document/fixtures/v3-page.json` carrying a menu tier with `imageUrls` and `cost`, a gallery item, and a profile with `avatarUrl`, so the migration has something with every neighbouring field to preserve.
- [x] T004 Write the failing migration test at `engine/tests/document/migrate-local-pictures.test.ts`: a version 3 page comes forward to the current version, gains none of `localImageIds`, `localImageId` or `localAvatarId`, keeps every field it had, and is not mutated in place. Mirror the structure of `engine/tests/document/migrate-tier-ids.test.ts`, including its direct `migrate` import and its absent-is-not-empty assertion.
- [x] T005 Add `localImageIds` (stringArray, optional) after `imageUrls` in `MENU_TIER_FIELDS`, `localImageId` (string, optional) after `imageUrl` in `GALLERY_ITEM_FIELDS`, and `localAvatarId` (string, optional) after `avatarUrl` in `BLOCK_FIELDS.profile`, in `engine/src/document/descriptor.ts`. Bump `SCHEMA_VERSION` to 4. Comment each field with why it is an identifier and not an address, citing the `cost` precedent.
- [x] T006 Add `{ from: 3, to: 4, apply }` to `MIGRATIONS` in `engine/src/document/migrate.ts`. The step sets `schemaVersion` to 4 and changes nothing else. It must not create any new field, even empty.
- [x] T007 Regenerate `engine/tests/document/parity.snapshot.json` with `npm run snapshot` and read the diff. Three added field specs and one changed `schemaVersion`, nothing else, is what correct looks like. Do not accept a diff you have not read.
- [x] T008 [P] Extend `engine/tests/document/roundtrip.test.ts` with a page carrying all three new fields, asserting a lossless round trip.
- [x] T008a Assert in `engine/tests/document/migrate-local-pictures.test.ts` that the version 3 fixture compiles to **byte identical output for every paste host** before and after the migration. Reachable because `compile` does not re-validate, so the raw version 3 object compiles exactly as it sits on disk. The emptiness guard is inside the per-target case, not beside it: a reviewer found it covering only the first target, which is the failure it exists to prevent. SC-008 promises no seller's published page changes under them, and T004 only covers the fields surviving. Nothing today would catch a migration that preserved every field and still moved a byte of output.
- [x] T009 Run `npm run verify` from PowerShell and commit Phase 2A alone. `version.test.ts` also had to learn the third migration step: it hard-codes the chain, which is the guard doing its job rather than a test bent to fit. The eight starter documents and four test fixtures are deliberately LEFT at version 3, so they exercise the migration path on every load. Do not "fix" that without a reason.

### Phase 2B: The host, the capability and the refusal (Chunk 1)

Blocks both US1 and US2. Ends in its own commit.

- [x] T010 Write the failing sentinel at `engine/tests/compile/local-image-never-published.test.ts`. It must be discriminating, not merely absent-asserting: a local picture appears in `MENU_FILE` output AND appears in no `TARGETS` output. A test that only checks absence would pass on an empty document, which is the failure mode FR-054c already produced once in this repository.
- [x] T011 Add `localImages: boolean` to `Capabilities` in `engine/src/compile/capabilities.ts`, with the comment stating its fallback, since that file requires a capability to have a consumer and a fallback test before it may exist.
- [x] T012 Add `localImages` and its citation to `PORTABLE`, `RENTRY` and `TEXT_IS` in `engine/src/compile/targets.ts`. All three are `false`. `sources` is `Record<keyof Capabilities, string>` with no optional keys, so this is the type system enforcing FR-014 rather than a chore.
- [x] T013 Add the `MENU_FILE` target to `engine/src/compile/targets.ts` with `localImages: true` and `tables: true`. Deliberately leave it OUT of the `TARGETS` array, and comment why: `TARGETS` feeds `findTarget` and the host picker, and a menu file listed among places to paste your page would be a lie.
- [x] T013a Add `ALL_TARGETS = [...TARGETS, MENU_FILE]` to `engine/src/compile/targets.ts` and export it from `engine/src/compile/index.ts`. **This is the fix for the worst thing the analysis pass found.** Seven engine test files iterate `TARGETS` to assert something across every target, so a target outside that array is silently outside all seven, and every one of them stays green while covering nothing. Comment the two arrays so choosing between them is a visible decision: `TARGETS` means "places a seller pastes a page", `ALL_TARGETS` means "everything the compiler can emit". `findTarget` keeps searching `TARGETS` only.
- [x] T013b **The array alone was not enough.** Six of these sweeps called `compile(doc, target.id)`, and `findTarget` searches `TARGETS` only, so `menu-file` would have gone down the unknown host path and compiled as `portable` in silence. Every file under `golden/menu-file/` would have been a copy of the portable output and the golden test would have agreed with it forever. `scripts/write-golden.mjs` had the same bug. They all pass the target record now. Move the cross-target sweeps in `engine/tests/compile/golden.test.ts`, `determinism.test.ts`, `performance.test.ts`, `compile.test.ts`, `holistic.test.ts` and `holistic-003.test.ts` from `TARGETS` to `ALL_TARGETS`, and read what each one starts asserting. Do not do this mechanically: `textis.test.ts` is about one host and must keep naming it.
- [x] T014 Add `local_image_unsupported` to the diagnostic code union in `engine/src/compile/diagnostics.ts`.
- [x] T015 In `engine/src/compile/emit/menu.ts`, emit local pictures as `mdsb-asset:<id>` when `capabilities.localImages`, and otherwise drop them and raise `local_image_unsupported` naming the item. Follow the existing refused-address pattern at `menu.ts:49-61`, which holistic review HB-6 settled must never drop an address in silence.
- [x] T016 [P] Apply the same rule to gallery items in `engine/src/compile/emit/gallery.ts`.
- [x] T017 [P] Apply the same rule to the profile avatar in `engine/src/compile/emit/profile.ts`.
- [x] T018 Assert in `engine/tests/compile/local-image-never-published.test.ts` that no diagnostic message contains an asset id or a filename (FR-081). The wording rule that satisfies FR-080 and FR-081 at once: **name the item or section the picture belongs to, never the picture.**, mirroring the check `cost-never-published.test.ts` makes for the same reason: a warning is somewhere a seller might screenshot.
- [x] T019 Move `engine/tests/compile/cost-never-published.test.ts` from `TARGETS` to `ALL_TARGETS`. A cost must never publish anywhere, including into the one output that carries embedded pictures.
- [x] T020 Add a golden fixture directory `engine/tests/compile/golden/menu-file/` and regenerate with `npm run golden`, showing the diff in the commit as Principle III requires of any output-altering change. Note the harness keys directories by target id and is driven by the array T013b changes, so it produces nothing for this target until that lands.
- [x] T020a [P] Add a fixture under `engine/tests/compile/fixtures/` carrying a local picture on a tier, a gallery item and a profile avatar, so the golden files actually exercise all three emitters rather than only the menu.
- [x] T021 **Break the gate.** Done twice and independently. The implementer broke all three emitters at once; the reviewer then broke each of menu, gallery and profile separately and confirmed the sentinel fails for the paste targets while the `MENU_FILE` half stays green, then broke the presence half and watched that fail too. `picture_superseded` was broken the same way afterwards.
- [x] T021a **`picture_superseded`, found in review.** Gallery and profile silently dropped a web address picture when a local one was present. The comment defending it said the web address still shows on every paste host so nothing is lost, which is false for the seller who only ever sends the menu file. HB-6 applied to a case it did not anticipate.
- [x] T022 Run `npm run verify` and commit Phase 2B. **Stage before believing the secret scan**: it counts tracked files only, so an unstaged run scans none of the new ones. 389 files unstaged against 404 staged.

---

## Phase 3: US1, save a menu and send it (Priority P1)

**Goal**: A seller saves one self contained file that opens offline and looks
like their menu.

**Independent test**: Build a page, save the menu file, open it with networking
disabled, confirm styling and reflow. Delivers value without any of US2.

- [ ] T023 [US1] Write failing tests at `app/tests/menu-file.test.ts` for the produced file: it contains the page's headings and price table, it carries its own styling, it references nothing external, and it contains no `<script>` and no event handler attribute.
- [ ] T024 [US1] Create `app/src/menu-file.ts` producing the file: `compile(doc, MENU_FILE)`, then `renderMarkdown()`, then serialize the tree, then wrap in a document shell with the stylesheet inlined. Nothing is ever assigned to `innerHTML`.
- [ ] T025 [US1] Inline the subset of `app/src/styles.css` the rendered document actually uses, including both palettes so the file respects the reader's own light or dark setting. The file must not link a stylesheet.
- [ ] T026 [US1] Fetch and inline pictures held at web addresses, best effort, in `app/src/menu-file.ts`. A website that refuses the read leaves that picture as a web address, the file is still produced, and the seller is told which picture by name. FR-076. Silently producing a file with a hole in it is the defect.
- [ ] T027 [US1] Add the save control and the size report to `app/src/ui/export.ts`, reusing `handOff(name, text, "text/html")` from `app/src/files.ts`. Always compile `MENU_FILE` regardless of the selected host, exactly as the existing `.md` button always compiles `PORTABLE`. FR-074, FR-077.
- [ ] T028 [US1] Offer a preview of the menu file itself in `app/src/ui/preview.ts`, so what the seller sees is what they save. Principle VII.
- [ ] T029 [US1] **Extend the hostile text corpus through the export sink** in `app/tests/menu-file-hostile.test.ts`, producing files and inspecting them rather than inspecting the code that makes them. Principle IV requires the corpus to grow for a new user authored path, and SC-003 is the criterion. This task settles the disagreement recorded in the plan's Complexity Tracking.
- [ ] T030 [US1] **Break the gate.** Make the serializer in `app/src/menu-file.ts` write one seller field as markup rather than text and confirm the corpus test catches it. Revert. Quote the failure. If it cannot be made to pass at all, the exploration agent was right, and the export needs its own emitter instead of reusing the preview renderer.
- [ ] T031 [P] [US1] Assert in `app/tests/menu-file.test.ts` that the saved file contains no occurrence of `mdsb-asset:`, per `specs/024-menu-file/contracts/menu-file.md`.
- [ ] T032 [P] [US1] Add a11y coverage for the new control in `app/tests/a11y.test.ts`: 44 by 44 minimum, a real accessible name, keyboard operable.
- [ ] T032a [US1] **Measure the saved file at 390px in headless Chrome**, in a script beside `scripts/contrast.mjs`, and fail on sideways page scroll. FR-073 and SC-007 are otherwise asserted by nobody: T025 inlines the stylesheet and nothing checks the result. This is the same gap `e0f345b` had to close for the preview table, where a min-width floor on cells gave every column exactly the floor and a floor on the table set the whole page scrolling. jsdom lays nothing out, so this cannot live in the jsdom suite.
- [ ] T032b [P] [US1] Run axe over the produced file in the same script, covering what the contract promises about it: real headings, a real table, and alt text carried through from compiled output. Principle VI applies to the file, which other people open, and not only to the app. The app's own a11y gate cannot see the file at all.
- [ ] T033 [US1] Run `npm run verify` including `npm run contrast` in both palettes, and commit Phase 3.

---

## Phase 4: US2, use a picture from this device (Priority P2)

**Goal**: A seller adds a picture from their own device, it appears in the menu
file, and it can never reach a paste host.

**Independent test**: Add a local picture, save the menu file, open it with no
connection and see the picture. Then select a paste host and confirm the picture
is absent and a warning names it.

### The store

- [ ] T034 [US2] Write failing tests at `app/tests/assets.test.ts` against `fake-indexeddb` for storing, reading, totalling and removing a picture, and for a database upgrade from version 1 that preserves every existing page.
- [ ] T035 [US2] Take `DB_VERSION` to 2 in `app/src/db.ts` and add the `assets` object store keyed by `id`. Do not disturb `pages`, including its deliberate storage of `json` as text for FR-018 recovery.
- [ ] T036 [US2] Create `app/src/assets.ts` owning store, read, total and remove. Reuse `normalise()` from `app/src/upload.ts` rather than copying it: it already downscales to a 1600px edge at 0.85 and discards EXIF as a side effect, which is how FR-083 is satisfied with no new code.
- [ ] T036a [US2] Assert in `app/tests/assets.test.ts` that a stored picture carries **no EXIF block**, by storing a JPEG that has one and checking it is gone. FR-083 is otherwise satisfied by a side effect of `normalise()` and asserted nowhere, which is one refactor away from silently losing a privacy property. This repository's own lesson is that twenty one tests covered a panel and every one missed that it displayed nothing.
- [ ] T037 [US2] Restrict stored types in `app/src/assets.ts` to `image/png`, `image/jpeg`, `image/webp` and `image/gif` at storage time. Refuse `image/svg+xml` and comment why: the saved file is opened by other people in contexts we do not control, and Principle IV says allow list.

### Not losing the seller's work

- [ ] T038 [US2] Call `navigator.storage.estimate()` before accepting a picture in `app/src/assets.ts` and refuse with a message naming what is in use and what to do. FR-084. A generic failure message is a defect under Principle V.
- [ ] T039 [US2] Add a `QuotaExceededError` branch to the save path in `app/src/store.ts`, distinct from the generic catch at `store.ts:836-843`. It names what failed and states that the page is not lost. FR-085.
- [ ] T040 [P] [US2] Request `navigator.storage.persist()` once during init in `app/src/store.ts`, and carry on normally when it is refused. FR-086.
- [ ] T041 [US2] Handle a document referencing an asset that is gone, in `app/src/menu-file.ts` and `app/src/ui/image-field.ts`: the page still opens, the menu file is still produced, and the missing picture is reported by name rather than rendering broken. FR-088.
- [ ] T042 [US2] **Break the gate.** Stub the quota in `app/tests/assets.test.ts` to force refusal and read the message the seller actually gets. A raw `QuotaExceededError` string reaching them means the branch is not wired. Quote both messages.

### The interface

- [ ] T043 [US2] Add an "Add from this device" control to `app/src/ui/image-field.ts`, beside the address field, so all three of its call sites in `app/src/ui/forms.ts` behave identically. FR-078.
- [ ] T044 [US2] Write the copy in `app/src/ui/image-field.ts` that tells the seller where the picture will and will not appear BEFORE they choose one. FR-082. This is half the lock; the warning in preview is the other half.
- [ ] T045 [P] [US2] Create `app/src/ui/storage.ts`: what each picture costs and a way to remove chosen ones. Nothing removes anything automatically, for any reason including reclaiming space. FR-087, research D6.
- [ ] T046 [US2] Resolve `mdsb-asset:` images in `app/src/menu-file.ts` by setting `img.src` on the built DOM before serializing. Bytes never pass through either address check. **Do not decode the address with `decodeURIComponent`.** The emitters encode it with `encodeAddress`, which is not a subset of `encodeURIComponent` and is not inverted by it: a literal `%` in an identifier passes through unencoded and would decode to the wrong id, and a malformed sequence throws `URIError` and takes out the whole export. See the encoding section of `specs/024-menu-file/contracts/menu-file.md`, and the `CHUNK 1:` comments at the three emit sites.
- [ ] T046a [P] [US2] Move the cost sentinel in `app/tests/starters.test.ts:113` from `TARGETS` to `ALL_TARGETS`. It makes the same claim as `cost-never-published.test.ts`, which moved in Phase 2B, so the two currently disagree about whether the menu file counts. Found by the Chunk 1 review; left out of that chunk because it is an app file and the chunk was engine only.
- [ ] T047 [US2] Add a narrow, explicit allowance for `mdsb-asset:` to `safeAddress` in `app/src/ui/render-markdown.ts`, preserving the deliberate duplication with the engine's `isSafeUrl`. That coupling was broken once and produced seven live `javascript:` addresses.
- [ ] T048 [P] [US2] Add a11y coverage for the new controls in `app/tests/a11y.test.ts`.
- [ ] T049 [US2] Run `npm run verify` and `npm run contrast`, and commit Phase 4.

---

## Phase 5: US3, find the price breakdown (Priority P3)

**Goal**: A seller can find the control that produces the layout they asked for.

**Independent test**: Show the price row form to somebody who has not used the
app and ask where they would enter "1 lb for 7, 5 lb for 30".

- [ ] T050 [US3] Relabel `Bulk pricing` and rewrite its hint in `app/src/ui/forms.ts:493-519` to describe what it does to the published page rather than the pricing concept behind it. FR-091.
- [ ] T051 [P] [US3] Assert in `app/tests/price-list-screen.test.ts` that a blank price row still draws exactly two fields. FR-092 exists specifically to stop FR-091 being satisfied by promoting the field out of its fold, which would reverse `45edecb`.
- [ ] T052 [P] [US3] Check the heading adder in the docked chip row at `app/src/ui/build.ts:525-552` reads as a heading to somebody who has never used the app, and adjust only if it does not.
- [ ] T053 [US3] Run `npm run verify` and commit Phase 5.

---

## Phase 6: Polish and cross-cutting

- [ ] T054 **Holistic review over the whole diff**, by a fresh reviewer with no part in writing it, BEFORE any of this is considered done. Mandatory above roughly three chunks and this is five. The two seams most likely to carry a cross-cutting bug are between `assets.ts` and `menu-file.ts`, and between the engine's `isSafeUrl` and the renderer's `safeAddress`.
- [ ] T055 Apply review findings. Mechanical fixes auto-applied, genuine decisions batched into one question. Carry-forwards go in as `CHUNK N:` comments at the exact site, never as prose.
- [ ] T056 Run `npm run verify` whole and unpiped from PowerShell and quote the full result.
- [ ] T057 **Device verification on the real Android build**, following `specs/024-menu-file/quickstart.md`. Set `JAVA_HOME` to JDK 21 for the build only, run `npm run android:sync` or ship stale assets while being told BUILD SUCCESSFUL, bump `versionCode`, install with `-r` and the same key, never uninstall to install. Check `mWakefulness` immediately before each capture.
- [ ] T058 **Measure a real menu file across the JavaScript to native bridge**, which is the largest open risk in this feature. `handOff` passes the whole file as one synchronous string to `window.AndroidFiles.save`. If it does not hold, research D4 gives the order: smaller export edge, then chunk the call, then reconsider embedding.
- [ ] T059 [P] Update `docs/HANDOFF.md` with what was verified live, what was deferred, and what is blocked.
- [ ] T060 [P] Update `specs/README.md`'s index with 024 and its actual documents.
- [ ] T061 [P] Update `docs/ROADMAP.md` with a phase for this work, written after the fact and saying so.
- [ ] T062 Bump the version and tag locally. Do not push: that is Jakob's call, made explicitly, each time.

---

## Dependencies

```text
Phase 1  Setup                 done
   |
Phase 2A The contract          alone, blocks everything
   |
Phase 2B Host and capability   blocks US1 and US2
   |
   +---> Phase 3 US1 menu file        (independently shippable)
   |          |
   +---> Phase 4 US2 local pictures   (needs 2A for the schema, 3 for somewhere to appear)
   |
   +---> Phase 5 US3 relabel          (independent of everything, any order)
              |
Phase 6 Polish, holistic review, device
```

US3 depends on nothing and could ship first. It is last only because it is
smallest and answers a labelling complaint rather than delivering the feature.

US2 is not independently shippable in the way the template assumes: a picture
with nowhere to appear is not a feature, so it needs US1 in front of it. That is
stated rather than pretended away.

## Parallel opportunities

- Phase 2A: T003 and T008 are independent of each other.
- Phase 2B: T016 and T017 touch different emitters. T020 is independent once the
  emitters settle.
- Phase 3: T031 and T032 are independent.
- Phase 4: T040, T045 and T048 touch different files.
- Phase 5: T051 and T052 are independent.
- Phase 6: T059, T060 and T061 are three different documents.

## MVP

**Phase 2A plus Phase 2B plus Phase 3.** That is the saved menu file, working,
with pictures held at web addresses. It answers the request that started this
and it is shippable on its own.

Phase 4 is what makes the file genuinely offline and is the owner's stated
priority, so it is not optional, only later.

## Format check

69 tasks. Every one carries a checkbox, an id, a file path or a named command,
and a story label on the user story phases only, per the required format. Setup,
Foundational and Polish phases carry no story label by design.

Seven of them (T008a, T013a, T013b, T020a, T032a, T032b, T036a) were added by
the analysis pass rather than written here first, and they are suffixed rather
than renumbered so the ids in the commit messages that already reference them
stay valid. What each one closes is in
[analysis.md](./analysis.md).
