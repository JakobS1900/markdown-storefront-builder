# Architecture Review: The Document Contract

**Feature**: 001-document-contract
**Date**: 2026-08-15
**Gate**: Substitute for `/plan-eng-review`, which is unavailable in this environment.

## How this review was conducted, honestly

The intended gate is gstack `/plan-eng-review`. It is not reachable from this
session, as recorded in `docs/WORKFLOW.md`.

The documented substitute is zen plus a fresh adversarial subagent. Neither was
usable:

- **zen, native Google route**: `gemini-2.0-flash` returns 404. The model has
  been retired by Google. This affects the whole `AI-Unity` stack, not just this
  project.
- **zen, `gemini-2.5-flash`**: 429, free tier quota of 20 requests per day
  exhausted. It also routed to the native Google provider rather than through
  the LiteLLM proxy.
- **zen, `groq-llama`**: returned, but the output restated the input findings,
  recommended schema validation libraries after being told zero runtime
  dependencies are mandated, fabricated a code snippet with an invented line
  number, and addressed none of the six pressure points. Not counted as a review.
- **Fresh adversarial subagent**: not run. Jakob's standing session instruction
  is not to spawn agents unless he asks.

So this review was performed directly, against the six pressure points written
for the gate. It is a real review with real findings, and it is not a substitute
for a genuinely independent reviewer. That gap is recorded rather than papered
over.

## Findings

### R-1. Descriptor and types can silently disagree (HIGH)

The plan has `descriptor.ts` as the source of truth and `types.ts` maintained by
hand alongside it. Two hand-maintained artifacts that must agree is precisely the
drift the descriptor was introduced to eliminate. Nothing fails if a field is
added to one and not the other: the validator accepts a shape the type forbids,
or the type permits a shape the validator rejects, and the parity test guards
only the descriptor, so it stays green.

**Resolution**: derive the types from the descriptor. Declare the descriptor
`as const` and compute `Document` and `Block` from it with mapped and conditional
types. TypeScript does this natively with no runtime dependency and no codegen
step, so it costs nothing against the constitution.

This closes field names, optionality, primitive types, and string-literal enums
completely, because all four are recoverable from a literal type. It does not
close cross-field rules such as identifier uniqueness or the range on `level`,
which remain the validator's job and are already covered by tests. Recorded so
nobody later believes the types prove more than they do.

**Status**: accepted. Research D2 and the plan are amended.

### R-2. `NaN` and `Infinity` silently become `null` on write (HIGH)

This is a real bug that would have shipped.

Guarantee G2 says round trip is lossless, and research D4 says `null` is never
valid anywhere. But `JSON.stringify(NaN)` and `JSON.stringify(Infinity)` both
produce `null`. `NaN` and `Infinity` are not valid JSON, so they can never arrive
through `parseDocument`. They can absolutely arrive in an in-memory `Document`
handed to `serializeDocument` by the editor, for instance from a numeric field
computed as `parseInt("")`.

The result: a page containing `NaN` serializes to a page containing `null`, which
then fails to load, because `null` is never valid. Work is written to disk in a
state that cannot be read back. That is the exact failure Principle V exists to
prevent, arriving through the serializer rather than through a cleanup path.

**Resolution**: the validator rejects any number that is not a finite integer,
naming `NaN`, `Infinity`, `-Infinity`, and non-integers explicitly. Add
`not_finite` to `IssueCode`. `serializeDocument` asserts its input is valid
before writing, so an invalid document can never reach disk.

**Status**: accepted. Added to the data model rules and the contract.

### R-3. Descriptor key order alone does not fully specify canonical output (MEDIUM)

Descriptor order is necessary but the plan does not state the rule that makes it
sufficient. Two mechanisms would break byte-identical output if the writer ever
iterated the input object instead:

- JavaScript objects reorder integer-like string keys to the front in ascending
  numeric order, regardless of insertion order.
- A key present in the input but not in the descriptor would be emitted in
  whatever position iteration found it.

The plan's design happens to be safe, because the writer emits descriptor keys
rather than iterating the value. That safety is currently accidental rather than
stated.

**Resolution**: state it as a rule in the contract. The writer MUST emit only
keys named by the descriptor, in descriptor order, and MUST NOT enumerate the
input object. Add a test that serializes a document whose keys were assigned in
reverse and in numeric-like order, and asserts identical bytes.

Two related points, checked and found not to be problems: `JSON.stringify` has
been well-formed since ES2019, so lone surrogates are escaped rather than
emitted as invalid UTF-8, and round trip through them is safe. Duplicate keys in
an input file are resolved by `JSON.parse` keeping the last, which we cannot
detect afterwards. That is a known and accepted limit, not a defect we can fix.

**Status**: accepted.

### R-4. Refusal with no way out is a data-loss trap that looks safe (MEDIUM)

FR-004 refuses a future version and FR-017 refuses unknown fields, and in both
cases nothing is modified. Correct as far as it goes. From a non-technical
artist's position, though, the outcome is a page they can see listed and cannot
open, with no action available. Refusing to open is only recoverable if the
artist can still get their bytes out.

The plan has no such escape hatch, and the requirement lives at the app layer,
which means it will be forgotten unless it is written down now.

**Resolution**: record it as a requirement in this spec even though it is
implemented in 2.1. A page that fails to load MUST still be exportable as its
raw stored bytes, and the failure message MUST offer that action. Added as
FR-018 with a forward reference.

**Status**: accepted.

### R-5. An unknown `target` needs a defined fallback (LOW)

Research D5 is right that the contract must not enumerate hosts. The consequence
is that a page can name a target the running build does not know, which is
intended. What is undefined is what the app then shows.

**Resolution**: no change to this feature. Recorded as a constraint on 1.2: an
unknown target falls back to `portable` and raises a diagnostic naming the
unknown target. `portable` is the correct fallback because it is the baseline
every host approximates.

**Status**: noted, deferred to 1.2 with the decision already made.

### R-6. Identifier generation sits outside this feature (LOW)

Uniqueness is validated here, generation happens in 2.2. The seam is real but
correctly placed: generation needs randomness, and Principle I forbids the engine
from consuming randomness. Validation catches collisions regardless of how they
arise, which is the property that matters.

**Status**: not a defect. No change.

### R-7. The empty migration registry is correct (INFORMATIONAL)

Confirmed as planned. The mechanism cannot be retrofitted onto pages already
saved by a build that lacked it. Building it now costs little and buys the only
window in which it can be built at all.

**Status**: no change.

## Outcome

Two HIGH findings, both accepted and folded back into the plan artifacts before
implementation, as the workflow requires. R-2 is a genuine bug that would have
reached disk.

The gate did its job, which is the argument for keeping it even when the tooling
for it is unavailable.
