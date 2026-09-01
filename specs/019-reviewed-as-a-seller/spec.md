# Feature Specification: What Using It As A Seller Found

**Feature Branch**: none, straight onto master.
**Status**: Specified after implementation on 2026-09-01, and labelled as such.
The investigation came first and produced the list; the list is what a
specification would have contained, so writing one beforehand would have been
writing it twice.
**Input**: The owner: "if you were an end user, and I went to sell you this
product, and you went to look at it and work with it, what would you find? What
would you like? What would you not like? You are an artist who sells their
artwork... or a merchant who is selling Legos, supplements or 3d prints."

## Method, because the method is the point

Two complete shops were built with the tool, as two people who are not its
author: an illustrator selling commissions, and a 3D print seller, which is the
same shape of problem as Lego or supplements. Then the interface was opened at
phone width and measured: controls on arrival, fields visible without
scrolling, touch target sizes.

**That hour found six defects, all of them already shipped, in a codebase with
822 passing tests.** None of the six was a broken test. Every one was something
the tests were not asked about.

## What was found, and what was done

### FR-037: a contact address must be a link

An email went into a profile link, was refused for not being http, and the
label survived. The page published a bullet reading `Email` that did nothing.
That is worse than omitting it, because it reads as the seller's mistake.

Links now accept `mailto:` and `tel:`. Images do not, because a mailto image is
not an image, so the single address check became two and every call site was
sorted into which kind it is. Both remain allow lists and both check the shape,
not merely the scheme.

**FR-037a**: a contact address must not merely survive normalising, it must not
have needed it. Found by testing FR-037: the strip that stops a control
character hiding `javascript:` also removed the space from
`mailto:has space@example.com`, which then published as a clickable link to a
mangled address.

### FR-038: the page must not assume what is being sold

A shop selling 3D prints announced "Commissions are OPEN" on its second line.
The status reads "Open for orders" now, and a test asserts the word commission
appears nowhere in a profile, so it cannot return.

### FR-039: the currency attaches to the first number in a price

A page listing "18 each" beside "from 25 per model" showed the symbol on the
first and not the second, because the rule only priced a string that was purely
a number. "from 25" is one of the commonest ways there is to write a price. A
price containing no digit at all is still left exactly as written, which is
what the old rule was protecting.

### FR-040: the avatar is described

The one image identifying who is selling was the one image with empty alt text.
It carries the seller's name, collapsed to a single line, because a newline in
alt text ends the image early.

### FR-041: removing a row is undoable

Removing a section was undoable and removing a product was instant and
permanent. Backwards: a shop has three sections and thirty products, and a
product holds a name, a price, a unit, a bulk table, several details and an
image address.

One mechanism serves price items, gallery images and profile links: a removed
row is restored by putting the section back as it was the moment before, rather
than by splicing the row into whatever the section looks like now. Nothing else
can have changed it, because any other action clears the offer.

### FR-042: rows can be reordered

Sections had up and down arrows and rows did not, so moving a bestseller to the
top of a twenty item list meant deleting it and retyping it, into the deletion
that could not be undone. Rows now have the same three controls sections have.

### FR-043: the host is chosen where the choice takes effect

The host picker was the first control in the header, and therefore the first
decision asked of somebody who had just arrived. It is unanswerable at that
moment: they have made nothing to paste and have no reason to know what rentry
is. It also did nothing visible, because everything it affects is on another
tab.

It now sits at the top of the Copy tab, above the output it rewrites and the
steps it rewrites. The Preview tab still depends on the target and can no
longer offer it, so it names the host and says where to change it: an
unexplained dependency reads as the preview being wrong.

## The finding that outlasts all seven

**Four of these changes broke no existing test.** That is a coverage report,
not reassurance. Row removal had never been tested at that level, which is how
it shipped with no undo. The picker's position was never asserted. The file
download had no test over the export surface at all.

Three of the tests then written for the download are themselves vacuous: since
every shipped host emits identical bytes, "the file matches the portable
output" passes whichever host the button picks. They are kept with the
limitation written at the top of the file rather than deleted, because they
become load bearing the moment a host diverges again, which has already
happened twice.

## What was deliberately not done

**A second image per product** was found by the same review and is feature 020,
because it is a schema change and this one is not.

**Anything resembling a checkout.** This produces a page somebody reads. The
review noted that a merchant has no way to take an order except the contact
links, and that is the correct scope, not a gap.
