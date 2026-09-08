import { describe, expect, it } from "vitest";

import { SCHEMA_VERSION } from "../../src/document/descriptor.js";
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

describe("a selling mode survives the trip (FR-108, FR-109)", () => {
  function withModes(): Document {
    return {
      schemaVersion: SCHEMA_VERSION,
      target: "rentry",
      blocks: [
        {
          id: "m",
          kind: "menu",
          heading: "Prices",
          tiers: [
            { id: "a", name: "Carved sign", price: "80", availability: "made-to-order", leadTime: "about 2 weeks" },
            { id: "b", name: "Spring mug", price: "25", availability: "preorder", leadTime: "ships in March" },
            { id: "c", name: "Keyring", price: "18", availability: "in-stock" },
            { id: "d", name: "Enamel pin", price: "12", availability: "sold-out", leadTime: "back in about a month" },
            // A wait with no mode. How long something takes is worth saying even
            // when the reason is not, so this must survive on its own.
            { id: "e", name: "Repair", price: "40", leadTime: "3 to 5 days" },
            // And a row with neither, which is every row on every page that
            // exists today. It must come back with neither, not with empties.
            { id: "f", name: "Sticker", price: "3" },
          ],
        },
      ],
    };
  }

  it("keeps both fields, on every mode", () => {
    const out = roundTrip(withModes());
    const menu = out.blocks[0];
    if (menu === undefined || menu.kind !== "menu") throw new Error("expected a menu");

    expect(menu.tiers.map((t) => t.availability)).toEqual([
      "made-to-order",
      "preorder",
      "in-stock",
      "sold-out",
      undefined,
      undefined,
    ]);
    expect(menu.tiers.map((t) => t.leadTime)).toEqual([
      "about 2 weeks",
      "ships in March",
      undefined,
      "back in about a month",
      "3 to 5 days",
      undefined,
    ]);
  });

  it("leaves a row that has neither with neither, rather than with empties", () => {
    const out = roundTrip(withModes());
    const menu = out.blocks[0];
    if (menu === undefined || menu.kind !== "menu") throw new Error("expected a menu");
    const plain = menu.tiers[5] as unknown as Record<string, unknown>;

    expect("availability" in plain).toBe(false);
    expect("leadTime" in plain).toBe(false);
  });

  it("does not drift on a second pass", () => {
    const once = serializeDocument(roundTrip(withModes()));
    expect(serializeDocument(roundTrip(roundTrip(withModes())))).toBe(once);
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

describe("pictures held on the device survive the round trip", () => {
  /**
   * All three of the version 4 fields at once, on one page.
   *
   * Written at the current version so no migration runs: this is about the
   * writer and the validator agreeing on fields nothing has ever stored before,
   * not about coming forward from an older page.
   */
  function withLocalPictures(): Document {
    return structuredClone({
      schemaVersion: SCHEMA_VERSION,
      target: "portable",
      blocks: [
        {
          id: "m1",
          kind: "menu",
          tiers: [
            {
              id: "t0",
              name: "Small",
              price: "10",
              imageUrls: ["https://example.com/small.png"],
              localImageIds: ["a1", "a2"],
              cost: "4",
            },
          ],
        },
        {
          id: "g1",
          kind: "gallery",
          layout: "grid",
          items: [{ imageUrl: "", localImageId: "a3", caption: "From my phone" }],
        },
        { id: "p1", kind: "profile", displayName: "Sam", avatarUrl: "", localAvatarId: "a4" },
      ],
    } satisfies Document);
  }

  it("keeps the identifiers, and keeps them apart from the addresses", () => {
    const original = validateDocument(withLocalPictures());
    if (!original.ok) throw new Error(`page should be valid: ${JSON.stringify(original.issues)}`);

    const out = roundTrip(original.document);
    expect(out).toEqual(original.document);

    const menu = out.blocks[0];
    if (menu?.kind !== "menu") throw new Error("expected a menu first");
    expect(menu.tiers[0]?.localImageIds).toEqual(["a1", "a2"]);
    expect(menu.tiers[0]?.imageUrls).toEqual(["https://example.com/small.png"]);

    const gallery = out.blocks[1];
    if (gallery?.kind !== "gallery") throw new Error("expected a gallery second");
    expect(gallery.items[0]?.localImageId).toBe("a3");

    const profile = out.blocks[2];
    if (profile?.kind !== "profile") throw new Error("expected a profile third");
    expect(profile.localAvatarId).toBe("a4");
  });

  it("does not drift when written twice", () => {
    const original = validateDocument(withLocalPictures());
    if (!original.ok) throw new Error("page should be valid");
    const first = serializeDocument(original.document);
    expect(serializeDocument(roundTrip(original.document))).toBe(first);
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
