# Research

## Confirmed boundaries

- `quantityTables` accepts generic Amount/Quantity/Size labels as product names; quoted-heading lookahead then promotes an item label into a category. Existing unsafe-table checks are bypassed by this early success.
- Source-use category reconstruction classifies isolated quoted lines again, losing the table context that originally established the heading. Preserve the already classified meaning.
- Dense lists include nonempty blank-price candidates, including standalone bold labels. Conservative Text fallback is preferable to guessing hierarchy.
- `tableCells` splits escaped pipes. Whole text runs combine table rows and adjacent notes. Existing mapping supports generic headers and preserves extra columns as details, so no new controls are needed.
- `addAsset` rejects empty MIME metadata before decoding and reads normalized blob bytes outside its refusal catch. Investigate and test type validation and failure handling independently from platform support assumptions.

## Decisions

Use a leaf tokenizer and shared table metadata rather than another import workflow. Keep physical source line numbers for correction keys. Recognize CSV only with explicit known column headers; headerless TSV is sufficiently distinct to expose mapping with generic labels. This intentionally avoids interpreting ordinary comma-containing prose as a spreadsheet.

Single-line CSV quoted fields and doubled quote escapes follow [RFC 4180](https://www.rfc-editor.org/rfc/rfc4180). Multiline fields are outside this initial scope because review keys identify physical source lines. Retain unsupported records intact as Text.

CSV recognition requires a header with at least two cells, a name role (Item, Product, Name or Service) and a price role (Price, Selling price or Rate). Remaining header cells may describe details. TSV also permits at least two consistent headerless data rows. A table span ends at a blank line or a line without its structural delimiter; a delimiter-bearing inconsistent row invalidates the span. This means some comma-containing notes beside CSV remain Text with the table rather than being guessed away. Markdown notes without pipes split cleanly. Unclosed quotes invalidate the contiguous candidate span; never accept a prefix of a multiline record.

For local pictures, only empty or generic application/octet-stream metadata may use a signature fallback. Identify PNG, JPEG, GIF or WebP from bytes, require normal image decoding and re-encoding, and propagate the detected MIME so transparent images are not accidentally encoded as JPEG. A real-browser smoke check must exercise actual decode and canvas, storage, reload, thumbnail and menu-file preview/export; jsdom stubs alone do not prove this path.

Validate signatures for declared supported types as well, so an SVG merely labeled image/png is refused. Unsupported declared types do not get extension-based rescue. Malformed or multiline CSV detection must block legacy price-list fallback too, even when continuation text resembles headings. Furniture is consumed only after successful table mapping, never when explicitly retaining Text or manually selecting source lines.

The available Zen `zen_analysis` tool was run with explicit `model: flash` and the project path in its query. It has no working-directory argument and no repository access. Its hypotheses are supplementary, not repository findings. Fresh agents investigate actual code and runnable fictional probes.
