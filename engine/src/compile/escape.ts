/**
 * Turning artist text into Markdown that displays exactly what they typed.
 *
 * The property defended here, FR-010 and SC-006: nothing an artist writes can
 * change the structure of the surrounding page. Not its Markdown structure, and
 * not the HTML the host renders from it.
 *
 * Architecture review R-2: this covers `<` and `&` as well as Markdown
 * punctuation. CommonMark permits raw HTML, and this text is emitted onto a
 * page hosted on someone else's domain, whose sanitizer is not ours to rely on
 * or inspect. An unescaped tag here is a tag on their page.
 *
 * This is a different gate from the preview sanitizer that arrives in 1.3. That
 * one protects our own origin. This one protects the artist's page on a host we
 * do not control.
 */

/**
 * Every character that can begin, end, or alter a Markdown construct, plus the
 * two that can begin HTML.
 *
 * The list is deliberately broad. A narrower one would produce prettier source,
 * and every omission is a way out of the construct.
 *
 * It used to say the artist never reads the source, which was the justification
 * for not caring how the escapes look. That was wrong twice over. The Copy
 * screen shows them the source, it being the whole output of the tool. And
 * three of these characters cannot be backslash escaped on a host that renders
 * with Python-Markdown, whose escapable set is narrower than CommonMark's "all
 * ASCII punctuation". See ENTITY_ONLY.
 */
const ESCAPABLE = /[\\`*_{}[\]()#+\-.!|]/g;

/**
 * The characters a backslash cannot protect, so an entity does instead.
 *
 * Pasted into rentry's live preview on 2026-08-31, one line per character, the
 * backslash was consumed for fifteen of them and left plainly visible for these
 * three. An artist writing a price of "$45", which is the likeliest input this
 * whole application will ever receive, published "\$45".
 *
 * A numeric character reference is the same answer this file already gives for
 * `<`, `&` and `>`, and for the same reason: it removes the character from the
 * source entirely, so no renderer can build a construct out of what is not
 * there, while every renderer displays it as the character the artist typed.
 * Confirmed in the same preview, including that a doubled tilde written as
 * entities stays literal text while a real one is still struck through.
 *
 * Recorded in `docs/research/2026-08-31-rentry-escape-verification.md`.
 */
const ENTITY_ONLY: Record<string, string> = {
  "~": "&#126;",
  "^": "&#94;",
  $: "&#36;",
};

const ENTITY_ONLY_PATTERN = /[~^$]/g;

/**
 * Escapes text that will occupy whole lines of the output.
 *
 * Newlines survive, because a block of text is allowed to contain them. What
 * cannot survive is any character that would start a construct.
 *
 * `&`, `<`, and `>` become HTML entities rather than backslash escapes. A
 * backslash escape only holds on a renderer that implements backslash escapes,
 * and R-2's whole concern is a host whose renderer we cannot inspect. An entity
 * removes the character from the output entirely, so no renderer can build a
 * tag out of it, while still displaying to the artist as the character they
 * typed.
 *
 * `&` is replaced first. Doing it after would double-encode the entities the
 * other two produce.
 */
export function escapeText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(ESCAPABLE, (ch) => `\\${ch}`)
    // Last, because an entity contains `&` and `#`, and those are ours rather
    // than the artist's. Running it earlier produced `a&\#36;b`: the escaper
    // escaping its own output, which is the same trap the `&` ordering above
    // exists to avoid.
    .replace(ENTITY_ONLY_PATTERN, (ch) => ENTITY_ONLY[ch] ?? ch);
}

/**
 * Escapes text that must stay on a single line, such as a heading.
 *
 * A newline inside a heading ends the heading and turns everything after it
 * into body text, which silently restructures the page. All whitespace is
 * therefore collapsed to single spaces and the result is trimmed.
 *
 * Trimming also serves review finding R-3: a heading whose text is only
 * whitespace becomes an empty string, so the emitter can omit the trailing
 * space rather than leaving invisible whitespace that editors strip on save.
 */
export function escapeInline(text: string): string {
  const oneLine = text.replace(LINE_BREAKING, " ").replace(/\s+/g, " ").trim();
  return escapeText(oneLine);
}

/**
 * Characters that some renderer somewhere treats as a line boundary.
 *
 * Holistic review H-6. JavaScript's `\s` does NOT include U+0085, U+001C,
 * U+001D, or U+001E, so relying on `\s` alone leaves them in the output.
 *
 * That matters because the escaper runs in JavaScript and the renderer does
 * not. Python's `str.splitlines`, which a Python Markdown pipeline is likely to
 * reach for, splits on all four of those in addition to the usual set. rentry
 * is a Python service. A heading containing U+0085 could therefore survive our
 * check and still be split in half by the host, turning the remainder of the
 * artist's heading into body text.
 *
 * This is a cross-language seam: our idea of "whitespace" and the renderer's do
 * not have to agree, and where they disagree the renderer wins. Collapsing the
 * union of both is cheap and removes the question.
 */
// The control characters below are the entire point. U+001C to U+001E are line
// boundaries to Python's splitlines and invisible to JavaScript's whitespace
// class, which is exactly the gap this closes. no-control-regex exists to catch
// them arriving by accident, and these did not.
// eslint-disable-next-line no-control-regex
const LINE_BREAKING =/[\r\n\v\f\u001c\u001d\u001e\u0085\u2028\u2029]/g;
