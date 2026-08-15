# Holistic Review: The Compile Skeleton

**Feature**: 002-compile-skeleton
**Date**: 2026-08-15
**Scope**: The whole feature diff, read as one thing.

Same conduct note as before: gstack unreachable, zen down, no subagent per
Jakob's standing instruction. Performed directly, with attention on the seams.

Six candidate findings were written as tests before being believed. Four passed
on the first run and were wrong suspicions, kept as regression cover. Two
failed.

## H-4. A page of only unimplemented sections compiled to silence (HIGH)

`prose`, `menu`, `gallery`, and `profile` have no emitter yet, and were skipped
without comment. A page made entirely of those compiled to an empty string with
zero diagnostics.

The result an artist would experience: they build a commission menu, press copy,
get nothing, and paste nothing into their host. No error, no warning, and the
tool reporting success. That is the worst kind of failure, because there is
nothing to tell them anything went wrong.

Skipping was the right call. A half rendered commission menu is worse than none,
because they would paste it believing it complete. Skipping SILENTLY was not.

Neither per-phase reviewer would see this. The emitter reviewer sees two
correct emitters. The compiler reviewer sees a switch that handles every kind.
The gap only exists when you ask what a page made of the other four does, and
that page is in nobody's chunk.

**Fixed**: every skipped section raises `block_not_supported`, naming the
section in words an artist would recognise, and stating that nothing in their
page has been changed.

## H-6. The escaper used JavaScript's idea of whitespace, the renderer will not (HIGH)

`escapeInline` collapsed whitespace with `\s`, on the reasoning that a newline
inside a heading ends the heading and turns the remainder into body text.

JavaScript's `\s` does not include U+0085, U+001C, U+001D, or U+001E.

Python's `str.splitlines` does. It splits on all four, and rentry is a Python
service. So a heading containing U+0085 passes our check, reaches the host, and
can be cut in half by a renderer whose idea of a line boundary is wider than
ours. The rest of the artist's heading becomes body text, and the structure of
the page below it shifts.

This is a cross-language boundary bug, which is exactly the category the Tessera
notes single out as the most fragile thing in a codebase. The seam here is not
FFI or serialization but something subtler: two languages that both have a
concept called "whitespace" and do not agree on its membership. Where they
disagree, the renderer wins, because it runs last and we do not control it.

**Fixed**: `escapeInline` collapses the union of both sets, with the reasoning
recorded at the definition. `no-control-regex` is disabled on that one line,
with a note that the rule exists to catch control characters arriving by
accident and these did not.

## Wrong suspicions, kept as regression cover

- **H-1**: a heading whose text escapes to a shorter but non-empty string. Handled
  correctly already.
- **H-2**: a declared capability that no emitter consults. None exists, and the
  test now fails if one is added without a consumer.
- **H-3**: `escapeStyle` is declared and never branched on. Honest only while
  every host shares one style, so the test fails the moment two differ and
  forces the escaper to actually read it.
- **H-5**: the two shipped hosts produce identical output. Expected today, and
  the second assertion proves the divergence mechanism works by narrowing one
  host's capabilities and watching the output change.

## Outcome

Two HIGH findings, both fixed, both invisible to any single-chunk review. H-6 is
the one worth remembering: every function was correct, the tests were correct,
and the defect lived in an assumption about a language that is not this one.
