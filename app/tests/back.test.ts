/**
 * @vitest-environment jsdom
 *
 * Back should go back, not out.
 *
 * On the phone, pressing back left the app from every screen:
 *
 *   back from Preview  -> LEFT the app
 *   back from Copy     -> LEFT the app
 *   back from Build    -> LEFT the app
 *
 * From Build that is right. From the other two it throws away the app when the
 * person meant "return to Build". Capacitor does not intercept back at all, so
 * the activity simply finished.
 *
 * Moving between surfaces now leaves a history entry, so the WebView has
 * somewhere to go back to, and the native shell sends back there first. Build
 * itself pushes nothing, so back from Build still leaves, which is what a
 * person expects from the first screen of an app.
 */
import { beforeEach, describe, expect, it } from "vitest";

import { getState, init, setSurface } from "../src/store.js";
import { rememberSurface, startSurfaceHistory } from "../src/surface-history.js";

beforeEach(() => {
  init(false);
  history.replaceState(null, "", "#");
});

describe("moving between surfaces", () => {
  it("leaves a history entry when going somewhere other than Build", () => {
    const before = history.length;
    rememberSurface("preview");
    expect(history.length).toBeGreaterThan(before);
    expect((history.state as { surface?: string } | null)?.surface).toBe("preview");
  });

  it("does not stack an entry for Build, so back from the first screen leaves the app", () => {
    rememberSurface("build");
    expect(history.state).toBeNull();
  });

  it("does not stack a second entry for the surface already showing", () => {
    rememberSurface("preview");
    const after = history.length;
    rememberSurface("preview");
    expect(history.length).toBe(after);
  });

  /**
   * Build is the first screen, so back from anywhere else returns to it and
   * back from it leaves. Plain browser history does not do that: it retraces,
   * so Preview then Copy then back landed on Preview, and toggling tabs ten
   * times needed ten presses to get out. Measured on the phone, where the
   * earlier check missed it by relaunching the app between every case.
   */
  it("keeps at most one entry beyond the first screen, however far you wander", () => {
    const root = history.length;
    rememberSurface("preview");
    rememberSurface("export");
    rememberSurface("preview");
    rememberSurface("export");

    expect(history.length, "the history stack grew with every tab press").toBe(root + 1);
    expect((history.state as { surface?: string } | null)?.surface).toBe("export");
  });

  it("gives back the entry when returning to Build, rather than stacking another", async () => {
    rememberSurface("preview");
    expect((history.state as { surface?: string } | null)?.surface).toBe("preview");

    rememberSurface("build");

    // Going back is asynchronous, so wait for it rather than guessing a delay.
    for (let i = 0; i < 50 && history.state !== null; i += 1) {
      await new Promise((r) => setTimeout(r, 10));
    }

    expect(history.state, "returning to Build left an entry behind").toBeNull();
  });
});

describe("when the system goes back", () => {
  it("returns to Build rather than closing", () => {
    startSurfaceHistory();
    setSurface("preview");
    expect(getState().surface).toBe("preview");

    window.dispatchEvent(new PopStateEvent("popstate", { state: null }));

    expect(getState().surface).toBe("build");
  });

  it("returns to whichever surface the entry names", () => {
    startSurfaceHistory();
    setSurface("export");

    window.dispatchEvent(new PopStateEvent("popstate", { state: { surface: "preview" } }));

    expect(getState().surface).toBe("preview");
  });

  it("ignores an entry naming something that is not a surface", () => {
    startSurfaceHistory();
    setSurface("preview");

    window.dispatchEvent(new PopStateEvent("popstate", { state: { surface: "nonsense" } }));

    expect(getState().surface).toBe("build");
  });
});
