# Research: Adjust imported prices

Date: 2026-10-01. Base: `032-menu-first-workflow` at `95a8396`.

## Existing paths

`app/src/page-text.ts` preserves source in `ProposedSection` and builds menu or Text blocks. Its wide-table reader accepts complete pipe tables with named columns and at least one row. Its quantity-table reader already turns a product-named two-column table into one item with amount-price pairs. `app/src/store.ts` keeps page-paste choices in an unsaved draft, but `confirmPagePaste` currently reparses source and has no corrected rows to apply. `app/src/ui/page-paste.ts` shows source and mapped rows, with 100-section and 20-row review pages. The saved `Document` already has menu heading, item name, unit, price, details, and quantity-price strings.

## Decisions

### One reviewed output for screen and save

Decision: a pure review builder accepts the original proposal and draft choices, returns ordered proposed blocks plus line-specific issues, and is used by both review and confirmation. It does not assign document IDs or write storage. The existing `openBackup` validation and save path remains the only write boundary.

Rationale: UI-only corrections would disappear because confirmation reparses source. A shared result makes Build, Preview, Copy and the review agree. Alternative rejected: patching parsed blocks only in the DOM.

### Source identity and unsupported syntax

Decision: identify a review row by original section index and source line, with a row index for repeated values on one line. Keep the immutable source alongside corrections. Recognized menu and mapped table rows get editable fields. Ambiguous or unsupported lines stay Text and can be explicitly selected for manual item entry; no line disappears merely because another line was corrected. Header-only tables stay Text with an action to add an item or keep the text.

Rationale: a guessed row number changes with pagination and remapping. Source line identity survives those UI choices. Alternative rejected: applying corrections to the current rendered row position.

Each source line has one coverage state: consumed by a reviewed item, consumed as confirmed table furniture or category heading, or retained as Text. A line cannot be both consumed and retained. Unassigned nonempty cells on a consumed table row enter public details. Emit blocks in source order. A retained Text span closes the current Prices block; a later offer in the same category starts another Prices block with that heading. This can repeat a heading, but keeps notes and images at their original position. A partial section can therefore produce several blocks rather than one.

### Category and quantity output

Decision: category destinations have stable draft IDs, based on an existing proposed Prices section or a newly named category. Moving rows preserves source order. Emit each moved offer at its original source position with its destination heading, repeating that heading after intervening text or another heading. Repeated adjacent offers for one named item in one category use `quantities` when each has an amount and price and no conflicting row details. A standalone offer uses an item with `unit` and free-text `price`. Rows with different details remain separate items to avoid losing text.

Rationale: the current schema represents both without change. Alternative rejected: storing quantity as an item name or changing the `Document` contract.

### Remapping and replacement

Decision: mapping changes recompute baseline fields but retain manual edits by source identity. If a change would replace edited values, show an explicit choice to keep edits or discard them, with a one-step undo snapshot. Before corrections, the source textarea behaves as it does today. After corrections, it shows the current source read-only with an Edit source action. That action opens a separate editable buffer; Apply asks whether to discard corrections, and Cancel returns to the unchanged source and corrections. File reads enter the same buffered replacement path. This avoids a confirmation dialog on every keystroke or IME composition event.

Rationale: `setPagePasteText` currently resets choices on every input. Silent reset would lose work. Alternative rejected: trying to merge edits by text content after source replacement.

The draft also stores the page ID and target active when import starts. Switching pages pauses it without clearing edits. Add is disabled until the seller returns to that page or explicitly cancels the draft. Confirmation checks the binding before any write, freezes the reviewed result and blocks competing page switches until its own save/adoption completes. A page switch already in flight must recheck the lock before changing state. This closes the current gap where `openPage` and `adopt` leave `pastingPage` alive while the current document changes.

The existing Text-to-Prices swap stays guarded for malformed tables. A separate Adjust as prices action on a Text proposal opens manual source-line rows without claiming automatic conversion succeeded. Until the seller explicitly assigns a line to an item, that line remains Text. This makes recovery reachable even for headerless or irregular tables.

### Accuracy boundary

Decision: preserve free-text prices byte for byte after the seller edits them. Never infer private cost from a public page. An included row with a price and no name blocks confirmation, and a numeric name needs explicit acceptance. Missing price is shown but may be intentionally retained. Unsupported source stays Text unless the seller explicitly maps it.

Rationale: an incorrect but plausible selling value is worse than a visible unresolved row. The exact private seller menu is unavailable, so fictional corpus cases measure structural safety only.

### Detached source lines used once

Decision added 2026-10-02: offer exact source lines as choices for a shared item name or Prices category. For a table, the name candidate is the nearest preceding standalone nonempty Text line without another table or heading between them. The category candidate is the nearest preceding Heading until another heading appears. The seller must choose a source line for that purpose; matching typed words alone do not imply it. When chosen, its standalone Text or Heading block is removed from the reviewed result and its source coverage records the chosen role. If the choice is undone or no included offer still uses it, restore the original block. Merge adjacent menu blocks with the same chosen category when the only intervening content was used source text. Keep a retained note in place, even when this requires repeating a category heading after the note.

Rationale: a [320 CSS pixel browser run](../../docs/research/2026-10-02-detached-name-browser-audit.md) of the Phase 3 build preserved correct amount and price pairs but rendered `Figures` and `Arrow Orb` twice after the seller assigned the detached lines as a category and shared name. Requiring the seller to find and uncheck both originals makes this correction path too slow and easy to get wrong. Alternative rejected: silently remove source lines whose text happens to match a correction. The same words can be a note or a distinct item, and exact source identity plus an explicit choice is safer.

## Verification anchors

- `app/tests/import-quantity-integration.test.ts` already checks two categories, five items and 16 amount-price pairs through save, compile and rendered preview.
- `app/tests/page-paste.test.ts` covers mapped table review, a late row and a section beyond 100.
- New tests must start red for all six Item/Amount/Price column orders, row edits, grouping, source replacement, undo, name issues, late pages, and exact Preview and Copy values.
- Real Chrome checks at 320 and 390 CSS pixels and the Android 6 tablet check the correction form, focus, no horizontal overflow and persisted output.

No dependency or schema change is planned.

## Interface research checked during implementation

The [GOV.UK check answers pattern](https://design-system.service.gov.uk/patterns/check-answers/) supports a review before a final action, clear change controls beside the values being reviewed, and restoring entered values when a person goes back. This is a useful design analogy for source text beside corrected menu rows. It does not prove this menu workflow is usable by sellers.

The [GOV.UK validation pattern](https://design-system.service.gov.uk/patterns/validation/) advises keeping entered values after an error and generally waiting until a person finishes an answer before showing validation errors. The correction panel should not interrupt typing or replace a focused field while a seller fixes a name. Blocking Add when a required item name is unresolved still needs an actionable message beside that row.

The [W3C guidance on visible labels](https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions) explains why an accessible name alone does not replace a label that everyone can see. [WCAG 2.2 target size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) sets an AA minimum of 24 by 24 CSS pixels with exceptions, while the [enhanced criterion](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced) uses 44 by 44. The project chooses 44 by 44 for its phone controls. These references inform the controls and checks; the planned seller sessions remain the test of whether the flow feels simpler.
