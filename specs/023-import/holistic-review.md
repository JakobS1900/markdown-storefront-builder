# Holistic Review: Bringing in a Price List

**Reviewed**: 2026-09-04, over the whole feature diff, before the first commit
of any implementation code.
**Reviewer**: a fresh agent with no part in writing the feature, given the spec,
the plan, `CLAUDE.md` and `git diff --cached`, and asked specifically to find
what a per-chunk review structurally cannot.

`CLAUDE.md` has required this on any feature over roughly three chunks since the
beginning. This one is four. `specs/021-starting-points/holistic-review.md` is
the precedent and its argument is confirmed again here: **the two most serious
findings below are both invisible from inside any single chunk**, because each
is a disagreement between two pieces of code that are correct on their own.

## What it found, and what happened

Ten confirmed defects and two suspicions. All ten are fixed. Nothing was
deferred.

### The two that justify the whole exercise

**1. The panel showed the seller nothing at all after their paste.**

`repaint()` in `app/src/store.ts` refuses to rebuild the tree while a text field
holds focus, and re-defers every 200ms for as long as that is true. It exists
because replacing a focused input tears down the Android InputConnection bound
to it and loses characters, a real bug reported on a Pixel.

The paste box is a textarea. It holds focus for the entire time the seller is
using it. Every control the feature depends on, the count, the ticks, and the
Add button, sat behind that deferred repaint, so a seller who pasted their list
saw an unchanged screen offering one button: "Done pasting", which discards the
paste. On a phone, with the keyboard up, that is the entire feature failing to
appear at the first step of User Story 1.

Twenty one tests passed over this. Every one of them called a helper that set
`textarea.value` and dispatched `input` **without focusing**, so `typing()` was
false and jsdom repainted synchronously in a way the real app never does. The
technique that catches it already existed in the repo, in
`app/tests/repaint-while-typing.test.ts`.

Fixed by refreshing only the changing half of the panel in place, leaving the
textarea untouched, so focus, caret and keyboard survive. It is the one place in
the app that updates its own DOM instead of letting `repaint` do it, and the
comment there says why. FR-068 records the requirement, and
`price-list-screen.test.ts` now has a focused test that fails without the fix.

**2. A paste could be written into a different page.**

`openPage`, `adopt`, `newPage` and `setSurface` all clear `selectedBlockId`,
`undo`, `selectedTiers` and `bulkPricingInputs`. Feature 023 added a fifth
screen-scoped field and joined none of those lists.

`openPage`'s own comment already spells out the hazard: starters and reopened
backups keep the block ids from their file, so two pages made from the same
starting point share a menu block id. Paste sixty lines into page A's price
list, switch to page B made from the same starter, open its price list: the
panel reappears holding page A's text and ticks, and Add writes them into B.
`convertPaste` only checked that the id resolved to a menu block in the current
document, so nothing downstream would have stopped it.

This is the "guard the feature quietly stopped protecting" class that 021's
review also found. Fixed at all four sites, with FR-069 and two tests.

### The rest

3. **The count could promise more than the conversion delivered.** The button
   counted every ticked line; `toProducts` additionally filtered out blanks and
   Markdown table rules. Ticking a blank gave "Add 3 items" for two, and
   ticking only blanks gave an enabled button and an announcement of "Added 1
   item" when nothing had been added, against FR-066. Now counted through
   `canBeProduct`, and lines that cannot be products get no checkbox at all.
4. **A thousands separator was read as a column boundary.** `parseMoney`
   accepts "1,234.56" deliberately; the splitter split on every comma. "Sofa,
   1,200" became a product priced 1 with a phantom supplier cost of 200. Both
   modules correct alone. FR-062c, three tests.
5. **Columns past the fourth were silently dropped**, against SC-003's promise
   that what the seller wrote is distributed between fields rather than
   discarded. The character accounting test could not see it because no fixture
   had five columns. Leftovers now go to `blurb`. FR-062d.
6. **FR-067 named a gate that did not cover a single control this feature
   adds.** `a11y.test.ts` renders no control it is not made to draw, and nothing
   made it open the paste panel. Feature 022 had already set the precedent with
   its Apply panel. A case now opens the panel with text in it.
7. **The file read failure path had no test**, though the plan listed one.
8. **Four comments claimed more than the code did.** The worst said the pasted
   text "is immutable for as long as the screen is open", which is false;
   `setPasteText` replaces it on every keystroke. The sound argument is
   narrower: text and ticks are only ever written together. This repo has been
   bitten three times by a plausible comment that was not true, and the
   corrected version now says which half carries the weight.
9. **Reopening the panel discarded a paste in progress.** Pressing a button
   twice is not the seller saying to discard anything.
10. **A whitespace-only line got a whitespace accessible name.** Gone with the
    fix to 3: such lines no longer get a checkbox.

### A knock-on the reviewer traced but did not classify as this feature's bug

`dom.ts` numbers field ids per render and its comment says "Typing changes
values, never structure." The paste panel renders one checkbox per line, so
changing the line count renumbers everything after it, and the "Section
settings" group below could no longer be found by `restoreOpenGroups`: it folded
itself shut. 022's Apply panel already perturbed this on appear and disappear.
Fixed at the cause by giving that group the stable id `disclosure` already
documents as the answer.

## What it confirmed sound

- **The load-bearing guarantee holds.** Traced end to end rather than assumed:
  `pasting` lives on `State`, never on `Document`; `save()` serializes
  `state.doc` only; no compile or preview path reads it; every paste mutation
  goes through `set` and never `update`, so no keystroke can trigger a save or
  clear a standing undo offer. `convertPaste` is the only writer and one button
  is its only caller.
- **The 022 seam is intact.** `applyBulkPricing` passes "priced", so every
  existing path keeps its wording and `bulk-apply.test.ts` still passes.
- **FR-061b's amendment is sound rather than convenient.** The reviewer traced
  every caller and confirmed there is no reachable state in which conversion
  happens with no price list present, so "create one if none" would have been
  dead code.

## The correction worth carrying forward

The reviewer's housekeeping note said an untracked `nul` file was in the repo
root. It was not: it had been removed earlier the same session. Recorded here
because a review is evidence, not authority, and this one was checked rather
than believed.
