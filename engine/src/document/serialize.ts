/**
 * The canonical writer.
 *
 * The property this exists to provide: the bytes depend on the CONTENT alone.
 * Not on the order keys were assigned, not on how the page was built, not on
 * which process is writing. That is what lets two exports of one page be
 * compared, and what makes a stored page diffable.
 *
 * The ordering itself lives in `canonical.ts`, because the validator needs the
 * same operation to return a copy rather than the caller's own object.
 */
import { ordered } from "./canonical.js";
import { DOCUMENT_FIELDS } from "./descriptor.js";
import type { Document } from "./types.js";
import { validateDocument } from "./validate.js";

/**
 * Serializes a page canonically.
 *
 * Guarantee G7, review R-2: it validates first and refuses to write a page that
 * would not load. `JSON.stringify` turns NaN and Infinity into null, and null is
 * never valid here, so without this check a page could reach disk in a state
 * that cannot be read back. Losing an artist's work through the writer would be
 * the worst possible version of that failure.
 *
 * This is the one function in the module that throws, and deliberately. A
 * caller handing it an invalid page has a bug, not a user with a bad file.
 * Users' files arrive through `parseDocument`, which never throws.
 */
export function serializeDocument(doc: Document): string {
  const result = validateDocument(doc);
  if (!result.ok) {
    throw new Error(
      `refusing to write a page that could not be read back: ${result.issues
        .map((i) => `${i.path || "(root)"}: ${i.code}`)
        .join("; ")}`,
    );
  }

  // The validated result is already a descriptor-ordered copy, so ordering it
  // again would be redundant. Ordering the ORIGINAL would be wrong, since it
  // may carry values the copy normalised away.
  return JSON.stringify(ordered(DOCUMENT_FIELDS, result.document as unknown as Record<string, unknown>), null, 2);
}
