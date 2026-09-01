# Feature Specification: A Third Host, and a File That Is Not a Host

**Feature Branch**: none, straight onto master.
**Status**: Specified alongside implementation on 2026-09-01. The research came
first, and it changed the plan, which is recorded below rather than tidied away.
**Input**: The owner: "sites like text dot i s. Sounds like paste bin, sites
like ghost bin. I want to make sure that this, or even just making normal
markdown files. I want to make it so now it branches out a bit."

## Four candidates, two of which do not exist

Each was investigated before anything was built, because FR-014 says a
capability value must be observed or documented and never assumed. Two of the
four cannot satisfy that rule at any effort.

**text.is: added.** Alive, maintained, free, no account, custom URLs and edit
codes. Every capability observed on 2026-09-01 by driving the host's own
renderer, recorded in `docs/research/2026-09-01-textis-verification.md`.

**ghostbin: refused.** `ghostbin.com` has been behind a Cloudflare interstitial
since 2022. `ghostbin.co` is alive under a new name and its language list does
include Markdown, but every attempt to create a paste returned HTTP 502 across
five tries, with form-encoded and multipart bodies, with a session cookie and
correct Origin and Referer. Reads work, so it is a broken write path rather
than a block. Its Markdown behaviour is recoverable from the archived engine
source, and source is not observation. **A host that cannot be published to
cannot be verified, and this project does not ship values it has not seen.**

**pastebin.com: refused.** Markdown is a paid feature. The syntax selector
carries `Markdown (PRO members only)` and the option is marked `disabled`. Not
a technical limitation and not one to work around.

**Plain `.md` files: already shipped, and wrong.** The export surface has had a
"Save as a file" button since feature 007. It handed over the output compiled
for whichever host was selected, so saving a file while rentry was picked gave
a file carrying rentry's dialect. See below, because the fix is not the one
that was planned.

## The research changed the plan, twice

Recorded because in both cases the wrong answer would have shipped quietly.

**The family resemblance.** text.is and rentry both run Python-Markdown behind
django-markdownx, and the first pass proposed copying rentry's capability
values across. They are not the same host. A trailing backslash is inert on
rentry and destructive on text.is, and the set of characters a backslash cannot
protect is three on rentry and one on text.is. Only the escaping machinery
already in place made that harmless.

**The plan for the `.md` file was backwards.** The intent was to compile the
file against the portable baseline, on the reasoning that a file is not a host.
That reasoning is right. What it would have produced was worse than the bug:
portable emitted the CommonMark backslash hard break, which is exactly the form
text.is destroys. Saving a file and pasting it into text.is would have joined
sentences into single words.

## What is being changed

**FR-034**: text.is is a selectable host, with every capability citing its own
observation.

**FR-035**: the `.md` download MUST compile against the portable baseline
rather than the selected host. A file is not a host. It goes to GitHub, to
Obsidian, to a text editor, or to a different paste site next year, and none of
those is the site the seller happened to have selected.

**FR-036**: the portable baseline MUST use two trailing spaces for a hard line
break, not the CommonMark backslash.

FR-036 is the substantive change and it deserves its argument, because it
reverses a documented decision. The backslash was chosen because CommonMark
names it and because trailing whitespace is invisible and gets stripped by
editors. Both points stand. But the target is named "Portable (works
anywhere)", and of the three hosts this project has ever verified, the
backslash is a working hard break on none:

| Host | Backslash | Two spaces |
|---|---|---|
| rentry | swallowed, no break | break |
| text.is | destructive, joins the words | break |
| CommonMark, GitHub, VS Code | break | break |

Two trailing spaces are equally valid CommonMark. The cost is accepted and
named: an editor that strips trailing whitespace silently removes the break.
That loses a line break. The backslash form loses the space between two words
on somebody's published page, which is both more visible and more embarrassing.

## What is deliberately not being changed

**The escaper.** text.is turned out to need less escaping than rentry, not
more, and the entity treatment for `~`, `^` and `$` was confirmed correct on
it. Narrowing the escaper per host would be a real improvement in source
readability and no improvement at all in what a reader sees, at the cost of
another dimension for every escaping test to cover.

**Nothing for `%`.** text.is has a `%red%text%%` colour construct, and prices
contain percentages, so it was probed rather than assumed: `50% off, 25%
deposit` renders literally, because the construct needs a real colour between
the delimiters. Recorded so the absence of escaping is a decision.
