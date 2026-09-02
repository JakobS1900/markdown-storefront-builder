/**
 * Forward migration. Empty at version 1, and that is the point.
 *
 * There is nothing to migrate from yet, because this is the first version. The
 * mechanism exists now because it cannot be added later: by the time a second
 * version exists there are already pages saved by version 1, written by a build
 * that had no migration path, and those pages cannot be reached retroactively.
 * Building it now costs almost nothing and buys the only window in which it can
 * be built at all. Research D7.
 *
 * Migrations are forward only. There is no path from a newer version back to an
 * older one, by design: a downgrade would have to discard whatever the newer
 * version added, which is the artist's work. A future page is refused instead,
 * which is recoverable, where silently dropping content is not.
 */

export interface Migration {
  /** The version this step reads. */
  readonly from: number;
  /** The version it produces. Always `from + 1`, so steps chain without gaps. */
  readonly to: number;
  /**
   * Transforms a page of version `from` into one of version `to`.
   *
   * Must not mutate its input, and must set `schemaVersion` to `to` on the
   * value it returns. Each step needs a fixture pair covering it, per
   * constitution Principle V.
   */
  readonly apply: (doc: Record<string, unknown>) => Record<string, unknown>;
}

/**
 * One image on a price list item became a list of them.
 *
 * The first migration this project has ever run, three versions of the schema
 * after the mechanism was built for it. Everything below is the shape the
 * comment above predicted, which is the whole reason it was built early.
 *
 * A page saved by version 1 has at most one `imageUrl` on each item. It
 * becomes the first entry of `imageUrls`, and an item that had none gains
 * nothing, because absent and empty must not both be able to mean the same
 * thing: the contract distinguishes them and round tripping depends on it.
 */
function tierImagesToList(doc: Record<string, unknown>): Record<string, unknown> {
  const blocks = Array.isArray(doc["blocks"]) ? doc["blocks"] : [];
  return {
    ...doc,
    schemaVersion: 2,
    blocks: blocks.map((block: unknown) => {
      if (typeof block !== "object" || block === null) return block;
      const b = block as Record<string, unknown>;
      if (b["kind"] !== "menu" || !Array.isArray(b["tiers"])) return b;
      return {
        ...b,
        tiers: b["tiers"].map((tier: unknown) => {
          if (typeof tier !== "object" || tier === null) return tier;
          const t = { ...(tier as Record<string, unknown>) };
          const url = t["imageUrl"];
          delete t["imageUrl"];
          // An empty string is what an emptied field used to leave behind in
          // some saved pages. It is not an image, and carrying it forward
          // would turn "no picture" into "a list with a broken one in it".
          if (typeof url === "string" && url !== "") t["imageUrls"] = [url];
          return t;
        }),
      };
    }),
  };
}

/**
 * Every price list row gains an identifier.
 *
 * Positional, `t0` upward within each menu block, and never random. This runs
 * inside the engine, where Principle I forbids consuming randomness, and the
 * determinism property test requires the same page in to give the same page
 * out on every machine. New rows added in the app get a UUID from `newId()`
 * instead, so a migrated page holds a mix of the two. That is correct rather
 * than untidy: the two ids come from two places with different powers, and only
 * one of them had to be deterministic.
 *
 * Scoped per block rather than per document, because a selection never spans
 * two price lists and block scoping keeps these short.
 */
function tierIdsByPosition(doc: Record<string, unknown>): Record<string, unknown> {
  const blocks = Array.isArray(doc["blocks"]) ? doc["blocks"] : [];
  return {
    ...doc,
    schemaVersion: 3,
    blocks: blocks.map((block: unknown) => {
      if (typeof block !== "object" || block === null) return block;
      const b = block as Record<string, unknown>;
      if (b["kind"] !== "menu" || !Array.isArray(b["tiers"])) return b;
      return {
        ...b,
        tiers: b["tiers"].map((tier: unknown, i: number) => {
          if (typeof tier !== "object" || tier === null) return tier;
          const t = tier as Record<string, unknown>;
          // `id` first in the object as well as in the descriptor. The
          // canonical writer reorders on the way out, so this is only for
          // anyone reading the intermediate value in a debugger.
          return { id: `t${String(i)}`, ...t };
        }),
      };
    }),
  };
}

/**
 * Ordered by `from`, ascending, with no gaps.
 *
 * When adding another entry:
 *   1. Add `{ from: N, to: N + 1, apply }` here.
 *   2. Bump `SCHEMA_VERSION` in `descriptor.ts`.
 *   3. Add a fixture saved at version N and assert it loads and migrates.
 *   4. Regenerate the parity snapshot and read the diff.
 */
export const MIGRATIONS: readonly Migration[] = [
  { from: 1, to: 2, apply: tierImagesToList },
  { from: 2, to: 3, apply: tierIdsByPosition },
];

/**
 * Brings a page forward from its stored version to the current one.
 *
 * A page already at the current version is returned as it came in, not copied,
 * because copying would cost time to produce a value that is equal anyway.
 *
 * The caller has already established that `from` is not newer than the current
 * version. That check belongs to the validator, which refuses a future page
 * before reading anything else.
 */
export function migrate(doc: Record<string, unknown>, from: number): Record<string, unknown> {
  let current = doc;
  for (const step of MIGRATIONS) {
    if (step.from >= from) current = step.apply(current);
  }
  return current;
}
