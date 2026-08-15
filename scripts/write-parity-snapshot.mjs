/**
 * Regenerates the schema parity snapshot.
 *
 * Run this ONLY after a deliberate schema change, and read the git diff it
 * produces before committing. The parity test failing is the guard working. If
 * you reach for this script to make a red test go green without knowing why it
 * went red, stop: that is the exact situation the guard exists to catch.
 *
 * Reads the built descriptor from engine/dist, so run `npm run build` first.
 */
import { writeFileSync } from "node:fs";

const { SCHEMA_VERSION, BLOCK_KINDS, COMMON_BLOCK_FIELDS, DOCUMENT_FIELDS, BLOCK_FIELDS } =
  await import("../engine/dist/document/descriptor.js");

// Object keys sorted, array order preserved. Array order is the thing being
// guarded, so it is never touched. Key order inside one field spec is not
// meaningful, so sorting keeps the snapshot stable against incidental churn.
// This must stay identical to `canonical` in parity.test.ts. If the two ever
// disagree, the test fails, which is the correct failure mode.
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = canonical(value[key]);
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

const target = new URL("../engine/tests/document/parity.snapshot.json", import.meta.url);
writeFileSync(target, JSON.stringify(canonical(shape), null, 2) + "\n", "utf8");

console.log("Wrote engine/tests/document/parity.snapshot.json");
console.log("Read the diff before committing. This file is the schema guard.");
