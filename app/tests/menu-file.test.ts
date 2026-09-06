/**
 * @vitest-environment jsdom
 *
 * The saved menu file, which is the only artifact this project produces that
 * other people open directly.
 *
 * Everything asserted here is a clause of `specs/024-menu-file/contracts/menu-file.md`.
 * The file is produced and then read, rather than the code that produces it
 * being read, because the contract is about the file.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { MENU_FILE, compile } from "@mdsb/engine";
import type { Block, Document } from "@mdsb/engine";

import { NO_ASSETS, buildMenuFile, fetchPictures } from "../src/menu-file.js";

function page(...blocks: Block[]): Document {
  return { schemaVersion: 4, target: "rentry", title: "Ridgeline Carry", blocks };
}

/** A page with the two things a menu is: a heading and a list of prices. */
function menuPage(): Document {
  return page(
    { id: "h", kind: "heading", text: "Ridgeline Carry", level: 1 },
    {
      id: "m",
      kind: "menu",
      heading: "What I make",
      tiers: [
        { id: "t1", name: "Brass keyring", price: "18" },
        { id: "t2", name: "Machined pen", price: "62" },
      ],
    },
  );
}

describe("the file shows the seller's page", () => {
  it("carries the headings the page has", () => {
    const { html } = buildMenuFile(menuPage(), NO_ASSETS);
    expect(html).toContain("<h1>Ridgeline Carry</h1>");
    expect(html).toContain("What I make");
  });

  it("carries the price table as a real table", () => {
    const { html } = buildMenuFile(menuPage(), NO_ASSETS);
    expect(html).toContain("<table>");
    expect(html).toContain("<th>Item</th>");
    expect(html).toContain("<td>Brass keyring</td>");
    expect(html).toContain("<td>18</td>");
  });

  it("keeps the table in its scroll wrapper, so a phone does not scroll sideways", () => {
    // The structure the stylesheet's overflow rule hangs off. Widths are
    // measured in a real browser by `npm run menu-file`; jsdom lays out nothing.
    const { html } = buildMenuFile(menuPage(), NO_ASSETS);
    expect(html).toContain('<div class="table-scroll" tabindex="0"><table>');
  });

  it("makes the scrolling wrapper reachable by keyboard", () => {
    // A region somebody has to drag sideways to finish reading is a region a
    // keyboard user cannot finish reading unless it can be focused. WCAG 2.1.1,
    // and the first thing `npm run menu-file` found when it started running axe
    // over a laid out page.
    expect(buildMenuFile(menuPage(), NO_ASSETS).html).toContain('class="table-scroll" tabindex="0"');
  });

  it("is the compiled menu file output, not a second render of the page", () => {
    // Principle VII. Everything the file shows has to come through
    // `compile(doc, MENU_FILE)`, or the file and the preview can disagree.
    const doc = menuPage();
    const compiled = compile(doc, MENU_FILE);
    expect(compiled.markdown).toContain("| Item | Price |");
    const { html } = buildMenuFile(doc, NO_ASSETS);
    for (const cell of ["Brass keyring", "Machined pen", "62"]) {
      expect(html).toContain(cell);
    }
  });

  it("names the page in its title", () => {
    expect(buildMenuFile(menuPage(), NO_ASSETS).html).toContain("<title>Ridgeline Carry</title>");
  });
});

describe("the file carries its own styling and fetches nothing", () => {
  it("has a stylesheet inside it", () => {
    const { html } = buildMenuFile(menuPage(), NO_ASSETS);
    expect(html).toContain("<style>");
    expect(html).toContain(".table-scroll");
    expect(html).toContain(".rendered table");
  });

  it("carries both palettes, so it respects the reader's own setting", () => {
    const { html } = buildMenuFile(menuPage(), NO_ASSETS);
    expect(html).toContain("prefers-color-scheme: dark");
    // The light palette is the unconditional one, so it is asserted by a value
    // rather than by a media query.
    expect(html).toContain("--ink: #16151b");
    expect(html).toContain("--ink: #f2f0ee");
  });

  it("links no stylesheet and no font", () => {
    const { html } = buildMenuFile(menuPage(), NO_ASSETS);
    expect(html).not.toContain("<link");
    expect(html).not.toContain("@import");
    expect(html).not.toContain("@font-face");
    expect(html.toLowerCase()).not.toContain("url(");
  });

  it("references nothing outside itself when the page has no web pictures", () => {
    const { html } = buildMenuFile(menuPage(), NO_ASSETS);
    expect(html).not.toMatch(/(src|href)="https?:/);
  });
});

describe("nothing in the file is executable", () => {
  it("contains no script", () => {
    const { html } = buildMenuFile(menuPage(), NO_ASSETS);
    expect(html.toLowerCase()).not.toContain("<script");
  });

  it("contains no event handler attribute", () => {
    const { html } = buildMenuFile(menuPage(), NO_ASSETS);
    expect(html).not.toMatch(/\son[a-z]+\s*=/i);
  });
});

describe("a picture held at a web address", () => {
  /** A page with one picture on an item, at an address on somebody's website. */
  function webPicturePage(): Document {
    return page({
      id: "m",
      kind: "menu",
      heading: "Fruit",
      tiers: [{ id: "t1", name: "Oranges", price: "4", imageUrls: ["https://shop.test/o.png"] }],
    });
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /**
   * A reply, without `Response`.
   *
   * The jsdom environment has no `Response` constructor, so a stub built on one
   * threw inside the fetch and was swallowed by the best-effort catch: the test
   * failed with the picture still a web address and no error to read.
   */
  function reply(body: BlobPart, type: string): { ok: boolean; blob: () => Promise<Blob> } {
    return { ok: true, blob: async () => new Blob([body], { type }) };
  }

  it("is read and embedded, so the file needs no connection", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => reply(new Uint8Array([1, 2, 3]), "image/png")));

    const doc = webPicturePage();
    const pictures = await fetchPictures(doc);
    const { html, notes } = buildMenuFile(doc, NO_ASSETS, pictures);

    expect(html).toContain('src="data:image/png;base64,');
    expect(html).not.toContain("https://shop.test/o.png");
    expect(notes).toEqual([]);
  });

  it("stays a web address when the website refuses, and the seller is told which", async () => {
    // FR-076. The file is still produced, that picture still works with a
    // connection, and silently producing a file with a hole in it is the
    // defect this is here to stop.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );

    const doc = webPicturePage();
    const { html, notes } = buildMenuFile(doc, NO_ASSETS, await fetchPictures(doc));

    expect(html).toContain('src="https://shop.test/o.png"');
    expect(notes.join(" ")).toContain("Oranges");
    expect(notes.join(" ")).toContain("only shows with a connection");
  });

  it("refuses a reply that is not an image", async () => {
    // An address that answers with a login page is not a picture, and turning
    // one into a data URI would embed somebody's HTML into the seller's menu.
    vi.stubGlobal("fetch", vi.fn(async () => reply("<html>", "text/html")));

    const doc = webPicturePage();
    const { html } = buildMenuFile(doc, NO_ASSETS, await fetchPictures(doc));
    expect(html).toContain('src="https://shop.test/o.png"');
    expect(html).not.toContain("data:text/html");
  });
});

describe("a picture held on the device that cannot be resolved", () => {
  /** A page whose item has a picture on the device rather than at an address. */
  function localPicturePage(): Document {
    return page({
      id: "m",
      kind: "menu",
      heading: "Fruit",
      tiers: [
        { id: "t1", name: "Oranges", price: "4", localImageIds: ["a1-oranges"] },
        { id: "t2", name: "Lemons", price: "3" },
      ],
    });
  }

  it("puts no asset address anywhere in the file", () => {
    // The contract: "A saved menu file containing the text `mdsb-asset:`
    // anywhere is a defect." The renderer degrades an address it refuses to
    // literal text, so without the resolver step this would be visible words
    // in the middle of the seller's price list.
    const compiled = compile(localPicturePage(), MENU_FILE);
    expect(compiled.markdown, "the fixture must actually carry one").toContain("mdsb-asset:");

    const { html } = buildMenuFile(localPicturePage(), NO_ASSETS);
    expect(html).not.toContain("mdsb-asset:");
  });

  it("removes the picture rather than leaving it broken, and names the item", () => {
    const { html, notes } = buildMenuFile(localPicturePage(), NO_ASSETS);
    expect(html).not.toContain("<img");
    expect(notes.join(" ")).toContain("Oranges");
    // FR-081: what the seller is told never names the file or the identifier.
    expect(notes.join(" ")).not.toContain("a1-oranges");
    // The rest of the page is untouched.
    expect(html).toContain("Lemons");
  });

  it("asks the resolver for the identifier the seller's page stores, undecorated", () => {
    // `encodeAddress` percent-encodes brackets, quotes and whitespace, so the
    // address in the compiled output is not the identifier. `decodeURIComponent`
    // is the wrong way to undo that: a literal `%` survives encoding untouched
    // and would decode to a different identifier, and `100%` would throw.
    const asked: string[] = [];
    const doc = page({
      id: "m",
      kind: "menu",
      tiers: [{ id: "t1", name: "Odd", price: "1", localImageIds: ["a%41b (one) 100%"] }],
    });

    buildMenuFile(doc, (id) => {
      asked.push(id);
      return undefined;
    });

    expect(asked).toEqual(["a%41b (one) 100%"]);
  });
});
