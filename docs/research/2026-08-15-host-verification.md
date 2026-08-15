# Host verification: what these services actually render

Date: 2026-08-15
Status: First pass. Feeds the capability matrix and the golden fixtures.

## Method

Checked published documentation and live endpoints rather than relying on
assumption. Anything not verified is marked as such.

## rentry.co: CONFIRMED Markdown renderer

Source: https://rentry.co/how

| Capability | Support | Syntax |
|---|---|---|
| Headings | Yes, 6 levels | `#` through `######` |
| Tables | Yes, with alignment | `Header \| Header`, separator `------ \| ------`, right `--:`, centre `:--:` |
| Nested lists | Yes, documented as unlimited depth | 4 spaces or 1 tab per level |
| Images | Yes, with sizing | `![Alt](url){100px:100px}`, units px, %, vw, hw, or none |
| Table of contents | Yes | `[TOC]`, `[TOC2]`, `[TOC3]` |
| Code blocks | Yes, with language | triple backticks plus language name |
| Links | Yes, scheme required | `[text](https://url)`, docs insist on including `http(s)://` |
| Raw HTML | Not documented as supported | treat as unsupported until tested |
| Footnotes | Not documented | treat as unsupported until tested |
| Size limit | Not documented | needs live testing |

**Two of these are rentry-specific extensions, not standard Markdown:** image
sizing `{100px:100px}` and the `[TOC]` family. Both will render as literal text
on any host that does not implement them. This is precisely the divergence the
compiler exists to handle, and it validates the core premise of the design.

## Plain-text paste sites: NOT Markdown renderers

Pastebin, Hastebin, and Ghostbin display pastes as plain text with optional
syntax highlighting. Markdown pasted there shows literal asterisks. They are not
dialect variants of the same problem and remain out of scope, as recorded in the
design.

## txt.is: could not verify

`https://txt.is/` refused the connection (ECONNREFUSED) at time of check. Cannot
confirm whether it renders Markdown. Not a candidate for a v1 target on current
evidence: a target whose renderer we cannot verify is one whose fixtures we
cannot validate.

## Target set: DECIDED 2026-08-15

**Target one: `rentry`.** The host the commission scene actually uses. Verified
above.

**Target two: `portable`.** A strict CommonMark plus GFM tables baseline, not an
individual site. Chosen over hunting for a second host because:

- It is defined by a written specification, so we validate against a standard
  rather than reverse-engineering someone's deployment.
- It cannot go offline, change its renderer, or refuse our connection the way
  `txt.is` did.
- It is what an artist actually wants when moving hosts or when they do not know
  what their host runs: "give me the version that works everywhere."
- It is the target that catches rentry extensions leaking, because every rentry
  extension is by definition absent from it.

No third target in v1. Adding one later is a target record plus fixtures, which
is the whole point of the design.
