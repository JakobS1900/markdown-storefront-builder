# Import organization and local-picture corrections

Branch `033-flexible-table-import`, based on compatibility fix `bea8b0f`.
The tester reports did not include source menus, files, error text or device details.
These are reproducible fictional cases, not a claim to have identified every tester's cause.

## Before fixes

`> **Blue Bowl**` immediately above an Amount/Price quantity table became a category
named Blue Bowl with a product named Amount. The same occurred for Quantity, Size,
Unit, Price, Cost and Notes. The quantity-table fast path bypassed the ordinary
generic-header guard.

A genuine quoted category could import correctly but appear as raw `> **Ceramics**`
when reused through source-use correction. Reclassifying an isolated line lost the
context that established its heading role.

Standalone bold labels between priced rows became blank-price products. Their role
is ambiguous, so preserve them as Text rather than inventing a category hierarchy.

Valid PNG bytes with no picker MIME metadata were refused before decoding. A rejected
normalized-blob byte read escaped `addAsset`, which left Adding the picture on screen.
The image normalizer and real Android picker are separate boundaries; a desktop fix
does not prove that the native picker works on the unavailable tablet.

## Evidence record

Read-only reproductions: ignored `temp/category-evidence.ts` and
`temp/local-picture-probe.mjs`, both exited 0 and confirmed the described failures.
The latter stubs decoding, so a real-browser decode/storage/preview/export check is
required before claiming the local-picture path verified.

## Verified chunks

Category correction: 140 tests passed across review, page-text and quantity integration.
Independent spec and quality reviews found and closed numeric bold-label, underscore
bold-label and emphasized generic-header cases. Broadening generic labels to Item was
rejected because it broke the existing genuine ITEM fixture. Commit `99ad093` retains
the original five names and 16 amount-price pairs.

Local pictures: 78 focused tests passed, typecheck and scoped lint exited 0. Independent
spec and quality/security reviews approved. `npm run local-pictures` uses an isolated
Chrome profile and actual decoding and canvas output: three PNGs with ordinary,
missing and generic MIME metadata retain transparency, survive navigation and page
reopening, show in the open menu-file preview and decode from the embedded export.
The 390 and 320 pixel checks have no page overflow or browser exceptions. It is now
part of `npm run verify`. This verifies synthetic browser file selection, not the
Android picker or real-browser decoding of every other accepted raster format.

Table compatibility and final whole-feature verification remain in progress.
