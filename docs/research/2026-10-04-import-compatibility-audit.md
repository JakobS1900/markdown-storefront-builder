# Import compatibility audit, 2026-10-04

Jakob asked to prioritize conversion across varied entrepreneur and creator menus, and to correct unusable interpretations. The tablet was unavailable. This pass uses fictional source only and fixes bounded failures in the existing import paths. It does not claim support for every menu format or replace the five real seller sessions.

## Reproduced failures and corrections

| Source shape | Before | Corrected behavior |
| --- | --- | --- |
| `Portrait from $45` | Item name included `from`; Price was `$45` | Item is `Portrait`; Price is exactly `from $45` |
| `Logo $100 - $200` | Item included `$100`; Price was only `$200` | Full `$100 - $200` stays in Price |
| `Lesson $60 / 30 min` | Price was `30`; `$60 /` became part of the name | Price stays `$60 / 30 min` |
| `Portrait $ 45` | Currency symbol became part of the name | Price stays `$ 45` |
| `Candle, €12,50` | Decimal fraction became private cost in the price-list reader; whole-page import fell back to Text | Price stays `€12,50`, without numeric conversion |
| `Small, woven basket $24` | Name split at its comma | Full item name stays together |
| `Mug` followed by `$25` and `12 oz` in separate columns | Amount could become private cost | Amount stays a public unit |
| Two-column `Price / Item` table | Names and prices swapped, confirmation allowed | Original Text stays until explicit column review; existing controls map it correctly |
| `Service / Duration` or `Service / Notes` table | Durations or notes invented selling prices | Text retained; existing mapping available for explicit assignment |
| Ordinary price table immediately followed by a delivery note | Note became an extra blank-price item | Entire source retained as Text, including the note |
| Repeated unruled `Item / Price` header | Header became a fake offer | Explicit mapping skips it as an offer; its literal source remains Text in place |

Whole price expressions are recognized before comma and dash splitting. Existing supplier columns still retain their separate name, price, unit, and cost roles. Public contact instructions such as `DM me` cannot become numeric private cost. Ordinary Item/Price and product-named quantity tables retain automatic conversion.

No saved Document fields, dependencies, accounts, network analysis, or device settings changed.

## Regression and review evidence

- The initial price-expression tests failed 12 cases, including the whole-page mixed-menu assertion. Fixes were made after observing those failures.
- Initial two-column tests failed four cases and passed two compatibility controls. The repeated-header regression subsequently failed before its fix.
- Fresh quality review caught regressions involving a dash-separated supplier cost, units before the price, and `DM me` after the price. Each received a failing regression test before correction. Closure review found no remaining actionable issue.
- Fresh spec review found the repeated header becoming an offer. The fix retains source rows 3 and 5 for the real offers, with the repeated header public as Text. Spec closure passed.
- Saved integration exercises IndexedDB confirmation, Document validation, Build fields, Preview, Copy, and rendered compiler output for rentry, text.is, and portable Markdown.
- A second integration test uses the real Product and Price assignment controls for a reversed table, activates their review action, and saves the two correctly associated offers.

Full `npm run verify` exited 0 on 2026-10-04: typecheck, lint, 93 test files and 1,917 tests, secret scan (591 files), dash scan (391 authored files), 65 accessibility tests, zero light and dark contrast failures, a clean menu-file gate, and a clean PWA update gate. The full test phase took 68.88 seconds. This adds 27 regression and integration checks over the prior 1,890-test baseline. The PWA test's deliberate removed-asset 404 did not poison the cache and the returning visitor received build B.

## Remaining limits and next conversion work

- Tablet verification of this change is pending. The installed `0.13.0-test.5` predates it.
- No interactive browser connection was available. The repository's automated Chrome contrast, menu-file, and PWA gates provide browser verification; jsdom import form tests do not establish new phone layout evidence.
- A repeated unruled header remains a Text line after mapping. It no longer becomes a product, but removing redundant table furniture cleanly is a follow-up.
- A table adjacent to prose can remain entirely Text. Separating the table from its notes is preferable future recovery work, provided source order is preserved.
- Escaped pipes in cells, CSV quoting, decimal-comma numbers without currency markers, tabular sources without Markdown rules, price-first plain lists, and size-by-price matrices need their own acceptance corpus before broader recognition changes. Some currently remain Text or require manual correction; this audit does not claim them fixed.
- The next compatibility slice should prioritize recoverable CSV and tab-separated column assignment using the existing review panel, with exact public-cell preservation. Seller observations should decide its priority against the remaining source-format cases.

Draft PRs 1 and 2 remain draft pending the real seller evaluation. No normal release or new APK was produced by this pass.
