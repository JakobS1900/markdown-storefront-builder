# Holistic Review: Starting Points

**Run**: 2026-09-02, over the whole feature diff, `4b58245..ae83770`, 16 commits,
27 files.
**Verdict**: ready to merge with fixes. No Critical. Eleven Important, eight
Minor. Every Important was fixed in one wave and verified; the fixes and their
re-review are in the history above this document.

## Why this document exists

`CLAUDE.md` requires one holistic review over a whole feature diff for anything
over roughly three chunks, on the argument that per-chunk reviews each see one
internally correct side of a seam and structurally cannot catch cross-cutting
bugs. `specs/README.md` records that no such review had happened since feature
003. This is the first since, and it is written down because the review's value
was almost entirely in findings no per-task review could have reached.

Five tasks were each reviewed by a fresh reviewer as they landed, and each of
those reviews was competent. What follows is what they could not see.

## What only the whole-diff view caught

**A defect in a file outside every task's diff.** `art-commissions.json` shipped
in task 1. `dropshipping-store.json` shipped in task 3 and was found to carry a
false fulfilment commitment. The identical defect was already sitting in
`art-commissions.json`, in a block no task after the first ever touched, so no
task reviewer had it in scope. It was fixed only because the controller held the
cross-task view.

**The same shape a second time, and worse.** A grammar error, "A few examples on
each side is enough", was logged during task 1 as a deferred minor against one
file. The holistic review found the sentence in **two** starters and quoted in
the spec. Fixing the file on the deferred list would have left the error in the
other starter and left the spec quoting text that matched neither. The lesson is
not about grammar: a finding recorded against one file is a finding recorded
against one file, and content that gets copied does not respect task boundaries.

**A gate this feature silently weakened.** `scripts/contrast.mjs` guarded against
measuring an empty page by requiring at least three `#surface li`. The picker
adds eight `li` to the empty state whether or not it is open, so that half of the
guard became unconditionally true. The gate still failed loudly through its
`fields` half, so nothing was broken, but a protection had quietly stopped
protecting. No task reviewer was looking at `contrast.mjs`, because no task
changed it. The selector now counts `#surface .blocks > li`.

**Two documents that this branch's own success made false.** `specs/README.md`
carried a sentence that was true when written and inverted its meaning when its
tense was updated on shipping. `docs/ROADMAP.md` said the picker replaced the
example, which it does not: it sits beside it, as the spec's own carry-forwards
section says. Both are the defect class `specs/README.md` exists to memorialise.

**A property with a whole spec section and no test.** The `.meta.ts`/`.json`
split exists solely to keep starter documents out of the entry chunk, and the
spec quantifies the cost of losing it at roughly 26 kB gzipped on a 20 kB bundle.
It had been verified by hand twice and by nothing since, so a change to Rollup's
behaviour, or a well-meant simplification back to one file, would have tripled
first load with every gate still green. `scripts/pwa-update.mjs` now asserts it.

**An unfinished decision that seven of eight starters rested on.**
`profile.paymentMethods` published "Payment: Cash, Card" as finished-looking
content beside a `links` field carrying an instructional label. The honesty rule
had been amended twice during implementation and still could not answer where
that line fell. It can now, and `profile.status` was removed entirely as a
consequence.

## What the per-task reviews got right, for the record

The task reviews were not redundant. They caught the duplicate picker
(reachable by pressing "Start a new page" with any other page saved), the
vacuous test that never pressed the button it was named for, the hybrid
placeholder pattern, and the `pwa-update.mjs` entry-chunk bug that this feature
exposed but did not cause. Two of them corrected the controller's own rulings,
which is the review working as intended.

## The honest gap in this document

It was produced by a single reviewer in one pass, and it was told where several
bodies were buried, since the controller pointed it at the deferred minors and
at five specific cross-cutting questions. A reviewer given a map is not the same
as a reviewer who found the map. Its most valuable findings, the twin-file
grammar error and the weakened contrast guard, were not on that map, which is
the evidence that the seat was worth funding rather than the pointing.

Colour contrast, accessibility, the service worker update path and the bundle
split are all machine-checked. The honesty rule is not, and cannot be: nothing
here can decide whether a sentence is a lie. Eight starting points ship on the
judgement of the people who reviewed them, and a ninth will ship on the
judgement of whoever adds it. That is stated in the spec as well, in the section
that records the rule, so nobody mistakes a green `npm run verify` for a
guarantee about the content.
