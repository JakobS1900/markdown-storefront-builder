# 033: Reliable menu imports and local pictures

Status: specified before implementation, 2026-10-04. Branch: `033-flexible-table-import`.

Jakob approved improving pasted tables and surrounding notes, then clarified tester failures: item names appeared in category positions, organization was wrong, and a visual artist could not use local pictures. Correct reproducible failures first. Keep one import workflow with existing review controls and no additional user settings.

## User stories and acceptance

### US1: Preserve item and category meaning (P1)

A seller pastes a menu and reviews names, amounts and categories without the importer inventing products from column labels.

- FR-001: Generic table labels such as Amount, Quantity, Size, Unit, Price, Cost and Notes must not become product names through quantity-table recognition. Ambiguous tables remain available as Text and through existing explicit mapping.
- FR-002: A quoted heading already recognized in its surrounding source must retain its clean name when chosen as a category through source-use correction. Raw quote and bold syntax must not become the category name.
- FR-003: Existing fictional quantity-menu categories, five names and 16 amount-price pairs remain unchanged. Source text and physical line identity remain lossless.
- FR-004: Standalone bold labels in dense lists must not silently become blank-price products. Preserve uncertain source as Text rather than inventing a category hierarchy.

### US2: Review pasted tables with nearby notes (P2)

A seller pastes headed comma-separated or tab-separated spreadsheet text using the same Product, Price and Size selectors already present for Markdown tables.

- FR-005: Recognize consistent headed CSV and TSV records. CSV supports single-line quoted fields, embedded commas and doubled quote escapes. Headerless TSV uses generic column labels and retains its first data row. Plain comma prose and existing simple price lists keep their existing interpretation.
- FR-006: Keep notes before and after a structurally complete table in source order as Text. No note becomes a product merely because it contains a number.
- FR-007: Malformed quoted records and inconsistent delimiter-bearing rows remain Text; do not partially convert them or silently drop cells. Multiline quoted CSV remains Text in this bounded version.
- FR-008: Table headers and repeated recognized header rows are furniture, not products or duplicate Text after mapping. Escaped Markdown pipes must not create phantom columns.
- FR-009: No new import mode, format selector, dependency, persisted field, or file-picker format is required. Existing review, source replacement, undo and saving remain usable.

### US3: Add a local picture or get an actionable refusal (P1)

- FR-010: A valid supported raster picture with missing picker MIME metadata can be accepted only after reliable type validation and normal decoding/re-encoding. Unsupported or disguised files remain refused.
- FR-011: A failed byte read must return a refusal and leave the picker reusable, never hang at Adding the picture or create an unhandled rejection. Existing page and picture references remain unchanged on failure.
- FR-012: Verify local pictures through storage, thumbnail, menu-file preview and export. Device pictures remain distinct from public web image addresses; no upload is implied or performed.
- FR-013: When a page carries a local picture, open the existing menu-file preview disclosure so the seller can see it without discovering a second hidden preview. Web-only pages retain their existing default.
- FR-014: On Android, ordinary local-image selection must use the existing document-picker path so it does not depend on a gallery app's sign-in or unrelated permissions. Preserve camera capture and the existing fallback when no document provider is available. The web layer still validates and decodes the selected bytes. Added after the Android 6 reproduction on 2026-10-05.

## Scope and success criteria

Fictional regression fixtures must reproduce each concrete bug before its fix. Fresh spec and quality reviews cover each implementation chunk; one holistic review covers their seams. `npm run verify` must exit 0. No tablet result is claimed without the device. Keep the change draft under the existing seller-session release gate.

Excluded: OCR, PDF import, price matrices, automatic image hosting, guessed nested category hierarchies, HEIC support, new import options, and general RFC-complete CSV support. Exact tester inputs and the artist's device are unknown, so reproduced defects are evidence of fixed cases, not proof every reported failure has the same cause.
