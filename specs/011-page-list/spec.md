# Feature Specification: Page List

**Feature Branch**: none, straight onto master, consistent with 004 onwards.
**Status**: Specified before implementation on 2026-08-31. The first feature
since 003 for which that is true, see `specs/README.md`.
**Input**: Found on the device on 2026-08-31 while verifying FR-018. The app
refused a damaged page correctly and there was no way to reach any other page
afterwards.

## The problem

Storage has been multi-page since feature 004. `listPages`, `readPage`,
`writePage` and `deletePage` all take an id, `openPage(id)` works, and every
page is stored under its own key. Nothing in the interface has ever let anyone
choose one.

The app opens whichever page has the newest `updatedAt` and that is the only
page reachable. That was invisible for as long as there was exactly one page per
device. Two things changed:

1. **Import creates pages.** `openBackup` writes the backup under a new id, on
   purpose, so that opening a file by mistake cannot destroy the page already
   open. Every import therefore strands the page that was open.
2. **FR-018 refuses pages.** A page this version cannot read is not opened, not
   repaired and not deleted, which is correct. But a refused page keeps the
   newest `updatedAt`, so it is the page the app tries to open on every launch,
   and the artist's real page sits behind it, intact and unreachable.

Verified on a Moto G7 on 2026-08-31: after planting a record with an unreadable
`level` and relaunching, the refusal was correct in every respect and the probe
for a route to another page reported `any way in the interface to choose a
different saved page: false`.

Two pieces of the app already promise this list in so many words. The page title
field is described as "how the page is listed when you come back", and the
import success message had to be reworded on 2026-08-31 to admit the opposite:
"there is no way to switch back to it yet". This feature is what makes both
sentences true, and the second one is deleted by it.

## Scope

In: choosing a saved page and opening it.

Out, deliberately:

- **Deleting a page.** Principle V, and the one instruction that outranks
  everything else here, is that a saved page is never destroyed to tidy
  something up. A delete control is a separate decision with its own
  confirmation, and it is not needed to fix stranding.
- **Creating a page.** `newPage` exists in `store.ts` and has no callers; it is
  dead code today. Wiring it up is a real feature (an empty page written on
  every press accumulates), not a side effect of this one.
- **Renaming from the list.** The title field already does that.

## Requirements

- **FR-020**: When the browser holds a saved page other than the one on screen,
  the interface MUST offer a way to open it, and MUST do so on a surface that is
  reachable while a page has been refused.
- **FR-020a**: Each entry MUST be distinguishable from the others by its
  accessible name alone. Titles are optional and default to "Untitled page", so
  a title is not sufficient on its own.
- **FR-020b**: Opening a page from the list MUST go through `openPage`, so that
  a damaged page is refused by the same path as at launch, with the same
  recovery offer, and the list MUST still be present afterwards so that another
  page can be chosen.
- **FR-020c**: The list MUST NOT appear when there is nothing to switch to. An
  artist with one page has no list.

## Behaviour

The Build surface, above the page title, carries a folded group headed "Your
pages (N)". Build is chosen because it is the surface shown when a page is
refused, which is the case this exists for; a fourth tab would cost a
permanent quarter of the tab bar for something used rarely.

Every stored page is listed newest first, as `Title, last edited <when>`. The
page currently open is present but is text rather than a button, marked
`aria-current="page"`, and reads its title from the live document so that
renaming updates it immediately. When the open page is not in storage at all,
which is the state after a refusal, every entry is a button.

Pressing an entry opens it. Focus lands on the group's summary, because the
button that was pressed no longer exists and the delete confirmation established
that leaving a keyboard user at the top of the document is not acceptable.

## What this does not fix

A page can still only be reached if it is in this browser's storage on this
device. There is no sync, and export remains the only way to move a page
between devices. That is unchanged and out of scope.
