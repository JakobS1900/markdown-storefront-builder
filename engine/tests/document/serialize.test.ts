import { describe, expect, it } from "vitest";

import { DOCUMENT_FIELDS } from "../../src/document/descriptor.js";
import { serializeDocument } from "../../src/document/serialize.js";
import type { Document } from "../../src/document/types.js";

import { fixture, validDocument } from "./helpers.js";

/**
 * The canonical writer. Guarantees G3, G7, G8, and review findings R-2 and R-3.
 *
 * The property that matters: the bytes depend on the CONTENT alone. Not on the
 * order keys were assigned, not on which process wrote them, not on how the
 * document was constructed.
 */

describe("serializeDocument: stable bytes (G3, FR-007)", () => {
  it("produces identical output on repeated calls", () => {
    const doc = validDocument();
    expect(serializeDocument(doc)).toBe(serializeDocument(doc));
  });

  it("produces identical output for two independently built equal documents", () => {
    expect(serializeDocument(validDocument())).toBe(serializeDocument(validDocument()));
  });
});

describe("serializeDocument: content alone decides the bytes (G8, review R-3)", () => {
  it("ignores the order in which keys were assigned", () => {
    const forward = validDocument();

    // The same page, assembled in reverse key order. A writer that enumerated
    // its input would emit these keys in a different sequence.
    const reversed = {} as Record<string, unknown>;
    reversed["blocks"] = structuredClone(forward.blocks);
    reversed["title"] = forward.title;
    reversed["target"] = forward.target;
    reversed["schemaVersion"] = forward.schemaVersion;

    expect(serializeDocument(reversed as unknown as Document)).toBe(serializeDocument(forward));
  });

  it("is unaffected by integer-like keys, which JavaScript reorders", () => {
    // JavaScript hoists integer-like string keys to the front in ascending
    // order regardless of insertion order. If any of that leaked into the
    // output this would differ from the canonical form.
    const withNumericFirst = {} as Record<string, unknown>;
    withNumericFirst["2"] = "ignored";
    withNumericFirst["1"] = "ignored";
    Object.assign(withNumericFirst, structuredClone(validDocument()));
    delete withNumericFirst["1"];
    delete withNumericFirst["2"];

    expect(serializeDocument(withNumericFirst as unknown as Document)).toBe(
      serializeDocument(validDocument()),
    );
  });

  it("emits document keys in descriptor order", () => {
    const json = serializeDocument(fixture("full.json") as Document);
    const positions = DOCUMENT_FIELDS.map((f) => json.indexOf(`"${f.name}"`));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions]).toEqual([...positions].sort((a, b) => a - b));
  });

  it("emits id and kind before a block's own fields", () => {
    const json = serializeDocument(validDocument());
    const block = json.slice(json.indexOf('"id": "b1"'));
    expect(block.indexOf('"kind"')).toBeLessThan(block.indexOf('"text"'));
  });
});

describe("serializeDocument: never writes an unreadable page (G7, review R-2)", () => {
  it.each([
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
  ])("throws rather than writing %s as null", (_label, value) => {
    const doc = validDocument() as unknown as Record<string, unknown>;
    (doc["blocks"] as Record<string, unknown>[])[0]!["level"] = value;
    expect(() => serializeDocument(doc as unknown as Document)).toThrow();
  });

  it("never emits the token null, which is never valid input", () => {
    expect(serializeDocument(fixture("full.json") as Document)).not.toContain("null");
  });

  it("throws on a document that would not validate", () => {
    const doc = validDocument() as unknown as Record<string, unknown>;
    delete doc["target"];
    expect(() => serializeDocument(doc as unknown as Document)).toThrow();
  });
});

describe("serializeDocument: absent stays absent (FR-010)", () => {
  it("omits an absent optional field rather than writing it empty", () => {
    const json = serializeDocument({ schemaVersion: 1, target: "portable", blocks: [] });
    expect(json).not.toContain("title");
  });

  it("writes an empty string when that is what the field holds", () => {
    const json = serializeDocument(fixture("empty.json") as Document);
    expect(json).toContain('"title": ""');
  });
});
