# Feature Specification: Making and Removing Pages

**Feature Branch**: none, straight onto master, consistent with 004 onwards.
**Status**: Specified before implementation on 2026-08-31.
**Input**: The hole left by feature 011. A list you can switch between, cannot
add to except by importing a file, and can never remove anything from.

## The problem

Feature 011 shipped a way to choose among saved pages and deliberately left out
two things. Both now need doing, and the reason is the same in each case: the
list made them visible.

1. **There is no way to start a page.** `newPage` has existed in `store.ts`
   since the app shell and has never had a caller. The only way to bring a
   second page into existence is to import a backup file, which means the only
   route to a new page runs through having an old one on disk.
2. **There is no way to remove one.** Storage only grows. A page refused under
   FR-018 stays at the top of the list forever, and the artist who has already
   saved its bytes has no way to put it away.

Neither was an oversight in 011: the spec named both as out of scope and said
why. Shipping the switcher is what turned them from theoretical into the two
obvious missing buttons on the screen.

## Amending FR-020c

FR-020c said the list MUST NOT appear when there is nothing to switch to, so an
artist with one page has no list. That was right for a switcher and is wrong for
this, because the button that makes a second page has to live somewhere an
artist with one page can reach.

**FR-020c is replaced by FR-021c below.** It is recorded here rather than edited
out of 011, because a specification that quietly changes to match the code is
worth nothing.

## Requirements

- **FR-021**: The artist MUST be able to start a new page from the interface.
  The page already open MUST NOT be modified, and MUST remain in storage.
- **FR-021c**: The page group MUST be present whenever storage is working, even
  with a single saved page, because it now carries the only route to a second
  one. It stays folded, so an artist who never wants a second page sees one
  quiet line.
- **FR-022**: The artist MUST be able to remove a saved page, and MUST be asked
  first, in the row concerned, with the safe answer offered first. Nothing is
  removed until the question is answered.
- **FR-022a**: The page currently on screen MUST NOT be removable, and the
  prohibition MUST be enforced where the removal happens, not only by declining
  to draw the control.
- **FR-022b**: Removing a page MUST NOT touch any other page.

## Why the open page cannot be removed

It is the rule that makes the rest of this safe, and it is worth stating plainly
rather than treating as an implementation detail.

Deleting whatever is on screen raises a question with no good answer: what is
open now? Every answer is bad. Opening the next page silently swaps the artist's
work for a different document. Opening nothing leaves an empty editor that looks
exactly like data loss. Refusing at that point is a dialog explaining why the
button they just pressed does not work.

Removing the page you are looking at is also the accident with the worst
outcome. So the row for the open page has no remove control at all, and
`removePage` refuses the current id even if something calls it directly. To
remove a page, open a different one first. As a side effect, the last remaining
page cannot be removed, which is correct: there is nothing this app should do
that ends with the artist having nothing.

Constitution Principle V is not weakened by this feature. Nothing here removes a
page to recover from a failure, on any path. The only deletion is one the artist
asked for twice, on a page they are not looking at, having been offered its
exact bytes if it was a page this version could not read.

## Behaviour

The group on Build is present whenever storage works. It is headed
`Your pages (N)` and contains every saved page, newest first, then one button:
**Start a new page**.

Pressing that button creates an empty page, opens it, and leaves the previous
page saved and listed. It is written to storage immediately, so a page that has
been made exists, rather than appearing only once it has been typed into.

Every row except the open one carries a remove control beside the button that
opens it. Pressing it turns that row into the question, exactly as removing a
section does: the row holds the question and its two answers and nothing else,
the safe answer is first and is the accented one, and the control that raised it
is gone while it is being asked. Leaving the Build surface answers it safely.

## Out of scope

Renaming from the list, which the title field already does. Duplicating a page.
Any notion of a page belonging to anything other than this browser on this
device.
