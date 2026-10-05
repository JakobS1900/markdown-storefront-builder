# Quickstart: evaluate the menu-first slice

## Task A: create a short menu

At 390 by 844 CSS pixels, start a blank page. Create Ceramics with `Hand-thrown mug` at `$28`, `Speckled planter` at `from $35`, and `Custom name plaque` at `Ask me`. Add Prints with one item. Check that category, names, and prices can be edited without advanced details or the wizard. Compare Build, Preview, and Copy. No unrelated example text should appear.

## Task B: paste a public table

Paste this fictional source as a new page:

```markdown
| Product | Size | Price |
| --- | --- | ---: |
| Speckled mug | 12 oz | $28 |
| Blue mug | 16 oz | $32 |
```

Review raw source and proposed rows. Assign Product, Size, and Price if the app has not proposed them correctly. Before confirmation, read both names, sizes, and prices. After confirmation, check Build, Preview, and Copy. Neither `$28` nor `$32` may be absent or private.

## Task C: challenge the mapping

Swap Price and Product columns and add a Notes column. Change the assignment once before confirmation. Ensure every nonempty note remains public. Cancel one attempt and verify the prior saved page is unchanged. Replace the source and verify the old mapping does not apply.

## Existing import regression

Paste `app/tests/fixtures/quantity-menu.md`. Confirm two categories, five named products, and 16 amount-price pairs. Inspect 320 and 390 CSS pixel widths.

## Seller evaluation

Ask at least five sellers to complete Tasks A and B on the current build and prototype. Record elapsed time, completion, corrections, wrong or missing values, and where they ask for help. Decide whether this design becomes the default only after reading those observations.
