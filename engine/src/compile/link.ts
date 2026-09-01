/**
 * Links, and the small amount of care they need.
 *
 * A link is the first place artist input becomes something a third party
 * interacts with rather than merely reads. A client clicking a link on a
 * commission page is trusting the artist, and the artist is trusting us.
 *
 * Two separate jobs here. Deciding whether an address may become a link at all,
 * and making sure an address cannot end its own link early and spill content
 * into the page around it.
 */
import { escapeText } from "./escape.js";

/**
 * What the browser will see, rather than what was typed.
 *
 * Browsers strip whitespace and control characters before reading the scheme,
 * so a tab inside "java<tab>script:" reaches the parser as "javascript:".
 * Normalising here means a check sees what the browser will see, not the
 * decorated version an attacker supplied.
 *
 * Shared by both checks below so they cannot drift apart. A scheme hidden from
 * one but not the other would be a hole in whichever ended up laxer.
 */
function asBrowserSees(url: string): string {
  // no-control-regex exists to catch control characters arriving by accident.
  // These are the entire point.
  // eslint-disable-next-line no-control-regex
  return url.replace(/[\s\u0000-\u001f\u007f]/g, "");
}

/**
 * Whether an address may be fetched as an image.
 *
 * Only http and https. Everything else, including `javascript:`, `data:`,
 * `vbscript:`, and `file:`, is refused and rendered as plain text by the
 * caller.
 *
 * An allow list rather than a deny list, because the set of dangerous schemes
 * is open ended and browsers keep adding to it, while the set of schemes an
 * image can arrive over is two.
 *
 * This is the IMAGE rule. A LINK may also be `mailto:` or `tel:`, which is
 * `isSafeLinkUrl` below. The two were one function until 2026-09-01, and the
 * comment here used to justify refusing `mailto:` on the grounds that nothing
 * produced one. Building a real page as a seller produced one immediately.
 */
export function isSafeUrl(url: string): boolean {
  const cleaned = asBrowserSees(url);
  return /^https?:\/\/[^\s]+$/i.test(cleaned);
}

/**
 * Whether an address may be emitted as a clickable link.
 *
 * Everything an image may be, plus `mailto:` and `tel:`.
 *
 * Found by building a real shop rather than by reading the compiler. A contact
 * link went in, the address was refused, and the LABEL survived, so the page
 * published a bullet reading "Email" that did nothing at all. That is worse
 * than omitting it, because it reads as a mistake the seller made.
 *
 * Neither scheme can execute anything. They hand a string to a mail client or
 * a dialler, which is the entire reason they exist. Both are still an allow
 * list rather than a hole, because the shape is checked too: a bare `mailto:`,
 * or one with a space in it, is refused like anything else.
 */
export function isSafeLinkUrl(url: string): boolean {
  const cleaned = asBrowserSees(url);
  if (isSafeUrl(url)) return true;

  // For a contact address, normalising is not enough: it must not have needed
  // normalising. `mailto:has space@example.com` survived the strip and became
  // a clickable link to a mangled address, because the space was removed for
  // the test and then percent encoded into the output. Caught by a test
  // written for this file, not by review.
  //
  // Whitespace inside an email address or a phone number means the address is
  // wrong, and silently repairing it is how you publish a contact link that
  // reaches nobody.
  if (cleaned !== url) return false;

  // One @ with something either side and a dot in the domain. Deliberately not
  // a full address grammar: this decides only whether to make it clickable,
  // and the mail application is the authority on whether an address is real.
  if (/^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(cleaned)) return true;
  // Digits, with the punctuation a written phone number actually contains.
  return /^tel:\+?[\d().-]{3,}$/i.test(cleaned);
}

/**
 * Percent-encodes the characters that could end an address early.
 *
 * A closing parenthesis ends the link target in Markdown, so an address
 * containing one truncates the link and drops the remainder into the page as
 * text. Whitespace does the same, and angle brackets could open a tag.
 *
 * Percent-encoding is used rather than backslash escaping because it is part of
 * the URL specification, so it survives any renderer, and the address still
 * resolves to the same resource.
 */
export function encodeAddress(url: string): string {
  return url.replace(/[()\s<>"'`\\]/g, (ch) => {
    const code = ch.codePointAt(0) ?? 0;
    return `%${code.toString(16).toUpperCase().padStart(2, "0")}`;
  });
}

/**
 * Emits a Markdown link.
 *
 * The caller has already established the address is safe. The label is escaped
 * as ordinary artist text, because it is ordinary artist text.
 */
export function emitLink(label: string, url: string): string {
  return `[${escapeText(label)}](${encodeAddress(url)})`;
}
