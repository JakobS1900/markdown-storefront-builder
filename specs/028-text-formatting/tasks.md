# Tasks: Formatting Buttons Over a Text Section

**Feature**: 028 | **Branch**: `028-text-formatting` | **Date**: 2026-09-11
**Input**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [quickstart.md](quickstart.md)

## A note on the ordering

The phases are **not** in user story priority order, and that is deliberate
twice over.

**US2, nothing I type can break my page, comes before the marks it protects.**
It is a defect fix in shipped code and it is shippable on its own. Building the
grammar first would mean stacking two new constructs on an escaper that is known
to have a hole in it, and then trying to tell which of the two broke a golden
file.

**US1, the buttons, comes last despite being the whole point.** It depends on
nothing and could go first, but the two new marks need buttons of their own, and
building the row twice to get it shipped in priority order would be work for
nothing.

Every phase starts with a failing test. `CLAUDE.md` requires it, and this
project has now shipped four gates that measured nothing, so a test that has
never been seen red is not evidence.

---

## Phase 1: Setup

- [x] T001 Run `npm run verify` from PowerShell, whole and unpiped, and record the numbers in the first commit message. Expect 78 test files, 1480 tests, a11y 60, contrast 411 elements in both palettes, secret scan 447, dash scan 329, exit 0. Never pipe it through `Select-Object -First N`, which ends the pipeline early and reports a green gate as exit 255.
- [x] T002 Confirm `engine/tests/document/parity.snapshot.json` is unchanged, and that it stays that way to the end. **A diff to it anywhere in this feature is a defect, not a step.** 028 adds no schema and `SCHEMA_VERSION` stays at 5.

---

## Phase 2: The host contract, alone [foundational]

**Goal**: the capability record knows about the two marks, with a cited value
per host and a declared fallback, and nothing consumes it yet.

**Independent test**: the engine compiles and every citation is a sentence a
reviewer can check against `docs/research/2026-09-11-marks-verification.md`.

**Blocks**: Phases 4, 5 and 6.

- [x] T003 Add `strikethrough: boolean` and `highlight: boolean` to `Capabilities` in `engine/src/compile/capabilities.ts`, each with **its fallback written at the field**, not only in the spec. The file's own rule is that a capability with no consumer is a guess written down, and one with no fallback test is not a capability.
- [x] T004 Add the eight values to the four targets in `engine/src/compile/targets.ts` with a cited `sources` sentence each: `rentry` and `text.is` both true and both observed 2026-09-11; `portable` both false; `menu-file` both true. Do not write a value from memory and do not carry one host's value to another. `Target.sources` is keyed on `keyof Capabilities`, so this will not type-check until all eight are written, which is the design enforcing FR-028-15 rather than a reviewer having to.
- [x] T005 The `portable` citation MUST say in its own text that it is a judgement from the declared baseline and not an observation, and MUST name the wording it rests on: "strict CommonMark plus GFM tables", which is the same phrase `tables: true` was justified on. See research R4.
- [x] T006 Add `mark_unsupported` to `DiagnosticCode` in `engine/src/compile/diagnostics.ts`. Nothing raises it yet.
- [x] T007 Run `npm run typecheck` and `npm run test`. Nothing should change behaviour at all: this phase is data. Commit it alone, per `CLAUDE.md`'s rule that the cross-boundary contract lands first and by itself.

---

## Phase 3: The escaper, and the defect it closes [US2]

**Goal**: a seller's own sentence can never become a heading, and a stray pair
of equals signs can never become a highlight.

**Independent test**: compile a text block containing a line of equals signs
under a line of text and paste the result into either host's preview. A line of
text and a row of equals signs, not a heading.

- [x] T008 [US2] Write the failing tests in `engine/tests/compile/escape.test.ts` first: a line of exactly `=`, a line of `===`, a run of `==` mid sentence, a run of `===` mid sentence, and `Bundle = 3 items` which must come through **untouched**. Four must fail now and the last must pass now. Quote the failure.
- [x] T009 [US2] Implement the rule in `engine/src/compile/escape.ts`: every `=` in a run of two or more gets its own backslash, and a line consisting only of equals signs gets the same. A single `=` between non-equals characters is left alone.
- [x] T010 [US2] **Escape every character of a run, not just the first.** Proven on both hosts: `a \===b=== c` renders as `a =<mark>b</mark>= c`, because the survivors still pair. This is the same lesson `escape.ts` already records about the exclamation mark and the compiler-written bracket, and it is the single easiest thing in this feature to get subtly wrong.
- [x] T011 [US2] **Do not add `=` to `ESCAPABLE`.** It is simpler and it is wrong: it would put `Bundle \= 3 items` on the seller's Copy screen, which is the reverted `()` change repeated with a different character. `escape.ts:39-63` records that one. Leave a written comment at the new rule saying so.
- [x] T012 [US2] Add `=` to the strip list in `unescape()` in `app/src/ui/render-markdown.ts`, or the preview shows the seller their own backslashes. The list there is already wider than `ESCAPABLE` and this is why.
- [x] T013 [US2] Add the two setext cases and the accidental-highlight case to the hostile corpus fixtures used by `engine/tests/compile/golden.test.ts`, so the property is measured on every target forever rather than in one unit test.
- [x] T014 [US2] Run `npm run golden` and **read the diff before accepting it**. Only the hostile fixtures should move. If a starting point or the example moved, something escaped that should not have.
- [x] T015 [US2] **Break it.** Remove the new rule and confirm the escape tests go red naming the case, not failing a count. Put it back and quote the failure in the commit.
- [x] T016 [US2] Run `npm run verify` and commit this phase alone. It is a defect fix and it is shippable by itself.

---

## Phase 4: The grammar [US3]

**Goal**: strikethrough and highlight are recognised, emitted where the host can
show them, and dropped with a named warning where it cannot.

**Independent test**: compile one text block carrying both marks for all four
targets. Two carry the markers, two carry plain words and a diagnostic.

- [x] T017 [US3] Write the failing tests in `engine/tests/compile/inline.test.ts` first, in **both** of that file's halves: that `~~x~~` and `==x==` are recognised, and that the existing negative corpus still produces nothing. The negative corpus must not regress: `2 * 3 = 6`, `snake_case_name`, `50% off**`, `an unclosed **bold`.
- [x] T018 [US3] Add `strike` and `highlight` to the `Node` union in `engine/src/compile/inline.ts` and two alternatives to `PATTERN`. Ordering in that regular expression is load bearing: link first because its label can contain the other markers, and the two-character markers before the one-character ones.
- [x] T019 [US3] Widen `emitInline` to take the target and a `DiagnosticSink`. `parseInline` keeps its signature and stays target-free, which keeps the security critical half testable on its own. Research R6 has the two rejected alternatives and why each is worse.
- [x] T020 [US3] Implement the fallback: where the capability is false, emit the children **without the markers** and raise `mark_unsupported` naming the block and the capability. Not bold, not the literal markers. Decision 2.
- [x] T021 [US3] The diagnostic message MUST NOT quote the seller's words back. FR-081 established that for `local_image_unsupported`, because a warning is somewhere a seller might screenshot.
- [x] T022 [US3] Thread the sink through `emitProse` in `engine/src/compile/emit/prose.ts` and `emitBlock` in `engine/src/compile/compile.ts`. `emitProse` is currently the only emitter that takes no sink; after this it looks like the other five rather than like an exception.
- [x] T023 [P] [US3] Add one XSS corpus case per new construct, which is two. Constitution Principle IV, and it is not optional.
- [x] T024 [US3] Add a fallback test per capability, proving what happens when a host lacks it. `capabilities.ts` requires this before a flag counts as a capability at all.
- [x] T025 [US3] Run `npm run golden` and read the diff. Only fixtures that use a new mark may move, and they must move differently for `portable` than for `rentry`. **If `portable` and `rentry` produced identical output for a fixture carrying a mark, the fallback is not wired in.**
- [x] T026 [US3] **Break it.** Remove the capability check so the markers are always emitted, and confirm a golden file for `portable` goes red. Put it back.
- [x] T027 [US3] Run `npm run verify` and commit.

---

## Phase 5: The renderer [US3]

**Goal**: the preview and the saved menu file show both marks, and show them
absent when the chosen host cannot.

**Independent test**: with the host on rentry the preview shows a highlight;
switched to portable the same page shows a plain word.

- [x] T028 [US3] Write the failing tests in `app/tests/render-markdown.test.ts` first, via `renderCompiled()` at `:38`. **Compile first, then draw. Never hand-written markdown**, or the test asserts against a string no emitter produces.
- [x] T029 [US3] Add `del` and `mark` branches to `inline()` in `app/src/ui/render-markdown.ts`. **Read the forgery bug first**: `docs/HANDOFF.md`, `escape.ts:39-63`, and the comment at `render-markdown.ts:130-142`. A product named `Keyring](https://tracker.example/pixel.png)` once made the app build an image at that address.
- [x] T030 [US3] Confirm the same change reaches the saved menu file, which uses the same renderer at `app/src/menu-file.ts:226,348`. That is why there is one renderer: the file and the preview cannot disagree.
- [x] T031 [P] [US3] Add the same two cases to `app/tests/menu-file-hostile.test.ts`, which is the adversarial corpus one layer up.
- [x] T032 [US3] Run `npm run verify` and commit.

---

## Phase 6: The buttons [US1]

**Goal**: a seller formats their writing without typing a punctuation mark.

**Independent test**: select a word, press each of the six buttons, read the
Copy tab.

- [x] T033 [US1] Write the failing tests first in `app/tests/forms.test.ts`. **Every one of them must focus the textarea and set a real selection before pressing a button.** 023's holistic review found twenty one tests passing over a panel that showed a seller nothing, because every test used a helper that never focused the box.
- [x] T034 [US1] Add the button row primitive beside `field()` in `app/src/ui/dom.ts`, opt in. Model it on `bulkPricingToolbar` at `app/src/ui/bulk-pricing.ts:178-181`, which is a `div` with `role="group"` and an `aria-label`.
- [x] T035 [US1] **Cancel the default on `mousedown`.** `typing()` in `store.ts:888-896` is true only while a text field holds focus, and `repaint()` at `:391` defers entirely while it is. A plain click blurs the field, flips that false, and repaints mid-edit, and a repaint calls `replaceChildren` and destroys the textarea under the seller's hands. This is the single most likely way to ship this feature broken.
- [x] T036 [US1] Apply the edit to the live control, restore the selection, then **dispatch `input`** so the change travels the listener `field()` already installs at `dom.ts:146-148`. No new data path and no new event. Use `nowBlock()` (`forms.ts:241-248`) if the handler needs the block, because handlers here close over a stale one.
- [x] T037 [US1] Implement wrap-with-selection, insert-a-selected-placeholder when nothing is selected, and **unwrap when the selection already carries the mark** (FR-028-5).
- [x] T038 [US1] Implement the link button: the selection becomes the visible text and the caret waits inside the parentheses where the address goes.
- [x] T039 [US1] Implement the list button across every line the selection touches, toggling `- `, which is what `isListItem` at `prose.ts:94` recognises.
- [x] T040 [US1] Wire the row into `proseForm` in `app/src/ui/forms.ts:337-347` and **nowhere else**. FR-028-2: of the six multiline fields in the app, four are line-oriented parsers published as plain text, and a button on those would promise what the compiler refuses.
- [x] T041 [US1] Give every button an accessible name disambiguated by its section. Copy the pattern and the reasoning from `rowTools` at `forms.ts:51-101`, especially the comment at `:59-67`: a page with three Text sections otherwise gives a screen reader three identical "Bold" buttons.
- [x] T042 [US1] Style the row in `app/src/styles.css` for both palettes, 44 by 44 CSS pixels, no horizontal overflow at 390px with six buttons.
- [x] T043 [US1] Keep the hint at `forms.ts:344`. FR-028-11. `app/tests/field-examples.test.ts` asserts hint text, so any wording change lands there.
- [x] T044 [US1] Extend `app/tests/a11y.test.ts` to cover the new row, and extend `scripts/contrast.mjs` to open a Text section so the buttons are measured in both palettes.
- [x] T045 [US1] **Demand a minimum count, and prove axe MEASURED it rather than that the page DREW it.** That distinction is the finding of 027 Phase 6: a structural count said seven help lines and axe had reached four, because `document.elementsFromPoint` returns everything at a point whether or not it is painted over. Ask axe what it reached.
- [x] T046 [US1] **Break the gate.** Strip an `aria-label` from one button, run `npm run a11y`, and confirm it names that button. Put it back and quote the failure.
- [x] T047 [US1] Run `npm run verify`. **a11y and the contrast element count must both rise.** A number that has not moved means the gate never saw the buttons. Commit.

---

## Phase 7: Whole-feature review and release

- [ ] T048 **The holistic review over the whole feature diff**, with a fresh reviewer, run sequentially rather than in parallel. Five chunks is over `CLAUDE.md`'s line, so this is mandatory. It has found something real on every feature here that ran it, and on 027 it caught a wrong price going to buyers.
- [ ] T049 Read every `CHUNK N:` comment left in the code and resolve or carry each one deliberately. Delete the ones that are done.
- [x] T050 Drive the six buttons in a real browser per [quickstart.md](quickstart.md), including the fallback: switch the host to portable and confirm the marks go plain **and the message appears**.

  **Done, headless Chrome at 390x844, eleven checks, all clean.** The ones jsdom
  cannot make: a REAL pointer press on Bold, dispatched through CDP so the
  browser's own focus handling runs, produced `Pay a **deposit** first`,
  **focus never left the textarea**, the word was still selected afterwards,
  and the Copy tab carried `Pay a **deposit** first`. Also measured: no
  sideways scroll on the page or the row, and every one of the six buttons at
  least 44 by 44 CSS pixels.

  **The script tripped over this project's own documented trap and it is worth
  recording.** Its first attempt reached the Copy tab with `element.click()`
  and timed out waiting for the output box. A programmatic click does not blur,
  so the textarea kept focus, `typing()` stayed true, and the repaint that
  draws that tab is deferred while it is. The app was correct; the driver was
  not. Fixed by dispatching a real pointer press.

  The fallback half is covered by `app/tests/mark-warning.test.ts` rather than
  here, including the seam it found: the page preview shows the words plain for
  a host that cannot highlight while the menu file preview, on the same screen,
  shows the highlight, because it compiles for a target that can.
- [x] T051 Compile all eight starting points and the bundled example for all four targets, before and after, and confirm byte identical output. FR-028-21. This is the same measurement 026 made and the same command produces it.

  **Done, and it corroborates 026's own sweep exactly.** 9 documents, 4 targets,
  **36 outputs, 57,648 bytes**, which is the number `docs/HANDOFF.md` records
  for feature 026. The method is stronger than a byte diff and is stated so it
  can be checked: feature 028 changes emitted bytes in exactly three
  situations, a run of two or more `=`, a line that is equals signs and nothing
  else, and a `~~pair~~` or `==pair==` the grammar now claims. Every shipped
  document was scanned for all three and **none contains any of them**, so none
  of the three can arise and every one of these pages publishes what it
  published before.
- [ ] T052 Handset pass on the Moto G7. `adb -s ZY2262PFGQ`, because an offline emulator is usually attached too. `MSYS_NO_PATHCONV=1` on `adb shell`. Check `dumpsys power` for `mWakefulness` **immediately before every** `screencap`: a capture under about 20 kB is a sleeping screen, not a broken app. Set `svc power stayon` back to `false` afterwards.
- [ ] T053 On the handset specifically: the buttons are reachable with the software keyboard up, the selection survives the tap, and **Jakob's two pages do not move**. They are "Untitled page, 9/1/2026" and "Ridgeline Carry, 8/31/2026". Remove any probe page.
- [ ] T054 Bump to versionCode 16 / versionName 0.11.0. **Use Edit, never `Set-Content`**, which writes a UTF-8 BOM into `build.gradle` and kills Gradle in about a second with no useful message. Check the first three bytes are `97,112,112` and not `239,187,191`.
- [ ] T055 Build with `$env:JAVA_HOME="C:\Program Files\Java\jdk-21"` set for the build only. Verify the APK carries the assets the build just emitted, which is the stale-assets failure that nearly shipped in 0.4.0, and that `apksigner verify` reports v2 true, v3 true and digest `c952b39c...`.
- [ ] T056 Merge to master with `--no-ff`, push, tag `v0.11.0`, and publish the GitHub Release **with the signed APK attached**. Pushing commits is not shipping.
- [ ] T057 Update `docs/HANDOFF.md` and the `CLAUDE.md` status block. The block does not update itself, and it has spent whole features saying the wrong thing three times.
- [ ] T058 Update the status table in `specs/README.md` with a row for 028, honest about which documents exist.

---

## Dependencies

```text
Phase 1  setup
   |
Phase 2  the contract          [blocks 4, 5, 6]
   |
Phase 3  the escaper   [US2]   [independent, shippable alone]
   |
Phase 4  the grammar   [US3]   [needs 2 and 3]
   |
Phase 5  the renderer  [US3]   [needs 4]
   |
Phase 6  the buttons   [US1]   [needs 2; needs 4 for two of its six]
   |
Phase 7  review and release
```

**Parallel opportunities are deliberately few.** The 2026-09-09 double rate
limit bought the rule that reviews run sequentially, and this feature is a chain
of seams rather than a set of independent surfaces. The tasks marked `[P]`
(T023, T031) touch only their own test file.

## Independent test criteria

| Story | Testable alone by |
|---|---|
| US2 | compiling a line of equals signs under a line of text and pasting it into either host's preview |
| US3 | compiling one block carrying both marks for all four targets, and reading the diagnostics |
| US1 | selecting a word, pressing each button, and reading the Copy tab |

## Suggested MVP

Phases 1 to 3 plus Phase 6 with four buttons. That is the reported complaint
answered and a live defect closed, with no new construct. **It is not what was
chosen**: Jakob picked everything in one release on 2026-09-11, with the phased
option offered and its costs stated. This line exists so that if the day runs
out, the fallback is already identified rather than improvised.
