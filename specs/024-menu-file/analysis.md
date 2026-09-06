# Cross-artifact analysis: The menu file

**Feature**: 024-menu-file
**Date**: 2026-09-06
**Ran against**: spec.md, plan.md, tasks.md, research.md, data-model.md, contracts/menu-file.md, and `.specify/memory/constitution.md`

Eight findings. One critical, four high, one medium, two low. Six were fixed in
place; two are recorded and left.

The critical one is worth reading even if nothing else here is, because it is a
gate that would have been green and empty, which is a mistake this repository
has already made twice.

---

## F1 (CRITICAL, fixed): a deliberate design decision silently emptied seven tests

Research D2 keeps `MENU_FILE` out of the `TARGETS` array, and that is right: the
array feeds `findTarget` and the host picker, and a menu file listed among
places to paste your page would be a lie.

**Seven engine test files iterate `TARGETS` to assert something across every
target**: `golden`, `determinism`, `performance`, `compile`, `holistic`,
`holistic-003` and `cost-never-published`. A target outside the array is
silently outside all seven.

So `MENU_FILE`, the one output that carries embedded pictures, would have had no
golden file, no determinism property, no performance budget and no cost
guarantee. Every one of those tests would have kept passing while covering
nothing about it.

This is the identical shape to FR-054c, the gate that "would have compiled
nineteen documents that carry no `cost` between them and passed forever". The
difference is that this one was caught before the code existed rather than by a
holistic review two days after shipping.

**What tasks.md said before**: T019 alone, adding `MENU_FILE` to
`cost-never-published.test.ts` by hand. That was the right instinct applied to
one of seven places, which would have left six holes and, worse, would have made
the suite look deliberate about the one.

**Fix**: T013a adds `ALL_TARGETS = [...TARGETS, MENU_FILE]`; T013b moves the six
sweeps onto it and T019 moves `cost-never-published` too. `findTarget` still
searches `TARGETS` only, so an unknown stored target still falls back to
`PORTABLE` with a warning. `textis.test.ts` is deliberately left alone, since it
is about one host and must keep naming it.

The real repair is not the array. It is that choosing between `TARGETS` and
`ALL_TARGETS` is now a visible decision at every call site, where before there
was one array and no decision to get wrong.

---

## F2 (HIGH, fixed): a path asserted without being checked

plan.md put golden fixtures at `engine/tests/compile/goldens/`. They live at
`engine/tests/compile/golden/<targetId>/`. I wrote the path from memory and did
not open the directory.

Small in itself, and worth recording because this project's specs carry a
standing warning that a document describing something that is not there is worse
than no document. Fixed in plan.md and in T020, which now also notes the harness
produces nothing for the new target until T013b lands.

---

## F3 (HIGH, fixed): nothing measured the saved file's width

FR-073 requires the saved file to reflow without sideways scrolling, and SC-007
names 390 CSS pixels. T025 inlined a stylesheet and no task measured the result.

That is precisely the gap `e0f345b` had to close for the preview table, where
two plausible fixes were measured and both were wrong: a `min-width` floor on
cells gives every column exactly the floor, and a floor on the table with no
wrapper sets the whole page scrolling sideways. Neither was discoverable by
reading CSS.

jsdom lays nothing out, so this cannot live in the jsdom suite. **Fix**: T032a,
a headless Chrome script beside `scripts/contrast.mjs`.

---

## F4 (HIGH, fixed): a privacy property held by side effect and asserted nowhere

FR-083 requires location and camera data not to be retained. The design
satisfies it by reusing `normalise()`, which re-encodes through a canvas and
discards the EXIF block as a consequence.

That is a genuinely good reuse and a bad guarantee. Nothing in the suite would
notice if `normalise()` were changed, replaced, or bypassed for stored pictures,
and the requirement would fail silently and invisibly, which is the worst way
for a privacy requirement to fail.

The repository's own lesson applies: twenty one tests covered a paste panel and
every one missed that it displayed nothing. **Fix**: T036a stores a JPEG that
has an EXIF block and asserts it is gone.

---

## F5 (HIGH, fixed): SC-008 was half tested

SC-008 promises that an existing page keeps every field **and** produces the
same output for every paste host. T004 covered the fields. Nothing covered the
output.

A migration that preserved every field and still moved a byte of compiled output
would have passed. **Fix**: T008a compiles the version 3 fixture before and
after and requires byte identity for every paste host.

---

## F6 (MEDIUM, fixed): the file's own accessibility was promised and unchecked

contracts/menu-file.md guarantee 5 promises semantic markup, real headings, a
real table and carried-through alt text. T032 tested the app's new control. The
app's a11y gate cannot see the produced file at all.

Principle VI is about the people who need to read things, and the saved file is
the artifact other people actually open. **Fix**: T032b runs axe over the
produced file in the same headless script as F3.

---

## F7 (LOW, left): chunk numbering drift

The approved planning document says Chunk 0, 1, 2. tasks.md says Phase 2A, 2B.
Left alone: tasks.md is what an implementer follows, and renumbering to match a
document outside the repository would be churn.

---

## F8 (LOW, left, but read this): the approved plan outside the repo is stale

The plan this feature was approved from, at
`C:/Users/Emu/.claude-personal/plans/some-of-my-friends-breezy-rocket.md`, still
describes the design research D3 reversed: two capabilities rather than one,
`data:` URIs embedded in the compiled markdown, and a widening of both address
checks to admit them.

It is outside the repository so it is not edited here, and it is recorded so
nobody reads it as current. **research.md, plan.md and tasks.md are
authoritative.** The reversal and its reasoning are in research D3.

---

## Coverage

| | Total | Covered | Gapped |
|---|---|---|---|
| Functional requirements FR-070 to FR-092 | 23 | 23 | 0 |
| Success criteria SC-001 to SC-008 | 8 | 6 | 2 |
| Tasks | 69 | all mapped | 0 unmapped |

The two success criteria still not covered by a task are deliberate, and both
need a person rather than a gate:

- **SC-001**, a seller going from open page to sent file in under 30 seconds.
  Measured during device verification (T057), not automatable.
- **SC-006**, somebody who has not used the app finding where to enter
  "1 lb for 7, 5 lb for 30". That is the whole point of US3 and it cannot be
  asserted by a test. It needs one person who has not seen the form.

Recording them as uncovered is the honest position. Writing a test that pretends
to cover them would be worse than the gap.

## Constitution alignment

No violations. The one narrowing, of `render-markdown.ts`'s stated property that
no markup string exists, is recorded in plan.md's Complexity Tracking rather
than left for a reviewer to find, and T029 and T030 settle it with evidence
instead of argument.
