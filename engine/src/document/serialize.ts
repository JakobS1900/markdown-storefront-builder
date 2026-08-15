/**
 * The canonical writer.
 *
 * The property this exists to provide: the bytes depend on the CONTENT alone.
 * Not on the order keys were assigned, not on how the page was built, not on
 * which process is writing. That is what lets two exports of one page be
 * compared, and what makes a stored page diffable.
 *
 * Review R-3: it emits keys the descriptor names, in descriptor order, and
 * never enumerates the value it is given. JavaScript reorders integer-like
 * string keys, and an unknown key would otherwise land wherever iteration found
 * it, so enumerating the input would quietly break the guarantee.
 */
import {
  BLOCK_FIELDS,
  COMMON_BLOCK_FIELDS,
  DOCUMENT_FIELDS,
  type BlockKind,
  type FieldSpec,
} from "./descriptor.js";
import type { Document } from "./types.js";
import { validateDocument } from "./validate.js";

function has(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

/**
 * Rebuilds a value with its keys in descriptor order.
 *
 * Absent optional fields stay absent. They are never written as null and never
 * defaulted, so the distinction between absent and empty survives (FR-010).
 */
function ordered(specs: readonly FieldSpec[], source: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  for (const spec of specs) {
    if (!has(source, spec.name)) continue;
    const value = source[spec.name];
    if (value === undefined) continue;

    switch (spec.type) {
      case "objectArray":
        out[spec.name] = (value as Record<string, unknown>[]).map((entry) => ordered(spec.of, entry));
        break;
      case "blockArray":
        out[spec.name] = (value as Record<string, unknown>[]).map(orderedBlock);
        break;
      case "stringArray":
        out[spec.name] = [...(value as readonly string[])];
        break;
      default:
        out[spec.name] = value;
    }
  }

  return out;
}

function orderedBlock(block: Record<string, unknown>): Record<string, unknown> {
  const kind = block["kind"] as BlockKind;
  return ordered([...COMMON_BLOCK_FIELDS, ...BLOCK_FIELDS[kind]], block);
}

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

  return JSON.stringify(ordered(DOCUMENT_FIELDS, doc as unknown as Record<string, unknown>), null, 2);
}
