# Feature Specification: Inline Formatting in a Text Section

**Feature Branch**: `008-inline-formatting`
**Shipped**: 2026-08-21, merged as `3791df3`
**Status**: Shipped. Specified retrospectively on 2026-08-31, see `specs/README.md`.
**Input**: Roadmap item 1.7, deferred out of 1.3 during feature 003.

## What this feature is

Bold, italic, links, and bullet lists inside a Text section.

It was deferred out of the prose emitter on purpose and the reason is worth
keeping. The contract stores `prose.text` as one plain string, and the compiler
escapes every Markdown character an artist writes, precisely so that nothing
they type can become structure on someone else's domain. A subset grammar
therefore needs either a parser with a whitelist or a change to the contract's
shape. Both are real decisions, and feature 003 refused to smuggle either into
an emitter.

The answer was the whitelist: a small parser that recognises exactly four
constructs and escapes everything else, so the safety property is unchanged and
the artist gets the four things they actually asked for.

## User Scenarios & Testing

### User Story 1 - I can emphasise a word (Priority: P2)

An artist writes `**deposit**` in their terms and it comes out bold, rather than
as literal asterisks.

### User Story 2 - I can link to my own places (Priority: P2)

They write `[my Ko-fi](https://ko-fi.com/example)` and get a link.

### User Story 3 - Nothing I type can break the page (Priority: P1)

Everything outside those four constructs is still escaped, including anything
that looks like a construct but is not, and any address that is not http or
https.

### Edge Cases

- An unsafe address inside otherwise valid link syntax. Refused, and rendered as
  the artist's own text rather than dropped in silence.
- Unbalanced markers. Left as literal characters rather than guessed at.
- A construct inside a list item. Formatting applies inside list items too.

## Requirements

### Functional Requirements

- **FR-008-1**: Bold, italic, links, and bullet lists MUST be recognised inside
  a Text section.
- **FR-008-2**: Everything else MUST remain escaped exactly as before.
- **FR-008-3**: A link address that is not http or https MUST NOT become a link.
- **FR-008-4**: The grammar MUST be a whitelist. Adding a construct is a code
  change, never a consequence of input.

## Success Criteria

- **SC-008-1**: The hostile corpus from feature 003 still produces no structure.
  Covered by `engine/tests/compile/inline.test.ts` and the golden files.
- **SC-008-2**: The same text compiles identically on both hosts, apart from the
  documented line break divergence.

## Dependencies

Features 002 and 003. The escaper and the prose emitter.
