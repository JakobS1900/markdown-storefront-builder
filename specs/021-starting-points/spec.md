# Feature Specification: Starting Points

**Feature Branch**: none, straight onto master, consistent with 004 onwards.
**Status**: Specified before implementation on 2026-09-02.
**Input**: Three feature ideas raised on 2026-09-02: importing a menu somebody
already has, a template wizard, and bulk pricing maths over many items at once.
This document specifies the first of the four features they decompose into, and
records the decomposition so the other three are not lost.

## The problem

A new arrival opens the app to an empty form and a row of buttons. Feature 019
already found this and fixed half of it: the empty state offers "See an example
page", which fetches `app/public/example.json` and opens a complete twelve block
storefront through `openBackup`.

That fix has two limits, and both are about the same thing.

1. **It is one example, and it is a knife shop.** Somebody selling 3D prints,
   art commissions, or dropshipped goods sees a page about folding knives and
   has to translate. The example proves the app works. It does not show them
   their own shop.
2. **It is only reachable from the empty state.** `app/tests/example.test.ts`
   asserts the button is gone once there is a page of their own, which is
   correct for an example. But "Start a new page" on the Build surface
   (`app/src/ui/build.ts:241`) makes a blank page and always has. The second
   page somebody makes gets no help at all.

The deeper problem is the one `idea.txt` opens with: people pay somebody who
understands Markdown to set these pages up for them. A blank form does not
reduce that. A finished page in their own trade does.

## What this is part of

Three features were raised together. They are four, and this is the first.

**F1, this document. Starting points.** Depends on nothing, changes no schema.

**F2, selection and bulk apply.** The load-bearing one. A code review on
2026-09-02 established that neither F3 nor the pricing maths can be built
honestly without it, and named four reasons:

- **Menu tiers have no identity.** `MENU_TIER_FIELDS`
  (`engine/src/document/descriptor.ts:64`) has no `id`. Every row operation in
  `app/src/ui/forms.ts` addresses rows by array index: `editTier(i, ...)` at
  line 332, `moved()` splices by position at line 169. A held selection of
  "these 40 of 60" points at the wrong rows after any reorder or removal.
- **Undo does not cover edits.** `State.undo` (`app/src/store.ts:33`) is a
  single optional value, not a stack, and only `removeBlock` and `removeRow`
  ever set it. `update()` clears it. A bulk price change across 40 items would
  record no undo at all. Feature 014 removed a confirmation on the principle
  that undo is the better answer, and a bulk operation is exactly where a
  confirmation would otherwise return.
- **Cost must never reach the compiler.** Profit per item means the app knows
  what the seller paid. The app's whole purpose is to compile a page and publish
  it. `cost` is therefore a stored field with a test that fails if any target
  emits it.
- **Prices are free text on purpose.** The descriptor says why at line 70.
  Arithmetic over them must skip what it cannot parse and say so, never guess.
  "45" and "from 45" compute. "DM me" is skipped, visibly.

**F3, import.** Paste or file, sniff the format, turn it into items. Specified
as a consumer of F2 rather than its own parser subsystem: the paste stays on
screen as text, the seller selects the lines that are items, and one bulk action
converts the selection. That version cannot silently mangle anything, because
nothing is discarded until they say so.

**F4, the interview wizard.** Deferred, and deliberately gated on whether F1 is
used. A question by question interview is the strongest answer to the problem in
`idea.txt`, and it is also a whole surface with its own state machine. Building
it before knowing whether a starting point is enough would be guessing.

## Requirements

- **FR-053**: Starting a new page MUST offer a set of starting points, each of
  which creates a page already containing sections and content for one kind of
  seller.
- **FR-053a**: Choosing a starting point MUST NOT modify or replace the page
  already open. It arrives as a new page with its own id, on the same rule
  `openBackup` follows and for the same reason.
- **FR-053b**: Adding a starting point MUST require adding files to one
  directory and editing nothing else. No list, no manifest, no registration, no
  code change of any kind.

  This said "one file" when it was written on 2026-09-02 and was corrected the
  same day, before implementation, because it was measured and found impossible.
  See "Why two files, measured".
- **FR-053c**: Every starting point MUST parse, validate, and compile with zero
  diagnostics against every target. A starting point that triggers a capability
  fallback teaches a shape the host cannot render, which is worse than offering
  nothing.
- **FR-053d**: A starting point MUST NOT put a claim about the seller's identity
  into their page. See "The honesty rule".
- **FR-053e**: The existing blank path MUST keep its current behaviour and cost
  no extra step. Somebody who wants an empty page presses one button, as today.
- **FR-053f**: The picker MUST remain usable as the set grows. It is designed
  for twenty entries from the outset, because it will have twenty.

## Behaviour

The picker is one folded group, headed "Start from a template", listing every
starting point as a button showing its label and one line saying who it is for.
Choosing one creates a new page from it and opens it, announced the way opening
the example is announced.

It appears in **two** places, because the two entrances serve different people
and neither covers the other:

- **In `Your pages`, beside "Start a new page".** The existing button is
  untouched: same label, same handler, same instant blank page. Somebody who
  wants an empty page still presses one button, which is FR-053e.
- **In the empty state, beside "See an example page".** This one is not
  optional, and the reason is in the code. `pageList` returns nothing at all
  when `state.pages.length === 0` (`app/src/ui/build.ts:130`), and that is
  correct: a new install used to open on "Your pages (0)", a list of nothing
  offering to start a second empty page. But it means a picker placed only in
  the pages group is invisible to somebody who has just arrived, who is the
  single person this feature exists for.

Being a folded `details` with a stable id costs no new state. `shell.ts:167`
already captures every open group before a repaint and reopens it afterwards,
so the picker stays open while the app repaints underneath it, for free.

### The launch set

Eight, chosen to span what these hosts are actually used for rather than only
the three trades that prompted the feature:

| Starting point | Who it is for |
|---|---|
| Art commissions | Tiers, slots, terms, examples. The oldest rentry use case |
| 3D printed goods | Sizes, materials, colours, turnaround |
| Dropshipping store | Many cheap items, bulk pricing, supplier links |
| Digital downloads | Presets, brushes, fonts, templates. No shipping |
| Freelance services | Hourly and per project, no physical goods |
| Handmade and crafts | Jewellery, candles, resin. One off and made to order |
| Food and bakes | Per item and per dozen pricing |
| Portfolio and about me | A showcase with no prices at all |

The last one is there because `idea.txt` names showcases and about me pages
alongside storefronts, and a builder that can only make shops would be a
narrower thing than the one described.

## How a starting point is stored

Two files per starting point, in `app/src/starters/`, sharing a stem:

```
art-commissions.meta.ts     export const meta = { label, description }
art-commissions.json        the Document itself
```

They are enumerated with `import.meta.glob`: the `.meta.ts` files eagerly,
because the picker has to show every label before anything is chosen, and the
`.json` files lazily, so each document is its own chunk and none is downloaded
until somebody picks it.

`import.meta.glob` rather than a fetch from `public/` is deliberate and buys
two things beyond FR-053b. The set is known at build time, so a missing file is
a build failure rather than a 404 in somebody's hands. And it has no URL to get
wrong: `app/tests/example.test.ts` carries a dedicated test that `example.json`
is requested by a relative path, because the app is served from a subdirectory
on the web and from the root of a custom scheme inside the Android shell. A
build time glob cannot have that bug.

### Why two files, measured

The first draft of this spec said one self-describing file per starting point,
holding its own label, description and document. That is not achievable
together with lazy loading, and the reason is worth recording rather than
rediscovering.

A file cannot be read for its label without being loaded. Probed on 2026-09-02
with two throwaway starters carrying marked payloads:

- **One file, `import.meta.glob(..., { eager: true, import: "meta" })`.** The
  eager reference to one named export pulls the whole module into the main
  chunk. No lazy chunks were emitted at all, and both payload markers were
  found in `index-*.js`. Rollup does not tree-shake the unused default export
  out when the same module is also the target of a dynamic import.
- **Two files sharing a stem.** Three chunks were emitted, one per starter plus
  the entry. Both payload markers were absent from the main bundle and each was
  present in its own chunk, while both labels were in the main bundle, which is
  exactly what the picker needs.

The cost of choosing eager instead would not be small. `example.json` is 9,725
bytes, 3,215 gzipped. Eight of those eagerly bundled is roughly 26 kB gzipped
added to a main bundle currently measuring 20.0 kB gzipped, so first load would
roughly triple for content of which a visitor uses at most one and most use
none. On a tool whose performance notes are written about a Moto G7, that is
not a trade worth making to save a file.

So FR-053b holds in the sense that matters, which is the one it was written for:
adding a niche is dropping files into a directory, and touches no code.

## The honesty rule

`example.json` is titled "Ridgeline Carry" and reads like a real knife business.
As an example somebody is shown, that is right, and it is the reason it
demonstrates anything.

As a starting point somebody keeps and publishes, a plausible business name is a
trap. So placeholder text is split by what kind of lie it would be if it
survived to publication.

**This section originally split that by field type: identity fields get
instructional text, structure fields get realistic content, with prose body
text filed under structure alongside tier names and prices.** That framing was
amended twice during implementation because it produced bad results on the same
block, and what follows is the version that survived, not the one first written.

The test is not what kind of field the text sits in. It is what kind of lie the
text would be if a seller published it unchanged: does it make a false claim
about who they are, what they will and will not do, their terms, or their
timings? If it does, it is identity-bearing regardless of which field holds it,
and it gets instructional text. If a seller publishing it unchanged is harmless
and obviously theirs to edit, it is structural, and it gets realistic content,
because realistic content is what actually teaches.

**The case that forced the correction: "What I will and will not draw"
(`art-commissions.json`).** Realistic content there means naming specific
categories of work a seller refuses. Naming them is not harmless structure the
way a tier name is: it is a claim about that specific seller's boundaries, and a
wrong one has a real person on the other end of it, somebody who does not
commission work the seller would actually have taken, or who commissions work
the seller will not do. It took two rounds to settle. `8e6064f` tried realistic
named categories, "NSFW content, extreme gore, and mecha or vehicle designs are
commonly declined", which is exactly this failure. `f7cc583` replaced it with
instructional text that names no category at all: "Write two short lists here:
what you are happy to take on, and what you are not."

**A third form was tried and rejected: realistic specifics followed by a
trailing "replace this" sentence.** `dropshipping-store.json`'s "Shipping" and
`art-commissions.json`'s "Terms" both originally read this way: "Orders go out
within two working days. Delivery is usually one to two weeks. Replace this
with your own times." The hybrid is not a legitimate third form, because the
trailing sentence is a signal, not a neutralizer. Delete only the meta-sentence
and the specific claim about turnaround survives untouched, published as fact.
`beef24f` rewrote both blocks to be instructional throughout, with no specific
claim left for the meta-sentence to be doing the work of disclaiming.

This is the same distinction `engine/src/document/empty.ts` already draws when
it refuses to write `""` as a title. An absent title is not an invented one.

**This rule is reviewer-judged, not gate-enforced.** `app/tests/starters.test.ts`
checks that every starting point parses, validates, and compiles with zero
diagnostics. Nothing in it, or anywhere else, checks whether a sentence is a lie
a seller could publish by accident. That reading happens once per starting
point, by a person, and nothing runs it again on the next change to the file.

## The gate

A test globs `app/src/starters/` and, for every file it finds and every entry in
the engine's exported `TARGETS` (`engine/src/compile/targets.ts:115`, currently
portable, rentry and text.is), asserts the document parses, validates, and
compiles with zero diagnostics.

Reading `TARGETS` rather than naming hosts means a host added by a later feature
gates every starting point on the day it lands, without this test being edited.
Feature 018 added text.is, so this is a thing that happens.

Globbing rather than listing is the point: a starting point contributed later is
gated automatically, and the gate does not change when the set grows to thirty.

This closes a gap that exists today. `app/tests/example.test.ts` mocks `fetch`
and never reads the real `app/public/example.json`, so nothing currently asserts
that the example actually shipped is valid, let alone that it compiles clean on
rentry. The shipped example is brought under the same gate.

## Carry-forwards

- **`scripts/contrast.mjs:123` finds the example button by matching
  `/example page/i` against its text.** Renaming "See an example page" silently
  breaks the colour contrast gate, which would then measure an empty page and
  report a pass that means nothing. That gate already refuses to report a pass
  under three sections and three fields, so it would fail loudly rather than
  lie, but the coupling is real and is recorded here rather than left to be
  rediscovered. The example, its file location in `public/`, and its button
  label are all unchanged by this feature.
- **The empty state keeps offering the example, and gains the picker beside
  it.** They are different things and both belong there. An example is shown to
  prove the app works, and is thrown away. A starting point is kept and
  published. Feature 019's reasoning for the example stands untouched; the
  picker is added next to it rather than in place of it, for the reason given
  under Behaviour.

## What this does not do

No interview, no question by question flow. That is F4 and it is deferred on
purpose.

No creating, editing, or saving your own starting points. No categories, no
search, no preview thumbnails.

Nothing about importing an existing menu, and nothing about pricing maths. Those
are F3 and F2, and F2 has to land before F3 is worth building.
