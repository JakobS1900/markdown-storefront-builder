# Feature Specification: The Document Contract

**Feature Branch**: `001-document-contract`
**Created**: 2026-08-15
**Status**: Draft
**Input**: User description: "Feature 1.1, The Document contract. The versioned Document JSON schema for the Markdown storefront builder, its validator, its name/type/order parity test, and its lossless JSON round-trip test. This is the cross-boundary contract: it crosses the engine, the app, IndexedDB, the URL fragment, and the export file. Per the constitution it lands FIRST and ALONE, before any emitter or app code consumes it."

## Why This Lands First and Alone

Everything else in the product reads or writes this one shape. The compiler
consumes it, the editor mutates it, storage persists it, and export writes it to
a file. A silent change to it corrupts an artist's
saved page in a way no error message will catch, because every consumer will
happily read the wrong thing.

The rule this feature exists to satisfy: the contract lands in its own commit,
guarded by a test that fails if its field names, types, or order change without
someone deciding to change them.

## Clarifications

### Session 2026-08-15

**Q1: Is sharing a page by link in scope, and must the contract be designed for
it?**

Answer: out of scope for now. Export and import via file only.

Consequence: nothing in the contract is shaped by URL length. Field names are
chosen for readability, not brevity. The URL fragment has been removed from the
list of boundaries this contract crosses, in the design, in `CLAUDE.md`, and in
the constitution, so it stops being an implied requirement nobody committed to.
If link sharing arrives later it is a separate encoding layer above the
contract, never a compaction of the contract itself. Recorded as a constraint in
constitution 1.0.1.

**Q2: When a page contains fields this version does not recognize, what
happens?**

Answer: reject the page.

Consequence: validation is strict. An unrecognized field means the page came
from somewhere this version does not understand, so it is refused rather than
guessed at. This catches corruption, truncation, and hand-editing mistakes
immediately instead of letting them propagate into a page that looks fine and is
not.

The accepted cost, recorded honestly: a page touched by a future version becomes
unopenable in an older one even when the unknown field was harmless. This is the
same trade the version stamp already makes in FR-004, so the behaviour is at
least consistent, and refusing to open is a recoverable state while silently
dropping a section is not.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - My page is still there when I come back (Priority: P1)

An artist builds a commission page, closes the browser, and opens the tool again
days later. Every tier, price, image, link, and paragraph is exactly as they left
it, in the same order, with nothing dropped and nothing reworded.

**Why this priority**: This is the floor. A tool that loses work is worse than no
tool, because the artist has already spent the effort. Nothing else in the
product matters if this fails, and every other feature is built on top of it.

**Independent Test**: Save a fully populated page, reload from storage, and
compare against the original field by field. Delivers the guarantee that the
artist's work persists, on its own, with no editor or compiler involved.

**Acceptance Scenarios**:

1. **Given** a page containing every block type with all optional fields
   populated, **When** it is saved and read back, **Then** the result is
   identical to the original in every field and in block order.
2. **Given** a page containing only the minimum required fields, **When** it is
   saved and read back, **Then** the result is identical and no absent optional
   field has been invented or defaulted into existence.
3. **Given** a page containing emoji, accented characters, right-to-left text,
   and Markdown control characters in user text, **When** it is saved and read
   back, **Then** every character survives unchanged.

---

### User Story 2 - I can move my page somewhere else (Priority: P2)

An artist exports their page to a file, or hands it to a friend, and opens it on
a different device. It arrives complete.

**Why this priority**: This is what makes the artist's work theirs rather than
ours. It is also the honest answer to "what if this site disappears". It ranks
below persistence because an artist who cannot export is inconvenienced, while
an artist who loses their page is harmed.

**Independent Test**: Export a populated page, import it into a fresh instance
with no stored data, and compare. Delivers portability with no network, no
account, and no other feature present.

**Acceptance Scenarios**:

1. **Given** an exported page, **When** it is imported into a fresh instance,
   **Then** it is identical to the page that was exported.
2. **Given** an exported page, **When** it is exported again after import,
   **Then** the two exported files are byte-identical.
3. **Given** a file that is not a valid page, **When** it is imported, **Then**
   the import is refused with a message naming what is wrong, and any pages
   already stored are untouched.

---

### User Story 3 - An update does not eat my work (Priority: P3)

An artist returns after the tool has been updated. Their older page opens
normally. Separately, an artist who opens a page created by a newer version than
the one they are running is told plainly, rather than shown a page with pieces
missing.

**Why this priority**: This failure is rare but unrecoverable, and it is
overwhelmingly caused by our own code rather than by anything the artist did.
It ranks third because it only bites after a version boundary exists, but the
guarantee has to be designed in from the first version or it cannot be added
later.

**Independent Test**: Load a fixture page from each known past version and
confirm it opens correctly. Load a fixture stamped with a future version and
confirm it is refused without modification.

**Acceptance Scenarios**:

1. **Given** a page saved by an older version, **When** it is opened, **Then**
   it loads correctly with its content preserved.
2. **Given** a page stamped with a version newer than the running one, **When**
   it is opened, **Then** it is refused with a clear message, and the stored
   page is not modified, downgraded, or partially loaded.
3. **Given** any refusal or failure while reading a page, **When** the failure
   occurs, **Then** no stored page is deleted or overwritten.

---

### Edge Cases

- A page with no blocks at all. Valid, and must round-trip as an empty page
  rather than being treated as corrupt.
- A page whose JSON has its keys in a different order from ours. Must load
  correctly, since key order is not meaningful in JSON.
- A page containing a block type this version does not recognize.
- A page containing two blocks with the same identifier.
- A page missing a required field, or carrying a field of the wrong type.
- A page carrying fields we do not recognize at the current version. Per Q2,
  rejected.
- A page large enough to exhaust available storage.
- Text fields containing the longest realistic content an artist would write,
  and text fields that are empty strings rather than absent.
- A page whose version stamp is missing, malformed, or not a number.
- Input that is not JSON at all, or is JSON but not an object.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The page MUST carry a version stamp identifying the contract
  version it was written against.
- **FR-002**: The system MUST validate any page before accepting it, and MUST
  report every problem found rather than stopping at the first.
- **FR-003**: Validation failures MUST identify what is wrong and where, in
  terms an ordinary person can act on, not in terms of internal structure.
- **FR-004**: The system MUST refuse a page stamped with a version newer than it
  understands, and MUST NOT modify, downgrade, or partially load it.
- **FR-005**: The system MUST load pages written by every past version it has
  released, converting them forward without loss.
- **FR-006**: Reading a page and writing it back MUST produce content identical
  to the original, with no field added, dropped, reordered, or altered.
- **FR-007**: Writing the same page twice MUST produce identical output both
  times.
- **FR-008**: The system MUST preserve the order of blocks exactly as authored.
- **FR-009**: Every block MUST carry an identifier that is unique within its
  page, so that a problem can be reported against the specific block that caused
  it.
- **FR-010**: The system MUST distinguish an absent optional field from a field
  present but empty, and MUST preserve that distinction across a round trip.
- **FR-011**: The system MUST preserve all text exactly as the artist entered
  it, including emoji, accented and non-Latin characters, and characters that
  are meaningful in Markdown.
- **FR-012**: No failure while reading, validating, or writing a page MUST
  delete or overwrite any stored page.
- **FR-013**: The contract MUST be guarded by a test that fails if any field
  name, field type, or block order changes, so that such a change can only
  happen deliberately.
- **FR-014**: The contract MUST support exactly the block types in scope for
  version 1: menu and pricing, gallery, prose, profile, heading, and divider.
- **FR-015**: The contract MUST record which host a page is targeting, so that
  reopening a page restores the target the artist last chose.
- **FR-016**: A page MUST remain valid with zero blocks.
- **FR-017**: The system MUST reject a page containing any field it does not
  recognize, naming the offending field and the block it appears in, and MUST
  NOT modify the stored page when doing so.
- **FR-018**: A page that cannot be loaded, for any reason, MUST still be
  retrievable by the artist as its raw stored content, and the failure message
  MUST offer that action. Implemented at the storage layer in roadmap item 2.1,
  recorded here because the requirement arises from this feature's refusal
  behaviour and would otherwise be forgotten. Raised by architecture review
  finding R-4: refusing to open is only recoverable if the artist can still get
  their work out.
- **FR-019**: The system MUST reject any number that is not a finite integer,
  naming the value. Writing MUST NOT be possible for a page that would not
  validate. Raised by architecture review finding R-2.

### Key Entities

- **Page**: What an artist builds and keeps. Carries a version stamp, a chosen
  target host, page-level details, and an ordered list of blocks.
- **Block**: One section of the page. Every block has a kind, an identifier
  unique within the page, and the fields belonging to that kind. The kinds in
  scope are menu, gallery, prose, profile, heading, and divider.
- **Validation Result**: The verdict on a candidate page. Either the page is
  accepted, or a list of problems is returned, each naming the offending block
  and what is wrong with it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100 percent of pages that are saved and reopened are identical to
  the original, verified across a fixture set covering every block type, every
  optional field present and absent, and the full range of text an artist can
  enter.
- **SC-002**: 100 percent of pages that are exported and re-imported are
  identical to the original, and exporting the same page twice produces
  identical files every time.
- **SC-003**: 100 percent of pages stamped with a future version are refused
  without modification. Zero are partially loaded.
- **SC-004**: Zero stored pages are lost, deleted, or altered as a result of any
  invalid input, failed validation, or failed read, measured across a suite that
  includes malformed, truncated, and hostile input.
- **SC-005**: Opening a saved page feels immediate. A page of 50 blocks is
  validated and ready in under 100 milliseconds on a mid-range phone.
- **SC-006**: When a page is rejected, a person who did not write the tool can
  read the message and say which part of their page is at fault, for 100 percent
  of rejection cases in the fixture set.
- **SC-007**: Any change to a field name, field type, or block order fails the
  build. Zero such changes reach a commit unnoticed.

## Assumptions

- Block identifiers are generated by the editor when a block is created, not by
  the contract itself, and are treated as opaque by everything downstream.
- A page is small by data standards, in the order of kilobytes, because it holds
  text and image references rather than image data.
- Images are always referenced by address. Image data is never stored inside a
  page. This follows from the hosts themselves not storing images.
- Version 1 of the contract is the first release, so the forward-migration path
  from older versions has no entries yet. The mechanism is built now because it
  cannot be retrofitted onto pages already saved in the wild.
- Validation reports every problem it finds rather than the first, because an
  artist fixing a page one error per attempt is a worse experience than one list.
- Unrecognized block kinds are treated as invalid rather than ignored, so that a
  page from an unsupported source cannot silently lose sections.
- "Mid-range phone" in SC-005 means hardware typical of the audience, who are
  overwhelmingly on phones rather than desktops.

## Dependencies

- None. This feature deliberately depends on nothing and is depended upon by
  everything. It is the first code in the product after the toolchain skeleton.
