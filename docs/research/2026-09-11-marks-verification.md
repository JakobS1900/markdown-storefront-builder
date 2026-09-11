# Highlight and strikethrough: host verification, 2026-09-11

**Date**: 2026-09-11.
**Method**: driving each host's own renderer at `/markdownx/markdownify/`, which
is the endpoint each compose page's live preview calls, with the CSRF token
taken from the `csrfmiddlewaretoken` hidden input on the home page.
**Nothing was published.** Only the preview endpoint was used; no page was
created on either host.
**Why**: FR-014. A capability value must be observed or documented, and may not
be carried across from a host that resembles it. This file is the observation
behind the `strikethrough` and `highlight` values in `targets.ts`, and behind
the change to `escape.ts`.

Both hosts turned out to use the same endpoint path, which is convenient and
proves nothing. The 2026-09-01 research already records that text.is and rentry
run the same stack and still disagree, and **they disagree again here**, on the
row marked below.

## What renders

| Source | text.is | rentry |
|---|---|---|
| `==highlighted==` | `<mark>` | `<mark>` |
| `~~struck out~~` | `<del>` | `<del>` |
| `a == b and c == d` | **`a <mark> b and c </mark> d`** | `a == b and c == d` |
| `==unclosed` | literal | literal |
| `2 * 3 = 6` | literal | literal |
| `&#126;&#126;tilde&#126;&#126;` | literal | literal |

So `strikethrough: true` and `highlight: true` for both paste hosts, each
observed rather than documented.

**The third row is the divergence and it is not cosmetic.** text.is pairs `==`
markers that have a space directly inside them; rentry does not. A seller
writing about two comparisons in one sentence gets a highlight they never asked
for on one host and not on the other. That is a construct reaching a published
page from ordinary prose, which is what the whitelist exists to prevent, and it
is live today.

`rentry.co/how` documents `~~Strikeout~~` and `==Mark==`, fetched the same day.
The documentation and the observation agree, which is worth saying because the
`hardBreak` capability exists precisely because they once did not.

## The setext defect, which is the real find

A line consisting of equals signs, directly under a line of text, is a setext
heading. **Both hosts turn the seller's own sentence into an `<h1>` and consume
the equals signs entirely.**

| Source | text.is | rentry |
|---|---|---|
| `My shop` + hard break + `===` | `<h1>My shop</h1>` | `<h1>My shop</h1>` |
| `My shop` + hard break + `=` | `<h1>My shop</h1>` | `<h1>My shop</h1>` |
| `My shop` + hard break + `---` | `<h2>My shop</h2>` | `<h2>My shop</h2>` |
| `My shop` + hard break + `\---` | literal `---` | literal `---` |
| `line` + hard break + `= 45 total` | literal | literal |

Four things follow.

**One: one equals sign is enough.** Not a row of them. A single `=` alone on a
line does it.

**Two: this is reachable by accident.** Underlining a heading with a row of
equals or dashes is a plain-text habit older than Markdown, and it is exactly
what somebody laying out a menu by hand would type.

**Three: the dash form is already safe and the equals form is not.**
`LINE_MARKER` in `escape.ts` escapes `#`, `+` and `-` at the start of a line.
`=` is in none of the escaper's three sets: not `ESCAPABLE`, not `LINE_MARKER`,
not `ENTITY_ONLY`. So the protection exists, was correct, and simply has a hole
in it the exact width of one character.

**Four: it is tested in the shape this compiler actually emits.** `emitProse`
joins the lines of a paragraph with the host's hard break, so a seller who
types two lines produces `text  \n===` and not `text\n===`. The first probe put
a blank line between them, which tests nothing, because a row of equals alone is
always just a paragraph. Both forms were then checked and both produce the
heading.

## What the fix has to be

**A backslash protects `=` on both hosts**, so no numeric character reference is
needed and this stays a narrower change than the tilde ever was.

| Source | Both hosts render |
|---|---|
| `\===` under text | literal `===`, no heading |
| `\=` under text | literal `=`, no heading |
| `a \=\= b` | literal `==`, no mark |

**Escaping only the first character of a run is not enough.** `a \===b=== c`
renders as `a =<mark>b</mark>= c` on both hosts: the escaped `=` is consumed and
the remaining four still pair up. Every character of the run has to carry its
own backslash.

| Source | Both hosts render |
|---|---|
| `a \=\=\=b\=\=\= c` | `a ===b=== c` |
| `a \=\=\=\=b\=\=\=\= c` | `a ====b==== c` |
| `\=\=\=\=\=` | `=====` |
| `use \=\=> this way` | `use ==> this way` |

That is the same lesson `escape.ts` already records about the exclamation mark
and the compiler-written bracket: **a marker only has to survive in part to
build a construct.**

**A single equals sign is left alone**, and that is deliberate rather than lazy.

| Source | Both hosts render |
|---|---|
| `Bundle = 3 items` | `Bundle = 3 items` |
| `a = b and c \=\= d` | `a = b and c == d` |

Escaping every `=` would work and would be wrong for a reason this repository
has already paid for once. `escape.ts:39-63` records a fix that was made and
reverted because adding `()` to `ESCAPABLE` put
`Laser engraving \(up to 20 characters\)` on the seller's Copy screen. The
seller reads that screen. `Bundle \= 3 items` is the same mistake with a
different character.

So the rule is two narrow ones:

1. Every `=` in a run of two or more gets a backslash.
2. A line that is nothing but equals signs gets them escaped, which rule 1
   already covers for two or more and which rule 2 extends to a lone `=`.

A single `=` with a non-equals on both sides is untouched.

## The portable target

Recorded as `strikethrough: false` and `highlight: false`, and this is a
judgement rather than an observation, so it is flagged as one.

The constitution's Additional Constraints define portable as "a strict
CommonMark plus GFM tables baseline". Highlight is in neither CommonMark nor
GFM. Strikethrough is a GFM extension, but the baseline names GFM **tables**
specifically, not GFM at large, and `tables: true` was justified on exactly that
wording.

Writing `strikethrough: true` for portable would be widening the declared
baseline by inference, which is the thing `targets.ts` refuses in its own
header:

> a value may not be written from assumption. Where a host does not document
> something, it is recorded as unknown rather than guessed, because assuming
> support produces broken pages for artists while assuming absence produces safe
> ones.

Absence is the safe direction, and the cost of being wrong is one plain word
plus a message, not a broken page. If it should be `true`, that is a one line
data change with a citation, which is Principle II working as intended.

## The menu file

`strikethrough: true` and `highlight: true`, observed in our own renderer,
because we ship the thing that displays that file. That is stronger evidence
than either paste host can offer, and it is the same reasoning the existing
`localImages: true` citation gives.

## Reproducing this

The probe scripts were throwaway and were not kept, in line with the decision
recorded about the preview table's widths. The method is fully described above:
GET the home page, read `csrfmiddlewaretoken` from the hidden input, POST
`content` to `/markdownx/markdownify/` with that token in `x-csrftoken`, the
home page as `referer`, and the cookies the home page set.

Two traps from the 2026-09-01 research still apply and both were avoided here:
the cookie jar says Laravel while the form says Django, so read the token from
the HTML; and probe lines must not be numbered, or Python-Markdown reads every
one as an ordered list item.
