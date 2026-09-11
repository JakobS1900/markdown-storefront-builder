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
    const out = md({ id: "m", kind: "menu", tiers: [{ id: "bust", name: "Bust", price: "$45" }] });
    expect(out).not.toContain("\\$");
    expect(out).toContain("&#36;45");
  });

  /**
   * AMENDED BY FEATURE 028, and the amendment is argued rather than applied.
   *
   * This test used to compile `~~not struck~~` in a text section and assert the
   * output contained no real `~~` at all. That was correct while strikethrough
   * was not a construct this compiler knew: a doubled tilde could only be an
   * accident, and an accident that becomes a construct on somebody else's
   * domain is the thing the escaper exists to prevent.
   *
   * Feature 028 put strikethrough in the whitelist, so `~~struck~~` in a text
   * section is now something a seller ASKED for, and refusing it would be the
   * compiler ignoring an instruction rather than defending anybody.
   *
   * The property underneath has not changed and is what is asserted now: a
   * tilde the grammar did not claim can still never form a construct. That is
   * the whole difference between a whitelist and a filter, and it is why
   * `escapeText` forcing `~` to `&#126;` is still load bearing: seller text
   * cannot contain a live tilde, so a real `~~` in the output can only have
   * been written by `emitInline`.
   */
  it("makes a strikethrough only where the grammar claimed one", () => {
    const struck = md({ id: "p", kind: "prose", text: "~~struck~~" });
    expect(struck).toContain("~~struck~~");

    // Everything the grammar did not claim is still an entity and still inert.
    for (const text of ["~~", "~~ spaced ~~", "an unclosed ~~strike", "50~60"]) {
      const out = md({ id: "p", kind: "prose", text });
      expect(out, `${JSON.stringify(text)} is not a mark anybody asked for`).not.toContain("~~");
      expect(out).toContain("&#126;");
    }
  });

  it("still writes a lone tilde as an entity even beside a real mark", () => {
    const out = md({ id: "p", kind: "prose", text: "~~struck~~ and a stray ~" });
    expect(out).toBe("~~struck~~ and a stray &#126;\n");
  });
});

/**
 * This block used to assert that every character rentry unescapes keeps its
 * backslash, on the reasoning that the host handles it so the escape is free.
 *
 * Feature 013 replaced that reasoning. Whether the host unescapes a character
 * says nothing about whether it needed escaping: most of these can only begin a
 * construct at the start of a line, and escaping them in the middle of a
 * sentence bought nothing while filling the Copy screen with backslashes. The
 * three groups below are what rentry's behaviour actually implies now.
 */
describe("what is escaped, and where", () => {
  /** These begin a construct wherever they land, so they are escaped wherever they land. */
  const ANYWHERE = ["`", "*", "_", "{", "}", "[", "]", "|"];

  for (const char of ANYWHERE) {
    it(`escapes ${JSON.stringify(char)} in the middle of a sentence`, () => {
      const out = md({ id: "p", kind: "prose", text: `a${char}b` });
      expect(out).toContain(`\\${char}`);
    });
  }

  it("escapes a literal backslash", () => {
    const out = md({ id: "p", kind: "prose", text: "a\\b" });
    expect(out).toContain("\\\\");
  });

  /** These mark something only at the start of a line. */
  const MARKERS = ["#", "+", "-"];

  for (const char of MARKERS) {
    it(`leaves ${JSON.stringify(char)} alone in the middle of a sentence`, () => {
      const out = md({ id: "p", kind: "prose", text: `a${char}b` });
      expect(out).toContain(`a${char}b`);
      expect(out).not.toContain(`\\${char}`);
    });
  }

  it("escapes a hash that begins a line, because nothing else would stop it", () => {
    expect(md({ id: "p", kind: "prose", text: "# not a heading" })).toContain("\\# not a heading");
  });

  it("turns a line the artist began with a bullet into a bullet, on purpose", () => {
    // Not an escaping case at all, which is why the first version of this test
    // was wrong. A text section reads leading "-" and "+" as the artist asking
    // for a list and emits one, so the escaper never sees a marker in marker
    // position. The escaper's own behaviour is covered in narrow-escaping.
    for (const marker of ["-", "+"]) {
      const out = md({ id: "p", kind: "prose", text: `${marker} first\n${marker} second` });
      expect(out).toContain("- first\n- second");
      expect(out).not.toContain("\\-");
    }
  });

  it("leaves a full stop alone unless it is finishing a list number", () => {
    expect(md({ id: "p", kind: "prose", text: "a.b" })).toContain("a.b");
    expect(md({ id: "p", kind: "prose", text: "1. not a list" })).toContain("1\\. not a list");
    expect(md({ id: "p", kind: "prose", text: "1) not a list" })).toContain("1\\) not a list");
  });

  /** These never begin anything here, so they are never escaped. */
  it("never escapes round brackets, which only matter inside an address", () => {
    const out = md({ id: "p", kind: "prose", text: "Engraving (up to 20 characters)" });
    expect(out).toContain("Engraving (up to 20 characters)");
  });

  it("leaves an exclamation mark alone in ordinary writing", () => {
    expect(md({ id: "p", kind: "prose", text: "Back in stock!" })).toContain("Back in stock!");
  });

  it("escapes an exclamation mark that would turn a link into an image", () => {
    // The one place `!` still matters. The bracket here is written by the
    // emitter, not typed by the artist, so nothing else stops the pair.
    const out = md({ id: "p", kind: "prose", text: "![alt](https://evil.test/x.png)" });
    expect(out).toMatch(/\\!\[/);
    expect(out).not.toMatch(/(^|[^\\])!\[/);
  });
});

describe("the whole point, end to end", () => {
  it("a realistic price list contains no stray backslashes before the awkward three", () => {
    const out = md({
      id: "m",
      kind: "menu",
      currency: "$",
      tiers: [
        { id: "bust", name: "Bust", price: "$45" },
        { id: "half-body", name: "Half body", price: "50~60" },
        { id: "rush", name: "Rush", price: "$45 + 50%" },
      ],
    });
    expect(out).not.toMatch(/\\[$~^]/);
  });
});
