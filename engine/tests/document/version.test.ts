import { describe, expect, it } from "vitest";

import { SCHEMA_VERSION } from "../../src/document/descriptor.js";
import { MIGRATIONS, migrate } from "../../src/document/migrate.js";
import { validateDocument } from "../../src/document/validate.js";

import { broken, codesOf, validDocument } from "./helpers.js";

/**
 * User Story 3: an update does not eat the artist's work.
 *
 * This is the failure that is rare, unrecoverable, and almost always caused by
 * our own code rather than anything the artist did.
 */

describe("the version stamp must be present and well formed (FR-001)", () => {
  it("refuses a page with no version at all", () => {
    const result = validateDocument(broken((d) => delete d["schemaVersion"]));
    expect(codesOf(result)).toEqual(["version_missing"]);
  });

  it.each([
    ["text", "1"],
    ["a fraction", 1.5],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["zero", 0],
    ["negative", -1],
    ["a boolean", true],
    ["null", null],
  ])("refuses a version that is %s", (_label, value) => {
    const result = validateDocument(broken((d) => (d["schemaVersion"] = value)));
    expect(codesOf(result)).toEqual(["version_malformed"]);
  });

  it("accepts the current version", () => {
    expect(validateDocument(validDocument()).ok).toBe(true);
  });
});

describe("a page from the future is refused, not guessed at (FR-004, G6)", () => {
  it("reports exactly one issue, with code version_too_new", () => {
    const result = validateDocument(broken((d) => (d["schemaVersion"] = SCHEMA_VERSION + 1)));
    expect(result.ok).toBe(false);
    expect(codesOf(result)).toEqual(["version_too_new"]);
  });

  it("does not inspect the contents, so no other problem is reported", () => {
    // This page is broken in three other ways. None of them should be
    // mentioned: we did not read far enough to know, and claiming otherwise
    // would be guessing about a format we do not understand.
    const result = validateDocument(
      broken((d) => {
        d["schemaVersion"] = SCHEMA_VERSION + 5;
        delete d["target"];
        d["unknownField"] = 1;
        d["blocks"] = "not a list";
      }),
    );
    expect(codesOf(result)).toEqual(["version_too_new"]);
  });

  it("tells the artist their page has not been changed", () => {
    const result = validateDocument(broken((d) => (d["schemaVersion"] = 99)));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.message).toContain("has not been changed");
  });

  it("leaves the input untouched (G5)", () => {
    const input = broken((d) => (d["schemaVersion"] = 99));
    const before = JSON.stringify(input);
    validateDocument(input);
    expect(JSON.stringify(input)).toBe(before);
  });
});

describe("forward migration (FR-005, research D7)", () => {
  it("carries exactly one step, from the version that had none", () => {
    // This read "ships empty at version 1, because there is nothing to migrate
    // from yet", which was true for three versions of the schema. The
    // mechanism was built early on the argument that it could not be added
    // later: by the time a second version exists there are already pages
    // written by a build with no migration path. That argument is now cashed.
    expect(MIGRATIONS.map((m) => [m.from, m.to])).toEqual([[1, 2]]);
  });

  it("moves a version 1 item image into the list, and says so", () => {
    const v1 = {
      schemaVersion: 1,
      target: "portable",
      blocks: [
        {
          id: "m",
          kind: "menu",
          tiers: [
            { name: "Bust", price: "45", imageUrl: "https://e.test/a.png" },
            { name: "Full body", price: "120" },
          ],
        },
      ],
    };
    const out = migrate(v1, 1) as Record<string, unknown>;
    expect(out["schemaVersion"]).toBe(2);
    const blocks = out["blocks"] as Record<string, unknown>[];
    const tiers = blocks[0]?.["tiers"] as Record<string, unknown>[];
    expect(tiers[0]?.["imageUrls"]).toEqual(["https://e.test/a.png"]);
    expect(tiers[0]).not.toHaveProperty("imageUrl");
    // An item that had no picture gains nothing. Absent and empty must not
    // both be able to mean the same thing, because the round trip depends on
    // telling them apart.
    expect(tiers[1]).not.toHaveProperty("imageUrls");
  });

  it("does not turn an emptied field into a list holding nothing", () => {
    const v1 = {
      schemaVersion: 1,
      target: "portable",
      blocks: [{ id: "m", kind: "menu", tiers: [{ name: "Bust", price: "45", imageUrl: "" }] }],
    };
    const out = migrate(v1, 1) as Record<string, unknown>;
    const blocks = out["blocks"] as Record<string, unknown>[];
    const tiers = blocks[0]?.["tiers"] as Record<string, unknown>[];
    expect(tiers[0]).not.toHaveProperty("imageUrls");
    expect(tiers[0]).not.toHaveProperty("imageUrl");
  });

  it("leaves every other kind of block alone", () => {
    const v1 = {
      schemaVersion: 1,
      target: "portable",
      blocks: [
        { id: "g", kind: "gallery", layout: "grid", items: [{ imageUrl: "https://e.test/g.png" }] },
        { id: "p", kind: "profile", displayName: "Ari", avatarUrl: "https://e.test/me.png" },
      ],
    };
    const out = migrate(v1, 1) as Record<string, unknown>;
    const blocks = out["blocks"] as Record<string, unknown>[];
    // A gallery image is already a list of pictures and keeps its own shape.
    expect((blocks[0]?.["items"] as Record<string, unknown>[])[0]?.["imageUrl"]).toBe(
      "https://e.test/g.png",
    );
    expect(blocks[1]?.["avatarUrl"]).toBe("https://e.test/me.png");
  });

  it("does not mutate the page it was given", () => {
    const v1 = {
      schemaVersion: 1,
      target: "portable",
      blocks: [{ id: "m", kind: "menu", tiers: [{ name: "Bust", price: "45", imageUrl: "https://e.test/a.png" }] }],
    };
    const before = JSON.stringify(v1);
    migrate(v1, 1);
    expect(JSON.stringify(v1)).toBe(before);
  });

  it("returns a current-version page unchanged", () => {
    const doc = validDocument() as unknown as Record<string, unknown>;
    expect(migrate(doc, SCHEMA_VERSION)).toBe(doc);
  });

  it("declares migrations in ascending order, so steps apply in sequence", () => {
    const versions = MIGRATIONS.map((m) => m.from);
    expect([...versions]).toEqual([...versions].sort((a, b) => a - b));
  });

  it("has no gaps in the chain up to the current version", () => {
    // Every step from 1 upward must exist, or a page saved at a skipped version
    // could never be brought forward.
    MIGRATIONS.forEach((m, i) => {
      expect(m.from).toBe(i + 1);
      expect(m.to).toBe(i + 2);
    });
    if (MIGRATIONS.length > 0) {
      expect(MIGRATIONS[MIGRATIONS.length - 1]?.to).toBe(SCHEMA_VERSION);
    }
  });
});
