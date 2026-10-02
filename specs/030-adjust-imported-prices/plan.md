# Implementation Plan: Adjust imported prices

**Branch**: `030-adjust-imported-prices` | **Date**: 2026-10-01 | **Spec**: [spec.md](spec.md)
**Base**: `032-menu-first-workflow` at `95a8396`. This feature builds on its table review and Android 6 work.

## Summary

Let sellers correct whole-page import results before Add: item name, amount or weight, free-text price, details, inclusion, and category. Keep original source visible. A pure reviewed-output builder feeds both the correction screen and confirmation so the saved page matches what was approved. Reuse the existing menu document fields and storage validation. Leave unsupported source as Text until a seller explicitly converts it.

## Technical Context

**Language/Version**: TypeScript with strict and exact optional property checks.
**Primary Dependencies**: Existing Vite, Vitest, jsdom, axe, Chrome browser gates and Capacitor 7. No new dependency.
**Storage**: Existing local IndexedDB page storage through `openBackup`. Corrections are transient in the page-paste draft.
**Testing**: Red then green Vitest regressions, `npm run verify`, Chrome at 320 and 390 CSS pixels, signed Android 6 tablet build.
**Target Platform**: PWA and Android API 23 or newer with a supported WebView.
**Project Type**: Offline storefront builder with a pure Markdown compiler.
**Performance Goals**: Show at most 100 section summaries and 20 correction cards total per review page, with inactive sections collapsed; preserve navigation and input on an Android 6 tablet.
**Constraints**: No saved `Document` schema change, no upload of pasted content, no guessed private cost, exact seller price text, no horizontal correction form scroll at 320 CSS pixels.
**Scale/Scope**: Whole-page import, several categories, hundreds of source lines, more than 100 proposed sections, and long tables.

## Constitution Check

| # | Principle | How this plan satisfies it |
|---|---|---|
| I | The Engine Is a Pure Function | The compiler remains untouched. The app's reviewed-output builder is pure and deterministic. |
| II | Hosts Are Data, Never Code | No host record or emitter changes are planned. |
| III | Test-First, With Golden Files | Each chunk begins with a failing regression. Existing goldens and quantity integration remain gates. The `Document` descriptor is unchanged, so its parity test remains unchanged. |
| IV | The Narrow Gate | Original and corrected text enter Preview through the existing compile and sanitizer path. Add a sanitizer corpus case only if a new rendered field is introduced. |
| V | The User's Work Is Sacred | Draft edits do not write a page. Confirmation validates before save; cancel, failed save and source replacement cancellation retain prior pages. |
| VI | Reachable By The People Who Need It | Visible labels, source-line names, keyboard focus, 44 pixel targets, axe and real 320 pixel browser checks. |
| VII | Honest Fidelity | The reviewed result is compiled for buyer Preview and Copy. Ambiguous source stays Text until an explicit correction. |

No constitution exception is planned. Recheck after each phase and the holistic review.

## Project Structure

```text
specs/030-adjust-imported-prices/
  spec.md
  research.md
  data-model.md
  contracts/review.md
  quickstart.md
  plan.md
  tasks.md
app/src/page-text.ts
app/src/page-paste-review.ts
app/src/store.ts
app/src/ui/page-paste.ts
app/src/styles.css
app/tests/page-paste-review.test.ts
app/tests/page-paste-store.test.ts
app/tests/page-paste.test.ts
app/tests/import-quantity-integration.test.ts
```

The pure adapter and builder belong in `app/src/page-paste-review.ts`, beside the existing parser. `store.ts` owns only draft state, source revision and validation before persistence. `ui/page-paste.ts` displays the reviewed result and dispatches corrections. `engine/src/document/` remains untouched.

## Implementation sequence

### Chunk 1: Review contract and source associations

Add failing tests for stable source-line identity, all six column orders, quantity-table rows, repeated headers, extra cells and ambiguous Text. Define one draft-only reviewed row shape and a pure builder that produces proposed blocks plus issues. It must partition nonempty source lines exactly once into reviewed items, confirmed furniture or heading, and retained Text spans, emitting several blocks when needed to preserve source order. Bind the draft to its starting page ID and target; pause Add after a page switch and check that binding before any write. Lock competing page switches during confirmation, including one already in flight, while allowing its own validated adoption. Verify name, type and ordering through review-to-confirm parity tests. No new correction UI yet. Keep source intact and use existing menu fields.

### Chunk 2: Field correction and confirmation

Add failing store and UI tests for editing name, amount, price and details on one row, exact free-text prices, missing-name and numeric-name decisions, exclusion, and a result matching Preview and Copy. Add `Adjust imported prices` to each proposed Prices section. Give Text proposals a separate `Adjust as prices` manual source-line path that does not bypass the guarded automatic Text-to-Prices swap. Once edits exist, disable direct source editing until buffered replacement lands. Render at most 20 correction cards total across all sections, with inactive sections collapsed. Confirmation consumes the frozen reviewed result, assigns IDs and uses `openBackup` to validate and save.

### Chunk 3: Shared names and categories

Add failing two-category, four-item tests for detached names, shared item names, amount-price grouping, moving selected rows to an existing or new category, duplicate visible category names, and source order. Keep unselected text and notes. Reuse `quantities` for compatible multiple offers and `unit` for standalone offers. Ensure the review and buyer output show the same grouping.

### Chunk 4: Recovery and phone operation

Add failing tests for remap warning and undo, buffered source replacement cancel for typing, paste, file input and IME composition, old file reads, page switch during confirmation, section 101 and table row 21, input focus, and true empty-section actions. Make every correction reachable on a phone without unbounded DOM growth. Use the existing accessibility and contrast gates and a real Chrome run.

### Chunk 5: Use detached source once

The [320 pixel browser audit](../../docs/research/2026-10-02-detached-name-browser-audit.md) found duplicate standalone Heading and Text output after a seller assigned those same lines as category and shared item name. Start this chunk with an isolated source-use contract and a failing parity test: exact source-line keys, chosen purpose, linked included rows, and one coverage outcome must match the reviewed and saved blocks. Keep the `Document` JSON schema unchanged. For a table, offer the nearest preceding standalone nonempty Text line if no other table or heading intervenes; offer the nearest preceding Heading until another heading appears. An explicit action uses that Text line as selected rows' shared name or that Heading as their category. Typing matching words does not imply use. Undo, exclusion or moving all linked rows away restores the original source output. The pure reviewed-output builder merges adjacent same-category menu blocks when the only intervening lines were used names or headings; it retains notes in place and allows a repeated category heading when a note splits output. Add a 320 pixel browser Task D and saved Build, Preview and Copy checks. Keep the older Text and Heading choices available for ambiguous source.

### Whole-feature gate

After per-chunk spec and quality reviews, get one fresh holistic review focused on cross-section grouping, source loss, review-to-confirm parity, and saved-page safety. Fix findings first. Run `npm run verify`, browser Tasks A, B, C and D at 320 and 390 CSS pixels, signed APK build and reinstall on the connected Android 6 tablet, then update `docs/HANDOFF.md` and the feature index. Push a draft stacked PR against feature 032 for review. The five real seller sessions must exercise the combined 032 and 030 build, including correction tasks, before either feature is called easier to use or released normally.

## Complexity Tracking

None. The feature uses existing storage, document fields, parser and UI primitives.
