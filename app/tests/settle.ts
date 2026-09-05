/**
 * Waits for the app to stop changing, rather than for a number of ticks.
 *
 * Every file that needed this had its own copy of
 *
 *   for (let i = 0; i < 10; i += 1) await new Promise((r) => setTimeout(r, 0));
 *
 * which is a guess at how long a save takes dressed up as a wait. The guesses
 * were close. Measured on 2026-09-05 by squeezing the budget and rerunning:
 * every one of these files passes at 5 ticks and fails at 3, against budgets of
 * 10 and 12. So the margin was about two, on a suite that already times out
 * under parallel load, and the number was chosen by nobody.
 *
 * This is the same defect that took `starters-picker` down earlier that day,
 * caught before it bit rather than after: there the work was a dynamic import
 * needing 30 ticks against a budget of 12, and it failed the moment the file
 * ran first. The difference is margin, not kind.
 *
 * So: subscribe to the store, tick until nothing has fired for `quiet`
 * consecutive ticks, and give up loudly at `ceiling`. Work that finishes early
 * returns early; work that takes forty ticks under load gets forty. Nothing has
 * to be re-tuned when the machine is busy.
 *
 * `quiet` is 6 because the measurement above put the whole of this work inside
 * 5 ticks, so six consecutive silent ones cannot land in the middle of a chain
 * that is still going. `ceiling` throws rather than returning quietly, because
 * a wait that gives up and lets the assertions run is how a timing bug turns
 * into a confusing assertion failure three lines later.
 */
import { subscribe } from "../src/store.js";

const tick = (): Promise<unknown> => new Promise((r) => setTimeout(r, 0));

export async function settle({ quiet = 6, ceiling = 300 } = {}): Promise<void> {
  let changed = false;
  const stop = subscribe(() => {
    changed = true;
  });

  try {
    let still = 0;
    for (let i = 0; i < ceiling; i += 1) {
      changed = false;
      await tick();
      still = changed ? 0 : still + 1;
      if (still >= quiet) return;
    }
  } finally {
    stop();
  }

  throw new Error(
    `settle gave up after ${String(ceiling)} ticks: the app never stopped changing`,
  );
}
