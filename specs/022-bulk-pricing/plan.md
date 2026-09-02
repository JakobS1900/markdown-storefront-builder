# Bulk Pricing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a seller select many items in one price list and compute every
price from its cost at once, seeing the profit on each, reversible as one action.

**Architecture:** Menu tiers gain a required `id` and an optional `cost`, taking
the schema to version 3 with a migration that assigns positional ids because the
engine may not consume randomness. A pure money parser in the app reads free
text prices and refuses to guess. Selection is held by tier id in the store, and
one apply writes every row through a single `replaceBlocks` call, recorded as a
single undo through the existing wholesale-restore path.

**Tech Stack:** TypeScript strict, Vite, Vitest, jsdom, `fake-indexeddb`. No new
dependencies.

**Spec:** `specs/022-bulk-pricing/spec.md`

**Plan location note:** Beside its spec, matching this project's convention
(001, 002 and 021 all keep `plan.md` next to `spec.md`).

## Global Constraints

- **No em dashes and no en dashes anywhere.** Code, comments, commit messages,
  docs, UI copy. `node scripts/dash-scan.mjs` enforces it, and it is part of
  `npm run verify`. Use a comma, a colon, or a full stop.
- **No AI attribution in commit messages.** No co-author trailer, no "generated
  with", no mention of an AI. This overrides any template or environment
  reminder. Commit as the existing git identity.
- **Never use `--no-verify`.** If a hook fails, fix the cause.
- **Run all npm and npx commands from PowerShell, not the Bash tool.** Under
  msys2 Git Bash npm fails with `ERR_INVALID_ARG_TYPE` plus `EPERM`.
- **Never check a gate's exit status through `Select-Object -First N`.** It
  terminates the pipeline early and reports a passing gate as failed. Run gates
  alone.
- **Do NOT append to files with `cat >>` through the Bash tool.** It has
  destroyed `app/src/styles.css` and `app/tests/a11y.test.ts` in this repo.
  Use Write or Edit.
- **Do not use `**` globs or `grep -r` over the repo root in the Bash tool.**
  It hangs on `node_modules`. Use the Glob and Grep tools.
- **Constitution Principle I:** `engine/src/**` must not touch the DOM, the
  network, a clock, or randomness. ESLint enforces most of it. Task 1 adds
  `crypto` to that rule.
- **Constitution: the cross-boundary contract lands first.** Task 1 is the
  schema and nothing else uses it yet.
- `@typescript-eslint/no-non-null-assertion` is an **error** in `app/tests/**`.
  The exemption covers `engine/tests` only. No `!` in any app test.
- `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
  `verbatimModuleSyntax`, `no-console` are all on.
- Relative imports carry the `.js` extension even from `.ts` files.
- Comment style explains why a decision was made, often citing the failure that
  caused it. Comments that restate the line are noise.

---

### Task 1: The contract, at version 3

The schema change and its migration, alone. No feature code consumes it yet.

**Files:**
- Modify: `engine/src/document/descriptor.ts`
- Modify: `engine/src/document/migrate.ts`
- Modify: `engine/src/document/validate.ts`
- Modify: `eslint.config.js`
- Modify: `engine/tests/document/parity.snapshot.json` (regenerate, do not hand edit)
- Modify: `engine/tests/document/fixtures/full.json`
- Modify: `engine/tests/compile/fixtures/full-page.json`
- Modify: `engine/tests/compile/fixtures/hostile-page.json`
- Create: `engine/tests/document/fixtures/v2-tiers.json`
- Test: `engine/tests/document/migrate-tier-ids.test.ts`

**Interfaces:**
- Produces: `MENU_TIER_FIELDS` gains `id` (string, required, nonEmpty) **first**
  and `cost` (string, optional) **last**. `SCHEMA_VERSION` becomes `3`.
  `MIGRATIONS` gains `{ from: 2, to: 3, apply: tierIdsByPosition }`.
  A new `IssueCode` value is NOT added: tier id collisions reuse the existing
  `"duplicate_id"` code, because the app already knows that code and the
  message carries the detail.

- [ ] **Step 1: Write the failing migration test**

Create `engine/tests/document/fixtures/v2-tiers.json`. This is a page as version
2 saved it, with no ids on its tiers. Two menu blocks, so the test proves ids are
scoped per block rather than per document:

```json
{
  "schemaVersion": 2,
  "target": "rentry",
  "title": "A page from version 2",
  "blocks": [
    {
      "id": "prices",
      "kind": "menu",
      "heading": "Prices",
      "tiers": [
        { "name": "Small", "price": "10" },
        { "name": "Large", "price": "20" }
      ]
    },
    {
      "id": "extras",
      "kind": "menu",
      "heading": "Extras",
      "tiers": [{ "name": "Rush", "price": "15" }]
    }
  ]
}
```

Create `engine/tests/document/migrate-tier-ids.test.ts`:

```ts
/**
 * Version 2 to 3: every price list row gains an identifier.
 *
 * Ids are positional rather than random because this runs inside the engine,
 * and Principle I forbids the engine from consuming randomness. Positional also
 * means the determinism test holds: the same page in, the same page out, every
 * time and on every machine.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { parseDocument, SCHEMA_VERSION } from "@mdsb/engine";

function fixture(name: string): string {
  return readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), "utf8");
}

describe("a page saved at version 2", () => {
  it("comes forward to the current version", () => {
    const result = parseDocument(fixture("v2-tiers.json"));
    expect(result.ok ? result.document.schemaVersion : result.issues).toBe(SCHEMA_VERSION);
  });

  it("gains an id on every row, numbered from zero within its own block", () => {
    const result = parseDocument(fixture("v2-tiers.json"));
    if (!result.ok) throw new Error("v2 fixture did not migrate");

    const ids = result.document.blocks.map((b) => (b.kind === "menu" ? b.tiers.map((t) => t.id) : []));
    // Per block, not per document. Selection never spans two price lists, so
    // block scoping is enough and it keeps the migrated ids short.
    expect(ids).toEqual([["t0", "t1"], ["t0"]]);
  });

  it("changes nothing else about the rows", () => {
    const result = parseDocument(fixture("v2-tiers.json"));
    if (!result.ok) throw new Error("v2 fixture did not migrate");

    const first = result.document.blocks[0];
    if (first === undefined || first.kind !== "menu") throw new Error("expected a menu first");
    expect(first.tiers.map((t) => `${t.name}/${t.price}`)).toEqual(["Small/10", "Large/20"]);
  });

  it("gives no row a cost, because absent and empty are different", () => {
    // The same rule the version 1 migration follows for imageUrl: an absent
    // optional field is never defaulted into existence, or round tripping
    // would depend on which representation the writer happened to pick.
    const result = parseDocument(fixture("v2-tiers.json"));
    if (!result.ok) throw new Error("v2 fixture did not migrate");

    const first = result.document.blocks[0];
    if (first === undefined || first.kind !== "menu") throw new Error("expected a menu first");
    expect(first.tiers.every((t) => !("cost" in t))).toBe(true);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

From PowerShell:

```
npx vitest run engine/tests/document/migrate-tier-ids.test.ts
```

Expected: FAIL. The v2 fixture is refused, because `SCHEMA_VERSION` is still 2
and nothing adds ids, so `ids` comes back as `[[undefined, undefined], [undefined]]`
or the parse rejects. Record which.

- [ ] **Step 3: Add the two fields to the descriptor**

In `engine/src/document/descriptor.ts`, `MENU_TIER_FIELDS` gains `id` as its
FIRST entry and `cost` as its LAST. Order is normative in this file, so position
matters and the parity snapshot will show it.

```ts
export const MENU_TIER_FIELDS = [
  // First, for the same reason `id` is first on every block: a validation issue
  // must always be able to name the row it came from. Added at version 3 so a
  // selection can name "these forty of sixty" and survive the seller reordering
  // a row. Held by position instead, a selection points at the wrong products
  // the moment anything moves, and repricing the wrong products is the worst
  // thing this feature could do.
  { name: "id", type: "string", required: true, nonEmpty: true },
  { name: "name", type: "string", required: true },
  // ... existing fields unchanged, in their existing order ...
  { name: "imageUrls", type: "stringArray", required: false },
  // What the seller paid. Text for the same reason `price` is text, and never
  // compiled: see `engine/tests/compile/cost-never-published.test.ts`. The app
  // publishes this page, so a supplier cost reaching a customer would be a
  // disclosure the seller never agreed to.
  { name: "cost", type: "string", required: false },
] as const satisfies readonly FieldSpec[];
```

Then bump the version:

```ts
export const SCHEMA_VERSION = 3;
```

- [ ] **Step 4: Write the migration**

In `engine/src/document/migrate.ts`, add this above `MIGRATIONS`:

```ts
/**
 * Every price list row gains an identifier.
 *
 * Positional, `t0` upward within each menu block, and never random. This runs
 * inside the engine, where Principle I forbids consuming randomness, and the
 * determinism property test requires the same page in to give the same page
 * out on every machine. New rows added in the app get a UUID from `newId()`
 * instead, so a migrated page holds a mix of the two. That is correct rather
 * than untidy: the two ids come from two places with different powers, and only
 * one of them had to be deterministic.
 *
 * Scoped per block rather than per document, because a selection never spans
 * two price lists and block scoping keeps these short.
 */
function tierIdsByPosition(doc: Record<string, unknown>): Record<string, unknown> {
  const blocks = Array.isArray(doc["blocks"]) ? doc["blocks"] : [];
  return {
    ...doc,
    schemaVersion: 3,
    blocks: blocks.map((block: unknown) => {
      if (typeof block !== "object" || block === null) return block;
      const b = block as Record<string, unknown>;
      if (b["kind"] !== "menu" || !Array.isArray(b["tiers"])) return b;
      return {
        ...b,
        tiers: b["tiers"].map((tier: unknown, i: number) => {
          if (typeof tier !== "object" || tier === null) return tier;
          const t = tier as Record<string, unknown>;
          // `id` first in the object as well as in the descriptor. The
          // canonical writer reorders on the way out, so this is only for
          // anyone reading the intermediate value in a debugger.
          return { id: `t${String(i)}`, ...t };
        }),
      };
    }),
  };
}
```

Then register it:

```ts
export const MIGRATIONS: readonly Migration[] = [
  { from: 1, to: 2, apply: tierImagesToList },
  { from: 2, to: 3, apply: tierIdsByPosition },
];
```

- [ ] **Step 5: Add the uniqueness rule to the validator**

Open `engine/src/document/validate.ts` and read the existing block-id
uniqueness check around line 255 to 272. Mirror its shape for tiers, reusing the
`"duplicate_id"` code so the app needs no new case.

The rule is uniqueness **within one menu block**. Add the check where blocks are
walked, so the path can name the block and the row:

```ts
/**
 * Two rows in one price list cannot share an identifier.
 *
 * Scoped to the block, not the page, because that is what selection needs and
 * because the version 3 migration numbers each block's rows from zero, so `t0`
 * legitimately appears once per price list.
 */
function checkTierIds(block: Record<string, unknown>, path: string, c: Collector): void {
  const tiers = block["tiers"];
  if (!Array.isArray(tiers)) return;

  const seen = new Map<string, number>();
  tiers.forEach((tier: unknown, i: number) => {
    if (typeof tier !== "object" || tier === null) return;
    const id = (tier as Record<string, unknown>)["id"];
    if (typeof id !== "string" || id === "") return;

    const first = seen.get(id);
    if (first === undefined) {
      seen.set(id, i);
      return;
    }
    c.add(
      "duplicate_id",
      `${path}.tiers[${String(i)}].id`,
      `Items ${String(first + 1)} and ${String(i + 1)} in this price list share the same identifier "${id}". Each item needs its own.`,
    );
  });
}
```

Match the actual `Collector` API and call signature in the file rather than the
sketch above: read how `checkFields` and the block-id check call `c.add`,
including whether a fourth `blockId` argument is passed, and follow that exactly.
Call `checkTierIds` from wherever menu blocks are already being walked.

- [ ] **Step 6: Close the `crypto` enforcement gap**

In `eslint.config.js`, the `engine/src/**` block lists `document`, `window` and
`fetch` under `no-restricted-globals`. Add `crypto` with the same shape:

```js
{ name: "crypto", message: "Principle I: the engine must not consume randomness." },
```

This was found during feature 021 and recorded there: a migration that minted a
UUID would violate Principle I and pass CI silently. This task is the one that
would have done it, so it closes the gap here.

- [ ] **Step 7: Bring the engine's own fixtures to version 3**

Three fixtures contain tiers and must gain ids on every tier. Give them readable
ids rather than `t0` style, so a reader can tell a hand-written fixture from a
migrated page:

- `engine/tests/document/fixtures/full.json`
- `engine/tests/compile/fixtures/full-page.json`
- `engine/tests/compile/fixtures/hostile-page.json`

`full.json` is at `schemaVersion: 1` and exists to prove migration, so **leave
its version at 1** and leave its tiers without ids. It will migrate through both
steps, which is more coverage than editing it would give. Check whether the
round-trip test compares against a post-migration expectation and update that
expectation if so.

The two compile fixtures need ids added and their version set to 3, because the
golden harness compiles them directly. **Compiled output must not change**, since
`id` and `cost` are never emitted, so the golden `.md` files should stay
byte-identical. If `npm run test` reports a golden mismatch, that is a real
finding: the emitter is leaking a field it should ignore. Do not regenerate the
goldens to make it pass.

- [ ] **Step 8: Regenerate the parity snapshot and read the diff**

From PowerShell:

```
npm run snapshot
```

Then read the diff before committing:

```
git diff engine/tests/document/parity.snapshot.json
```

Expected: `id` appears first inside `blockFields.menu.tiers.of`, `cost` appears
last, and the version changes. Nothing else moves. If any other field shifted
position, a field order was disturbed and that is a schema change nobody
intended.

- [ ] **Step 9: Run the engine tests**

From PowerShell, each alone:

```
npx vitest run engine/tests
npm run typecheck
npm run lint
```

Expected: all green, including the new migration test and the determinism and
round-trip property tests.

- [ ] **Step 10: Commit**

```bash
git add engine eslint.config.js
git commit -m "feat(contract): price list rows get an identifier, and a cost"
```

---

### Task 2: The app catches up to version 3

Task 1 left the app unable to build a valid tier. This is the smallest change
that makes the tree green again, and no more.

**Files:**
- Modify: `app/src/ui/forms.ts` (the `editTier` append path near line 332, the
  placeholder row near line 339, and `blankBlock`)
- Modify: all seven `app/src/starters/*.json`
- Test: `app/tests/tier-ids.test.ts`

**Interfaces:**
- Consumes: `SCHEMA_VERSION` is 3; a tier requires `id`.
- Produces: every tier the app creates carries an id from `newId()`
  (`app/src/store.ts:110`, `crypto.randomUUID`).

- [ ] **Step 1: Write the failing test**

Create `app/tests/tier-ids.test.ts`:

```ts
/**
 * @vitest-environment jsdom
 *
 * Every row the app creates carries an identifier.
 *
 * Typing into the blank row at the bottom of a price list is how a row is
 * added, so that path mints the id rather than any explicit "add" button. A row
 * without one cannot be saved at all under version 3, so this is the difference
 * between the editor working and not.
 */
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";

import { addBlock, getState, init } from "../src/store.js";
import { blankBlock } from "../src/ui/forms.js";

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  init(true);
});

describe("a price list row", () => {
  it("gets an identifier when a blank section is created", () => {
    const block = blankBlock("menu");
    if (block.kind !== "menu") throw new Error("expected a menu");
    for (const tier of block.tiers) expect(tier.id).not.toBe("");
  });

  it("gets a distinct identifier per row", () => {
    addBlock(blankBlock("menu"));
    const block = getState().doc.blocks[0];
    if (block === undefined || block.kind !== "menu") throw new Error("expected a menu");
    const ids = block.tiers.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```
npx vitest run app/tests/tier-ids.test.ts
```

Expected: FAIL, either a type error or an empty id, because nothing mints one.

- [ ] **Step 3: Mint ids where rows are born**

In `app/src/ui/forms.ts`, three places create a tier and all three need an id.
Import `newId` from `../store.js` alongside the existing imports.

The append path inside `editTier` near line 332 currently reads
`[...tiers, change({ name: "", price: "" })]`. It becomes
`[...tiers, change({ id: newId(), name: "", price: "" })]`.

**`newId()` must be called inside the handler, never during render.** Called at
render time it would mint a fresh id on every repaint, and the store repaints on
a 200ms debounce while typing, so the row's identity would change under the
seller's fingers and any selection would break constantly.

The placeholder row near line 339, `const shown = block.tiers.length > 0 ?
block.tiers : [{ name: "", price: "" }]`, is a display-only row that is not in
the document. Give it a constant id such as `""`, not a minted one, for the same
render-time reason. It is never selectable: `rowTools` already returns nothing
for `index >= count`, and the checkbox added in Task 5 must follow that rule.

Check `blankBlock("menu")` in the same file and give any tier it creates an id.

- [ ] **Step 4: Bring the seven starters to version 3**

Each of the seven `app/src/starters/*.json` files needs `"schemaVersion": 3` and
an `"id"` on every tier. Use readable ids drawn from the item, such as
`"bust"`, `"half-body"`, `"phone-stand"`, so a reader can tell hand-written
content from a migrated page. They must be unique within their own menu block.

They are edited rather than left to migrate for readability, not necessity. An
earlier draft of this step claimed `validateDocument` does not migrate and that
the starters would therefore fail validation. **That was false**, found during
Task 2 on 2026-09-02: `engine/src/document/validate.ts:364` brings an older page
forward before checking its fields, so the starters would have loaded and
validated untouched. The real reason to edit them is the one the spec gives,
that a reader should be able to tell hand-written content from a migrated page,
which positional `t0` ids would have hidden.
`app/public/example.json` is different and must be left alone: it is at version 1,
loads through `parseDocument`, and migrating on every load is coverage worth
having.

- [ ] **Step 5: Run the app tests**

```
npx vitest run app/tests
npm run typecheck
```

Expected: green, including `app/tests/starters.test.ts`, which validates all
eight starting points.

- [ ] **Step 6: Commit**

```bash
git add app
git commit -m "feat(editor): give every price list row an identifier"
```

---

### Task 3: The money parser

Pure, no UI, no store. It exists so the arithmetic can refuse to guess.

**Files:**
- Create: `app/src/money.ts`
- Test: `app/tests/money.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface Money {
    /** Whatever the seller wrote before the number, such as "$" or "from ". */
    readonly prefix: string;
    /** Whole cents, so no result depends on binary floating point. */
    readonly cents: number;
    /** Whatever the seller wrote after the number, such as "+". */
    readonly suffix: string;
  }
  export function parseMoney(text: string): Money | undefined;
  export function formatMoney(money: Money, cents: number): string;
  export type Rounding = "99" | "95" | "whole" | "none";
  export function applyPricing(
    cost: Money,
    multiplier: number,
    extraCents: number,
    rounding: Rounding,
  ): number;
  ```
  Task 6 consumes all four.

- [ ] **Step 1: Write the failing tests**

Create `app/tests/money.test.ts`. The table comes straight from the spec:

```ts
/**
 * Reading a price somebody typed, and refusing to guess.
 *
 * `price` is free text on purpose: the descriptor says artists write "45",
 * "from 45", "45+" and "DM me". Arithmetic over that is only safe if anything
 * unparseable comes back as nothing, so the caller can skip the row visibly
 * rather than inventing a number for it.
 */
import { describe, expect, it } from "vitest";

import { applyPricing, formatMoney, parseMoney } from "../src/money.js";

describe("reading a price", () => {
  it.each([
    ["45", "", 4500, ""],
    ["$45", "$", 4500, ""],
    ["45.50", "", 4550, ""],
    ["from 45", "from ", 4500, ""],
    ["45+", "", 4500, "+"],
    ["1,234.56", "", 123456, ""],
    ["  45  ", "", 4500, ""],
  ])("reads %s", (text, prefix, cents, suffix) => {
    expect(parseMoney(text)).toEqual({ prefix, cents, suffix });
  });

  it.each([["DM me"], [""], ["   "], ["ask"], ["free"]])(
    "returns nothing for %s, rather than a wrong number",
    (text) => {
      expect(parseMoney(text)).toBeUndefined();
    },
  );

  it("refuses a decimal comma rather than guessing which convention it is", () => {
    // 1.234,56 is one thousand two hundred and thirty four in much of Europe
    // and something else entirely if read the other way. A visible skip beats
    // a price wrong by a factor of a thousand. Recorded in the spec.
    expect(parseMoney("1.234,56")).toBeUndefined();
  });
});

describe("writing a price back", () => {
  it("keeps whatever the seller wrote around the number", () => {
    const parsed = parseMoney("from 12");
    if (parsed === undefined) throw new Error("expected a parse");
    expect(formatMoney(parsed, 3899)).toBe("from 38.99");
  });

  it("keeps a currency symbol", () => {
    const parsed = parseMoney("$5");
    if (parsed === undefined) throw new Error("expected a parse");
    expect(formatMoney(parsed, 1299)).toBe("$12.99");
  });
});

describe("computing a price from a cost", () => {
  const cost = (text: string) => {
    const m = parseMoney(text);
    if (m === undefined) throw new Error("expected a parse");
    return m;
  };

  it("multiplies, adds, and rounds up to .99", () => {
    // 1.20 x 3.2 = 3.84, plus 4.50 = 8.34, rounded up to 8.99.
    expect(applyPricing(cost("1.20"), 3.2, 450, "99")).toBe(899);
  });

  it("leaves a price that already ends in .99 alone", () => {
    expect(applyPricing(cost("8.99"), 1, 0, "99")).toBe(899);
  });

  it("rounds 9.00 up to 9.99, never down", () => {
    // Rounding must never reduce a price. A rule that could quietly cut a
    // margin is not one a seller can trust.
    expect(applyPricing(cost("9.00"), 1, 0, "99")).toBe(999);
  });

  it("rounds up to .95 when asked", () => {
    expect(applyPricing(cost("8.34"), 1, 0, "95")).toBe(895);
  });

  it("rounds up to a whole number when asked", () => {
    expect(applyPricing(cost("8.34"), 1, 0, "whole")).toBe(900);
  });

  it("leaves the number alone when asked for no rounding", () => {
    expect(applyPricing(cost("1.20"), 3.2, 450, "none")).toBe(834);
  });

  it("works in whole cents, so no result depends on floating point", () => {
    // 0.1 + 0.2 in floating point is not 0.3. Money never goes near that here.
    expect(applyPricing(cost("0.10"), 1, 20, "none")).toBe(30);
  });
});
```

- [ ] **Step 2: Run and watch it fail**

```
npx vitest run app/tests/money.test.ts
```

Expected: FAIL, `../src/money.js` cannot be resolved.

- [ ] **Step 3: Write the parser**

Create `app/src/money.ts`. Guidance rather than the whole body, because the
tests above are the specification and they are exact:

- Match with this anchored expression, which is the crux and is easy to get
  subtly wrong:

  ```ts
  const PRICE = /^(\D*?)(\d{1,3}(?:,\d{3})*|\d+)(?:\.(\d{1,2}))?(\D*)$/;
  ```

  Group 1 is the prefix, lazily matched and non-numeric so "from " and "$" are
  captured but digits never are. Group 2 is the whole part, either
  comma-grouped thousands or plain digits. Group 3 is an optional one or two
  place decimal. Group 4 is the suffix. Anchoring at both ends is what makes
  "DM me" fail rather than matching some fragment of itself.

- A decimal comma is rejected by this expression rather than by a special case:
  "1.234,56" leaves ",56" to match group 4 as a suffix, which would silently
  read it as one point two three. Guard it explicitly by returning `undefined`
  when the suffix contains a digit, and say why in a comment. That single rule
  also catches "45.999" and other trailing-number shapes that would otherwise
  parse into something the seller did not write.
- Convert to cents by parsing the whole part and the decimal part separately,
  never by `parseFloat(x) * 100`, which is where floating point error enters.
- `formatMoney` writes `prefix + whole + "." + two digit remainder + suffix`.
- `applyPricing` computes `Math.round(cost.cents * multiplier) + extraCents`,
  then rounds up: for `"99"` and `"95"`, the smallest value with that ending
  which is greater than or equal to the computed price; for `"whole"`, the next
  multiple of 100; for `"none"`, unchanged.

- [ ] **Step 4: Run and watch it pass**

```
npx vitest run app/tests/money.test.ts
npm run typecheck
npm run lint
```

Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add app/src/money.ts app/tests/money.test.ts
git commit -m "feat(pricing): read a price without guessing at one"
```

---

### Task 4: Cost in the form, profit on the row, and the leak guard

**Files:**
- Modify: `app/src/ui/forms.ts` (the menu tier fieldset, near lines 345 to 460)
- Test: `engine/tests/compile/cost-never-published.test.ts`
- Test: `app/tests/cost-and-profit.test.ts`

**Interfaces:**
- Consumes: `parseMoney` and `formatMoney` from `app/src/money.js`; `cost` on a
  tier from Task 1.

- [ ] **Step 1: Write the leak test first, because it is the one that matters**

Create `engine/tests/compile/cost-never-published.test.ts`:

```ts
/**
 * A cost must never reach a compiled page.
 *
 * The app exists to publish this document to a paste host. A supplier cost in
 * that output is a disclosure the seller never agreed to, on a page they
 * published themselves, and it cannot be taken back once it is on the internet.
 * This is the test that makes `cost` safe to store at all.
 */
import { describe, expect, it } from "vitest";

import { compile, TARGETS, type Document } from "@mdsb/engine";

const COST = "SUPPLIER-COST-9179";

const doc: Document = {
  schemaVersion: 3,
  target: "rentry",
  blocks: [
    {
      id: "prices",
      kind: "menu",
      heading: "Prices",
      tiers: [
        { id: "a", name: "Widget", price: "12.99", cost: COST },
        { id: "b", name: "Gadget", price: "24.99", cost: COST, unit: "each" },
      ],
    },
  ],
};

describe("a cost", () => {
  it("appears in no target's output", () => {
    for (const target of TARGETS) {
      const result = compile(doc, target);
      expect([target.id, result.markdown.includes(COST)]).toEqual([target.id, false]);
    }
  });

  it("survives a tier carrying every other optional field", () => {
    // The synthetic case above has plain tiers. An emitter that walked a tier's
    // fields generically would leak only on a richer shape, so this one carries
    // every optional field the descriptor allows alongside the cost.
    const rich: Document = {
      schemaVersion: 3,
      target: "rentry",
      blocks: [
        {
          id: "prices",
          kind: "menu",
          heading: "Prices",
          currency: "USD",
          tiers: [
            {
              id: "a",
              name: "Widget",
              price: "12.99",
              unit: "each",
              blurb: "A widget",
              includes: ["One thing"],
              details: [{ label: "Colour", value: "Black" }],
              quantities: [{ amount: "5", price: "50" }],
              imageUrls: ["https://example.com/a.jpg"],
              cost: COST,
            },
          ],
          addOns: [{ name: "Extra", price: "5" }],
        },
      ],
    };

    for (const target of TARGETS) {
      expect([target.id, compile(rich, target).markdown.includes(COST)]).toEqual([target.id, false]);
    }
  });

  it("does not become a diagnostic either", () => {
    // A warning naming the cost would publish it into the app's own interface,
    // which is not the page but is still somewhere the seller might screenshot.
    for (const target of TARGETS) {
      const messages = compile(doc, target).diagnostics.map((d) => d.message).join(" ");
      expect(messages.includes(COST)).toBe(false);
    }
  });
});
```

- [ ] **Step 2: Run it**

```
npx vitest run engine/tests/compile/cost-never-published.test.ts
```

Expected: PASS immediately. The emitter reads named fields and has no reason to
touch `cost`. If it FAILS, stop: the emitter is enumerating tier fields
generically and that is a real defect to fix in `engine/src/compile/emit/menu.ts`
before going further.

- [ ] **Step 2b: Sweep every page that actually ships**

FR-054c asks for breadth, not one synthetic document. Add to
`app/tests/starters.test.ts`, which already globs the starting points and
already reads the shipped example from disk:

```ts
describe("a planted cost", () => {
  const COST = "SUPPLIER-COST-9179";

  it("reaches no target's output from any page that ships", async () => {
    // Every starting point and the example, with a cost on every row, compiled
    // against every host. This lives in app/tests rather than engine/tests
    // because the pages are app content: the dependency direction is app
    // depends on engine, never the reverse.
    for (const starter of STARTERS) {
      const doc = await starter.load();
      const planted = {
        ...doc,
        blocks: doc.blocks.map((b) =>
          b.kind === "menu" ? { ...b, tiers: b.tiers.map((t) => ({ ...t, cost: COST })) } : b,
        ),
      };
      for (const target of TARGETS) {
        expect([starter.id, target.id, compile(planted, target).markdown.includes(COST)])
          .toEqual([starter.id, target.id, false]);
      }
    }
  });
});
```

- [ ] **Step 3: Write the failing form test**

Create `app/tests/cost-and-profit.test.ts`, a jsdom test following the harness in
`app/tests/starters-picker.test.ts`. It must assert:

- a menu section's form renders a "What you paid" field for each row
- typing into it stores `cost` on that tier and nowhere else
- a row with a parseable cost and price shows its profit
- a row whose price is "DM me" shows no profit and does not error
- the profit text is not present anywhere in the Copy surface output

- [ ] **Step 4: Add the field and the profit line**

In `app/src/ui/forms.ts`, inside the tier fieldset, add a `field` for cost beside
price, labelled "What you paid" with a hint reading "Only you see this. It is
never part of your published page."

Below it, when `parseMoney(tier.cost)` and `parseMoney(tier.price)` both return a
value, render the profit as text. Compute it in cents and render with
`formatMoney`. When either fails to parse, render nothing at all rather than a
zero or a dash, because a zero is a claim and absence is not.

- [ ] **Step 5: Run everything**

```
npx vitest run app/tests engine/tests
npm run verify
```

- [ ] **Step 6: Commit**

```bash
git add app engine/tests/compile/cost-never-published.test.ts
git commit -m "feat(pricing): store what you paid, show what you make, publish neither"
```

---

### Task 5: Selection

**Files:**
- Modify: `app/src/store.ts` (add `selectedTierIds` to `State`, and the actions)
- Modify: `app/src/ui/forms.ts` (a checkbox per row)
- Create: `app/src/ui/bulk-pricing.ts` (the toolbar only, for now)
- Test: `app/tests/tier-selection.test.ts`

**Interfaces:**
- Produces on the store:
  ```ts
  readonly selectedTierIds: readonly string[];
  export function toggleTier(id: string): void;
  export function selectTiers(ids: readonly string[]): void;
  export function clearTierSelection(): void;
  ```
  Task 6 consumes all four.

- [ ] **Step 1: Write the failing test**

Create `app/tests/tier-selection.test.ts`, jsdom, following the harness in
`app/tests/starters-picker.test.ts`. It must assert, with a menu of at least
three rows:

- ticking a row's checkbox puts that row's id in the selection
- the count line reads how many are selected
- "select all" selects every real row and not the blank placeholder row
- "none" clears it
- **reordering a row leaves the selection unchanged**, which is the requirement
  the schema change was taken for, so this test is the point of Task 1
- **removing a selected row drops only that row from the selection**
- **removing an unselected row leaves the selection unchanged**
- editing a row's name leaves the selection unchanged
- switching surface clears the selection, matching how `setSurface` already
  clears `undo` and `pendingPageDeleteId`

- [ ] **Step 2: Run and watch it fail**

```
npx vitest run app/tests/tier-selection.test.ts
```

- [ ] **Step 3: Add selection to the store**

In `app/src/store.ts`, add `selectedTierIds: readonly string[]` to `State`,
defaulting to `[]`. Add `toggleTier`, `selectTiers` and `clearTierSelection`.

Clear it in `setSurface` alongside `undo` and `pendingPageDeleteId`, for the
reason already written there: leaving is an answer.

Do **not** clear it on ordinary edits. That is the whole point of ids. A removed
row's id simply stops matching anything, so filter the selection against the
document's live tier ids when reading it rather than trying to catch every
removal path.

- [ ] **Step 4: Add the checkbox and the toolbar**

A checkbox per real row in the tier fieldset. It must have an accessible name
naming its row, such as "Select Bust", never a bare "Select", because the a11y
gate asserts names are distinguishable and a page of identical "Select" controls
is exactly what it exists to catch. No checkbox on the placeholder row.

Create `app/src/ui/bulk-pricing.ts` exporting a toolbar that renders the count
line plus select-all and none. Keep the apply panel out until Task 6.

- [ ] **Step 5: Run and pass, then the gates**

```
npx vitest run app/tests/tier-selection.test.ts
npm run a11y
```

- [ ] **Step 6: Commit**

```bash
git add app
git commit -m "feat(pricing): choose the rows, by identity rather than position"
```

---

### Task 6: Apply, preview, and one undo

**Files:**
- Modify: `app/src/ui/bulk-pricing.ts` (the apply panel and preview)
- Modify: `app/src/store.ts` (a `bulk` undo variant)
- Test: `app/tests/bulk-apply.test.ts`

**Interfaces:**
- Consumes: `applyPricing`, `parseMoney`, `formatMoney` from `app/src/money.js`;
  `selectedTierIds` and its actions from Task 5.

- [ ] **Step 1: Write the failing test**

Create `app/tests/bulk-apply.test.ts`, jsdom. It must assert:

- the preview shows old price, new price and profit for each selected row
  **before** anything is applied, and the document is unchanged while it shows
- applying writes every selected row
- a selected row whose cost is missing or unparseable is **named as skipped** in
  the preview and is **byte-identical** afterwards
- write-back preserves the surround: a price of "from 12" becomes "from 38.99"
- **one undo reverses the whole application**, every row at once
- applying does not clear the selection, so a seller can adjust and reapply
- exactly one save happens for one application, not one per row

The last one is worth an explicit assertion. `update()` at `store.ts:359` fires
a full-document IndexedDB write on every call, so a naive loop would be forty
writes and forty "Saved" flickers for one action. Assert it by counting calls to
a spied `writePage`, or by asserting the store's status transitions once.

- [ ] **Step 2: Run and watch it fail**

```
npx vitest run app/tests/bulk-apply.test.ts
```

- [ ] **Step 3: Add the bulk undo variant**

In `app/src/store.ts`, extend the `undo` union with a third variant:

```ts
| { readonly kind: "bulk"; readonly block: Block; readonly label: string }
```

In `undoRemove()`, handle `"bulk"` on the same branch as `"row"`: both restore
the section wholesale, which is exactly right here for the reason already
written in that function's comment. A row cannot land in the wrong place if the
whole section is put back.

The two variants differ only in what the interface announces, so keep the
restore shared and vary the wording at the call site.

**Rename `undoRemove` to `undoLast`** in the same commit, updating its callers.
A function called `undoRemove` that reverses a price change is a comment that
lies, and this project has three recorded defects caused by exactly that. Grep
for the name with the Grep tool before changing it, so no caller is missed:
`app/src/ui/build.ts` and `app/src/ui/forms.ts` both use it, and
`app/tests/undo-remove.test.ts` covers it. Rename the test file too.

- [ ] **Step 4: Build the apply panel**

In `app/src/ui/bulk-pricing.ts`, add three inputs: multiply cost by, then add,
then round up to (`.99`, `.95`, a whole number, no rounding).

Compute the preview for every selected row on each input change. Render old to
new plus profit for rows that will change, and a plainly worded list of rows that
will be skipped and why.

Apply writes all rows through **one** `replaceBlocks` call and sets
`undo = { kind: "bulk", block: <the section as it was>, label: ... }` before the
write, in the same `set` if possible.

- [ ] **Step 5: Run everything**

```
npx vitest run app/tests
npm run verify
```

Expected: fully green, including the contrast and PWA gates.

- [ ] **Step 6: Commit**

```bash
git add app
git commit -m "feat(pricing): price many items at once, reversible in one press"
```

---

### Task 7: Update the record

**Files:**
- Modify: `specs/README.md`
- Modify: `docs/ROADMAP.md`

- [ ] **Step 1: Update the index**

Set 022's Shipped column to the date it landed and its plan column to `yes`.

- [ ] **Step 2: Note it on the roadmap**

Record what shipped and that F3 (import) and F4 (the interview wizard) remain
unbuilt, in the honest register the file already uses.

- [ ] **Step 3: Check every claim and commit**

Read both files and confirm nothing you wrote is untrue of the code as it stands,
including anything a neighbouring sentence now contradicts. Feature 021 shipped
two false claims this way, both caused by updating a sentence's tense rather than
its meaning.

```
node scripts/dash-scan.mjs
```

```bash
git add specs docs
git commit -m "docs: record bulk pricing, and what is still unbuilt"
```
