# rentry escape verification, 2026-08-31

Pasted into rentry's live preview at https://rentry.co/ and read back from the
rendered preview. Nothing was published: the compose form was used and the "Go"
button never pressed, and the editor was cleared afterwards.

## Why this was checked at all

The capability record said `escapeStyle: "commonmark"`, sourced as "rentry.co/how
documents no divergence from standard escaping". That is an absence of
documentation recorded as a presence of behaviour, which the header of
`targets.ts` explicitly forbids:

> a value may not be written from assumption. Where a host does not document
> something, it is recorded as unknown rather than guessed, because assuming
> support produces broken pages for artists while assuming absence produces safe
> ones.

The same record already carried one capability written that way which turned out
to be wrong, `hardBreak`, corrected on 2026-08-18 after a paste test. The live
verification that day checked exactly one escape, a full stop, and recorded
"Backslash escapes are honoured, so `\.` shows as `.` - Yes". It did not test any
other character.

rentry renders with Python-Markdown, whose escapable set is narrower than
CommonMark's "all ASCII punctuation", so the generalisation from one character to
all of them was the thing worth checking.

## Method

One paragraph per character, of the form `ROWn A\<char>B`, so that the rendered
text names which character each result belongs to. Read from the preview's own
DOM rather than by eye.

## Result

Backslash consumed, the escape works:

    `  *  _  {  }  [  ]  (  )  #  +  -  .  !  |   and a literal backslash

Backslash left visible on the page:

    ~  ^  $

The literal backslash was checked twice. A first pass using string literals
reported it as broken, which was an artefact of escaping through the test
harness; repeating it with `String.fromCharCode(92)` showed `A\\B` rendering as
`A\B`, so it is honoured.

## What that meant for artists

An artist writing a price of `$45`, the likeliest input this application will
ever receive, published `\$45`. A range written `50~60` published `50\~60`.

## The fix, verified in the same session

Those three characters are now emitted as numeric character references rather
than backslash escapes, which is the answer this project already uses for `<`,
`&` and `>`. Checked in the same preview:

| Sent | Rendered |
|---|---|
| `&#36;45` | `$45` |
| `50&#126;60` | `50~60` |
| `a&#94;b` | `a^b` |
| `&#126;&#126;not struck&#126;&#126;` | literal `~~not struck~~`, no strikethrough |
| `~~really struck~~` | struck through |

The last two matter together: the entity still prevents the character forming a
construct, which is the property the escaping exists for, while a genuine
strikethrough written by the compiler would still work.

## Still unverified

Whether any other host renders these three the same way. Only rentry and the
portable baseline are shipped, and portable is a specification rather than a
renderer, so there is nothing to paste it into.
