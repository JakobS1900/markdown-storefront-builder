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
 * Ordered by `from`, ascending, with no gaps.
 *
 * When adding the first entry:
 *   1. Add `{ from: 1, to: 2, apply }` here.
 *   2. Bump `SCHEMA_VERSION` in `descriptor.ts` to 2.
 *   3. Add a fixture saved at version 1 and assert it loads and migrates.
 *   4. Regenerate the parity snapshot and read the diff.
 */
export const MIGRATIONS: readonly Migration[] = [];

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
