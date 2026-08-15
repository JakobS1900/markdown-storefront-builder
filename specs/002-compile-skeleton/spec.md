# Feature Specification: The Compile Skeleton and Golden Harness

**Feature Branch**: `002-compile-skeleton`
**Created**: 2026-08-15
**Status**: Draft
**Input**: Roadmap item 1.2. `compile(doc, targetId)` returning Markdown plus diagnostics, the target record type, both target records (`rentry` and `portable`), the byte-comparing golden fixture harness, the determinism property test, and emitters for the two trivial block kinds only, `heading` and `divider`, so the whole pipeline is proved end to end on the smallest possible surface.

## Why only two block kinds

This feature deliberately compiles almost nothing. Two block kinds, both
trivial, is enough to prove every structural claim the compiler makes: that a
page becomes Markdown, that two hosts produce different output from the same
page, that a capability a host lacks produces a named warning rather than broken
text, and that the same input always produces the same bytes.

Adding the interesting emitters at the same time would mean discovering a
structural mistake while also debugging table layout. The remaining four kinds
each land afterwards against a pipeline already known to work.

## Clarifications

### Session 2026-08-15

**Q: What happens when a page names a target this build does not know?**

Answer, decided in architecture review R-4 of feature 001 and carried here: the
compiler falls back to `portable` and raises a diagnostic naming the unknown
target. It does not refuse.

Consequence: an artist who created a page after a host was added can still open
and use it in an older build. They see a warning and a page that renders
correctly somewhere, rather than an error and nothing. `portable` is the right
fallback because it is the baseline every host approximates.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - I get Markdown I can paste (Priority: P1)

An artist finishes a page and gets back Markdown. They paste it into their host
and it renders as the page they built.

**Why this priority**: This is the product. Everything before it was
preparation, and everything after it is more block kinds. Until a page becomes
text an artist can paste, there is nothing to sell.

**Independent Test**: Compile a page containing headings and dividers for each
target and compare the output against a checked-in expected file, byte for byte.

**Acceptance Scenarios**:

1. **Given** a page with headings and dividers, **When** it is compiled for a
   target, **Then** the result is valid Markdown that renders as those headings
   and that separator on that host.
2. **Given** the same page compiled twice, **When** the outputs are compared,
   **Then** they are identical byte for byte.
3. **Given** a page with no blocks, **When** it is compiled, **Then** the result
   is empty or near empty rather than an error.

---

### User Story 2 - I am told what will not survive my host (Priority: P2)

An artist picks a host that cannot do something their page uses. Before they
publish, they are told which section is affected, what the host cannot do, and
what will be produced instead.

**Why this priority**: This is the thing an artist would otherwise pay a person
to know. It is second only because it needs something to warn about, and with
two trivial block kinds there is little. The mechanism must exist now so that
every emitter added later plugs into it rather than inventing its own.

**Independent Test**: Compile a page that exceeds a declared capability for a
target and confirm a diagnostic naming the block, the capability, and the
fallback, with output that still renders.

**Acceptance Scenarios**:

1. **Given** a page using a capability the chosen target lacks, **When** it is
   compiled, **Then** a warning names the offending section and states what will
   be produced instead.
2. **Given** that same page, **When** it is compiled, **Then** the output is
   still valid Markdown, degraded rather than broken.
3. **Given** a page that uses nothing the target lacks, **When** it is compiled,
   **Then** no warnings are produced.

---

### User Story 3 - Switching host shows me the difference (Priority: P3)

An artist switches their page from one host to another and sees the output and
the warnings change.

**Why this priority**: This is the demonstration that the compiler exists for a
reason, and it is what makes the product legible in one screenshot. It ranks
third because it is an emergent consequence of the first two rather than
separate work.

**Independent Test**: Compile one page for both targets and confirm the outputs
differ where the targets' capabilities differ, and are identical where they do
not.

**Acceptance Scenarios**:

1. **Given** one page, **When** it is compiled for two different targets,
   **Then** the outputs differ wherever the targets' declared capabilities
   differ.
2. **Given** a page that names a target this build does not know, **When** it is
   compiled, **Then** it falls back to the portable baseline and warns, naming
   the unknown target.

---

### Edge Cases

- A page with no blocks at all.
- A page whose only block is a divider, so the output is a separator and nothing
  else.
- Heading text that is empty, or that begins with characters meaningful in
  Markdown such as `#`, `-`, or a digit followed by a full stop.
- Heading text containing a newline, which would otherwise break the heading
  across lines and stop it being a heading.
- A heading at a level the target does not support.
- Consecutive dividers, and a divider as the first or last block.
- A page large enough that the output exceeds a target's size limit.
- Text that is already valid Markdown, which must appear literally rather than
  being interpreted.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST turn a valid page and a chosen target into
  Markdown text.
- **FR-002**: Compilation MUST NOT throw for any valid page and any target
  identifier, including one it does not recognise.
- **FR-003**: Compiling the same page for the same target MUST produce identical
  text every time.
- **FR-004**: The system MUST return, alongside the text, a list of every
  compromise it made, each naming the section affected, what the host cannot do,
  and what was produced instead.
- **FR-005**: The system MUST describe each supported host as a record of
  declared capabilities, and MUST NOT require code changes to add a host.
- **FR-006**: Every declared capability MUST have a defined fallback. The system
  MUST NOT produce broken output for a capability a host lacks.
- **FR-007**: The system MUST support exactly two hosts in this release: `rentry`
  and a portable baseline that works anywhere.
- **FR-008**: When a page names an unknown host, the system MUST compile it
  against the portable baseline and MUST warn, naming the unknown host.
- **FR-009**: Artist text MUST appear in the output as written. Characters that
  would otherwise be interpreted as formatting MUST be escaped so they display
  literally.
- **FR-010**: Artist text MUST NOT be able to change the structure of the
  surrounding page, whatever it contains.
- **FR-011**: The system MUST support headings and section separators in this
  release. The remaining section types follow.
- **FR-012**: A heading at a level the chosen host does not support MUST still
  render as a heading, at the nearest supported level, with a warning.
- **FR-013**: Output MUST be compared against checked-in expected files, byte
  for byte, for every supported host.
- **FR-014**: A capability value MUST NOT be written from assumption. Each MUST
  cite the host documentation or observed behaviour it came from.
- **FR-015**: When compiled output would exceed a host's stated size limit, the
  system MUST warn, and MUST still return the output rather than truncating it.

### Key Entities

- **Target**: A supported host, described entirely as declared capabilities and
  their fallbacks. Adding one is a new record, never a code change.
- **Compilation Result**: The Markdown text produced, plus every compromise made
  in producing it.
- **Diagnostic**: One compromise. Names the section it affects, the capability
  responsible, what was produced instead, and how serious it is.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100 percent of compiled fixtures match their checked-in expected
  output byte for byte, for every supported host.
- **SC-002**: Compiling the same page twice produces identical text 100 percent
  of the time, across processes and machines.
- **SC-003**: Zero pages produce output that fails to render on their target
  host, verified by the manual host checklist.
- **SC-004**: 100 percent of capability compromises produce a warning that names
  the affected section. Zero silent degradations.
- **SC-005**: A person who did not write the tool can read any warning and say
  which part of their page it concerns, for 100 percent of warnings produced.
- **SC-006**: Zero artist text can alter the structure of the surrounding page,
  verified against a corpus of text designed to try.
- **SC-007**: Adding a host requires changing zero lines of compiler logic,
  verified by adding a throwaway host in a test and compiling with it.
- **SC-008**: Compiling a 50 block page completes in under 25 milliseconds on
  the development machine, against a 100 millisecond user-facing budget.

## Assumptions

- Capability values for `rentry` come from its published documentation, already
  recorded in `docs/research/2026-08-15-host-verification.md`. Anything not
  documented there is treated as unsupported until observed otherwise, because
  assuming support produces broken pages while assuming absence produces safe
  ones.
- The portable baseline is strict CommonMark plus GFM tables. It is defined by
  specification rather than by a deployment, so it cannot go offline or change
  under us.
- The compiler receives an already-validated page and does not re-validate.
  Validation is feature 001's job and doing it twice would be two places to
  disagree.
- Output is text, and what an artist does with it is their business. This
  feature does not publish, upload, or contact any host.
- Diagnostics are warnings, not errors. There is no page this compiler refuses
  to compile: a page that degrades badly still produces the best available
  output, plus the warnings explaining what happened.

## Dependencies

- Feature 001, the `Document` contract. Merged.
