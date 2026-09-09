/**
 * The wizard's answers, turned into a page, with no surface anywhere near it.
 *
 * THERE IS NO `@vitest-environment jsdom` LINE IN THIS FILE AND THERE MUST
 * NEVER BE ONE. It is the whole point of the seam: every real decision in
 * feature 027 lives in `wizard-answers.ts`, and testing "which starting point,
 * where does the name go, how does a selling mode reach a row" through six
 * screens of clicking would make all of it expensive to check and easy to get
 * wrong quietly. If this file ever needs the DOM, the decisions have leaked
 * into the surface and the fix is to move them back, not to add the line.
 *
 * The assertion the whole half turns on is the first one: an empty answer set
 * produces the chosen starting point BYTE for BYTE, and compiles byte
 * identically on every host. Answering nothing must cost nothing, and "looks
 * the same" is not a thing this project accepts as evidence.
 */
import { describe, expect, it } from "vitest";

import {
  ALL_TARGETS,
  SELLING_MODE_WORDS,
  compile,
  parseDocument,
  serializeDocument,
  type Block,
  type Document,
} from "@mdsb/engine";

import { STARTERS } from "../src/starters/index.js";
import {
  DEFAULT_STARTER_ID,
  documentFromAnswers,
  starterIdFor,
  type WizardAnswers,
} from "../src/ui/wizard-answers.js";

/** The starting point with that id, loaded the way the picker loads it. */
async function starterNamed(id: string): Promise<Document> {
  const found = STARTERS.find((s) => s.id === id);
  if (found === undefined) throw new Error(`there is no starting point called "${id}"`);
  return found.load();
}

/**
 * Every host's output for one page, in one string.
 *
 * `ALL_TARGETS` rather than `TARGETS`, so the saved menu file is included. It
 * is the one output a buyer opens directly, and a check that skipped it would
 * be green about the sink that matters most.
 */
function compiledEverywhere(doc: Document): string {
  return ALL_TARGETS.map((target) => `--- ${target.id}\n${compile(doc, target).markdown}`).join("\n");
}

function firstOfKind(doc: Document, kind: Block["kind"]): Block {
  const block = doc.blocks.find((b) => b.kind === kind);
  if (block === undefined) throw new Error(`this page has no ${kind} section`);
  return block;
}

function firstProfile(doc: Document): Extract<Block, { kind: "profile" }> {
  const block = firstOfKind(doc, "profile");
  if (block.kind !== "profile") throw new Error("that was not an About you section");
  return block;
}

function firstMenu(doc: Document): Extract<Block, { kind: "menu" }> {
  const block = firstOfKind(doc, "menu");
  if (block.kind !== "menu") throw new Error("that was not a price list");
  return block;
}

function firstTier(doc: Document): Extract<Block, { kind: "menu" }>["tiers"][number] {
  const tier = firstMenu(doc).tiers[0];
  if (tier === undefined) throw new Error("that price list has no rows");
  return tier;
}

/** The one starting point that ships with no prices at all, deliberately. */
const NO_PRICES = "portfolio-and-about-me";

/** Answers to every question, for the tests that want the fullest case. */
const EVERYTHING: WizardAnswers = {
  sells: "handmade-and-crafts",
  storeName: "Wren and Willow",
  wantsPicture: true,
  firstItem: "Carved oak sign",
  firstPrice: "80",
  mode: "made-to-order",
  amount: "each",
};

describe("an empty answer set", () => {
  it("produces every starting point unchanged, byte for byte", async () => {
    // FR-127 and data-model rule 1. Somebody who skips every question gets the
    // starting point they chose, not a damaged copy of it.
    for (const starter of STARTERS) {
      const doc = await starter.load();
      expect([starter.id, serializeDocument(documentFromAnswers(doc, {}))]).toEqual([
        starter.id,
        serializeDocument(doc),
      ]);
    }
  });

  it("compiles identically to opening that starting point from the picker", async () => {
    // The bytes above could match while something in the pipeline still
    // differed, so this asserts the thing a buyer actually receives, on every
    // host, rather than the thing we stored.
    for (const starter of STARTERS) {
      const doc = await starter.load();
      expect([starter.id, compiledEverywhere(documentFromAnswers(doc, {}))]).toEqual([
        starter.id,
        compiledEverywhere(doc),
      ]);
    }
  });
});

describe("which starting point an answer picks", () => {
  it("returns every one of the shipped ids unchanged", () => {
    // FR-122. The wizard chooses from the eight and never invents a ninth.
    for (const starter of STARTERS) {
      expect(starterIdFor({ sells: starter.id })).toBe(starter.id);
    }
  });

  it("falls back to the default when the question was skipped or answered other", () => {
    expect(starterIdFor({})).toBe(DEFAULT_STARTER_ID);
    expect(starterIdFor({ sells: "other" })).toBe(DEFAULT_STARTER_ID);
    expect(starterIdFor({ sells: "" })).toBe(DEFAULT_STARTER_ID);
    expect(starterIdFor({ sells: "   " })).toBe(DEFAULT_STARTER_ID);
  });

  it("defaults to a starting point that actually ships", () => {
    // Without this, renaming a file in app/src/starters/ leaves the wizard
    // opening nothing and every other test here still green, because they all
    // load the starter themselves.
    expect(STARTERS.map((s) => s.id)).toContain(DEFAULT_STARTER_ID);
  });
});

describe("the store name", () => {
  it("reaches the compiled output on every host", async () => {
    // FR-121, and THE assertion this requirement exists for. `title` is never
    // emitted, so a name written only there looks right in the editor and is
    // invisible to every buyer. Reaching the field is not the promise.
    const doc = documentFromAnswers(await starterNamed(DEFAULT_STARTER_ID), {
      storeName: "Wren and Willow",
    });
    for (const target of ALL_TARGETS) {
      expect([target.id, compile(doc, target).markdown.includes("Wren and Willow")]).toEqual([
        target.id,
        true,
      ]);
    }
  });

  it("lands on the About you section, which is the part a reader sees", async () => {
    const doc = documentFromAnswers(await starterNamed(DEFAULT_STARTER_ID), {
      storeName: "Wren and Willow",
    });
    expect(firstProfile(doc).displayName).toBe("Wren and Willow");
  });

  it("is also the page title, which is how the page is listed when you come back", async () => {
    const doc = documentFromAnswers(await starterNamed(DEFAULT_STARTER_ID), {
      storeName: "Wren and Willow",
    });
    expect(doc.title).toBe("Wren and Willow");
  });

  it("reaches every starting point's About you section, not just one", async () => {
    for (const starter of STARTERS) {
      const doc = documentFromAnswers(await starter.load(), { storeName: "Wren and Willow" });
      expect([starter.id, firstProfile(doc).displayName]).toEqual([starter.id, "Wren and Willow"]);
    }
  });

  it("keeps no space somebody typed around it", async () => {
    const doc = documentFromAnswers(await starterNamed(DEFAULT_STARTER_ID), {
      storeName: "  Wren and Willow  ",
    });
    expect(firstProfile(doc).displayName).toBe("Wren and Willow");
  });
});

describe("the first item", () => {
  it("is written to the row that was already there, rather than added below it", async () => {
    // Data-model rule 4. Appending would leave the starting point's example
    // sitting above the seller's own item, which reads as a mistake they made.
    const starter = await starterNamed(DEFAULT_STARTER_ID);
    const doc = documentFromAnswers(starter, EVERYTHING);
    expect(firstMenu(doc).tiers.length).toBe(firstMenu(starter).tiers.length);
    expect(firstTier(doc).name).toBe("Carved oak sign");
  });

  it("carries the price, the amount and the selling mode onto that row", async () => {
    // FR-124. `availability` and `unit` are the fields feature 026 and the
    // original contract already defined, and no parallel way of saying the
    // same thing is invented here.
    const doc = documentFromAnswers(await starterNamed(DEFAULT_STARTER_ID), EVERYTHING);
    expect(firstTier(doc).price).toBe("80");
    expect(firstTier(doc).unit).toBe("each");
    expect(firstTier(doc).availability).toBe("made-to-order");
  });

  it("publishes the selling mode in the words the seller was shown", async () => {
    // One map, so the word somebody picks is the word their page prints.
    const doc = documentFromAnswers(await starterNamed(DEFAULT_STARTER_ID), EVERYTHING);
    for (const target of ALL_TARGETS) {
      expect([target.id, compile(doc, target).markdown.includes(SELLING_MODE_WORDS["made-to-order"])])
        .toEqual([target.id, true]);
    }
  });

  it("does not keep the example's description of a different product", async () => {
    // The starting point's first row describes something else: its own blurb,
    // its own photograph, its own bulk pricing. Left in place, a seller who
    // typed "Carved oak sign" gets a picture of resin coasters and the words
    // "tell me your scent and colour preferences" underneath it.
    //
    // The line between what goes and what stays is the contract's own, at
    // `availability` in descriptor.ts: price, unit, availability and leadTime
    // qualify the OFFER, and blurb, includes, details and the rest describe the
    // THING. The offer survives being renamed. The description does not.
    const doc = documentFromAnswers(await starterNamed(DEFAULT_STARTER_ID), {
      firstItem: "Carved oak sign",
    });
    const tier = firstTier(doc);
    expect(tier.blurb).toBeUndefined();
    expect(tier.includes).toBeUndefined();
    expect(tier.details).toBeUndefined();
    expect(tier.quantities).toBeUndefined();
    expect(tier.imageUrls).toBeUndefined();
    expect(tier.localImageIds).toBeUndefined();
    expect(tier.cost).toBeUndefined();
  });

  it("keeps the row's own identifier, so nothing that pointed at it is lost", async () => {
    const starter = await starterNamed(DEFAULT_STARTER_ID);
    const doc = documentFromAnswers(starter, EVERYTHING);
    expect(firstTier(doc).id).toBe(firstTier(starter).id);
  });

  it("leaves the starting point's own price alone when only the name was given", async () => {
    // Data-model rule 3. A skipped question does not blank a field.
    const starter = await starterNamed(DEFAULT_STARTER_ID);
    const doc = documentFromAnswers(starter, { firstItem: "Carved oak sign" });
    expect(firstTier(doc).price).toBe(firstTier(starter).price);
  });
});

describe("a question nobody answered", () => {
  it("changes nothing, whether it was skipped, left blank, or left as spaces", async () => {
    const starter = await starterNamed(DEFAULT_STARTER_ID);
    const untouched = serializeDocument(documentFromAnswers(starter, {}));
    const blank: WizardAnswers = {
      storeName: "",
      firstItem: "",
      firstPrice: "   ",
      amount: "\t",
    };
    expect(serializeDocument(documentFromAnswers(starter, blank))).toBe(untouched);
  });

  it("writes no empty string into a field the starting point left absent", async () => {
    // An absent optional field and an empty one must never come to mean the
    // same thing. It is the rule every migration in this project is written
    // around, and the cheapest place to break it is here.
    const starter = await starterNamed(DEFAULT_STARTER_ID);
    const doc = documentFromAnswers(starter, { storeName: "", firstItem: "", amount: "" });
    expect(firstTier(doc).unit).toBe(firstTier(starter).unit);
    expect(firstTier(doc).availability).toBeUndefined();
    expect(firstProfile(doc).displayName).toBe(firstProfile(starter).displayName);
  });
});

describe("a starting point that ships with no prices", () => {
  it("takes no item and grows no price list", async () => {
    // "Portfolio and about me" has no prices deliberately. Somebody who picks
    // it and then names an item has the item dropped, rather than a Prices
    // section being invented under them. Stated as a test so the behaviour is
    // chosen rather than discovered later.
    const starter = await starterNamed(NO_PRICES);
    const doc = documentFromAnswers(starter, {
      firstItem: "Carved oak sign",
      firstPrice: "80",
      mode: "made-to-order",
      amount: "each",
    });
    expect(serializeDocument(doc)).toBe(serializeDocument(starter));
    expect(doc.blocks.some((b) => b.kind === "menu")).toBe(false);
  });

  it("still takes the store name, which every page has somewhere to put", async () => {
    const doc = documentFromAnswers(await starterNamed(NO_PRICES), {
      storeName: "Wren and Willow",
    });
    expect(firstProfile(doc).displayName).toBe("Wren and Willow");
  });
});

describe("whether they want a picture", () => {
  it("changes nothing at all about the page", async () => {
    // It decides which section is open when the page appears, which is the
    // surface's business and not the document's. Ignoring it here is the
    // design, not an oversight, and this is what says so.
    const starter = await starterNamed(DEFAULT_STARTER_ID);
    const yes = documentFromAnswers(starter, { ...EVERYTHING, wantsPicture: true });
    const no = documentFromAnswers(starter, { ...EVERYTHING, wantsPicture: false });
    expect(serializeDocument(yes)).toBe(serializeDocument(no));
  });
});

describe("the starting point it was handed", () => {
  it("is not modified, so the caller's copy stays the caller's", async () => {
    const starter = await starterNamed(DEFAULT_STARTER_ID);
    const before = serializeDocument(starter);
    documentFromAnswers(starter, EVERYTHING);
    expect(serializeDocument(starter)).toBe(before);
  });
});

describe("what the wizard produces", () => {
  it("can be written and read back, from every starting point", async () => {
    // This is what proves, rather than assumes, that writing a version 5 field
    // onto a starting point saved at version 3 is safe. The eight JSON files
    // say `schemaVersion: 3`; serializing validates, which migrates them
    // forward, and both steps are version stamps only. Reasoning about that is
    // cheaper to get wrong than checking it.
    for (const starter of STARTERS) {
      const doc = documentFromAnswers(await starter.load(), EVERYTHING);
      const read = parseDocument(serializeDocument(doc));
      expect([starter.id, read.ok ? [] : read.issues.map((i) => `${i.path}: ${i.message}`)]).toEqual([
        starter.id,
        [],
      ]);
    }
  });

  it("raises no diagnostic on any host", async () => {
    // A page the wizard made that trips a capability fallback is teaching
    // somebody a shape their host cannot render, which is the same bar
    // `starters.test.ts` holds the starting points to.
    for (const starter of STARTERS) {
      const doc = documentFromAnswers(await starter.load(), EVERYTHING);
      for (const target of ALL_TARGETS) {
        expect(compile(doc, target).diagnostics.map((d) => `${starter.id} on ${target.id}: ${d.message}`))
          .toEqual([]);
      }
    }
  });
});

/**
 * Constitution Principle IV: the corpus grows by a case whenever a new
 * user-authored path appears, and the wizard is one. Three of its answers are
 * typed by a person and reach a published page.
 *
 * THE CORPUS IS NOT INVENTED HERE, for the reason `menu-file-hostile.test.ts`
 * gives: the payloads are the ones this repository already carries, so a case
 * added for the preview is a case this file can be given too, rather than two
 * corpora that drift.
 */

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
  "[a](javascript:alert(1)) and [b](https://ok.test)",
];

/**
 * The two cases this sink adds, and the reason the corpus had to grow again.
 *
 * The item and its price land in a TABLE ROW, which nothing before this feature
 * let a person fill from a single screen of questions. The payload that matters
 * for a table cell is the one that closes the cell, and the one that ends the
 * row, and no existing case does either.
 */
const FROM_THIS_SINK = ["Sign | 5 | forged", "Sign\n| forged | row | here"];

const CORPUS = [...FROM_A11Y, ...FROM_RENDER_MARKDOWN, ...FROM_THIS_SINK];

/**
 * The structure of a page's output, with none of its words.
 *
 * Counted rather than searched for, and always COMPARED against the same page
 * carrying a harmless answer. The absolute assertions the engine's own tests
 * make cannot be made here: every starting point ships real links, so a whole
 * page legitimately contains unescaped "](", and "there are none" would fail on
 * the seller's own shop address rather than on an attack.
 *
 * `(?<!\\)\|` and `(^|[^\\])\]\(` are the engine's own way of asking whether a
 * construct is real or escaped, from `emitters.test.ts` and `inline.test.ts`. A
 * proxy cruder than the property it stands for has already misled this project
 * once, which is why those two tests say so at length.
 */
function structure(markdown: string): Record<string, unknown> {
  const lines = markdown.split("\n");
  return {
    lines: lines.length,
    // A broken table has more unescaped pipes in one row than in its header.
    cells: lines.map((line) => (line.match(/(?<!\\)\|/g) ?? []).length),
    links: (markdown.match(/(^|[^\\])\]\(/g) ?? []).length,
    markup: (markdown.match(/[<>]/g) ?? []).length,
  };
}

describe.each(CORPUS)("hostile text answered into the wizard, %j", (payload) => {
  it("leaves every host's output structurally identical to a harmless answer", async () => {
    // FR-131 and FR-010. Not "the payload does not appear", which is the wrong
    // question: "javascript:alert(1)" typed as an item name SHOULD appear, as
    // those words, in a table cell. What must not appear is one more row, one
    // more cell, one more link or one more tag than the same page has when
    // somebody types their own name into it.
    const starter = await starterNamed(DEFAULT_STARTER_ID);
    const answered = (answer: string): Document =>
      documentFromAnswers(starter, { storeName: answer, firstItem: answer, firstPrice: answer });

    for (const target of ALL_TARGETS) {
      expect([target.id, structure(compile(answered(payload), target).markdown)]).toEqual([
        target.id,
        structure(compile(answered("Benign"), target).markdown),
      ]);
    }
  });

  it("is still on the page, because refusing somebody's words is not the job", async () => {
    // The other half of the property, and the one an over-eager escaper
    // breaks: nothing is silently deleted. A seller who types an odd item name
    // must be able to see it and fix it.
    const doc = documentFromAnswers(await starterNamed(DEFAULT_STARTER_ID), { firstItem: payload });
    const words = payload.replace(/[^A-Za-z0-9 ]+/g, " ").trim().split(/\s+/);
    const first = words[0];
    if (first === undefined || first === "") throw new Error("that payload has no word to look for");
    for (const target of ALL_TARGETS) {
      expect([target.id, compile(doc, target).markdown.includes(first)]).toEqual([target.id, true]);
    }
  });
});
