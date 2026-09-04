# Bringing in a Price List: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan chunk-by-chunk. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A seller pastes the price list they already have, ticks the lines that
are items, and one action turns them into products in the price list they were
looking at. Reversible in one press. Nothing is discarded until they say so.

**Architecture:** A pure line reader in the app turns pasted text into candidate
lines, inferring a delimiter for the paste as a whole and falling back to the
last number in the line. The candidates live in the store, not in the document,
so nothing pasted can be saved, compiled or published before conversion.
Conversion is one `replaceBlocks` write through the existing `applyBulkPricing`
path, which makes it one save and one undo. No schema change.

**Tech Stack:** TypeScript strict, Vite, Vitest, jsdom. No new dependencies.

**Spec:** `specs/023-import/spec.md`

**Plan location note:** Beside its spec, matching 001, 002, 021 and 022.

## No contract chunk, and why that is not a shortcut

`CLAUDE.md` requires the cross-boundary contract to land first, alone, with a
parity test. This feature has no contract change: `SCHEMA_VERSION` stays 3 and
every field a converted row needs already exists (`name`, `price`, `unit`,
`blurb`, `cost` in `MENU_TIER_FIELDS`). The rule is satisfied by there being
nothing to land, not waived. If any chunk below finds itself wanting a schema
field, it must stop, because that is the signal the spec named as scope drift.

## Global Constraints

- **No em dashes and no en dashes anywhere.** Code, comments, commit messages,
  docs, UI copy. `npm run dashscan` enforces it and is part of `npm run verify`.
- **No AI attribution in commit messages.** No co-author trailer, no "generated
  with". This overrides any template or environment reminder.
- **Never use `--no-verify`.**
- **Run all npm and npx commands from PowerShell, not the Bash tool.**
- **Never check a gate's exit status through `Select-Object -First N`.**
- **Do NOT append to files with `cat >>` through the Bash tool.** Use Write or
  Edit.
- **Constitution Principle I:** nothing here goes in `engine/src/**`. This is
  entirely app-side, so the DOM, clock and randomness rules do not bite, but the
  reason they exist does: the line reader must stay pure and testable.
- `@typescript-eslint/no-non-null-assertion` is an **error** in `app/tests/**`.
  No `!` in any app test.
- `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
  `verbatimModuleSyntax`, `no-console` are all on.
- Relative imports carry the `.js` extension even from `.ts` files.
- Comments explain why, usually by naming the failure that caused the decision.

## An amendment this plan makes to the spec

**FR-061b's "create one if none" branch is unreachable and is removed.**

The spec says conversion adds to the price list the seller started from, and
that the app must create a price list where the page has none. Once the entry
point is a button inside a price list section (Chunk 4), the second half cannot
happen: reaching the paste screen at all means a price list exists. A
requirement nothing can satisfy is worse than no requirement, because a reviewer
will look for the code that meets it. A page with no price list gets one through
the existing "add a section" flow, which is one press and already built.

Recorded here rather than edited quietly into the spec, the same way 012 amended
011 and 014 amended 010.

**A section holding one entirely blank placeholder row is filled, not appended
to.** `menuForm` gives every new price list section one empty tier
(`app/src/ui/forms.ts:217`). Appending after it would leave a blank first
product in every list built this way, which is the common path, not an edge
case.

---

### Chunk 1: The line reader

Pure functions over text. No DOM, no store, no document. Everything the sniffer
decides is a suggestion, so this chunk is where "the guess is cheap to correct"
is made true.

**Files:**
- Create: `app/src/price-list-text.ts`
- Test: `app/tests/price-list-text.test.ts`

**Interfaces:**
- Produces `readCandidates(text: string): readonly Candidate[]`, where
  `Candidate` is `{ line: string; suggested: boolean; name: string; price: string; unit?: string; cost?: string }`.
- Produces `inferDelimiter(lines: readonly string[]): Delimiter`, exported for
  its own tests.

**Steps:**
- [ ] Write the failing tests first, covering: comma, tab, pipe and dash
      delimited pastes; a paste with no delimiter falling back to the last
      number; "Custom piece - DM me" keeping "DM me" verbatim; a line with no
      number at all becoming a name with an empty price rather than being
      dropped; leading "- ", "* " and "1. " stripped; Markdown table pipes and
      a `|---|---|` separator row not becoming products; blank lines and
      heading-shaped lines left unsuggested; every character of the input
      accounted for across the fields.
- [ ] Implement to green.
- [ ] Reuse `parseMoney` from `app/src/money.ts` to decide whether a fragment
      looks like a price. Never to rewrite one.

**Acceptance:** FR-059b, FR-062, FR-062a, FR-062b. Tests pass. The module
imports nothing from the DOM or the store.

---

### Chunk 2: The paste screen state and its ticks

Where the ticks live, which the spec settled deliberately: on this screen, not
as draft rows in the document.

**Files:**
- Modify: `app/src/store.ts`
- Test: `app/tests/price-list-paste.test.ts`

**Interfaces:**
- `State` gains `readonly pasting?: { readonly blockId: string; readonly text: string; readonly ticked: readonly number[] }`.
  Ticks are held by line index, which is safe here and is not the mistake
  `selectedTiers` avoids: this text is immutable while the screen is open, so an
  index cannot come to mean a different line. A comment must say so, because the
  next reader will arrive knowing rule that ids beat indices.
- Store functions: `startPasting(blockId)`, `setPasteText(text)`,
  `togglePasteLine(index)`, `tickAllPasteLines()`, `untickAllPasteLines()`,
  `stopPasting()`.

**Steps:**
- [ ] Failing tests first: setting text re-suggests ticks; toggling one line
      leaves the rest alone; tick all and untick all; the paste never reaches
      `state.doc`; `stopPasting` clears it.
- [ ] Implement. `setPasteText` must go through `setQuietly`/`set` and must NOT
      call `update()`, because `update()` writes the document and would clear
      the undo offer for a paste that changes no document.

**Acceptance:** FR-058, FR-059, FR-059a. A test asserts the document is
untouched by everything in this chunk.

---

### Chunk 3: Conversion and undo

**Files:**
- Create: `app/src/ui/price-list-paste.ts`
- Modify: `app/src/store.ts`
- Test: `app/tests/price-list-convert.test.ts`

**Interfaces:**
- `convertPaste(blockId)` builds the new tiers with `newId()` per row and writes
  once through the existing `applyBulkPricing(blockId, next, label)` path, which
  already sets a single `bulk` undo entry and does one `replaceBlocks`.

**Steps:**
- [ ] Failing tests first: converting appends in paste order; every new row has
      a distinct id; a section holding one blank placeholder is filled, not
      appended to; converting nothing does nothing and announces it; undo
      restores the section exactly; the text and ticks survive the undo;
      converting twice appends twice.
- [ ] Implement.
- [ ] A test asserting a converted row carrying `cost` still never compiles,
      leaning on the existing guarantee rather than assuming it.

**Acceptance:** FR-061, FR-061a, FR-061b, FR-063, FR-064, FR-064a, FR-066.

---

### Chunk 4: The screen, the entry point, and opening a file

**Files:**
- Modify: `app/src/ui/price-list-paste.ts`
- Modify: `app/src/ui/forms.ts`
- Modify: `app/src/styles.css`
- Test: `app/tests/price-list-screen.test.ts`

**Steps:**
- [ ] Failing tests first: the button appears in a price list section; pressing
      it opens the screen; the live count of ticked lines; opening a text file
      fills the screen; an unreadable file changes nothing and says so.
- [ ] Render with `el`, `button`, `field`, `checkbox` and `announce` from
      `dom.ts`. Every control gets a real accessible name, not a placeholder
      standing in for a label, which `npm run a11y` checks.
- [ ] The file picker copies the pairing at `app/src/ui/export.ts:57`: a hidden
      input with a real button in front of it. Accept `.csv`, `.txt`, `.tsv`,
      `.md`. It must NOT accept `.json`, so it can never be confused with
      opening a backup.
- [ ] UI copy must not use the word "import" anywhere.
- [ ] Touch targets meet the stylesheet minimum.

**Acceptance:** FR-057, FR-060, FR-065, FR-067.

---

### Chunk 5: Verification and holistic review

**Steps:**
- [ ] `npm run verify` from PowerShell, whole, not through a truncating pipe.
- [ ] One holistic review over the entire feature diff. `CLAUDE.md` requires it
      above roughly three chunks and this is four. Eighteen features went
      without one before 021, and `specs/021-starting-points/holistic-review.md`
      records exactly what per-chunk review structurally cannot see.
- [ ] Fix-first on findings. Mechanical fixes applied, genuine decisions batched
      into one question.
- [ ] Update `specs/README.md`'s status table with 023.

**Acceptance:** Every gate green, with output quoted. "Done" means verified.
