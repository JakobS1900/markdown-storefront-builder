import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { compile } from "../../src/compile/compile.js";
import { ALL_TARGETS } from "../../src/compile/targets.js";
import { validateDocument } from "../../src/document/validate.js";
import type { Document } from "../../src/document/types.js";

/**
 * Determinism. Constitution Principle I, FR-003, SC-002.
 *
 * The claim: the same page and the same host always produce identical bytes.
 * This is what makes golden files a guarantee rather than a habit, and what
 * lets a reviewer trust the compiler without running it.
 *
 * Feature 001 could not assert this, because there was no compiler to assert it
 * against. This is where the third structurally required test from Principle
 * III finally lands.
 *
 * `ALL_TARGETS`, because the claim is about the compiler rather than about the
 * places a seller pastes a page, and a target left out of this sweep has no
 * determinism guarantee at all. Passed as the record and not as an id:
 * `findTarget` searches `TARGETS` only, so an id would compile `menu-file` as
 * `portable` and this file would prove `portable` deterministic four times.
 */

const here = (p: string): string => fileURLToPath(new URL(p, import.meta.url));

const fixtures: [string, Document][] = readdirSync(here("./fixtures"))
  .filter((f) => f.endsWith(".json"))
  .sort()
  .map((name) => {
    const result = validateDocument(JSON.parse(readFileSync(here(`./fixtures/${name}`), "utf8")));
    if (!result.ok) throw new Error(`fixture ${name} is invalid`);
    return [name, result.document];
  });

describe("SC-002: identical input, identical bytes", () => {
  it.each(fixtures)("%s is stable across many compiles", (_name, doc) => {
    for (const target of ALL_TARGETS) {
      const first = compile(doc, target).markdown;
      for (let i = 0; i < 50; i += 1) {
        expect(compile(doc, target).markdown).toBe(first);
      }
    }
  });

  it.each(fixtures)("%s produces the same diagnostics every time", (_name, doc) => {
    for (const target of ALL_TARGETS) {
      const first = JSON.stringify(compile(doc, target).diagnostics);
      expect(JSON.stringify(compile(doc, target).diagnostics)).toBe(first);
    }
  });
});

describe("compilation does not depend on anything ambient", () => {
  it("does not mutate the page it was given", () => {
    for (const [, doc] of fixtures) {
      const before = JSON.stringify(doc);
      for (const target of ALL_TARGETS) compile(doc, target);
      expect(JSON.stringify(doc)).toBe(before);
    }
  });

  it("does not depend on the order targets are compiled in", () => {
    for (const [, doc] of fixtures) {
      const forward = ALL_TARGETS.map((t) => compile(doc, t).markdown);
      const backward = [...ALL_TARGETS].reverse().map((t) => compile(doc, t).markdown).reverse();
      expect(backward).toEqual(forward);
    }
  });

  it("does not accumulate diagnostics between calls", () => {
    // A shared sink, or a module-level array, would show up here as a warning
    // count that grows with each compile.
    const doc = fixtures[0]?.[1];
    if (doc === undefined) throw new Error("expected at least one fixture");
    const first = compile(doc, "some-unknown-host").diagnostics.length;
    for (let i = 0; i < 10; i += 1) {
      expect(compile(doc, "some-unknown-host").diagnostics.length).toBe(first);
    }
  });
});

describe("SC-007: adding a host changes no compiler logic", () => {
  it("compiles against a host invented entirely inside this test", () => {
    // If this works, hosts are genuinely data. Nothing in the compiler or the
    // emitters knows this host exists, and it is not in the registry.
    const invented = {
      id: "invented-for-this-test",
      name: "Invented Host",
      capabilities: {
        maxHeadingLevel: 3,
        thematicBreak: "___",
        tables: false,
        hardBreak: "backslash",
        localImages: false,
        strikethrough: false,
        highlight: false,
        escapeStyle: "commonmark",
      },
      sources: {
        maxHeadingLevel: "invented",
        thematicBreak: "invented",
        tables: "invented",
        hardBreak: "invented",
        localImages: "invented",
        strikethrough: "invented",
        highlight: "invented",
        escapeStyle: "invented",
        maxBytes: "invented",
      },
    } as const;

    const doc: Document = {
      schemaVersion: 1,
      target: "invented-for-this-test",
      blocks: [
        { id: "h", kind: "heading", text: "Deep", level: 5 },
        { id: "d", kind: "divider" },
      ],
    };

    const out = compile(doc, invented);

    // Its capabilities were honoured: the heading clamped to 3, and the
    // separator is this host's, not the shipped hosts'.
    expect(out.markdown).toBe("### Deep\n\n___\n");
    expect(out.targetId).toBe("invented-for-this-test");
    expect(out.diagnostics.some((d) => d.code === "heading_level_reduced")).toBe(true);
    expect(out.diagnostics.some((d) => d.code === "unknown_target")).toBe(false);
  });
});
