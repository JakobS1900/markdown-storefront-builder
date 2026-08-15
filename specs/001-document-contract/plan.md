# Implementation Plan: The Document Contract

**Branch**: `001-document-contract` | **Date**: 2026-08-15 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-document-contract/spec.md`

## Summary

Define the one shape every other part of the product reads and writes: a
versioned page containing an ordered list of blocks. Ship it with a validator
that reports every problem in terms an artist can act on, a canonical writer that
produces identical bytes for identical content, a forward-migration mechanism
that is empty today because this is version 1, and a parity test that fails the
build if any field name, type, or order changes without someone deciding to
change it.

The technical approach is one ordered schema descriptor as the single source of
truth. The validator walks it, the writer emits keys in its order, and the parity
test snapshots it. This exists because TypeScript types are erased at runtime, so
nothing can reflect over them to produce the guard that FR-013 requires.

## Technical Context

**Language/Version**: TypeScript 5.4 on Node 24, target ES2022, strict mode with
`noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`
**Primary Dependencies**: None at runtime. The engine package has zero runtime
dependencies by constitution. Dev only: Vitest, ESLint 9, `tsc`
**Storage**: None in this feature. The contract defines what will be stored;
storage itself arrives in 2.1
**Testing**: Vitest, run via `npm run verify` from PowerShell
**Target Platform**: Browsers, including mid-range phones. The engine is
platform-neutral and touches no platform API
**Project Type**: Library. A pure module inside the `engine` workspace package
**Performance Goals**: A 50-block page validated and ready in under 100
milliseconds on a mid-range phone (SC-005), guarded by a test with headroom
**Constraints**: Pure. No DOM, no network, no clock, no randomness, enforced by
ESLint over `engine/src/**` and verified firing on 2026-08-15
**Scale/Scope**: Pages of kilobytes, tens of blocks. Six block kinds, four
nested item types, twenty validation rules

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Name each principle and state how this plan satisfies it, or record an explicit,
justified exception in the Complexity Tracking table below. An exception without a
written justification is a blocker, not a note.

| # | Principle | How this plan satisfies it |
|---|---|---|
| I | The Engine Is a Pure Function | The module lives in `engine/src/document/`, so the existing ESLint restrictions on `document`, `window`, `fetch`, `Date.now`, `Math.random`, and `new Date` apply to it automatically. `validateDocument` and `parseDocument` never throw for any input, which is the same total-function discipline Principle I imposes on `compile()`. Guarantee G1 in the contract states this and the tests assert it. |
| II | Hosts Are Data, Never Code | The contract stores `target` as an opaque non-empty string and does NOT enumerate valid hosts. Adding a host therefore requires no change to the contract and no regenerated parity snapshot. Enumerating hosts here would have created exactly the coupling this principle forbids. See research D5. |
| III | Test-First, With Golden Files | TDD throughout: failing test first, then the minimum code. All three structurally required tests land in this feature and are its main deliverable: the parity test on field names, types, and order, the lossless round-trip test, and, because there is no compiler yet, the determinism guarantee in the form of stable serialization (G3). The parity snapshot is a golden file in exactly the sense the principle means. |
| IV | The Narrow Gate | Partially applicable, stated rather than skipped. There is no preview and no rendering in this feature, so the sanitizer and the raw-HTML rule have nothing to act on yet and land in 1.3 with the `prose` emitter. What does apply is the boundary discipline: the validator is the gate through which all external data enters the product, and per FR-017 it rejects unknown fields rather than passing them through. No secret exists in this feature, and the CI secret scan already runs over it. |
| V | The User's Work Is Sacred | This feature is almost entirely this principle. `schemaVersion` is field one. A future version is refused with a distinct code and nothing is read or written (G6). The forward-migration registry ships empty because it cannot be retrofitted onto pages already saved in the wild (research D7). Guarantee G5 states that nothing is mutated, so a rejected page is returned untouched. FR-003 and SC-006 require rejection messages that name the offending block in language an artist can act on. |
| VI | Reachable By The People Who Need It | Not applicable at this layer, stated rather than skipped. This feature renders no interactive control, so there is no touch target, accessible name, or keyboard path to enforce. The a11y gate correctly reports SKIPPED and will fail loudly the moment `app/index.html` exists. The principle becomes enforcing at 2.2. |
| VII | Honest Fidelity | Not applicable at this layer, stated rather than skipped. There is no preview and no compiled output to render, so there is no fidelity claim to make or break. The principle becomes enforcing at 2.3. Its spirit is honoured here in that the contract does not pretend to validate things it cannot, notably whether a target exists or whether an image address resolves. |

**Gate result**: PASS. No violations. Three principles are recorded as not
applicable or partially applicable at this layer, each with the reason and the
roadmap item where it becomes enforcing. The Complexity Tracking table is empty.

## Project Structure

### Documentation (this feature)

```text
specs/001-document-contract/
├── plan.md              # This file
├── spec.md              # The specification, with clarifications
├── research.md          # Phase 0 output, ten decisions
├── data-model.md        # Phase 1 output, the normative field order
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── document-api.md  # Phase 1 output, the public surface and eight guarantees
├── eng-review.md        # Architecture review gate, two HIGH findings folded back
├── checklists/
│   └── requirements.md  # Spec quality validation
└── tasks.md             # Phase 2 output, created by /speckit-tasks
```

### Source Code (repository root)

```text
engine/
├── src/
│   ├── index.ts               # existing, re-exports the document module
│   └── document/
│       ├── index.ts           # the public surface
│       ├── descriptor.ts      # the ordered schema descriptor, source of truth
│       ├── types.ts           # types DERIVED from the descriptor, see review R-1
│       ├── validate.ts        # validateDocument, parseDocument
│       ├── serialize.ts       # serializeDocument, canonical key order
│       ├── migrate.ts         # forward migration registry, empty at v1
│       └── empty.ts           # emptyDocument
└── tests/
    ├── skeleton.test.ts       # existing
    └── document/
        ├── parity.test.ts
        ├── parity.snapshot.json
        ├── types.test.ts
        ├── roundtrip.test.ts
        ├── parse.test.ts
        ├── serialize.test.ts
        ├── validate.test.ts
        ├── version.test.ts
        ├── performance.test.ts
        └── fixtures/
```

**Structure Decision**: A single module inside the existing `engine` workspace
package, not a new package. The contract has no consumers that could take it
without also taking the compiler, so a separate package would add a version
boundary and a publish step for no benefit. `app/` and `proxy/` do not exist yet
and are not created by this feature.

The split into seven small files follows from the descriptor being the source of
truth: the validator, writer, and migration registry each read it and are
otherwise independent, which keeps every file small enough to hold in context and
to review on its own.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations. Table intentionally empty.
