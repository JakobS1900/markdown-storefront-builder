# Research: Formatting Buttons Over a Text Section

**Date**: 2026-09-11.

The raw host observations are in
[`docs/research/2026-09-11-marks-verification.md`](../../docs/research/2026-09-11-marks-verification.md)
rather than duplicated here, because that file is where a capability citation
must point and this one is where a decision is argued.

## R1: four of the six marks need no engine work at all

**Decision**: build buttons for bold, italic, link and bullet list over the
grammar that already exists. Add nothing to the engine for them.

**Rationale**: read directly in `engine/src/compile/inline.ts` during planning.
`Node` is `text | strong | em | link`, `PATTERN` recognises all four, and
`emit/prose.ts` calls `formatInline` on every line and every bullet. Feature 008
shipped this on 2026-08-21 and `engine/tests/compile/inline.test.ts` has covered
it since.

**Why this is the most important line in this document**: it is the load bearing
assumption of the whole feature. If it were wrong the scope roughly doubles. It
was verified by reading the code, not inferred from a passing test, which is the
distinction this repository has had to make four separate times.

**Alternatives considered**: none seriously. Rebuilding a grammar that works
would be work with a negative return.

## R2: the affordance is the feature, and the hint is not a substitute

**Decision**: a row of buttons, not better hint wording.

**Rationale**: the hint already spells out every construct, including the
syntax, and a tester read it and still reported the feature missing. The
constitution's first line describes this product's users as "people who do not
know Markdown". A hint instructing somebody to type `**bold**` asks exactly the
knowledge the product exists to not require.

**Alternatives considered**: a fuller live editing surface, where the text
appears already formatted. Rejected as much larger than what was asked for, and
as a poor fit for a product whose whole premise is that the compiled output is
the truth (Principle VII). A plain box with buttons above it is also what every
paste host and forum this audience already uses.

## R3: highlight and strikethrough both render on both paste hosts

**Decision**: `strikethrough: true` and `highlight: true` for rentry and
text.is.

**Rationale**: observed on 2026-09-11 at each host's own markdownify endpoint,
which is what its compose page's live preview calls. `==x==` produced `<mark>`
and `~~x~~` produced `<del>` on both. `rentry.co/how` documents both, and the
documentation and the observation agree, which is worth stating because the
`hardBreak` capability exists precisely because they once did not.

**Reversal worth recording**: the plan for this feature was written expecting
text.is to be the difficult one, and expecting to record `highlight: false` for
it if it could not be observed. It was observed, it supports it, and the
conservative placeholder was not needed.

**What the probe found that nobody was looking for**: text.is pairs `==`
markers that have a space directly inside them and rentry does not, so
`a == b and c == d` highlights on one host and not on the other. Two hosts
running the same stack, disagreeing for the third time.

## R4: portable gets `false` for both, and that is a judgement

**Decision**: `strikethrough: false`, `highlight: false` for the portable
target.

**Rationale**: the constitution defines portable as "a strict CommonMark plus
GFM tables baseline". Highlight is in neither CommonMark nor GFM. Strikethrough
is a GFM extension, but the baseline names GFM **tables** specifically, and
`tables: true` was justified on exactly that wording. Writing `true` for
strikethrough would widen the declared baseline by inference, which `targets.ts`
refuses in its own header: assuming support produces broken pages, assuming
absence produces safe ones.

**Alternatives considered**: `strikethrough: true` on the argument that
essentially every renderer in use implements it. Probably correct in fact and
still the wrong way to write a capability value here. If it should be `true` it
is a one line data change with a citation, which is Principle II working rather
than failing.

**Cost of being wrong**: one plain word plus a message, on the `.md` file
download. Not a broken page.

## R5: the escaper has a hole, and this feature closes it

**Decision**: escape every `=` in a run of two or more, and escape a line
consisting only of equals signs. Leave a single `=` alone.

**Rationale**: a line of equals signs under a line of text is a setext heading
on both hosts, and one equals sign is enough. The seller's own sentence becomes
an `<h1>` and the equals signs disappear. The dash form has always been safe
because `LINE_MARKER` escapes `#`, `+` and `-`; `=` is in none of the escaper's
three sets.

This makes false, today, the claim `inline.ts` makes about itself:

> An artist cannot produce a construct that is not in `Node` below, however they
> write it.

**Three things the probe settled that reasoning would have got wrong**:

1. A backslash **does** protect `=` on both hosts, so this needs no numeric
   character reference. That is not obvious: `~`, `^` and `$` all needed one.
2. Escaping only the first character of a run is **not** enough.
   `a \===b=== c` renders as `a =<mark>b</mark>= c`, because the survivors still
   pair. Every character of the run needs its own backslash. Same lesson
   `escape.ts` already records about the exclamation mark: a marker only has to
   survive in part to build a construct.
3. Leaving a single `=` alone is safe, and it matters.
   `Bundle \= 3 items` on the seller's Copy screen would repeat the `()` change
   that was made and reverted for putting
   `Laser engraving \(up to 20 characters\)` in front of a seller.

**Alternatives considered**: adding `=` to `ESCAPABLE` outright. Simpler to
write, and rejected for the reason in point 3. The narrow rule costs a few more
characters of regular expression and saves every seller who writes a price
comparison from reading backslashes.

## R6: the grammar learns the target, the parser does not

**Decision**: `emitInline` takes the target and a diagnostic sink.
`parseInline` keeps its current signature and stays target-free.

**Rationale**: the two new marks are the first constructs whose output depends
on the host, so something has to know. Splitting it this way keeps the
security-critical half, the parse, exactly as it is and testable on its own,
while the emit half becomes what every other emitter in `emit/` already is:
`(thing, target, sink)`.

**Alternatives considered, and why both are worse**:

- **Strip unsupported markers in a pass after `formatInline`.** This means
  parsing the compiler's own output to find markers the compiler just wrote,
  which is the exact shape of the forgery bug: a pattern cannot tell the
  seller's words from the compiler's structure once they are the same
  characters.
- **Emit the markers anyway and let the host show them literally.** Ruled out by
  Jakob's decision 2, and the worst of the three regardless. A seller who
  highlights "limited run" would show buyers `==limited run==`.

**Consequence to carry**: `emitProse` is currently the only emitter that takes
no sink. It gains one, and `emitBlock` in `compile.ts` passes it, which makes
the prose emitter look like the other five rather than like an exception.

## R7: the buttons must not let the textarea lose focus

**Decision**: the buttons cancel the default on `mousedown`, edit the live
control, restore the selection, and dispatch `input`.

**Rationale**: not a style preference. `typing()` in `store.ts` returns true
while a textarea holds focus and `repaint()` defers entirely while it does. A
plain button click blurs the field, which flips that false and repaints
mid-edit, and a repaint calls `replaceChildren` and destroys the textarea the
seller was working in. Dispatching `input` rather than calling the store
directly means the change travels the path `field()` already installs, so this
feature adds no second way for text to reach a document.

**Alternatives considered**: calling `updateBlock` from the button and letting
the repaint redraw the field. Rejected: it puts the caret at the mercy of
`captureCaret` and `restoreCaret`, which refuse to restore when a label changes,
and it would be the second path by which prose reaches the store.

**Prior art that makes this cheap**: `price-list-paste.ts` already patches its
own DOM for precisely this reason, and its comment at `:156-171` explains why.
