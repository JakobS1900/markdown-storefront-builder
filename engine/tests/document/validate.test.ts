import { describe, expect, it } from "vitest";

import { validateDocument } from "../../src/document/validate.js";

import { broken, codesOf, fixture, minimalDocument, validDocument } from "./helpers.js";

/**
 * The validator. Data model rules 1 and 5 through 18, and guarantees G1, G4, G5.
 *
 * Every assertion here traces to a numbered rule in data-model.md or a lettered
 * guarantee in contracts/document-api.md, so a failure says which promise broke.
 */

describe("validateDocument: shape of the input (rule 1)", () => {
  it.each([
    ["null", null],
    ["undefined", undefined],
    ["an array", []],
    ["a string", "hello"],
    ["a number", 42],
    ["a boolean", true],
  ])("refuses %s as the root", (_label, input) => {
    const result = validateDocument(input);
    expect(result.ok).toBe(false);
    expect(codesOf(result)).toContain("not_an_object");
  });

  it("accepts a valid page", () => {
    expect(validateDocument(validDocument()).ok).toBe(true);
  });

  it("accepts the minimal page", () => {
    expect(validateDocument(minimalDocument()).ok).toBe(true);
  });
});

describe("validateDocument: required and typed fields (rule 5)", () => {
  it("refuses a missing required field, naming it", () => {
    const result = validateDocument(broken((d) => delete d["target"]));
    expect(result.ok).toBe(false);
    expect(codesOf(result)).toContain("missing_field");
    expect(result.ok === false && result.issues[0]?.path).toBe("target");
  });

  it("refuses a required field of the wrong type", () => {
    const result = validateDocument(broken((d) => (d["target"] = 7)));
    expect(codesOf(result)).toContain("wrong_type");
  });

  it("refuses a wrong type nested inside a block", () => {
    const result = validateDocument(
      broken((d) => ((d["blocks"] as Record<string, unknown>[])[0]!["level"] = "two")),
    );
    expect(codesOf(result)).toContain("wrong_type");
    expect(result.ok === false && result.issues[0]?.path).toBe("blocks[0].level");
    expect(result.ok === false && result.issues[0]?.blockId).toBe("b1");
  });
});

describe("validateDocument: unknown fields are refused (rule 6, FR-017)", () => {
  it("refuses an unknown field at the root, naming it", () => {
    const result = validateDocument(broken((d) => (d["colour"] = "blue")));
    expect(codesOf(result)).toContain("unknown_field");
    expect(result.ok === false && result.issues[0]?.path).toBe("colour");
  });

  it("refuses an unknown field inside a block, naming the block", () => {
    const result = validateDocument(
      broken((d) => ((d["blocks"] as Record<string, unknown>[])[0]!["colour"] = "blue")),
    );
    expect(codesOf(result)).toContain("unknown_field");
    expect(result.ok === false && result.issues[0]?.blockId).toBe("b1");
  });
});

describe("validateDocument: null is never valid (rule 7, research D4)", () => {
  it("refuses null in place of a required field", () => {
    expect(codesOf(validateDocument(broken((d) => (d["target"] = null))))).toContain(
      "null_not_allowed",
    );
  });

  it("refuses null in place of an optional field, rather than treating it as absent", () => {
    expect(codesOf(validateDocument(broken((d) => (d["title"] = null))))).toContain(
      "null_not_allowed",
    );
  });
});

describe("validateDocument: absent optional fields stay absent (rule 8, FR-010)", () => {
  it("does not invent an optional field that was not there", () => {
    const result = validateDocument(minimalDocument());
    expect(result.ok).toBe(true);
    expect(result.ok === true && "title" in result.document).toBe(false);
  });

  it("keeps an empty string as an empty string, distinct from absent", () => {
    const result = validateDocument(fixture("empty.json"));
    expect(result.ok).toBe(true);
    expect(result.ok === true && result.document.title).toBe("");
  });
});

describe("validateDocument: block kinds (rule 9)", () => {
  it("refuses a kind the descriptor does not declare, rather than ignoring the block", () => {
    const result = validateDocument(
      broken((d) => ((d["blocks"] as Record<string, unknown>[])[0]!["kind"] = "video")),
    );
    expect(codesOf(result)).toContain("unknown_kind");
  });

  it("accepts every kind in scope", () => {
    expect(validateDocument(fixture("full.json")).ok).toBe(true);
  });
});

describe("validateDocument: identifiers (rule 10, FR-009)", () => {
  it("refuses an empty id", () => {
    const result = validateDocument(
      broken((d) => ((d["blocks"] as Record<string, unknown>[])[0]!["id"] = "")),
    );
    expect(codesOf(result)).toContain("empty_string_not_allowed");
  });

  it("refuses duplicate ids and names the offender", () => {
    const result = validateDocument(
      broken((d) => ((d["blocks"] as Record<string, unknown>[])[1]!["id"] = "b1")),
    );
    expect(codesOf(result)).toContain("duplicate_id");
    expect(result.ok === false && result.issues.some((i) => i.blockId === "b1")).toBe(true);
  });
});

describe("validateDocument: tier identifiers (FR-054)", () => {
  /**
   * Regression coverage for `checkTierIds`. Nothing else in this file exercises
   * it: a later refactor that stopped calling it, or inverted its
   * `first === undefined` branch, would pass every other test in this suite.
   */
  it("refuses two tiers in one menu block sharing an id, and names both rows", () => {
    const doc = {
      schemaVersion: 3,
      target: "rentry",
      blocks: [
        {
          id: "m1",
          kind: "menu",
          tiers: [
            { id: "t0", name: "Small", price: "10" },
            { id: "t0", name: "Large", price: "20" },
          ],
        },
      ],
    };
    const result = validateDocument(doc);
    expect(codesOf(result)).toContain("duplicate_id");
    if (result.ok) throw new Error("expected the duplicate to be refused");
    const issue = result.issues.find((i) => i.code === "duplicate_id");
    expect(issue?.path).toBe("blocks[0].tiers[1].id");
    expect(issue?.message).toContain("Items 1 and 2");
  });

  it("accepts the same id reused across two different menu blocks", () => {
    // The rule is scoped to the block, matching the version 3 migration, which
    // numbers every block's rows from zero. A page with two price lists
    // legitimately has "t0" in each, and a check scoped to the document
    // instead of the block would refuse every migrated page with two menus.
    const doc = {
      schemaVersion: 3,
      target: "rentry",
      blocks: [
        { id: "m1", kind: "menu", tiers: [{ id: "t0", name: "Small", price: "10" }] },
        { id: "m2", kind: "menu", tiers: [{ id: "t0", name: "Rush", price: "15" }] },
      ],
    };
    const result = validateDocument(doc);
    expect(result.ok).toBe(true);
  });
});

describe("validateDocument: ranges and enums (rules 11 to 13)", () => {
  it.each([0, 7, -1])("refuses heading level %i", (level) => {
    const result = validateDocument(
      broken((d) => ((d["blocks"] as Record<string, unknown>[])[0]!["level"] = level)),
    );
    expect(codesOf(result)).toContain("out_of_range");
  });

  it.each([1, 2, 3, 4, 5, 6])("accepts heading level %i", (level) => {
    const result = validateDocument(
      broken((d) => ((d["blocks"] as Record<string, unknown>[])[0]!["level"] = level)),
    );
    expect(result.ok).toBe(true);
  });

  it("refuses a gallery layout outside the enum", () => {
    const doc = fixture("full.json") as Record<string, unknown>;
    (doc["blocks"] as Record<string, unknown>[])[4]!["layout"] = "carousel";
    expect(codesOf(validateDocument(doc))).toContain("not_in_enum");
  });

  it("refuses a profile status outside the enum", () => {
    const doc = fixture("full.json") as Record<string, unknown>;
    (doc["blocks"] as Record<string, unknown>[])[1]!["status"] = "busy";
    expect(codesOf(validateDocument(doc))).toContain("not_in_enum");
  });
});

describe("validateDocument: target is opaque (rule 14, research D5)", () => {
  it("refuses an empty target", () => {
    expect(codesOf(validateDocument(broken((d) => (d["target"] = ""))))).toContain(
      "empty_string_not_allowed",
    );
  });

  it("ACCEPTS a target it has never heard of, because hosts are data", () => {
    const result = validateDocument(broken((d) => (d["target"] = "some-host-invented-later")));
    expect(result.ok).toBe(true);
  });
});

describe("validateDocument: an empty page is valid (rule 15, FR-016)", () => {
  it("accepts a page with zero blocks", () => {
    expect(validateDocument(fixture("minimal.json")).ok).toBe(true);
  });
});

describe("validateDocument: numbers must be finite integers (rule 18, review R-2)", () => {
  it.each([
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["negative Infinity", Number.NEGATIVE_INFINITY],
    ["a non-integer", 2.5],
  ])("refuses %s as a heading level", (_label, value) => {
    const result = validateDocument(
      broken((d) => ((d["blocks"] as Record<string, unknown>[])[0]!["level"] = value)),
    );
    expect(result.ok).toBe(false);
    expect(codesOf(result)).toContain("not_finite");
  });
});

describe("validateDocument: guarantees G1, G4, G5", () => {
  it("G1: never throws, whatever it is given", () => {
    const cyclic: Record<string, unknown> = { schemaVersion: 1, target: "rentry" };
    cyclic["blocks"] = [cyclic];
    const hostile: unknown[] = [
      undefined,
      null,
      Symbol("s"),
      () => undefined,
      cyclic,
      new Map(),
      { schemaVersion: 1, target: "x", blocks: "not an array" },
    ];
    for (const input of hostile) {
      expect(() => validateDocument(input)).not.toThrow();
    }
  });

  it("G4: reports every problem, not just the first", () => {
    const result = validateDocument(
      broken((d) => {
        delete d["target"];
        d["unknownOne"] = 1;
        d["unknownTwo"] = 2;
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.issues.length).toBeGreaterThanOrEqual(3);
  });

  it("G5: does not mutate its input", () => {
    const input = validDocument();
    const before = JSON.stringify(input);
    validateDocument(input);
    expect(JSON.stringify(input)).toBe(before);
  });

  it("G5: leaves a rejected input untouched", () => {
    const input = broken((d) => (d["colour"] = "blue"));
    const before = JSON.stringify(input);
    validateDocument(input);
    expect(JSON.stringify(input)).toBe(before);
  });
});

describe("validateDocument: messages are for artists (FR-003, SC-006)", () => {
  it("gives every issue a non-empty message that is not just its code", () => {
    const result = validateDocument(
      broken((d) => {
        delete d["target"];
        d["colour"] = "blue";
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    for (const issue of result.issues) {
      expect(issue.message.length).toBeGreaterThan(15);
      expect(issue.message).not.toBe(issue.code);
    }
  });

  it("names the offending field inside the message, not only in the path", () => {
    const result = validateDocument(broken((d) => (d["colour"] = "blue")));
    expect(result.ok === false && result.issues[0]?.message).toContain("colour");
  });
});
