# Data Model: The Setup Wizard

**Feature**: 027 | **Date**: 2026-09-08

## The headline: nothing here is persisted

**This feature adds no field to the schema and no store to the database.**
`SCHEMA_VERSION` stays at 5 and there is no migration. The parity snapshot must
not move, and a diff to `engine/tests/document/parity.snapshot.json` in this
feature's branch is a defect, not a step.

That is not a happy accident. The spec's audit checked all ten of Jakob's
questions against the contract and every answer already had somewhere to go,
which is why 026 was carved out and landed first. If a question turns out during
implementation to need a field that does not exist, **stop and specify it
separately** rather than growing the schema inside a surface feature.

## The answer set

Held in memory while the wizard is open, and gone the moment it closes. It is
not a document, it has no version, nothing outside the wizard reads it, and it
is never written to IndexedDB.

| Field | Type | Optional | Becomes |
|---|---|---|---|
| `sells` | one of the eight starter ids, or `other` | yes | which starting point is opened |
| `storeName` | string | yes | `profile.displayName`, and `document.title` |
| `wantsPicture` | boolean | yes | whether the About you section keeps its avatar field prompt |
| `firstItem` | string | yes | `tier.name` on the first row |
| `firstPrice` | string | yes | `tier.price` on the first row |
| `mode` | one of `in-stock`, `made-to-order`, `preorder`, `sold-out` | yes | `tier.availability` |
| `amount` | string | yes | `tier.unit` |

Every field is optional, because FR-120 makes every question skippable and
FR-127 requires that answering nothing still produces a usable page.

`mode` takes its four values from the contract rather than restating them. They
are `tier.availability`'s enum as of feature 026, and the words shown to a person
come from `SELLING_MODE_WORDS`, which the engine exports for exactly this reason:
so the word somebody picks is the word their page prints.

## What it becomes

```text
answer set  ->  a Document  ->  serializeDocument  ->  openBackup  ->  a new page
```

One direction only. Nothing reads back out of a page into an answer set, because
editing a finished page through the wizard is out of scope.

### Rules the transformation must follow

1. **An empty answer set produces the chosen starter, unchanged.** Byte
   identical to opening it from the picker. This is a test, not an intention.
2. **The store name goes to `profile.displayName`.** Writing it only to
   `document.title` is the defect FR-121 exists to prevent: `title` is never
   compiled and the editor labels it "Only you see this". Setting `title` as
   well is correct and useful, because it is how the page is listed in the
   sidebar.
3. **A skipped question leaves the starter's own content in place.** It does not
   write an empty string. An absent optional field and an empty one must not
   come to mean the same thing, which is the rule `withOptional` exists for and
   the one every migration in this project is written around.
4. **The first item is written to the starter's first tier**, replacing what the
   starter had there. It does not append a second row and leave a placeholder
   above it.
5. **Everything typed is escaped on the way out** by the same path every other
   authored string uses. The wizard does not build Markdown and must never
   contain a string template that produces any.
6. **A starter with no menu section takes no item.** "Portfolio and about me"
   ships with no prices at all, deliberately. If somebody picks it and then
   names an item, the item is dropped rather than a Prices section being
   invented, and this is stated so the behaviour is chosen rather than
   discovered.

## Store state

Added to `State`, alongside `sidebarOpen` from feature 025 and following it
exactly:

| Field | Type | Why |
|---|---|---|
| `wizardOpen` | boolean | whether the layer is up |
| `wizardStep` | integer | which question is showing |
| `wizardAnswers` | the answer set above | what has been said so far |

All three go on the **immediate `set` path**, not the deferred one. `sidebarOpen`
is on the immediate path for the same reason: a surface that appears one repaint
after the press reads as a dead button.

None of this is persisted. Closing the app mid wizard loses the answers, and
that is correct: nothing was created, so there is nothing to come back to.

## Entities NOT added

Recorded so a later reader does not go looking:

- **No wizard record in IndexedDB.** An abandoned wizard must leave nothing
  behind, and the cheapest way to guarantee that is to never write anything.
- **No ninth starting point.** FR-122. The wizard picks from the eight.
- **No new block kind.** Everything it produces is `profile`, `heading`, `menu`,
  `gallery`, `prose` or `divider`, which is all there is.
