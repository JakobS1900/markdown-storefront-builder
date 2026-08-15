import type { Block } from "../../document/types.js";
import type { Target } from "../capabilities.js";
import type { DiagnosticSink } from "../diagnostics.js";
import { escapeInline } from "../escape.js";

/**
 * Emits a heading.
 *
 * Two rules earn their place here.
 *
 * A heading deeper than the host supports is emitted at the deepest level the
 * host does support, with a warning (FR-012). The alternatives are all worse:
 * dropping it loses the artist's structure, emitting seven hashes produces
 * literal hashes that look like their mistake, and falling back to bold text
 * loses the anchor and the table of contents entry.
 *
 * A heading whose text is empty emits the hashes alone (review R-3). A trailing
 * space is invisible in review, is stripped on save by many editors, and would
 * break byte comparison with a diff nobody can read.
 */
export function emitHeading(
  block: Extract<Block, { kind: "heading" }>,
  target: Target,
  sink: DiagnosticSink,
): string {
  const max = target.capabilities.maxHeadingLevel;
  const level = Math.min(block.level, max);

  if (level < block.level) {
    sink.add({
      code: "heading_level_reduced",
      severity: "warning",
      blockId: block.id,
      capability: "maxHeadingLevel",
      message: `${target.name} only supports headings ${max} levels deep. This heading was level ${block.level} and will show as level ${max}.`,
    });
  }

  const text = escapeInline(block.text);
  const hashes = "#".repeat(level);
  return text === "" ? hashes : `${hashes} ${text}`;
}
