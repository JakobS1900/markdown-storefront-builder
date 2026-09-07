# Specification Quality Checklist: The pages sidebar

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-07
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

Passed on the first pass. Three things about it are worth recording, because a
column of ticks is not evidence.

**One premise in the request was already true, and the spec says so rather than
accepting it.** Jakob asked for pages to be saved. They are, and have been since
the app shell. Taking that as a requirement would have produced work that
changed nothing and a claim that something was fixed. What was actually wrong is
that reaching another page means scrolling to the top of your own work and
unfolding a group, and that is what the requirements describe.

**FR-106 and FR-103 exist to forbid the two easy wrong answers.** The cheap way
to build this is to leave the existing list in the Build surface and add a
sidebar as well, which gives two places to remove a page from and two behaviours
to keep in step. And the cheap way to handle the open page in a list of pages is
to let it be deleted like any other, which removes the document under the editor.

**No clarification markers, because the shape was settled before this was
written.** Four decisions were put to Jakob on 2026-09-07: drawer versus pinned,
how the wizard relates to templates, how ambitious the import should be, and
whether selling modes belong in the schema. Only the first is this feature's,
and it was answered: drawer on a phone, pinned above 900 pixels, matching where
the preview pane already appears.

**Deliberately not asserted here**: how the drawer is drawn. A slide is the
obvious implementation and this project has already shipped a bug where a
transform on the app root silently re-parented every fixed element inside it,
pinning the tab bar to the wrong thing. That belongs in the plan, with the
constraint stated, rather than in a requirement that pretends to be about
behaviour.
