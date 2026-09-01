import { describe, expect, it } from "vitest";

import { compile } from "../../src/compile/compile.js";
import type { Target } from "../../src/compile/capabilities.js";
import { PORTABLE } from "../../src/compile/targets.js";
import type { Block, Document } from "../../src/document/types.js";

/**
 * More than one picture of an item. Schema version 2.
 *
 * One field made the gallery the only place to put a second angle, and a
 * gallery picture says nothing about which product it belongs to. A print, a
 * knife or a bag wants a front, a back and a detail.
 *
 * The risk is the same one the quantity layout carried: a change that helps a
 * merchant must cost an artist nothing. So most of this is about the page that
 * has one picture, or none, still compiling to exactly what it always did.
 */

function page(...blocks: Block[]): Document {
  return { schemaVersion: 2, target: "portable", blocks };
}

const md = (...blocks: Block[]): string => compile(page(...blocks), "portable").markdown;

const NO_TABLES: Target = {
  ...PORTABLE,
  id: "no-tables-test-host",
  name: "No Tables Test Host",
  capabilities: { ...PORTABLE.capabilities, tables: false },
};

describe("one picture behaves exactly as it always did", () => {
  it("stays a column in the table", () => {
    const out = md({
      id: "m",
      kind: "menu",
      tiers: [
        { name: "Bust", price: "45", imageUrls: ["https://e.test/a.png"] },
        { name: "Full body", price: "120" },
      ],
    });
    expect(out).toContain("| Item | Price | Example |");
    expect(out).toContain("![Bust](https://e.test/a.png)");
    expect(out).not.toContain("####");
  });

  it("is described by the item's name alone, with no counting", () => {
    const out = md({
      id: "m",
      kind: "menu",
      tiers: [{ name: "Bust", price: "45", imageUrls: ["https://e.test/a.png"] }],
    });
    expect(out).toContain("![Bust]");
    expect(out).not.toContain("picture 1 of 1");
  });

  it("does not trigger the per item layout", () => {
    const out = md({
      id: "m",
      kind: "menu",
      tiers: [
        { name: "Bust", price: "45", imageUrls: ["https://e.test/a.png"] },
        { name: "Half", price: "80", imageUrls: ["https://e.test/b.png"] },
      ],
    });
    expect(out).toContain("| Item | Price |");
    expect(out).not.toContain("####");
  });
});

describe("several pictures earn the item its own block", () => {
  const shop = (): Block => ({
    id: "m",
    kind: "menu",
    currency: "$",
    tiers: [
      {
        name: "Articulated dragon",
        price: "18",
        imageUrls: ["https://e.test/front.png", "https://e.test/back.png", "https://e.test/detail.png"],
      },
      { name: "Desk tray", price: "12", imageUrls: ["https://e.test/tray.png"] },
    ],
  });

  it("switches the section to the per item layout", () => {
    const out = md(shop());
    expect(out).toContain("#### Articulated dragon, &#36;18");
    expect(out).not.toContain("| Item | Price |");
  });

  it("shows every picture", () => {
    const out = md(shop());
    for (const name of ["front", "back", "detail"]) {
      expect(out).toContain(`https://e.test/${name}.png`);
    }
  });

  it("puts them on one line so they read as a row, not a column", () => {
    const out = md(shop());
    const line = out.split("\n").find((l) => l.includes("front.png")) ?? "";
    expect(line).toContain("back.png");
    expect(line).toContain("detail.png");
  });

  it("tells them apart for anyone who cannot see them", () => {
    const out = md(shop());
    expect(out).toContain("![Articulated dragon, picture 1 of 3]");
    expect(out).toContain("![Articulated dragon, picture 2 of 3]");
    expect(out).toContain("![Articulated dragon, picture 3 of 3]");
  });

  it("still names a single picture by the item alone, in the same section", () => {
    const out = md(shop());
    expect(out).toContain("![Desk tray](https://e.test/tray.png)");
  });
});

describe("addresses that cannot be shown", () => {
  it("drops an unsafe one and warns rather than dropping it in silence", () => {
    const out = compile(
      page({
        id: "m",
        kind: "menu",
        tiers: [
          {
            name: "Bust",
            price: "45",
            imageUrls: ["javascript:alert(1)", "https://e.test/ok.png"],
          },
        ],
      }),
      "portable",
    );
    expect(out.markdown).not.toContain("javascript:");
    expect(out.markdown).toContain("https://e.test/ok.png");
    expect(out.diagnostics.map((d) => d.code)).toContain("link_scheme_refused");
  });

  it("counts only the pictures that survived", () => {
    // Otherwise the alt text promises three and the page shows two, which is
    // worse than not counting at all.
    const out = md({
      id: "m",
      kind: "menu",
      tiers: [
        {
          name: "Bust",
          price: "45",
          imageUrls: ["https://e.test/a.png", "javascript:alert(1)", "https://e.test/b.png"],
        },
      ],
    });
    expect(out).toContain("picture 1 of 2");
    expect(out).toContain("picture 2 of 2");
    expect(out).not.toContain("of 3");
  });

  it("does not let an unusable address trigger the per item layout on its own", () => {
    // One real picture and one broken address is a one picture item.
    const out = md({
      id: "m",
      kind: "menu",
      tiers: [
        { name: "Bust", price: "45", imageUrls: ["https://e.test/a.png", "javascript:alert(1)"] },
        { name: "Half", price: "80" },
      ],
    });
    expect(out).toContain("| Item | Price |");
    expect(out).not.toContain("####");
  });
});

describe("a host without tables", () => {
  it("lists every picture under the item", () => {
    const out = compile(
      {
        schemaVersion: 2,
        target: NO_TABLES.id,
        blocks: [
          {
            id: "m",
            kind: "menu",
            tiers: [{ name: "Bust", price: "45", imageUrls: ["https://e.test/a.png", "https://e.test/b.png"] }],
          },
        ],
      },
      NO_TABLES,
    );
    expect(out.markdown).toContain("https://e.test/a.png");
    expect(out.markdown).toContain("https://e.test/b.png");
    expect(out.markdown).not.toContain("| --- |");
  });
});
