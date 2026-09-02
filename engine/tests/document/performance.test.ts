import { describe, expect, it } from "vitest";

import { serializeDocument } from "../../src/document/serialize.js";
import type { Block, Document } from "../../src/document/types.js";
import { parseDocument, validateDocument } from "../../src/document/validate.js";

/**
 * The SC-005 guard.
 *
 * The user-facing budget is 100 milliseconds on a mid-range phone. This asserts
 * 25 milliseconds on the development machine, a quarter of it, so there is room
 * for slower hardware and so a regression fails long before a user would feel
 * it.
 *
 * The risk this guards is not that the first implementation is slow. A single
 * pass over a few kilobytes is nowhere near the budget. The risk is that
 * something later makes it slow and nobody notices.
 */

const BUDGET_MS = 25;

function pageOf(blockCount: number): Document {
  const blocks: Block[] = [];
  for (let i = 0; i < blockCount; i += 1) {
    switch (i % 5) {
      case 0:
        blocks.push({ id: `b${i}`, kind: "heading", text: `Section ${i}`, level: 2 });
        break;
      case 1:
        blocks.push({ id: `b${i}`, kind: "prose", heading: "Terms", text: "Half up front. ".repeat(20) });
        break;
      case 2:
        blocks.push({
          id: `b${i}`,
          kind: "menu",
          currency: "USD",
          tiers: [
            { id: `b${i}-0`, name: "Bust", price: "45", blurb: "Head and shoulders", includes: ["1 revision", "PNG"] },
            { id: `b${i}-1`, name: "Half body", price: "from 80" },
          ],
          addOns: [{ name: "Extra character", price: "20" }],
        });
        break;
      case 3:
        blocks.push({
          id: `b${i}`,
          kind: "gallery",
          layout: "grid",
          items: [
            { imageUrl: `https://example.test/${i}-a.png`, caption: "Recent" },
            { imageUrl: `https://example.test/${i}-b.png` },
          ],
        });
        break;
      default:
        blocks.push({ id: `b${i}`, kind: "divider" });
    }
  }
  return { schemaVersion: 1, target: "rentry", title: "Commissions", blocks };
}

/** Median of several runs, so one scheduling hiccup cannot fail the build. */
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

describe("SC-005: opening a page feels immediate", () => {
  it(`validates a 50 block page in under ${BUDGET_MS}ms`, () => {
    const page = pageOf(50);
    const elapsed = medianMs(() => {
      validateDocument(page);
    });
    expect(elapsed).toBeLessThan(BUDGET_MS);
  });

  it(`parses and validates a 50 block page from text in under ${BUDGET_MS}ms`, () => {
    const text = serializeDocument(pageOf(50));
    const elapsed = medianMs(() => {
      parseDocument(text);
    });
    expect(elapsed).toBeLessThan(BUDGET_MS);
  });

  it(`serializes a 50 block page in under ${BUDGET_MS}ms`, () => {
    const page = pageOf(50);
    const elapsed = medianMs(() => {
      serializeDocument(page);
    });
    expect(elapsed).toBeLessThan(BUDGET_MS);
  });

  it("does not degrade sharply with size, so a large page stays usable", () => {
    // Roughly linear is what a single pass should give. A quadratic path, for
    // example a duplicate-id check that scanned the list per block, would show
    // up here as the ratio blowing out.
    const small = medianMs(() => validateDocument(pageOf(50)));
    const large = medianMs(() => validateDocument(pageOf(500)));
    expect(large).toBeLessThan(Math.max(small, 0.05) * 40);
  });
});
