/**
 * @vitest-environment jsdom
 *
 * The hostile text corpus, carried through the export sink.
 *
 * Constitution Principle IV requires the corpus to grow by a case whenever a
 * new user-authored path appears, and the saved menu file is a new path in the
 * strongest sense: it is the only thing this project produces that other people
 * open directly, in their own browser, away from us.
 *
 * SC-003 is the criterion, and it is specific about method: "Verified by
 * producing the files, not by inspecting the code that makes them." So every
 * case here builds a real file and reads it.
 *
 * THE CORPUS IS NOT INVENTED HERE. The payloads are the ones this repository
 * already carries, in `app/tests/a11y.test.ts` and
 * `app/tests/render-markdown.test.ts`, so that a case added there for the
 * preview is a case this file can be given too, rather than two corpora that
 * drift. One case is new, and it is new because the sink is: the file has a
 * `<title>`, and the seller's page title goes in it.
 *
 * ON READING THE FILE BACK WITH `DOMParser`, which the application must never
 * do. The rule the app holds is that no markup string is ever parsed back IN:
 * `render-markdown.ts` builds every node with `createElement` and sets every
 * piece of text with `textContent`, so there is no path from seller text to
 * markup. Nothing here changes that; `menu-file.ts` reads markup OUT of a tree
 * built that way. This test parses the produced file precisely because that is
 * what the reader's browser will do with it, and a string search only proves
 * what the bytes say. It parses no seller input: it parses our own output, in
 * a test, to check what a browser builds from it.
 */
import { describe, expect, it } from "vitest";

import type { Document } from "@mdsb/engine";

import { NO_ASSETS, buildMenuFile } from "../src/menu-file.js";

/** From `app/tests/a11y.test.ts`, where it guards the preview. */
const FROM_A11Y = [
  "<script>alert(1)</script>",
  "<img src=x onerror=alert(1)>",
  "<iframe src=//evil.test></iframe>",
  "javascript:alert(1)",
  "<svg/onload=alert(1)>",
  "</textarea><script>alert(1)</script>",
  "&lt;script&gt;alert(1)&lt;/script&gt;",
];

/** From `app/tests/render-markdown.test.ts`, where it guards the addresses. */
const FROM_RENDER_MARKDOWN = [
  "[click](javascript:alert(1))",
  "[click](JaVaScRiPt:alert(1))",
  "![img](javascript:alert(1))",
  "[click](data:text/html,<script>alert(1)</script>)",
  "[click](vbscript:msgbox(1))",
  "[click](file:///etc/passwd)",
  "[a](javascript:alert(1)) and [b](https://ok.test)",
  "[click](java\tscript:alert(1))",
  "[click]\\(javascript:alert(1))",
];

/**
 * The case this sink adds, and the reason the corpus had to grow.
 *
 * Nothing before this feature put seller text inside a `<title>`, which is
 * RCDATA: a `<script>` written in there is text, and only `</title>` ends it.
 * So the payload that matters for this field is the one that closes the
 * element first, and none of the existing cases do.
 */
const FROM_THIS_SINK = ["</title><script>alert(1)</script>", "</title><img src=x onerror=alert(1)>"];

const CORPUS = [...FROM_A11Y, ...FROM_RENDER_MARKDOWN, ...FROM_THIS_SINK];

/** The payload in every field of the page a seller can type into. */
function hostilePage(payload: string): Document {
  return {
    schemaVersion: 4,
    target: "rentry",
    title: payload,
    blocks: [
      { id: "h", kind: "heading", text: payload, level: 2 },
      { id: "t", kind: "prose", heading: payload, text: payload },
      {
        id: "m",
        kind: "menu",
        heading: payload,
        currency: payload,
        tiers: [
          {
            id: "row",
            name: payload,
            price: payload,
            unit: payload,
            blurb: payload,
            includes: [payload],
            details: [{ label: payload, value: payload }],
            quantities: [{ amount: payload, price: payload }],
            imageUrls: [payload],
            localImageIds: [payload],
          },
        ],
        addOns: [{ name: payload, price: payload }],
      },
      {
        id: "g",
        kind: "gallery",
        heading: payload,
        layout: "list",
        items: [
          { imageUrl: payload, caption: payload },
          { imageUrl: "https://e.test/a.png", caption: payload },
        ],
      },
      {
        id: "p",
        kind: "profile",
        displayName: payload,
        tagline: payload,
        paymentMethods: [payload],
        links: [
          { label: payload, url: payload },
          { label: payload, url: "https://e.test" },
        ],
      },
    ],
  };
}

/** What a browser actually builds from the file, which is the thing promised. */
function opened(html: string): globalThis.Document {
  return new DOMParser().parseFromString(html, "text/html");
}

/**
 * The attributes a browser acts on, which are the only ones an address matters
 * in.
 *
 * Checking every attribute instead was the first attempt and it was wrong in a
 * way worth keeping: a gallery caption of `javascript:alert(1)` becomes the
 * `alt` of an image, where it is a description read aloud and nothing else.
 * Failing on that would have been a gate objecting to the seller's own words.
 */
const ACTED_ON = ["href", "src", "srcset", "action", "formaction", "data", "poster", "style"];

describe.each(CORPUS)("the saved menu file is inert for %j", (payload) => {
  const { html } = buildMenuFile(hostilePage(payload), NO_ASSETS);

  it("builds no executable element when a browser opens it", () => {
    // The decisive assertion, and it is on the parsed document rather than on
    // the bytes for a reason found by writing it the other way first. A payload
    // reaches the file inside an `alt`, correctly quoted and inert, so
    // `not.toContain("<script")` failed on a file that was perfectly safe. What
    // is promised is that nothing a seller typed becomes executable, and the
    // only honest way to check that is to build what the reader will build.
    expect(opened(html).querySelectorAll("script, iframe, svg, object, embed")).toHaveLength(0);
  });

  it("carries no event handler attribute and no live dangerous address", () => {
    for (const node of opened(html).querySelectorAll("*")) {
      for (const attr of node.attributes) {
        expect(attr.name.startsWith("on"), `${attr.name} on ${node.nodeName}`).toBe(false);
        if (!ACTED_ON.includes(attr.name)) continue;
        expect(attr.value.trim().toLowerCase(), `${attr.name} on ${node.nodeName}`).not.toMatch(
          /^(javascript|vbscript|file|data:text\/html)/,
        );
      }
    }
  });

  it("leaves the seller a page rather than an empty file", () => {
    // The other way to be inert is to produce nothing, which would pass every
    // assertion above and be a broken feature.
    const text = opened(html).body.textContent ?? "";
    expect(text.trim().length).toBeGreaterThan(20);
  });

  it("puts no asset address in the file, whatever the identifier says", () => {
    expect(html).not.toContain("mdsb-asset:");
  });
});
