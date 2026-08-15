# Quickstart: The Document Contract

**Feature**: 001-document-contract

## Run it

All npm commands run from PowerShell, not the Bash tool. See `CLAUDE.md` for
why.

```powershell
npm install
npm run verify      # typecheck, lint, test, secret scan, a11y gate
npm test            # tests alone, while iterating
```

## Where things live

```text
engine/
  src/document/
    descriptor.ts     the ordered schema descriptor, the single source of truth
    types.ts          types derived FROM the descriptor via `as const`
    validate.ts       validateDocument, parseDocument
    serialize.ts      serializeDocument, canonical key order
    migrate.ts        the forward migration registry, empty at version 1
    empty.ts          emptyDocument
    index.ts          the public surface, re-exported from engine/src/index.ts
  tests/document/
    parity.test.ts        fails if a field name, type, or order changes
    parity.snapshot.json  the checked-in schema shape
    roundtrip.test.ts     lossless round trip, including absent versus empty
    serialize.test.ts     stable bytes, descriptor key order
    validate.test.ts      every validation rule in data-model.md
    version.test.ts       future version refused, migration registry
    performance.test.ts   the SC-005 guard
    fixtures/             valid and invalid pages
```

## The one thing to understand first

`descriptor.ts` is the schema. The validator walks it, the writer emits keys in
its order, and the parity test snapshots it.

That means you do not change the shape of a page by editing a type. You change
`descriptor.ts`, and the type follows. If you edit only the type, the validator
and the writer will not agree with it, and the tests will say so.

## Adding a field, the whole procedure

1. Add it to `descriptor.ts` in the position it should occupy.
2. Nothing to do in `types.ts`. The types are derived from the descriptor, so
   the new field appears in them automatically. If you find yourself editing a
   type by hand to make something compile, the derivation is broken and that is
   the bug to fix.
3. Run `npm test`. The parity test fails, because that is its entire job.
4. Read the diff it prints. Confirm the change is what you meant.
5. Update `parity.snapshot.json`.
6. If the change can make an existing saved page invalid, it is not backward
   compatible. Increment `SCHEMA_VERSION`, add a migration in `migrate.ts`, and
   add a fixture for the version step.

Step 3 failing is the mechanism working. It is not an obstacle to route around.

## What this feature does not do

It does not compile anything to Markdown, does not know what a host is, does not
touch storage, and has no user interface. It defines the shape everything else
agrees on, and proves that shape survives a round trip.
