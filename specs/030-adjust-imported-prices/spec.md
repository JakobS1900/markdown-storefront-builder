# Feature Specification: Adjust imported prices

**Feature Branch**: `codex/030-adjust-imported-prices`
**Created**: 2026-09-14
**Status**: Scoped, not implemented
**Input**: The seller cannot share their private source menu and requests a section to adjust discrepancies in imported prices. Earlier feedback described quantities becoming item names, item names detached from their price rows, incorrect categories, wide tables, and misleading empty Prices warnings.

## User Scenarios & Testing

### User Story 1 - Correct the imported fields (Priority: P1)

A seller opens **Adjust imported prices** on a proposed Prices section, compares the original text with editable items, and fixes the interpretation before adding it to the page.

**Why this priority**: A plausible automatic guess is insufficient when the seller cannot correct what the importer understood.

**Independent Test**: Paste a fictional table with Amount, Price and Item columns. Correct the interpretation and confirm it. Verify the saved page and customer preview show the chosen names, amounts and prices together.

**Acceptance Scenarios**:

1. **Given** an amount was interpreted as the name, **when** the seller assigns the Item column to item name, Amount to quantity or weight, and Price to selling price, **then** the corrected rows show those assignments before confirmation.
2. **Given** one row differs from the rest, **when** the seller edits its name or price, **then** only that row changes.
3. **Given** a price is `from $25`, `$0` or `Ask me`, **when** it is corrected and saved, **then** its exact text survives without numeric conversion or recalculation.
4. **Given** a table has headers and separator lines, **when** its rows become items, **then** its furniture does not become products named Item or Price.

### User Story 2 - Reconnect names and categories (Priority: P1)

A seller assigns a category and an item name to rows whose identity was originally written on a separate line above them.

**Why this priority**: A weight and a price alone do not tell a customer what they are buying.

**Independent Test**: Use two fictional categories, each containing two named figures with quantity and price rows. Correct their grouping and verify every item retains its name in the saved page.

**Acceptance Scenarios**:

1. **Given** a figure name is above several amount-and-price rows, **when** the seller selects those rows and assigns the shared item name, **then** each displayed offer identifies the figure and keeps its own amount and price.
2. **Given** two categories were confused, **when** the seller assigns selected rows to a named Prices section, **then** those rows move there in source order and the unselected rows retain their category.
3. **Given** an arrow-prefixed line could be a category or an item name, **when** automatic interpretation is uncertain, **then** the seller can use its text as either without losing the original line. No particular arrow syntax is presumed from the verbal report.

### User Story 3 - Review and recover safely (Priority: P2)

A seller reviews the result on a phone, sees which rows still need attention, and can undo a correction without losing the paste.

**Why this priority**: Corrections must be observable and reversible before affecting saved work.

**Independent Test**: Correct a long fictional paste, navigate between its review pages, undo a mapping, and cancel. Verify corrections survive navigation, undo restores the previous interpretation, and cancel leaves the saved page unchanged.

**Acceptance Scenarios**:

1. **Given** a selected row has a price but no name, **when** the seller confirms, **then** that row is identified and confirmation waits until it is named, excluded, or retained as Text.
2. **Given** a name is numeric, **when** it is flagged as possibly an amount, **then** the seller can accept it as a genuine numeric name.
3. **Given** a section has corrected publishable items, **when** the result is previewed, **then** it does not receive an empty-section warning. A truly empty selected Prices section instead offers removal, Text preservation, or item entry before confirmation.
4. **Given** a narrow phone screen, **when** reviewing an item, **then** its name, amount and price can be read without horizontal scrolling through the correction form. The final preview remains faithful to the published output.

### Edge Cases

- A header-only table, blank name cells, repeated headers and missing prices.
- Two numeric columns without headers: require seller assignment rather than assuming either is a private supplier cost.
- Genuine numeric names, product names containing digits, decimal weights, currency symbols and thousands separators.
- Multiple price options for one item, duplicate names in different categories and free-text prices.
- Notes, highlighting markers and image URLs between price rows: retain their original text and keep them available as Text when not mapped.
- Long imports beyond the current review pagination limit; corrections remain attached to the right rows.
- Replacing the pasted source after corrections: warn before discarding corrections and allow keeping the current draft.
- Switching the destination page or closing the import: follow existing draft lifecycle rules; never apply corrections to a different page.

## Requirements

### Functional Requirements

- **FR-001**: Each proposed Prices section MUST offer Adjust imported prices before saving. A Text proposal switched to Prices MUST offer the same correction controls.
- **FR-002**: Review MUST display editable item name, quantity or weight, selling price and details, plus the destination category. Original source text MUST remain available without uploading it for analysis.
- **FR-003**: A seller MUST be able to assign detected table columns to these fields and apply the assignment to that table only. Unassigned nonempty columns MUST remain visible as details or Text, never disappear or become private supplier cost.
- **FR-004**: Sellers MUST be able to edit individual rows, exclude and restore rows, and assign selected rows a shared item name or destination category. Category assignment MUST support an existing proposed Prices section or a newly named one.
- **FR-005**: Corrections MUST preserve price text exactly. This workflow MUST NOT recalculate prices, margins, totals or currency conversions.
- **FR-006**: A change to a mapping MUST show the resulting fields before confirmation and MUST be undoable. If it replaces manual edits, the seller MUST be warned and able to cancel that change.
- **FR-007**: Missing names MUST be resolved before selected price rows are added. Suspected numeric names MUST offer explicit acceptance. Missing prices MUST be identified but MAY be intentionally retained, consistent with existing item editing.
- **FR-008**: Confirmation MUST save the reviewed field values and grouping, not rerun the original guess over them. Build, Preview and Copy MUST retain those names and associated prices.
- **FR-009**: Empty-section feedback MUST be based on the corrected result. Header-only or otherwise empty proposals MUST offer a corrective action before saving.
- **FR-010**: All rows MUST be reachable for correction regardless of pagination. Navigation MUST retain edits, row selections and category assignments.
- **FR-011**: Corrections MUST remain local to the import draft until confirmation. Cancel MUST leave the saved document unchanged. Original source MUST not be sent to external analysis services, telemetry or debugging logs.
- **FR-012**: Correction fields MUST have visible labels and accessible names identifying their item, support keyboard operation and phone touch targets, and fit a 320 CSS pixel viewport without horizontal form scrolling.
- **FR-013**: Source replacement and interpretation changes MUST not silently destroy edits. Preserving ambiguous content as Text MUST remain available.

### Key Entities

- **Import draft**: Original source, proposed sections and pending seller corrections before confirmation.
- **Reviewed item**: Source association, item name, quantity or weight, selling price, details, inclusion choice and destination category.
- **Column assignment**: A seller-confirmed interpretation limited to one detected table.
- **Review issue**: A specific missing or ambiguous field with an available correction or explicit acceptance where allowed.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A fictional acceptance corpus covers all six permutations of Item, Amount and Price columns; after assignment, every saved row retains all three intended values.
- **SC-002**: In a two-category, four-item example with names on separate lines, every corrected offer displays the intended item name, amount and price in Build, Preview and Copy.
- **SC-003**: Tests of free-text prices, blank fields, numeric names, headers and extra columns demonstrate no silent loss of nonempty source content.
- **SC-004**: At 320 and 390 CSS pixels, every correction field is reachable without horizontal form scrolling and has an accessible name.
- **SC-005**: A draft exceeding 100 sections retains corrections across review pagination. Cancel, source replacement cancellation and undo each preserve the documented prior state.
- **SC-006**: Corrected populated Prices sections produce zero false empty-section warnings in the acceptance corpus; truly empty proposals receive actionable feedback before saving.

## Assumptions

- The present request is to scope the correction section. Implementation, planning and release remain subsequent work.
- No private menu or sanitized sample is required. Fictional examples exercise structural variations without claiming to reproduce the exact private source.
- This extends feature 029's existing review step. It does not introduce a second import entry point or change existing saved pages automatically.
- Existing item editing remains the recovery path for pages already imported. Reconstructing missing relationships in saved documents without their original source is outside this scope.
- Quantity or weight is a public descriptive value, not inventory tracking. Existing item and quantity-pricing behavior should be reused wherever it can represent the confirmed result.
- Earlier reports about image rendering, highlight fidelity, arrow syntax and the final preview's wide tables remain open follow-ups. This correction section preserves their source text but does not claim to fix those rendering behaviors. The phone layout requirement here applies to the correction form.
- Depends on existing whole-page proposals, Text preservation, Prices editing and publication diagnostics. Unknown cases remain correctable by the seller rather than requiring a more confident automatic guess.
