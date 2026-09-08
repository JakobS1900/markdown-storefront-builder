# Research: Selling modes

**Feature**: 026-selling-modes
**Date**: 2026-09-08

Five decisions. None of them reverses anything, which is unusual for this
project lately, and the reason is that the shape already exists in the schema.

---

## D1: An optional enum, which the contract already knows how to express

**Decision**: `availability` as an optional `enum` with three values, and
`leadTime` as an optional `string`, both on a menu tier.

**Rationale**: This is not a new kind of field. `BLOCK_FIELDS.profile` already
carries `{ name: "status", type: "enum", required: false, values: ["open",
"closed", "waitlist"] }`, which is the same shape doing the same job one level
up: a small fixed set describing how to approach the seller. The validator, the
canonical writer, the parity snapshot and the derived types all handle it
already, so this adds an instance rather than a mechanism.

`leadTime` is text for the reason `price` and `unit` are, stated in the
descriptor: sellers write "about 2 weeks", "3 to 5 days" and "ships in March",
and a date type would refuse most of those or quietly discard what was typed.

**Alternatives considered**:

- **Two booleans**, `madeToOrder` and `preorder`. Rejected: they can both be
  true, which means nothing, and the invalid state would have to be prevented
  everywhere rather than made unrepresentable once.
- **Free text for the mode too.** Rejected: then the app cannot lay it out
  consistently, cannot ask about it in a wizard, and cannot ever act on it,
  which is the whole reason this is not just another `details` line.

---

## D2: Four values, after being specified as three and overruled

**Decision**: `in-stock`, `made-to-order`, `preorder`, `sold-out`.

**This was the one decision flagged as expensive to revisit**, and flagging it
is what got it right. The validator refuses a page carrying an enum value it
does not recognise, so a value added in a later version makes new pages
unreadable to builds already installed. That is recoverable, FR-018 hands the
exact bytes back, but it is a bad afternoon and it argues for settling the set
before anything ships rather than after.

**It was originally specified WITHOUT `sold-out`,** on this reasoning: `price`
is already free text specifically because sellers write things that are not
numbers, so writing "SOLD OUT" in it is what they already do, and a second way
to say the same thing would split the practice between rows that say it in the
price and rows that say it in the mode.

**Jakob overruled it the same day: "people use that a lot."**

That is first hand knowledge of the sellers this is for, and it is precisely the
evidence the original argument lacked. The argument was not wrong that the
workaround exists. It was wrong about what the workaround means. A thing people
do constantly through a field that was not designed for it is a missing feature
being worked around, not a convention that has settled. The same mistake, in the
other direction, is what left the price breakdown called "Bulk pricing" for a
year: a capability nobody could find, because the evidence for how people
actually behave was not in the room.

**Recorded rather than edited away**, because the reasoning that produced the
wrong answer is reusable and the answer alone is not.

**Sold out does not suppress a wait.** "Sold out, back in about two weeks" is a
useful sentence. Nothing refuses a wait because of the mode beside it.

---

## D3: Where it lands in the output, which is beside the price and not among the details

**Decision**: A conditional `Availability` column in the table layout, and a
line in `itemBody` for the per item and no-tables layouts.

**Rationale**: The conditional column is an established pattern here and its
reasoning applies exactly. `Details` and `Example` appear only when some tier
has one, because "an empty column on every row would be a worse table for
everyone who does not use the feature". A selling mode is the same: most rows in
most price lists will have none.

`itemBody` is shared by `tierBlock` and `tierList`, so putting the line there
covers the per item layout and the no-tables fallback in one place, and keeps
them from drifting. That sharing is deliberate and already documented in the
emitter.

**Not appended to the price**, the way `unit` is. `unit` qualifies the number,
"twenty dollars of bananas is not a price until you know it buys a pound".
Availability qualifies the offer, not the number, and "$45, made to order, about
two weeks" reads as a price with two things wrong with it.

---

## D4: The words are the app's, the wait is the seller's

**Decision**: The stored value is `made-to-order`; the page says "Made to
order". The wait is emitted as the seller typed it.

**Rationale**: A buyer should not read the app's identifiers. And a seller who
wrote "about 2 weeks" should not have it title-cased into "About 2 Weeks",
which is why only the mode gets a phrase and the wait is passed through.

Together they read as one statement, FR-112: "Made to order, about 2 weeks". A
wait with no mode is emitted alone, because how long something takes is worth
saying even when the reason is not.

---

## D5: The whole feature has to be invisible to every page that exists

**Decision**: The migration stamps the version and creates nothing, and a test
compiles a version 4 page before and after and demands byte identical output for
every target.

**Rationale**: FR-110 and SC-001. Every page in existence has neither field, so
if any of them changes by a byte, something is wrong with the emitter rather
than with the page.

Feature 024 did exactly this and it was worth having: `migrate-local-pictures`
compiles the old fixture on both sides of the migration rather than asserting
that adding an optional field cannot matter. The same test, one version later.

---

## Nothing here is a capability

Every host can render words. No flag on `Capabilities`, no citation on any
target, no golden set for a new host. Golden files for the existing three DO
change, but only for a fixture that uses the new fields, and any change to a
fixture that does not use them is a defect this feature must not ship.
