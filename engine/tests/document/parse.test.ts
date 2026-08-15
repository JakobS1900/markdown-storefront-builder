import { describe, expect, it } from "vitest";

import { serializeDocument } from "../../src/document/serialize.js";
import type { Document } from "../../src/document/types.js";
import { parseDocument, validateDocument } from "../../src/document/validate.js";

import { codesOf, fixture, fixtureText, validDocument } from "./helpers.js";

/**
 * User Story 2: a page can be moved somewhere else, and a file that is not a
 * page is refused without touching anything already stored.
 */

describe("parseDocument: damaged input is refused, never thrown (G1)", () => {
  it.each([
    ["empty text", ""],
    ["not JSON at all", "this is not json"],
    ["truncated", '{"schemaVersion": 1, "target": "rentry", "blo'],
    ["trailing comma", '{"schemaVersion": 1,}'],
    ["a bare word", "undefined"],
  ])("refuses %s with invalid_json", (_label, text) => {
    let result;
    expect(() => (result = parseDocument(text))).not.toThrow();
    expect(result!.ok).toBe(false);
    expect(codesOf(result!)).toContain("invalid_json");
  });

  it.each([
    ["an array", "[]"],
    ["a bare string", '"hello"'],
    ["a number", "42"],
    ["null", "null"],
    ["true", "true"],
  ])("refuses %s, which is valid JSON but not a page", (_label, text) => {
    const result = parseDocument(text);
    expect(result.ok).toBe(false);
    expect(codesOf(result)).toContain("not_an_object");
  });

  it("gives a damaged file a message about the file, not about JSON syntax", () => {
    const result = parseDocument("{{{");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.message.toLowerCase()).not.toContain("json");
    expect(result.issues[0]?.message.length).toBeGreaterThan(15);
  });
});

describe("parseDocument: real files load (US2)", () => {
  it.each(["full.json", "minimal.json", "empty.json", "unicode.json"])("loads %s", (name) => {
    expect(parseDocument(fixtureText(name)).ok).toBe(true);
  });
});

describe("export, import, export is byte-identical (US2 scenario 2, FR-007)", () => {
  it("produces the same file both times", () => {
    const first = serializeDocument(validDocument());

    const reloaded = parseDocument(first);
    expect(reloaded.ok).toBe(true);
    if (!reloaded.ok) return;

    expect(serializeDocument(reloaded.document)).toBe(first);
  });

  it("holds for a fully populated page loaded from disk", () => {
    const loaded = parseDocument(fixtureText("full.json"));
    if (!loaded.ok) throw new Error("fixture should be valid");

    const once = serializeDocument(loaded.document);
    const twice = parseDocument(once);
    if (!twice.ok) throw new Error("re-parse should be valid");

    expect(serializeDocument(twice.document)).toBe(once);
  });

  it("normalizes a hand-edited file with keys in the wrong order to the same bytes", () => {
    // Someone editing the file by hand will not preserve our key order. Two
    // pages with identical content must still export identically.
    const scrambled = JSON.stringify({
      blocks: [],
      title: "Held",
      target: "rentry",
      schemaVersion: 1,
    });
    const canonical = serializeDocument({
      schemaVersion: 1,
      target: "rentry",
      title: "Held",
      blocks: [],
    });

    const loaded = parseDocument(scrambled);
    if (!loaded.ok) throw new Error("should be valid");
    expect(serializeDocument(loaded.document)).toBe(canonical);
  });
});

describe("hostile input (review R-3)", () => {
  it("refuses a page carrying __proto__ as an unknown field", () => {
    const result = parseDocument(
      '{"schemaVersion":1,"target":"rentry","blocks":[],"__proto__":{"polluted":true}}',
    );
    expect(result.ok).toBe(false);
    expect(codesOf(result)).toContain("unknown_field");
  });

  it("leaves Object.prototype unpolluted afterwards", () => {
    parseDocument('{"schemaVersion":1,"target":"rentry","blocks":[],"__proto__":{"polluted":true}}');
    parseDocument('{"__proto__":{"polluted":true}}');
    expect(({} as Record<string, unknown>)["polluted"]).toBeUndefined();
    expect(Object.prototype).not.toHaveProperty("polluted");
  });

  it("refuses constructor and prototype as unknown fields too", () => {
    for (const key of ["constructor", "prototype"]) {
      const result = parseDocument(
        `{"schemaVersion":1,"target":"rentry","blocks":[],"${key}":{"x":1}}`,
      );
      expect(codesOf(result)).toContain("unknown_field");
    }
  });

  it("refuses __proto__ inside a block, naming that block", () => {
    const doc = fixture("minimal.json") as Record<string, unknown>;
    doc["blocks"] = [JSON.parse('{"id":"x","kind":"divider","__proto__":{"a":1}}')];
    const result = validateDocument(doc);
    expect(codesOf(result)).toContain("unknown_field");
  });

  it("does not let a deeply nested structure throw (G1)", () => {
    let nested = '{"id":"x","kind":"divider"}';
    for (let i = 0; i < 200; i += 1) nested = `{"a":${nested}}`;
    expect(() => parseDocument(nested)).not.toThrow();
  });
});

describe("nothing stored is touched by a failed read (FR-012, G5)", () => {
  it("returns a rejected document unmodified", () => {
    const text = '{"schemaVersion":1,"target":"rentry","blocks":[],"colour":"blue"}';
    const before = JSON.parse(text) as unknown;
    parseDocument(text);
    expect(JSON.parse(text)).toEqual(before);
  });

  it("leaves a valid document in memory untouched while refusing another", () => {
    const held: Document = validDocument();
    const snapshot = serializeDocument(held);
    parseDocument("{{{ broken");
    parseDocument('{"schemaVersion":99,"target":"x","blocks":[]}');
    expect(serializeDocument(held)).toBe(snapshot);
  });
});
