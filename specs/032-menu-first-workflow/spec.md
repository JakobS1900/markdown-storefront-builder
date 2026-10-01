# Feature Specification: Menu-first workflow

**Feature Branch**: `032-menu-first-workflow`
**Created**: 2026-10-01
**Status**: Draft for an evaluated product slice
**Input**: Sellers report that creating a menu feels slow and clunky, while pasted menus break on small syntax changes. The 2026-10-01 audit reproduced a three-column public price table losing its selling prices after the seller chose `Make Prices instead of Text`.

## Problem and intended outcome

A seller thinks in categories, products, sizes, and prices. The current Build screen asks them to choose section types and work through large product forms. The page paste review asks them to choose Text or Prices without showing how product fields will be interpreted. The setup wizard can put unrelated example products and copy in a new seller's page.

This slice tests one simpler route: make a short menu by editing the menu itself, and bring a familiar three-column table into that same editor with a visible field mapping. The result still becomes a normal saved page and uses the existing Preview and Copy surfaces. The slice is deliberately narrow enough to compare with the current app in seller sessions before replacing other entry paths.

## User Scenarios & Testing

### User Story 1 - A conversion cannot hide selling prices (Priority: P1)

A seller pastes a table with Product, Size, and Price columns. They choose to turn its Text proposal into Prices. Before any page can be saved, the app either shows all three fields in the proposed items or keeps the original table as Text with a clear explanation. A nonempty public value never silently becomes a private cost.

**Why this priority**: The audit observed `$28` and `$32` disappear from the confirmed menu. This must be guarded before the new editor is offered.

**Independent Test**: Paste the fictional two-row table in the audit. Try to convert it. Verify every nonempty source cell remains visible in the review and the confirmed page, or confirmation retains the source as Text.

**Acceptance Scenarios**:

1. **Given** a table with Product, Size, and Price columns, **when** the seller requests Prices, **then** the app does not offer confirmation of an interpretation that puts Size in Price and omits the selling price.
2. **Given** a table whose columns cannot be mapped confidently, **when** the seller does nothing else, **then** it remains Text and all source lines survive in the saved page.
3. **Given** the checked-in two-column quantity menu, **when** the seller confirms its existing Prices proposals, **then** its two categories, five product names, and 16 amount-price pairs still appear in Preview and Copy.

### User Story 2 - Make a short menu directly (Priority: P1)

A seller starts a blank page, names a category, and adds three products with their selling prices. The category name, product names, and prices are visible and editable together in Build. The seller can add another category and can still reach the existing detailed product controls when needed. Preview shows only the seller's content.

**Why this priority**: The current first task requires repeated navigation through tall cards, while the wizard generates unrelated material to clean up.

**Independent Test**: Create Ceramics with a mug at `$28`, a planter at `from $35`, and a custom plaque at `Ask me`. Add Prints with one item. Verify Build, Preview, and Copy show the seller's chosen order and exact prices, with no template content.

**Acceptance Scenarios**:

1. **Given** a blank page, **when** the seller starts a menu, **then** they can enter its category and first product without choosing among section types or answering setup questions.
2. **Given** an open Prices category, **when** the seller adds a product, **then** its name and price can be edited in the same visible list as the other products, without opening a separate item panel.
3. **Given** several products and categories, **when** the seller edits a name, category, or price, **then** Preview and Copy reflect that change and retain product order.
4. **Given** a product with quantities, pictures, private cost, or other advanced details, **when** the seller asks to edit those details, **then** the existing controls remain available and do not publish private fields.
5. **Given** an open category with later page sections, **when** the seller adds a category there, **then** it appears immediately after the current category and keyboard focus moves to its Category field.
6. **Given** an open category, **when** the seller adds an item with a keyboard, **then** focus moves to the new Item field and the row is brought into view.

### User Story 3 - Map a pasted table before saving (Priority: P1)

A seller pastes a three-column public menu table and sees its source next to proposed product rows. They choose which column is Product, which is Size or quantity, and which is selling Price. The review updates before confirmation. A mistaken choice can be changed without replacing the pasted source. The saved menu shows each product with the right size and price.

**Why this priority**: The app currently asks for a section type while the actual uncertainty is the meaning of each column.

**Independent Test**: Paste the audit's two-row craft table, map Product, Size, and Price, confirm, and inspect Build, Preview, and Copy. Repeat with a different column order and an extra Notes column.

**Acceptance Scenarios**:

1. **Given** a table with explicit Product, Size, and Price headers, **when** the seller reviews it, **then** each proposed row displays name, size, and exact price text before saving.
2. **Given** the same three values in another column order, **when** the seller changes assignments, **then** only that table's proposed rows update, and no saved page changes before confirmation.
3. **Given** an extra nonempty column, **when** it has no assignment, **then** its values remain visible and are kept as public details or Text, not private cost.
4. **Given** a seller who cancels review, **when** they return to the existing page, **then** that page is unchanged and the pasted source has not been sent elsewhere.
5. **Given** a heading immediately before a mapped table, **when** the seller confirms it, **then** the heading names the Prices category; unrelated preceding text remains visible.
6. **Given** a row with a blank Product and Price but a nonempty Size or Notes value, **when** the seller reviews the mapping, **then** conversion is blocked and the original table remains available as Text. The seller can change the mapping or keep the table as Text.
7. **Given** a seller who mapped a table, **when** they choose Keep as Text, **then** the mapping is cleared and confirmation preserves the table as public Text.

### Edge Cases

- Headerless tables and two plausible numeric columns require a seller decision rather than a guessed selling price.
- Three-column pipe or comma rows without a Markdown separator must also be guarded against losing a public selling price.
- A two-column Product and Size or Product and Notes table must not call the second column a selling price. A headerless two-column item and price list can still be recognized when the second column has clear price evidence.
- Headerless rows with a plausible size such as `12 oz` in the would-be Price position remain Text, even with a trailing empty column.
- An unruled Product and Price header must not become a fake product.
- Two supported wide tables following one heading remain separate, reviewable source sections. Existing multi-table quantity imports keep their current grouping.
- Free-text prices such as `from $35`, `$0`, and `Ask me` retain their exact text.
- Blank cells, repeated headers, and separator rows do not become product names.
- A row with a size but no selling price must not publish that size as the price. Review must identify the source row and retain the table as Text until corrected or kept as Text.
- A true numeric product name can be accepted as a name.
- A long table remains reviewable without losing the source-to-row association.
- A 100-row table exposes every proposed row and unassigned value, including the final row, through bounded paging or scrolling.
- Repeated header rows remain recognizable in source review and never become products.
- Existing pages with non-Prices sections still open and edit normally.
- The editor and mapping controls fit a 320 CSS pixel viewport without horizontal form scrolling.

## Requirements

### Functional Requirements

- **FR-032-01**: The app MUST refuse or defer a Text-to-Prices conversion whenever it would discard a nonempty public source value or place a plausible size or quantity in the selling Price field without an explicit seller mapping.
- **FR-032-02**: Review MUST display the proposed product, size or quantity, price, and any unassigned source values before saving a converted table.
- **FR-032-03**: A blank-page seller MUST have a direct menu entry path that creates no unrelated example content.
- **FR-032-04**: Category heading, product name, and selling price MUST be editable from one compact Build view. Existing advanced product fields MUST remain reachable.
- **FR-032-05**: Sellers MUST be able to add products and categories, and preserve their chosen order.
- **FR-032-06**: Column assignments MUST apply only to the selected table and MUST update its proposed rows before confirmation.
- **FR-032-07**: Confirmation MUST save the reviewed values, not rerun an earlier guess over the original source.
- **FR-032-08**: Nonempty unassigned cells MUST remain public and visible as details or Text. No public pasted cell may be silently assigned to private cost.
- **FR-032-09**: Cancel before confirmation MUST leave saved pages unchanged. While confirmation persists, source edits and cancellation MUST be disabled with a visible busy state; confirmation MUST use the frozen reviewed draft. All parsing and correction MUST stay local to the device.
- **FR-032-10**: The existing two-column quantity menu behavior MUST remain correct.
- **FR-032-11**: All new controls MUST have visible labels, accessible names, keyboard operation, and phone touch targets.
- **FR-032-12**: Existing saved pages and the versioned page format MUST remain compatible.
- **FR-032-13**: Every source row and unassigned public value in a supported long table MUST be reachable in review with its source row number.
- **FR-032-14**: A heading immediately preceding a mapped table MUST name its Prices category without losing adjacent text. A repeated table header MUST not become a product.
- **FR-032-15**: Review labels MUST describe the block that Add will save, including Text fallback on an incomplete or invalid mapping. An invalid row MUST remain locatable by source row number.
- **FR-032-16**: Collapsed category cards in Build MUST display their category names so sellers can distinguish them without opening each card.
- **FR-032-17**: An unsupported table MUST show guidance the seller can actually follow, including the supported Markdown table shape and the option to retain Text. Mapping and row-paging controls MUST keep keyboard focus after review updates.

### Key Entities

- **Menu category**: A named set of product offers in seller chosen order.
- **Product offer**: A seller chosen name, public selling price, optional size or quantity, and optional advanced details.
- **Paste draft**: Original source text and proposed sections, held locally until confirmation or cancellation.
- **Table mapping**: Seller confirmed roles for columns of one source table.
- **Unassigned value**: A nonempty source cell whose role is not yet confirmed and must remain visible.

## Success Criteria

### Measurable Outcomes

- **SC-032-01**: The audit's three-column table produces two offers with `$28` and `$32` as prices and `12 oz` and `16 oz` retained as public size information, or remains fully intact as Text until mapping is completed. Zero nonempty cells disappear.
- **SC-032-02**: The checked-in quantity menu still produces two categories, five named products, and all 16 amount-price pairs in Build, Preview, and Copy.
- **SC-032-03**: At 320 and 390 CSS pixels, category and product editing and table mapping require no horizontal form scrolling, and each control is keyboard reachable and named.
- **SC-032-04**: A seller can create the four-item, two-category acceptance menu without opening advanced details, using the setup wizard, or deleting template content.
- **SC-032-05**: At least five sellers attempt both short-menu creation and three-column paste on the prototype. Record completion, elapsed time, corrections, and wrong or missing values against the current build before deciding whether to replace its default entry path. This human evaluation is a release decision, not a claim that automated tests can prove usability.

## Assumptions and boundaries

- The slice reuses the existing saved page format, Prices sections, compiler, Preview, and Copy. It adds no account, network analysis, host API, or new document field.
- The broader correction panel in feature 030 remains separately scoped. This slice covers one table at a time and does not claim to correct every messy source format.
- Existing wizard, templates, and detailed section forms remain available during evaluation. Whether to remove or demote them is decided after seller testing.
- The import examples are fictional. The user's private menu is neither needed nor requested.
- The immediate guard can land before the compact editor and table mapping, but the complete feature is evaluated as one workflow.
