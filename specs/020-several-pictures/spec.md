# Feature Specification: Several Pictures Per Item

**Feature Branch**: none, straight onto master.
**Status**: Specified after implementation on 2026-09-01. The eighth finding of
the review in feature 019, separated from it because it changes the schema and
the other seven do not.
**Input**: The seller review: "I want three photos of the dragon. The gallery is
a separate section with no link to the product it belongs to."

## The problem

A price list item had one `imageUrl`. Anybody selling a physical object wants a
front, a back and a detail. The Gallery section can hold more pictures, but a
gallery picture says nothing about which product it belongs to, so the second
angle becomes an orphan.

## The contract

`imageUrl` becomes `imageUrls`, a list of strings. **Replacing it, not sitting
beside it.** Two fields meaning the same thing is two things to keep in step
and two things for a reader to choose between.

That makes this the first schema change the project has ever needed.

- **FR-044**: an item MUST be able to carry any number of picture addresses.
- **FR-045**: a page saved at version 1 MUST load, with its single picture
  becoming the first entry of the list.
- **FR-046**: an item that had no picture MUST NOT gain an empty list, and a
  picture field left as `""` MUST NOT become a list holding nothing. Absent and
  empty must not both be able to mean the same thing while the round trip
  depends on telling them apart.

## The migration, and why the mechanism was already there

`migrate.ts` was written at version 1, with an empty `MIGRATIONS` array and a
comment explaining that it could not be added later: by the time a second
version exists there are already pages saved by a build that had no migration
path, and those pages cannot be reached retroactively.

That argument was made months before it was needed and it has now been cashed.
The comment listed four steps for whoever added the first entry. Those are the
four steps that were followed.

## Order of work, and the reason it looks wasteful

1. The contract, the migration, and the parity snapshot, **alone**, with the
   compiler still deliberately showing only the first picture.
2. The rendering and the form.

Step 1 changes no output at all, which is the entire point of it. Because the
compiler still emitted one picture, **every golden file had to stay byte
identical**, so any movement in them would have been a defect rather than a
feature. A commit that changes a schema and an output at the same time cannot
make that claim about either.

Both guards fired on step 1: the parity snapshot, and the test asserting that
no migration had ever existed. The snapshot diff is three lines, the field
name, its type, and the version number.

## How it renders

- **FR-047**: an item with more than one usable picture MUST put its section
  into the per item layout, which is the rule quantity pricing already follows
  and for the same reason: a table cell cannot hold a row of images and stay
  readable on a phone.
- **FR-048**: an item with one picture MUST render exactly as it did before, in
  a table column. This is what keeps the change free for an artist with a
  single sample image.
- **FR-049**: pictures MUST be emitted on one line, so they render as a row
  that wraps rather than a column of full width images somebody has to scroll
  past to reach the next item.
- **FR-050**: one picture is described by the item's name. Several are
  numbered, because a screen reader reading the same three words three times
  tells the listener nothing about what the second and third pictures are for.
- **FR-051**: the numbering MUST count the pictures that survived, not the ones
  entered, so a refused address cannot leave alt text promising three images
  where the page shows two.

## How it is entered

Repeated address fields, with a spare one always offered at the end, which is
the placeholder idea the item rows already use.

**Not one box of addresses**, one per line, even though that is the pattern the
details, includes and bulk pricing fields all follow. Those are text. This
field carries a live thumbnail and reports when an address does not load an
image, and a wrong image address is invisible until somebody else opens the
page. Losing that to save a control would be a bad trade.

**FR-052**: the controls MUST name the item they belong to. Every product has a
picture 1, so without it a page carries as many controls called "Remove picture
1" as it has products. They read "Remove picture 1 in Dragon", falling back to
the item's number while it has no name.

## Verified on the device

The update was installed over the top on the Moto G7, signed with the same key,
and the owner's two pages, saved at version 1, opened and compiled. That is the
migration working on real stored data rather than on a fixture, which is the
only test of it that was ever going to matter.
