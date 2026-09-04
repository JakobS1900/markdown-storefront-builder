# Specification Quality Checklist: Bringing in a Price List

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-04
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

All three [NEEDS CLARIFICATION] markers were resolved on 2026-09-04 and are
recorded, with their reasoning and the option each beat, under "Decisions taken
on 2026-09-04" in the spec. They were: where the tick lives, whether conversion
creates a new price list or fills an existing one, and how hard the sniffer
tries to split a line.

The first is worth reading even if the others are not. The cheaper option,
landing the paste as draft rows and reusing feature 022's row selection
unchanged, was rejected because a draft row is not a draft: it is a real product
that saves, compiles and publishes, so unticked lines would have reached a
seller's live page. That is the inversion of the rule the feature exists to
uphold, and FR-058 now states the prohibition directly rather than leaving it
implied.

On "no implementation details": this spec cites `file:line` throughout and names
existing modules. That is deliberate and matches the house style set by 021 and
022. Every citation is a statement about a constraint that already exists in the
codebase, not a direction about how to build this feature. The distinction the
checklist item is protecting is preserved: nothing here says what the new code
should look like.

Two claims in the originating request were checked against the code and found
wrong, and the spec corrects them in its own second section rather than
inheriting them: there is no undo stack (`State.undo` is a single slot at
`app/src/store.ts:69`, cleared by `update()` at `app/src/store.ts:498`), and the
word "import" already means opening a backup (`app/src/import.ts`).
