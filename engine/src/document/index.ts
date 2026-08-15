/**
 * The public surface of the document contract.
 *
 * Nothing outside this module may construct, parse, or serialize a page by
 * hand. Everything downstream, the compiler, storage, export, and the editor,
 * goes through what is exported here.
 *
 * Exactly what `specs/001-document-contract/contracts/document-api.md` lists,
 * and nothing more. The descriptor itself is deliberately not exported: it is
 * the implementation of the schema, not part of the interface, and exporting it
 * would invite consumers to build their own validator against it.
 */
export { SCHEMA_VERSION, BLOCK_KINDS } from "./descriptor.js";
export type { BlockKind } from "./descriptor.js";

export type { Block, Document, Issue, IssueCode, ValidationResult } from "./types.js";

export { parseDocument, validateDocument } from "./validate.js";
export { serializeDocument } from "./serialize.js";
export { emptyDocument } from "./empty.js";
