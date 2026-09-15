# Quantity-table import correction

2026-09-15. The seller supplied a concrete example after the correction UI was
scoped. This establishes a reproducible importer defect that can be fixed with
the existing quantity-price model before building the larger correction UI.

## Expected behavior

- `> **CATEGORY1**` and `> **CATEGORY2**` organize their following products as
  named Prices sections. Ordinary quoted prose remains Text.
- A two-column table headed by a product name and Price, whose first column
  contains quantities, becomes one named item with its quantity prices.
- The supplied example contains five products across two categories, with
  5, 2, 1, 3 and 5 quantity prices respectively. Names and all 16 amount-price
  pairs survive saving, previewing and copying.
- Generic Item/Price tables listing product names retain their usual meaning.
- Original source remains available when switching a proposal to Text.
- Two-column price tables fit a phone. Wider descriptive tables retain their
  existing scroll container rather than squeezing their text into narrow strips.
- Warning text stays visible. This fix does not add host-specific admonition
  rendering for `!!!Danger` or reproduce every host's visual styling.

## Implementation and verification sequence

1. Parser chunk: failing regressions for the supplied shape, then narrow category
   recognition and quantity-table conversion, reusing the existing model.
2. Layout and integration chunk: phone-width two-column tables in preview and
   exported menu files; verify confirmed documents and compiled output.
3. Fresh spec-compliance review, then fresh code-quality review. Fix findings.
4. Full verification gate, browser evidence, signed Android release.

No Document schema change is needed. The broader field-correction specification
remains scoped, not completed by this bugfix. Image and highlight reports remain
open where this example does not reproduce them.

## Verification evidence

2026-09-15: `npm run verify` exit 0, 88 test files and 1691 tests, a11y 62,
contrast clean in both palettes, menu-file and PWA update gates clean.
Browser Preview displays both categories and all five item headings. All five
quantity tables fit at viewport widths 320 and 390 without horizontal overflow.
Signed Android 0.12.1 (versionCode 18) built successfully and verified with the
existing certificate using v2 and v3 signatures.
