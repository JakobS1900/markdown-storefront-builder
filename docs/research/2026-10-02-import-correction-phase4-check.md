# Import correction recovery check, 2026-10-02

Phase 4 of feature 030 adds deliberate remapping with one-step undo, a source edit buffer, file replacement choices, heading recovery, header-only item entry, and focus restoration. Corrections remain in the draft until Add. The Android 6 correction run and real seller sessions are still pending.

## Review findings and fixes

Fresh spec and code-quality reviewers inspected the Phase 4 diff. They found four blocking cases, each reproduced with a failing regression before its fix:

- A malformed table with a data row was labelled header-only and offered empty-section removal. The empty-table action now requires a genuinely empty table.
- Entering an item did not update its live review label or issue. It now updates without replacing the focused input during IME composition.
- Excluding every offer from a headed table silently lost the heading. Add now waits for an explicit Keep or Remove choice, and source coverage records that choice.
- A newly entered item with an amount and blank price could be added without calling out the missing price. It now requires the same explicit Keep without a price choice used for imported rows.

The focused store, UI and accessibility run passed 163 of 163 tests. A first full gate found one older pure test expecting the now-forbidden silent heading removal. The test was changed to assert the unresolved state and both explicit choices; its focused run passed 23 of 23.

## Final gate

`npm run verify` in PowerShell exited 0 after that correction. The output reported:

- Typecheck and ESLint passed.
- 90 test files and 1,845 tests passed.
- Secret scan clean across 551 files; dash scan clean across 379 authored files.
- The separate accessibility gate passed 64 tests.
- Light and dark contrast checks each reported zero failures, including the page-paste panel.
- Menu-file export reflowed at 390 CSS pixels, with four tables scrolling in their wrappers and no axe issue.
- The PWA update gate served build A, then build B after deployment, and kept rendering after a failed refresh of a removed asset.

The browser audit of detached source lines is separate: [it still shows duplicate standalone heading and name output](2026-10-02-detached-name-browser-audit.md). That is the next contract and UI chunk, not a Phase 4 pass claim.

## Real browser recovery task

I opened the built Phase 4 app in an isolated Chrome profile at 320 by 844 CSS pixels. I pasted a fictional `# Ceramics` heading and an Item, Amount, Price table with one `Mug`, `12 oz`, `$25` row. The UI proposed one section, showed the exact source, and offered Item, Price and Size column roles. I accepted the default roles, opened Adjust imported prices, and excluded the single offer. The review then showed the explicit Keep original heading and Remove original heading choices. Choosing Remove changed the Add button to `Add 0 sections as a new page` and disabled it.

I opened Edit source, changed `Mug` to `Bowl` in the replacement buffer, and pressed Apply source replacement. The UI asked whether to discard corrections and review choices. The original source still contained `Mug`, while the buffer contained `Bowl`. Choosing Keep original source closed the buffer and left the original source and heading choice intact. Reopening the same discard prompt produced the [320 pixel capture](media/2026-10-02-import-recovery-320.png). At 390 CSS pixels the prompt remained visible in the [390 pixel capture](media/2026-10-02-import-recovery-390.png).

Browser evaluation reported `clientWidth === scrollWidth` at both sizes, 320 and 390. The CDP session logged no runtime exception. This checks one fictional recovery route in Chrome; the final Android 6 correction task and seller observation remain pending.
