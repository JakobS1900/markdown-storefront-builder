/**
 * Rebuilding a page in descriptor order.
 *
 * Two callers need this and neither may depend on the other: the writer, so the
 * bytes depend on content alone, and the validator, so an accepted page is a
 * copy rather than the caller's own object. It lives here so there is one
 * implementation rather than two that could drift.
 *
 * Review R-3: keys come from the descriptor, in descriptor order, and the input
 * value is never enumerated. JavaScript hoists integer-like string keys to the
 * front, and an unknown key would otherwise land wherever iteration found it.
 */
import {
  BLOCK_FIELDS,
  COMMON_BLOCK_FIELDS,
  type BlockKind,
  type FieldSpec,
} from "./descriptor.js";

function has(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

/**
 * Returns a new object carrying the descriptor's fields, in its order.
 *
 * Absent optional fields stay absent. They are never written as null and never
 * defaulted into existence, so the difference between absent and empty survives
 * (FR-010). Anything the descriptor does not name is dropped, which is safe
 * because only an already-validated page reaches here, and validation refuses
 * unknown fields.
 */
export function ordered(
  specs: readonly FieldSpec[],
  source: Record<string, unknown>,
): Record<string, unknown> {
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

export function orderedBlock(block: Record<string, unknown>): Record<string, unknown> {
  const kind = block["kind"] as BlockKind;
  return ordered([...COMMON_BLOCK_FIELDS, ...BLOCK_FIELDS[kind]], block);
}
