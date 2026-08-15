# Public Contract: `@mdsb/engine` document module

**Feature**: 001-document-contract
**Date**: 2026-08-15

This is the surface every other part of the product uses. Nothing outside this
module may construct, parse, or serialize a page by hand.

## Exports

```ts
export const SCHEMA_VERSION: 1;

export type Document = { /* see data-model.md */ };
export type Block = /* tagged union on `kind` */;

export type IssueCode =
  | "not_an_object"
  | "invalid_json"
  | "missing_field"
  | "wrong_type"
  | "null_not_allowed"
  | "unknown_field"
  | "unknown_kind"
  | "duplicate_id"
  | "empty_string_not_allowed"
  | "out_of_range"
  | "not_in_enum"
  | "version_missing"
  | "version_malformed"
  | "version_too_new";

export interface Issue {
  code: IssueCode;
  path: string;        // e.g. "blocks[2].tiers[0].name"
  blockId?: string;    // present whenever the issue is inside a block
  message: string;     // written for an artist, not a developer
}

export type ValidationResult =
  | { ok: true; document: Document }
  | { ok: false; issues: Issue[] };

/** Validate an already-parsed value. Never throws. */
export function validateDocument(input: unknown): ValidationResult;

/** Parse JSON text and validate it. Never throws. Invalid JSON is an issue. */
export function parseDocument(json: string): ValidationResult;

/** Serialize canonically: keys in descriptor order, stable across runs. */
export function serializeDocument(doc: Document): string;

/** An empty, valid page targeting the given host. */
export function emptyDocument(target: string): Document;
```

## Guarantees

These are the properties the tests assert, and they are what consumers may rely
on.

**G1. Never throws.** `validateDocument` and `parseDocument` return a result for
every possible input, including `undefined`, cyclic structures, and text that is
not JSON. A thrown exception from either is a defect, not an error report.

**G2. Round trip is lossless.** For any `doc` where `validateDocument(doc).ok` is
true, parsing its serialization yields a document deeply equal to `doc`,
including the presence or absence of every optional field.

**G3. Serialization is stable.** `serializeDocument(doc)` returns identical bytes
every time it is called, in any process, regardless of the order in which the
object's keys were assigned.

**G4. Validation is total.** A rejected document reports every problem found, not
the first. Two independent problems produce two issues.

**G5. Nothing is mutated.** Neither function modifies its input. A rejected
document is returned untouched to the caller, and no stored page is written
during validation.

**G6. A future version is refused, not guessed.** A page whose `schemaVersion`
exceeds `SCHEMA_VERSION` produces exactly one issue with code `version_too_new`,
and no attempt is made to read its contents.

## Consumers, and what they may assume

| Consumer | Uses | May assume |
|---|---|---|
| The compiler (1.2 onward) | `Document` type | It receives a validated document. It never re-validates. |
| Storage (2.1) | `serializeDocument`, `parseDocument` | Round trip is lossless and stable. |
| Export and import (2.4) | `serializeDocument`, `parseDocument` | Two exports of one page are byte-identical. |
| The editor (2.2) | `emptyDocument`, `Document` type | A new page is valid from the moment it is created. |

## Stability

The schema descriptor is snapshotted by the parity test. Any change to a field
name, a field type, or field order fails the build. Changing it is therefore a
deliberate act that includes updating the snapshot and, where the change is not
backward compatible, incrementing `SCHEMA_VERSION` and adding a migration.
