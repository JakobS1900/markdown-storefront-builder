# Feature Specification: Ship

**Feature Branch**: `007-ship`
**Shipped**: 2026-08-18, merged as `b5a9d33`
**Status**: Shipped. Specified retrospectively on 2026-08-31, see `specs/README.md`.
**Input**: Roadmap items 4.1 to 4.4. Continuous integration, the manual host verification pass, deployment, and the case study.

## What this feature is

Making the thing real: a gate that runs on every push, a deploy that follows it,
and the first time the compiled output was pasted into the host it was compiled
for.

## User Scenarios & Testing

### User Story 1 - The gate runs whether or not anyone remembers to run it (Priority: P1)

Every push runs typecheck, lint, tests, the secret scan, the dash scan, and the
accessibility gate. A red gate blocks the deploy.

### User Story 2 - There is a URL (Priority: P1)

The app is published to GitHub Pages after the gate passes, so the thing under
discussion is a thing anyone can open.

### User Story 3 - Someone reading the code can tell what it does (Priority: P2)

The case study explains the reasoning, including the parts that were wrong.

### Edge Cases

- A deploy that succeeds while serving a stale bundle. Checked by fetching the
  deployed JavaScript and comparing it byte for byte against the local build
  rather than trusting the workflow's green tick.

## Requirements

### Functional Requirements

- **FR-007-1**: The verification gate MUST run on every push and MUST gate the
  deploy.
- **FR-007-2**: The deploy MUST publish only after the gate passes.
- **FR-007-3**: Compiled output MUST be pasted into each live host and compared
  against the preview at least once. Not automatable, and not skippable.

## The manual pass, and what it found

Every capability value cited the host's documentation, which is evidence and is
not the same as having tried it. Pasting the compiled output into rentry's own
editor found that the hard line break, written as a trailing backslash because
that is what CommonMark says, produced no break at all: rentry runs
Python-Markdown, which does not implement it. Worse, the backslash was swallowed,
so two sentences rendered as "each.Refunds".

No test caught it, because every test asserted the backslash was emitted. The
tests encoded the same assumption as the code, and only the renderer disagreed.
Fixed in `71862cc`, which is also the first genuine divergence between the two
shipped hosts: until then they produced identical output, which was written down
rather than papered over.

## Success Criteria

- **SC-007-1**: A push with a failing test does not deploy.
- **SC-007-2**: The live bundle matches the local build byte for byte. Checked
  on every deploy since.

## Dependencies

Features 001 to 006.
