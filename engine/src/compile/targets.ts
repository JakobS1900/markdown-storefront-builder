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
    hardBreak: "spaces",
    escapeStyle: "commonmark",
  },
  sources: {
    maxHeadingLevel: "CommonMark specification, ATX headings are levels 1 to 6",
    hardBreak:
      "CommonMark specification, section 6.12: BOTH two trailing spaces and a trailing backslash are hard breaks. This was the backslash until 2026-09-01, on the reasoning that it is the form a specification names first and the form that survives an editor stripping trailing whitespace. That reasoning was about the specification rather than about hosts, and this target's entire job is the hosts. Of the three verified, the backslash is a hard break on none of the Python-Markdown ones: rentry swallows it (2026-08-18) and text.is is worse, consuming the newline and the joining space so two sentences run together (2026-09-01). Two trailing spaces work on every host verified and are equally valid CommonMark, so the target named 'works anywhere' now emits the form that does. The cost is real and accepted: an editor that strips trailing whitespace silently removes the break, which loses a line break, where the backslash form loses the space between two words on a live page",
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
    escapeStyle: "Observed in rentry's live preview on 2026-08-31, one line per character: the backslash was consumed for ` * _ { } [ ] ( ) # + - . ! | and a literal backslash, and left visible for ~ ^ and $. Those three are emitted as numeric character references instead. This value previously read 'documents no divergence from standard escaping', which is an absence of documentation recorded as a presence of behaviour, exactly what FR-014 above forbids",
    maxBytes: "rentry.co/how documents no limit. Recorded as unknown, not as unlimited",
  },
};

/**
 * text.is. A Markdown pastebin, free, no account, custom URLs and edit codes.
 *
 * Every value here was observed on 2026-09-01 by driving the host's own
 * renderer at `/markdownx/markdownify/`, which is the endpoint its pages are
 * rendered by. Recorded in `docs/research/2026-09-01-textis-verification.md`.
 *
 * It was tempting to copy rentry's values wholesale. Both run Python-Markdown
 * behind django-markdownx, and the first version of the research said so and
 * stopped there. They are not the same host: a trailing backslash is literal
 * text on rentry and DESTRUCTIVE here, eating the newline and the space that
 * would have joined the two lines, and the set of characters a backslash
 * cannot protect is three on rentry and one here. A family resemblance is not
 * an observation, which is the rule FR-014 already states.
 */
export const TEXT_IS: Target = {
  id: "text.is",
  name: "text.is",
  capabilities: {
    maxHeadingLevel: 6,
    thematicBreak: "***",
    tables: true,
    hardBreak: "spaces",
    escapeStyle: "commonmark",
    maxBytes: 200000,
  },
  sources: {
    maxHeadingLevel:
      "Observed 2026-09-01: # through ###### each produced h1 to h6 in the host's own renderer",
    hardBreak:
      "Observed 2026-09-01: two trailing spaces produced <br>. A trailing backslash is destructive here, joining EEE and FFF into EEEFFF with the newline and the space both consumed, so the CommonMark form must never be emitted for this host. A plain single newline also produces <br>, because nl2br is on, which is why nothing may be soft wrapped",
    tables:
      "Observed 2026-09-01: a GFM pipe table produced table and th elements",
    thematicBreak: "Observed 2026-09-01: *** produced an hr",
    escapeStyle:
      "Observed 2026-09-01, one line per character, twenty nine characters: the backslash was consumed for every one of them except the tilde. That is narrower than rentry, where it also fails for the caret and the dollar sign. All three are emitted as numeric character references regardless, and those were confirmed here to render as the character the seller typed, with a doubled entity tilde staying literal text while a real one is still struck through",
    maxBytes:
      "Observed 2026-09-01: the paste form carries maxlength=\"200000\". That counts characters and this field counts bytes, so it is recorded as bytes deliberately: a page inside 200000 bytes holds at most 200000 characters, so the limit is conservative in the safe direction rather than assumed",
  },
};

export const TARGETS: readonly Target[] = [PORTABLE, RENTRY, TEXT_IS];

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
