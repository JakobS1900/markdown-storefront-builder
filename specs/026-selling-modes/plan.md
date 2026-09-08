# Implementation Plan: Selling modes

**Branch**: `026-selling-modes` | **Date**: 2026-09-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/026-selling-modes/spec.md`

## Summary

A price row can say whether the item is in stock, made to order or a preorder,
and how long a buyer waits. Both optional, both emitted beside the item, and
completely invisible to every page that does not use them.

Schema version 5, landing first and alone. `availability` is an optional enum
with three values and `leadTime` is optional text, which is a shape the contract
already expresses: `profile.status` is the same field one level up.

This lands before the wizard because a wizard built first would ask these
questions against fields that do not exist and write the answers into free text,
and every one of those answers would have to be found and migrated afterwards.

## Technical Context

**Language/Version**: TypeScript 5.4, strict, ES2022.
**Primary Dependencies**: None. The engine has zero runtime dependencies by
constitution and nothing here needs one.
**Storage**: Unchanged. Two optional fields inside a structure already stored.
**Testing**: Vitest, golden files byte compared across every target, parity
snapshot, jsdom for the editor controls, axe for the new controls.
**Target Platform**: Mobile first PWA plus the Capacitor Android build.
**Project Type**: npm workspaces monorepo, pure engine plus vanilla TS app.
**Performance Goals**: Unchanged. Two optional reads per row in an emitter that
already reads eight.
**Constraints**: Offline, no network, no new dependency, no host capability.
**Scale/Scope**: One seller, their own price list.

## Constitution Check

| # | Principle | How this plan satisfies it |
|---|---|---|
| I | The Engine Is a Pure Function | Two fields read and two strings emitted. No DOM, no clock, no randomness, no I/O. The v4 to v5 migration stamps the version and creates nothing, so it invents nothing and stays deterministic. ESLint enforces the boundary over `engine/src/**`. |
| II | Hosts Are Data, Never Code | No capability, no target change, no citation. Every host renders words, so there is nothing here a host can lack and therefore nothing to declare a fallback for. Adding a capability with no consumer would be "a guess written down", which `capabilities.ts` forbids. |
| III | Test-First, With Golden Files | Failing test first throughout. The three structurally required tests all move: parity regenerated and its diff read, round trip extended, determinism re-run. Golden files change ONLY for a fixture that uses the new fields, and any movement in a fixture that does not is a defect this must not ship. |
| IV | The Narrow Gate | `leadTime` is a new user authored field, so the hostile corpus grows by a case, which this principle requires rather than suggests. It reaches a table cell and a bullet, and goes through the same `cell` and `escapeText` every other seller string does. The enum cannot carry seller text at all. |
| V | The User's Work Is Sacred | `schemaVersion` to 5, forward only, with a fixture. A newer page is still refused unread and its exact bytes still offered back. Nothing is inferred from a seller's existing `details` line and nothing rewrites it. Both fields clear to absent rather than to empty, so a cleared row is indistinguishable from one that never had them. |
| VI | Reachable By The People Who Need It | The new controls clear 44 by 44, carry real names rather than plausible ones, and are keyboard operable. They go inside the `More details` fold, because FR-092 in feature 024 forbids growing a blank price row past two fields and that rule did not expire. The a11y gate covers them. |
| VII | Honest Fidelity | The preview renders compiled output, as always, so the mode appears there because it appears in the output and not because the preview draws it specially. |

**Result: pass**, with no exceptions to record. Complexity Tracking is empty and
that is not an oversight: this feature adds an instance of a pattern the
codebase already has rather than a new mechanism.

## Project Structure

### Documentation

```text
specs/026-selling-modes/
├── plan.md              # This file
├── spec.md              # FR-108 to FR-118, SC-001 to SC-005
├── research.md          # Five decisions, none of them a reversal
├── checklists/
│   └── requirements.md
└── tasks.md             # /speckit.tasks, not created here
```

### Source code

```text
engine/src/
├── document/
│   ├── descriptor.ts    # SCHEMA_VERSION 5, availability and leadTime
│   └── migrate.ts       # v4 to v5, stamp only
└── compile/emit/
    └── menu.ts          # the Availability column, and the line in itemBody

engine/tests/
├── document/
│   ├── fixtures/v4-*.json
│   ├── migrate-selling-modes.test.ts
│   └── parity.snapshot.json
└── compile/
    ├── fixtures/selling-modes.json
    ├── golden/{portable,rentry,text.is,menu-file}/selling-modes.md
    └── selling-modes.test.ts

app/src/ui/forms.ts      # the two controls, inside More details
app/tests/               # editor coverage, a11y, hostile corpus
```

**Structure Decision**: No new module anywhere. Two descriptor entries, one
migration step, one emitter change, two form controls. A feature that needs a
new file to hold two optional fields would be a sign the fields were in the
wrong place.

## Complexity Tracking

Empty. Nothing here is a violation and nothing needs justifying, which is worth
stating rather than leaving as a blank heading somebody wonders about.

## The rule that governs this whole feature

**Every page in existence has neither field, so every page in existence must
compile to exactly what it compiles to now.** Byte for byte, every target.

That is FR-110 and SC-001, and it is the assertion to write first and run most
often. Feature 024 proved the same property one version earlier by compiling its
old fixture on both sides of the migration rather than reasoning that an
optional field cannot matter, and it is the reason a conditional column is used
here: a column that appeared whether or not anybody used it would change every
golden file in the repository and the diff would bury the one thing worth
looking at.
