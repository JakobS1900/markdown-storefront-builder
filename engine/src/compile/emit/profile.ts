import type { Block } from "../../document/types.js";
import type { Target } from "../capabilities.js";
import type { DiagnosticSink } from "../diagnostics.js";
import { escapeInline, escapeText } from "../escape.js";
import { encodeAddress, isSafeUrl } from "../link.js";
import { SECTION_HEADING_LEVEL, bulletList, joinParts, safeLink } from "./shared.js";

type Profile = Extract<Block, { kind: "profile" }>;

/** How each status reads to a client, rather than how it is stored. */
const STATUS_TEXT: Record<string, string> = {
  open: "Commissions are OPEN",
  closed: "Commissions are CLOSED",
  waitlist: "Waitlist only",
};

/**
 * Emits the profile section: who the artist is and how to reach them.
 *
 * The display name IS this section's heading, so unlike the others it has no
 * separate heading field and none is emitted.
 *
 * The status is bold and on its own line, because it is the single thing a
 * client looks for first. Putting it in a list with everything else would be a
 * design failure dressed up as consistency.
 */
export function emitProfile(block: Profile, target: Target, sink: DiagnosticSink): string {
  const parts: (string | undefined)[] = [];

  // A section the artist has started but not named yet emits no heading rather
  // than a bare run of hashes. The contract deliberately allows empty content,
  // so every emitter has to cope with it gracefully.
  const name = escapeInline(block.displayName);
  if (name !== "") {
    const level = Math.min(SECTION_HEADING_LEVEL, target.capabilities.maxHeadingLevel);
    parts.push(`${"#".repeat(level)} ${name}`);
  }

  if (block.avatarUrl !== undefined) {
    if (isSafeUrl(block.avatarUrl)) {
      parts.push(`![](${encodeAddress(block.avatarUrl)})`);
    } else {
      // Holistic review HB-6: this used to drop the avatar in silence while
      // every other refused address warned. SC-004 allows zero silent
      // degradations, and an artist whose picture vanishes with no explanation
      // has no way to work out why.
      sink.add({
        code: "link_scheme_refused",
        severity: "warning",
        blockId: block.id,
        message:
          "Your profile picture does not have an http:// or https:// address, so it has been left out. Images need a web address to show on your page.",
      });
    }
  }

  if (block.tagline !== undefined && block.tagline !== "") {
    parts.push(`*${escapeInline(block.tagline)}*`);
  }

  if (block.status !== undefined) {
    // The contract already restricts status to three values, so the fallback
    // exists only so that adding a fourth cannot silently emit nothing.
    parts.push(`**${escapeText(STATUS_TEXT[block.status] ?? block.status)}**`);
  }

  if (block.links !== undefined && block.links.length > 0) {
    parts.push(bulletList(block.links.map((l) => safeLink(l.label, l.url, block.id, sink))));
  }

  if (block.paymentMethods !== undefined && block.paymentMethods.length > 0) {
    parts.push(`Payment: ${block.paymentMethods.map(escapeText).join(", ")}`);
  }

  return joinParts(parts);
}
