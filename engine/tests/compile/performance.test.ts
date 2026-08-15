import { describe, expect, it } from "vitest";

import { compile } from "../../src/compile/compile.js";
import { TARGETS } from "../../src/compile/targets.js";
import type { Block, Document } from "../../src/document/types.js";

/**
 * SC-008. 25 milliseconds on the development machine, against a 100 millisecond
 * user-facing budget, same reasoning as the guard in feature 001.
 *
 * The compiler runs on every keystroke once the preview exists in 2.3, so this
 * budget is the one the artist feels most directly.
 */

const BUDGET_MS = 25;

function pageOf(count: number): Document {
  const blocks: Block[] = [];
  for (let i = 0; i < count; i += 1) {
    blocks.push(
      i % 3 === 0
        ? { id: `b${i}`, kind: "divider" }
        : { id: `b${i}`, kind: "heading", text: `Section ${i} with some length to it`, level: (i % 6) + 1 },
    );
  }
  return { schemaVersion: 1, target: "rentry", blocks };
}

function medianMs(run: () => void, times = 9): number {
  const samples: number[] = [];
  for (let i = 0; i < times; i += 1) {
    const started = performance.now();
    run();
    samples.push(performance.now() - started);
  }
  samples.sort((a, b) => a - b);
  return samples[Math.floor(samples.length / 2)] ?? 0;
}

describe("SC-008: compiling feels instant", () => {
  it.each(TARGETS.map((t) => t.id))(`compiles a 50 block page for %s under ${BUDGET_MS}ms`, (id) => {
    const doc = pageOf(50);
    expect(medianMs(() => compile(doc, id))).toBeLessThan(BUDGET_MS);
  });

  it("scales roughly linearly, so a long page stays usable", () => {
    const small = medianMs(() => compile(pageOf(50), "rentry"));
    const large = medianMs(() => compile(pageOf(500), "rentry"));
    expect(large).toBeLessThan(Math.max(small, 0.05) * 40);
  });

  it("stays inside budget with text that is expensive to escape", () => {
    // Text that is almost entirely escapable punctuation is the worst case for
    // the escaper, and is exactly what a page full of prices and links looks
    // like.
    const blocks: Block[] = [];
    for (let i = 0; i < 50; i += 1) {
      blocks.push({ id: `b${i}`, kind: "heading", text: "*_`[]()#|&<>".repeat(20), level: 2 });
    }
    const doc: Document = { schemaVersion: 1, target: "rentry", blocks };
    expect(medianMs(() => compile(doc, "rentry"))).toBeLessThan(BUDGET_MS);
  });
});
