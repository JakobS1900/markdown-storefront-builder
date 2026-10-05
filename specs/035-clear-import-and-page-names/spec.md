# Clear import choices and saved-page names

Status: shipped as v0.13.0 on 2026-10-05 through PR #5. Both bounded
usability improvements passed full verification and signed tablet checks.
Based on the recorded tablet audit and explicit GitHub delivery approval.

## User scenarios and testing

### US1: Understand an import choice

When reviewing a quantity table below Arrow Orb and Figures, the seller can
choose `Use Arrow Orb as the item name` and `Use Figures as the category`.
Nearby text identifies how many included or selected prices will change.
The original line number remains available as secondary context. Undo explains
which named choice it reverses. Existing mapping and source-preservation behavior
continues to work.

### US2: Recognize a saved page

From Your pages, the seller can choose Name this page for the open page. This
closes the drawer, opens Build and focuses the existing title field. The field
explains that this name helps find the saved page and does not change its
published content. The drawer updates after typing, and the name persists after
reopening. To name another page, open it first. No second title editor is needed.

## Requirements

- FR-001 Import reuse buttons lead with the actual candidate name and desired
  role. Nearby text states the affected selected/included price count accurately.
- FR-002 Preserve unique accessible names for repeated candidates, secondary
  original-line context, precise undo scope and existing review safeguards.
  Long, quoted and markup-like names render safely as text and wrap without
  overflow. Empty candidates must not produce a misleading blank-name action.
- FR-003 Your pages exposes Name this page for the open page, in both drawer
  and pinned layouts. It opens and focuses the existing title input on Build,
  including when invoked from Preview or Copy and on an empty page.
- FR-004 Explain the private purpose of the title. Preserve explicit titles,
  persistence, all document content, generated output, unsaved editing safeguards,
  delete confirmation and current-page protection. No automatic renaming.
- FR-005 Keep keyboard access, focus retention, explicit labels and minimum
  44px targets. Fit 320px and 390px screens and the 800px tablet.
- FR-006 No dependencies, schema, parser, storage migration or engine changes.

## Success criteria

- SC-001 The quantity fixture produces the same category, item and prices before
  and after the wording change; selected-count and undo checks pass.
- SC-002 Naming from the drawer takes one naming action after opening the drawer;
  the field has focus and the existing value. Rename survives reopen, while
  compiled output is byte-identical.
- SC-003 Full verification passes; both flows pass on the connected tablet with
  saved pages retained. Signed update, evidence and GitHub push are delivered.

## Scope and assumptions

These are two bounded improvements to existing controls. The user approved the
remaining audit recommendations. No automatic naming or new naming state, broad
copy rewrite, onboarding redesign or new import choice is included. Expert
device checks replace unavailable testers; they are not participant research.
