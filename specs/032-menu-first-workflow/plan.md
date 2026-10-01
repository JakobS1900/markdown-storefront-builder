# Implementation Plan: Menu-first workflow

**Branch**: `032-menu-first-workflow` | **Date**: 2026-10-01 | **Spec**: [spec.md](spec.md)

## Summary

Keep the existing `menu` block and document schema as the single saved representation. Make category, product name, and price directly editable in a compact Build form. Show a populated public size in the existing auto-opened More details group. Add a direct blank-page menu action. For Markdown pipe tables wider than two columns, stop the current unsafe Text-to-Prices conversion, then let the seller assign columns in the paste draft and inspect proposed rows before confirming. Confirm exactly the reviewed values; preserve extra public cells as details or Text.

## Technical Context

**Language/Version**: TypeScript, ES2022 target, strict mode
**Primary Dependencies**: Existing Vite app and zero-runtime-dependency engine; no new package
**Storage**: Existing IndexedDB `Document`, unchanged schema version
**Testing**: Vitest, jsdom UI tests, golden fixtures, `npm run verify`, Chrome phone-width check
**Target Platform**: Offline PWA and Android wrapper, 320 CSS pixels and wider
**Project Type**: Browser app with a pure TypeScript compiler
**Performance Goals**: Review a 100-row table without rendering full product forms
**Constraints**: No source upload, no silent loss, no private-cost inference, 44 CSS pixel targets
**Scale/Scope**: One Markdown pipe table per mapping, existing block editor and compiler retained

## Constitution Check

| # | Principle | How this plan satisfies it |
|---|---|---|
| I | The Engine Is a Pure Function | Parsing and draft work stays in the app. The compiler remains unchanged. |
| II | Hosts Are Data, Never Code | No target or host capability changes. |
| III | Test-First, With Golden Files | A failing three-column regression precedes the guard. Each behavior gets a failing test. Existing goldens and parity test run in `verify`. |
| IV | The Narrow Gate | Proposed values enter the existing `Document` compiler and sanitized Preview path. |
| V | The User's Work Is Sacred | Mapping lives only in the draft. Cancel and source edits before Add cannot write a saved page. Add freezes the reviewed draft during persistence. Unmapped text remains Text or visible details. |
| VI | Reachable By The People Who Need It | Controls keep labels, names, keyboard behavior, and touch targets; test at 320 and 390 pixels. |
| VII | Honest Fidelity | Preview still renders compiled Markdown. Review shows the field values confirmation will store. |

No constitution exception or document contract change is required. Recheck after implementation.

## Research and design decisions

The audit's bug is a data interpretation failure. `readCandidates` reads `12 oz` as the first monetary cell and `$28` as a later private cost; `tierFrom` removes cost in whole-page paste. A guard only at confirmation would leave a misleading review. The same pure conversion result must drive review, confirmation availability, and final confirmation. The guard also requires price evidence for two-column text, so Product/Size and Product/Notes do not become Prices and an unruled Product/Price header does not become a product.

The new mapper handles Markdown pipe tables with one header row, one separator row, and consistent data row widths. Other source shapes stay Text. Product and Price column roles are required; Size is optional. Other nonempty columns become labeled public details. No role ever means private Cost. Header labels may suggest roles, but an ambiguous result is not confirmed without the seller seeing the resulting fields. A data row with neither Product nor Price but another nonempty value blocks conversion and retains the source as Text. Repeated header rows are skipped as table furniture. A directly preceding heading becomes the mapped Prices category; other preceding text remains Text.

The current `Document` represents a category as `menu.heading`, a product as a tier, a price as text, and size as `unit`. Reuse those fields. Mapping is transient draft state keyed by proposal index. `setPagePasteText` clears mappings with dropped and swapped choices, so an old selection cannot apply to new source. Proposed rows derive from source plus mapping and are not separately stored.

The compact form revises the existing menu editor rather than adding a second write path. Show category heading and Item/Price controls directly. Retain optional unit in More details, which opens automatically when unit is populated, and retain row tools, bulk pricing, quantities, pictures, and advanced controls in the same component. The direct entry button creates `blankBlock('menu')`. Keep wizard and templates during seller evaluation, with the direct menu action as the blank-page primary route.

## Data flow

1. `readProposal(text)` continues to split the page into source-associated sections.
2. A pure table reader identifies a consistent pipe table and returns header cells and ordered row cells. It does not infer roles from numeric cell shapes.
3. Review renders raw source, mapping choices, and paged proposed rows with stable source row numbers. Every row and unassigned value is reachable, including row 100. An invalid or missing mapping keeps the table as Text.
4. Draft state holds column roles only until source replacement, cancellation, or confirmation. Pagination does not change proposal indices.
5. The same pure `buildProposedBlock(section, mapping)` result is used for review and final confirmation. Unassigned nonempty cells become public `blurb` with their header names. An unsafe conversion reports a reason rather than returning a partial menu.
6. Pressing Add freezes the reviewed draft and shows a busy state while persistence runs. Cancel and source changes are available before Add and disabled during persistence. Confirmation creates a new page through the current path, leaving the previous page intact until persistence succeeds.

## Implementation chunks

1. **Safety boundary**: Failing three-column loss regression, pure safe conversion result, review and confirm guard, existing quantity fixture regression.
2. **Direct menu editing**: Blank-page menu action, compact visible category and product fields, UI tests, Build/Preview/Copy parity for a four-item craft menu.
3. **Explicit table mapping**: Transient draft mapping, narrow pipe-table reader, assignment controls, source-to-row review with late-row access, heading association, blank required row and repeated header handling, order and extra-column tests, cancel and replacement tests, frozen confirmation, phone layout check.

Each chunk gets a fresh implementer, spec reviewer, and code-quality reviewer. A holistic whole-feature review follows. No release is claimed until seller task sessions in SC-032-05 are recorded; a technical prototype may be shared for evaluation.

## Project Structure

```text
app/src/page-text.ts             pure proposal and table conversion
app/src/store.ts                 transient mapping and confirmation
app/src/ui/page-paste.ts         source, mapping, and proposed-row review
app/src/ui/build.ts              direct blank-page menu entry
app/src/ui/forms.ts              compact existing menu form
app/src/styles.css               phone layout
app/tests/                     pure, UI, integration, and accessibility tests
specs/032-menu-first-workflow/  spec, plan, research, data model, tasks, quickstart
```

**Structure Decision**: Extend current modules and reuse `Document` and the compiler. No new runtime dependency or parallel document model.

## Complexity Tracking

No constitution violation. The transient mapping record is needed because review and confirmation must use the same seller choice without changing the saved schema.
