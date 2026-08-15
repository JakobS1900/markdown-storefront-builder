import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { Document } from "../../src/document/types.js";

/** Reads a fixture as raw text, which is what `parseDocument` actually takes. */
export function fixtureText(name: string): string {
  const path = fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));
  return readFileSync(path, "utf8");
}

/** Reads a fixture as a parsed value, for feeding `validateDocument` directly. */
export function fixture(name: string): unknown {
  return JSON.parse(fixtureText(name));
}

/**
 * A valid page, built in code rather than read from disk.
 *
 * `structuredClone` on every call so a test that mutates its document cannot
 * leak that mutation into the next test.
 */
export function validDocument(): Document {
  return structuredClone({
    schemaVersion: 1,
    target: "rentry",
    title: "Commissions",
    blocks: [
      { id: "b1", kind: "heading", text: "Prices", level: 2 },
      { id: "b2", kind: "divider" },
      { id: "b3", kind: "prose", text: "Half up front." },
    ],
  } satisfies Document);
}

/** The smallest valid page: no title, no blocks. */
export function minimalDocument(): Document {
  return structuredClone({
    schemaVersion: 1,
    target: "portable",
    blocks: [],
  } satisfies Document);
}

/**
 * Applies an arbitrary mutation to a valid page, returning it as `unknown`.
 *
 * Tests need to build shapes the types forbid, since the whole point of the
 * validator is handling values TypeScript cannot vouch for. This keeps the cast
 * in one place instead of scattering it through every test.
 */
export function broken(mutate: (doc: Record<string, unknown>) => void): unknown {
  const doc = validDocument() as unknown as Record<string, unknown>;
  mutate(doc);
  return doc;
}

/** The issue codes present in a result, for concise assertions. */
export function codesOf(result: { ok: boolean; issues?: readonly { code: string }[] }): string[] {
  return (result.issues ?? []).map((i) => i.code);
}
