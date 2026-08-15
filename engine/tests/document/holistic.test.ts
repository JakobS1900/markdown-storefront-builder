import { describe, expect, it } from "vitest";

import { emptyDocument } from "../../src/document/empty.js";
import { serializeDocument } from "../../src/document/serialize.js";
import { validateDocument } from "../../src/document/validate.js";

import { broken, codesOf, validDocument } from "./helpers.js";

/**
 * Findings from the holistic review over the whole feature diff.
 *
 * Each per-phase review saw one internally correct side of a seam. These are the
 * failures that only show up when the pieces are read together.
 */

describe("H-1: an unknown kind must not bury its own message in noise", () => {
  it("does not report every field of an unrecognised block as an unknown field", () => {
    // A block of a kind we do not know has no field list to check against, so
    // every one of its fields looks unknown. Reporting them all buries the one
    // issue that matters and tells the artist to fix fields that are probably
    // fine, which is the opposite of SC-006.
    const result = validateDocument(
      broken((d) => {
        (d["blocks"] as Record<string, unknown>[])[0] = {
          id: "v1",
          kind: "video",
          src: "https://example.test/v.mp4",
          autoplay: true,
          poster: "https://example.test/p.png",
        };
      }),
    );

    expect(result.ok).toBe(false);
    expect(codesOf(result)).toContain("unknown_kind");
    expect(codesOf(result)).not.toContain("unknown_field");
  });

  it("still reports the unknown kind exactly once, naming it", () => {
    const result = validateDocument(
      broken((d) => {
        (d["blocks"] as Record<string, unknown>[])[0] = { id: "v1", kind: "video", src: "x" };
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const kindIssues = result.issues.filter((i) => i.code === "unknown_kind");
    expect(kindIssues).toHaveLength(1);
    expect(kindIssues[0]?.message).toContain("video");
    expect(kindIssues[0]?.blockId).toBe("v1");
  });

  it("keeps reporting unknown fields on blocks whose kind IS known", () => {
    const result = validateDocument(
      broken((d) => ((d["blocks"] as Record<string, unknown>[])[0]!["colour"] = "blue")),
    );
    expect(codesOf(result)).toContain("unknown_field");
  });
});

describe("H-2: emptyDocument must return a page that is actually valid", () => {
  it("returns a valid page for a normal target", () => {
    expect(validateDocument(emptyDocument("rentry")).ok).toBe(true);
  });

  it("refuses to build a page with a blank target rather than returning an invalid one", () => {
    // The contract says a new page is valid from the moment it is created, and
    // the editor is entitled to rely on that. An empty target silently produces
    // a page that fails to validate and cannot be written.
    expect(() => emptyDocument("")).toThrow();
  });

  it("produces a page that can be written immediately", () => {
    expect(() => serializeDocument(emptyDocument("portable"))).not.toThrow();
  });
});

describe("H-3: a validated document must not alias the caller's input", () => {
  it("does not hand back the same object it was given", () => {
    // The editor validates a draft it is still holding. If validation returns
    // that same object, the app's idea of the saved page and the draft the
    // artist keeps typing into are one object, and the saved copy changes under
    // it. That is an aliasing bug waiting at the storage seam in 2.1.
    const input = validDocument();
    const result = validateDocument(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document).not.toBe(input);
  });

  it("is unaffected by later mutation of the input", () => {
    const input = validDocument();
    const result = validateDocument(input);
    if (!result.ok) return;
    const before = serializeDocument(result.document);

    const mutable = input as unknown as Record<string, unknown>;
    mutable["title"] = "changed afterwards";
    (mutable["blocks"] as unknown[]).push({ id: "late", kind: "divider" });

    expect(serializeDocument(result.document)).toBe(before);
  });
});
