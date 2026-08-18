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
 * A single newline inside a paragraph becomes a hard line break, in whichever
 * form the host actually implements.
 *
 * The backslash form is cleaner, since trailing whitespace is invisible and
 * gets stripped on save by many editors. It is also not universal: rentry runs
 * Python-Markdown, which does not implement it, and emitted no break there
 * while swallowing the character, so two lines ran together with no space.
 *
 * So the form is a capability now rather than a preference. This is the first
 * place the two shipped hosts produce genuinely different output.
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
        .join(target.capabilities.hardBreak === "spaces" ? "  \n" : "\\\n"),
    );

  return joinParts([sectionHeading(block.heading, target), ...paragraphs]);
}
