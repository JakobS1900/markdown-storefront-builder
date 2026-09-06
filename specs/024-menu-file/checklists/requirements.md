# Specification Quality Checklist: The menu file

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-06
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

Validation ran once and passed. Three things are worth recording about why,
because a checklist of ticks is not evidence on its own.

**Why there are no clarification markers.** Not because nothing was uncertain.
Four decisions genuinely could have gone either way and all four were put to the
owner on 2026-09-06 before this spec was written: what the saved file should be,
whether to build all three parts or sequence them, what to do about the buried
control, and whether this goes ahead of the interview wizard. The answers are in
`docs/HANDOFF.md` under "Blocked on Jakob", recorded in the session that heard
them, which is the rule that file sets after a quote once had to be withdrawn as
unsourceable.

**One deliberate near miss on "no implementation details".** The spec names two
numbers: a host's stated page limit of 200000 bytes, and 390 CSS pixels in
SC-007. Both are kept. The first is the evidence for the feature's central
constraint and the requirement is not defensible without it. The second is the
width this project already measures every layout against, so a criterion that
said "a narrow screen" would be less verifiable rather than more
technology-agnostic. Both describe the world the feature lives in, not how it is
built.

**FR-092 exists to constrain FR-091.** A requirement whose only job is to stop
another requirement being satisfied the wrong way looks redundant. It is there
because the cheapest way to make the quantity control findable is to lift it out
of its fold, and that would reverse a shipped decision (`45edecb`) that cut a
blank price row from five fields to two. Without FR-092 the spec permits the
regression it is trying to avoid.

**Not checked here, and deliberately.** Whether the design satisfies these
requirements is a plan concern, and the plan's Constitution Check is where
Principle I purity, Principle II hosts-as-data and Principle V "the user's work
is sacred" get argued rather than asserted. This checklist covers the spec only.
