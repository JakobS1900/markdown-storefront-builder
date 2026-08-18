/**
 * The supported hosts. Data only.
 *
 * Adding a host is a new record in this file plus golden fixtures. If adding
 * one ever requires touching `emit/` or `compile.ts`, the design has failed and
 * the change should be redesigned rather than merged. Constitution Principle II.
 *
 * Every capability value cites its source. FR-014: a value may not be written
 * from assumption. Where a host does not document something, it is recorded as
 * unknown rather than guessed, because assuming support produces broken pages
 * for artists while assuming absence produces safe ones.
 */
import type { Target } from "./capabilities.js";

/**
 * The baseline that works anywhere: strict CommonMark plus GFM tables.
 *
 * Defined by a specification rather than by somebody's deployment, so it cannot
 * go offline, change under us, or refuse our connection the way `txt.is` did
 * during host verification. It is also the fallback for a host this build does
 * not know, because it is what every other host approximates.
 */
export const PORTABLE: Target = {
  id: "portable",
  name: "Portable (works anywhere)",
  capabilities: {
    maxHeadingLevel: 6,
    thematicBreak: "***",
    tables: true,
    hardBreak: "backslash",
    escapeStyle: "commonmark",
  },
  sources: {
    maxHeadingLevel: "CommonMark specification, ATX headings are levels 1 to 6",
    hardBreak: "CommonMark specification, a backslash at end of line is a hard break",
    tables: "GFM specification, pipe tables. Part of the declared portable baseline",
    thematicBreak: "CommonMark specification, thematic break. Chosen over --- per review R-1",
    escapeStyle: "CommonMark specification, backslash escapes for ASCII punctuation",
    maxBytes: "Not applicable. A specification has no page size limit",
  },
};

/**
 * rentry.co. The host the commission scene actually uses.
 *
 * Verified against https://rentry.co/how on 2026-08-15, recorded in
 * `docs/research/2026-08-15-host-verification.md`.
 *
 * Its two genuinely non-standard features, image sizing `{100px:100px}` and the
 * `[TOC]` family, are not represented here because no emitter in this release
 * uses them. They arrive with the gallery emitter in 1.5.
 */
export const RENTRY: Target = {
  id: "rentry",
  name: "rentry.co",
  capabilities: {
    maxHeadingLevel: 6,
    thematicBreak: "***",
    tables: true,
    hardBreak: "spaces",
    escapeStyle: "commonmark",
  },
  sources: {
    maxHeadingLevel: "rentry.co/how documents # through ###### , six levels",
    hardBreak: "Observed in rentry's live preview on 2026-08-18: the backslash form produced no break and was swallowed, joining the two lines. Two trailing spaces is the form Python-Markdown implements",
    tables: "rentry.co/how documents pipe tables, with --: and :--: alignment",
    thematicBreak: "Standard Markdown, no documented divergence. *** per review R-1",
    escapeStyle: "rentry.co/how documents no divergence from standard escaping",
    maxBytes: "rentry.co/how documents no limit. Recorded as unknown, not as unlimited",
  },
};

export const TARGETS: readonly Target[] = [PORTABLE, RENTRY];

/** The target used when a page names a host this build does not know. */
export const FALLBACK_TARGET = PORTABLE;

/**
 * Looks up a target by the identifier stored in a page.
 *
 * Returns undefined rather than throwing or falling back, so the caller decides
 * what an unknown host means. `compile` falls back and warns; a target switcher
 * in the app might want to offer to add it instead.
 */
export function findTarget(id: string): Target | undefined {
  return TARGETS.find((t) => t.id === id);
}
