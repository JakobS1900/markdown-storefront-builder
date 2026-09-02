/**
 * The schema descriptor. This IS the schema.
 *
 * Three things read it and nothing else defines the shape of a page:
 *   - the validator walks it,
 *   - the canonical writer emits keys in its order,
 *   - the parity test snapshots it.
 *
 * The types in `types.ts` are DERIVED from what is here, so a field added below
 * appears in the types automatically. If you find yourself hand editing a type
 * to make something compile, the derivation is broken and that is the bug.
 *
 * ORDER IS NORMATIVE. The sequence of fields in each array below is the order
 * the writer emits and the order the parity test guards. Reordering is a schema
 * change, not a tidy-up.
 */

export const SCHEMA_VERSION = 3;

export const BLOCK_KINDS = [
  "heading",
  "divider",
  "prose",
  "menu",
  "gallery",
  "profile",
] as const;

export type BlockKind = (typeof BLOCK_KINDS)[number];

/**
 * Field kinds the descriptor can express.
 *
 * `integer` means a finite integer. Review finding R-2: NaN and Infinity
 * stringify to null, and null is never valid here, so a page containing one
 * would be written in a state that cannot be read back.
 */
export type FieldSpec =
  | { readonly name: string; readonly type: "string"; readonly required: boolean; readonly nonEmpty?: boolean }
  | { readonly name: string; readonly type: "integer"; readonly required: boolean; readonly min?: number; readonly max?: number }
  | { readonly name: string; readonly type: "enum"; readonly required: boolean; readonly values: readonly string[] }
  | { readonly name: string; readonly type: "stringArray"; readonly required: boolean }
  | { readonly name: string; readonly type: "objectArray"; readonly required: boolean; readonly of: readonly FieldSpec[] }
  | { readonly name: string; readonly type: "blockArray"; readonly required: boolean };

/** A labelled fact about an item. Colour: black. Origin: Ecuador. */
export const MENU_DETAIL_FIELDS = [
  { name: "label", type: "string", required: true },
  { name: "value", type: "string", required: true },
] as const satisfies readonly FieldSpec[];

/**
 * How much of the item, and what that much costs. One lb for 20, five for 90.
 *
 * Both halves are text for the reason `price` is text: people write "a dozen",
 * "5 lb" and "2+", and a numeric type would either refuse those or quietly
 * discard what somebody wrote.
 */
export const MENU_QUANTITY_FIELDS = [
  { name: "amount", type: "string", required: true },
  { name: "price", type: "string", required: true },
] as const satisfies readonly FieldSpec[];

export const MENU_TIER_FIELDS = [
  // First, for the same reason `id` is first on every block: a validation issue
  // must always be able to name the row it came from. Added at version 3 so a
  // selection can name "these forty of sixty" and survive the seller reordering
  // a row. Held by position instead, a selection points at the wrong products
  // the moment anything moves, and repricing the wrong products is the worst
  // thing this feature could do.
  { name: "id", type: "string", required: true, nonEmpty: true },
  { name: "name", type: "string", required: true },
  // A string, not a number. Artists write "45", "from 45", "45+", and "DM me".
  // A numeric type would either reject real prices or discard what they wrote.
  { name: "price", type: "string", required: true },
  // What one of the price buys: "per lb", "each", "per dozen", "per hour".
  //
  // Twenty dollars of bananas is not a price until you know it buys a pound.
  // Free text rather than a list, because the set of things people sell by is
  // not enumerable, and a list that is missing somebody's unit is worse than no
  // list at all. It sits beside the price rather than in the name, because
  // "Bananas, per lb" answers a different question from "$20 per lb".
  { name: "unit", type: "string", required: false },
  { name: "blurb", type: "string", required: false },
  { name: "includes", type: "stringArray", required: false },
  // Labelled facts, with the labels chosen by the seller. Colour, size, weight,
  // storage, origin. Free labels for the same reason `unit` is free text: this
  // has to serve a knife maker, a greengrocer and somebody selling phones
  // without any of them being second class.
  { name: "details", type: "objectArray", required: false, of: MENU_DETAIL_FIELDS },
  // Bulk pricing. Feature 016 declined this and said why, and feature 017
  // reverses that after the substitute it relied on was tried: a second row
  // reading "Bananas, 5 lb" states that this is a different product, because
  // that is what a sibling row means. A bulk price is a property of one item.
  { name: "quantities", type: "objectArray", required: false, of: MENU_QUANTITY_FIELDS },
  // Photographs of the item. A list since version 2, because one was not
  // enough for anybody selling a physical object: a print, a knife or a bag
  // wants a front, a back and a detail, and the gallery is a separate section
  // with no way to say which product a picture belongs to.
  //
  // This replaced `imageUrl` rather than sitting beside it. Two fields meaning
  // the same thing is two things to keep in step and two things for a reader
  // to choose between, and the migration below means nothing is lost.
  { name: "imageUrls", type: "stringArray", required: false },
  // What the seller paid. Text for the same reason `price` is text, and never
  // compiled: stored here, but `engine/tests/compile/cost-never-published.test.ts`
  // enforces that it never reaches compiled output, for any target. The app
  // publishes this page, so a supplier cost reaching a customer would be a
  // disclosure the seller never agreed to.
  { name: "cost", type: "string", required: false },
] as const satisfies readonly FieldSpec[];

export const MENU_ADDON_FIELDS = [
  { name: "name", type: "string", required: true },
  { name: "price", type: "string", required: true },
] as const satisfies readonly FieldSpec[];

export const GALLERY_ITEM_FIELDS = [
  { name: "imageUrl", type: "string", required: true },
  { name: "caption", type: "string", required: false },
  { name: "linkUrl", type: "string", required: false },
] as const satisfies readonly FieldSpec[];

export const PROFILE_LINK_FIELDS = [
  { name: "label", type: "string", required: true },
  { name: "url", type: "string", required: true },
] as const satisfies readonly FieldSpec[];

/**
 * Present on every block, in this order, before that block's own fields.
 * `id` first so a validation issue can always name the block it came from.
 *
 * `nonEmpty` appears on exactly two fields in this whole schema, `id` and
 * `target`, and both are structural. Content fields deliberately allow an empty
 * string.
 *
 * That was not the original design, and running the editor for the first time
 * showed why it had to change. Adding an "About you" section creates a profile
 * with no name yet, which the old schema rejected, so the first action a new
 * user takes made their page unsaveable. Inventing placeholder text would have
 * put words in their mouth.
 *
 * The deeper point: an empty display name is a perfectly valid document. It is
 * a page that will render oddly, and this project's own rule is that the
 * compiler warns rather than the contract refuses. Emptiness is a publishing
 * concern, not a storage one.
 *
 * Relaxing a constraint is backward compatible. Every page valid before is
 * valid now, so no version bump and no migration are needed. The parity
 * snapshot changes, which is the guard doing its job.
 */
export const COMMON_BLOCK_FIELDS = [
  { name: "id", type: "string", required: true, nonEmpty: true },
  { name: "kind", type: "enum", required: true, values: BLOCK_KINDS },
] as const satisfies readonly FieldSpec[];

export const BLOCK_FIELDS = {
  heading: [
    { name: "text", type: "string", required: true },
    { name: "level", type: "integer", required: true, min: 1, max: 6 },
  ],
  divider: [],
  prose: [
    { name: "heading", type: "string", required: false },
    // Stored verbatim. Its inline grammar is defined in 1.3 with the
    // sanitizer, not here.
    { name: "text", type: "string", required: true },
  ],
  menu: [
    { name: "heading", type: "string", required: false },
    { name: "currency", type: "string", required: false },
    { name: "tiers", type: "objectArray", required: true, of: MENU_TIER_FIELDS },
    { name: "addOns", type: "objectArray", required: false, of: MENU_ADDON_FIELDS },
  ],
  gallery: [
    { name: "heading", type: "string", required: false },
    { name: "layout", type: "enum", required: true, values: ["grid", "list", "single"] },
    { name: "items", type: "objectArray", required: true, of: GALLERY_ITEM_FIELDS },
  ],
  profile: [
    { name: "displayName", type: "string", required: true },
    { name: "avatarUrl", type: "string", required: false },
    { name: "tagline", type: "string", required: false },
    { name: "status", type: "enum", required: false, values: ["open", "closed", "waitlist"] },
    { name: "links", type: "objectArray", required: false, of: PROFILE_LINK_FIELDS },
    { name: "paymentMethods", type: "stringArray", required: false },
  ],
} as const satisfies Record<BlockKind, readonly FieldSpec[]>;

/**
 * `schemaVersion` is first so the version gate can read it before anything
 * else is inspected. Guarantee G6: a page from a future version is refused
 * without its contents being read.
 *
 * `target` is a plain string and is deliberately NOT checked against a list of
 * known hosts. Research D5: enumerating hosts here would mean adding a host
 * required editing this contract and regenerating the parity snapshot, which is
 * exactly the coupling Principle II forbids.
 */
export const DOCUMENT_FIELDS = [
  { name: "schemaVersion", type: "integer", required: true, min: 1 },
  { name: "target", type: "string", required: true, nonEmpty: true },
  { name: "title", type: "string", required: false },
  { name: "blocks", type: "blockArray", required: true },
] as const satisfies readonly FieldSpec[];

