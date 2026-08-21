import type { Block } from "../../document/types.js";
import type { Target } from "../capabilities.js";
import { formatInline } from "../inline.js";
import { joinParts, sectionHeading } from "./shared.js";

/**
 * Emits a text section.
 *
 * Paragraphs, bullet lists, and the narrow inline grammar from `inline.ts`:
 * bold, italic, and links. Roadmap 1.7, which 1.3 deliberately deferred.
 *
 * Everything the artist writes is parsed and re-emitted rather than passed
 * through. A construct this file does not implement stays text and is escaped,
 * which is exactly what happened before formatting existed.
 *
 * A single newline inside a paragraph becomes a hard line break, in whichever
 * form the host actually implements. rentry runs Python-Markdown, which does
 * not implement the CommonMark backslash form and silently swallowed it,
 * joining two sentences with no space. Found by pasting real output into their
 * preview, not by any test.
 */
export function emitProse(block: Extract<Block, { kind: "prose" }>, target: Target): string {
  const hardBreak = target.capabilities.hardBreak === "spaces" ? "  \n" : "\\\n";

  const paragraphs = block.text
    .split(/\r?\n[ \t]*\r?\n/)
    .map((p) => p.trim())
    .filter((p) => p !== "")
    .map((chunk) => emitChunk(chunk, hardBreak));

  return joinParts([sectionHeading(block.heading, target), ...paragraphs]);
}

/**
 * A run of lines separated by blank lines, split into lists and paragraph text.
 *
 * Consecutive bullet lines become a list and everything else becomes prose, so
 * the shape artists actually write works:
 *
 *     I will not draw:
 *     - hate symbols
 *     - real people without consent
 *
 * An earlier version required EVERY line in the chunk to be a bullet, reasoning
 * that one stray dash should not restructure somebody's writing. That was too
 * strict. The intro line above is the common case, and it turned the whole
 * section into escaped text with visible backslashes in front of every dash.
 */
function emitChunk(chunk: string, hardBreak: string): string {
  const lines = chunk.split(/\r?\n/).map((l) => l.trim());
  const parts: string[] = [];

  let prose: string[] = [];
  let bullets: string[] = [];

  const flushProse = (): void => {
    if (prose.length > 0) parts.push(prose.map((l) => formatInline(l)).join(hardBreak));
    prose = [];
  };

  const flushBullets = (): void => {
    if (bullets.length > 0) {
      parts.push(bullets.map((l) => `- ${formatInline(stripMarker(l))}`).join("\n"));
    }
    bullets = [];
  };

  for (const line of lines) {
    if (isListItem(line)) {
      flushProse();
      bullets.push(line);
    } else {
      flushBullets();
      prose.push(line);
    }
  }

  flushProse();
  flushBullets();

  // A blank line before a list, or the text above it absorbs the first item on
  // some renderers.
  return parts.join("\n\n");
}

/**
 * Whether a line is a bullet an artist meant as a bullet.
 *
 * A marker followed by a space, and something after it. `-` alone is a line
 * with a dash on it, and `-word` is a word starting with a dash, neither of
 * which anyone intends as a list.
 */
function isListItem(line: string): boolean {
  return /^[-*+]\s+\S/.test(line);
}

function stripMarker(line: string): string {
  return line.replace(/^[-*+]\s+/, "");
}
