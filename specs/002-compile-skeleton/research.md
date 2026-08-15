# Phase 0 Research: The Compile Skeleton

**Feature**: 002-compile-skeleton
**Date**: 2026-08-15

## D1. A target is a capability record plus fallbacks, and nothing else

**Decision**: `Target` is data: an identifier, a display name, a set of
capability values, and a source citation for each value. No functions, no
per-host branches anywhere in the emitters.

**Rationale**: Constitution Principle II. A pull request that adds a host and
also edits an emitter is a design failure. SC-007 makes that checkable by adding
a throwaway host inside a test and compiling with it, which only works if hosts
are genuinely data.

The emitters therefore ask questions like "what is the deepest heading level
here" rather than "is this rentry".

**Alternatives considered**: A per-target emitter class implementing a shared
interface. It is the obvious object-oriented shape and it is wrong here: it puts
host knowledge in code, so adding a host means writing an implementation and the
capability matrix stops being the single description of what a host can do.

## D2. Escaping is the compiler's job, and it is not optional

**Decision**: Every piece of artist text passes through an escaper before it
reaches the output. The escaper is chosen by capability, not by target.

**Rationale**: FR-009 and FR-010, and SC-006. An artist writes `# not a heading`
or `- not a list` in a heading, and it must display as they typed it. More
seriously, unescaped text can end the construct it sits inside and change the
structure of everything after it, which is the Markdown equivalent of an
injection.

This is the same narrow gate discipline as feature 001: text is data, and the
only path from data to structure runs through code that knows the difference.

The sanitizer for the preview is a different thing and arrives in 1.3. This one
is about the emitted Markdown, not about the DOM.

## D3. Headings degrade to the nearest supported level, never to plain text

**Decision**: A heading deeper than the target supports is emitted at the
deepest level the target does support, with a warning.

**Rationale**: FR-012. The alternatives are worse. Dropping the heading loses
the artist's structure. Emitting `####### text` produces literal hashes on a host
that stops at six, which looks like a mistake the artist made. Falling back to
bold text loses the anchor and the table of contents entry.

Nearest-supported keeps the page navigable and the loss is one level of nesting,
which is the smallest available compromise.

## D4. The output ends with exactly one newline, and blocks are separated by one blank line

**Decision**: Blocks are joined by a single blank line. The document ends with a
single trailing newline. No leading blank line.

**Rationale**: FR-003 requires identical bytes, which means every whitespace
decision must be made once, deliberately, rather than emerging from string
concatenation. A blank line between blocks is also what Markdown itself requires
to end most constructs, so this is not merely cosmetic: without it a heading
followed immediately by text can absorb that text on some renderers.

An empty page therefore compiles to an empty string, not to a lone newline.

## D5. Diagnostics carry the block id, not just a message

**Decision**: A compile diagnostic names the block it came from, the capability
responsible, the fallback applied, and a severity.

**Rationale**: SC-005 requires that a person can tell which part of their page a
warning concerns. The app will highlight the offending block in the editor, which
needs the identifier rather than prose. This mirrors the validation issue shape
from feature 001 deliberately, so the app has one way of pointing at a problem
rather than two.

Severity exists because not every compromise is equal. A heading dropping one
level is worth noting. Output exceeding a host's size limit means the page will
be rejected on paste, which the artist needs to see differently.

## D6. An unknown target falls back to portable and warns

**Decision**: Compiling for an identifier this build does not know produces
output against the portable baseline, plus a warning naming the unknown target.

**Rationale**: Carried from feature 001 architecture review R-4. Feature 001
deliberately stores `target` as an opaque string so adding a host needs no
contract change, which means a page can legitimately name a host this build has
never heard of.

Refusing would make such a page unopenable, which is the failure mode that
review rejected. Portable is the correct fallback because it is the baseline
every host approximates, so the output renders somewhere rather than nowhere.

## D7. The size limit warns and still returns the output

**Decision**: Output exceeding a target's stated size limit produces a warning
and is returned in full.

**Rationale**: FR-015. Truncating would silently destroy the end of the artist's
page, and the compiler has no way to know which part matters least. Returning
the full text with a clear warning leaves the decision with the person who wrote
it, which is the only place it can correctly be made.

## D8. Golden files are checked in as readable Markdown, not as escaped strings

**Decision**: Expected output lives in `.md` files, one per fixture per target,
compared byte for byte.

**Rationale**: The point of a golden file is that a human can read it and say
whether it is right. An escaped string inside a test cannot be eyeballed, and a
diff of one is unreadable, which is exactly when you most need to read it.

Storing them as real Markdown also means the manual host verification checklist
can paste the file directly into the live host with no transformation.

## D9. Line endings are normalised to LF in comparisons

**Decision**: Golden comparison normalises CRLF to LF on both sides.

**Rationale**: This repository is on Windows with `core.autocrlf` behaviour that
rewrites line endings in the working copy, as every commit so far has warned.
Without normalisation the golden tests would pass on one machine and fail on
another, which turns the strongest guarantee in the project into a source of
noise.

The compiler itself always emits LF. Normalisation is applied to the comparison,
not to the compiler, so the bytes it produces stay platform independent.

## Unresolved

None. The one genuine question, what to do with an unknown target, was already
answered by feature 001's architecture review and is recorded in the spec's
Clarifications section.
