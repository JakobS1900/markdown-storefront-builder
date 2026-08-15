/**
 * Conventions every emitter shares.
 *
 * These exist so a page reads as one document rather than six sections written
 * by six different people, and so no section is safer or less safe than another
 * (FR-006, FR-008).
 */
import type { Target } from "../capabilities.js";
import type { DiagnosticSink } from "../diagnostics.js";
import { escapeInline, escapeText } from "../escape.js";
import { emitLink, isSafeUrl } from "../link.js";

/**
 * The heading level a section's own heading uses.
 *
 * Level 3, on the reasoning that artists use 1 and 2 for the page's own
 * structure, so a section heading sits below those without competing with them.
 * A convention rather than a discovery, applied identically everywhere, which
 * is the part that matters.
 */
export const SECTION_HEADING_LEVEL = 3;

/** Emits a section's optional heading, or nothing when it has none. */
export function sectionHeading(heading: string | undefined, target: Target): string | undefined {
  if (heading === undefined) return undefined;
  const text = escapeInline(heading);
  if (text === "") return undefined;
  const level = Math.min(SECTION_HEADING_LEVEL, target.capabilities.maxHeadingLevel);
  return `${"#".repeat(level)} ${text}`;
}

/**
 * Escapes text for a table cell.
 *
 * A cell is ended by a pipe and a row by a newline, so both must go. FR-003:
 * nothing an artist writes may break the table. `escapeText` already escapes
 * the pipe, and `escapeInline` already collapses every line-breaking character,
 * so a cell is simply inline text.
 */
export function cell(text: string): string {
  return escapeInline(text);
}

/**
 * Emits a link, or plain text plus a warning when the address is not safe.
 *
 * FR-004. Returning the label as text rather than dropping it means the artist
 * still sees what they wrote, and the warning tells them why it is not
 * clickable.
 */
export function safeLink(
  label: string,
  url: string,
  blockId: string,
  sink: DiagnosticSink,
): string {
  if (isSafeUrl(url)) return emitLink(label, url);

  sink.add({
    code: "link_scheme_refused",
    severity: "warning",
    blockId,
    message: `One of your links does not start with http:// or https://, so it has been left as plain text rather than made clickable. Links that use other kinds of address are not safe to publish.`,
  });

  return escapeText(label);
}

/** Joins the parts of a section, dropping the ones that produced nothing. */
export function joinParts(parts: readonly (string | undefined)[]): string {
  return parts.filter((p): p is string => p !== undefined && p !== "").join("\n\n");
}

/**
 * A bullet list, or nothing when there is nothing to list.
 *
 * FR-007: an empty collection produces no output rather than an empty list.
 */
export function bulletList(items: readonly string[]): string | undefined {
  if (items.length === 0) return undefined;
  return items.map((i) => `- ${i}`).join("\n");
}
