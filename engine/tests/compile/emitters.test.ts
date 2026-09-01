import { describe, expect, it } from "vitest";

import { compile } from "../../src/compile/compile.js";
import type { Target } from "../../src/compile/capabilities.js";
import { PORTABLE } from "../../src/compile/targets.js";
import type { Block, Document } from "../../src/document/types.js";

/**
 * The four remaining emitters. FR-001 to FR-008, SC-001 to SC-004.
 */

function page(...blocks: Block[]): Document {
  return { schemaVersion: 1, target: "portable", blocks };
}

const md = (...blocks: Block[]): string => compile(page(...blocks), "portable").markdown;

/** A host identical to portable except that it has no tables. */
const NO_TABLES: Target = {
  ...PORTABLE,
  id: "no-tables-test-host",
  name: "No Tables Test Host",
  capabilities: { ...PORTABLE.capabilities, tables: false },
};

describe("FR-001: every block kind emits", () => {
  it("emits all six kinds with no unsupported warnings", () => {
    const out = compile(
      page(
        { id: "p", kind: "profile", displayName: "Ari" },
        { id: "h", kind: "heading", text: "Menu", level: 2 },
        { id: "m", kind: "menu", tiers: [{ name: "Bust", price: "45" }] },
        { id: "g", kind: "gallery", layout: "list", items: [{ imageUrl: "https://e.test/a.png" }] },
        { id: "t", kind: "prose", text: "Half up front." },
        { id: "d", kind: "divider" },
      ),
      "portable",
    );
    // There is no longer a "not supported" code to check for: every kind has an
    // emitter, so a clean page produces no diagnostics at all.
    expect(out.diagnostics).toEqual([]);
    for (const fragment of ["Ari", "Menu", "Bust", "a.png", "Half up front", "***"]) {
      expect(out.markdown).toContain(fragment);
    }
  });
});

describe("prose", () => {
  it("separates paragraphs with a blank line", () => {
    expect(md({ id: "p", kind: "prose", text: "One.\n\nTwo." })).toBe("One.\n\nTwo.\n");
  });

  it("turns a single newline into a hard line break with no trailing space", () => {
    const out = md({ id: "p", kind: "prose", text: "Line one\nLine two" });
    expect(out).toBe("Line one\\\nLine two\n");
    for (const line of out.split("\n")) expect(line).toBe(line.replace(/[ \t]+$/, ""));
  });

  it("emits its heading at the shared section level", () => {
    expect(md({ id: "p", kind: "prose", heading: "Terms", text: "Body." })).toBe(
      "### Terms\n\nBody.\n",
    );
  });

  it("produces nothing for text that is only whitespace", () => {
    expect(md({ id: "p", kind: "prose", text: "   \n\n  " })).toBe("");
  });

  it("escapes everything outside the inline grammar", () => {
    // A bullet is now a real bullet, since roadmap 1.7. A heading is not in the
    // grammar and stays text, and HTML is still entity encoded.
    const out = md({ id: "p", kind: "prose", text: "# Heading\n\n- item\n\n<script>x</script>" });
    expect(out).not.toContain("<");
    expect(out).toContain("\\# Heading");
    expect(out).toContain("- item");
  });

  it("emits a bullet list when every line in a chunk is a bullet", () => {
    const out = md({ id: "p", kind: "prose", text: "- one\n- two\n- three" });
    expect(out).toBe("- one\n- two\n- three\n");
  });

  it("keeps an intro line as prose and the bullets under it as a list", () => {
    // The shape artists actually write. An earlier version required every line
    // in the chunk to be a bullet, which turned this into escaped text with a
    // visible backslash in front of every dash.
    const out = md({ id: "p", kind: "prose", text: "I will not draw:\n- hate symbols\n- minors" });
    expect(out).toBe("I will not draw:\n\n- hate symbols\n- minors\n");
  });

  it("formats bold, italic, and links inside a paragraph", () => {
    const out = md({
      id: "p",
      kind: "prose",
      text: "**Half** up front. See *terms* at [my page](https://e.test/tos).",
    });
    expect(out).toContain("**Half**");
    expect(out).toContain("*terms*");
    expect(out).toContain("[my page](https://e.test/tos)");
  });

  it("formats inside list items too", () => {
    const out = md({ id: "p", kind: "prose", text: "- **one**\n- [two](https://e.test)" });
    expect(out).toBe("- **one**\n- [two](https://e.test)\n");
  });

  it("still refuses an unsafe link inside prose", () => {
    const out = md({ id: "p", kind: "prose", text: "[click](javascript:alert(1))" });
    // The property, not a proxy for it: a link needs an unescaped closing
    // bracket, and this one is escaped. Round brackets stopped being escaped in
    // feature 013, so the old assertion matched a substring that is harmless.
    expect(out).not.toMatch(/(^|[^\\])\]\(/);
    expect(out).toContain("click");
  });
});

describe("menu", () => {
  const tiers = [
    { name: "Bust", price: "45", blurb: "Head and shoulders", includes: ["1 revision", "PNG"] },
    { name: "Full body", price: "DM me" },
  ];

  it("lays tiers out as a table where the host supports tables (FR-002)", () => {
    const out = md({ id: "m", kind: "menu", currency: "USD", tiers });
    expect(out).toContain("| Item | Price | What you get |");
    expect(out).toContain("| Bust | USD 45 | Head and shoulders. 1 revision, PNG |");
    expect(out).toContain("| Full body | DM me |");
  });

  it("does not add a full stop to a blurb that already has one", () => {
    // The blurb and the includes list share one column, because a table cell
    // cannot hold a bullet list, and they were joined with ". " whatever the
    // blurb ended in. Most people end a sentence with a full stop, so a real
    // storefront came out with "tumbled finish.. CPM-S35VN blade" eight times
    // over. Every fixture happened to use a blurb without one.
    const out = md({
      id: "m",
      kind: "menu",
      tiers: [{ name: "Mk III", price: "185", blurb: "Titanium frame lock.", includes: ["S35VN blade"] }],
    });
    // Matched with the escape optional, so this keeps asserting the thing it is
    // about if the escaper's breadth ever changes.
    expect(out).toMatch(/Titanium frame lock\\?\. S35VN blade/);
    expect(out).not.toContain("..");
  });

  it("still joins with a full stop when the blurb does not end in one", () => {
    const out = md({
      id: "m",
      kind: "menu",
      tiers: [{ name: "Mk III", price: "185", blurb: "Titanium frame lock", includes: ["S35VN blade"] }],
    });
    expect(out).toMatch(/Titanium frame lock\\?\. S35VN blade/);
  });

  it("puts a currency symbol against the digits and a currency word apart from them", () => {
    const symbol = md({ id: "m", kind: "menu", currency: "$", tiers: [{ name: "Bananas", price: "20", unit: "per lb" }] });
    expect(symbol).toContain("| Bananas | &#36;20 per lb |");

    const word = md({ id: "m", kind: "menu", currency: "USD", tiers: [{ name: "Bananas", price: "20" }] });
    expect(word).toContain("| Bananas | USD 20 |");
  });

  it("says what the price buys, beside the price", () => {
    // Twenty dollars of bananas is not a price until you know it buys a pound.
    const out = md({
      id: "m",
      kind: "menu",
      currency: "USD",
      tiers: [{ name: "Bananas", price: "20", unit: "per lb" }],
    });
    expect(out).toContain("| Bananas | USD 20 per lb |");
  });

  it("leaves a unit alone on a price that is not a number", () => {
    const out = md({
      id: "m",
      kind: "menu",
      tiers: [{ name: "Consulting", price: "ask", unit: "per hour" }],
    });
    expect(out).toContain("| Consulting | ask per hour |");
  });

  it("gives details their own column, only when something has any", () => {
    const withNone = md({ id: "m", kind: "menu", tiers: [{ name: "Bust", price: "45" }] });
    expect(withNone).not.toContain("Details");

    const out = md({
      id: "m",
      kind: "menu",
      tiers: [
        { name: "Pixel 6a", price: "180", unit: "each", details: [
          { label: "Colour", value: "black" },
          { label: "Storage", value: "128GB" },
        ] },
        { name: "Case", price: "12" },
      ],
    });
    expect(out).toContain("| Item | Price | Details |");
    expect(out).toContain("| Pixel 6a | 180 each | Colour: black, Storage: 128GB |");
    // The item with no details still has a cell, or the row is short and the
    // table stops being rectangular.
    expect(out).toContain("| Case | 12 |  |");
    const lines = out.split("\n").filter((l) => l.startsWith("|"));
    expect(new Set(lines.map((l) => (l.match(/(?<!\\)\|/g) ?? []).length)).size).toBe(1);
  });

  it("leaves out a detail that was started and abandoned", () => {
    // FR-026a, the same rule an item itself already follows.
    const out = md({
      id: "m",
      kind: "menu",
      tiers: [{ name: "Bananas", price: "20", details: [
        { label: "Origin", value: "Ecuador" },
        { label: "", value: "" },
        { label: "Colour", value: "" },
        { label: "", value: "yellow" },
      ] }],
    });
    expect(out).toContain("| Bananas | 20 | Origin: Ecuador |");
    expect(out).not.toContain("Colour");
    expect(out).not.toContain("yellow");
  });

  it("lists the unit and details without tables, in the fallback", () => {
    const out = compile(
      page({
        id: "m",
        kind: "menu",
        tiers: [{ name: "Bananas", price: "20", unit: "per lb", details: [{ label: "Origin", value: "Ecuador" }] }],
      }),
      NO_TABLES,
    ).markdown;
    expect(out).toContain("**Bananas**: 20 per lb");
    expect(out).toContain("- Origin: Ecuador");
  });

  it("nothing changes for a price list that uses neither", () => {
    // FR-027. The guarantee that made this safe to land.
    const out = md({ id: "m", kind: "menu", currency: "USD", tiers });
    expect(out).toContain("| Item | Price | What you get |");
    expect(out).not.toContain("Details");
    expect(out).toContain("| Bust | USD 45 | Head and shoulders. 1 revision, PNG |");
  });

  it("adds the currency only to a price that is purely a number", () => {
    const bare = md({ id: "m", kind: "menu", currency: "USD", tiers: [{ name: "A", price: "45" }] });
    expect(bare).toContain("| A | USD 45 |");

    // Anything with a letter in it is left exactly as written. An earlier
    // version produced "USD DM me", which reads as the artist's mistake.
    for (const price of ["DM me", "from 45", "USD 10", "ask"]) {
      const out = md({ id: "m", kind: "menu", currency: "USD", tiers: [{ name: "A", price }] });
      expect(out).toContain(`| A | ${price} |`);
    }
  });

  it("degrades to a readable list without tables, and warns (FR-002)", () => {
    const out = compile(page({ id: "m", kind: "menu", tiers }), NO_TABLES);
    expect(out.markdown).toContain("**Bust**: 45");
    expect(out.markdown).not.toContain("| Item |");
    const warning = out.diagnostics.find((d) => d.code === "table_unsupported");
    expect(warning?.blockId).toBe("m");
    expect(warning?.capability).toBe("tables");
    expect(warning?.message).toContain("No Tables Test Host");
  });

  it("does not warn when the host has tables", () => {
    expect(compile(page({ id: "m", kind: "menu", tiers }), "portable").diagnostics).toEqual([]);
  });

  it("cannot have its table broken by a pipe in a price (FR-003)", () => {
    const out = md({ id: "m", kind: "menu", tiers: [{ name: "A|B", price: "1|2" }] });
    // Every pipe the artist wrote is escaped, so the only unescaped ones left
    // are cell separators, and a broken table would have more in one row than
    // in the header. Asserted as rectangularity rather than as a fixed count of
    // four: the columns are conditional now, so a count is a statement about
    // which columns this fixture happens to use, and the property being
    // defended is that the artist's text cannot add one.
    const lines = out.split("\n").filter((l) => l.startsWith("|"));
    expect(new Set(lines.map((l) => (l.match(/(?<!\\)\|/g) ?? []).length)).size).toBe(1);
    expect(out).toContain("\\|");
  });

  it("cannot have its table broken by a newline in a cell (FR-003)", () => {
    const out = md({ id: "m", kind: "menu", tiers: [{ name: "A\nB", price: "1" }] });
    expect(out.split("\n").filter((l) => l.startsWith("|"))).toHaveLength(3);
  });

  it("emits nothing for a menu with no tiers and no add ons (FR-007)", () => {
    expect(md({ id: "m", kind: "menu", tiers: [] })).toBe("");
  });

  /**
   * An item with neither a name nor a price is not an item.
   *
   * Pressing "Add another item" and then leaving it produced a row of empty
   * cells in the pasted page: `|  |  |  |`. A client reading the page sees a
   * gap in the price list and no way to know what it was meant to be. Found by
   * pasting a real export off the phone.
   */
  it("leaves out an item that has neither a name nor a price, and says so", () => {
    const out = compile(
      page({ id: "m", kind: "menu", tiers: [{ name: "Bust", price: "45" }, { name: "", price: "" }] }),
      "portable",
    );
    expect(out.markdown).toContain("| Bust | 45 |");
    expect(out.markdown).not.toMatch(/^\|\s+\|\s+\|/m);

    const warning = out.diagnostics.find((d) => d.code === "item_omitted");
    expect(warning?.blockId).toBe("m");
    expect(warning?.severity).toBe("warning");
  });

  it("keeps an item that has only a price, and one that has only a name", () => {
    const out = md({
      id: "m",
      kind: "menu",
      tiers: [{ name: "Sketch", price: "" }, { name: "", price: "DM me" }],
    });
    expect(out).toContain("| Sketch |  |");
    expect(out).toContain("|  | DM me |");
  });

  it("drops the empty item from the list form too, where there are no tables", () => {
    const out = compile(
      page({ id: "m", kind: "menu", tiers: [{ name: "Bust", price: "45" }, { name: "", price: "" }] }),
      NO_TABLES,
    );
    expect(out.markdown).toContain("**Bust**: 45");
    expect(out.markdown).not.toContain("****");
  });

  it("emits nothing at all when every item is empty", () => {
    const out = compile(page({ id: "m", kind: "menu", tiers: [{ name: "", price: "" }] }), "portable");
    expect(out.markdown).toBe("");
    expect(out.diagnostics.some((d) => d.code === "item_omitted")).toBe(true);
  });

  /**
   * A section that produces nothing says so.
   *
   * An empty Prices section, an empty Text section and a Gallery with no
   * images all vanished from the preview with no explanation, which reads as
   * the tool having lost them. Found on the phone: a page with three sections
   * previewed as one, and Preview offered not a word about the other two.
   */
  it("says when a section produced nothing at all", () => {
    const out = compile(page({ id: "m", kind: "menu", tiers: [] }), "portable");
    const note = out.diagnostics.find((d) => d.code === "section_empty");
    expect(note?.blockId).toBe("m");
    expect(note?.severity).toBe("info");
  });

  /**
   * Two notes about one section must not contradict each other.
   *
   * Seen on the phone: pasting a javascript: address into a gallery produced
   * "one of your images does not have an http address, so it has been left
   * out", correctly, and then "this section has nothing in it yet, fill it in
   * and it will show up", which is false. The artist had just filled it in. The
   * preview also offered two identical buttons to go to the same section.
   *
   * Saying nothing is here, immediately after saying what was removed, is worse
   * than saying nothing at all: it sends the artist to look for a problem they
   * have already been told about, described as a different problem.
   */
  it("does not also call a section empty when something else explains why", () => {
    const out = compile(
      page({ id: "g", kind: "gallery", layout: "grid", items: [{ imageUrl: "javascript:alert(1)" }] }),
      "portable",
    );
    expect(out.markdown).toBe("");
    expect(out.diagnostics.map((d) => d.code)).toEqual(["link_scheme_refused"]);
  });

  it("does not call a price list empty when its only item was left out", () => {
    const out = compile(page({ id: "m", kind: "menu", tiers: [{ name: "", price: "" }] }), "portable");
    expect(out.markdown).toBe("");
    expect(out.diagnostics.map((d) => d.code)).toEqual(["item_omitted"]);
  });

  it("still calls a section empty when nothing else has anything to say", () => {
    const out = compile(page({ id: "p", kind: "prose", text: "" }), "portable");
    expect(out.diagnostics.map((d) => d.code)).toEqual(["section_empty"]);
  });

  it("offers one way back to a section, not one per note", () => {
    const out = compile(
      page({ id: "g", kind: "gallery", layout: "grid", items: [{ imageUrl: "javascript:alert(1)" }] }),
      "portable",
    );
    const forThisBlock = out.diagnostics.filter((d) => d.blockId === "g");
    expect(forThisBlock).toHaveLength(1);
  });

  it("warns once however many empty items there are", () => {
    const out = compile(
      page({ id: "m", kind: "menu", tiers: [{ name: "", price: "" }, { name: "", price: "" }] }),
      "portable",
    );
    expect(out.diagnostics.filter((d) => d.code === "item_omitted")).toHaveLength(1);
  });

  it("emits add ons as a list", () => {
    const out = md({
      id: "m",
      kind: "menu",
      tiers: [],
      addOns: [{ name: "Extra character", price: "20" }],
    });
    expect(out).toBe("- Extra character: 20\n");
  });
});

describe("gallery", () => {
  const items = [
    { imageUrl: "https://e.test/a.png", caption: "Sketch" },
    { imageUrl: "https://e.test/b.png" },
  ];

  it("places grid images side by side using a table", () => {
    const out = md({ id: "g", kind: "gallery", layout: "grid", items });
    expect(out).toContain("| ![Sketch](https://e.test/a.png) | ![](https://e.test/b.png) |");
  });

  it("pads the final grid row so the table stays rectangular", () => {
    const out = md({ id: "g", kind: "gallery", layout: "grid", items: [items[0]!] });
    expect(out).toContain("| ![Sketch](https://e.test/a.png) |  |");
  });

  it("puts one image per line for list and single", () => {
    for (const layout of ["list", "single"] as const) {
      const out = md({ id: "g", kind: "gallery", layout, items });
      expect(out).toContain("![Sketch](https://e.test/a.png)");
      expect(out).not.toContain("| ---");
    }
  });

  it("repeats the caption below the image, since alt text is not shown", () => {
    const out = md({ id: "g", kind: "gallery", layout: "list", items: [items[0]!] });
    expect(out).toBe("![Sketch](https://e.test/a.png)\n\nSketch\n");
  });

  it("leaves out an image whose address is not http, and warns (SC-003)", () => {
    const out = compile(
      page({
        id: "g",
        kind: "gallery",
        layout: "list",
        items: [{ imageUrl: "javascript:alert(1)" }, { imageUrl: "https://e.test/ok.png" }],
      }),
      "portable",
    );
    expect(out.markdown).not.toContain("javascript");
    expect(out.markdown).toContain("ok.png");
    expect(out.diagnostics.find((d) => d.code === "link_scheme_refused")?.blockId).toBe("g");
  });

  it("emits nothing for a gallery with no items (FR-007)", () => {
    expect(md({ id: "g", kind: "gallery", layout: "grid", items: [] })).toBe("");
  });

  it("keeps a heading even when every image was refused", () => {
    const out = md({
      id: "g",
      kind: "gallery",
      heading: "Work",
      layout: "list",
      items: [{ imageUrl: "data:image/png;base64,AAA" }],
    });
    expect(out).toBe("### Work\n");
  });

  it("wraps an image in a link when the link is safe", () => {
    const out = md({
      id: "g",
      kind: "gallery",
      layout: "list",
      items: [{ imageUrl: "https://e.test/a.png", linkUrl: "https://e.test/post" }],
    });
    expect(out).toBe("[![](https://e.test/a.png)](https://e.test/post)\n");
  });

  it("shows the image but drops an unsafe link", () => {
    const out = md({
      id: "g",
      kind: "gallery",
      layout: "list",
      items: [{ imageUrl: "https://e.test/a.png", linkUrl: "javascript:alert(1)" }],
    });
    expect(out).toBe("![](https://e.test/a.png)\n");
  });
});

describe("profile", () => {
  it("uses the display name as the section heading", () => {
    expect(md({ id: "p", kind: "profile", displayName: "Ari" })).toBe("### Ari\n");
  });

  it("renders status in words a client understands", () => {
    expect(md({ id: "p", kind: "profile", displayName: "Ari", status: "open" })).toContain(
      "**Commissions are OPEN**",
    );
    expect(md({ id: "p", kind: "profile", displayName: "Ari", status: "waitlist" })).toContain(
      "**Waitlist only**",
    );
  });

  it("emits links as a list, refusing unsafe ones (SC-003)", () => {
    const out = compile(
      page({
        id: "p",
        kind: "profile",
        displayName: "Ari",
        links: [
          { label: "Bluesky", url: "https://e.test/ari" },
          { label: "Bad", url: "javascript:alert(1)" },
        ],
      }),
      "portable",
    );
    expect(out.markdown).toContain("- [Bluesky](https://e.test/ari)");
    expect(out.markdown).toContain("- Bad");
    expect(out.markdown).not.toContain("javascript");
    expect(out.diagnostics.find((d) => d.code === "link_scheme_refused")?.blockId).toBe("p");
  });

  it("emits the whole profile in a stable order", () => {
    const out = md({
      id: "p",
      kind: "profile",
      displayName: "Ari",
      avatarUrl: "https://e.test/me.png",
      tagline: "Character artist",
      status: "open",
      links: [{ label: "Bluesky", url: "https://e.test/ari" }],
      paymentMethods: ["PayPal", "Ko-fi"],
    });
    expect(out).toBe(
      [
        "### Ari",
        "",
        "![](https://e.test/me.png)",
        "",
        "*Character artist*",
        "",
        "**Commissions are OPEN**",
        "",
        "- [Bluesky](https://e.test/ari)",
        "",
        "Payment: PayPal, Ko-fi",
        "",
      ].join("\n"),
    );
  });

  it("omits an avatar whose address is not http", () => {
    expect(md({ id: "p", kind: "profile", displayName: "Ari", avatarUrl: "data:x" })).toBe("### Ari\n");
  });
});

describe("SC-002: nothing an artist writes escapes its section", () => {
  const payloads = [
    "<script>alert(1)</script>",
    "| broken | table |",
    "\n\n# injected\n\n",
    "***",
    "```fence```",
    "](evil) [",
    " next line",
  ];

  it.each(payloads)("survives %j in every text field", (payload) => {
    const out = compile(
      page(
        { id: "p", kind: "profile", displayName: payload, tagline: payload, paymentMethods: [payload] },
        { id: "m", kind: "menu", heading: payload, tiers: [{ name: payload, price: payload }] },
        { id: "g", kind: "gallery", heading: payload, layout: "grid", items: [] },
        { id: "t", kind: "prose", heading: payload, text: payload },
      ),
      "portable",
    );

    expect(out.markdown).not.toContain("<");
    expect(out.markdown).not.toContain(">");

    // Every table row still has the structure a table row must have.
    for (const line of out.markdown.split("\n")) {
      if (line.startsWith("|")) expect(line.split(" | ").length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("menu tier sample images (roadmap 3.1)", () => {
  const withImage = [
    { name: "Bust", price: "45", imageUrl: "https://e.test/bust.png" },
    { name: "Full body", price: "80" },
  ];

  it("adds an Example column only when a tier actually has an image", () => {
    const out = md({ id: "m", kind: "menu", tiers: withImage });
    // Neither item has a blurb, so "What you get" is correctly absent too:
    // every optional column earns its place now, not just this one.
    expect(out).toContain("| Item | Price | Example |");
    expect(out).toContain("| --- | --- | --- |");
    expect(out).toContain("![Bust](https://e.test/bust.png)");
  });

  it("omits the column entirely when no tier has one", () => {
    const out = md({ id: "m", kind: "menu", tiers: [{ name: "A", price: "1" }] });
    expect(out).not.toContain("Example");
  });

  it("keeps only the columns something is actually written in", () => {
    // Every optional column earns its place. A name, a price and a unit is a
    // whole price list for a greengrocer, and it used to come out with an empty
    // "What you get" column on every row.
    const bare = md({ id: "m", kind: "menu", tiers: [{ name: "Bananas", price: "20", unit: "per lb" }] });
    expect(bare).toContain("| Item | Price |");
    expect(bare).toContain("| --- | --- |");
    expect(bare).not.toContain("What you get");
    expect(bare).not.toContain("Details");
    expect(bare).not.toContain("Example");
    expect(bare).toContain("| Bananas | 20 per lb |");
  });

  it("leaves the cell empty for a tier without an image, keeping the table square", () => {
    const out = md({ id: "m", kind: "menu", tiers: withImage });
    const rows = out.split("\n").filter((l) => l.startsWith("|"));
    const counts = rows.map((r) => r.match(/(?<!\\)\|/g)?.length ?? 0);
    expect(new Set(counts).size).toBe(1);
  });

  it("shows the image under the tier when the host has no tables", () => {
    const out = compile(page({ id: "m", kind: "menu", tiers: withImage }), NO_TABLES);
    expect(out.markdown).toContain("![Bust](https://e.test/bust.png)");
  });

  it("refuses an unsafe example address and warns rather than dropping it silently", () => {
    const out = compile(
      page({ id: "m", kind: "menu", tiers: [{ name: "A", price: "1", imageUrl: "javascript:alert(1)" }] }),
      "portable",
    );
    expect(out.markdown).not.toContain("javascript");
    const warning = out.diagnostics.find((d) => d.code === "link_scheme_refused");
    expect(warning?.blockId).toBe("m");
  });
});
