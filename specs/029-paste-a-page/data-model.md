# Data Model: Bringing In a Page You Already Have

Phase 1.

## The saved page schema does not move

`SCHEMA_VERSION` stays at **5**. No field is added, removed, renamed or
reordered, and `engine/tests/document/parity.snapshot.json` must be byte
identical before and after this feature. FR-029-06 and decision 6 in the spec.

**That is a testable claim, not an intention.** The parity test already fails on
any change to the descriptor, and this feature has a task that asserts the
snapshot is untouched at the end.

Everything below exists only in memory, only while the panel is open, and is
never serialized.

## What the reader produces

### `Line`

One line of the paste, classified. Exported by `app/src/page-text.ts`.

| Field | Type | Meaning |
|---|---|---|
| `text` | string | The line exactly as pasted, never altered |
| `kind` | `blank` \| `heading` \| `headingUnderline` \| `rule` \| `tableRule` \| `tableHeader` \| `text` | R3's table, plus the seventh kind below |
| `level` | 1 to 6, only on `heading` | From the `#` count, or 1 for `=` and 2 for `-` |

**`headingUnderline` is the seventh kind and R3 did not name it.** Chunk 1 found
it on 2026-09-12. A row of `=` or of `-` under a paragraph line, both of which R4
covers, is not the heading, is not a rule and is not text, and it has to be
something: every line index lands in exactly one run or the losslessness property
is a lie. The alternative, leaving
it classified `text` inside a heading run, leaves every later reader asking why a
heading run holds a text line.

`level` is a plain number rather than a union of six literals, because the
constraint lives in the descriptor, integer with min 1 and max 6, and the
validator enforces it there. The `#` pattern caps the count at six by
construction, so a union here would buy a cast rather than a guarantee.

### `Run`

One group of neighbouring lines, and the range of the paste it claims. The
contract chunk 1 exists to produce.

| Field | Type | Meaning |
|---|---|---|
| `kind` | `blank` \| `heading` \| `rule` \| `text` | Coarser than `LineKind`: a table's header, rule and rows are all one `text` run |
| `from`, `to` | number | First and last line index, inclusive |
| `lines` | `readonly Line[]` | The lines themselves |

**Blank lines get runs of their own.** They produce no section, so skipping them
would have been cheaper, and it would have put the burden of remembering where
the gaps were onto every caller that wants to prove nothing was lost. A blank run
costs one object and turns reassembly into a plain concatenation.

### `Proposal`

What the reader returns for one paste. A pure function of the text, so it is
recomputed rather than stored beside it, for the reason `pastePanel` already
gives about its own candidates: "storing a derived value next to the thing it
derives from is how the two drift apart."

| Field | Type | Meaning |
|---|---|---|
| `sections` | `readonly ProposedSection[]` | In the order they will appear |
| `title` | string, optional | R7. Present only when the paste opens with a heading |

`title` is a copy. It does not consume the heading line: the line still appears
either as a Heading section or, when R6 applies, inside the absorbed menu
section's `source`.

### `ProposedSection`

| Field | Type | Meaning |
|---|---|---|
| `kind` | `heading` \| `divider` \| `prose` \| `menu` | The four Jakob chose. Never `gallery` or `profile` |
| `source` | string | The pasted lines this came from, joined, verbatim |
| `from`, `to` | number | Line indices, so the panel can prove every line is accounted for |
| `swappable` | boolean | True only for `prose` and `menu`. FR-029-18 |

The section's CONTENT is not held here. It is derived from `source` when needed,
which is what makes FR-029-18a true without any code to make it true: swapping a
section to Prices and back re-reads `source`, so it returns exactly what was
first proposed. A swap cannot damage anything because a swap converts nothing.

**`source` for a `menu` section includes the heading line above it** when one was
absorbed. R6. That is what makes a swap to Text give the heading back.

## What the panel holds

### `pastingPage` in the store

A new field, separate from `pasting`. R12.

| Field | Type | Meaning |
|---|---|---|
| `text` | string | What is in the box right now |
| `dropped` | `readonly number[]` | Indices of sections the seller unticked |
| `swapped` | `readonly number[]` | Indices the seller flipped to the other of Text and Prices |

Both lists are indices into the recomputed `sections`, which is safe for the same
reason 023's `ticked` is: the proposal is a pure function of `text`, so it changes
only when `text` changes, and the two places `text` changes both clear the lists.

**Absent means not pasting.** The panel is on screen when this field exists, which
is how `pasting` already works.

## What is built when the seller confirms

A `Document` at schema version 5, built section by section, then serialized and
handed to `openBackup`. R8.

| Proposed | Block built |
|---|---|
| `heading` | `{ kind: "heading", text, level }` |
| `divider` | `{ kind: "divider" }` |
| `prose` | `{ kind: "prose", text }` |
| `menu` | `{ kind: "menu", tiers, heading? }` |

`menu.tiers` are built by `toProducts`, which already exists, plus the `id` each
row needs, which is `newId()` and is the one impure thing in the whole path. It
stays in the store, outside the reader, so the reader keeps R1's purity.

The document's `target` is copied from the page currently open, and its `title`
is the proposal's title when there is one and absent otherwise. FR-029-25 forbids
inventing one.

## The fields this feature never writes

Recorded because a reviewer should be able to check it in one pass, and because
each has a reason that is not arbitrary.

| Field | Why not |
|---|---|
| `localImageIds`, `localAvatarId` | They name pictures held on this device. Nothing in a pasted page can refer to this device's storage. FR-029-29 |
| `cost` | `readLine` can produce one from a spreadsheet paste of the seller's own columns. A pasted PUBLIC page has no supplier cost in it, and inventing one from a second number would put a figure in the field the compiler is forbidden to publish |
| `availability`, `leadTime` | Closed enum plus free text, both introduced by 026 with a wizard question behind them. Guessing "made to order" from prose is a guess with a consequence the seller did not ask for |
| `quantities`, `details`, `addOns`, `includes` | Real structure the reader has no reliable signal for. The seller adds them afterwards, which is the whole point of bringing the page in |

**`cost` is the one worth arguing about**, because `readLine` returns it and
`toProducts` carries it. The decision is to drop it on this path only: the same
function, called from 023, still produces it, because there the seller pasted
their own spreadsheet. Here they pasted their shop window.
