# Compact import correction layout

Created 2026-10-05 before implementation. Branch: `034-compact-import-review`.
User approved the first recommendation in the
[tablet audit](../../docs/research/2026-10-05-usability-follow-up.md): compact
correction fields. Status: implementation authorized.

## US1: Correct an imported row with less scrolling (P1)

As a seller reviewing an imported menu, I can compare an item and its price
together on a tablet and edit its amount and details without navigating four
full-width fields. On a narrow phone the fields remain readable and reachable.

## Requirements

- FR-001: At an 800 CSS-pixel viewport, Item and Price occupy the same visual
  row; Amount and Details occupy the following row. At 320 and 390 pixels the
  fields stack without horizontal page overflow.
- FR-002: Labels, source text, inclusion and group-selection controls, destination,
  proposed result, numeric-name acceptance and validation issues remain visible
  and usable. Nonempty details are never hidden to reduce height.
- FR-003: Keyboard order follows Item, Price, Amount, Details, matching visual
  reading order. Each field keeps its explicit accessible name and a minimum
  44 by 44 CSS-pixel target. Typing must not lose focus or edits.
- FR-004: Mapping change/cancellation, source reuse and undo, output, persistence,
  parsing, schema and storage behavior are unchanged. Existing unusual missing-price
  warnings and Keep without a price remain associated with the affected row.
- FR-005: Use native layout and existing components, with no new dependencies.

## Success criteria and edge cases

- SC-001: The same fictional correction card is measurably shorter at 800 pixels
  than the pre-change card, while FR-001..004 hold. Record before/after heights.
- SC-002: A real browser check fails on the current one-column tablet layout,
  then passes at 800, 390 and 320 pixels after the change.
- SC-003: Signed tablet update preserves existing pages. Correct a name and price,
  cancel a mapping change, check Preview/Copy, and check the device keyboard.

Cover long names/details, empty values, excluded rows and warning controls.
No new source-choice wording, page naming, automatic collapsing, spreadsheet
editor or parser changes belong in this feature. No seller recruitment is required.
