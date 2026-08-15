import { describe, expect, it } from "vitest";

import { serializeDocument } from "../../src/document/serialize.js";
import type { Document } from "../../src/document/types.js";
import { validateDocument } from "../../src/document/validate.js";

import { fixture, fixtureText, minimalDocument, validDocument } from "./helpers.js";

/**
 * The round trip. Guarantee G2, FR-006, FR-010, FR-011.
 *
 * This is User Story 1 stated as code: an artist's page comes back exactly as
 * they left it. Everything else in the product is built on this holding.
 */

/** Serialize, read back, and return the reloaded document. */
function roundTrip(doc: Document): Document {
  const result = validateDocument(JSON.parse(serializeDocument(doc)));
  if (!result.ok) {
    throw new Error(`round trip produced an invalid page: ${JSON.stringify(result.issues)}`);
  }
  return result.document;
}

describe("round trip is lossless (G2, FR-006)", () => {
  it.each(["full.json", "minimal.json", "empty.json", "unicode.json"])(
    "%s survives unchanged",
    (name) => {
      const original = validateDocument(fixture(name));
      expect(original.ok).toBe(true);
      if (!original.ok) return;
      expect(roundTrip(original.document)).toEqual(original.document);
    },
  );

  it("survives repeatedly, without drifting on each pass", () => {
    let doc = validDocument();
    const first = serializeDocument(doc);
    for (let i = 0; i < 5; i += 1) doc = roundTrip(doc);
    expect(serializeDocument(doc)).toBe(first);
  });

  it("preserves block order exactly (FR-008)", () => {
    const loaded = validateDocument(fixture("full.json"));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const ids = loaded.document.blocks.map((b) => b.id);
    expect(roundTrip(loaded.document).blocks.map((b) => b.id)).toEqual(ids);
    expect(ids).toEqual(["h1", "p1", "d1", "m1", "g1", "t1"]);
  });
});

describe("absent and empty stay different (FR-010)", () => {
  it("keeps an absent optional field absent", () => {
    const out = roundTrip(minimalDocument());
    expect("title" in out).toBe(false);
  });

  it("keeps an empty string as an empty string", () => {
    const loaded = validateDocument(fixture("empty.json"));
    if (!loaded.ok) throw new Error("fixture should be valid");
    const out = roundTrip(loaded.document);
    expect("title" in out).toBe(true);
    expect(out.title).toBe("");
  });

  it("does not let the two collapse into each other", () => {
    const absent = serializeDocument(minimalDocument());
    const empty = serializeDocument({ schemaVersion: 1, target: "portable", title: "", blocks: [] });
    expect(absent).not.toBe(empty);
  });
});

describe("text is preserved exactly (FR-011)", () => {
  it("keeps emoji, accents, right to left text, and Markdown characters", () => {
    const loaded = validateDocument(fixture("unicode.json"));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;

    const block = loaded.document.blocks[0];
    if (block?.kind !== "prose") throw new Error("expected a prose block");
    const text = block.text;

    for (const fragment of ["\u{1F600}", "café", "שלום", "*stars*", "\\", '"', "\t", "​"]) {
      expect(text).toContain(fragment);
    }

    const out = roundTrip(loaded.document);
    const outBlock = out.blocks[0];
    if (outBlock?.kind !== "prose") throw new Error("expected a prose block");
    expect(outBlock.text).toBe(text);
  });

  it("keeps a lone surrogate, which is not valid on its own but is what the artist typed", () => {
    // JSON.stringify has been well formed since ES2019: it escapes a lone
    // surrogate rather than emitting invalid UTF-8, so this survives.
    const doc: Document = {
      schemaVersion: 1,
      target: "portable",
      blocks: [{ id: "s1", kind: "prose", text: "lone \ud800 surrogate" }],
    };
    const out = roundTrip(doc);
    const block = out.blocks[0];
    if (block?.kind !== "prose") throw new Error("expected a prose block");
    expect(block.text).toBe("lone \ud800 surrogate");
  });

  it("keeps text that came from the file on disk byte for byte", () => {
    const raw = JSON.parse(fixtureText("unicode.json")) as { title: string };
    const loaded = validateDocument(fixture("unicode.json"));
    if (!loaded.ok) throw new Error("fixture should be valid");
    expect(loaded.document.title).toBe(raw.title);
  });
});
