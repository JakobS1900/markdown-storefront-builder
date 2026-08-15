/**
 * Types DERIVED from the descriptor. Nothing here is hand written.
 *
 * Review finding R-1: the original plan kept these by hand alongside the
 * descriptor, which is two artifacts that must agree and nothing failing when
 * they do not. Deriving them means a field added to the descriptor appears here
 * automatically, and a field that exists only in a type is impossible.
 *
 * What this closes completely: field names, optionality, primitive types, and
 * string-literal enums, because all four are recoverable from a literal type.
 *
 * What it does NOT close, recorded so nobody believes the types prove more than
 * they do: cross-field rules such as identifier uniqueness within a page and the
 * numeric range on `level`. Those are the validator's job and have their own
 * tests.
 */
import type {
  BLOCK_FIELDS,
  BlockKind,
  COMMON_BLOCK_FIELDS,
  DOCUMENT_FIELDS,
  FieldSpec,
} from "./descriptor.js";

/** The value type a single field spec describes. */
type ValueOf<F> = F extends { type: "string" }
  ? string
  : F extends { type: "integer" }
    ? number
    : F extends { type: "enum"; values: readonly (infer V)[] }
      ? V
      : F extends { type: "stringArray" }
        ? readonly string[]
        : F extends { type: "objectArray"; of: readonly FieldSpec[] }
          ? readonly ObjectOf<F["of"]>[]
          : F extends { type: "blockArray" }
            ? readonly Block[]
            : never;

type NamesWhereRequired<Fs extends readonly FieldSpec[], R extends boolean> = Extract<
  Fs[number],
  { required: R }
>["name"];

type SpecNamed<Fs extends readonly FieldSpec[], N> = Extract<Fs[number], { name: N }>;

/**
 * Required fields become required properties, optional ones become optional.
 *
 * The project runs with `exactOptionalPropertyTypes`, so an optional property
 * here means absent or a real value. It never means `undefined` and never means
 * `null`. Research D4: allowing a third state would make round-trip equality
 * depend on which representation the writer happened to pick.
 */
type ObjectOf<Fs extends readonly FieldSpec[]> = {
  [K in NamesWhereRequired<Fs, true>]: ValueOf<SpecNamed<Fs, K>>;
} & {
  [K in NamesWhereRequired<Fs, false>]?: ValueOf<SpecNamed<Fs, K>>;
};

/** Flattens an intersection so editor tooltips and errors stay readable. */
type Flatten<T> = { [K in keyof T]: T[K] } & {};

type CommonBlock = ObjectOf<typeof COMMON_BLOCK_FIELDS>;

/** One variant of the tagged union, discriminated on `kind`. */
type BlockOf<K extends BlockKind> = Flatten<
  Omit<CommonBlock, "kind"> & { kind: K } & ObjectOf<(typeof BLOCK_FIELDS)[K]>
>;

/** The tagged union across every kind the descriptor declares. */
export type Block = { [K in BlockKind]: BlockOf<K> }[BlockKind];

export type Document = Flatten<ObjectOf<typeof DOCUMENT_FIELDS>>;

export type { BlockKind } from "./descriptor.js";

/**
 * Stable codes for everything that can be wrong with a page.
 *
 * The code exists so the app can specialize or translate a message later
 * without parsing English. The sentence is written for an artist, not a
 * developer, per FR-003 and SC-006.
 */
export type IssueCode =
  | "invalid_json"
  | "not_an_object"
  | "missing_field"
  | "wrong_type"
  | "null_not_allowed"
  | "unknown_field"
  | "unknown_kind"
  | "duplicate_id"
  | "empty_string_not_allowed"
  | "out_of_range"
  | "not_finite"
  | "not_in_enum"
  | "version_missing"
  | "version_malformed"
  | "version_too_new";

export interface Issue {
  readonly code: IssueCode;
  /** Machine-readable location, for example `blocks[2].tiers[0].name`. */
  readonly path: string;
  /** Present whenever the problem is inside a block, so it can be pointed at. */
  readonly blockId?: string;
  /** Written for the artist whose page it is. */
  readonly message: string;
}

export type ValidationResult =
  | { readonly ok: true; readonly document: Document }
  | { readonly ok: false; readonly issues: readonly Issue[] };
