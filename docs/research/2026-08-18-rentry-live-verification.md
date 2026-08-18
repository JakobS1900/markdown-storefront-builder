# Live verification against rentry.co

Date: 2026-08-18
Method: pasted compiled golden output into rentry.co's editor and read its
Preview tab. Nothing was published. The "Go" button was never clicked.

This is roadmap item 4.2, and it closes the gap that had been open since the
first host research: every capability value until now cited rentry's published
documentation, which is evidence, and is not the same as having tried it.

## It found a real bug

**The hard line break did not work, and made things worse than not working.**

The compiler emitted the CommonMark form, a trailing backslash. rentry runs
Python-Markdown, which does not implement it. The result was no line break AND
the backslash swallowed, so two sentences rendered joined with no space at all:

    Extra revisions are USD 10 each.Refunds are available until lineart begins.

Nothing caught this. Every test asserted the backslash was emitted, because the
tests encoded the same assumption the emitter did. Only the live renderer
disagreed.

**Fixed** by making the form a capability, `hardBreak`, with `backslash` for the
portable baseline and `spaces` for rentry, sourced from this observation rather
than from documentation. Re-verified in the same preview afterwards: one `<br>`,
and the sentences on separate lines.

A side effect worth recording: this is the first capability where the two
shipped hosts genuinely produce different output. Until now the compatibility
machinery was proved only by synthetic hosts in tests, and the README and case
study both said so. That caveat can now be softened, because a real divergence
exists.

## What else was checked, and held

| Claim | Result |
|---|---|
| `***` renders as a separator | Yes, `<hr>` |
| Headings render at the right level | Yes, `h2` and `h3` as emitted |
| Tables render, including the menu and the image grid | Yes, both |
| Backslash escapes are honoured, so `\.` shows as `.` | Yes |
| Images render from their addresses | Yes |
| Bold and italic render | Yes, `strong` and `em` |

## The security claim, against the real renderer

The hostile-page fixture was pasted in and previewed. rentry produced:

- zero `script`, `iframe`, `object`, `embed`, or `svg` elements
- zero event handler attributes
- `<script>alert(1)</script>` displayed as visible text, exactly as an artist
  would have typed it

That is the entity-encoding decision from architecture review R-2 confirmed
against a renderer we do not control, which is the only place the claim actually
mattered.

## Still unverified

The image host hop in `proxy/src/worker.ts`. It needs an account and a
deployment. Marked unverified in the source, the proxy README, and the roadmap.
