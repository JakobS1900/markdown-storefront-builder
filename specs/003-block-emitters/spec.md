# Feature Specification: The Remaining Block Emitters

**Feature Branch**: `003-block-emitters`
**Created**: 2026-08-15
**Status**: Draft
**Input**: Roadmap items 1.3 to 1.6, taken together. Emitters for `prose`, `menu`, `gallery`, and `profile`, completing the compiler for every block kind the contract declares.

## Why these four land together

They are four instances of one shape. Each reads a block, consults capabilities,
emits Markdown, and warns about what it could not do. The pipeline they plug
into was proved in feature 002 on two trivial kinds, so the structural risk is
already retired.

Landing them as four chunks on one branch keeps each independently reviewable
while making the holistic review across all four possible, which is the review
that matters here: these emitters share an escaper, a heading convention, and a
diagnostic vocabulary, and that shared surface is where a defect would hide.

## Two things this feature deliberately does not do

**Inline rich text in prose is out of scope.** The design called for bold,
italic, lists, and links inside prose. The contract stores `prose.text` as a
plain string, and the compiler escapes every Markdown character in artist text,
so a subset grammar would need either a parser with a whitelist or a change to
the contract's shape. Both are real decisions that deserve their own cycle
rather than being smuggled into an emitter. Prose therefore emits paragraphs of
plain text, which is what a terms and conditions section actually needs.

**The preview sanitizer is out of scope.** It belongs with the preview, in
roadmap 2.3. Building it now would create a capability with no consumer, which
this project's own rules call a guess written down. The emitted-text escaper
that protects the artist's page on the host already exists and is extended here.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - My whole page comes out, not just parts of it (Priority: P1)

An artist has built a page with a profile, a commission menu, a gallery, and
their terms. They press copy and get all of it.

**Why this priority**: Feature 002 shipped a compiler that silently omitted four
of the six section types. Until this lands, the product does not do the thing it
exists to do.

**Independent Test**: Compile a page containing every block kind and confirm
every section appears in the output, with no `block_not_supported` warnings.

**Acceptance Scenarios**:

1. **Given** a page using all six section types, **When** it is compiled, **Then**
   every section appears and no section is reported as unsupported.
2. **Given** the same page, **When** it is compiled for either host, **Then** the
   result is valid Markdown that renders as the page they built.

---

### User Story 2 - My prices are readable, however the host renders them (Priority: P2)

An artist's commission menu shows tier names, prices, and what is included, laid
out so a client can read it, whether or not the host supports tables.

**Why this priority**: The pricing menu is usually the reason the page exists.
It is also the first section whose good layout depends on a capability a host
might lack, so it is where the degradation machinery finally does real work.

**Independent Test**: Compile a menu for a host with tables and a host without,
and confirm both render readably and the second warns.

**Acceptance Scenarios**:

1. **Given** a host that supports tables, **When** a menu is compiled, **Then**
   the tiers appear as a table.
2. **Given** a host that does not, **When** the same menu is compiled, **Then**
   the tiers appear as a readable list, and a warning names the section.
3. **Given** a price containing a pipe character, **When** it is compiled into a
   table, **Then** the table is not broken by it.

---

### User Story 3 - A bad link cannot hurt anyone (Priority: P3)

An artist pastes a link. Whatever it is, the page they publish cannot carry a
link that runs code when a client clicks it.

**Why this priority**: Links are the first place artist input becomes something
a third party interacts with rather than merely reads. It ranks third only
because links are a smaller part of the page than the menu, not because it
matters less.

**Independent Test**: Compile a page whose links use `javascript:`, `data:`, and
other schemes, and confirm none survives as a link.

**Acceptance Scenarios**:

1. **Given** a link with an http or https address, **When** it is compiled,
   **Then** it appears as a working link.
2. **Given** a link with any other scheme, **When** it is compiled, **Then** it
   appears as plain text, and a warning names the section.
3. **Given** an address containing characters that would end the link early,
   **When** it is compiled, **Then** the link is not broken and no text escapes
   from it.

---

### Edge Cases

- A menu with no tiers, or a tier with no description and no inclusions.
- A gallery with no items.
- A profile with only a display name.
- A price, caption, or label containing a pipe, which would otherwise split a
  table cell.
- Text containing a newline inside a table cell, which would end the table.
- A very long inclusion list in a single table cell.
- An image address that is not an address.
- A profile status that is present versus absent.
- Every block kind appearing twice in one page.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST emit every block kind the contract declares. No
  section may be silently omitted.
- **FR-002**: Tier information MUST be laid out as a table where the host
  supports tables, and as a readable list where it does not, with a warning.
- **FR-003**: Text placed in a table cell MUST NOT be able to break the table,
  whatever it contains.
- **FR-004**: A link MUST be emitted as a link only when its address uses http
  or https. Any other address MUST appear as plain text with a warning.
- **FR-005**: An address MUST NOT be able to end its link early or introduce
  content outside it.
- **FR-006**: Every section that carries an optional heading MUST emit it
  consistently, so a page reads as one document rather than six.
- **FR-007**: An empty collection MUST produce no output for that part and MUST
  NOT produce an empty table, an empty list, or a stray heading.
- **FR-008**: Every emitter MUST escape artist text with the same escaper, so no
  section is safer or less safe than another.
- **FR-009**: Each new capability MUST cite its source and MUST have a declared
  fallback and a test proving it.
- **FR-010**: Compiling a page with every block kind MUST stay within the
  performance budget already established.

### Key Entities

No new entities. This feature adds emitters and capabilities to the structures
defined in features 001 and 002.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100 percent of block kinds emit. Zero `block_not_supported`
  warnings for any valid page.
- **SC-002**: Zero artist text can break a table, escape a link, or alter the
  structure of the page, verified against a corpus written to try.
- **SC-003**: 100 percent of non-http links are rendered inert, with a warning
  naming the section.
- **SC-004**: 100 percent of capability compromises produce a warning naming the
  section. Zero silent degradations.
- **SC-005**: 100 percent of golden fixtures match byte for byte for every host.
- **SC-006**: A page containing every block kind compiles in under 25
  milliseconds on the development machine.

## Assumptions

- Prose is plain text with blank lines separating paragraphs. Inline formatting
  is a separate cycle, for the reasons stated above.
- A section heading emits at level 3, on the reasoning that artists use levels 1
  and 2 for the page's own structure. This is a convention, applied identically
  by every emitter so the page reads consistently.
- Both shipped hosts support tables, so the no-tables path is exercised through
  a synthetic test host, exactly as the size limit path is.
- Image dimensions are not part of the contract, so rentry's image sizing
  extension has nothing to consume it and is not represented. It arrives if and
  when the contract carries dimensions.

## Dependencies

- Features 001 and 002. Both merged.
