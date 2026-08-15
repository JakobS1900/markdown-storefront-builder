# Host verification: what these services actually render

Date: 2026-08-14
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

## Open item

A second and third target still need to be chosen and verified. See the
recommendation raised with Jakob on 2026-08-14 about using a strict
CommonMark/GFM baseline as the second target rather than another individual
site.
