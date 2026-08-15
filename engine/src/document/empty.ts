import { SCHEMA_VERSION } from "./descriptor.js";
import type { Document } from "./types.js";

/**
 * A new, valid, empty page for the given target.
 *
 * It has no title, because an absent optional field is different from an empty
 * one and a page the artist has not titled has no title. Writing `""` here
 * would be inventing content they did not enter.
 *
 * A new page is valid from the moment it exists, which is what lets the editor
 * treat validity as an invariant rather than something to reach eventually.
 */
export function emptyDocument(target: string): Document {
  return {
    schemaVersion: SCHEMA_VERSION,
    target,
    blocks: [],
  };
}
