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
 * Whether an address may be emitted as a link.
 *
 * Only http and https. Everything else, including `javascript:`, `data:`,
 * `vbscript:`, and `file:`, is refused and rendered as plain text by the
 * caller.
 *
 * An allow list rather than a deny list, because the set of dangerous schemes
 * is open ended and browsers keep adding to it, while the set of schemes an
 * artist needs on a commission page is two.
 *
 * `mailto:` is refused too. It is not dangerous, but it is not something the
 * current contract offers a field for, so accepting it would be accepting
 * something nothing produces.
 */
export function isSafeUrl(url: string): boolean {
  // Browsers strip whitespace and control characters before reading the
  // scheme, so a tab inside "java<tab>script:" reaches the parser as
  // "javascript:". Stripping them here means this check sees what the
  // browser will see, not the decorated version an attacker supplied.
  // no-control-regex exists to catch control characters arriving by
  // accident. These are the entire point.
  // eslint-disable-next-line no-control-regex
  const cleaned = url.replace(/[\s\u0000-\u001f\u007f]/g, "");
  return /^https?:\/\/[^\s]+$/i.test(cleaned);
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
