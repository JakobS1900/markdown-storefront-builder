/**
 * Every starting point, judged by the same gate.
 *
 * Globbing rather than listing is the point. A starting point contributed later
 * is gated on the day it lands, and this file does not change when the set
 * grows.
 *
 * Zero diagnostics rather than "compiles": a starting point that trips a
 * capability fallback is teaching somebody a shape their host cannot render,
 * which is worse than offering them nothing.
 */
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { TARGETS, compile, parseDocument, validateDocument } from "@mdsb/engine";

import { STARTERS } from "../src/starters/index.js";

const DIR = fileURLToPath(new URL("../src/starters/", import.meta.url));

function stems(suffix: string): string[] {
  return readdirSync(DIR)
    .filter((name) => name.endsWith(suffix))
    .map((name) => name.slice(0, -suffix.length))
    .sort();
}

describe("the starting points on disk", () => {
  it("are all found by the loader", () => {
    expect(STARTERS.length).toBeGreaterThan(0);
    expect(STARTERS.map((s) => s.id).sort()).toEqual(stems(".json"));
  });

  it("each have a description beside their document, and the reverse", () => {
    // FR-053b. Adding a starting point is dropping files into this directory,
    // so a half-added one has to fail here rather than vanish silently.
    expect(stems(".meta.ts")).toEqual(stems(".json"));
  });

  it("each say who they are for", () => {
    for (const starter of STARTERS) {
      expect(starter.label).not.toBe("");
      expect(starter.description).not.toBe("");
    }
  });
});

describe("every starting point", () => {
  it("is a valid page", async () => {
    for (const starter of STARTERS) {
      const doc = await starter.load();
      const result = validateDocument(doc);
      // Named so a failure says which one, rather than "expected true".
      expect(result.ok ? [] : result.issues.map((i) => `${i.path}: ${i.message}`))
        .toEqual([]);
    }
  });

  it("compiles with no diagnostics on any host", async () => {
    for (const starter of STARTERS) {
      const doc = await starter.load();
      for (const target of TARGETS) {
        const result = compile(doc, target);
        expect(
          result.diagnostics.map((d) => `${starter.id} on ${target.id}: ${d.message}`),
        ).toEqual([]);
      }
    }
  });

  it("produces a page with something on it", async () => {
    // A starting point that compiles to nothing passes every check above and
    // is useless. Three sections is the floor for demonstrating what a page is.
    for (const starter of STARTERS) {
      const doc = await starter.load();
      expect(doc.blocks.length).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("the example page that ships", () => {
  // `example.test.ts` mocks fetch with a fixture of its own, so until now
  // nothing read the file that is actually served. It is the first page a
  // visitor sees and it was the one page nothing checked.
  const text = readFileSync(
    fileURLToPath(new URL("../public/example.json", import.meta.url)),
    "utf8",
  );

  it("is a valid page", () => {
    const result = parseDocument(text);
    expect(result.ok ? [] : result.issues.map((i) => `${i.path}: ${i.message}`))
      .toEqual([]);
  });

  it("compiles with no diagnostics on any host", () => {
    const result = parseDocument(text);
    if (!result.ok) throw new Error("the example did not parse, see the test above");

    for (const target of TARGETS) {
      expect(
        compile(result.document, target).diagnostics.map((d) => `${target.id}: ${d.message}`),
      ).toEqual([]);
    }
  });
});
