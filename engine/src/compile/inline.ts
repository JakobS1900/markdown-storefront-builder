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
import { escapeText } from "./escape.js";
import { encodeAddress, isSafeUrl } from "./link.js";

export type Node =
  | { readonly kind: "text"; readonly value: string }
  | { readonly kind: "strong"; readonly children: readonly Node[] }
  | { readonly kind: "em"; readonly children: readonly Node[] }
  /** `url` has already passed `isSafeUrl`. An unsafe one never becomes a link. */
  | { readonly kind: "link"; readonly url: string; readonly children: readonly Node[] };

/**
 * `[label](url)`, `**strong**`, `*em*`, `_em_`, in that order of preference.
 *
 * Link first because its label can contain the emphasis markers, so the longer
 * construct has to win. Strong before em because `**` starts with `*`.
 *
 * Each pattern refuses to span a blank line and refuses an empty body, so a
 * stray `**` in ordinary writing stays a stray `**` rather than swallowing the
 * rest of the paragraph looking for a partner.
 *
 * The address allows one level of balanced parentheses, because artists paste
 * encyclopedia links and a pattern that stopped at the first `)` truncated
 * them into a different address. One level covers every real case; a deeper
 * nesting stays text rather than producing a link to somewhere unintended.
 */
const PATTERN =
  /\[([^\]\n]*)\]\(((?:[^()\s\n]|\([^()\s\n]*\))*)\)|\*\*(?!\s)([^\n]+?)(?<!\s)\*\*|(?<![*\w])\*(?!\s)([^*\n]+?)(?<!\s)\*(?![*\w])|(?<![_\w])_(?!\s)([^_\n]+?)(?<!\s)_(?![_\w])/;

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

    const [whole, linkLabel, linkUrl, strong, emStar, emUnderscore] = match;

    if (linkUrl !== undefined) {
      // An unsafe address never becomes a link. The label and the raw address
      // are kept as text, so the artist can see what they wrote and fix it,
      // rather than having it silently vanish.
      if (isSafeUrl(linkUrl)) {
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
 * Emits nodes as Markdown.
 *
 * Every marker here is written by this function. Every piece of text goes
 * through `escapeText`. There is no branch that copies input to output.
 */
export function emitInline(nodes: readonly Node[]): string {
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
        out += `**${emitInline(node.children)}**`;
        break;
      case "em":
        out += `*${emitInline(node.children)}*`;
        break;
      case "link": {
        const label = emitInline(node.children);
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
export function formatInline(text: string): string {
  return emitInline(parseInline(text));
}
