# Implementation Plan: The Compile Skeleton and Golden Harness

**Branch**: `002-compile-skeleton` | **Date**: 2026-08-15 | **Spec**: [spec.md](./spec.md)

## Summary

Turn a validated page into Markdown for a chosen host, alongside a list of every
compromise made in doing so. Two hosts described entirely as data, two trivial
emitters, and a golden fixture harness that compares output byte for byte.

The feature compiles almost nothing on purpose. Two block kinds are enough to
prove every structural claim: that a page becomes text, that two hosts differ,
that a missing capability degrades with a named warning instead of breaking, and
that the same input always yields the same bytes. The four interesting emitters
then land one at a time against a pipeline already known to work.

## Technical Context

**Language/Version**: TypeScript 5.4, Node 24, ES2022, strict
**Primary Dependencies**: None at runtime. Depends on the `document` module from
feature 001, within the same package
**Storage**: None
**Testing**: Vitest, plus golden `.md` files compared byte for byte
**Target Platform**: Browsers including mid-range phones. Platform neutral
**Project Type**: Library. A second module inside the `engine` package
**Performance Goals**: A 50 block page compiled in under 25 milliseconds on the
development machine, against a 100 millisecond user-facing budget (SC-008)
**Constraints**: Pure. No DOM, no network, no clock, no randomness, enforced by
ESLint over `engine/src/**`
**Scale/Scope**: Two targets, four capabilities, two emitters, three diagnostic
codes

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | How this plan satisfies it |
|---|---|---|
| I | The Engine Is a Pure Function | This is the principle's namesake. `compile()` is pure, takes a document and a target id, returns text and diagnostics, and never throws for a valid page and any identifier (FR-002). The existing ESLint restrictions over `engine/src/**` apply automatically. Determinism is asserted directly by SC-002 and the golden files. |
| II | Hosts Are Data, Never Code | The other namesake. A target is a record of capability values with a source citation each. No emitter branches on a host identity, only on capability values. SC-007 makes this checkable rather than aspirational: a test adds a throwaway host and compiles with it, which is only possible if hosts are genuinely data. |
| III | Test-First, With Golden Files | Golden files arrive here, and they are the feature's main deliverable alongside the compiler. One expected `.md` per fixture per target, byte compared, readable by a human so a diff can be judged. TDD throughout. The determinism property test lands here, since there was no compiler to assert it against in 001. |
| IV | The Narrow Gate | Applies directly, in its emitted-text form. All artist text is escaped before reaching output (FR-009), and FR-010 with SC-006 require that no artist text can alter the structure of the surrounding page, tested against a corpus written to try. The DOM-facing sanitizer is a separate thing and lands in 1.3 with the preview. |
| V | The User's Work Is Sacred | Nothing here writes or deletes. Two decisions carry the principle: an unknown target falls back and warns rather than refusing, so a page stays usable (FR-008); and output over a size limit is returned in full with a warning rather than truncated, because the compiler cannot know which part of the artist's page matters least (FR-015). |
| VI | Reachable By The People Who Need It | Not applicable at this layer, stated rather than skipped. No interactive control is rendered. The a11y gate still reports SKIPPED and becomes enforcing at 2.2. |
| VII | Honest Fidelity | Applies partly and is honoured in what this feature refuses to claim. Every capability value cites its source (FR-014), and anything rentry does not document is recorded as unknown rather than assumed supported. Assuming support produces broken pages; assuming absence produces safe ones. The preview and its stated approximation limits arrive at 2.3. |

**Gate result**: PASS. No violations. One principle not applicable at this layer,
with the reason and the roadmap item where it becomes enforcing. Complexity
Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
specs/002-compile-skeleton/
├── plan.md
├── spec.md
├── research.md
├── data-model.md
├── contracts/
│   └── compile-api.md
├── quickstart.md
└── tasks.md
```

### Source Code (repository root)

```text
engine/
├── src/
│   ├── index.ts                     re-exports both modules
│   ├── document/                    feature 001, unchanged
│   └── compile/
│       ├── index.ts                 the public surface
│       ├── targets.ts               the target records, data only
│       ├── capabilities.ts          capability types and lookup
│       ├── escape.ts                artist text to safe Markdown
│       ├── diagnostics.ts           diagnostic codes and messages
│       ├── emit/
│       │   ├── heading.ts
│       │   └── divider.ts
│       └── compile.ts               the entry point and block dispatch
└── tests/
    ├── document/                    feature 001, unchanged
    └── compile/
        ├── compile.test.ts
        ├── targets.test.ts
        ├── escape.test.ts
        ├── golden.test.ts           the harness
        ├── determinism.test.ts
        ├── performance.test.ts
        ├── fixtures/                input pages
        └── golden/
            ├── portable/            expected .md per fixture
            └── rentry/
```

**Structure Decision**: A second module beside `document` in the same package,
not a new package. The compiler cannot be used without the contract and nothing
would consume one without the other, so a package boundary would add a version
edge and a publish step for nothing.

`emit/` is a directory from the start even though it holds two files, because
four more arrive one per roadmap item and each is independently reviewable. One
file per block kind also keeps each small enough to hold in context.

## Complexity Tracking

No violations. Table intentionally empty.
