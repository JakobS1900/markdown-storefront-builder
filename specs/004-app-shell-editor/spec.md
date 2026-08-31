# Feature Specification: The App, Its Surfaces, and Local Storage

**Feature Branch**: `004-app-shell-editor`
**Shipped**: 2026-08-15, merged as `945239f`
**Status**: Shipped. Specified retrospectively on 2026-08-31, see `specs/README.md`.
**Input**: Roadmap items 2.1 to 2.4. The three surfaces, IndexedDB persistence, the block editor, the preview, and export.

## What this feature is

Everything between the artist and the compiler. Feature 003 finished a compiler
that turns a document into Markdown; this is the part a person touches. It
covers the shell and its three surfaces, saving and reopening a page, the editor
for every block kind, rendering the compiled output for preview, and getting the
text out.

It landed as one branch across five commits because the surfaces are not
separable in practice: an editor with nothing to save into is untestable, and a
preview with no editor has nothing to preview.

## User Scenarios & Testing

### User Story 1 - I build a page and it is still there tomorrow (Priority: P1)

An artist adds an About you section, types their name, closes the tab, and opens
it again the next day. Their page is as they left it.

**Why this is P1**: the product is worthless if it forgets. This is also the
promise the constitution guards most closely.

### User Story 2 - I can see what I will get before I paste it (Priority: P1)

They switch to Preview and see their page rendered roughly as the host will show
it, with a plain statement that it is an approximation rather than the host's own
renderer.

### User Story 3 - I can get the text out (Priority: P1)

They switch to Copy, press one button, and the Markdown is on their clipboard,
with steps for the host they chose. The text is also selectable by hand, because
clipboard permission is refused often enough on mobile that a button alone would
strand people.

### User Story 4 - A page I cannot open is not a page I have lost (Priority: P1)

A record the current version refuses to parse produces an error that offers the
exact stored bytes back. FR-018 from feature 001, raised by review R-4.

### Edge Cases

- Storage refused entirely, as in private browsing. The app says so plainly
  rather than appearing to save.
- A page written by a future schema version. Refused rather than guessed at, and
  still retrievable as text.
- An empty document. Produces an empty string, not a stray newline, and the
  surfaces say there is nothing yet rather than rendering blank panels.

## Requirements

### Functional Requirements

- **FR-004-1**: The app MUST present exactly three surfaces: Build, Preview, and
  Copy, reachable from a control within thumb reach on a phone.
- **FR-004-2**: Every edit MUST be persisted without an explicit save action.
- **FR-004-3**: Reopening the app MUST restore the most recently edited page.
- **FR-004-4**: Records MUST be stored as the canonical serialized text, never
  as structured objects, so that an unparseable record is still returnable.
- **FR-004-5**: A load failure MUST offer the raw stored content for download.
- **FR-004-6**: The preview MUST render the compiled output, never an internal
  render of the block model.
- **FR-004-7**: The preview MUST state that it is an approximation of the host.
- **FR-004-8**: Diagnostics MUST name the section they concern and offer to
  navigate to it.
- **FR-004-9**: The editor MUST support adding, editing, reordering, and
  removing sections of every kind the contract declares.
- **FR-004-10**: No path in the storage layer may delete or overwrite a saved
  page in order to recover from an error.

### Key Entities

- **StoredPage**: `id`, `json` as text, `title` for the list, `updatedAt`.
- **State**: one document, one target, one active surface, the selected section,
  and the status of the last save or load.

## Success Criteria

- **SC-004-1**: A page survives a reload. Covered by `app/tests/db.test.ts` and
  verified by hand on a Moto G7.
- **SC-004-2**: Stored text comes back byte for byte, including content this
  version cannot parse.
- **SC-004-3**: The preview never parses HTML. Every node is built with
  `createElement` and every string set with `textContent`.
- **SC-004-4**: Every control has an accessible name and a 44px target.

## What was wrong with it, found later

This section exists because the feature shipped without a review gate and the
defects were found by using it rather than by reading it.

- The first thing a new user does broke saving: an About you section starts with
  an empty name, and the schema marked that field non-empty, so the page became
  unsaveable before anything was typed. The constraint was in the wrong place;
  emptiness is a publishing concern, not a storage one.
- The editor rebuilt its entire DOM on every keystroke, which destroyed the
  focused field and, on a phone, closed the keyboard. See feature 010.
- The preview renderer had no test at all until 2026-08-31, while its own
  comment claimed an XSS corpus test that did not exist.
- The storage layer had no test at all until 2026-08-31.

## Assumptions

- One page per person. The storage layer lists pages and the app opens the most
  recent, so multiple pages are possible, but nothing in the interface offers to
  create or switch between them.

## Dependencies

Features 001 to 003. The document contract, the compiler, and every emitter.
