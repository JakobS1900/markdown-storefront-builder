# Feature Specification: What the Price Buys, and What the Item Is

**Feature Branch**: none, straight onto master.
**Status**: Specified before implementation on 2026-09-01.
**Input**: The owner, testing as a merchant rather than as an artist: "I want
item, price, and amount", and "if they are selling food for example, 1lb of
bananas for $20".

## The problem

A price list item is a name and a price. That is enough to sell a drawing,
because a drawing is one thing and the price is for the whole of it.

It is not enough to sell anything measured, and it is not enough to sell
anything that comes in variations. **Twenty dollars of bananas is not a price
until you know it buys a pound.** A phone at a hundred and eighty is not a
listing until you know which colour and how much storage.

Both are currently possible only by writing them into the item's name or its
description, which means they are prose rather than data: they cannot be laid
out in a column, they cannot be kept consistent between items, and they read as
an afterthought because they are one.

## What is being added

Two optional fields on a price list item.

**`unit`**: what one of the price buys. "per lb", "each", "per dozen",
"per hour", "per 100g". A free string rather than a list, because the set of
things people sell by is not enumerable and a wrong list is worse than none.

**`details`**: any number of labelled facts about the item, each a label and a
value. Colour: black. Storage: 128GB. Origin: Ecuador. Again a free label
rather than a fixed set, for the same reason: this has to serve a knife maker,
a greengrocer and somebody selling phones without any of them being second
class.

## What is deliberately not being added

**Quantity break pricing**, as in one for twenty, five for ninety, ten for a
hundred and fifty, with the saving worked out. It was offered and not chosen.
It is a nested structure inside an item, several more fields to fill in, and a
table that has to degrade on hosts without tables, and none of that is worth
carrying before somebody has actually asked for it twice.

Bulk pricing remains expressible, and is the reason this is enough for now: a
second row reading "Bananas, 5 lb" at its own price says the same thing, in the
same table, with nothing new to learn.

## Requirements

- **FR-025**: A price list item MUST be able to state what its price buys, and
  that statement MUST appear beside the price rather than in the description.
- **FR-026**: A price list item MUST be able to carry any number of labelled
  details, with labels chosen by the seller.
- **FR-026a**: A detail with no label or no value MUST NOT reach the page. The
  same rule the item itself already follows: an empty row is a row somebody
  started and abandoned, not a thing they meant to publish.
- **FR-027**: Both are optional, and a page that uses neither MUST compile to
  exactly what it compiles to today. This is the guarantee that makes the change
  safe to land, and it is checked by every existing golden file staying
  byte identical.

## Order of work, and why

The contract lands first and alone, guarded by the parity test, before anything
reads the new fields. That is the project's oldest rule and it exists because
this schema crosses the engine, the app, IndexedDB and the export file, so a
field that means one thing in one place and another somewhere else is a defect
that surfaces months later as data loss.

1. The two fields in the descriptor, and the parity snapshot regenerated.
2. The compiler: the price line, the details column, and the fallback for a
   host without tables.
3. The form.

## How it renders

The unit follows the price in the same cell: `$20 per lb`. It attaches to the
price and not to the item, because "Bananas, per lb" answers a different
question from "$20 per lb".

Details become their own column, present only when at least one item in the
section has any, which is the rule the sample image column already follows. A
column of empty cells is a worse table for everybody who does not use the
feature.

Without tables, an item's details follow its name as a bullet list, which is
what the existing fallback already does for what is included.
