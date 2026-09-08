# Specification Quality Checklist: Selling modes

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-08
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

Passed on the first pass. Three things are worth recording.

**The one decision here that is expensive to revisit is the set of modes**, and
it is called out in Assumptions rather than left implicit. Adding a value later
is not free: the validator refuses a page carrying an enum value it does not
know, so a seller who used a new mode on a new build and then opened the page on
an older one would be refused. That is recoverable, FR-018 hands back the exact
bytes, but it is a bad afternoon. Three values were chosen to match exactly what
was described, and "sold out" was left out with a reason rather than forgotten.

**FR-110 is the requirement that makes this safe to build.** Every page in
existence has neither field, so the whole feature has to be invisible to all of
them, byte for byte, on every host. SC-001 proves that by compiling rather than
by arguing it. Feature 024 learned this the same way: its migration test
compares compiled output before and after rather than trusting that adding an
optional field changes nothing.

**Deliberately not specified here: how it is laid out.** Whether the mode
becomes a column, a line under the item, or part of the price is a plan
decision, and writing it into a requirement would be describing an
implementation while pretending to describe a behaviour. What the requirements
fix is that a buyer can tell items apart at a glance, FR-111 and SC-002, which
is the thing that actually matters and which several layouts could satisfy.
