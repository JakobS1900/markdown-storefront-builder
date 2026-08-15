# Architecture Review: The Compile Skeleton

**Feature**: 002-compile-skeleton
**Date**: 2026-08-15
**Gate**: Substitute for `/plan-eng-review`.

Same conduct note as feature 001. gstack is unreachable, zen is down (native
Gemini 2.0 retired, 2.5 quota exhausted, the Groq route returns filler), and no
subagent was spawned per Jakob's standing instruction. Performed directly, with
attention on what artist text can do, since that is where the risk in a compiler
concentrates.

## R-1. `---` as the thematic break is ambiguous in two ways (HIGH)

The data model specified `---`, which is the conventional choice and the wrong
one here.

**Setext headings.** In Markdown, a line of `---` immediately after a line of
text makes that text an H2 rather than producing a separator. Research D4's rule
that blocks are joined by a blank line does protect against this, so the design
is currently safe. It is safe by a side effect of a formatting decision, though,
and the `prose` emitter in 1.3 will produce multi-line text ending adjacent to
whatever follows. One future change to spacing turns every divider after a
paragraph into a heading, silently, and the golden files would record the
breakage as expected.

**Front matter.** A document that opens with `---` is read as YAML front matter
by a number of renderers. A page whose first block is a divider would have its
opening swallowed. rentry does not document front matter handling either way,
and per the project's own rule an undocumented behaviour is treated as unknown
rather than assumed safe.

**Resolution**: emit `***` instead. It is a valid thematic break everywhere, it
can never form a setext heading because `*` has no setext meaning, and it can
never be mistaken for front matter. The cost is that the source looks less
conventional, and the artist never reads the source, so the cost is nothing.

**Status**: accepted. Data model and both target records amended.

## R-2. Escaping must cover HTML, not only Markdown punctuation (HIGH)

The plan says artist text is escaped, and the capability is named
`escapeStyle: commonmark`. Markdown escaping alone is not enough.

CommonMark permits raw HTML in the document body. An artist who types, or is
socially engineered into pasting, `<img src=x onerror=...>` into a heading gets
that HTML emitted verbatim into a page hosted on someone else's domain. Whether
it executes is then the host's sanitizer's decision, which is not ours to rely
on and not ours to inspect.

FR-010 says artist text must not be able to change the structure of the
surrounding page. Raw HTML changes the structure of the surrounding page. So
this is not a new requirement, it is the existing one applied to a case the
capability name obscured.

**Resolution**: the escaper handles `<` and `&` in addition to Markdown
punctuation, so no HTML tag and no entity can be formed from artist text. The
XSS corpus test lands here rather than waiting for the sanitizer in 1.3, because
the emitted-text surface exists now and the DOM surface does not.

Worth stating plainly: this is a different gate from the preview sanitizer.
That one protects our own origin. This one protects the artist's page on a host
we do not control.

**Status**: accepted.

## R-3. Empty heading text emits a trailing space (MEDIUM)

`# ` with nothing after it leaves trailing whitespace on the line. Trailing
whitespace is invisible in review, is stripped by many editors on save, and is
normalised by some renderers. Any of those turns a byte-comparison golden test
into a failure with an unreadable diff, which is the worst possible way for the
project's strongest guarantee to break.

**Resolution**: a heading with empty text emits the hashes and no trailing
space. A fixture covers it.

**Status**: accepted.

## R-4. The size-limit path would ship untested (MEDIUM)

FR-015 requires a warning when output exceeds a host's stated limit. Neither
real target declares a limit: the CommonMark specification has none, and
rentry.co does not document one, so it is correctly recorded as unknown rather
than guessed.

The consequence is that `size_limit_exceeded` is unreachable through either
shipped target, so it would be written, never executed, and first run for real
on the day a limit is discovered.

**Resolution**: exercise it through the synthetic throwaway target that SC-007
already requires for proving hosts are data. One test target with a tiny
`maxBytes` covers both requirements at once.

**Status**: accepted.

## R-5. The fallback target must not be written back into the page (LOW)

`CompileResult.targetId` reports the target actually used, which differs from
the requested one when an unknown host fell back to portable. That is correct
for display.

The hazard is downstream: if the app writes that value back into the document as
the artist's chosen target, an unknown host is silently rewritten to `portable`
and the artist's choice is destroyed by opening their page in an older build.
That is precisely the failure R-4 of feature 001 was avoiding.

**Resolution**: no change here. Recorded as a constraint on roadmap 2.1 and 2.3:
the document's `target` field is written only when the artist changes it, never
from a compile result.

**Status**: noted, carried forward.

## Not findings

- Blocks joined by a blank line. Correct, and load-bearing for more than looks:
  it is what ends the preceding construct.
- Emitting `#` repeated rather than a lookup table. Fine, and the level is
  already clamped to the target's maximum before use.
- `compile` never throwing. Consistent with Principle I and with the validator's
  discipline in feature 001.

## Outcome

Two HIGH findings, both folded into the plan artifacts before implementation.
R-1 is the interesting one: the design was safe, but only as a side effect of a
formatting decision made for another reason, and a future emitter would have
broken it silently while the golden files recorded the breakage as correct.
