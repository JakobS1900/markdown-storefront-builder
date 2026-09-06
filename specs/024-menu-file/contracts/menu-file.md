# Contract: the saved menu file

**Feature**: 024-menu-file
**Date**: 2026-09-06

The saved file is the only artifact this project has ever produced that other
people open directly. The Markdown it emits today is pasted into a host, and
that host is the thing rendering it; this file renders itself. So it needs a
contract, and this is it.

## What it is

One file. `menu.html`, `text/html`, produced by an explicit action by the
seller.

It is an **output**, not an interchange format. It is not reopened by the app,
not parsed by anything, and not a backup. `page-backup.json` remains the way a
page moves between devices, and nothing about this file weakens that.

## Guarantees

1. **Self contained.** Everything required to display it correctly is inside the
   one file, with one stated exception: a picture held at a web address that the
   website refuses to let us read stays a web address. The seller is told which
   picture by name when that happens. Nothing else is fetched, ever: no fonts,
   no stylesheets, no scripts, no analytics.
2. **Offline.** Opening it with no network produces the same page, minus only
   the pictures covered by the exception above.
3. **Faithful.** It shows what the app showed when previewing the menu file, and
   is produced from the same compiled output through the same renderer.
   Principle VII.
4. **Inert.** Nothing a seller typed becomes executable. There is no script in
   the file, no event handler attribute, and no external reference that could
   introduce one. Verified across the hostile text corpus by producing files and
   checking them, not by reading the code that makes them.
5. **Readable.** Semantic markup: real headings, a real table, alt text carried
   through from compiled output. It reflows and does not scroll sideways at 390
   CSS pixels. Principle VI applies to the file, not only to the app.
6. **Private.** It contains what the seller's page contains and nothing else. No
   asset identifiers, no original filenames, no device information, and no
   location or camera data from any photograph. It does not contain `cost`,
   which is a property of the compiled output it is built from.
7. **Stable.** The same page produces the same file, other than the embedded
   image bytes being whatever the stored pictures are.

## Explicit non-guarantees

Stated because a promise nobody made still gets assumed.

- **Not editable back into the app.** Deliberate.
- **Not paginated and not designed for print.** D1. It is a reflowing document.
- **Not small.** Embedded photographs make it large. FR-077 requires the seller
  be told the size at the point of saving rather than discovering it when
  sending fails.
- **Not a published page.** It has no address and nobody can link to it. That is
  what the paste hosts are for, and the app still does that.

## The boundary this file exists to hold

A picture held on the seller's device appears **here and nowhere else**.

| Destination | Local picture | Web address picture |
|---|---|---|
| Menu file | Embedded | Embedded when readable, otherwise left as an address |
| rentry.co | Never. Warning names it. | Emitted as an address |
| text.is | Never. Warning names it. | Emitted as an address |
| Portable, and the `.md` file | Never. Warning names it. | Emitted as an address |

FR-079 forbids any setting, flag or confirmation that changes the first column.
FR-081 forbids the paste output disclosing that a local picture exists at all.

## The internal form that makes it work

Compiled output for a target with `localImages: true` refers to a local picture
as `mdsb-asset:<id>`. This form:

- exists only between the compiler and the app's own renderer, and reaches no
  seller, no host and no saved file;
- is resolved to real image data by setting it on a DOM node the app built, so
  the bytes pass through neither address check and no `data:` allowance is
  needed anywhere. Research D3;
- is not a scheme any browser implements, so one that somehow escaped
  unresolved is an image that fails to load and nothing else. It cannot execute.

A saved menu file containing the text `mdsb-asset:` anywhere is a defect, and
the test suite asserts its absence.
