/**
 * The validator. Everything external enters the product through here.
 *
 * Two properties it must never lose:
 *   - it never throws, for any input at all (G1),
 *   - it never mutates what it is given (G5).
 *
 * It walks the descriptor rather than knowing the schema itself, so a field
 * added to `descriptor.ts` is validated with no change to this file.
 */
import { ordered } from "./canonical.js";
import {
  BLOCK_FIELDS,
  BLOCK_KINDS,
  COMMON_BLOCK_FIELDS,
  DOCUMENT_FIELDS,
  SCHEMA_VERSION,
  type BlockKind,
  type FieldSpec,
} from "./descriptor.js";
import { migrate } from "./migrate.js";
import type { Document, Issue, IssueCode, ValidationResult } from "./types.js";

/** Own-property test that cannot be fooled by anything on the prototype. */
function has(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Every key the artist's data actually carries, including `__proto__`.
 *
 * `Object.keys` reports a `__proto__` key that arrived through `JSON.parse` as
 * an ordinary own property, so it is seen here and refused as an unknown field
 * like any other. Nothing in this module ever assigns a key taken from input,
 * which is what would be required to pollute a prototype.
 */
function ownKeys(obj: Record<string, unknown>): string[] {
  return Object.keys(obj);
}

class Collector {
  readonly issues: Issue[] = [];

  add(code: IssueCode, path: string, message: string, blockId?: string): void {
    this.issues.push(blockId === undefined ? { code, path, message } : { code, path, message, blockId });
  }
}

function join(path: string, part: string): string {
  return path === "" ? part : `${path}.${part}`;
}

/**
 * Checks one field against its spec.
 *
 * Messages are written for the artist whose page it is, per FR-003 and SC-006.
 * They name the field, say what is wrong, and say what is expected.
 */
function checkField(
  spec: FieldSpec,
  container: Record<string, unknown>,
  basePath: string,
  c: Collector,
  blockId?: string,
): void {
  const path = join(basePath, spec.name);
  const present = has(container, spec.name);

  if (!present) {
    if (spec.required) {
      c.add("missing_field", path, `This page is missing "${spec.name}", which is required.`, blockId);
    }
    // Absent optional field. Left absent, never defaulted into existence.
    return;
  }

  const value = container[spec.name];

  if (value === null) {
    c.add(
      "null_not_allowed",
      path,
      `"${spec.name}" is empty in a way this page cannot store. Remove it, or give it a value.`,
      blockId,
    );
    return;
  }

  if (value === undefined) {
    c.add("wrong_type", path, `"${spec.name}" has no value. Remove it, or give it a value.`, blockId);
    return;
  }

  switch (spec.type) {
    case "string": {
      if (typeof value !== "string") {
        c.add("wrong_type", path, `"${spec.name}" should be text.`, blockId);
        return;
      }
      if (spec.nonEmpty === true && value === "") {
        c.add("empty_string_not_allowed", path, `"${spec.name}" cannot be blank.`, blockId);
      }
      return;
    }

    case "integer": {
      if (typeof value !== "number") {
        c.add("wrong_type", path, `"${spec.name}" should be a number.`, blockId);
        return;
      }
      // Review R-2. NaN and Infinity stringify to null, and null is never
      // valid, so a page carrying one would be written in a state that cannot
      // be read back.
      if (!Number.isFinite(value) || !Number.isInteger(value)) {
        c.add(
          "not_finite",
          path,
          `"${spec.name}" should be a whole number. It is currently ${String(value)}.`,
          blockId,
        );
        return;
      }
      if (spec.min !== undefined && value < spec.min) {
        c.add("out_of_range", path, `"${spec.name}" should be at least ${spec.min}.`, blockId);
        return;
      }
      if (spec.max !== undefined && value > spec.max) {
        c.add("out_of_range", path, `"${spec.name}" should be at most ${spec.max}.`, blockId);
      }
      return;
    }

    case "enum": {
      if (typeof value !== "string") {
        c.add("wrong_type", path, `"${spec.name}" should be text.`, blockId);
        return;
      }
      if (!spec.values.includes(value)) {
        c.add(
          "not_in_enum",
          path,
          `"${spec.name}" should be one of ${spec.values.join(", ")}. It is currently "${value}".`,
          blockId,
        );
      }
      return;
    }

    case "stringArray": {
      if (!Array.isArray(value)) {
        c.add("wrong_type", path, `"${spec.name}" should be a list.`, blockId);
        return;
      }
      value.forEach((entry, i) => {
        if (entry === null) {
          c.add("null_not_allowed", `${path}[${i}]`, `Item ${i + 1} of "${spec.name}" is empty.`, blockId);
        } else if (typeof entry !== "string") {
          c.add("wrong_type", `${path}[${i}]`, `Item ${i + 1} of "${spec.name}" should be text.`, blockId);
        }
      });
      return;
    }

    case "objectArray": {
      if (!Array.isArray(value)) {
        c.add("wrong_type", path, `"${spec.name}" should be a list.`, blockId);
        return;
      }
      value.forEach((entry, i) => {
        const entryPath = `${path}[${i}]`;
        if (!isPlainObject(entry)) {
          c.add("wrong_type", entryPath, `Item ${i + 1} of "${spec.name}" is not filled in correctly.`, blockId);
          return;
        }
        checkFields(spec.of, entry, entryPath, c, blockId);
      });
      return;
    }

    case "blockArray": {
      if (!Array.isArray(value)) {
        c.add("wrong_type", path, `"${spec.name}" should be a list of sections.`, blockId);
        return;
      }
      checkBlocks(value, path, c);
      return;
    }
  }
}

/** Checks a whole object against a field list, and refuses anything extra. */
function checkFields(
  specs: readonly FieldSpec[],
  container: Record<string, unknown>,
  basePath: string,
  c: Collector,
  blockId?: string,
): void {
  for (const spec of specs) checkField(spec, container, basePath, c, blockId);

  // FR-017. An unknown field means the page came from somewhere this version
  // does not understand, so it is refused rather than guessed at.
  const known = new Set(specs.map((s) => s.name));
  for (const key of ownKeys(container)) {
    if (!known.has(key)) {
      c.add(
        "unknown_field",
        join(basePath, key),
        `This page contains "${key}", which this version does not recognise.`,
        blockId,
      );
    }
  }
}

/**
 * Two rows in one price list cannot share an identifier.
 *
 * Scoped to the block, not the page, because that is what selection needs and
 * because the version 3 migration numbers each block's rows from zero, so `t0`
 * legitimately appears once per price list.
 */
function checkTierIds(block: Record<string, unknown>, path: string, c: Collector, blockId?: string): void {
  const tiers = block["tiers"];
  if (!Array.isArray(tiers)) return;

  const seen = new Map<string, number>();
  tiers.forEach((tier: unknown, i: number) => {
    if (typeof tier !== "object" || tier === null) return;
    const id = (tier as Record<string, unknown>)["id"];
    if (typeof id !== "string" || id === "") return;

    const first = seen.get(id);
    if (first === undefined) {
      seen.set(id, i);
      return;
    }
    c.add(
      "duplicate_id",
      `${path}.tiers[${String(i)}].id`,
      `Items ${String(first + 1)} and ${String(i + 1)} in this price list share the same identifier "${id}". Each item needs its own.`,
      blockId,
    );
  });
}

function checkBlocks(blocks: readonly unknown[], basePath: string, c: Collector): void {
  const seen = new Map<string, number>();

  blocks.forEach((block, i) => {
    const path = `${basePath}[${i}]`;

    if (!isPlainObject(block)) {
      c.add("wrong_type", path, `Section ${i + 1} is not filled in correctly.`);
      return;
    }

    const rawId = block["id"];
    const blockId = typeof rawId === "string" && rawId !== "" ? rawId : undefined;

    const rawKind = block["kind"];
    if (typeof rawKind !== "string" || !(BLOCK_KINDS as readonly string[]).includes(rawKind)) {
      // Without a known kind there is no field list to check against, so the
      // rest of this block cannot be judged. Reported and skipped, never
      // ignored: dropping it silently would lose a section of their page.
      //
      // Holistic review H-1: only `id` is checked here, and the unknown-field
      // sweep is deliberately NOT run. Every field of an unrecognised block
      // looks unknown, so sweeping would bury the one issue that matters under
      // a list telling the artist to fix fields that are probably fine.
      checkField(COMMON_BLOCK_FIELDS[0], block, path, c, blockId);
      c.add(
        "unknown_kind",
        join(path, "kind"),
        `Section ${i + 1} is of a type this version does not recognise${
          typeof rawKind === "string" ? `: "${rawKind}"` : ""
        }.`,
        blockId,
      );
      return;
    }

    const kind = rawKind as BlockKind;
    checkFields([...COMMON_BLOCK_FIELDS, ...BLOCK_FIELDS[kind]], block, path, c, blockId);

    if (kind === "menu") {
      checkTierIds(block, path, c, blockId);
    }

    if (blockId !== undefined) {
      const first = seen.get(blockId);
      if (first !== undefined) {
        c.add(
          "duplicate_id",
          join(path, "id"),
          `Sections ${first + 1} and ${i + 1} share the same identifier "${blockId}". Each section needs its own.`,
          blockId,
        );
      } else {
        seen.set(blockId, i);
      }
    }
  });
}

/** The version gate. Runs first and short-circuits, per G6. */
function checkVersion(input: Record<string, unknown>, c: Collector): "stop" | "continue" {
  if (!has(input, "schemaVersion")) {
    c.add("version_missing", "schemaVersion", "This file does not say which version of the page format it uses.");
    return "stop";
  }

  const version = input["schemaVersion"];
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) {
    c.add(
      "version_malformed",
      "schemaVersion",
      "This file's page format version is not a whole number, so it cannot be read safely.",
    );
    return "stop";
  }

  if (version > SCHEMA_VERSION) {
    c.add(
      "version_too_new",
      "schemaVersion",
      `This page was made with a newer version of the tool (version ${version}, this one understands ${SCHEMA_VERSION}). Update to open it. Your page has not been changed.`,
    );
    return "stop";
  }

  return "continue";
}

/**
 * Validates an already-parsed value. Never throws.
 *
 * On success the input is returned as a `Document`. It is not copied, because
 * nothing here mutates it and copying a validated page would cost time for no
 * guarantee. On failure every problem found is returned, not just the first.
 */
export function validateDocument(input: unknown): ValidationResult {
  const c = new Collector();

  if (!isPlainObject(input)) {
    c.add("not_an_object", "", "This file is not a page. A page is a set of settings and a list of sections.");
    return { ok: false, issues: c.issues };
  }

  if (checkVersion(input, c) === "stop") {
    return { ok: false, issues: c.issues };
  }

  // FR-005. A page from an older version is brought forward before its fields
  // are checked, because those fields are validated against the CURRENT shape.
  // At version 1 this is a no-op, since no older version exists. It is wired up
  // now rather than when it is first needed: the day a second version ships,
  // pages saved by version 1 already exist and cannot be reached retroactively.
  const stored = input["schemaVersion"] as number;
  const candidate = stored < SCHEMA_VERSION ? migrate(input, stored) : input;

  checkFields(DOCUMENT_FIELDS, candidate, "", c);

  if (c.issues.length > 0) return { ok: false, issues: c.issues };

  // Holistic review H-3: the accepted page is a copy, never the caller's own
  // object. The editor validates a draft it is still holding, and handing back
  // that same object would make the app's saved page and the draft the artist
  // keeps typing into one thing, so the saved copy would change underneath it.
  // Returning a copy also strips any unknown key that survived to here.
  return { ok: true, document: ordered(DOCUMENT_FIELDS, candidate) as unknown as Document };
}

/**
 * Parses text and validates it. Never throws.
 *
 * A parse failure becomes an issue rather than an exception, because a
 * corrupted or truncated file is an ordinary thing for an artist to have, not
 * an exceptional condition for the program.
 */
export function parseDocument(json: string): ValidationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return {
      ok: false,
      issues: [
        {
          code: "invalid_json",
          path: "",
          message: "This file is damaged or incomplete, so it cannot be read as a page.",
        },
      ],
    };
  }
  return validateDocument(parsed);
}
