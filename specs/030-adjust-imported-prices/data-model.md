# Data model: Import correction draft

All types in this file describe unsaved app state. `engine/src/document/descriptor.ts` remains the saved document contract.

## Source row key

`SourceRowKey` contains the proposed section index, one-based line number in the original paste, and a within-line index when one line yields several offers. It is derived from source, never from the visible review page. A source revision changes whenever the pasted source changes or a new paste session begins.

Each nonempty source line has a coverage state: reviewed item, confirmed table furniture or category heading, or retained Text. The builder must never mark a line both consumed and retained, or leave it uncovered. Nonempty unassigned cells of a consumed row remain in public details. Retained Text spans split adjacent Prices blocks, so the final block order follows source order even when a category heading is repeated.

## Reviewed row

`ReviewedRow` has a source key and immutable original source text. Its editable values are `name`, `amount`, `price`, `details`, `included`, and a destination category ID. It also records whether a numeric name was explicitly accepted. An absent amount is distinct from an amount such as `0`; price and amount remain strings. A row may originate from a mapped wide table, a quantity table, a simple price list, or an explicit manual conversion of a Text line.

Validation issues are attached to source keys. An included row with a price and blank name blocks Add. A numeric name needs acceptance. A missing price is visible but can be intentionally retained. Nonempty unassigned table columns remain in details or in a retained Text section.

## Category destination

An existing destination points to a proposed Prices section by index. A new destination has a draft-local ID and a seller-entered heading. Distinct destinations can share a visible name. Empty names are allowed only when the seller explicitly chooses an unnamed Prices section. Moving a row changes its destination, not its source key or position. Its destination heading may repeat when a note or another heading separates its offers.

## Detached source use

A draft-only source-use choice identifies one exact standalone Text or Heading source line, its chosen role as shared item name or category, and the included reviewed rows using it. The source line remains in the original paste. Its review coverage changes from retained Text or standalone Heading to used item name or category only while at least one included row still uses the chosen value and destination. A typed matching value does not create a source-use choice. Undo or a later edit that removes every linked use restores the line's original reviewed output. Retained notes remain between their surrounding offers. Adjacent offers of the same chosen category can share a Prices block when no retained content separates them.

## Correction state

The page-paste draft owns row edits, inclusion choices, category names, manual rows, mappings, a one-step mapping undo snapshot, review positions, the original source revision, and the starting page ID and target. It never updates `Document`. Cancel drops this state. Before corrections, source text can be edited directly. After corrections, source replacement uses a separate buffer and an explicit discard choice; cancelling leaves both the original textarea and draft unchanged. File input uses the same path. A page switch pauses the draft; Add is disabled until the starting page is reopened or the draft is cancelled. Confirmation checks the page binding before the write, uses the captured target, and locks page changes until its own adoption completes.

## Reviewed output

A pure builder returns ordered proposed blocks and issues. Recognized rows become menu items. Several compatible amount-price rows for one item become one tier with `quantities`; standalone offers use `unit` and `price`. Unassigned source remains Text. Confirmation rejects blocking issues, freezes the review result, gives blocks fresh IDs, validates the resulting document, and persists it through `openBackup`. Review counts and buyer preview are derived from the same result.

## State transitions

`source entered -> proposal -> mapping and correction -> reviewed output -> confirm -> saved page`

At any point before confirmation, `cancel -> prior saved page unchanged`. Mapping change can be undone. Source replacement with edits enters `discard choice`; cancel returns to the exact draft and source, while discard starts a new proposal. A failed save returns to the same draft with a specific error.
