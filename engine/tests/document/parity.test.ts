import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  BLOCK_FIELDS,
  BLOCK_KINDS,
  COMMON_BLOCK_FIELDS,
  DOCUMENT_FIELDS,
  SCHEMA_VERSION,
} from "../../src/document/descriptor.js";

/**
 * The parity test. Constitution Principle III and FR-013.
 *
 * This fails if any field name, field type, or field ORDER changes. That is its
 * entire job. When it fails, the change was either a mistake or a deliberate
 * schema change that also needs the snapshot updated and, if it can invalidate a
 * saved page, a SCHEMA_VERSION bump and a migration.
 *
 * Failing is the mechanism working. It is not an obstacle to route around.
 */

/**
 * Canonical JSON for comparison: object keys sorted, array order preserved.
 *
 * Array order is preserved precisely because field order is what we are
 * guarding. Key order inside a single field spec is not meaningful, so sorting
 * it keeps the snapshot stable against incidental reordering in the source.
 */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = canonical((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

const shape = {
  schemaVersion: SCHEMA_VERSION,
  blockKinds: BLOCK_KINDS,
  commonBlockFields: COMMON_BLOCK_FIELDS,
  documentFields: DOCUMENT_FIELDS,
  blockFields: BLOCK_FIELDS,
};

const snapshotPath = fileURLToPath(new URL("./parity.snapshot.json", import.meta.url));

describe("schema parity", () => {
  it("matches the checked-in snapshot", () => {
    const actual = JSON.stringify(canonical(shape), null, 2);
    const expected = readFileSync(snapshotPath, "utf8").replace(/\r\n/g, "\n").trimEnd();
    expect(actual).toBe(expected);
  });

  it("contains exactly the six block kinds in scope for version 1", () => {
    expect([...BLOCK_KINDS]).toEqual([
      "heading",
      "divider",
      "prose",
      "menu",
      "gallery",
      "profile",
    ]);
  });

  it("declares a block kind entry for every kind, and no extras", () => {
    expect(Object.keys(BLOCK_FIELDS).sort()).toEqual([...BLOCK_KINDS].sort());
  });

  it("puts id and kind first on every block, in that order", () => {
    expect(COMMON_BLOCK_FIELDS.map((f) => f.name)).toEqual(["id", "kind"]);
  });

  it("puts schemaVersion first on the document, so the version gate can read it", () => {
    expect(DOCUMENT_FIELDS[0]?.name).toBe("schemaVersion");
  });
});
