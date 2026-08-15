# Phase 1 Data Model: The Compile Skeleton

**Feature**: 002-compile-skeleton
**Date**: 2026-08-15

## Target

A supported host, described entirely as data. Adding one is a new record.

| Field | Type | Notes |
|---|---|---|
| `id` | string | Stable identifier stored in a page's `target` field |
| `name` | string | Human name, for the target switcher |
| `capabilities` | Capabilities | What this host can do |
| `sources` | record of string | Per capability, where the value came from. FR-014 |

## Capabilities

Only the capabilities this feature's emitters consult. Each later emitter adds
the ones it needs, together with the fixtures that prove its fallback.

| Capability | Type | Meaning | Fallback when absent or lower |
|---|---|---|---|
| `maxHeadingLevel` | integer 1 to 6 | Deepest heading level the host renders | Emit at the deepest supported level, warn (research D3) |
| `thematicBreak` | string | The exact text this host renders as a separator | None needed. Every Markdown renderer supports one form |
| `escapeStyle` | enum `commonmark` | Which escaping rules apply to artist text | Not optional. Text is always escaped |
| `maxBytes` | integer or absent | Stated size limit for one page | Warn when exceeded, return output in full (research D7) |

## The two targets in this release

### `portable`

The baseline that works anywhere: strict CommonMark plus GFM tables. Defined by
specification rather than by a deployment, so it cannot change under us or go
offline.

| Capability | Value | Source |
|---|---|---|
| `maxHeadingLevel` | 6 | CommonMark specification, ATX headings are 1 to 6 |
| `thematicBreak` | `---` | CommonMark specification, thematic break |
| `escapeStyle` | `commonmark` | CommonMark specification, backslash escapes |
| `maxBytes` | absent | Not a property of a specification |

### `rentry`

| Capability | Value | Source |
|---|---|---|
| `maxHeadingLevel` | 6 | rentry.co/how, documents `#` through `######` |
| `thematicBreak` | `---` | Standard Markdown, unchanged by rentry |
| `escapeStyle` | `commonmark` | No documented divergence from standard escaping |
| `maxBytes` | absent | rentry.co/how documents no limit. Recorded as unknown rather than guessed |

The two targets are deliberately near identical at this stage. Their divergence
appears with the emitters that use rentry's extensions, image sizing and the
table of contents family, which arrive in 1.4 and 1.5. The mechanism that will
express that divergence is proved here, on capabilities simple enough to verify
by eye.

## CompileResult

| Field | Type | Notes |
|---|---|---|
| `markdown` | string | The compiled text. LF line endings, single trailing newline |
| `diagnostics` | array of CompileDiagnostic | Every compromise made. Empty when none |
| `targetId` | string | The target actually used, which differs from the requested one when it fell back |

## CompileDiagnostic

| Field | Type | Notes |
|---|---|---|
| `code` | string | Stable code, so the app can specialise without parsing English |
| `severity` | enum `info`, `warning` | `warning` when the page will not render as authored |
| `blockId` | string, optional | The section affected. Absent for page-level diagnostics |
| `capability` | string, optional | Which capability caused it |
| `message` | string | Written for the artist |

### Codes in this release

| Code | Severity | Raised when |
|---|---|---|
| `unknown_target` | warning | The page names a host this build does not know. Fell back to portable |
| `heading_level_reduced` | warning | A heading was deeper than the host supports |
| `size_limit_exceeded` | warning | Output is larger than the host's stated limit |

## Emitter rules in this release

1. Blocks are emitted in page order, joined by exactly one blank line.
2. The document ends with exactly one newline. An empty page compiles to an
   empty string. (Research D4)
3. `heading` emits `#` repeated to its level, a space, then its escaped text.
4. A heading deeper than `maxHeadingLevel` emits at `maxHeadingLevel` and raises
   `heading_level_reduced`. (FR-012)
5. Heading text has newlines collapsed to spaces, because a newline would end
   the heading and turn the rest into body text.
6. `divider` emits the target's `thematicBreak`.
7. All artist text is escaped per `escapeStyle` before emission. (FR-009)
8. Escaping MUST make it impossible for artist text to alter the structure of
   the surrounding page. (FR-010, SC-006)
9. An unknown target compiles against `portable` and raises `unknown_target`.
   (FR-008)
10. Output exceeding `maxBytes` raises `size_limit_exceeded` and is returned in
    full, never truncated. (FR-015, research D7)
11. `compile` never throws for a valid page and any target identifier. (FR-002)

## What is deliberately not here

- Emitters for `prose`, `menu`, `gallery`, and `profile`. Roadmap 1.3 to 1.6.
- The sanitizer and the preview. That is 1.3, and it concerns the DOM rather
  than the emitted text.
- Any capability no emitter in this release consults. A capability with no
  consumer and no fallback test is a guess written down.
- Publishing, uploading, or contacting a host in any way.
