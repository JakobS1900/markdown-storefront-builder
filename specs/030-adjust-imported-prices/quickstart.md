# Quickstart: Verify imported price corrections

Use fictional values only. Start with a separate blank page or isolated browser storage. Do not remove an existing saved page to reset a test.

## Task A: Column order and row correction

Paste a category and a three-column table with Amount, Price, Item in that order. Set Item, Amount and Price roles. Before Add, change only one item's name and its price to `from $25`. Check the source row beside the editable result. Add the page, then compare Build, Preview and Copy for every name, amount and exact price. Repeat the pure parser acceptance for all six column orders, including `$0` and `Ask me`.

## Task B: Detached names and categories

Use two fictional category headings and four named figures. Put a figure name above its amount-price rows. Assign those rows the shared name and correct category. Move one row to a newly named Prices category. Add and verify its saved destination, along with every name, amount and price in source order. Check that notes between rows remain visible rather than becoming private cost or disappearing. In a separate draft, move a row and undo the move before Add.

## Task C: Recovery

On a late review page, correct an item and navigate away and back. Change a column mapping, inspect the warning if it would replace an edit, then undo. Try replacing the source and cancel the discard choice. Confirm that the original source and edits remain. Finally cancel the import and check the saved page is unchanged. Try an included price row with no name and confirm Add waits for a name, exclusion, or Text preservation. Accept a genuine numeric name explicitly.

## Phone and tablet

At 320 and 390 CSS pixels, check visible field labels, 44 by 44 CSS pixel controls, keyboard focus after mapping and both pagers, and `document.scrollWidth === document.clientWidth`. On the Android 6 tablet with WebView 106, install with `adb install -r`, enter a fictional correction, cold launch and compare the saved result. Restore USB stay-awake to `0` after capture.

Run `npm run verify` in PowerShell and read its exit status. Record exact mismatches in `docs/research/` before declaring the feature verified.
