/**
 * A picture held on the seller's device appears in the menu file and nowhere else.
 *
 * This is the boundary the whole feature exists to hold. A paste host receives
 * text, and the seller's own photograph is not on the internet, so an address
 * pointing at it would publish a broken image at best. FR-079 forbids any
 * setting that changes that, and FR-081 forbids the pasted text disclosing that
 * a local picture exists at all.
 *
 * **This test is deliberately two halves, and the presence half is the one that
 * makes it worth having.** An absence-only test passes against an empty
 * document, which is exactly how the FR-054c gate in this repository came to
 * compile nineteen documents that carried nothing between them and stayed green
 * forever. So the picture must be shown to appear for `MENU_FILE` before its
 * absence anywhere else means anything.
 */
import { describe, expect, it } from "vitest";

import { compile } from "../../src/compile/compile.js";
import { MENU_FILE, TARGETS } from "../../src/compile/targets.js";
import type { Document } from "../../src/document/types.js";

const TIER_ASSET = "a7f3ac21-tier";
const GALLERY_ASSET = "b91b2d40-gallery";
const AVATAR_ASSET = "c4d8ef77-avatar";

/** Every identifier that must never leave the app, in one list. */
const ASSET_IDS = [TIER_ASSET, GALLERY_ASSET, AVATAR_ASSET];

/**
 * One page carrying all three kinds of local picture, plus a web address
 * picture, so the two kinds are side by side and the absence of one cannot be
 * confused with the absence of pictures altogether.
 */
const doc: Document = {
  schemaVersion: 4,
  target: "rentry",
  blocks: [
    {
      id: "prof",
      kind: "profile",
      displayName: "Ari",
      avatarUrl: "",
      localAvatarId: AVATAR_ASSET,
    },
    {
      id: "menu",
      kind: "menu",
      heading: "Prices",
      currency: "$",
      tiers: [
        { id: "oranges", name: "Oranges", price: "3", localImageIds: [TIER_ASSET] },
        { id: "lemons", name: "Lemons", price: "4", imageUrls: ["https://example.test/lemons.png"] },
      ],
    },
    {
      id: "gal",
      kind: "gallery",
      heading: "The stall",
      layout: "list",
      items: [
        { imageUrl: "", localImageId: GALLERY_ASSET, caption: "Saturday morning" },
        { imageUrl: "https://example.test/stall.png", caption: "The awning" },
      ],
    },
  ],
};

describe("a picture held on the device appears in the menu file", () => {
  it("emits all three kinds as an mdsb-asset address", () => {
    const { markdown } = compile(doc, MENU_FILE);

    for (const id of ASSET_IDS) {
      expect([id, markdown.includes(`mdsb-asset:${id}`)]).toEqual([id, true]);
    }
  });

  it("says nothing is unsupported, because nothing is", () => {
    const codes = compile(doc, MENU_FILE).diagnostics.map((d) => d.code);
    expect(codes).not.toContain("local_image_unsupported");
  });

  it("still emits the web address pictures alongside them", () => {
    // The two kinds coexist. A menu file that showed only the local pictures
    // would pass the half above and still be wrong.
    const { markdown } = compile(doc, MENU_FILE);
    expect(markdown).toContain("https://example.test/lemons.png");
    expect(markdown).toContain("https://example.test/stall.png");
  });
});

/**
 * An item carrying BOTH kinds of picture, which the page above deliberately
 * does not have.
 *
 * A gallery item and an avatar are each one picture, so when both are present
 * something has to give way. The seller's own photograph wins, because the menu
 * file is the one place it was ever going to appear. What must not happen is
 * that the web address disappears from the file without a word.
 *
 * This was a real defect found in review. The code did the right thing and said
 * nothing about it, and the comment justifying the silence argued that the web
 * address still shows on every paste host so nothing is lost. That is false for
 * the seller who only ever sends the menu file, and that seller is the one this
 * feature is for.
 */
const both: Document = {
  schemaVersion: 4,
  target: "rentry",
  blocks: [
    {
      id: "prof",
      kind: "profile",
      displayName: "Ari",
      avatarUrl: "https://example.test/avatar.png",
      localAvatarId: AVATAR_ASSET,
    },
    {
      id: "gal",
      kind: "gallery",
      heading: "The stall",
      layout: "list",
      items: [
        {
          imageUrl: "https://example.test/stall.png",
          localImageId: GALLERY_ASSET,
          caption: "Saturday morning",
        },
      ],
    },
  ],
};

describe("a web address the menu file gives way to is named, not dropped in silence", () => {
  it("warns once for the gallery item and once for the avatar", () => {
    const codes = compile(both, MENU_FILE).diagnostics.filter((d) => d.code === "picture_superseded");
    expect(codes).toHaveLength(2);
  });

  it("names the item and never the identifier", () => {
    for (const d of compile(both, MENU_FILE).diagnostics) {
      for (const id of ASSET_IDS) {
        expect([d.code, id, d.message.includes(id)]).toEqual([d.code, id, false]);
      }
    }
    const messages = compile(both, MENU_FILE)
      .diagnostics.filter((d) => d.code === "picture_superseded")
      .map((d) => d.message)
      .join(" ");
    expect(messages).toContain("Saturday morning");
    expect(messages).toContain("profile");
  });

  it("says nothing about supersession on a paste host, where nothing gives way", () => {
    // There the local picture is the one dropped, and `local_image_unsupported`
    // is what says so. Two warnings about the same pair of pictures would read
    // as a fault rather than as an explanation.
    for (const target of TARGETS) {
      const codes = compile(both, target).diagnostics.map((d) => d.code);
      expect([target.id, codes.includes("picture_superseded")]).toEqual([target.id, false]);
    }
  });

  it("shows the device picture in the file and the web address everywhere pasted", () => {
    expect(compile(both, MENU_FILE).markdown).toContain(`mdsb-asset:${AVATAR_ASSET}`);
    for (const target of TARGETS) {
      const { markdown } = compile(both, target);
      expect([target.id, markdown.includes("https://example.test/avatar.png")]).toEqual([target.id, true]);
    }
  });
});

describe("and appears in no target a seller pastes into", () => {
  it("emits no asset identifier for any paste target", () => {
    for (const target of TARGETS) {
      const { markdown } = compile(doc, target);
      for (const id of ASSET_IDS) {
        expect([target.id, id, markdown.includes(id)]).toEqual([target.id, id, false]);
      }
    }
  });

  it("emits no mdsb-asset address at all for any paste target", () => {
    // The identifiers above are the payload. This is the scheme that carries
    // them, checked separately so a change to how ids are shaped cannot quietly
    // narrow what this test covers.
    for (const target of TARGETS) {
      const { markdown } = compile(doc, target);
      expect([target.id, markdown.includes("mdsb-asset")]).toEqual([target.id, false]);
    }
  });

  it("still emits the web address pictures, which are not the thing being held back", () => {
    for (const target of TARGETS) {
      const { markdown } = compile(doc, target);
      expect([target.id, markdown.includes("https://example.test/lemons.png")]).toEqual([
        target.id,
        true,
      ]);
    }
  });
});

describe("and is never dropped in silence", () => {
  it("warns once per offending picture for every paste target", () => {
    // Holistic review HB-6 settled that a refused address is never dropped
    // without saying so. A picture that vanishes with no explanation leaves the
    // seller no way to work out why.
    for (const target of TARGETS) {
      const warnings = compile(doc, target).diagnostics.filter(
        (d) => d.code === "local_image_unsupported",
      );
      expect([target.id, warnings.map((w) => w.blockId).sort()]).toEqual([
        target.id,
        ["gal", "menu", "prof"],
      ]);
      for (const warning of warnings) {
        expect(warning.severity).toBe("warning");
        expect(warning.capability).toBe("localImages");
      }
    }
  });

  it("names the item or the section, so the seller knows which picture", () => {
    // FR-080. A warning that says "one of your pictures" for a page with four
    // of them is a warning that sends the seller hunting.
    for (const target of TARGETS) {
      const messages = new Map(
        compile(doc, target)
          .diagnostics.filter((d) => d.code === "local_image_unsupported")
          .map((d) => [d.blockId, d.message]),
      );
      expect(messages.get("menu")).toContain("Oranges");
      expect(messages.get("gal")).toContain("Saturday morning");
      expect(messages.get("prof")).toContain("profile picture");
      for (const message of messages.values()) {
        // Where it DOES appear, so it reads as a signpost and not a scolding.
        expect(message).toContain("menu file");
      }
    }
  });
});

describe("FR-081: nothing discloses the file itself", () => {
  it("keeps every asset identifier out of every diagnostic message", () => {
    // The same reasoning `cost-never-published.test.ts` applies to a supplier
    // cost: a warning is somewhere a seller might screenshot, and an identifier
    // is a fact about their device rather than about their page.
    for (const target of [...TARGETS, MENU_FILE]) {
      const messages = compile(doc, target)
        .diagnostics.map((d) => d.message)
        .join(" ");
      for (const id of ASSET_IDS) {
        expect([target.id, id, messages.includes(id)]).toEqual([target.id, id, false]);
      }
      expect([target.id, messages.includes("mdsb-asset")]).toEqual([target.id, false]);
    }
  });

  it("does not let the pasted text reveal that a local picture exists", () => {
    // Not merely the identifier: the word too. A paste output carrying "this
    // picture is on your device" would disclose the thing FR-081 exists to
    // keep private, on a page anybody can read.
    for (const target of TARGETS) {
      const { markdown } = compile(doc, target);
      expect([target.id, /local|device|asset/i.test(markdown)]).toEqual([target.id, false]);
    }
  });
});
