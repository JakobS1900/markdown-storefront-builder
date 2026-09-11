# Data Model: Formatting Buttons Over a Text Section

## The document schema does not change

`SCHEMA_VERSION` stays **5**. `engine/tests/document/parity.snapshot.json` must
not move by a single byte, and that is the sharpest available proof that this
feature is a surface plus a grammar rather than a contract change.

A `prose` block keeps exactly the two fields it has had since feature 001:

| Field | Type | Required |
|---|---|---|
| `heading` | string | no |
| `text` | string | yes |

The marks live inside `text` as the characters the seller can already type.
That was feature 008's decision and the reasoning still holds, quoted from
`inline.ts`:

> A contract change would mean a schema version, a migration, and a new editor
> surface for something artists already know how to type.

**If anything in this feature appears to need a new field, stop and specify it
separately**, the way 026 was carved out of 027 rather than grown inside it.

## The contract that does change: `Capabilities`

This is the only cross-boundary record this feature touches, and per
`CLAUDE.md` it lands first and alone.

| Field | Type | Fallback when absent |
|---|---|---|
| `strikethrough` | boolean | the words are published plain, unmarked, and a diagnostic names the section |
| `highlight` | boolean | the words are published plain, unmarked, and a diagnostic names the section |

Every capability must have a declared fallback, and a capability with no
consumer is a guess written down. Both are consumed by `emitInline`, and each
fallback gets a test that proves what happens when a host lacks it.

### Values, one per target, every one cited

| Target | `strikethrough` | `highlight` | Basis |
|---|---|---|---|
| `rentry` | true | true | observed 2026-09-11 at the host's own renderer, and documented at `rentry.co/how` |
| `text.is` | true | true | observed 2026-09-11 at the host's own renderer |
| `portable` | false | false | the declared baseline is CommonMark plus GFM tables, and neither mark is in it. Absence is the safe direction |
| `menu-file` | true | true | observed in our own renderer, which is the thing that displays that file |

`Target.sources` is `Readonly<Record<keyof Capabilities, string>>`, so these
citations are not optional. Adding the two fields without writing all eight
sentences does not type-check. That is the design enforcing FR-028-15 rather
than a reviewer having to.

## The diagnostic

One new code on `DiagnosticCode`, shaped like the `local_image_unsupported` that
feature 024 added:

| Property | Value |
|---|---|
| `code` | `mark_unsupported` |
| `severity` | `warning` |
| `blockId` | the section the marked words are in, so the app can point at it |
| `capability` | `strikethrough` or `highlight`, so the message can say which |
| `message` | written for the seller, naming the mark and the host |

**The message must not quote the seller's words back.** FR-081 already
established that for `local_image_unsupported`: a warning is somewhere a seller
might screenshot.

## The inline grammar

Two additions to the `Node` union in `engine/src/compile/inline.ts`:

| Kind | Children | Marker written by the emitter |
|---|---|---|
| `strike` | nodes | `~~` |
| `highlight` | nodes | `==` |

The union remains closed and remains the whole of what a seller can produce.
Nothing is passed through; every piece of text still reaches the output through
`escapeText` and every marker in the output is written by `emitInline`.

**The tilde is the reason this works rather than an accident.** `escapeText`
forces `~` to `&#126;` because rentry consumes a backslash before it, verified
on 2026-08-31 and again on 2026-09-11. So seller text can never contain a live
tilde, and a real `~~` in the output can only have come from the emitter. The
new `=` rule gives the equals sign the same property.

## What must be byte for byte identical afterwards

- `engine/tests/document/parity.snapshot.json`, entirely.
- Every golden file for every target, except where a fixture uses one of the two
  new marks. FR-028-21.
- Every one of the eight starting points and the bundled example, compiled for
  all four targets. This is the same measurement feature 026 made, and the same
  command produces it.
