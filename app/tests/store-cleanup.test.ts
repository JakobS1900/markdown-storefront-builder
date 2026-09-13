/**
 * @vitest-environment jsdom
 *
 * The store owns deferred repaint timers and render subscribers. Tests that
 * mount the app must not leave either alive after jsdom tears the document down.
 */
import { describe, expect, it, vi } from "vitest";

import { getState, init, resetStoreForTests, subscribe, update } from "../src/store.js";

describe("store test cleanup", () => {
  it("clears deferred repaints and subscribers", async () => {
    vi.useFakeTimers();
    try {
      document.body.innerHTML = '<input id="title" type="text">';
      const field = document.getElementById("title");
      if (!(field instanceof HTMLInputElement)) throw new Error("missing title field");

      init(false);
      let painted = 0;
      subscribe(() => {
        painted += 1;
      });

      field.focus();
      update({ ...getState().doc, title: "A" });

      resetStoreForTests();
      await vi.advanceTimersByTimeAsync(400);

      expect(painted).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
