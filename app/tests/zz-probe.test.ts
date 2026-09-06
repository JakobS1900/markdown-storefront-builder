/**
 * @vitest-environment jsdom
 *
 * TEMPORARY REVIEW PROBE. Delete after reading.
 */
import { describe, expect, it } from "vitest";

import { MENU_FILE, compile } from "@mdsb/engine";
import type { Document } from "@mdsb/engine";

import { NO_ASSETS, buildMenuFile } from "../src/menu-file.js";

const EVIL = "x](mdsb-asset:zzz)";

function doc(blocks: Document["blocks"]): Document {
  return { schemaVersion: 4, target: "rentry", title: "T", blocks };
}

describe("H1 hostile alt", () => {
  it("profile avatar alt with a fake terminator", () => {
    const d = doc([
      {
        id: "p",
        kind: "profile",
        displayName: EVIL,
        localAvatarId: "real-avatar-id",
      },
    ]);
    const md = compile(d, MENU_FILE).markdown;
    console.log("MARKDOWN >>>", JSON.stringify(md));
    const { html, notes } = buildMenuFile(d, NO_ASSETS);
    console.log("NOTES >>>", JSON.stringify(notes));
    console.log("HTML >>>", html.slice(html.indexOf("<main"), html.indexOf("</main>") + 7));
    expect(html).not.toContain("mdsb-asset:");
  });

  it("menu tier name with a fake terminator", () => {
    const d = doc([
      {
        id: "m",
        kind: "menu",
        heading: "Fruit",
        tiers: [
          { id: "t1", name: EVIL, price: "4", localImageIds: ["real-id"] },
          { id: "t2", name: "Lemons", price: "3" },
        ],
      },
    ]);
    const md = compile(d, MENU_FILE).markdown;
    console.log("MENU MARKDOWN >>>", JSON.stringify(md));
    const { html, notes } = buildMenuFile(d, NO_ASSETS);
    console.log("MENU NOTES >>>", JSON.stringify(notes));
    console.log("MENU HTML >>>", html.slice(html.indexOf("<main"), html.indexOf("</main>") + 7));
    expect(html).not.toContain("mdsb-asset:");
  });

  it("gallery caption with a fake terminator", () => {
    const d = doc([
      {
        id: "g",
        kind: "gallery",
        heading: "Shots",
        layout: "list",
        items: [{ caption: EVIL, localImageId: "real-gallery-id" }],
      },
    ]);
    const md = compile(d, MENU_FILE).markdown;
    console.log("GALLERY MARKDOWN >>>", JSON.stringify(md));
    const { html } = buildMenuFile(d, NO_ASSETS);
    console.log("GALLERY HTML >>>", html.slice(html.indexOf("<main"), html.indexOf("</main>") + 7));
    expect(html).not.toContain("mdsb-asset:");
  });
});
