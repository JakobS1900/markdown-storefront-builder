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
 * and the artist never reads the source, so prettiness buys nothing and every
 * omission is a way out of the construct.
 */
const ESCAPABLE = /[\\`*_{}[\]()#+\-.!|~^$]/g;

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
    .replace(ESCAPABLE, (ch) => `\\${ch}`);
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
  const oneLine = text.replace(/\s+/g, " ").trim();
  return escapeText(oneLine);
}
