# Seller workflow audit, 2026-10-01

## Scope and method

This is a product investigation, not a usability study with sellers. I used the
local app in an isolated Chrome profile at a 390 by 844 phone viewport. I made
a three-item craft menu by hand, pasted the checked-in quantity-menu fixture,
pasted a fictional three-column craft table, and completed the six-question
Handmade and crafts setup. I inspected Build, Preview, Copy, and the saved fields
where a value appeared to be missing. No private source menu was used.

The user's report is the most important input: new menus feel slow and clunky,
and existing menus are frustrating to import when their syntax varies. The
observations below explain plausible mechanisms. They do not establish how
often real sellers encounter each one.

## Observed tasks

| Task | What happened |
| --- | --- |
| Create a craft menu manually | Three items and a category published correctly. Each item needed its own large card. The category heading was inside `Section settings`, below the item list. The phone editor grew vertically as products were added. [Editing screen](media/2026-10-01-manual-prices.png) and [result](media/2026-10-01-manual-preview.png). |
| Paste the checked-in quantity fixture | The app proposed two Prices sections, then Preview showed two categories, five product names, and all 16 amount-price pairs. This supported format works. |
| Paste a common three-column table | `Product | Size | Price` stayed Text. The review offered `Make Prices instead of Text` but displayed only the original source, with no interpreted fields. [Review screen](media/2026-10-01-three-column-review.png). After using that button and confirming, Build stored `12 oz` and `16 oz` as the two prices. Preview and Copy omitted the actual `$28` and `$32`. [Saved result](media/2026-10-01-three-column-result.png). |
| Answer setup questions for a craft shop | Six questions asked for one product. The resulting page had six sections, including two unrelated example products, three example gallery entries, placeholder shop details, and sample ordering copy. Entering `$28` resulted in `$USD 28` in Preview. The wider price table scrolled horizontally on the phone. [Preview](media/2026-10-01-wizard-preview.png). |

The three-column result is the highest severity finding. The review action
sounds like a safe type choice, yet it changes the meaning of fields and loses
the selling prices from the new page. Leaving the table as Text preserves its
source, but then the seller has gained no editable price list.

## Why the three-column conversion fails

The path is visible in the code as well as the saved result:

1. [`page-paste.ts`](../../app/src/ui/page-paste.ts) renders each proposal's
   original text and a Text/Prices switch. It does not show the fields that the
   switch will create.
2. [`page-text.ts`](../../app/src/page-text.ts) sends switched Prices text to
   the general price-list reader. Its `tierFrom` deliberately omits any `cost`
   field because cost is private.
3. [`price-list-text.ts`](../../app/src/price-list-text.ts) chooses the first
   cell after the name that parses as money. `12 oz` parses as a number with a
   suffix, so it becomes Price. The next numeric cell, `$28`, becomes Cost.
4. The private Cost is omitted when a whole public page is converted. The
   original source is not retained in the new Prices section.

This is a contract mismatch between a supplier price-list parser and a public
menu importer. The earlier losslessness tests cover source splitting and some
default proposals; they do not prove that every nonempty public cell survives a
seller's Text-to-Prices choice.

## Product diagnosis

The app asks sellers to work in its storage model: choose section types, open
cards, find secondary fields, check a separate preview, and finally choose a
Markdown host. A seller's working model is simpler: list the things they sell,
group them, set prices, and see the menu their buyer will read. The manual path
works for a few products, but the cost of each new item is repeated navigation
through large forms.

The import path has the opposite problem. It starts with the seller's existing
page, but the review asks them to approve section kinds rather than the actual
product, quantity, and price relationships. A confident looking choice can
therefore produce a wrong menu. The setup path adds cleanup work by filling a
new shop with example content that reads like finished copy. These paths have
different controls but converge on the same burden: sellers must reconstruct
their own menu inside an editor organized around sections and parser guesses.

This is an inference from the observed flows and the user's feedback. Seller
interviews and task timing are still needed before treating it as a measured
population result.

## Approaches

1. **Repair the current workflow.** Add the planned correction panel, block
   unsafe conversions, surface category headings, and clean example content.
   This preserves the existing architecture and is the quickest way to stop
   the three-column loss. It leaves the repeated block and card workflow in
   place.
2. **Make the menu the primary editor. Recommended.** Start with a small
   category and product list where names, quantities, and prices can be edited
   directly. Let a seller paste a page into a draft of that same list. For an
   ambiguous table, show the source beside the proposed rows and ask once
   which columns mean Product, Size, and Price. Keep unassigned cells visible.
   Render the buyer view beside or below the list and keep the existing
   compiler and host handling behind it. This is a broader UI redesign, but
   it addresses both creation and import with one mental model.
3. **Use a freeform source editor with optional structure.** This makes paste
   easy and preserves unfamiliar syntax. Sellers would still need to understand
   or repair Markdown when they want reliable price tables, so it does less
   for the reported audience.

The recommended path does not require a more ambitious parser. The parser can
make suggestions. The seller should be able to see and correct each resulting
offer before a public menu is saved.

## First experiment

Build one small vertical slice, not another full wizard: a three-item craft
menu editor with category and product rows, plus paste of a three-column table
into the same editor. Include a visible source-to-result comparison and an
explicit column choice when values are ambiguous. Preserve every nonempty
source value until the seller decides where it belongs. Test these two tasks
with real sellers against the current build, measuring time to an accurate
Preview, edits and backtracks, wrong or missing prices, and whether they can
finish without explanation. The safety criterion is zero silent loss of names,
quantities, or selling prices.

The immediate production guard is narrower: `Make Prices instead of Text`
should not save a result that discards a nonempty public cell. Keep the run as
Text or require a visible mapping first. This guard should precede any wider
import correction UI. It is a recommendation, not an implemented fix.

## Limits

The probe used synthetic DOM input in the same style as the project's Chrome
QA scripts. It verified the persisted result through Build, Preview, and Copy,
but did not measure typing latency or handset touch behavior. The real user's
private menu was unavailable, and the tested variants are examples rather than
a representative corpus. No application code changed during this audit.
