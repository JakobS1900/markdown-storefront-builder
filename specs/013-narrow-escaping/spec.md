# Feature Specification: Escaping Only What Needs Escaping

**Feature Branch**: none, straight onto master.
**Status**: Specified before implementation on 2026-08-31.
**Input**: A complete storefront was built and published to rentry on 2026-08-31
(`https://rentry.co/q7nyo28n`). It carried 74 backslashes and every one of them
was unnecessary.

## The problem

`ESCAPABLE` is `/[\\`*_{}[\]()#+\-.!|]/g`, applied to every character of artist
text wherever it appears. Its own comment defends the breadth: "a narrower one
would produce prettier source, and every omission is a way out of the
construct."

The first half is true and the second is not. Most of these characters can only
begin a construct **in a particular position**, and escaping them everywhere
buys nothing:

- `#` starts a heading only at the beginning of a line.
- `-` and `+` start a list item only at the beginning of a line.
- `.` continues an ordered list marker only when it follows digits that begin a
  line.
- `(` and `)` are only meaningful inside a link destination, which this compiler
  writes itself and never takes from artist text.
- `!` makes an image only when followed by `[`, and `[` is escaped
  unconditionally on every path, so the case cannot arise.

Measured on that storefront: **74 escapes, 59 of them full stops and 15 of them
hyphens**, all mid-sentence, none of them able to start anything. The tagline
came out as `Small\-batch everyday carry\. Machined in Sheffield\.`

## Why it matters, and why it is not urgent

Reading the published page back proved the escapes are invisible to a reader:
rentry consumes all 74. **Nothing a customer sees is wrong today.**

The cost is borne by the artist. The Copy screen shows the source, because the
source is the entire output of this tool, and it currently shows something that
looks mangled. Someone deciding whether to trust the tool reads that screen. So
this is a quality defect in the product's main output, not a correctness defect
in its published result, and it is worth doing carefully rather than quickly.

This is the second half of a lesson already half learned. When `$45` published
as `\$45`, the escape set was narrowed to what rentry's renderer *consumes*.
Nobody asked the other question: which of these characters needs escaping at
all, and where.

## Requirements

- **FR-023**: A character MUST be escaped only in a position where it could
  begin, end, or alter a construct. Escaping in any other position is a defect.
- **FR-023a**: The property in FR-010 is unchanged and is what this is measured
  against: nothing an artist writes may alter the structure of the surrounding
  page. Narrowing the set MUST NOT create a way out of any construct.
- **FR-023b**: `&`, `<` and `>` keep their entity treatment, and `~`, `^`, `$`
  keep theirs. Neither mechanism is touched. The previous change to this file
  broke the preview by reordering these, and that is the failure mode to avoid.

## The rule

Always, wherever it appears:

| Character | Why |
|---|---|
| `\` | Escapes the next character, so it must escape itself |
| `` ` `` | Opens a code span anywhere on a line |
| `*` `_` | Open emphasis anywhere on a line |
| `[` `]` | Open and close a link label anywhere on a line |
| `{` `}` | rentry's image sizing extension, which follows an image on the same line |
| `\|` | Ends a table cell, and cells are the one place a line is subdivided |

Only at the start of a line, after any leading spaces:

| Character | Why |
|---|---|
| `#` | ATX heading |
| `-` `+` | Bullet marker |
| `>` | Blockquote. Already an entity, so this is a statement of intent, not code |
| `.` after digits | Ordered list marker, as in `1.` |

Never:

| Character | Why |
|---|---|
| `(` `)` | Only meaningful in a link destination, which this compiler writes |
| `!` | Only makes an image before `[`, and `[` is always escaped, with one exception, below |

### The exception, found by a test written from this document

The line above is wrong as first written, and the test suite caught it before
the change shipped. `[` is escaped whenever it comes from artist text, but the
inline emitter writes brackets of its own for a link it has parsed and accepted.
So an artist typing `![alt](https://example.test/x.png)` in a paragraph got a
real embedded image: the bracket was ours, the exclamation mark was theirs, and
nothing escaped it any more.

`!` is therefore escaped at exactly that seam, in `emitInline`, when a link is
about to be written and the text before it ends in an unescaped `!`. It stays
unescaped everywhere else, which keeps `Back in stock!` clean.

The general lesson is worth more than the fix: "X is always escaped" was true of
one code path and false of another, and the reasoning that dropped `!` never
asked which path wrote the bracket.

## The subtlety that decides the design

`escapeText` is called with two different kinds of string, and the difference
matters:

1. **Text that will occupy whole lines**, such as a paragraph or a blurb pushed
   onto its own line.
2. **A fragment placed inside a line**, such as a table cell, a link label, an
   add-on name, or an item in a bullet list where the marker is already written.

For a fragment, the start of the string is not the start of a line. Applying the
line-start rules to it would under-escape, which is the one outcome FR-023a
forbids. The reverse, treating the start of every string as a line start, only
ever escapes more than necessary, which is safe.

**So the start of the string is always treated as a line start.** An include
reading `- also this` is written `\- also this` even though it will sit after a
bullet marker, because `- - also this` is a nested list. The cost is a rare
extra backslash on text that begins with a bullet character. The benefit is that
no caller has to be audited or annotated, and no future caller can get it wrong
by forgetting to.

## Verification

Regenerating the golden files is expected and the diff is the evidence: every
change must be an escape disappearing from a position where it did nothing.

The rule about rentry is that its behaviour is established by experiment. The
narrowed output MUST be published to rentry and read back before this is called
done, exactly as the previous escaping change was, and the storefront is the
fixture to do it with because it is the only page here with real prose in it.

## Out of scope

The entity mechanism, the inline grammar, and the line-breaking collapse. None
of them is implicated and all three have caused a regression in this file
before.
