# Feature Specification: Quantity Pricing, and an Item With Room In It

**Feature Branch**: none, straight onto master.
**Status**: Specified before implementation on 2026-09-01.
**Input**: The owner, after using the previous feature: "it would look way
better to have it show the item name than on the right price. And then below
that, you set up the table. So one would equal that much, two would equal that
much. And then below there, then it's the quantities. So one for one hundred,
two for two hundred."

## This reverses a decision made in feature 016, on purpose

Feature 016 offered quantity break pricing and recorded that it was not taken:

> It was offered and not chosen. It is a nested structure inside an item,
> several more fields to fill in, and a table that has to degrade on hosts
> without tables, and none of that is worth carrying before somebody has
> actually asked for it twice.

That is now the second ask, from the same person, after using the thing. The
reasoning in 016 was not wrong and none of its costs have gone away. What
changed is the evidence: the substitute it relied on was tried and found
wanting.

016 argued that a second row reading "Bananas, 5 lb" at its own price says the
same thing with nothing new to learn. In a real list it does not. It reads as a
second product. A customer scanning the column sees bananas twice and has to
work out that these are the same item at two quantities, and the seller has to
repeat every detail on both rows or leave the second one looking unfinished.
**A bulk price is a property of an item, and putting it in a sibling row states
that it is a different item.**

So the cost 016 declined to pay is still the real cost, and it is now worth
paying. This specification does not delete that passage. A specification that
edits itself to agree with the code has stopped being a thing the code is
checked against.

## What is being added

**`quantities`**: any number of amount and price pairs on a price list item.
One lb for twenty, five lb for ninety, ten lb for a hundred and fifty. Both
halves are free text for the same reason `price` already is: people write "a
dozen", "5 lb", "2+", and a numeric type would either reject those or discard
what they wrote.

## What is deliberately not being added

**Worked out savings**, as in "save $10" or "17% off". It requires both prices
to be numbers, which `price` has never been, and it would silently do nothing
on exactly the informal listings this format exists to support. A seller who
wants to advertise a saving can write it, and it will be right, which is more
than a calculator that gives up on "DM me" can promise.

**A total or a subtotal.** This is a page somebody reads, not a checkout.

## The layout, and the condition on it

Three layouts were built as real Markdown and published to the host before
anything was written, so the shape could be judged on output rather than on a
description. The chosen one gives each item a small heading carrying its name
and price, with a plain two column quantity table beneath it.

**It applies only to a section where at least one item has quantities.** A
section without any keeps the single table it has today.

This condition is the whole reason the change is safe, and it is the same rule
the sample image column and the details column already follow: a feature that
costs everybody something must be present only for the people using it. The
per item layout costs two real things.

- **It removes the price scan.** One table lets a customer read down a single
  price column and compare everything at once. A block per item means comparing
  the third with the seventh is a scroll between two tables.
- **It makes a long list much longer.** Twelve items become twelve headings and
  twelve tables. On a phone that is a great deal of scrolling for somebody who
  only wanted to know what a bust costs.

An artist selling three commission tiers pays both of those and gets nothing,
because they have no quantities. So they do not pay them. This also means every
existing golden file must stay byte identical, which is how the condition gets
checked rather than merely asserted.

## Requirements

- **FR-028**: A price list item MUST be able to carry any number of amount and
  price pairs, with both halves written by the seller as free text.
- **FR-029**: A quantity pair missing either half MUST NOT reach the page,
  which is the rule FR-026a already applies to details and the item itself.
- **FR-030**: A section where no item has quantities MUST compile to exactly
  what it compiles to today, byte for byte.
- **FR-031**: A section where at least one item has quantities MUST lay every
  item in that section out per item, including the items that have none. Two
  layouts inside one price list would read as a rendering fault.
- **FR-032**: On a host without tables, an item's quantities MUST degrade to a
  list under its name and remain correct. This layout was chosen over the
  alternative specifically because it survives that.
- **FR-033**: The currency MUST attach to a quantity price by the same rule it
  attaches to the item price, so a list cannot show `$20` against `90`.

## How it renders

With tables:

```
#### Bananas, $20 per lb

| Quantity | Price |
| --- | --- |
| 1 lb | $20 |
| 5 lb | $90 |

Origin: Ecuador
```

The item heading is one level below the section heading, clamped to whatever
the host allows, which is the rule `sectionHeading` already follows.

Without tables, the same item becomes its bold name and price, then a list of
quantities, then its details, which is the shape the existing fallback already
uses for what is included.

## How it is entered

One line per break, in a single field, in the form people already write:

```
1 lb = 20
5 lb = 90
10 lb = 150
```

Split on the first `=` or `:`, whichever comes first, so somebody typing a
colon out of habit is not punished for it. This matches the details field,
which is already a single multiline box parsed per line, and it exists because
the alternative is two boxes per break: six controls on a phone for an item
with three prices, plus an add button and a remove button for each.

## Order of work, and why

1. The contract: `quantities` in the descriptor, parity snapshot regenerated,
   landing alone before anything reads it.
2. The compiler: the per item layout, its condition, and the fallback.
3. The form.

The first step is separate because this schema crosses the engine, the app,
IndexedDB and the export file, and a field that means one thing in one place
and something else in another is a defect that surfaces later as data loss.
