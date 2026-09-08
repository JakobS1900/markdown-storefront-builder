/**
 * Version 4 to 5: a price row learns how the item reaches a buyer, and a page
 * saved at version 4 must not notice.
 *
 * The step is the smallest a migration can be. It stamps the version and does
 * nothing else, because both fields it makes room for are optional and an
 * absent optional field is never defaulted into existence: absent and empty must
 * not both be able to mean the same thing, and round tripping depends on the
 * contract telling them apart.
 *
 * The byte identity sweep at the bottom is the assertion this whole feature
 * turns on. Every page in existence has neither field, so if any of them
 * compiles differently afterwards, the emitter is wrong rather than the page.
 * That is FR-110 and SC-001, and it is asserted by compiling rather than by
 * reasoning that an optional field cannot matter.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { ALL_TARGETS, compile, parseDocument, SCHEMA_VERSION } from "@mdsb/engine";
import type { Document } from "@mdsb/engine";

// Not part of the public surface, imported directly so this step's own
// non-mutation can be checked in isolation rather than as the end of a chain.
import { migrate } from "../../src/document/migrate.js";

function fixture(name: string): string {
  return readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), "utf8");
}

/** The fixture exactly as it sits on disk, at version 4 and unmigrated. */
function rawV4(): Record<string, unknown> {
  return JSON.parse(fixture("v4-page.json")) as Record<string, unknown>;
}

function migratedV4(): Document {
  const result = parseDocument(fixture("v4-page.json"));
  if (!result.ok) throw new Error(`v4 fixture did not migrate: ${JSON.stringify(result.issues)}`);
  return result.document;
}

function tiers(doc: Document): readonly Record<string, unknown>[] {
  const menu = doc.blocks.find((b) => b.kind === "menu");
  if (menu === undefined || menu.kind !== "menu") throw new Error("expected a menu block");
  return menu.tiers as unknown as readonly Record<string, unknown>[];
}

describe("a page saved at version 4", () => {
  it("comes forward to the current version", () => {
    const result = parseDocument(fixture("v4-page.json"));
    expect(result.ok ? result.document.schemaVersion : result.issues).toBe(SCHEMA_VERSION);
  });

  it("gives no row a selling mode, because absent and empty are different", () => {
    // The same rule every migration in this project follows. Defaulting an
    // optional field into existence would make round tripping depend on which
    // representation the writer happened to pick.
    for (const tier of tiers(migratedV4())) {
      expect([tier["name"], "availability" in tier]).toEqual([tier["name"], false]);
      expect([tier["name"], "leadTime" in tier]).toEqual([tier["name"], false]);
    }
  });

  it("keeps every field it already had, with the value it already had", () => {
    const [small] = tiers(migratedV4());
    expect(small).toMatchObject({
      id: "t0",
      name: "Small",
      price: "10",
      unit: "each",
      blurb: "The usual size.",
      cost: "4",
    });
  });

  it("does not mutate the page it was given", () => {
    const v4 = rawV4();
    const before = JSON.stringify(v4);
    migrate(v4, 4);
    expect(JSON.stringify(v4)).toBe(before);
  });
});

/**
 * SC-001: nothing a seller has already published changes under them.
 *
 * Across every target the compiler can emit, not only the paste hosts, because
 * the menu file is an output somebody sends to a customer and a byte moving
 * there matters just as much.
 */
describe("migrating a version 4 page changes nothing anybody would see", () => {
  it.each(ALL_TARGETS.map((target) => target.id))("%s output is byte identical", (targetId) => {
    const target = ALL_TARGETS.find((t) => t.id === targetId);
    if (target === undefined) throw new Error(`no target ${targetId}`);

    // `compile` does not re-validate, so the raw version 4 object can be
    // compiled exactly as it sits on disk. That is what makes this a real
    // before and after rather than two spellings of the same value.
    const before = compile(rawV4() as unknown as Document, target);
    const after = compile(migratedV4(), target);

    expect(after.markdown).toBe(before.markdown);
    expect(after.diagnostics).toEqual(before.diagnostics);

    // Proving the comparison is not two empty strings, per target rather than
    // once. A guard that does not cover everything the sweep covers is a
    // sample, not a guard.
    expect(after.markdown).toContain("Small");
    expect(after.markdown.length).toBeGreaterThan(100);
  });
});
