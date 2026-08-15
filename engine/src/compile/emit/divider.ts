import type { Target } from "../capabilities.js";

/**
 * Emits a section separator.
 *
 * The separator text comes from the target rather than being written here, so
 * that a host rendering something other than the standard form is a data change
 * rather than a code change. Constitution Principle II.
 *
 * The value is `***` for both current hosts. Architecture review R-1: `---`
 * turns the preceding line into a heading and is read as front matter at the
 * start of a document, and `***` can do neither.
 */
export function emitDivider(target: Target): string {
  return target.capabilities.thematicBreak;
}
