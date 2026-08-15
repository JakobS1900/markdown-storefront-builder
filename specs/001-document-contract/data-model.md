# Phase 1 Data Model: The Document Contract

**Feature**: 001-document-contract
**Date**: 2026-08-15

Field order below is normative. The descriptor is ordered, the canonical writer
emits in this order, and the parity test fails if it changes.

## Document

The whole page. The root object.

| # | Field | Type | Required | Notes |
|---|---|---|---|---|
| 1 | `schemaVersion` | integer | yes | Exactly `1` for this release. Refused if greater than the running version. |
| 2 | `target` | string | yes | Non-empty. Names the chosen host. Not checked against a registry, see research D5. |
| 3 | `title` | string | no | The page title. May be an empty string, which is distinct from absent. |
| 4 | `blocks` | array of Block | yes | May be empty. Order is authored order and is preserved exactly. |

## Block

A tagged union. `kind` selects the variant. Every block carries `id` and `kind`
first, in that order, then its own fields.

Common to every variant:

| # | Field | Type | Required | Notes |
|---|---|---|---|---|
| 1 | `id` | string | yes | Non-empty. Unique within the page. Opaque to everything downstream. |
| 2 | `kind` | string | yes | One of the six kinds below. Any other value is invalid. |

### `heading`

| # | Field | Type | Required | Notes |
|---|---|---|---|---|
| 3 | `text` | string | yes | May be empty. |
| 4 | `level` | integer | yes | 1 to 6 inclusive. |

### `divider`

No fields beyond `id` and `kind`.

### `prose`

| # | Field | Type | Required | Notes |
|---|---|---|---|---|
| 3 | `heading` | string | no | Optional section heading. |
| 4 | `text` | string | yes | The body. Deliberately narrow rich text, whose inline grammar is defined in 1.3, not here. Stored verbatim. |

### `menu`

| # | Field | Type | Required | Notes |
|---|---|---|---|---|
| 3 | `heading` | string | no | |
| 4 | `currency` | string | no | Free text, for example `USD` or `$`. Not validated against a currency list. |
| 5 | `tiers` | array of MenuTier | yes | May be empty. Order preserved. |
| 6 | `addOns` | array of MenuAddOn | no | Order preserved. |

**MenuTier**

| # | Field | Type | Required |
|---|---|---|---|
| 1 | `name` | string | yes |
| 2 | `price` | string | yes |
| 3 | `blurb` | string | no |
| 4 | `includes` | array of string | no |
| 5 | `imageUrl` | string | no |

`price` is a string, not a number. Artists write "45", "from 45", "45+", and
"DM me". Forcing a number would either reject real prices or silently discard
what they wrote.

**MenuAddOn**

| # | Field | Type | Required |
|---|---|---|---|
| 1 | `name` | string | yes |
| 2 | `price` | string | yes |

### `gallery`

| # | Field | Type | Required | Notes |
|---|---|---|---|---|
| 3 | `heading` | string | no | |
| 4 | `layout` | string | yes | One of `grid`, `list`, `single`. |
| 5 | `items` | array of GalleryItem | yes | May be empty. Order preserved. |

**GalleryItem**

| # | Field | Type | Required | Notes |
|---|---|---|---|---|
| 1 | `imageUrl` | string | yes | Non-empty. Always an address. Image data is never stored in a page. |
| 2 | `caption` | string | no | |
| 3 | `linkUrl` | string | no | |

### `profile`

| # | Field | Type | Required | Notes |
|---|---|---|---|---|
| 3 | `displayName` | string | yes | |
| 4 | `avatarUrl` | string | no | |
| 5 | `tagline` | string | no | |
| 6 | `status` | string | no | One of `open`, `closed`, `waitlist` when present. |
| 7 | `links` | array of ProfileLink | no | Order preserved. |
| 8 | `paymentMethods` | array of string | no | Order preserved. |

**ProfileLink**

| # | Field | Type | Required |
|---|---|---|---|
| 1 | `label` | string | yes |
| 2 | `url` | string | yes |

## Validation rules

Derived from the requirements, each one testable.

1. The input is an object. Anything else, including an array, a string, or
   invalid JSON, is refused. (Edge cases)
2. `schemaVersion` is present and an integer. Missing, malformed, or
   non-numeric is refused. (FR-001)
3. `schemaVersion` greater than the running version is refused with a distinct
   code, and nothing is modified. (FR-004)
4. `schemaVersion` less than the running version is migrated forward. No
   migrations exist yet. (FR-005)
5. Every required field is present and of the declared type. (FR-002)
6. Any field not in the descriptor is refused, naming the field and its block.
   (FR-017)
7. `null` is never a valid value anywhere. (Research D4)
8. An absent optional field stays absent. It is never defaulted into existence.
   (FR-010)
9. `kind` is one of the six known kinds. Anything else is refused rather than
   ignored. (Assumptions)
10. `id` is non-empty and unique within the page. Duplicates are refused, naming
    both offenders. (FR-009)
11. `level` is an integer from 1 to 6. (Type rule)
12. `layout` is one of `grid`, `list`, `single`. (Type rule)
13. `status`, when present, is one of `open`, `closed`, `waitlist`. (Type rule)
14. `target` is a non-empty string. It is not checked against a registry.
    (FR-015, research D5)
15. `blocks` may be empty and the page is still valid. (FR-016)
16. All problems are collected. Validation never stops at the first, and never
    throws. (FR-002)
17. Every issue carries a path, the enclosing block identifier when there is
    one, a stable code, and a human sentence. (FR-003, SC-006)

## What is deliberately not here

- Whether `target` names a host that exists. That is a compile diagnostic in
  1.2. See research D5.
- The inline grammar of `prose.text`. That is 1.3, where the sanitizer and the
  narrow gate land with it.
- Whether an `imageUrl` resolves or is reachable. That is a runtime concern in
  the app, not a property of a valid page.
- Any limit on page size. Storage exhaustion is handled where storage is, in
  2.1.
