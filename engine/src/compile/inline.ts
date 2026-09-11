/**
 * The narrow inline grammar an artist may use inside a text section.
 *
 * Roadmap 1.7. Deferred out of 1.3 because it needed a real decision rather
 * than an emitter tweak: the contract stores `prose.text` as one string, and
 * every Markdown character in artist text is escaped, so supporting formatting
 * means either changing the contract's shape or parsing the string.
 *
 * Parsing won. A contract change would mean a schema version, a migration, and
 * a new editor surface for something artists already know how to type. They
 * have written `**bold**` on every site they have ever used.
 *
 * THE SECURITY MODEL, which is the whole reason this file is careful.
 *
 * Nothing is passed through. The text is parsed into a small set of known node
 * types, and the output is built from those nodes. Every piece of text reaches
 * the output through the escaper, and every marker in the output was written by
 * this file rather than copied from the input.
 *
 * That is the difference between a whitelist and a filter. An artist cannot
 * produce a construct that is not in `Node` below, however they write it,
 * because there is no path from input characters to output structure that does
 * not go through this parser. Anything the parser does not recognise stays text
 * and gets escaped, which is exactly the behaviour before this feature existed.
 */
import type { Target } from "./capabilities.js";
import type { DiagnosticSink } from "./diagnostics.js";
import { escapeText } from "./escape.js";
import { encodeAddress, isSafeLinkUrl } from "./link.js";

export type Node =
  | { readonly kind: "text"; readonly value: string }
  | { readonly kind: "strong"; readonly children: readonly Node[] }
  | { readonly kind: "em"; readonly children: readonly Node[] }
  /** `~~struck out~~`. Feature 028. Emitted only where the host renders it. */
  | { readonly kind: "strike"; readonly children: readonly Node[] }
  /** `==highlighted==`. Feature 028. Emitted only where the host renders it. */
  | { readonly kind: "highlight"; readonly children: readonly Node[] }
  /** `url` has already passed `isSafeLinkUrl`. An unsafe one never becomes a link. */
  | { readonly kind: "link"; readonly url: string; readonly children: readonly Node[] };

/**
 * `[label](url)`, `**strong**`, `~~strike~~`, `==highlight==`, `*em*`, `_em_`,
 * in that order of preference.
 *
 * Link first because its label can contain the emphasis markers, so the longer
 * construct has to win. Strong before em because `**` starts with `*`. The two
 * marks feature 028 added sit between them: they collide with nothing, and
 * grouping the two character markers together keeps the reason for the order
 * legible.
 *
 * Each pattern refuses to span a blank line and refuses an empty body, so a
 * stray `**` in ordinary writing stays a stray `**` rather than swallowing the
 * rest of the paragraph looking for a partner. The same `(?!\s)` and `(?<!\s)`
 * guards are on the new pair, which is what keeps `== spaced ==` text. That
 * matters more than it looks: text.is pairs markers with a space just inside
 * them and rentry does not, so a grammar that allowed it would produce a page
 * that means different things on two hosts.
 *
 * THE NEW PAIR ALSO REFUSES TO SIT INSIDE A LONGER RUN OF ITS OWN MARKER, and
 * that guard was put there by a golden diff rather than by foresight. Without
 * it, a seller underlining a heading by hand with `=====` had that line matched
 * as `==` plus `=` plus `==`: a highlight containing one equals sign. On rentry
 * it published as `==\===` and on portable, where the fallback drops the
 * markers, it published as `\=`. **Five characters the seller typed became
 * one.** That is the worst class of defect this project has: silent loss of
 * somebody's work, on the fallback path, where nothing would have complained.
 *
 * `(?<!=)==(?!=)` on both ends says the marker is the whole run or it is not a
 * marker. A run of three or more then stays text and is escaped, which is the
 * whitelist's correct answer to something ambiguous.
 *
 * The same shape exists on `**` and is NOT fixed here: `*****` still parses as
 * bold around an asterisk. It loses no characters, because that path has no
 * fallback that drops markers, and changing it would move goldens for a defect
 * outside this feature. Recorded rather than quietly fixed or quietly ignored.
 *
 * The address allows one level of balanced parentheses, because artists paste
 * encyclopedia links and a pattern that stopped at the first `)` truncated
 * them into a different address. One level covers every real case; a deeper
 * nesting stays text rather than producing a link to somewhere unintended.
 */
const PATTERN =
  /\[([^\]\n]*)\]\(((?:[^()\s\n]|\([^()\s\n]*\))*)\)|\*\*(?!\s)([^\n]+?)(?<!\s)\*\*|(?<!~)~~(?!~)(?!\s)([^\n]+?)(?<!\s)(?<!~)~~(?!~)|(?<!=)==(?!=)(?!\s)([^\n]+?)(?<!\s)(?<!=)==(?!=)|(?<![*\w])\*(?!\s)([^*\n]+?)(?<!\s)\*(?![*\w])|(?<![_\w])_(?!\s)([^_\n]+?)(?<!\s)_(?![_\w])/;

/**
 * Parses one line into nodes.
 *
 * `depth` stops a crafted input from recursing without bound. Two levels is
 * enough for the only nesting anyone writes, a link inside bold or bold inside
 * a link, and everything deeper stays text.
 */
export function parseInline(text: string, depth = 0): Node[] {
  if (depth > 2 || text === "") return text === "" ? [] : [{ kind: "text", value: text }];

  const nodes: Node[] = [];
  let rest = text;

  while (rest !== "") {
    const match = PATTERN.exec(rest);
    if (match === null || match.index === undefined) break;

    if (match.index > 0) nodes.push({ kind: "text", value: rest.slice(0, match.index) });

    const [whole, linkLabel, linkUrl, strong, strike, highlight, emStar, emUnderscore] = match;

    if (linkUrl !== undefined) {
      // An unsafe address never becomes a link. The label and the raw address
      // are kept as text, so the artist can see what they wrote and fix it,
      // rather than having it silently vanish.
      if (isSafeLinkUrl(linkUrl)) {
        nodes.push({
          kind: "link",
          url: linkUrl,
          children: parseInline(linkLabel ?? "", depth + 1),
        });
      } else {
        nodes.push({ kind: "text", value: whole });
      }
    } else if (strong !== undefined) {
      nodes.push({ kind: "strong", children: parseInline(strong, depth + 1) });
    } else if (strike !== undefined) {
      nodes.push({ kind: "strike", children: parseInline(strike, depth + 1) });
    } else if (highlight !== undefined) {
      nodes.push({ kind: "highlight", children: parseInline(highlight, depth + 1) });
    } else if (emStar !== undefined) {
      nodes.push({ kind: "em", children: parseInline(emStar, depth + 1) });
    } else if (emUnderscore !== undefined) {
      nodes.push({ kind: "em", children: parseInline(emUnderscore, depth + 1) });
    }

    rest = rest.slice(match.index + whole.length);
  }

  if (rest !== "") nodes.push({ kind: "text", value: rest });
  return nodes;
}

/**
 * What each host-dependent mark is called, what it emits, and what to say when
 * the host cannot show it.
 *
 * A table rather than two branches, because Principle II says nothing in the
 * emitters may know which host it is compiling for. This asks the capability
 * record a question and reads the answer; adding a third mark is a row.
 */
const MARKS = {
  strike: {
    capability: "strikethrough",
    marker: "~~",
    /** Written for the seller. FR-081: never quotes their own words back. */
    what: "Crossing words out",
  },
  highlight: {
    capability: "highlight",
    marker: "==",
    what: "Highlighting words",
  },
} as const;

/**
 * Emits nodes as Markdown, for one host.
 *
 * Every marker here is written by this function. Every piece of text goes
 * through `escapeText`. There is no branch that copies input to output.
 *
 * THE TARGET IS HERE AND NOT IN `parseInline`, WHICH IS THE POINT OF THE SPLIT.
 * Strikethrough and highlight are the first constructs whose OUTPUT depends on
 * the host, so something had to learn about hosts. Keeping it out of the parser
 * leaves the security-critical half exactly as it was, still pure, still
 * testable on its own, and still the only path from input characters to
 * structure.
 *
 * The rejected alternative is worth naming because it is the obvious one:
 * strip unsupported markers in a pass AFTER emitting. That means parsing the
 * compiler's own output to find markers the compiler just wrote, and this
 * project already knows how that ends. The forgery bug is exactly it: a pattern
 * cannot tell the seller's words from the compiler's structure once they are
 * the same characters.
 *
 * `warned` is threaded through so a seller with five highlighted words gets one
 * warning about the section rather than five identical ones.
 */
export function emitInline(
  nodes: readonly Node[],
  target: Target,
  sink: DiagnosticSink,
  blockId: string,
  warned: Set<string> = new Set(),
): string {
  let out = "";

  for (const node of nodes) {
    // A bracket written by this function turns a preceding exclamation mark
    // into an image marker, and that mark came from the artist.
    //
    // The escaper stopped escaping `!` in feature 013, on the reasoning that an
    // image needs `![` and `[` is escaped on every path. That reasoning missed
    // this one: the bracket here is ours, not theirs, so `![alt](url)` in a
    // paragraph became a real embedded image rather than the literal text they
    // typed. Escaping it at the seam keeps `!` free everywhere else, which is
    // the whole point of the change.
    if (node.kind === "link" && /(^|[^\\])!$/.test(out)) {
      out = `${out.slice(0, -1)}\\!`;
    }

    switch (node.kind) {
      case "text":
        out += escapeText(node.value);
        break;
      case "strong":
        out += `**${emitInline(node.children, target, sink, blockId, warned)}**`;
        break;
      case "em":
        out += `*${emitInline(node.children, target, sink, blockId, warned)}*`;
        break;
      case "strike":
      case "highlight": {
        const mark = MARKS[node.kind];
        const inner = emitInline(node.children, target, sink, blockId, warned);
        if (target.capabilities[mark.capability]) {
          out += `${mark.marker}${inner}${mark.marker}`;
          break;
        }
        // The declared fallback: the words, plain, with nothing left over for a
        // reader to puzzle over. Not bold, which would silently substitute
        // something the seller did not choose, and not the literal markers,
        // which would publish `==limited run==` to a buyer.
        //
        // The seller is not left to discover this. Principle VII: the preview
        // renders the compiled output for the host they picked, so they see the
        // word flat AND read this warning, before publishing rather than after.
        out += inner;
        if (!warned.has(mark.capability)) {
          warned.add(mark.capability);
          sink.add({
            code: "mark_unsupported",
            severity: "warning",
            blockId,
            capability: mark.capability,
            message: `${mark.what} is not something ${target.name} shows, so those words appear as ordinary text there.`,
          });
        }
        break;
      }
      case "link": {
        const label = emitInline(node.children, target, sink, blockId, warned);
        // A link with no visible label would be invisible on the page, so the
        // address stands in for it.
        out += `[${label === "" ? escapeText(node.url) : label}](${encodeAddress(node.url)})`;
        break;
      }
    }
  }

  return out;
}

/** Parses and emits in one step, which is all any caller wants. */
export function formatInline(
  text: string,
  target: Target,
  sink: DiagnosticSink,
  blockId: string,
  warned?: Set<string>,
): string {
  return emitInline(parseInline(text), target, sink, blockId, warned);
}
