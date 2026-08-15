import type { Block } from "../../document/types.js";
import type { Target } from "../capabilities.js";
import { escapeText } from "../escape.js";
import { joinParts, sectionHeading } from "./shared.js";

/**
 * Emits a text section.
 *
 * Plain text, with blank lines separating paragraphs. Inline formatting is
 * deliberately out of scope: the contract stores this as one string and the
 * compiler escapes every Markdown character in artist text, so a subset grammar
 * needs either a parser with a whitelist or a change to the contract's shape.
 * Both are real decisions and neither belongs smuggled into an emitter.
 *
 * What it does support is what a terms and conditions section actually needs,
 * which is paragraphs.
 *
 * A single newline inside a paragraph becomes a hard line break, written as a
 * trailing backslash rather than two trailing spaces. Trailing whitespace is
 * invisible, is stripped on save by many editors, and would break byte
 * comparison, which is feature 002's review finding R-3 arriving in a new place.
 */
export function emitProse(block: Extract<Block, { kind: "prose" }>, target: Target): string {
  const paragraphs = block.text
    .split(/\r?\n[ \t]*\r?\n/)
    .map((p) => p.trim())
    .filter((p) => p !== "")
    .map((p) =>
      p
        .split(/\r?\n/)
        .map((line) => escapeText(line.trim()))
        .join("\\\n"),
    );

  return joinParts([sectionHeading(block.heading, target), ...paragraphs]);
}
