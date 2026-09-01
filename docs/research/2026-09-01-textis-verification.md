# text.is host verification

**Date**: 2026-09-01.
**Method**: driving the host's own renderer at
`https://text.is/markdownx/markdownify/`, the endpoint its pages are rendered
by, with a CSRF token taken from the hidden input on the home page.
**Why**: FR-014. A capability value must be observed or documented. This file
is the observation for every value in `TEXT_IS`.

## What the first pass got wrong, twice

Worth recording, because both mistakes are the kind that produce a confident
wrong answer rather than a visible failure.

**One: the family resemblance.** The research began "text.is runs the same
django-markdownx stack as rentry", and the temptation was to copy rentry's
capability values across. They are not the same host. See the escaping table
below: a backslash fails for three characters on rentry and one here, and a
trailing backslash is inert on rentry and destructive here.

**Two: the framework fingerprint.** The cookie jar after loading the home page
contains only `laravel_session` and `XSRF-TOKEN`, which says Laravel, and the
first probe looked for a Django `csrftoken` cookie, found nothing, and stopped.
The Django form is really there, in the page rather than the cookies: the HTML
carries `name="csrfmiddlewaretoken"` and
`data-markdownx-urls-path="/markdownx/markdownify/"`. There is a Laravel front
end in front of a django-markdownx application. Neither observation alone
describes the site.

A third, smaller one: the first escaping probe numbered its lines `0.`, `1.`,
`2.`, which Python-Markdown reads as an ordered list, so every probe line came
back as a list item and matched nothing. The marker is now letters only.

## Structure

| Value | Observed | Recorded as |
|---|---|---|
| Heading levels | `#` to `######` produced `h1` to `h6` | `maxHeadingLevel: 6` |
| Thematic break | `***` produced `<hr>` | `thematicBreak: "***"` |
| Tables | GFM pipe table produced `<table>` and `<th>` | `tables: true` |
| Size limit | paste form carries `maxlength="200000"` | `maxBytes: 200000` |

The size limit counts characters and the capability counts bytes. Recorded
deliberately in the safe direction: a page inside 200000 bytes holds at most
200000 characters, so the limit under-claims rather than over-claims. It is not
recorded as "no limit", which is the mistake `maxBytes` exists to prevent.

## Line breaks

| Source | Rendered |
|---|---|
| `AAA` newline `BBB` | `AAA<br> BBB` |
| `CCC` two spaces newline `DDD` | `CCC<br> DDD` |
| `EEE` backslash newline `FFF` | `EEEFFF` |

Two consequences, both load bearing.

**`hardBreak: "spaces"`.** The CommonMark backslash form must never reach this
host. It does not merely fail to break the line: it consumes the newline *and*
the space that would have joined the two lines, so "each." and "Refunds"
publish as "each.Refunds". That is the same failure rentry produced in
2026-08-18, arrived at by a different route, and it is worse here because on
rentry the backslash at least stays visible.

**`nl2br` is on.** A single newline is already a `<br>`, so nothing may be soft
wrapped for this host. The compiler does not soft wrap, and the prose emitter
already converts single newlines to explicit hard breaks, so this costs nothing
today. It is written down because a future emitter that wraps long lines would
break silently and only here.

## Escaping

One paragraph per character, each written `a\Xb`, twenty nine characters.

**The backslash was consumed for all of these**, meaning the escape works:

```
\ ` * _ { } [ ] ( ) # + - . ! | ^ $ % = < > & : " ' @ /
```

**It failed for exactly one**, leaving the backslash plainly visible:

```
~     rendered as \~
```

This is narrower than rentry, where the backslash also fails for `^` and `$`.
The compiler emits numeric character references for all three regardless, which
is correct on both hosts and was confirmed here:

| Source | Rendered |
|---|---|
| `price &#36;45` | `price $45` |
| `&#126;tilde` | `~tilde` |
| `&#94;caret` | `^caret` |
| `&#126;&#126;not struck&#126;&#126; but ~~this is~~` | `~~not struck~~ but <del>this is</del>` |

That last row is the one that matters: the entity form stays literal text while
a real doubled tilde is still struck through, so the escape removes the
character from the source without removing the seller's ability to use the
construct on purpose.

## Percent signs, checked because this host has a colour construct

text.is implements `%red%text%%` and `%#AABBCC%text%%`. Prices contain
percentages, so this was worth probing rather than assuming.

| Source | Rendered |
|---|---|
| `50% off, 25% deposit, %red%red text%%` | `50% off, 25% deposit, <span class="color-change" style="color:red">red text</span>` |

A bare percentage is safe: the construct needs a colour name or hex between the
delimiters, and "` off, 25`" is not one. No escaping was added for `%`, and this
row is the reason that decision is recorded rather than merely made.

## What was not tested

- Whether the published page sanitizes differently from this preview endpoint.
  Everything above is the renderer the published pages use, but a publish was
  not compared byte for byte against a preview.
- Image handling, footnotes, admonitions, and the `[TOC]` family. No emitter in
  this build uses them, and a capability with no consumer is a guess written
  down.
