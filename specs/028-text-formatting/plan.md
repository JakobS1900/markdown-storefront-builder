# Implementation Plan: Formatting Buttons Over a Text Section

**Branch**: `028-text-formatting` | **Date**: 2026-09-11 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/028-text-formatting/spec.md`

## Summary

Put a row of buttons above the Text field so a seller can format their writing
without typing a punctuation mark. Four of the six marks already compile and
have since feature 008; the buttons are the missing affordance. Highlight and
strikethrough are new and arrive as two host capabilities with cited values and
a declared fallback.

The host verification written for this feature also found a live defect in
shipped code, and closing it is part of the work:
`docs/research/2026-09-11-marks-verification.md`.

## Technical Context

**Language/Version**: TypeScript 5, ES2022 modules, strict.
**Primary Dependencies**: none at runtime in the engine, by constitutional
constraint. Vite for the app, Vitest for tests, axe-core for the gates.
**Storage**: IndexedDB, one `pages` store holding serialized documents as text.
Untouched by this feature.
**Testing**: Vitest, jsdom for app tests, headless Chrome for the three browser
gates. Golden files byte-compared across four targets.
**Target Platform**: an installable PWA, wrapped for Android with Capacitor. The
handset of record is a Moto G7 at 390 CSS pixels.
**Project Type**: a compiler plus the application that drives it. `engine/`
never imports from `app/`.
**Performance Goals**: not a factor here. The parser runs on one text block at a
time and the existing performance tests already bound it.
**Constraints**: 44 by 44 CSS pixel touch targets, no horizontal scroll at
390px, both colour palettes, offline.
**Scale/Scope**: two engine constructs, two capability flags, one escaper rule,
two renderer branches, one button row. No schema change.

## Constitution Check

*GATE: passed before Phase 0. Re-checked after Phase 1, see below.*

| # | Principle | How this plan satisfies it |
|---|---|---|
| I | The Engine Is a Pure Function | Nothing added to `engine/src` touches the DOM, the network, the clock or randomness. The two new constructs are pure string to string, like every other one. The determinism test already sweeps them because it sweeps `compile`. The buttons live entirely in `app/`, which is the correct side of the boundary, and ESLint enforces the rest. |
| II | Hosts Are Data, Never Code | `strikethrough` and `highlight` are capability values, not branches on a host id. No emitter learns the name of a host. Each flag has a declared fallback written at the field, and each of the four targets gets a cited value. `Target.sources` is keyed on `keyof Capabilities`, so the citations are not optional: the code will not type-check without all eight. |
| III | Test-First, With Golden Files | Failing test first, per chunk. Golden files regenerate across all four targets and the diff is shown in the commit. The three structurally required tests already exist and must stay green; the schema parity snapshot must not move at all, which is the sharpest available proof that this feature is surface plus grammar and not a contract change. |
| IV | The Narrow Gate | This is the principle the feature is really about. The grammar stays a whitelist: two `Node` kinds are added, markers are written by the emitter, and every piece of seller text still reaches the output through `escapeText`. The XSS corpus grows by one case per new construct, which is two. The escaper closes the `=` hole the research found, so the whitelist's own claim about itself becomes true again. |
| V | The User's Work Is Sacred | No schema change, so no migration and no version step. `SCHEMA_VERSION` stays 5 and `parity.snapshot.json` must not move. A page saved before this feature opens unchanged after it, and FR-028-21 requires that its published bytes are identical unless the seller used a new mark. The buttons never replace the field's contents wholesale; they edit the selection. |
| VI | Reachable By The People Who Need It | Six buttons at 44 by 44 CSS pixels, each with an accessible name disambiguated by its section, keyboard operable because they are real buttons. The a11y gate must count more controls than before, and SC-028-7 makes a count that does not move a failure rather than a pass. Nothing here needs the network. |
| VII | Honest Fidelity | The preview keeps rendering the compiled output for the selected host, so a mark the host cannot show is shown absent. The limitation is stated in the product, as a message naming the section, and not only in this document. That is decision 2 and it is the reason the fallback is plain plus a warning rather than a silent substitution. |

No violations. The Complexity Tracking table is empty and has been removed.

## Project Structure

### Documentation (this feature)

```text
specs/028-text-formatting/
├── spec.md
├── plan.md              # this file
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/
│   └── requirements.md
└── tasks.md             # written by /speckit.tasks
```

### Source code

```text
engine/src/compile/
├── capabilities.ts      # two flags, each with its fallback at the field
├── targets.ts           # eight cited values across four targets
├── inline.ts            # two Node kinds, two patterns, the fallback branch
├── escape.ts            # the = rule the research settled
└── emit/prose.ts        # passes the target through to the grammar

app/src/ui/
├── dom.ts               # the button row primitive, opt in
├── forms.ts             # proseForm asks for it
└── render-markdown.ts   # del and mark

app/src/styles.css       # the row, both palettes, 44px targets

engine/tests/compile/    # inline, escape, host-escapes, textis, golden
engine/tests/compile/golden/{portable,rentry,text.is,menu-file}/
app/tests/               # render-markdown, forms, a11y, field-examples
docs/research/2026-09-11-marks-verification.md
```

**Structure Decision**: no new directories and no new modules. Every change
lands in a file that already exists, which is the strongest signal available
that this feature is shaped correctly: the grammar already had a place for a
construct, the capability record already had a place for a flag, and the form
already had a place for a control.

## The one design decision worth arguing

**`formatInline` has to learn about the target, and that is a real change to a
signature that has been stable since feature 008.**

Today `formatInline(text)` takes a string and returns a string, and
`emit/prose.ts` calls it per line. The two new marks are the first constructs
whose output depends on the host, so the grammar needs the target and a way to
report a diagnostic.

Three options were considered.

1. **Pass the target and a diagnostic sink into `formatInline`.** Chosen. It
   matches every emitter's existing shape: they all take `(block, target)` and
   most already take a sink. The grammar becomes an emitter in the way the rest
   of `emit/` already is.
2. **Strip unsupported marks in a pass after `formatInline`.** Rejected. It
   would mean parsing the compiler's own output to find markers the compiler
   just wrote, which is precisely the mistake the forgery bug is made of: a
   pattern cannot tell the seller's words from the compiler's structure once
   they are the same characters.
3. **Keep the markers and let the host show them literally.** Rejected by
   decision 2, and it is the worst of the three anyway. A seller who highlights
   "limited run" and publishes to a host without highlight would show buyers
   `==limited run==`.

`parseInline` stays pure and target-free, so it can still be tested on its own
and still returns nodes. Only `emitInline` learns the target. That keeps the
parse half, which is the security-critical half, exactly as it is.

## Chunks

One fresh implementer per chunk, then a fresh spec-compliance reviewer, then a
fresh code-quality reviewer. Carry-forwards as `CHUNK N:` comments at the site.

1. **The contract.** `capabilities.ts` and `targets.ts`: two flags, eight cited
   values, fallbacks written at the field. Alone, as the rules require, and
   consumed by nothing yet. This is the analogue of the schema commit that
   normally opens a feature here.
2. **The escaper.** The `=` rule. A defect fix, testable and shippable on its
   own, and deliberately ahead of the grammar so that the grammar is built on
   top of an escaper that is already correct.
3. **The grammar.** `inline.ts` and `emit/prose.ts`: two node kinds, the target
   parameter, the fallback and its diagnostic. Goldens regenerate here.
4. **The renderer.** `render-markdown.ts`: `del` and `mark`, which serves the
   preview and the saved menu file at once.
5. **The buttons.** `dom.ts`, `forms.ts`, `styles.css`, and the gate updates.

Five chunks, so **the holistic review over the whole diff is mandatory**, run
sequentially with a fresh reviewer. It has found something real on every feature
that ran it here, and on 027 it caught a wrong price reaching buyers.

## Phase 0 and Phase 1 outputs

- `research.md`: the five decisions, including the two the live probe settled
  and the one it reversed. The raw observations are in
  `docs/research/2026-09-11-marks-verification.md` rather than duplicated here.
- `data-model.md`: no document schema change. It describes the capability
  record, which is the only contract this feature touches, and states the
  parity snapshot must not move.
- `quickstart.md`: how to drive the six buttons and check the fallback.
- No `contracts/` directory. The engine's public surface gains two boolean
  fields on an existing exported interface and no new function. A contracts
  folder describing that would be a paraphrase of `capabilities.ts`, and this
  repository's index already warns that a document restating code is worse than
  no document.

## Constitution re-check after design

Unchanged, with one thing worth naming. The design decision above widens
`formatInline`'s signature, which touches Principle I's purity claim in
appearance only: a target record is data and a diagnostic sink is an array
being appended to, exactly as every other emitter already uses. No clock, no
randomness, no I/O. The determinism and golden tests cover it, and both already
sweep `ALL_TARGETS` rather than `TARGETS`, which is the array this feature must
be measured against.
