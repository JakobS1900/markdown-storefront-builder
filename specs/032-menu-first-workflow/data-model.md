# Data model: Menu-first workflow

## Saved data

No `Document` schema change. Existing `menu.heading` is the category name. Existing `menu.tiers[]` are ordered products. Each tier uses `name`, exact `price`, optional `unit` for public size or quantity, and optional `blurb` for other public columns. Private `cost` is never inferred from a whole-page public paste. Existing ids, quantities, pictures, and advanced fields stay as they are.

## Transient data

`PagePasteDraft` keeps the source text, dropped proposal indices, swapped proposal indices, and a mapping for any reviewed wide table. A mapping identifies one proposal index and the column indices assigned to Product, Price, and optional Size. It is valid only for the current source text and clears on source edit, cancellation, or confirmation.

`TableRead` is a pure interpretation of one source section: ordered header cells and ordered rows of equal width. Unsupported tables have no `TableRead` and remain Text.

`ReviewedRow` derives from `TableRead` and one mapping. It exposes product name, exact price text, optional size, and labeled extra public values. It is never separately stored. Confirmation writes these exact derived values.

Review keeps stable source row numbers across pages. A row whose Product and Price are both blank while another public cell is nonempty is invalid for menu conversion. Repeated header rows are table furniture, not offers. A heading directly preceding the table is associated with its category when conversion succeeds.

## Invariants

- Every nonempty data cell is represented in a public saved field or retained in Text.
- Product and Price roles are distinct valid column indices. Size, when used, is a third distinct index.
- Changed source invalidates mapping indices.
- No proposed value reaches IndexedDB before confirmation.
- Failure or cancellation before confirmation leaves the prior saved page untouched. Add freezes the reviewed draft and disables cancellation and source changes until persistence completes.
