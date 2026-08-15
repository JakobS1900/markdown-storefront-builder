# Phase 0 Research: The Document Contract

**Feature**: 001-document-contract
**Date**: 2026-08-15

Every decision below was forced by a constitution principle or a spec
requirement. Where a more comfortable option was rejected, the reason is
recorded.

## D1. Validation is hand written, not a schema library

**Decision**: Write the validator by hand against a schema descriptor. No `zod`,
no `ajv`, no `valibot`.

**Rationale**: The constitution states the engine MUST have zero runtime
dependencies. That settles it. Two things fall out of the constraint that are
genuine wins rather than consolations. FR-003 requires messages an ordinary
person can act on, and library messages are written for developers, so we would
be rewriting them anyway. FR-017 requires rejecting unknown fields with the
offending field and block named, which is strict-mode behaviour we control
directly.

**Alternatives considered**: `zod` gives excellent inference and would be the
obvious choice in almost any other project. It is a runtime dependency, so it is
not available here. `ajv` plus JSON Schema would make the contract portable to
other languages, which is real value, but it is both a dependency and a second
source of truth to keep in sync with the TypeScript types.

## D2. One schema descriptor is the single source of truth

**Decision**: An ordered, data-only schema descriptor drives three things: the
validator, the canonical writer, and the parity test.

**Rationale**: FR-013 requires a test that fails if field names, types, or order
change. TypeScript types are erased at runtime, so nothing can reflect over them
to produce that test. A descriptor that exists as data solves this and removes
the usual drift, where a validator, a serializer, and a snapshot each carry their
own idea of the schema and disagree quietly.

Field order becomes meaningful because the descriptor is ordered, which is what
makes "order" in FR-013 something that can actually be asserted.

**Alternatives considered**: Hand-maintaining a separate snapshot file alongside
a hand-written validator. Rejected because the two drift, and the parity test
then guards the snapshot rather than the schema. Deriving the descriptor from
types via a build step was rejected as a toolchain dependency for no gain.

## D3. Canonical serialization, not `JSON.stringify` of whatever we hold

**Decision**: The writer emits keys in descriptor order, always.

**Rationale**: FR-007 requires writing the same page twice to produce identical
output, and US2 acceptance scenario 2 requires two exports of the same page to be
byte-identical. `JSON.stringify` follows a JavaScript object's insertion order,
so a page assembled by editing produces different bytes from the same page loaded
from disk, even though both are equal. Descriptor order makes the byte output a
function of the content alone.

This is also what makes a future diff of two exported pages readable.

## D4. Absent and empty are different, and `null` is never valid

**Decision**: An optional field is either absent (its key is not present) or
present with a real value. `null` is rejected wherever it appears.

**Rationale**: FR-010 requires preserving the distinction across a round trip.
`JSON.stringify` drops `undefined` values, so absence maps cleanly onto a missing
key with no special handling. Allowing `null` as a third state would create the
classic ambiguity where absent, null, and empty string all mean "no tagline" and
three code paths disagree about which one to write back.

**Alternatives considered**: Treating `null` as equivalent to absent. Rejected
because it makes round-trip equality dependent on which of two representations
the writer happens to choose.

## D5. The contract does not validate that a target exists

**Decision**: The page stores its chosen target as a non-empty string. The
contract does not check that string against a list of known hosts.

**Rationale**: This is the decision that lets feature 1.1 land alone, as the
constitution requires. Checking the target against a registry would make the
contract depend on the target records, which arrive in 1.2, and the contract
would no longer be first.

It is also correct beyond the sequencing convenience. Principle II says hosts are
data and adding one must not change engine code. If the contract enumerated valid
hosts, adding a host would mean editing the contract and regenerating the parity
snapshot, which is exactly the coupling Principle II forbids. An unknown target
is a compile-time diagnostic in 1.2, not a reason to refuse to open a page.

**Alternatives considered**: A union type of `"rentry" | "portable"`. Rejected on
both counts above. It also fails a real user case: a page created after a host is
added should still open in an older build, showing a diagnostic, rather than
being unopenable.

## D6. Validation collects all problems, and every problem carries a location

**Decision**: Validation returns a list of issues, never throws, and each issue
carries a machine-readable path, the identifier of the block it occurred in when
there is one, a stable code, and a human sentence.

**Rationale**: FR-002 requires reporting every problem rather than stopping at
the first, because an artist fixing one error per attempt is a worse experience
than one list. SC-006 requires that a person who did not write the tool can say
which part of their page is at fault, which is why the block identifier travels
with the issue rather than only a JSON path.

The stable code exists so the app can localize or specialize a message later
without parsing English.

## D7. The migration registry ships empty

**Decision**: Build the forward-migration mechanism now, with no entries in it,
and a test that proves an unknown future version is refused.

**Rationale**: Principle V requires forward-only migrations covered by a fixture
per version step. There are no steps yet because this is version 1. The
mechanism cannot be retrofitted, because by the time a second version exists
there are already pages saved by version 1 in the wild, written by a build that
had no migration path. Building the empty mechanism costs very little now and is
impossible to add later without asking users to lose work.

## D8. Performance needs a guard, not an optimization

**Decision**: Meet SC-005 with a straightforward single-pass validator and add a
test that fails if a 50-block page takes longer than the budget.

**Rationale**: A hand-written single pass over a page of kilobytes is orders of
magnitude inside 100 milliseconds on any device. The risk is not that the first
implementation is slow, it is that something later makes it slow without anyone
noticing. A guard test catches that. Optimizing now would be speculative work
against a budget we are nowhere near.

The budget is checked on the development machine with headroom, because the
target is a mid-range phone and CI hardware is not one. The guard is set well
below the stated budget so that it fails early rather than exactly at the
boundary.

## Unresolved

None. No NEEDS CLARIFICATION markers remain in the spec, and both clarification
questions were answered on 2026-08-15 and recorded in the spec.
