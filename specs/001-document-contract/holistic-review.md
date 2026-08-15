# Holistic Review: The Document Contract

**Feature**: 001-document-contract
**Date**: 2026-08-15
**Scope**: The whole feature diff, read as one thing.

Required because this feature ran to four chunks. Each per-chunk review saw one
internally correct side of a seam and structurally could not catch a failure
that only exists between them.

Same honesty note as the architecture review: gstack is unreachable and no
independent subagent was used, per Jakob's standing instruction. This was done
directly, with fresh attention on the seams rather than the pieces. Every finding
below was written as a failing test BEFORE being believed, and all three failed
on the first run, so none of them are speculation.

## H-1. An unknown block kind buried its own message in noise (MEDIUM)

A block whose `kind` this version does not recognise has no field list to check
against. The validator was falling back to the common field list, which contains
only `id` and `kind`, and then running the unknown-field sweep. Every other field
on that block was therefore reported as unknown.

A `video` block with `src`, `autoplay`, and `poster` produced five issues: one
`unknown_kind` and four `unknown_field`. The four are noise, and worse than
noise, because they tell the artist to fix fields that are probably perfectly
correct while the one issue that matters sits among them. That is the direct
opposite of SC-006, which requires that a person can identify which part of their
page is at fault.

Neither the US1 reviewer nor the US3 reviewer would see this. One was looking at
unknown-field handling and the other at kinds, and each was correct in isolation.

**Fixed**: for an unrecognised kind, only `id` is checked and the unknown-field
sweep is skipped. Unknown fields on blocks of a KNOWN kind still report, which
has its own test so the fix cannot silently over-apply.

## H-2. `emptyDocument` could return a page that was not valid (MEDIUM)

`emptyDocument("")` returned `{ schemaVersion: 1, target: "", blocks: [] }`,
which fails validation, because `target` is declared non-empty.

The contract states that a new page is valid from the moment it is created, and
lists that as something the editor may assume. It was not true. The editor would
have received a page it could neither validate nor write, and the failure would
have surfaced later, somewhere else, looking like a storage bug.

This is a seam artifact: `empty.ts` was written in the US1 chunk against the
descriptor, and the non-empty constraint on `target` was enforced in
`validate.ts` in the same chunk. Nothing connected the two.

**Fixed**: `emptyDocument` validates what it built and throws if it is not valid.
It throws rather than returning a result for the same reason the writer does: a
caller passing a blank target has a bug, and nothing a user types reaches that
argument.

## H-3. A validated document aliased the caller's own object (HIGH)

`validateDocument` returned the exact object it was given, not a copy.

The editor validates a draft it is still holding. Handing back that same object
makes the application's idea of the saved page and the draft the artist keeps
typing into a single object. The saved copy then changes underneath the
application, silently, with no write and no event. At the storage seam in 2.1
this becomes: the artist edits, does not save, and the unsaved edits are written
anyway, or a rollback restores a value that has already been overwritten.

This is exactly the class of bug the holistic stage exists for. Every function
involved was individually correct. Guarantee G5 says validation must not mutate
its input, and it does not. Nothing promised isolation, and nothing tested for
it, because within any single chunk there was no second holder of the object.

**Fixed**: an accepted document is rebuilt in descriptor order and returned as a
copy. The ordering logic moved to `canonical.ts`, since the writer needs the same
operation and the two must not drift. A second benefit falls out: the copy
carries only descriptor-named keys, so nothing unexpected can survive validation
even if a future change let it past the field checks.

## Not findings

Checked and found correct, recorded so they are not re-examined later:

- `migrate` returning its input unchanged at the current version. Intentional,
  and copying would cost time to produce an equal value. The copy now happens
  once, downstream, in the validator.
- The `schemaVersion` cast after the version gate. The gate guarantees an
  integer within range before anything else runs.
- `orderedBlock` indexing `BLOCK_FIELDS` by kind without a guard. Only an
  already-validated page reaches it, so the kind is known.
- Prototype pollution through `__proto__`. `JSON.parse` creates it as an
  ordinary own property rather than polluting anything, `Object.keys` reports
  it, and it is refused as an unknown field. Nothing in the module assigns a key
  taken from input, which is what pollution would require. Tested directly.

## Outcome

Three findings, all confirmed by a failing test before being accepted, all
fixed. H-3 is the significant one, and it is the kind of defect that would have
been diagnosed as a storage bug months later, in a different file, by someone
who had never read this feature.
