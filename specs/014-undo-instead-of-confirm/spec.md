# Feature Specification: Undo Instead of Asking

**Feature Branch**: none, straight onto master.
**Status**: Specified before implementation on 2026-09-01.
**Input**: A UX review on 2026-09-01, grounded in published guidance rather than
taste. This reverses a decision made deliberately in feature 010, so it says why.

## What is being reversed

Removing a section currently asks. The row becomes a question, "Delete Prices?
This cannot be undone", with Keep first and accented.

That was built after a real mis-tap, and it was the right fix for the problem as
it was understood: three touch targets 44px wide sitting side by side, the
destructive one in the middle, and no way back.

## Why it changes

Nielsen Norman Group's position is that a confirmation is the wrong tool for
anything reversible, because people automate their response to it. The dialog is
clicked through without being read, so it protects nobody, and it taxes every
deliberate deletion to fail at preventing the accidental one. Material draws the
same line: undo for reversible, ask only for irreversible.

Removing a section is reversible. The block is an object in memory and putting
it back is an array splice. Nothing about it needed to be permanent; it was
permanent because nothing had been built to remember it.

Two things this does not change, and both were load-bearing in the original fix:

- The spacing that caused the mis-tap. That was fixed separately on 2026-09-01
  and is what actually addresses the accident.
- Removing a **page** still asks. A page is deleted from storage rather than
  held in memory, and it can carry a hundred sections. Different weight, and the
  reasoning in `specs/012-page-lifecycle` still holds.

## Requirements

- **FR-024**: Removing a section MUST take effect immediately and MUST offer a
  way to put it back.
- **FR-024a**: Undoing MUST restore the section to the position it was removed
  from, not to the end of the list.
- **FR-024b**: The offer MUST NOT expire on a timer. An undo that vanishes after
  four seconds, while the artist is scrolled somewhere else, is a safety net
  that is not there when it is reached for.
- **FR-024c**: The removal and the availability of undo MUST both be announced,
  because the section vanishing is invisible to somebody not looking at it.
- **FR-024d**: One level. Only the most recent removal can be undone.

## When the offer goes away

It survives until the artist does something else, which is the honest reading of
"the next unrelated action":

| What they do | The offer |
|---|---|
| Press Undo | used, and gone |
| Type anything, anywhere | gone |
| Add, move, or remove another section | gone |
| Switch surface, switch page, start a page | gone |
| Scroll, or do nothing at all | still there |

Typing clearing it is deliberate. Somebody who has deleted a section and moved
on to writing has moved on. The alternative, an offer that outlives the work
that replaced it, is how an undo restores something into a document that has
changed underneath it.

## Where it appears

In the list, at the index the section was removed from, as a row reading what
was removed and offering to put it back. The gap it leaves is where the artist
was already looking, and it keeps the spatial sense of what happened.

That is also why it is not a floating snackbar over the tab bar: the tab bar is
where three other controls already are, and the whole point of FR-024b is that
this thing does not need to be caught before it disappears.

## What is being deleted along with the confirmation

`pendingDeleteId`, `askDelete`, `cancelDelete`, the confirm branch of the
section row, its stylesheet rules, and the focus handling in the shell that
moved focus to the safe answer. All of that existed to support the question. The
page confirmation keeps its own equivalents, which is why they are separate
fields rather than one.

`app/tests/delete-confirm.test.ts` is replaced rather than edited. Its intent,
that a mis-tap must not cost the artist their work, is what the new tests
assert; its mechanism is gone.
