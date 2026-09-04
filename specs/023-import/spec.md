# Feature Specification: Bringing in a Price List

**Feature Branch**: `023-import`
**Created**: 2026-09-04
**Status**: Specified before implementation.
**Input**: F3 of the four features the 2026-09-02 ideas decomposed into. The
decomposition, and the code review evidence that F2 had to come first, are in
`specs/021-starting-points/spec.md` under "What this is part of".

## The problem

A seller who is going to use this tool already has their price list. It is in a
note on their phone, a column in a spreadsheet, an old rentry page they are
replacing, or a message they have pasted into Discord forty times. Right now the
only way in is to retype it, one item at a time, into the form. Somebody with
sixty products will not do that, and the tool loses them at the first screen.

Feature 021 answered the empty page with eight starting points. This answers the
other half of the same problem: not "I do not know what to put here" but "I know
exactly what goes here and it is already written down somewhere else".

## Two corrections before anything else

Both of these were stated as fact in the request that opened this feature, and
both are wrong about the code as it stands on 2026-09-04. They are recorded here
rather than quietly fixed, because a specification that assumes a mechanism the
codebase does not have produces a plan that cannot be built.

**There is no undo stack.** `State.undo` (`app/src/store.ts:69`) is a single
optional value with three kinds, `block`, `row` and `bulk`. Feature 022 added
the `bulk` kind; it did not add a stack, and `specs/021-starting-points/spec.md`
was correct when it called this out as a gap and 022 chose to fill it a
different way. More than that, `update()` (`app/src/store.ts:498`) deletes the
offer on the next write of any kind, and typing counts. So a seller gets exactly
one undo of an import, and it is gone the moment they touch anything else. That
is a real constraint on this feature, not a detail: see FR-064.

**The word "import" is taken.** `app/src/import.ts` already exists and means
"open a backup JSON file as a new page". It is reached from two places,
`openBackupControl()` at `app/src/ui/export.ts:57` and the starting point picker
at `app/src/ui/build.ts:150`. Nothing in this feature may be called "import" in
anything the seller reads, because the app would then offer two unrelated things
under one word, one of which replaces the page and one of which does not. This
document uses "bringing in a price list" for the feature and expects the button
to say something closer to "Paste a price list".

## What this is not allowed to do

**Nothing is discarded until the seller says so.** This is the whole design, and
it comes from `specs/021-starting-points/spec.md`, which specified F3 as a
consumer of F2's selection rather than as a parser subsystem: "the paste stays
on screen as text, the seller selects the lines that are items, and one bulk
action converts the selection. That version cannot silently mangle anything,
because nothing is discarded until they say so." A format sniffer that is wrong
about a line must cost the seller a tick box, not their data.

**Prices are free text on purpose.** `engine/src/document/descriptor.ts:73` says
why: "Artists write '45', 'from 45', '45+', and 'DM me'. A numeric type would
either reject real prices or discard what they wrote." `parseMoney`
(`app/src/money.ts:32`) already refuses to guess and returns `undefined` rather
than a wrong number. Bringing in a price list may use that parser to *suggest*
which part of a line is a price. It may never use it to rewrite what the seller
wrote. Text that does not parse is carried across exactly as typed.

**Rows are addressed by id, never by position.** `MENU_TIER_FIELDS` has carried
`id` since schema version 3 (`engine/src/document/descriptor.ts:64`), added by
022 for precisely this feature, and the comment there says what is at stake:
"Held by position instead, a selection points at the wrong products the moment
anything moves, and repricing the wrong products is the worst thing this feature
could do." New rows get ids from `newId()`, the same way `forms.ts:217` makes
them today.

**Cost must never reach the compiler.** If a pasted line carries what the seller
paid, it lands in the `cost` field, which is stored and never published.
`engine/tests/compile/cost-never-published.test.ts` already enforces that for
every target. This feature adds a new way to populate `cost`, so it must be
covered by that guard rather than assumed to be.

**This changes no schema.** `SCHEMA_VERSION` is 3 and stays 3. Everything a
brought-in row needs already exists as a field: `name`, `price`, `unit`,
`blurb`, `cost`. If this feature finds itself wanting a schema change, that is
a signal the scope has drifted, and it should stop and say so.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Paste a list and turn the real lines into products (Priority: P1)

A seller has thirty items in a note on their phone, one per line, roughly in the
shape "Bananas - $4 per lb". They paste the whole thing into the app. What they
pasted stays on screen as text, one line per row, with the lines that look like
items already ticked and the lines that look like headings, blank space or
chatter left unticked. They correct the ticks where the guess was wrong, press
one button, and those lines become products in a price list.

**Why this priority**: This is the feature. Everything else here is a refinement
of it, and shipped alone it already removes the retyping that loses the seller
at the first screen.

**Independent Test**: Paste a thirty line list containing five lines that are
not items, confirm the five are not ticked, press the convert button, and
confirm the price list holds twenty five products and that the five non-items
were not turned into anything.

**Acceptance Scenarios**:

1. **Given** a pasted list of thirty lines where five are headings or blank,
   **When** the seller opens the paste screen, **Then** the twenty five item
   shaped lines are ticked and the five others are not, and a count on screen
   says how many are ticked.
2. **Given** the sniffer has ticked a line that is actually a heading,
   **When** the seller unticks it and converts, **Then** that line becomes no
   product and no row is created for it.
3. **Given** the sniffer has failed to tick a real item, **When** the seller
   ticks it and converts, **Then** it becomes a product like any other.
4. **Given** a converted list, **When** the seller looks at the price list,
   **Then** every row carries a distinct id and the rows are in the order the
   lines were pasted in.

---

### User Story 2 - A line whose price cannot be read still becomes a product (Priority: P1)

Among the pasted lines are "Custom piece - DM me", "Stickers, from 3" and
"Commissions: 45+". None of those is a number. All three are real products and
all three are how sellers actually write. They convert into products with those
exact words kept, not dropped and not turned into a number.

**Why this priority**: Same priority as story 1 because it is not a refinement
of it, it is the correctness condition on it. A conversion that silently loses
"DM me" is worse than no conversion, and it is the specific failure the free
text price field exists to prevent.

**Independent Test**: Paste three lines whose prices are "DM me", "from 3" and
"45+", convert them, and confirm all three products exist with the price text
carried across character for character.

**Acceptance Scenarios**:

1. **Given** a line reading "Custom piece - DM me", **When** it is converted,
   **Then** a product named "Custom piece" exists with the price text "DM me".
2. **Given** a line the sniffer cannot split into a name and a price at all,
   **When** it is converted, **Then** the whole line is kept as the product name
   and the price is left empty, rather than the line being skipped.
3. **Given** any converted line, **When** its text is compared to what was
   pasted, **Then** no character of what the seller wrote has been altered by
   the conversion, only distributed between fields.

---

### User Story 3 - Undo the whole thing in one press (Priority: P2)

The seller converts, looks at the result, and it is wrong: they picked the wrong
lines, or the sniffer split them at the wrong place, or they simply changed
their mind. One press puts the page back exactly as it was before the
conversion.

**Why this priority**: P2 rather than P1 because stories 1 and 2 are usable
without it and it is not the thing being bought. It is high P2 rather than low
because feature 014 established, and 022 followed, that undo is this project's
answer instead of a confirmation dialog, and a conversion that writes thirty
rows is exactly where a confirmation would otherwise creep back in.

**Independent Test**: Convert a selection, press undo, and confirm the document
is byte for byte what it was before the conversion.

**Acceptance Scenarios**:

1. **Given** a conversion that has just written twenty five rows, **When** the
   seller presses undo, **Then** the price list is exactly as it was before,
   including any rows that were already there.
2. **Given** a conversion that has just happened, **When** the seller types
   anything at all first, **Then** the undo offer is gone, because
   `update()` clears it, and the screen must not still be offering it.
3. **Given** a conversion, **When** it is undone, **Then** the pasted text is
   still on screen with the same ticks, so the seller can correct the selection
   and convert again rather than starting over.

---

### User Story 4 - Open a file instead of pasting (Priority: P3)

The list is a `.csv` or `.txt` on the device rather than something the seller
can paste. They open it and land on the same screen, with the same ticks and the
same convert button.

**Why this priority**: P3 because on the platform the owner actually uses, an
Android phone (features 009 and 010), the list is far more likely to be pasted
than filed, and because the file is only a different way to fill the same text
box. It is worth having because the app already has a file picker to copy, at
`app/src/ui/export.ts:57`, so this is a small addition rather than a new
surface.

**Independent Test**: Open a `.csv` from the device and confirm the paste screen
fills with its contents and behaves identically from that point on.

**Acceptance Scenarios**:

1. **Given** a `.txt` or `.csv` on the device, **When** the seller opens it,
   **Then** its text appears on the paste screen exactly as pasting it would
   have.
2. **Given** a file that cannot be read as text, **When** the seller opens it,
   **Then** they are told so and nothing on the page has changed.

---

### Edge Cases

- **A pasted line containing more than one number.** "2 lb bag, $12" has a
  number in the name and a number in the price. The sniffer's guess is a
  suggestion, so being wrong here costs a correction, not data.
- **A price on its own line, under the name.** Some lists are two lines per
  item. This is out of scope for the sniffer, which works line by line, and the
  seller can still convert and then join them by hand.
- **Nothing ticked.** The convert button does nothing and says so, rather than
  creating an empty price list.
- **A paste of ten thousand lines.** The screen has to stay usable, or say
  plainly that the paste is too large, rather than freezing the phone.
- **A paste containing Markdown table pipes or a leading "- ".** Very common,
  since the seller is coming from a Markdown host. The list separators must not
  end up inside product names.
- **Converting twice without undoing.** The second conversion appends rather
  than replacing, and only the second one is undoable, because the offer is a
  single slot.
- **The seller edits a row, then presses undo.** The offer is already gone by
  then. The screen must not have been showing it.

## Requirements *(mandatory)*

Numbering continues from feature 022, whose last requirement is FR-056b.

### Functional Requirements

- **FR-057**: The app MUST offer a screen where a seller can paste arbitrary
  text, reached from a price list section on the Build screen, and named so that
  it is not confusable with opening a backup.
- **FR-058**: Pasted text MUST be shown as text, split into one row per line,
  and MUST remain on screen and unaltered until the seller converts. No pasted
  line may exist as a product, be saved, or be capable of being published before
  the seller converts it.
- **FR-059**: Each line MUST carry a tick, and the app MUST pre-tick the lines
  that look like items and leave the others unticked. A wrong guess MUST be
  correctable by the seller in one action per line.
- **FR-059b**: The app MUST infer a delimiter for the paste as a whole, covering
  at least commas, tabs, Markdown table pipes and dashes, and MUST fall back to
  splitting on the last number in the line when no delimiter is found.
- **FR-059a**: The app MUST offer tick all and untick all, matching FR-055's
  guarantee for price list rows.
- **FR-060**: The screen MUST show how many lines are currently ticked, counted
  live.
- **FR-061**: Converting MUST turn each ticked line into one product, in the
  order the lines appear, and MUST leave unticked lines untouched.
- **FR-061a**: Each created product MUST receive a distinct id, so that the
  selection and bulk pricing of feature 022 work on brought-in rows exactly as
  they do on typed ones.
- **FR-061b**: Converted products MUST be added to the price list the seller
  started from, appended after any rows already in it. Where the page holds no
  price list, the app MUST create one. The app MUST NOT replace the open page,
  which is what opening a backup does and what this must not be mistaken for.
- **FR-062**: Where a line can be split into a name and a price, the app MUST
  put each part in its own field. Where it cannot, the app MUST keep the whole
  line as the name and leave the price empty. It MUST NOT skip the line.
- **FR-062a**: Price text MUST be carried across exactly as written, including
  text no parser can read, such as "DM me", "from 45" and "45+". The app MUST
  NOT substitute a number for what the seller wrote.
- **FR-062b**: List decoration MUST NOT end up in a product name: a leading
  "- ", "* ", "1. ", or surrounding Markdown table pipes are separators, not
  part of what the seller is selling.
- **FR-063**: Where a line carries what the seller paid as well as what they
  charge, the app MUST place it in `cost`, which is never published. The
  guarantee enforced by `engine/tests/compile/cost-never-published.test.ts` MUST
  hold for rows created this way.
- **FR-064**: A conversion MUST be undoable in one action, restoring the price
  list to exactly its prior contents. Because `State.undo` holds one offer and
  `update()` clears it on the next write, the app MUST NOT present the offer
  after it has been cleared, and MUST NOT imply that more than the most recent
  conversion can be undone.
- **FR-064a**: Undoing a conversion MUST leave the pasted text and its ticks on
  screen, so the seller can correct and convert again.
- **FR-065**: The app MUST accept a text file from the device as an alternative
  to pasting, and MUST report a file it cannot read without changing anything.
- **FR-066**: Converting nothing MUST do nothing, and MUST say so rather than
  creating an empty section.
- **FR-067**: Every control added by this feature MUST carry a real accessible
  name and meet the touch target minimum, which `npm run a11y` enforces.

### Key Entities

- **Pasted text**: What the seller supplied, held as text for as long as the
  screen is open. Not part of the document and never saved into it.
- **Candidate line**: One line of that text, its tick state, and the app's guess
  at how it splits into a name, a price, a unit and a cost. Exists only on this
  screen. A guess, never a commitment.
- **Product (existing)**: A menu tier as `MENU_TIER_FIELDS` already defines it.
  This feature creates these and adds no field to them.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A seller with a thirty item list gets it into the tool in under
  two minutes, against the twenty or more minutes retyping takes.
- **SC-002**: For a list written one item per line with a visible price, at
  least ninety per cent of lines are ticked correctly without the seller
  touching a tick.
- **SC-003**: No character of what the seller pasted is altered by conversion.
  Every price, including the unreadable ones, appears in the product exactly as
  it was written.
- **SC-004**: A conversion of any size is undone in one action, and the
  resulting document is identical to the one before it.
- **SC-005**: A seller who picks the wrong lines loses nothing: the text is
  still on screen and still correctable at every point before and after
  conversion.

## Assumptions

- The list is one item per line. Multi line records are out of scope for the
  sniffer, and the seller can repair them afterwards in the form.
- The seller is on a phone (features 009 and 010 are the platform actually
  used), so pasting is the primary route and opening a file is the secondary
  one.
- Conversion adds to the price list the seller started from rather than
  replacing the page. This is not `openBackup`, which does replace, and the two
  must not behave alike.
- The `cost` column is uncommon in a pasted list, so reading it is a
  convenience, not a requirement the sniffer has to get right often.
- Feature 022's selection and bulk pricing are the tools for what happens next.
  A seller who brings in sixty items with costs and no prices is expected to
  select them and price them with the panel 022 built, and this feature does not
  duplicate any of that.

## What this does not do

**No interview wizard.** That is F4, deferred, and gated on whether the starting
points from F1 are used at all. `specs/021-starting-points/spec.md` says why:
building a question by question interview before knowing whether a starting
point was enough would be guessing.

**No fetching from a URL.** "Bring in my old rentry page" by address means a
network fetch, a CORS problem and a proxy, and the seller can paste the text in
seconds. If it is wanted it is its own feature.

**No writing back out to a spreadsheet.** Export exists and is a different
surface.

**No image import.** A pasted line naming a picture does not become
`imageUrls`. That is features 006 and 020's surface and it involves an upload.

**No second pass on the unticked lines.** After conversion the unticked lines
are still on screen, and the seller may tick them and convert again. The app
does not track which lines have already been converted, which is why converting
twice appends twice. Making the screen remember what it already did is a
refinement worth having only if the second pass turns out to be common.

## Decisions taken on 2026-09-04

Three questions shaped the work materially and each had more than one
defensible answer. They were put to Jakob rather than guessed at, and the
reasoning is recorded here because the reasoning is the expensive part to
reconstruct later.

**The paste screen owns its own ticks. The text stays text.**

The alternative was to land the paste as draft rows in a menu section and reuse
F2's row selection verbatim, which is the more literal reading of "a consumer of
F2" and would have cost no new selection code at all. It was rejected on a
hazard rather than on taste: a draft row is not a draft. It is a real product in
a real `menu` block, so it is written to IndexedDB by the next `save()`, it
survives a reload, it compiles, and it appears on the published page. A seller
who pasted sixty lines to convert twenty five of them would have had thirty five
lines they never agreed to sitting in a page they might publish. That is the
exact inversion of the rule this feature is built on, so the second selection
mechanism is the price of correctness and it gets paid.

**Conversion fills the price list the seller came from, and creates one only if
the page has none.**

Always creating a new section was the predictable option, and it leaves somebody
who meant "fill in this list" holding two lists and a manual merge. Putting the
entry point on a price list section instead makes "which list" a question the
seller has already answered by pressing the button where they pressed it, which
also disposes of the awkward case of a page with three price lists without a
tie breaking rule.

**The sniffer infers a delimiter per paste, and falls back to the last number in
the line.**

Splitting on the last number is nearly impossible to get badly wrong, and it is
poor on the CSV and Markdown table output these lists are actually pasted from,
which is most of them. SC-002 asks for ninety per cent of ticks correct
untouched, and the fallback keeps the bad case cheap: a wrong guess costs one
tick, by construction, because nothing is committed until the seller converts.
