import { SCHEMA_VERSION } from "./descriptor.js";
import type { Document } from "./types.js";
import { validateDocument } from "./validate.js";

/**
 * A new, valid, empty page for the given target.
 *
 * It has no title, because an absent optional field is different from an empty
 * one and a page the artist has not titled has no title. Writing `""` here
 * would be inventing content they did not enter.
 *
 * Holistic review H-2: this validates what it built before returning it. The
 * contract promises a new page is valid from the moment it is created, and the
 * editor is entitled to rely on that. A blank target would otherwise produce a
 * page that quietly fails to validate and cannot be written.
 *
 * Like the writer, it throws rather than returning a result, because a caller
 * passing a blank target has a bug. Nothing a user types reaches this argument.
 */
export function emptyDocument(target: string): Document {
  const doc: Document = {
    schemaVersion: SCHEMA_VERSION,
    target,
    blocks: [],
  };

  const result = validateDocument(doc);
  if (!result.ok) {
    throw new Error(
      `cannot create a page with this target: ${result.issues.map((i) => i.code).join("; ")}`,
    );
  }

  return result.document;
}
