/**
 * The characters rentry does not unescape.
 *
 * The escaper backslashes every character that could begin a Markdown
 * construct, on the reasoning that a broad list is safe and the artist never
 * reads the source. Both halves turned out to be wrong for three characters.
 *
 * rentry runs Python-Markdown, whose escapable set is narrower than
 * CommonMark's "all ASCII punctuation". Pasted into rentry's live preview on
 * 2026-08-31, one line per character, the backslash was consumed for fifteen of
 * them and left visible for three:
 *
 *   honoured   ` * _ { } [ ] ( ) # + - . ! |  and a literal backslash
 *   visible    ~  ^  $
 *
 * So an artist typing a price of "$45", which is the most likely input this
 * application will ever receive, published a price of "\$45".
 *
 * The fix is the one the file already uses for `<`, `&` and `>`: a numeric
 * character reference. It removes the character from the source entirely, so no
 * renderer can build a construct from it, and every renderer displays it.
 * Verified in the same preview: `&#36;45` shows as `$45`, and
 * `&#126;&#126;text&#126;&#126;` shows as literal `~~text~~` while a real `~~`
 * is struck through, so the protection survives the change.
 */
import { describe, expect, it } from "vitest";

import { compile } from "../../src/compile/compile.js";
import type { Block, Document } from "../../src/document/types.js";

function page(...blocks: Block[]): Document {
  return { schemaVersion: 1, target: "rentry", blocks };
}

const md = (...blocks: Block[]): string => compile(page(...blocks), "rentry").markdown;

/** The three rentry leaves a visible backslash on. */
const UNHONOURED: [string, string, string][] = [
  ["dollar", "$", "&#36;"],
  ["tilde", "~", "&#126;"],
  ["caret", "^", "&#94;"],
];

describe("characters the host does not unescape", () => {
  for (const [name, char, entity] of UNHONOURED) {
    it(`writes ${name} as an entity, never as a backslash escape`, () => {
      const out = md({ id: "p", kind: "prose", text: `a${char}b` });
      expect(out, `a backslash before ${name} shows literally on rentry`).not.toContain(`\\${char}`);
      expect(out).toContain(entity);
    });
  }

  it("writes a price of $45 so it publishes as $45", () => {
    const out = md({ id: "m", kind: "menu", tiers: [{ name: "Bust", price: "$45" }] });
    expect(out).not.toContain("\\$");
    expect(out).toContain("&#36;45");
  });

  it("still stops the character forming a construct", () => {
    // Doubled tildes are strikethrough on this host. As entities they are text.
    const out = md({ id: "p", kind: "prose", text: "~~not struck~~" });
    expect(out).not.toContain("~~");
    expect(out).toContain("&#126;&#126;");
  });
});

describe("characters the host does unescape are left alone", () => {
  const HONOURED = ["`", "*", "_", "{", "}", "[", "]", "(", ")", "#", "+", "-", ".", "!", "|"];

  for (const char of HONOURED) {
    it(`keeps the backslash escape for ${JSON.stringify(char)}`, () => {
      const out = md({ id: "p", kind: "prose", text: `a${char}b` });
      expect(out).toContain(`\\${char}`);
    });
  }

  it("keeps the backslash escape for a literal backslash", () => {
    const out = md({ id: "p", kind: "prose", text: "a\\b" });
    expect(out).toContain("\\\\");
  });
});

describe("the whole point, end to end", () => {
  it("a realistic price list contains no stray backslashes before the awkward three", () => {
    const out = md({
      id: "m",
      kind: "menu",
      currency: "$",
      tiers: [
        { name: "Bust", price: "$45" },
        { name: "Half body", price: "50~60" },
        { name: "Rush", price: "$45 + 50%" },
      ],
    });
    expect(out).not.toMatch(/\\[$~^]/);
  });
});
