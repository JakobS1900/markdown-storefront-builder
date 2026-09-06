# Holistic review: The menu file

**Feature**: 024-menu-file
**Date**: 2026-09-06
**Diff reviewed**: `965fc5b..9fb1cfc`, ten commits, five chunks
**Reviewer**: fresh, no part in writing any of it
**Fixes applied**: `db8e869`

Mandatory above roughly three chunks, and this was five. Three per chunk reviews
had already run and found real defects. This one was asked to look only at the
seams, because that is the thing per chunk reviews structurally cannot see.

**It found two high severity defects, and both were seams where each side was
internally correct and independently tested.** That is the characteristic yield
this project records for the practice, and it is the third feature running where
the holistic review found something no earlier review could have.

---

## H1: a warning that reached nobody

`picture_superseded` is raised when a gallery item or a profile avatar carries
both a picture from the device and a web address. The device one wins in the
menu file, so the other has to be reported rather than vanish.

The engine did that correctly and tested it. `menuFileBody` took `.markdown` and
discarded `.diagnostics`. Every other surface compiles for the paste host, which
never raises it. So the warning existed, passed its tests, and was seen by
nobody.

The comment at the emit site reads: *"The superseded address is REPORTED rather
than dropped in silence... That seller is the one this whole feature is for, so
their output is the last place a picture should vanish without a word."* Both
halves of the promise were written. Only one was wired.

**Worth noticing**: this defect was introduced by the fix for a CHUNK 1 review
finding. A review finding, correctly diagnosed and correctly fixed on the side
it was found, left the other side unbuilt.

## H2: the preview said the page was empty while the file was not

The menu file preview was gated on `compile(doc, pasteTarget).markdown !== ""`.

A page whose only content is a picture from the seller's device compiles to
nothing at all for rentry, because no paste host can carry that picture, and to
a real file for `MENU_FILE`, because that is the entire point. A seller doing
exactly the user story 2 flow was told *"Nothing to preview yet"* while the Copy
tab would hand them a menu with their picture in it.

The preview and the file disagreed about whether the page existed. Principle
VII, failing for precisely the person the feature was written for.

---

## The three medium findings are one lesson recurring

**The export fetched a link, not a picture.** `pictureAddresses` matched image
addresses out of the compiled Markdown. A gallery picture carrying a link
compiles to `[![alt](mdsb-asset:a1)](https://link.test/page)`, and since the
address group cannot match `mdsb-asset:`, the lazy label backtracked past the
inner image and captured the outer link. Saving a menu file then issued a serial
HTTP request, eight second timeout, against whatever site the seller had linked
to. Nothing embedded, nothing reported, invisible: a third party ping from a
feature whose promise is that it needs no connection.

That is the THIRD instance of matching structure out of text in this one
feature, and the first caught before it broke something. It now reads `img`
nodes. Nothing in `menu-file.ts` matches structure out of text any more.

**One identifier, three behaviours.** The menu emitter filtered blanks on
`id.trim()` and then emitted the untrimmed value; the gallery, the profile and
the app's `assetIds` all trim outright. A page from a hand edited backup, the
case the address encoding exists for, carrying `localImageIds: [" abc "]` was
stored under `abc` and asked for as `" abc "`, so the picture was removed and
the seller told it was not on this device. The same id on a gallery item
resolved fine.

**Two notes, two names for one picture.** One path still ran `img.alt` back
through `renderMarkdown`. Correct when the caller passed compiled Markdown, and
wrong once it passed a node's alt, which the renderer has already unescaped.

---

## Lows, all fixed

- The renderer's http check was unanchored where the engine's is anchored, so
  the bare string `https://` was refused by one and accepted by the other. Not
  reachable, since the renderer only sees compiled output, but the stated reason
  those checks are duplicated is that a drift is a hole in whichever ends up
  laxer.
- The quota pre-check would spend the last byte of the origin quota on a
  picture, after which the page referencing it could not be written. Nothing
  destroyed, FR-085 caught it, but the seller was walked into a dead end by a
  check that had just said there was room. It keeps 512 KB in reserve now.
- Three `CHUNK 1:` markers pointed at work that shipped in `fba0a52`. In this
  project's notation that reads as an outstanding carry forward.
- The layout divergence between the file and the paste page is now stated in the
  preview rather than left to be noticed.

## Four documents did not describe what shipped

`plan.md` still said Blobs, `research.md` still listed both measured questions as
open, `spec.md` said Draft, and `data-model.md`'s own earlier correction had been
inserted between two rows of the table that defines the store, ending it early.

All corrected. The last one is recorded rather than tidied away: a correction
that breaks the thing it is correcting is worth knowing about.

---

## What the reviewer established as clean, and how

Recorded because "found nothing here" is only worth what the method behind it is.

- **The contract across four boundaries.** All five write sites read. `setLocal`
  and `withOptional` delete rather than empty; `stampVersionFour` creates
  nothing; parity, the v3 fixture and the round trip all pass, and
  `migrate-local-pictures.test.ts` asserts byte identical paste output before and
  after migration. Absent versus empty is consistent everywhere except the
  trimming disagreement above.
- **A fourth forgery was hunted and not found.** `ESCAPABLE` escapes `[`, `]`
  and `\`, so seller text can never supply a bare `]` and can never terminate
  the renderer's label; the fixed pattern skips escaped brackets in both
  directions. `assetIds` reads the document, not the text. `resolveLocalPictures`
  works on nodes. The scripts match nothing out of seller text.
- **Asset map staleness.** `removeAsset` deletes from the held map as well as the
  store and the storage panel refills on the same callback, so the map cannot
  outlive a deletion. `holdDocumentPictures` covers both document arrival paths.
  The export handler snapshots the document at click time, so a mid save edit
  cannot tear the file.
- **The new a11y coverage is not vacuous.** Sixteen assertions render through
  `renderShell` with real content and name controls by structure rather than
  wording.

## Still open, deliberately

**The menu file gate never exercises a picture from the device.**
`scripts/menu-file.mjs` drives the bundled example, whose pictures are all web
addresses, and assets live in IndexedDB where a bundled example cannot reach.
So the `mdsb-asset:` resolution and the removal with a note path are covered
only under jsdom, which lays nothing out. Worth knowing before that gate is
trusted as covering the file end to end. Not fixed here because it needs the
gate to seed IndexedDB, which is a bigger change than the finding.
