# Research: Menu-first workflow

## R1: Reproduced data loss

The [seller workflow audit](../../docs/research/2026-10-01-seller-workflow-audit.md) records a `Product | Size | Price` paste. `Make Prices instead of Text` saved `12 oz` and `16 oz` as prices and omitted `$28` and `$32`. The path is `page-paste.ts` to `buildProposedBlock`, then `readCandidates` and `tierFrom`. The latter intentionally omits `cost`, so a numeric public price misclassified as cost disappears. This is chunk 1's safety boundary.

## R2: Existing schema is enough

The `menu` block holds a heading and ordered tiers. A tier has public name, price text, optional unit and blurb, plus advanced fields. No migration is needed. The contract parity test remains unchanged.

## R3: Narrow table shape

This slice maps one Markdown pipe table with a header, separator, and consistent row widths. Headers can suggest roles, but the result must be visible before confirmation. Unrecognized runs stay Text. This limits parsing while covering the observed failure.

## R4: Source association

Current draft state stores source text plus dropped and swapped proposal indices. `setPagePasteText` resets both arrays. Mapping can use the same section index during the life of that source and must reset on edit. Review pagination does not alter the index.

## R5: One editor

The existing menu form owns add, remove, reorder, bulk pricing, quantities, pictures, and advanced fields. A separate quick editor would duplicate write paths. Revise the visible category and basic item controls there. The direct entry action calls existing `addBlock(blankBlock('menu'))`.

## R6: Evaluation boundary

Automated checks prove fixture losslessness, output parity, labels, and viewport fit. They cannot prove that the flow feels easier. Five seller task sessions are required before making it the sole default path or claiming a usability improvement.
