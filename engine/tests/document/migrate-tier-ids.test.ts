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
