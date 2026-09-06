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

import { assetIds } from "../src/assets.js";
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

/**
 * A seller's own words cannot be mistaken for a picture token.
 *
 * The exporter used to find pictures held on the device by matching
 * `![alt](mdsb-asset:id)` in the compiled Markdown and cutting the match out.
 * An item named `X](mdsb-asset:evil)` compiles to an image whose ALT TEXT
 * contains exactly that string, so the pattern matched the seller's own words
 * as though they were the compiler's structure. Removing the supposed token
 * deleted the real picture beside it, left `](https://...)` as visible text in
 * the price table, and added a note telling the seller their picture was not
 * stored on this device. All three wrong, none of them an error.
 *
 * Nothing executed, so it was never a security hole. It quietly mangled the one
 * artifact a seller hands to a customer, which is worse in the way that
 * matters.
 *
 * Resolution now happens on elements, where the seller's text cannot become a
 * node, so the class is gone rather than patched. That only became possible
 * once `render-markdown.ts`'s label pattern was fixed: the same forgery worked
 * against the renderer, and the DOM was not trustworthy until it did not.
 */
describe("a seller's own words cannot be mistaken for a picture token", () => {
  const forged = "X](mdsb-asset:evil)";

  function forgedPage(): Document {
    return page({
      id: "m",
      kind: "menu",
      heading: "Prices",
      tiers: [
        { id: "t1", name: forged, price: "3", imageUrls: ["https://real.test/picture.png"] },
      ],
    });
  }

  it("keeps the real picture the seller actually has", () => {
    expect(buildMenuFile(forgedPage(), NO_ASSETS).html).toContain("https://real.test/picture.png");
  });

  it("says nothing about a missing picture, because none is missing", () => {
    expect(buildMenuFile(forgedPage(), NO_ASSETS).notes).toEqual([]);
  });

  it("puts no asset address in the file", () => {
    expect(buildMenuFile(forgedPage(), NO_ASSETS).html).not.toContain('src="mdsb-asset:');
  });

  it("still shows the seller the name they typed", () => {
    const { html } = buildMenuFile(forgedPage(), NO_ASSETS);
    expect(new DOMParser().parseFromString(html, "text/html").body.textContent).toContain(forged);
  });
});

/**
 * What the compiler says about the menu file reaches the seller.
 *
 * Found by the holistic review, and it is the shape that review exists for.
 * The emitters raise `picture_superseded` when a gallery item or an avatar
 * carries both a picture from the device and a web address, because the device
 * one wins in this file and the other has to be reported rather than vanish.
 * The engine did that correctly and tested it. The app took `.markdown` and
 * threw `.diagnostics` away, and every other surface compiles for the paste
 * host, which never raises it.
 *
 * So the warning existed, passed its tests, and reached nobody. Each side of
 * the seam was right; the wire between them was never run.
 */
describe("the compiler's warnings about this file reach the seller", () => {
  function bothKinds(): Document {
    return page({
      id: "g",
      kind: "gallery",
      heading: "The stall",
      layout: "list",
      items: [
        {
          imageUrl: "https://shop.test/awning.png",
          localImageId: "a1",
          caption: "Saturday morning",
        },
      ],
    });
  }

  it("tells the seller when their web picture gave way to the device one", () => {
    const { notes } = buildMenuFile(bothKinds(), () => "data:image/png;base64,AAAA");
    expect(notes.join(" ")).toContain("Saturday morning");
    expect(notes.join(" ")).toContain("from your device");
  });

  it("names the item rather than the file, so nothing identifies the picture", () => {
    const { notes } = buildMenuFile(bothKinds(), () => "data:image/png;base64,AAAA");
    expect(notes.join(" ")).not.toContain("a1");
  });

  it("says nothing when there is nothing to say", () => {
    expect(buildMenuFile(menuPage(), NO_ASSETS).notes).toEqual([]);
  });
});

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

describe("a picture held on the device that the resolver can supply", () => {
  const BYTES = "data:image/jpeg;base64,/9j/AAA=";

  function withPictures(): Document {
    return page(
      { id: "p", kind: "profile", displayName: "Ada", localAvatarId: "avatar-1" },
      {
        id: "m",
        kind: "menu",
        heading: "Fruit",
        tiers: [{ id: "t1", name: "Oranges", price: "4", localImageIds: ["tier-1"] }],
      },
      { id: "g", kind: "gallery", layout: "grid", items: [{ imageUrl: "", localImageId: "item-1" }] },
    );
  }

  it("puts the picture data on the node, and leaves no token behind", () => {
    const { html, notes } = buildMenuFile(withPictures(), () => BYTES);

    expect(html).not.toContain("mdsb-asset:");
    expect(html).toContain(BYTES);
    // Three pictures, three embeds, and nothing to tell the seller about.
    expect(html.split(BYTES)).toHaveLength(4);
    expect(notes).toEqual([]);
  });

  it("finds every kind of device picture a document can carry", () => {
    // The walk `holdAssets` is driven by. A kind it misses is a picture that is
    // never read, so the file is built without it and the seller is told it is
    // not stored, which is a lie about a picture sitting right there.
    expect(assetIds(withPictures()).sort()).toEqual(["avatar-1", "item-1", "tier-1"]);
  });

  it("reads the identifiers off the document, not out of the compiled text", () => {
    // A seller can type the token into their own item name. In the compiled
    // Markdown those characters are indistinguishable from the compiler's, and
    // in the document they are plainly a name. FR-089 is why this is possible.
    const forged = page({
      id: "m",
      kind: "menu",
      tiers: [{ id: "t1", name: "X](mdsb-asset:forged)", price: "1" }],
    });

    expect(assetIds(forged)).toEqual([]);
  });

  it("takes an identifier that is only whitespace as no picture at all", () => {
    // Matching the three emitters, which each treat a blank as no picture.
    const blank = page({
      id: "m",
      kind: "menu",
      tiers: [{ id: "t1", name: "Oranges", price: "4", localImageIds: ["", "  "] }],
    });

    expect(assetIds(blank)).toEqual([]);
  });

  it("still produces the file when only some of the pictures are there", () => {
    // FR-088, the mixed case: one picture present, one gone. The file is
    // produced, the one that is there is embedded, and the missing one is named
    // by its item rather than by its identifier.
    const { html, notes } = buildMenuFile(withPictures(), (id) => (id === "tier-1" ? BYTES : undefined));

    expect(html).toContain(BYTES);
    expect(html).not.toContain("mdsb-asset:");
    expect(notes).toHaveLength(2);
    expect(notes.join(" ")).not.toContain("avatar-1");
    expect(notes.join(" ")).not.toContain("item-1");
  });
});
