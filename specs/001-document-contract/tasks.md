# Tasks: The Document Contract

**Feature**: 001-document-contract
**Input**: Design documents from `specs/001-document-contract/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/document-api.md, eng-review.md

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallelizable, touches a different file with no dependency on incomplete work
- **[US1] [US2] [US3]**: the user story the task serves

## Path Conventions

Source in `engine/src/document/`, tests in `engine/tests/document/`. All npm
commands run from PowerShell, never the Bash tool. See `CLAUDE.md`.

## Testing is MANDATORY

Constitution Principle III. A failing test is written first, then the minimum
code to pass it. Every test task below precedes the implementation it guards,
and that ordering is not negotiable.

---

## Phase 1: Setup

- [ ] T001 Create the module and test directories: `engine/src/document/` and `engine/tests/document/fixtures/`

The toolchain, lint rules, and verify gate already exist from Phase 0. There is
nothing else to set up, which is the point of having bootstrapped first.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The contract itself. Per the constitution's Development Workflow
this lands FIRST, ALONE, in its own commit, with its parity test, before
anything consumes it.

**CRITICAL**: No user story work begins until this phase is complete and
committed on its own.

- [ ] T002 Write the failing parity test in `engine/tests/document/parity.test.ts`: serialize the descriptor deterministically and compare against `parity.snapshot.json`. It must fail first because neither file exists yet.
- [ ] T003 Implement the ordered schema descriptor in `engine/src/document/descriptor.ts`, declared `as const`, covering `Document` and all six block kinds with the exact field names, types, optionality, and ORDER given in `data-model.md`.
- [ ] T004 Derive the `Document` and `Block` types from the descriptor in `engine/src/document/types.ts` using mapped and conditional types. Per review R-1 no type is hand written. `Block` is a discriminated union on `kind`.
- [ ] T005 Add compile-time assertions in `engine/tests/document/types.test.ts` proving the derived types match `data-model.md`: required fields required, optional fields optional, enums narrowed to their literals, and a deliberate wrong shape rejected via `@ts-expect-error`.
- [ ] T006 Generate and check in `engine/tests/document/parity.snapshot.json`, then confirm T002 passes.
- [ ] T007 Add a completeness test in `parity.test.ts` asserting the descriptor contains exactly the six kinds `heading`, `divider`, `prose`, `menu`, `gallery`, `profile`, so a kind cannot be added or dropped silently.
- [ ] T008 Verify the parity test actually fails on drift: temporarily rename a descriptor field, confirm the test fails and prints a readable diff, then revert. Evidence goes in the commit message.

**Checkpoint**: Commit this phase ALONE before proceeding. `npm run verify` green.

---

## Phase 3: User Story 1 - My page is still there when I come back (Priority: P1) MVP

**Goal**: A page saved and reopened is identical in every field and in block
order, with nothing dropped, defaulted, or reworded.

**Independent Test**: Save a fully populated page, read it back, compare field by
field. No editor and no compiler involved.

### Tests for User Story 1 (MANDATORY, write first, must fail)

- [ ] T009 [P] [US1] Failing tests in `engine/tests/document/validate.test.ts` for data-model rules 1 and 5 through 9: input is an object, required fields present and correctly typed, unknown fields refused, `null` refused everywhere, absent optional fields stay absent, `kind` is one of the six.
- [ ] T010 [P] [US1] Failing tests in `validate.test.ts` for rules 10 through 15: `id` non-empty and unique with both offenders named, `level` in 1 to 6, `layout` and `status` enums, `target` non-empty and NOT registry checked, empty `blocks` still valid.
- [ ] T011 [P] [US1] Failing tests in `validate.test.ts` for rule 18, review finding R-2: `NaN`, `Infinity`, `-Infinity`, and non-integer numbers are each refused with code `not_finite`.
- [ ] T012 [P] [US1] Failing tests in `validate.test.ts` for guarantees G1, G4, and G5: never throws on any input including `undefined` and cyclic objects, reports ALL problems not just the first, and does not mutate its input.
- [ ] T013 [P] [US1] Failing tests in `engine/tests/document/serialize.test.ts` for G3 and review R-3: identical bytes across repeated calls, keys in descriptor order, and identical output for two documents whose keys were assigned in different orders including integer-like keys.
- [ ] T014 [P] [US1] Failing test in `serialize.test.ts` for G7 and review R-2: `serializeDocument` refuses a document containing `NaN` rather than writing `null`.
- [ ] T015 [P] [US1] Failing tests in `engine/tests/document/roundtrip.test.ts` for G2 and FR-010: fully populated, minimal, and empty pages all round trip identically, and absent stays absent while empty string stays empty string.
- [ ] T016 [P] [US1] Failing test in `roundtrip.test.ts` for FR-011: emoji, accented characters, right to left text, Markdown control characters, and a lone surrogate all survive unchanged.

### Implementation for User Story 1

- [ ] T017 [US1] Add `Issue`, `IssueCode`, and `ValidationResult` to `engine/src/document/types.ts` exactly as declared in `contracts/document-api.md`, including `not_finite`.
- [ ] T018 [US1] Implement `validateDocument` in `engine/src/document/validate.ts`: walk the descriptor, collect every issue, never throw, attach `path` and enclosing `blockId` to each issue.
- [ ] T019 [US1] Implement the message text for every `IssueCode` in `validate.ts`, written for an artist rather than a developer, satisfying FR-003 and SC-006.
- [ ] T020 [US1] Implement `serializeDocument` in `engine/src/document/serialize.ts`: emit only descriptor-named keys in descriptor order, never enumerate the input value, and validate before writing.
- [ ] T021 [US1] Implement `emptyDocument` in `engine/src/document/empty.ts`, returning a valid zero-block page for a given target.
- [ ] T022 [P] [US1] Add fixtures in `engine/tests/document/fixtures/`: `full.json` with every block kind and every optional field populated, `minimal.json` with only required fields, `empty.json` with zero blocks, and `unicode.json`.

**Checkpoint**: User Story 1 is independently testable. A page survives a round
trip. Commit.

---

## Phase 4: User Story 2 - I can move my page somewhere else (Priority: P2)

**Goal**: A page exported and imported elsewhere arrives complete, and a file
that is not a valid page is refused without touching anything already stored.

**Independent Test**: Export a populated page, import into a fresh instance,
compare. Then import a corrupt file and confirm the refusal names the problem.

### Tests for User Story 2 (MANDATORY, write first, must fail)

- [ ] T023 [P] [US2] Failing tests in `engine/tests/document/parse.test.ts`: invalid JSON, valid JSON that is not an object, an array, a bare string, and truncated text are each refused with a named issue and never throw.
- [ ] T024 [P] [US2] Failing test in `parse.test.ts` for US2 acceptance scenario 2: exporting a page, importing it, and exporting again produces byte-identical output both times.
- [ ] T025 [P] [US2] Failing test in `parse.test.ts` for review R-3 and hostile input: a page containing a `__proto__` key is refused as an unknown field, and `Object.prototype` is left unpolluted afterwards.

### Implementation for User Story 2

- [ ] T026 [US2] Implement `parseDocument` in `validate.ts`: parse text, convert a parse failure into an `invalid_json` issue rather than an exception, then delegate to `validateDocument`.
- [ ] T027 [P] [US2] Add invalid fixtures in `fixtures/invalid/`: malformed JSON, wrong root type, missing required field, unknown field, duplicate ids, and a `__proto__` key.

**Checkpoint**: A page is portable and a bad file is refused safely. Commit.

---

## Phase 5: User Story 3 - An update does not eat my work (Priority: P3)

**Goal**: Older pages open. A page from a newer version is refused plainly and
left untouched.

**Independent Test**: Load a future-version fixture, confirm exactly one
`version_too_new` issue and no modification. Confirm the migration registry is
consulted and is empty at version 1.

### Tests for User Story 3 (MANDATORY, write first, must fail)

- [ ] T028 [P] [US3] Failing tests in `engine/tests/document/version.test.ts`: `schemaVersion` missing, non-numeric, non-integer, and negative are each refused with the correct code.
- [ ] T029 [P] [US3] Failing test in `version.test.ts` for FR-004 and G6: a version greater than `SCHEMA_VERSION` produces exactly ONE issue with code `version_too_new`, the contents are not inspected, and the input is unmodified.
- [ ] T030 [P] [US3] Failing test in `version.test.ts` for FR-005: the migration registry is consulted for older versions, is empty at version 1, and migrations would apply in ascending order.

### Implementation for User Story 3

- [ ] T031 [US3] Implement the version gate in `validate.ts`: check `schemaVersion` first and short-circuit on `version_too_new` before any other validation runs.
- [ ] T032 [US3] Implement the forward migration registry in `engine/src/document/migrate.ts`, ordered and empty at version 1, with the shape a version step will take documented in place.
- [ ] T033 [P] [US3] Add fixtures `fixtures/version-too-new.json` and `fixtures/version-malformed.json`.

**Checkpoint**: Version safety proved. Commit.

---

## Phase 6: Polish and Cross-Cutting Concerns

- [ ] T034 [P] Add the SC-005 performance guard in `engine/tests/document/performance.test.ts`: a 50-block page must validate and serialize in under 25 milliseconds on the development machine. The user-facing budget is 100 milliseconds on a mid-range phone, so the guard is set at a quarter of it to leave room for slower hardware and to fail on a regression long before a user would notice one.
- [ ] T035 Implement the public surface in `engine/src/document/index.ts` and re-export it from `engine/src/index.ts`, exporting exactly what `contracts/document-api.md` lists and nothing more.
- [ ] T036 [P] Confirm every guarantee G1 through G8 in `contracts/document-api.md` has at least one test asserting it, and add any that is missing.
- [ ] T037 Run `npm run verify` from PowerShell and quote the full output. Per the constitution, done means verified with evidence.
- [ ] T038 Update the bootstrap status in `CLAUDE.md` and mark roadmap item 1.1 complete in `docs/ROADMAP.md`.
- [ ] T039 Holistic review over the whole feature diff. Required because this feature exceeds three chunks. Look specifically for cross-cutting failures that a per-phase review could not see, since each phase reviewer saw only one internally correct side of a seam.

---

## Dependencies and Execution Order

### Phase dependencies

- **Setup (T001)**: no dependencies.
- **Foundational (T002 to T008)**: depends on Setup. BLOCKS everything else. Commits alone.
- **US1 (T009 to T022)**: depends on Foundational. This is the MVP.
- **US2 (T023 to T027)**: depends on Foundational and on `validateDocument` from T018.
- **US3 (T028 to T033)**: depends on Foundational and on the validator entry point from T018.
- **Polish (T034 to T039)**: depends on all stories.

### Story independence

US2 and US3 both need `validateDocument` to exist, so they are not independent
of US1 in the way the template assumes. That is inherent: this feature is one
contract rather than three features, and splitting the validator three ways would
produce three partial validators. US2 and US3 ARE independent of each other and
can proceed in parallel once US1 lands.

### Parallel opportunities

- T009 through T016 are all [P]: eight test files or independent test blocks, written before any implementation exists.
- T023 through T025 [P] with each other, and T028 through T030 [P] with each other.
- After US1 lands, all of US2 and all of US3 can run concurrently.
- Fixture tasks T022, T027, T033 are [P] with the implementation tasks in their phase.

## Implementation chunking

Per `CLAUDE.md`, group into chunks rather than one dispatch per task:

| Chunk | Tasks | Commit boundary |
|---|---|---|
| 1 | T001 to T008 | The contract, alone, as the constitution requires |
| 2 | T009 to T022 | US1, the MVP |
| 3 | T023 to T033 | US2 and US3 |
| 4 | T034 to T039 | Polish, verify, holistic review |

Four chunks, so T039's holistic review is required, not optional.

## MVP scope

Chunks 1 and 2. At that point a page can be created, validated, written, and
read back losslessly, which is the guarantee everything else in the product
stands on.

**Total tasks**: 39. US1: 14. US2: 5. US3: 6. Foundational: 7. Setup: 1. Polish: 6.
