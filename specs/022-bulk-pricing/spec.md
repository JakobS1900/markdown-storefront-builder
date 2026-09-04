# Feature Specification: Bulk Pricing

**Feature Branch**: `022-bulk-pricing`, then merged to master.
**Status**: Specified before implementation on 2026-09-02.
**Input**: F2 of the four features the 2026-09-02 ideas decomposed into. The
decomposition and the evidence for why this must precede import are recorded in
`specs/021-starting-points/spec.md` under "What this is part of".

## The problem

Somebody sourcing cheap goods and reselling them prices every item by hand. They
know what they paid, they know the multiplier they want, and they do the
arithmetic one row at a time in a calculator, then type the answer back. When a
supplier's price moves, they do it all again.

The tool already holds their whole price list. It can do this for them, and it
can show them the profit on each item while it does, which is the number they
actually care about and the one they currently never see written down.

## What this is not allowed to do

Two constraints shape everything below, and both come from the existing contract
rather than from taste.

**Prices are free text on purpose.** `engine/src/document/descriptor.ts:73`
says why: "Artists write '45', 'from 45', '45+', and 'DM me'. A numeric type
would either reject real prices or discard what they wrote." Arithmetic over
free text is only safe if it refuses to guess. Anything it cannot parse is
skipped and shown as skipped.

**The app's purpose is to publish the page.** Profit per item means the app
knows what the seller paid a supplier. That number reaching a customer would be
a disclosure the seller never agreed to, on a page they published themselves. So
`cost` is stored and the compiler is forbidden from emitting it, with a test
that fails if it ever does.

## The contract change, which lands first and alone

Constitution: the cross-boundary contract lands FIRST, ALONE, in its own commit,
before anything consumes it. Two fields join `MENU_TIER_FIELDS`.

### `id`, required, first in the field order

Selection has to name "these forty of sixty" and survive the seller reordering a
row or deleting one. Today every row operation in `app/src/ui/forms.ts` addresses
rows by array position: `editTier(i, ...)` at line 332, `moved()` splices by
index at line 169. An index-held selection points at the wrong rows the moment
anything moves, and a pricing tool that silently repriced the wrong products
would be the worst defect this project could ship.

An earlier draft of this spec deferred `id` and cleared the selection on any
structural change instead. That was safe and much cheaper, and it was rejected
on 2026-09-02 in favour of doing it properly, because the deferral would have
made import (F3) build on a foundation it would then have to replace.

`id` goes **first** in `MENU_TIER_FIELDS`, matching `COMMON_BLOCK_FIELDS`, where
the same comment already explains why: so a validation issue can always name the
row it came from.

### `cost`, optional, free text

What the seller paid. Text for the same reason `price` is text. Optional because
a page that has never used bulk pricing has no costs and must stay valid.

### Version 3, and a migration that cannot use randomness

`id` is required, so every page saved at version 2 is invalid until migrated.
`SCHEMA_VERSION` becomes 3 and `MIGRATIONS` gains `{ from: 2, to: 3 }`.

The migration runs inside the engine, and Constitution Principle I forbids the
engine from consuming randomness, so it cannot mint UUIDs. It assigns
**positional ids**, `t0`, `t1`, `t2`, in order within each menu block. That is
deterministic, which the golden-fixture and determinism tests require anyway,
and it is readable in a saved file.

New rows added in the app get their id from `newId()` (`app/src/store.ts:110`),
which is `crypto.randomUUID`. A migrated page therefore holds a mix of `t0` and
UUIDs, and that is correct rather than untidy: the two ids come from two places
with different powers, and the engine's is the one that had to be deterministic.

**Uniqueness is within the menu block, not the document.** Selection never spans
two price lists, and block-scoped ids keep the migration's `t0` short. The
validator gains a check for it. Note the enforcement gap recorded in
`specs/021-starting-points/`: `eslint.config.js` does not list `crypto` among
the globals it forbids in `engine/src`, so a migration that minted a UUID would
violate Principle I and still pass lint. This feature closes that by adding
`crypto` to the rule.

## Requirements

- **FR-054**: A menu tier MUST carry an `id`, unique within its menu block.
- **FR-054a**: A page saved at version 2 MUST migrate to version 3 without loss,
  gaining deterministic positional ids. A page already at version 3 is untouched.
- **FR-054b**: A menu tier MAY carry a `cost`, free text, meaning what the
  seller paid.
- **FR-054c**: `cost` MUST NOT appear in compiled output for any target, ever.
  `engine/tests/compile/cost-never-published.test.ts` compiles a document
  carrying a sentinel cost against every entry in `TARGETS`, twice: once with
  plain tiers, and once with a tier carrying every other optional field the
  descriptor allows, since an emitter walking a tier's fields generically would
  leak only on the richer shape. A third case asserts the sentinel reaches no
  diagnostic either, because a warning naming the cost would put it in the app's
  own interface. See the third amendment below for what this line claimed
  before 2026-09-04 and why that claim was worse than no claim at all.
- **FR-055**: The seller MUST be able to select any subset of the rows in one
  price list, and to select all or none in one action.
- **FR-055a**: A selection MUST be held by tier `id`, never by position, so it
  survives editing a row, reordering rows, and removing a row that is not in it.
  A selected row that is removed drops out of the selection and nothing else
  changes. This is the requirement the schema change was taken for: an earlier
  draft cleared the whole selection on any structural change, and that is the
  behaviour this replaces.
- **FR-056**: Applying pricing MUST compute `price = cost x multiplier + extra`,
  rounded up to a chosen ending, for every selected row that has a parseable
  cost.
- **FR-056d**: "Round up to" means the smallest value with the chosen ending
  that is greater than or equal to the computed price, so 8.01 becomes 8.99,
  8.99 stays 8.99, and 9.00 becomes 9.99. Rounding never reduces a price, since
  a rounding rule that could quietly cut a margin is not one a seller can trust.
  Money is computed in whole cents throughout, so no result depends on binary
  floating point rounding.
- **FR-056a**: A row whose cost is absent or unparseable MUST be skipped, named
  as skipped, and left exactly as it was. It MUST NOT be guessed at.
- **FR-056b**: The seller MUST see what will happen before it happens: old price,
  new price, and profit, for every selected row, plus the rows that will be
  skipped.
- **FR-056c**: Write-back MUST preserve whatever the seller wrote around the
  number. "from 12" becomes "from 38.99", not "38.99".
- **FR-057**: One bulk application MUST be reversible as one action. Feature 014
  removed a confirmation on the principle that undo is the better answer, and a
  bulk edit is exactly where a confirmation would otherwise return.
- **FR-058**: Profit MUST be visible per row in the editor wherever both cost
  and price parse, and MUST never be published.

## The money parser

`app/src/money.ts`. Pure, no dependencies, its own unit tests. It is in the app
rather than the engine because the compiler never needs it, and the engine's
public surface should stay documents and compiling.

It returns either a parse or nothing. Nothing is a valid, common answer.

| Input | Result |
|---|---|
| `45` | 45, no prefix, no suffix |
| `$45` | 45, prefix `$` |
| `45.50` | 45.50 |
| `from 45` | 45, prefix `from ` |
| `45+` | 45, suffix `+` |
| `DM me` | nothing |
| `` (empty) | nothing |
| `1,234.56` | 1234.56 |

Decimal comma (`1.234,56`) is **not** supported and parses as nothing rather
than as a wrong number. That is a deliberate limit, recorded rather than hidden:
guessing which convention a seller meant is exactly the kind of guess FR-056a
forbids, and a European seller is better served by a skip they can see than by a
price that is off by a factor of a thousand.

## Selection and the maths

A checkbox on each row in the open price list, a line reading "N selected" with
select all and none beside it, and an "Apply pricing" panel holding three
inputs: multiply cost by, then add, then round up to. The rounding choices are
`.99`, `.95`, a whole number, and no rounding.

The panel shows the preview described in FR-056b before anything is applied.
Apply writes every row at once through a single `replaceBlocks` call, not one
call per row: `update()` at `store.ts:359` fires a full-document IndexedDB write
on every invocation, so forty calls would be forty writes and forty "Saved"
flickers for one action.

This lands in a new `app/src/ui/bulk-pricing.ts` rather than growing
`app/src/ui/forms.ts`, which is already 660 lines and renders nine controls per
tier.

## Undo

`undoRemove()` at `app/src/store.ts:438` already restores a whole block
wholesale, with a comment explaining that a row cannot land in the wrong place
if the section is put back entire. That is exactly what reversing forty price
changes needs, so bulk undo is a new `kind: "bulk"` variant sharing that restore
path and differing only in what it announces. No new mechanism.

**Implemented as a rename, not left as found here.** A function called
`undoRemove` that also reverses a price change is a comment that lies, and this
project has three recorded defects caused by exactly that kind of claim. It is
`undoLast()` at `app/src/store.ts:578` now, with every caller updated in the
same commit.

## Amendments made during implementation

Two things this feature got wrong before it shipped, both caught by review
rather than by any gate. Recorded here rather than edited quietly into the
sections above, matching the pattern `specs/021-starting-points/spec.md` sets.

**The selection was first built document-wide.** It was held as a flat list of
tier ids on the store, on the belief that an id was enough on its own to name a
row. It was not: "Uniqueness is within the menu block, not the document" above
is true of the schema, and the version 3 migration numbers every menu block's
rows from zero, so two different price lists can each legitimately hold a tier
called `t0`. Tried against the app's own shipped `app/public/example.json`,
which has three menu blocks that each migrate to a tier `t0`, ticking one row
ticked three. What changed is the shape the selection is held in, `{ blockId,
tierIds }` rather than a bare list of ids, so the invalid state cannot be
represented at all. A filter applied where the selection is read was
considered and rejected: a filter still leaves a structure that permits the bad
state, and would only have hidden the next version of the same bug.

**The apply panel first defaulted to a multiplier of 1 and an addition of 0.**
Those were believed to be safe, inert defaults, numbers a seller could leave
alone until ready to decide something else. They were not: FR-056 computes
`price = cost x multiplier + extra`, and a multiplier of 1 with an addition of
0 computes `price = cost`, which wipes the margin on every marked-up row the
moment Apply is pressed, whether or not the seller meant to change anything.
The first test fixture did not catch it because its row happened to have a
price already equal to its cost, so the wrong computation and the right one
produced the same number. What changed is that both defaults are blank, and
Apply is disabled until the seller has entered a real multiplier and a real
addition, so pressing it with nothing decided is not a state the panel can be
in.

**FR-054c described a gate that did not exist, and would have been worthless if
it had.** Found on 2026-09-04 by the holistic review this feature shipped
without. The line promised a test compiling "every fixture and all eight
starting points" and failing "if any cost value appears in the result". No such
test was ever written. The one that was written is better, and the difference is
the whole lesson: not one starting point, not one compile fixture, and not
`app/public/example.json` carries a `cost` field at all, so the promised sweep
would have compiled nineteen documents that had nothing to leak and reported
green forever. It is the same mistake as the contrast gate measuring an empty
page, recorded in `CLAUDE.md`, arriving this time in a requirement rather than
in a script. A sentinel value in a document built to carry one is what actually
proves the promise, which is what `cost-never-published.test.ts` does.

Both were verified firing on 2026-09-04, rather than trusted: making `pricedAs`
in `engine/src/compile/emit/menu.ts` append the cost to the price failed two of
that file's three cases across all three targets, and left the diagnostics case
correctly passing. A sweep over the shipped documents was written as a throwaway
probe at the same time to check the reasoning above rather than to keep: with
the same leak injected it flagged thirty document and target pairs, and with the
leak reverted it passed while carrying no cost anywhere. It was not kept,
because it catches nothing the sentinel test does not already catch and this
suite does not need a second gate for one promise.

**Nothing exercised a reorder and an apply in one run.** Also found by the
2026-09-04 holistic review, and the reason that review is worth running at all:
each half was thoroughly covered and the join between them was not.
`tier-selection.test.ts` proves a reorder leaves the selection unchanged, and
`bulk-apply.test.ts` proves a selection writes the right rows, but no test
reordered a row with a selection standing and then pressed Apply. That
composition is the one FR-055a exists for and the one this spec calls the worst
defect the feature could ship, so it was the wrong place to be inferring
correctness from two passing halves. It holds: the apply path resolves every row
by `id` against the live block, so there is no defect here, and the gap was in
the evidence rather than in the code. `bulk-apply.test.ts` now closes it, and
the test was verified to discriminate by holding the selection at the position
it was made at instead of by id, which left the moved row unpriced.

Worth recording precisely, because the reflex is to overclaim: the rest of the
suite is not blind to a position-held selection. That same injection failed two
of `tier-selection.test.ts`'s removal cases. What no test caught was the bug
arriving through a reorder and being spent on a reprice.

## What this does not do

No cost range filter ("select everything between one and two dollars"). It is
the obvious next control once `cost` exists and it is deliberately not in this
feature.

No target margin mode. `price = (cost + fees) / (1 - margin)` is the more
correct tool and is one step more abstract than a multiplier for somebody who
thinks in "3x". It can be added beside the multiplier later.

No bulk operation on existing prices, such as raising everything ten percent.
This computes price from cost only.

No import. That is F3, and it is the reason `id` was done properly here.
