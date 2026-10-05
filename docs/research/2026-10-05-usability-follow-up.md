# Usability follow-up on the tablet

## Scope

Jakob requested further usability investigation after the four workflow checks.
This audit uses the SM_T700 running signed test.7, the fictional test pages,
fresh screenshots, UIAutomator bounds, and the current UI implementation. It
also uses the recorded correction workflow from earlier today. It is an expert
inspection, not a participant study. No saved content was changed in this audit.

The goal is to make creating, correcting and reopening a menu require less
navigation and interpretation. Correctness checks already pass; those checks
must remain intact while the interface gets simpler.

## Ranked opportunities

### 1. Make imported rows easier to scan and correct

Observed: the correction editor stacks Item, Amount, Price and Details across
the full width even on the 800 CSS-pixel-wide tablet. Each row also repeats its
source number, original line, destination, inclusion control, group-selection
control and a prose summary. In today's short-list UI dump, the start of source
row 2 to source row 3 spans about 1,196 physical pixels. A normal menu item card
in the fresh tablet dump is about 594 pixels tall. These are layout observations,
not measured task-time improvements.

The cause is visible in `app/src/ui/page-paste.ts`: four sequential `field()`
calls inside `.page-paste-card`. The card is a single-column grid in
`app/src/styles.css`. The normal menu already has a two-column primary-field
layout, so the app has a working visual pattern to reuse.

Recommended first change: pair Item with Price, then Amount with Details where
the viewport supports it. Preserve a logical keyboard order, explicit labels,
the original source line, inclusion controls, warnings and mapping safeguards.
Stack cleanly on narrow phones. Do not hide nonempty details or warnings to save
space. Keep this first change focused on layout, with no parsing or schema change.

Acceptance: compare the same two-row fixture before and after on the tablet;
record card heights and scrolling needed to reach the second price and Add.
Both Item and Price must be visible together when editing a row on the tablet.
At 320 and 390 CSS pixels there must be no horizontal page overflow, clipped
labels or smaller-than-minimum touch targets. Recheck mapping cancellation,
typing focus, native keyboard resizing, Preview and Copy values.

Alternatives: collapsing each row would save more space but add an opening step
and conceal comparison information. A spreadsheet editor introduces selection
and keyboard behavior the current app does not need. A responsive field layout
is the smallest useful starting point.

### 2. Describe import choices with the seller's words

Observed during the quantity workflow: the button reads
"Use source row 3 as item name for 2 rows" while Arrow Orb is shown in separate
text above it. The category choice similarly emphasizes source-row numbers.
The user must translate implementation references into the result they want.

Recommended wording: "Use Arrow Orb as the item name" and
"Use Figures as the category", with a nearby description saying the choice
applies to both included prices. Keep original line numbers as secondary
context and preserve unique accessible names when repeated labels occur.
Long, quoted and empty candidates need deliberate handling; insert names as
text, not HTML. Undo must name the result it reverses.

Acceptance: the same quantity fixture still produces one Figures category and
one Arrow Orb heading with both prices. Selection-limited changes must state
the correct affected count. Existing undo and source-preservation tests remain.

### 3. Make saved pages recognizable

Observed: the manually created Ceramics/Prints menu and the corrected short
price list are both listed as Untitled page, distinguished by edit time. Four
of the nine entries in the current drawer are Untitled page. The title control
exists but is folded under Private page title in Build.

Recommended first change: expose the existing page-title action from the page
drawer and use plain wording such as "Name this page". It should open and focus
the existing title field, not introduce a second naming state. Explain that this
name is for finding the saved page. Preserve explicit user titles and all saved
content. A content-derived secondary summary is a possible later improvement,
but should not silently rename documents or turn this into a storage migration.

Acceptance: name either untitled test page from the drawer, confirm the label
updates and persists after reopening, and verify the published menu is unchanged.
Keep deletion confirmation and current-page protection intact.

### 4. Reduce distraction from secondary controls

Observed: normal item cards repeat example hints even after valid values are
filled in. Selection checkboxes and reorder/delete controls remain prominent
for every product. The expanded bottom section chooser overlays content; its
absolute positioning is intentional, and closing it exposes the covered content.
It is not established as an unreachable-control defect.

Possible later refinement: show example hints where a field is empty or focused,
and make the chooser's close action more explicit. Avoid hiding bulk selection
or moving controls solely to make a screenshot look cleaner. Measure whether
the first two changes already remove enough scrolling before adding more modes.

## Evidence

- [Item cards and the expanded section chooser](media/2026-10-05-usability-editor.png)
- [Saved-page names](media/2026-10-05-usability-pages.png)
- [Completed workflow checks and output screenshots](2026-10-05-tablet-workflows.md)

Fresh code locations: `app/src/ui/page-paste.ts` correction cards and source
choices; `app/src/styles.css` card grids and `.section-additions-sticky`;
`app/src/ui/pages-sidebar.ts` page labels; `app/src/ui/build.ts` privateTitle.

## Recommended sequence

Start with the compact correction layout, then clearer source-choice wording,
then easier page naming. Treat each as a bounded change with its own acceptance
checks. Preserve the current engine, schema, review decisions and saved documents.
No new framework, dependencies, onboarding wizard or redesign is justified by
this evidence. The seller-session gate remains superseded by Jakob's instruction.

This audit changed documentation only. Application improvements above are
recommendations, not implemented features. The tablet's USB stay-awake setting
was restored to 0. No restart is required.
