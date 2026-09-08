# Implementation Plan: The Setup Wizard

**Branch**: `027-setup-wizard` | **Date**: 2026-09-08 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/027-setup-wizard/spec.md`

## Summary

A question by question front door that hands somebody a page with their own
words already in it, instead of a form and a hope. Six questions, one idea per
screen, every one skippable. The answers select one of the eight starting points
that already ship and fill parts of it in.

**This feature adds no schema and touches no engine code.** The audit in the
spec checked every question Jakob asked against the contract and found that all
ten answers already have somewhere to go. That is the whole shape of the work:
it is a surface over a schema that is finished.

The examples in empty fields turned out to be smaller still. `research.md` R2
found the mechanism already exists, the app has 13 hints across 49 fields, and
Price has an example while Item does not. So that half is hint text and a test,
not code.

## Technical Context

**Language/Version**: TypeScript 5, ES modules, `strict` plus
`noUncheckedIndexedAccess`
**Primary Dependencies**: None new. The app has no UI framework by choice and
this adds none.
**Storage**: IndexedDB through `app/src/db.ts`, reached only via the existing
`openBackup` path. No new store, no schema version bump.
**Testing**: Vitest under jsdom for the surface, axe-core for the a11y gate,
headless Chrome for the contrast gate
**Target Platform**: Mobile web and an Android WebView wrapper, 390px first
**Project Type**: Single project, engine plus app
**Performance Goals**: No repaint on a question that stalls typing; the starter
chunk is a lazy dynamic import already covered by `setBusy`
**Constraints**: Offline capable, 44 by 44 minimum touch targets, WCAG AA in both
palettes, no horizontal scrolling at 390px
**Scale/Scope**: One new surface, six questions, roughly 36 fields gaining a hint

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | How this plan satisfies it |
|---|---|---|
| I | The Engine Is a Pure Function | `engine/src/**` is not opened. The wizard builds a `Document` in the app and hands it to code that already exists. The ESLint rule that enforces this is not touched or exempted. |
| II | Hosts Are Data, Never Code | No host is added or changed. The wizard produces a document; what any host does with it is unchanged. |
| III | Test-First, With Golden Files | Every chunk starts with a failing test. No golden file moves, and that is an assertion rather than an assumption: a page the wizard produces from no answers must compile identically to the starter it chose, and that is a test. |
| IV | The Narrow Gate | The wizard adds user authored strings, so the XSS corpus grows by the store name and the first item's name and price. They reach the page through the same escaping path as everything else, which FR-131 requires and a test proves. |
| V | The User's Work Is Sacred | FR-123 and FR-125. The wizard creates a new page through `openBackup` and never edits the page somebody is on. Abandoning creates nothing. Nothing is deleted anywhere, including the starting point picker. |
| VI | Reachable By The People Who Need It | The whole feature exists for this principle. The a11y gate is extended to render the wizard at every question, and the contrast gate is extended to open it, because a gate that never lays a surface out is green about nothing. |
| VII | Honest Fidelity | The wizard shows the person what it made rather than claiming it. It finishes by opening the page in the editor, where Preview already tells the truth about each host. |

No exceptions. The Complexity Tracking table is empty and stays empty.

## Project Structure

### Documentation (this feature)

```text
specs/027-setup-wizard/
├── plan.md              # This file
├── research.md          # Phase 0, six decisions and one spec amendment
├── data-model.md        # Phase 1, the answer set and what it becomes
├── quickstart.md        # Phase 1, how to drive it and what to check
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2, from /speckit.tasks
```

### Source Code (repository root)

```text
app/
├── src/
│   ├── ui/
│   │   ├── wizard.ts          # NEW. The surface, its questions, and the trap.
│   │   ├── wizard-answers.ts  # NEW. Answers to a Document. Pure, so it is testable alone.
│   │   ├── forms.ts           # Hints added to the fields that lack one.
│   │   ├── build.ts           # The entry point on the empty state.
│   │   ├── shell.ts           # Renders the layer, sets inert, restores focus.
│   │   ├── pages-sidebar.ts   # Read for its precedent. Not changed.
│   │   └── dom.ts             # Unchanged. No new primitive.
│   ├── store.ts               # wizardOpen, and the actions that move a question.
│   └── surface-history.ts     # Back dismisses the wizard first.
└── tests/
    ├── wizard.test.ts         # NEW. The surface and the flow.
    ├── wizard-answers.test.ts # NEW. Answers to a Document, in isolation.
    ├── field-examples.test.ts # NEW. Every field has an example or is exempt.
    └── a11y.test.ts           # Extended: the wizard at every question.

scripts/
└── contrast.mjs               # Extended: opens the wizard, counts it, guards it.

engine/                        # NOT TOUCHED.
```

## Chunks

Five chunks. Over the roughly three chunk threshold in `CLAUDE.md`, so **a
holistic review over the whole diff before the feature is called done is
mandatory, not optional.** Feature 024 is the reason that rule exists: its
holistic review found two high severity defects that every per chunk review had
passed, both of them seams where each side was internally correct.

### Chunk 1: examples in the fields

Independent of everything else and shippable alone. It is first because it is
the smallest thing that answers the original complaint, and because if it turns
out to be enough on its own, that is worth knowing before building a surface.

- A failing test that asserts every text field in every section form either
  carries a hint with a concrete example in it or is named in a short exemption
  list with a reason.
- Hints written for the fields that lack them, starting with **Item**, which sits
  next to Price and has no example while Price does.
- No `placeholder` attribute anywhere. The existing a11y assertion already
  refuses one and is not weakened.

The exemption list is the load bearing part. A test that just counts hints can
be satisfied with noise, so the exemption is explicit and each entry says why an
example would mean nothing there.

### Chunk 2: answers to a document, with no surface at all

`app/src/ui/wizard-answers.ts` and its test. A pure function from an answer set
to a `Document`, with no DOM, no store and no IndexedDB in it.

Doing this before the surface is deliberate. It is where every real decision
lives (which starter, where the store name goes, how a selling mode reaches a
tier), and testing it through six screens of clicking would make those decisions
expensive to check and easy to get wrong quietly.

- An empty answer set produces the default starter unchanged. **This compiles
  byte identically to opening that starter from the picker**, and that is the
  test, not a comment.
- The store name reaches `profile.displayName`, per FR-121. A test asserts it
  reaches the compiled output, because reaching the field is not the promise.
- A selling mode reaches `tier.availability` with one of the four values 026
  defined, and nothing else invents a parallel field.
- The XSS corpus grows by the store name, the item name and the price.

### Chunk 3: the surface

`app/src/ui/wizard.ts`, following 025's drawer precisely: `div` with
`role="dialog"`, not an `aside`; `inert` by attribute on the header and main;
the focus trap and the `div[tabindex="-1"]` that makes it testable.

- One question per screen, six of them, each skippable.
- Back a question keeps the answer, per FR-126.
- Store state for which question is open and what has been answered, on the
  immediate `set` path rather than the deferred one, the way `sidebarOpen` is.
- `surface-history.ts` dismisses the wizard before the surface, per FR-133.

### Chunk 4: the way in, and the way out

- The entry point on the empty state, beside the picker rather than in front of
  it, per FR-128.
- Finishing calls `openBackup(serializeDocument(doc))`, inheriting `setBusy` and
  the offline `load()` failure message from `starterPicker`.
- Abandoning at any point creates nothing and changes nothing, per FR-125. The
  test opens a page with real content first, runs the wizard halfway, abandons,
  and asserts the page is byte identical.

### Chunk 5: the gates

- `a11y.test.ts` renders the wizard at every question and asserts no violations,
  every control named, and the focus trap holding.
- `scripts/contrast.mjs` opens the wizard, counts what it drew, and **refuses a
  pass if it cannot see it.** This is not optional care: the same gate has twice
  been found green about a surface it never laid out, going 164 to 137 elements
  when 025 moved the page list, and never once opening a price row's fold until
  026 checked.
- Each new gate is broken on purpose to prove it fires, and the evidence is
  quoted in the commit. Project doctrine, and it exists because gates here have
  measured nothing before.

### Chunk 6: the holistic review

One fresh reviewer over the whole diff. The seams to look at are named in
advance: between the answer set and the document it becomes, and between the
wizard's finish and `openBackup`, which is where "never destroy work" is either
true or silently not.

## Complexity Tracking

No entries. No principle is bent by this plan, and nothing here needs an
exception.
